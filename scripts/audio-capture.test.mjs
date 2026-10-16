import test from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter, once } from 'node:events'
import { PassThrough } from 'node:stream'
import { spawn } from 'node:child_process'
import { startAudioCapture } from './audio-capture.mjs'
function fixture() {
  const child = Object.assign(new EventEmitter(), { pid: 42, exitCode: null, signalCode: null, stdout: new PassThrough(), stderr: new PassThrough(), signals: [], kill(signal) { this.signals.push(signal); this.killed = true } })
  const client = Object.assign(new EventEmitter(), { readyState: 1, bufferedAmount: 0, sent: [], closes: [], send(bytes) { this.sent.push(bytes) }, close(...args) { this.closes.push(args); this.readyState = 2; this.emit('close') } })
  const session = { id: 'a', audioSink: { name: 'poxey_session_a' }, audioClients: new Set(), audioCaptures: new Set() }
  const timers = new Map(), logs = [], calls = [], env = { PULSE_SERVER: 'unix:/private/native' }
  const options = { client, session, env, spawn: (...args) => { calls.push(args); return child }, log: event => logs.push(event), schedule: (fn, ms) => { const timer = {}; timers.set(timer, { fn, ms }); return timer }, cancel: timer => timers.delete(timer), now: () => 10 }
  const fire = ms => { const [timer, task] = [...timers].find(([, task]) => task.ms === ms); timers.delete(timer); task.fn() }
  return { child, client, session, timers, logs, calls, env, options, fire }
}
test('same session-specific FFmpeg PCM route; first data clears startup deadline', () => {
  const f = fixture(), controller = startAudioCapture(f.options)
  assert.ok(f.calls[0][1].includes('poxey_session_a.monitor'))
  assert.ok(!f.calls[0][1].includes('default'))
  assert.equal(f.calls[0][2].env, f.env)
  const bytes = Buffer.alloc(400)
  f.child.stdout.emit('data', bytes)
  assert.deepEqual(f.client.sent, [bytes]); assert.equal(f.timers.size, 0)
  assert.equal(f.logs.at(-1).event, 'capture-first-pcm')
  controller.stop(); controller.stop()
  assert.deepEqual(f.child.signals, ['SIGTERM'])
  assert.equal(f.session.audioCaptures.size, 1, 'Retain process ownership until actual close')
  f.child.signalCode = 'SIGTERM'; f.child.emit('close')
  assert.equal(f.session.audioCaptures.size, 0); assert.equal(f.timers.size, 0)
})
test('stalled capture times out, closes only its socket and escalates termination', () => {
  const f = fixture(); startAudioCapture(f.options)
  f.fire(10000)
  assert.equal(f.client.closes[0][0], 1011)
  assert.equal(f.logs.at(-1).event, 'capture-first-pcm-timeout')
  assert.deepEqual(f.child.signals, ['SIGTERM'])
  f.fire(1500); assert.deepEqual(f.child.signals, ['SIGTERM', 'SIGKILL'])
  assert.equal(f.session.audioClients.size, 0)
  f.child.signalCode = 'SIGKILL'; f.child.emit('close')
  assert.equal(f.session.audioCaptures.size, 0)
})
test('disconnect before first PCM cancels initialization and kills owned capture', () => {
  const f = fixture(); startAudioCapture(f.options); f.client.emit('close')
  assert.equal([...f.timers.values()].some(timer => timer.ms === 10000), false)
  f.child.stdout.emit('data', Buffer.alloc(400)); assert.equal(f.client.sent.length, 0)
  f.fire(1500); assert.deepEqual(f.child.signals, ['SIGTERM', 'SIGKILL'])
})
test('synchronous spawn failure closes stream without publishing process ownership', () => {
  const f = fixture(); f.options.spawn = () => { throw new Error('spawn failed') }
  startAudioCapture(f.options)
  assert.equal(f.client.closes[0][0], 1011); assert.equal(f.session.audioCaptures.size, 0); assert.equal(f.timers.size, 0)
})
test('asynchronous spawn error cleans socket and deadline', () => {
  const f = fixture(); f.child.pid = undefined; startAudioCapture(f.options); f.child.emit('error', new Error('ENOENT')); f.child.emit('close')
  assert.equal(f.client.closes[0][0], 1011); assert.equal(f.session.audioCaptures.size, 0); assert.equal(f.timers.size, 0)
})
test('capture exit closes stream; empty data does not fake startup readiness', () => {
  const f = fixture(); startAudioCapture(f.options); f.child.stdout.emit('data', Buffer.alloc(0))
  assert.ok([...f.timers.values()].some(timer => timer.ms === 10000))
  f.child.exitCode = 1; f.child.emit('close')
  assert.equal(f.client.closes[0][0], 1011); assert.equal(f.timers.size, 0)
})
test('existing backpressure bound is retained', () => {
  const f = fixture(); f.client.bufferedAmount = 1024 * 1024; startAudioCapture(f.options)
  f.child.stdout.emit('data', Buffer.alloc(400)); assert.equal(f.client.sent.length, 0)
  f.child.exitCode = 0; f.child.emit('close')
})
test('one failed stream does not terminate another session capture', () => {
  const a = fixture(), b = fixture(); b.session.id = 'b'; b.session.audioSink.name = 'poxey_session_b'
  startAudioCapture(a.options); startAudioCapture(b.options); a.fire(10000)
  assert.equal(b.client.closes.length, 0); assert.equal(b.child.signals.length, 0)
  b.child.stdout.emit('data', Buffer.alloc(400)); assert.equal(b.client.sent.length, 1)
  b.child.exitCode = 0; b.child.emit('close')
})
test('missing sink and retiring session never start a capture', () => {
  for (const override of [{ audioSink: null }, { cleaningUp: true }]) {
    const f = fixture(); Object.assign(f.session, override); startAudioCapture(f.options)
    assert.equal(f.calls.length, 0); assert.equal(f.client.closes[0][0], 1011)
  }
})
test('real TERM-resistant capture is hard-stopped and removed from ownership', { timeout: 7000 }, async () => {
  const f = fixture()
  let child
  const controller = startAudioCapture({ ...f.options, schedule: setTimeout, cancel: clearTimeout, spawn: () => {
    child = spawn(process.execPath, ['-e', 'process.on("SIGTERM",()=>{});process.stdout.write("ready");setInterval(()=>{},1000)'], { stdio: ['ignore', 'pipe', 'pipe'] })
    return child
  } })
  try {
    const closed = once(child, 'close')
    await once(child.stdout, 'data'); controller.stop(); await closed
    assert.equal(child.signalCode, 'SIGKILL'); assert.equal(f.session.audioCaptures.size, 0)
  } finally { if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL') }
})
