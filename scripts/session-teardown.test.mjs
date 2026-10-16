import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { processRunning, teardownResources } from './session-teardown.mjs'
import { sessionCapacity } from './session-capacity.mjs'

test('sending a signal does not establish process exit', () => {
  assert.equal(processRunning({ pid: 42, exitCode: null, signalCode: null, killed: true }), true)
  assert.equal(processRunning({ pid: 42, exitCode: null, signalCode: 'SIGTERM' }), false)
  assert.equal(processRunning({ pid: 42, exitCode: 0, signalCode: null }), false)
  assert.equal(processRunning({ exitCode: null, signalCode: null }), false)
  assert.equal(processRunning(null), false)
})
test('TERM-resistant real child is killed before profile removal and capacity release', { timeout: 7000 }, async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'poxey-teardown-test-'))
  const owned = path.join(root, 'session-a'), other = path.join(root, 'session-b')
  fs.mkdirSync(owned); fs.mkdirSync(other)
  fs.writeFileSync(path.join(owned, 'profile'), 'owned test data')
  fs.writeFileSync(path.join(root, 'poxey-free-usage.json'), '{"usage":123}')
  const capacity = sessionCapacity(1), slot = capacity.reserve()
  const child = spawn(process.execPath, ['-e', 'process.on("SIGTERM",()=>{}); process.stdout.write("ready"); setInterval(()=>{},1000)'], { stdio: ['ignore', 'pipe', 'ignore'] })
  try {
    await once(child.stdout, 'data')
    const exited = once(child, 'exit')
    const signals = []
    const cleanup = teardownResources({
      children: [child], isAlive: processRunning,
      killTree: (process, signal) => { signals.push(signal); process.kill(signal) },
      wait: ms => new Promise(resolve => setTimeout(resolve, ms)),
      removeSink() {},
      removeDirectory() { assert.equal(processRunning(child), false); fs.rmSync(owned, { recursive: true }) },
    }).then(() => slot.release())
    assert.equal(capacity.reserve(), null)
    await cleanup
    assert.equal((await exited)[1], 'SIGKILL')
    assert.deepEqual(signals, ['SIGTERM', 'SIGKILL'])
    assert.equal(fs.existsSync(owned), false)
    assert.equal(fs.existsSync(other), true)
    assert.equal(fs.readFileSync(path.join(root, 'poxey-free-usage.json'), 'utf8'), '{"usage":123}')
    assert.ok(capacity.reserve())
  } finally {
    if (processRunning(child)) child.kill('SIGKILL')
    fs.rmSync(root, { recursive: true, force: true })
  }
})
test('cleanup errors still attempt remaining resources but do not free capacity', async () => {
  const capacity = sessionCapacity(1), slot = capacity.reserve(), calls = []
  await assert.rejects(teardownResources({
    children: [], isAlive: processRunning, killTree() {}, wait: async () => {},
    removeSink() { calls.push('sink'); throw new Error('sink failed') },
    removeDirectory() { calls.push('profile') },
  }).then(() => slot.release()), AggregateError)
  assert.deepEqual(calls, ['sink', 'profile'])
  assert.equal(capacity.reserve(), null)
})
test('a process that cannot be stopped prevents profile deletion and slot release', async () => {
  const capacity = sessionCapacity(1), slot = capacity.reserve(), calls = []
  await assert.rejects(teardownResources({
    children: [{}], isAlive: () => true, killTree: (_, signal) => calls.push(signal), wait: async () => {},
    removeSink() { calls.push('sink') }, removeDirectory() { calls.push('profile') },
  }).then(() => slot.release()), AggregateError)
  assert.deepEqual(calls, ['SIGTERM', 'SIGKILL', 'sink'])
  assert.equal(capacity.reserve(), null)
})
