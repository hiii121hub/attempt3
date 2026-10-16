import test from 'node:test'
import assert from 'node:assert/strict'
import { offlineWorkerSpec, ownedWorkerCleanup } from './worker-spec.mjs'

const input = () => ({ sessionId: '12345678-1234-4123-8123-123456789abc', image: `registry.example/poxey/worker@sha256:${'a'.repeat(64)}`, cpuMillis: 500, memoryMiB: 1024, pids: 256, tmpMiB: 128, shmMiB: 128 })
const inspect = spec => ({ Id: 'b'.repeat(64), Name: `poxey-offline-${input().sessionId}`, Config: { Labels: { 'org.poxey.owner': 'poxey-offline-prototype-v2', 'org.poxey.session': input().sessionId, 'org.poxey.attempt': spec.attemptId } } })

test('offline specification isolates resources, bounds quotas and exposes no host services', () => {
  const spec = offlineWorkerSpec(input())
  for (const flag of ['--network=none', '--userns=auto:size=65536', '--pid=private', '--ipc=private', '--cgroupns=private', '--read-only', '--read-only-tmpfs=true', '--image-volume=ignore', '--cap-drop=ALL', '--security-opt=no-new-privileges', '--cpus=0.5', '--memory=1024m', '--memory-swap=1025m', '--pids-limit=256', '--http-proxy=false']) assert.ok(spec.args.includes(flag))
  assert.ok(spec.args.includes('--shm-size=128m'))
  assert.ok(spec.args.includes('--tmpfs=/run:rw,nosuid,nodev,noexec,size=16m,uid=1000,gid=1000,mode=700'))
  assert.ok(spec.args.includes('--tmpfs=/var/tmp:rw,nosuid,nodev,noexec,size=16m,mode=1777'))
  assert.ok(!spec.args.some(arg => /^(--volume|--mount|--publish|--privileged|--env-host|--cap-add)/.test(arg)))
  assert.equal(spec.args.at(-1), input().image)
  assert.equal(spec.stage, 'offline-prototype-only')
})
for (const [key, value] of [
  ['sessionId', '../../another-session'], ['sessionId', '-v=/host:/host'],
  ['image', 'worker:latest'], ['image', 'worker@sha256:bad'], ['image', 'worker; echo unsafe'],
  ['cpuMillis', 0], ['cpuMillis', 1.5], ['memoryMiB', 0], ['pids', -1], ['pids', Infinity],
  ['tmpMiB', 0], ['shmMiB', NaN], ['pids', '256'],
  ['network', 'host'], ['volumes', ['/var/lib/poxey']], ['privileged', true], ['env', { GITHUB_TOKEN: 'test' }],
]) {
  test(`rejects unsafe or unsupported worker option ${key}=${JSON.stringify(value)}`, () => assert.throws(() => offlineWorkerSpec({ ...input(), [key]: value })))
}
test('requires explicit quotas and rejects filesystem ceilings that exhaust memory', () => {
  const config = input(); delete config.memoryMiB
  assert.throws(() => offlineWorkerSpec(config))
  assert.throws(() => offlineWorkerSpec({ ...input(), tmpMiB: 600, shmMiB: 600 }))
})
test('separate broker UUIDs produce different resource identities', () => {
  assert.notEqual(offlineWorkerSpec(input()).name, offlineWorkerSpec({ ...input(), sessionId: '87654321-4321-4123-9123-abcdef123456' }).name)
})
test('cleanup targets only the inspected container ID with matching broker ownership', () => {
  const spec = offlineWorkerSpec(input()), value = inspect(spec)
  assert.deepEqual(ownedWorkerCleanup(spec, value), [['stop', '--time=5', 'b'.repeat(64)], ['rm', 'b'.repeat(64)]])
  assert.throws(() => ownedWorkerCleanup(spec, null))
  for (const wrong of [{ ...value, Name: 'unrelated' }, { ...value, Id: '--all' }, { ...value, Config: { Labels: {} } }, { ...value, Config: { Labels: { ...value.Config.Labels, 'org.poxey.session': 'another-session' } } }]) {
    assert.throws(() => ownedWorkerCleanup(spec, wrong))
  }
})
