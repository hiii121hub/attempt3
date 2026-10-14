import test from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { RfbProbe, openProbe, tonePowers, tones, colors, verifyCanaries } from './rfb.mjs'
function initialize(probe) {
  const init = Buffer.alloc(24); init.writeUInt16BE(2); init.writeUInt16BE(1, 2)
  for (const part of [Buffer.from('RFB 003.008\n'), Buffer.from([1, 1]), Buffer.alloc(4), init]) {
    for (const byte of part) probe.feed(Buffer.from([byte]))
  }
}
function frame() {
  const b = Buffer.alloc(4 + 12 + 8); b.writeUInt16BE(1, 2); b.writeUInt16BE(2, 8); b.writeUInt16BE(1, 10)
  const [r, g, blue] = colors[0]; b[16] = blue; b[17] = g; b[18] = r
  return b
}
test('fragmented RFB handshake consumes real-format raw frames and bounds outstanding requests', () => {
  const sent = [], p = new RfbProbe(v => sent.push(v)); initialize(p)
  assert.equal(p.ready, true); assert.equal(p.frames, 0)
  const length = sent.length; p.request(); assert.equal(sent.length, length)
  p.feed(frame()); assert.equal(p.frames, 1); assert.equal(p.pixelCounts[0], 1)
  p.navigate('http://127.0.0.1:43210/load/abcd/0')
  assert.throws(() => p.navigate('https://youtube.com'))
  p.request(); assert.equal(p.requestPending, true)
})
test('unknown RFB versions, oversized data and unrequested encodings are refused', () => {
  assert.throws(() => new RfbProbe(() => {}).feed(Buffer.from('RFB 003.003\n')))
  assert.throws(() => new RfbProbe(() => {}).feed(Buffer.alloc(16 * 1024 * 1024 + 1)))
  const p = new RfbProbe(() => {}); initialize(p)
  const b = frame(); b.writeInt32BE(16, 12); assert.throws(() => p.feed(b))
})
test('spectral canaries identify each independent pure tone', () => {
  for (let own = 0; own < 5; own++) {
    const powers = tonePowers(Array.from({ length: 4096 }, (_, i) => 10000 * Math.sin(2 * Math.PI * tones[own] * i / 44100)))
    assert.equal(powers.indexOf(Math.max(...powers)), own)
    assert.ok(Math.max(...powers.filter((_, i) => i !== own)) < powers[own] * 0.05)
  }
})
function fixture(rejectOnly = false) {
  const socket = new EventEmitter(); socket.terminate = () => {}; socket.send = () => {}; socket.readyState = 1
  let configuration
  const probe = openProbe({ route: '/audio', token: 'synthetic-token', cookie: 'synthetic-cookie', origin: 'https://poxey-load.invalid', ownerCheck: () => {}, index: 0, rejectOnly,
    createSocket: (url, options) => { configuration = { url, options }; return socket } })
  return { socket, probe, configuration }
}
test('negative auth does not treat connection refusal or HTTP 500 as a passing rejection', async () => {
  for (const mode of ['network', 'server']) {
    const { socket, probe } = fixture(true)
    const rejection = assert.rejects(probe.ready)
    if (mode === 'network') socket.emit('error', Object.assign(new Error('refused'), { code: 'ECONNREFUSED' }))
    else socket.emit('unexpected-response', {}, { statusCode: 500, resume() {} })
    await rejection; probe.close()
  }
})
test('explicit HTTP auth rejection passes; an opened unauthorized socket fails', async () => {
  const denied = fixture(true)
  denied.socket.emit('unexpected-response', {}, { statusCode: 403, resume() {} }); await denied.probe.ready; denied.probe.close()
  const accepted = fixture(true), rejection = assert.rejects(accepted.probe.ready)
  accepted.socket.emit('open'); await rejection; accepted.probe.close()
})
test('stereo PCM delivery counts matching windows without logging credentials', async () => {
  const { socket, probe, configuration } = fixture(), pcm = Buffer.alloc(4096 * 4)
  for (let i = 0; i < 4096; i++) { const sample = Math.round(10000 * Math.sin(2 * Math.PI * 440 * i / 44100)); pcm.writeInt16LE(sample, i * 4); pcm.writeInt16LE(sample, i * 4 + 2) }
  socket.emit('message', pcm); await probe.ready
  assert.equal(probe.result.audioWindows, 1); assert.equal(probe.result.foreignToneWindows, 0)
  assert.ok(probe.result.nonzeroSamples > 4000)
  assert.equal(configuration.options.headers.Cookie, 'synthetic-cookie'); assert.equal(configuration.options.followRedirects, false)
  assert.doesNotMatch(JSON.stringify(probe.result), /synthetic-token|synthetic-cookie/); probe.close()
})
test('mixed-session tones are flagged, not treated as proof of clean audio', async () => {
  const { socket, probe } = fixture(), pcm = Buffer.alloc(4096 * 4)
  for (let i = 0; i < 4096; i++) {
    const sample = Math.round(8000 * (Math.sin(2 * Math.PI * 440 * i / 44100) + Math.sin(2 * Math.PI * 660 * i / 44100)))
    pcm.writeInt16LE(sample, i * 4); pcm.writeInt16LE(sample, i * 4 + 2)
  }
  socket.emit('message', pcm); await probe.ready
  assert.equal(probe.result.foreignToneWindows, 1); probe.close()
})
test('foreign screen/audio canaries, missing own canary, stale or disconnected streams fail', () => {
  const baseline = () => ({ vnc: { result: { lastData: 1000 }, rfb: { pixelCounts: [10, 0, 0, 0, 0] } }, audio: { result: { lastData: 1000, audioWindows: 1, foreignToneWindows: 0 } } })
  const good = baseline(); verifyCanaries(good.vnc, good.audio, 0, 2000)
  for (const mutate of [v => v.vnc.rfb.pixelCounts[1]++, v => v.vnc.rfb.pixelCounts[0] = 0, v => v.audio.result.foreignToneWindows++, v => v.audio.result.lastData = -10000, v => v.vnc.result.closed = true]) {
    const value = baseline(); mutate(value); assert.throws(() => verifyCanaries(value.vnc, value.audio, 0, 2000))
  }
})
test('missing initial PCM has a bounded deadline and is not a successful audio probe', async () => {
  const socket = new EventEmitter(); socket.terminate = () => {}
  const probe = openProbe({ route: '/audio', token: 'synthetic', cookie: 'synthetic', origin: 'https://poxey-load.invalid', index: 0, ownerCheck: () => {}, timeoutMs: 10, createSocket: () => socket })
  await assert.rejects(probe.ready); probe.close()
})
