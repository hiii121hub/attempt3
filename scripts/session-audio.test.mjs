import test from 'node:test'
import assert from 'node:assert/strict'
import { createSessionSink } from './session-audio.mjs'
import { startupResources } from './startup-resources.mjs'
const id = '12345678-1234-4123-8123-123456789abc'
const name = `poxey_${id.replace(/-/g, '_')}`
const success = () => [
  { status: 0, stdout: 'PulseAudio' }, { status: 0, stdout: '42\n' },
  { status: 0, stdout: JSON.stringify([{ name, owner_module: 42 }]) },
  { status: 0, stdout: JSON.stringify([{ name: `${name}.monitor`, owner_module: 42 }]) },
]
function fixture(results = success()) {
  const calls = [], owned = [], env = { PULSE_SERVER: 'unix:/private/test-native' }
  return { calls, owned, env, options: { env, own: sink => owned.push(sink), run: (binary, args, options) => { calls.push({ binary, args, options }); return results.shift() } } }
}
test('requires a ready server, exact owned sink and monitor on the same server', () => {
  const f = fixture()
  assert.deepEqual(createSessionSink(id, f.options), { name, moduleId: '42' })
  assert.deepEqual(f.owned, [{ name, moduleId: '42' }])
  assert.deepEqual(f.calls.map(call => call.args), [['info'], ['load-module', 'module-null-sink', `sink_name=${name}`, 'rate=44100', 'channels=2'], ['--format=json', 'list', 'sinks'], ['--format=json', 'list', 'sources']])
  for (const call of f.calls) { assert.equal(call.binary, 'pactl'); assert.equal(call.options.env, f.env); assert.equal(call.options.timeout, 3000) }
})
for (const [label, step, result] of [
  ['server unavailable', 0, { status: 1 }], ['server timed out', 0, { status: null }],
  ['load failed', 1, { status: 1 }], ['invalid module ID', 1, { status: 0, stdout: 'not-an-id' }],
  ['invalid sink JSON', 2, { status: 0, stdout: '{' }],
  ['invalid source JSON', 3, { status: 0, stdout: '{' }],
  ['non-array sinks', 2, { status: 0, stdout: '{}' }],
  ['non-array sources', 3, { status: 0, stdout: '{}' }],
  ['sink absent', 2, { status: 0, stdout: '[]' }],
  ['monitor absent', 3, { status: 0, stdout: '[]' }],
  ['wrong sink owner', 2, { status: 0, stdout: JSON.stringify([{ name, owner_module: 99 }]) }],
  ['wrong monitor owner', 3, { status: 0, stdout: JSON.stringify([{ name: `${name}.monitor`, owner_module: 99 }]) }],
]) {
  test(`${label} fails closed; created module remains owned for rollback`, () => {
    const results = success(); results[step] = result
    const f = fixture(results)
    assert.throws(() => createSessionSink(id, f.options))
    assert.equal(f.owned.length, step >= 2 ? 1 : 0)
    if (step === 0) assert.equal(f.calls.length, 1)
  })
}
test('invalid session identity cannot create a sink or select arbitrary Pulse sources', () => {
  const f = fixture()
  assert.throws(() => createSessionSink('default.monitor', f.options))
  assert.equal(f.calls.length, 0)
})
test('monitor readiness failure rolls the registered sink and profile back', async () => {
  const removed = [], results = success(); results[3] = { status: 0, stdout: '[]' }
  const f = fixture(results)
  const owner = startupResources({ killTree() {}, isAlive: () => false, wait: async () => {}, removeSink: moduleId => removed.push(moduleId), removeDirectory: dir => removed.push(dir) })
  owner.directory('/owned-test/profile')
  assert.throws(() => createSessionSink(id, { ...f.options, own: sink => owner.sink(sink) }))
  await owner.rollback()
  assert.deepEqual(removed, ['42', '/owned-test/profile'])
})
