import test from 'node:test'
import assert from 'node:assert/strict'
import { offlineWorkerSpec } from './worker-spec.mjs'
import { verifyWorkerInspection } from './worker-inspection.mjs'
import { workerFixture } from './worker-fixture.mjs'
const input = { sessionId: '12345678-1234-4123-8123-123456789abc', image: `registry.example/poxey/worker@sha256:${'a'.repeat(64)}`, cpuMillis: 500, memoryMiB: 1024, pids: 256, tmpMiB: 128, shmMiB: 128 }
test('strict synthetic inspection validates configuration without claiming kernel isolation', () => {
  const spec = offlineWorkerSpec(input)
  assert.deepEqual(verifyWorkerInspection(spec, workerFixture(spec)), { configurationVerified: true, kernelBoundariesVerified: false })
})
const mutations = {
  'missing inspection fields': v => delete v.HostConfig,
  'wrong image': v => v.ImageDigest = 'sha256:' + 'c'.repeat(64),
  'root worker': v => v.Config.User = '0:0',
  'host network': v => v.HostConfig.NetworkMode = 'host',
  'shared PID': v => v.HostConfig.PidMode = 'host',
  'shared IPC': v => v.HostConfig.IpcMode = 'shareable',
  'host user namespace': v => v.HostConfig.UsernsMode = 'host',
  'privileged': v => v.HostConfig.Privileged = true,
  'writable root': v => v.HostConfig.ReadonlyRootfs = false,
  'capabilities': v => v.EffectiveCaps = ['CAP_SYS_ADMIN'],
  'missing no-new-privileges': v => v.HostConfig.SecurityOpt = [],
  'unconfined seccomp': v => v.HostConfig.SecurityOpt.push('seccomp=unconfined'),
  'host bind': v => v.HostConfig.Binds = ['/var/lib/poxey:/host'],
  'unknown mount policy': v => delete v.HostConfig.Binds,
  'unrecognized volume': v => v.Mounts.push({ Type: 'volume', Destination: '/profile' }),
  'published VNC': v => v.HostConfig.PortBindings = { '5900/tcp': [{ HostPort: '5900' }] },
  'unbounded memory': v => v.HostConfig.Memory = 0,
  'unbounded swap': v => v.HostConfig.MemorySwap = -1,
  'unbounded PIDs': v => v.HostConfig.PidsLimit = 0,
  'unbounded CPU': v => v.HostConfig.CpuQuota = -1,
  'too little shared memory': v => v.HostConfig.ShmSize = 0,
  'writable filesystem unlimited': v => v.HostConfig.Tmpfs['/tmp'] = 'rw,nosuid,nodev,noexec,mode=1777',
  'duplicate mount options': v => v.HostConfig.Tmpfs['/tmp'] += ',size=999m',
  'nonprivate audio path': v => v.Config.Env = v.Config.Env.map(s => s.startsWith('PULSE_SERVER=') ? 'PULSE_SERVER=unix:/host/native' : s),
  'secret-bearing environment': v => v.Config.Env.push('GITHUB_TOKEN=synthetic'),
  'persistent logs': v => v.HostConfig.LogConfig.Type = 'journald',
  'automatic restart': v => v.HostConfig.RestartPolicy.Name = 'always',
  'different lifecycle attempt': v => v.Config.Labels['org.poxey.attempt'] = '87654321-4321-4123-9123-abcdef123456',
}
for (const [name, mutate] of Object.entries(mutations)) test(`rejects ${name}`, () => {
  const spec = offlineWorkerSpec(input), value = workerFixture(spec)
  mutate(value); assert.throws(() => verifyWorkerInspection(spec, value))
})
test('each attempt has a different cleanup ownership nonce even for the same session', () => {
  const first = offlineWorkerSpec(input), second = offlineWorkerSpec(input)
  assert.notEqual(first.attemptId, second.attemptId)
  assert.throws(() => verifyWorkerInspection(second, workerFixture(first)))
})
test('equivalent explicit byte-sized tmpfs limits are accepted', () => {
  const spec = offlineWorkerSpec(input), value = workerFixture(spec)
  value.HostConfig.Tmpfs['/tmp'] = value.HostConfig.Tmpfs['/tmp'].replace('128m', String(128 * 1024 * 1024))
  assert.equal(verifyWorkerInspection(spec, value).configurationVerified, true)
})
