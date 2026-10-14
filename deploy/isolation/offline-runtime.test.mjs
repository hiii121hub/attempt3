import test from 'node:test'
import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { offlineWorkerRuntime, boundedPodman } from './offline-runtime.mjs'
const host = () => ({ platform: 'linux', uid: 1000, podmanMajor: 5, rootless: true, cgroupVersion: 'v2', controllers: ['cpu', 'memory', 'pids'], subuids: 327680, subgids: 327680, userNamespaces: true })
const input = () => ({ sessionId: '12345678-1234-4123-8123-123456789abc', image: `registry.example/poxey/worker@sha256:${'a'.repeat(64)}`, cpuMillis: 500, memoryMiB: 1024, pids: 256, tmpMiB: 128, shmMiB: 128 })
function fixture(options = {}) {
  const calls = [], containers = new Map()
  let sequence = 0
  const run = async args => {
    calls.push(args)
    if (options.fail?.(args, calls)) throw Object.assign(new Error('Injected command failure'), { code: 125 })
    const target = args.at(-1)
    const container = [...containers.values()].find(item => item.Id === target || item.Name === target)
    if (args[0] === 'container' && args[1] === 'exists') {
      if (!container) throw Object.assign(new Error('absent'), { code: 1 })
      return { stdout: '' }
    }
    if (args[0] === 'container' && args[1] === 'inspect') return { stdout: JSON.stringify([container]) }
    if (args[0] === 'create') {
      const id = String(++sequence).repeat(64)
      const name = args.find(arg => arg.startsWith('--name=')).slice(7)
      const sessionId = args.find(arg => arg.startsWith('--label=org.poxey.session=')).split('=').at(-1)
      containers.set(id, { Id: id, Name: name, State: { Running: false }, Config: { Labels: { 'org.poxey.owner': 'poxey-offline-prototype-v1', 'org.poxey.session': sessionId } } })
      if (options.createResponseLost) throw Object.assign(new Error('response lost'), { code: 125 })
      return { stdout: id }
    }
    if (args[0] === 'start') { container.State.Running = !options.exitOnStart; return { stdout: target } }
    if (args[0] === 'stop') { container.State.Running = false; return { stdout: target } }
    if (args[0] === 'rm') { if (!options.keepAfterRemove) containers.delete(target); return { stdout: target } }
    throw new Error('Unexpected mock command')
  }
  const runtime = offlineWorkerRuntime({ enableOfflinePrototype: true, host, run, ...options.runtime })
  return { runtime, calls, containers }
}
test('requires explicit enablement and complete host qualification before mutation', async () => {
  assert.throws(() => offlineWorkerRuntime())
  for (const value of ['true', 'false', 1]) assert.throws(() => offlineWorkerRuntime({ enableOfflinePrototype: value }))
  const f = fixture({ runtime: { host: () => ({ platform: 'darwin' }) } })
  await assert.rejects(f.runtime.start(input()), /not qualified/)
  assert.equal(f.calls.length, 0); assert.equal(f.runtime.reservations, 0)
})
test('complete offline create/inspect/start/stop/remove slice; no Chrome-ready claim', async () => {
  const f = fixture(), handle = await f.runtime.start(input())
  assert.equal(handle.chromeReady, false); assert.equal(handle.stage, 'offline-container-only')
  assert.equal(f.runtime.reservations, 1)
  assert.ok(f.calls.find(args => args[0] === 'create').includes('--network=none'))
  await Promise.all([f.runtime.stop(input().sessionId), f.runtime.stop(input().sessionId)])
  await f.runtime.stop(input().sessionId)
  assert.equal(f.calls.filter(args => args[0] === 'stop').length, 1)
  assert.equal(f.calls.filter(args => args[0] === 'rm').length, 1)
  assert.equal(f.containers.size, 0); assert.equal(f.runtime.reservations, 0)
})
test('simultaneous starts cannot duplicate a session identity', async () => {
  const f = fixture(), first = f.runtime.start(input())
  assert.throws(() => f.runtime.start(input()), /already reserved/)
  await first; assert.equal(f.calls.filter(args => args[0] === 'create').length, 1)
  await f.runtime.stop(input().sessionId)
})
test('stop during start waits and removes only that worker', async () => {
  const f = fixture(), starting = f.runtime.start(input()), stopping = f.runtime.stop(input().sessionId)
  await Promise.all([starting, stopping]); assert.equal(f.containers.size, 0)
})
test('pre-existing matching name is never taken over or removed', async () => {
  const f = fixture()
  f.containers.set('9'.repeat(64), { Id: '9'.repeat(64), Name: `poxey-offline-${input().sessionId}` })
  await assert.rejects(f.runtime.start(input()), /refusing takeover/)
  assert.equal(f.containers.size, 1); assert.equal(f.calls.some(args => ['stop', 'rm', 'create'].includes(args[0])), false)
})
for (const phase of ['create', 'start']) {
  test(`${phase} command failure rolls back only its partial resource`, async () => {
    const f = fixture({ fail: args => args[0] === phase })
    await assert.rejects(f.runtime.start(input()))
    assert.equal(f.containers.size, 0); assert.equal(f.runtime.reservations, 0)
  })
}
test('ambiguous create response reconciles owned name before removal', async () => {
  const f = fixture({ createResponseLost: true })
  await assert.rejects(f.runtime.start(input()))
  assert.equal(f.containers.size, 0); assert.equal(f.runtime.reservations, 0)
  assert.ok(f.calls.some(args => args[0] === 'stop' && /^[0-9a-f]{64}$/.test(args.at(-1))))
})
test('immediate worker exit rolls back instead of reporting readiness', async () => {
  const f = fixture({ exitOnStart: true })
  await assert.rejects(f.runtime.start(input()), /remain running/)
  assert.equal(f.containers.size, 0)
})
test('changed labels fail closed without deleting someone else’s resource', async () => {
  const f = fixture(); const handle = await f.runtime.start(input())
  f.containers.get(handle.containerId).Config.Labels['org.poxey.session'] = 'another-session'
  await assert.rejects(f.runtime.stop(input().sessionId), /matching ownership/)
  assert.equal(f.containers.size, 1); assert.equal(f.runtime.reservations, 1)
  assert.equal(f.calls.some(args => args[0] === 'stop'), false)
})
test('stop failure prevents removal and retains reconciliation reservation', async () => {
  const f = fixture({ fail: args => args[0] === 'stop' }); await f.runtime.start(input())
  await assert.rejects(f.runtime.stop(input().sessionId))
  assert.equal(f.calls.some(args => args[0] === 'rm'), false); assert.equal(f.runtime.reservations, 1)
})
test('failed removal verification retains reservation', async () => {
  const f = fixture({ keepAfterRemove: true }); await f.runtime.start(input())
  await assert.rejects(f.runtime.stop(input().sessionId), /not verified/)
  assert.equal(f.runtime.reservations, 1)
})
test('one failed worker start preserves another active worker', async () => {
  let failNextStart = false
  const f = fixture({ fail: args => failNextStart && args[0] === 'start' }), a = await f.runtime.start(input())
  const second = { ...input(), sessionId: '87654321-4321-4123-9123-abcdef123456' }
  failNextStart = true
  await assert.rejects(f.runtime.start(second))
  assert.equal(f.containers.get(a.containerId).State.Running, true)
  assert.equal(f.containers.size, 1); assert.equal(f.runtime.reservations, 1)
  await f.runtime.stop(input().sessionId)
})
test('Podman runner fixes local mode, argv execution, deadline and output cap; excludes credentials', async () => {
  let observed
  await boundedPodman(['container', 'exists', 'safe-name'], { env: { HOME: '/private/owner', GITHUB_TOKEN: 'secret', CONTAINER_HOST: 'remote', PULSE_COOKIE: 'secret' }, exec: (binary, args, options, done) => { observed = { binary, args, options }; done(null, '') } })
  assert.equal(observed.binary, 'podman'); assert.equal(observed.args[0], '--remote=false')
  assert.equal(observed.options.timeout, 10000); assert.equal(observed.options.killSignal, 'SIGKILL')
  assert.equal(observed.options.shell, false); assert.equal(observed.options.maxBuffer, 1024 * 1024)
  assert.deepEqual(observed.options.env, { PATH: '/usr/local/bin:/usr/bin:/bin', HOME: '/private/owner' })
})
test('bounded runner actually terminates a real hung test child (not Podman)', async () => {
  await assert.rejects(boundedPodman([], { exec: (_binary, _args, options, done) => execFile(process.execPath, ['-e', 'setInterval(()=>{},1000)'], { ...options, timeout: 100 }, done) }), error => error.killed === true)
})
test('bounded runner rejects excessive output from a real test child (not Podman)', async () => {
  await assert.rejects(boundedPodman([], { exec: (_binary, _args, options, done) => execFile(process.execPath, ['-e', 'process.stdout.write(Buffer.alloc(2*1024*1024))'], options, done) }), error => error.code === 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER')
})
test('storage access errors are not mistaken for absence', async () => {
  const f = fixture({ fail: args => args[0] === 'container' && args[1] === 'exists' })
  await assert.rejects(f.runtime.start(input())); assert.equal(f.calls.some(args => args[0] === 'create'), false)
})
