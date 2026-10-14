import test from 'node:test'
import assert from 'node:assert/strict'
import { qualifyDisposableHost, loadConfig, verifyOwnedListener } from './guard.mjs'
import { linuxSampler } from './metrics.mjs'
import { spawnSync } from 'node:child_process'
const host = { platform: 'linux', uid: 1000, configuredState: '', exists: () => false, processes: () => ({ status: 0, stdout: 'node\nsshd\n' }), portFree: async () => true, quietWebPorts: async () => true }
test('only an empty, dedicated, non-root Linux test host qualifies', async () => assert.equal(await qualifyDisposableHost(host), true))
for (const variation of [{ platform: 'darwin' }, { uid: 0 }, { exists: () => true }, { exists: () => { throw new Error('unreadable') } },
  { processes: () => ({ status: 0, stdout: '  chrome\n' }) }, { processes: () => ({ status: 1 }) }, { portFree: async () => false },
  { configuredState: '/private/existing-accounting' }, { quietWebPorts: async () => false }, { processes: () => ({ status: 0, stdout: 'caddy\n' }) }]) {
  test('unsafe/unknown host refuses before fixture creation', async () => assert.rejects(qualifyDisposableHost({ ...host, ...variation })))
}
test('protected state is checked before process probes or network binds', async () => {
  let probes = 0
  await assert.rejects(qualifyDisposableHost({ ...host, exists: file => file === '/workspaces/.poxey-state/attempt3', processes: () => { probes++; throw new Error() } }))
  assert.equal(probes, 0)
})
test('configuration keeps six identities, a bounded 15–20 minute target and no recovery path', () => {
  assert.equal(loadConfig({ outputRoot: '/srv/private-load', acknowledgeDisposableHost: true }).durationSeconds, 900)
  for (const durationSeconds of [0, -1, 1201, 1500, 1.5, NaN]) assert.throws(() => loadConfig({ outputRoot: '/srv/private-load', acknowledgeDisposableHost: true, durationSeconds }))
  for (const outputRoot of ['/workspaces/.poxey-state/attempt3', '/workspaces/attempt3/test', '/tmp', '/', 'relative']) assert.throws(() => loadConfig({ outputRoot, acknowledgeDisposableHost: true }))
  assert.throws(() => loadConfig({ outputRoot: '/srv/private-load' }))
})
test('bind-race and recycled-PID checks refuse an unrelated listener', () => {
  const stat = '1 (node) ' + ['S', ...Array(18).fill('0'), '123'].join(' ')
  const tcp = ' 0: 0100007F:0F9D 00000000:0000 0A 0:0 0:0 0 1000 0 456\n'
  const read = file => file.endsWith('/stat') ? stat : tcp
  verifyOwnedListener(1, '123', read, () => ['3'], () => 'socket:[456]')
  assert.throws(() => verifyOwnedListener(1, '124', read, () => ['3'], () => 'socket:[456]'))
  assert.throws(() => verifyOwnedListener(1, '123', read, () => ['3'], () => 'socket:[789]'))
})
test('Linux sampler accounts for cgroup memory/CPU quota and records interface counters', () => {
  let time = 1000, usage = 0, oom = 0, ticks = 'cpu 10 0 10 80 0 0 0 0\n'
  const files = { '/proc/self/cgroup': '0::/test\n', '/proc/meminfo': 'MemTotal: 8388608 kB\nMemAvailable: 6291456 kB\n',
    '/sys/fs/cgroup/test/memory.max': String(4 * 1024 ** 3), '/sys/fs/cgroup/test/memory.current': String(1024 ** 3),
    '/sys/fs/cgroup/test/cpu.max': '200000 100000', '/sys/fs/cgroup/test/pids.current': '20',
    '/proc/net/dev': 'header\nheader\neth0: 100 0 0 0 0 0 0 0 200 0 0 0 0 0 0 0' }
  const read = file => file.endsWith('/cpu.stat') ? `usage_usec ${usage}` : file.endsWith('/memory.events') ? `oom_kill ${oom}` : file === '/proc/stat' ? ticks : files[file]
  const sample = linuxSampler({ read, now: () => time, logicalCpus: 8 })
  assert.equal(sample().memoryAvailableMiB, 3072)
  time += 1000; usage = 1000000; ticks = 'cpu 20 0 20 160 0 0 0 0\n'; oom = 1
  const result = sample()
  assert.equal(result.cgroupCpuPercent, 50); assert.ok(Math.abs(result.hostCpuPercent - 20) < 1e-9); assert.equal(result.oomEvents, 1)
  assert.deepEqual(result.networkInterfaceCounters.eth0, { rx: 100, tx: 200 })
  assert.equal(result.effectiveMemoryMiB, 4096)
})
test('real CLI on an unsupported host exits blocked before creating a directory or service', { skip: process.platform === 'linux' }, () => {
  const result = spawnSync(process.execPath, [new URL('./cli.mjs', import.meta.url).pathname, '--disposable-host', '/srv/poxey-disposable-test'], { encoding: 'utf8', timeout: 5000 })
  assert.equal(result.status, 1)
  assert.deepEqual(JSON.parse(result.stdout), { result: 'BLOCKED', report: null, humanAcceptance: 'NOT VERIFIED', blockedStage: 'disposable-host-guard' })
})
