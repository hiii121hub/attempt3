// Minimal bounded RFB 3.8 raw-frame test client, not the noVNC frontend.
import { WebSocket } from 'ws'
export const tones = [440, 660, 880, 1100, 1320]
export const colors = [[211, 37, 91], [29, 173, 219], [187, 103, 41], [139, 61, 203], [47, 193, 113]]
const MAX = 16 * 1024 * 1024
export function tonePowers(samples) {
  return tones.map(frequency => {
    let a = 0, b = 0
    const coefficient = 2 * Math.cos(2 * Math.PI * frequency / 44100)
    for (const sample of samples) { const next = sample + coefficient * a - b; b = a; a = next }
    return Math.max(0, a * a + b * b - coefficient * a * b)
  })
}
export function verifyCanaries(vnc, audio, index, now = Date.now()) {
  if (!Number.isInteger(index) || index < 0 || index >= colors.length ||
      [vnc.result, audio.result].some(v => v.failed || v.closed || now - v.lastData > 10000) ||
      !audio.result.audioWindows || audio.result.foreignToneWindows ||
      vnc.rfb.pixelCounts.some((count, i) => i !== index && count > 0) || !vnc.rfb.pixelCounts[index]) {
    throw new Error('Stream continuity or synthetic session-canary assertion failed')
  }
}
export class RfbProbe {
  constructor(send) {
    this.send = send; this.buffer = Buffer.alloc(0); this.stage = 'version'; this.frames = 0; this.pixelCounts = colors.map(() => 0)
  }
  key(keysym, down) { const b = Buffer.alloc(8); b[0] = 4; b[1] = Number(down); b.writeUInt32BE(keysym, 4); this.send(b) }
  press(keysym) { this.key(keysym, true); this.key(keysym, false) }
  navigate(url) {
    if (!this.ready || !/^http:\/\/127\.0\.0\.1:\d+\/load\/[a-f0-9]+\/[0-4]$/.test(url)) throw new Error('Only the owned synthetic media URL is allowed')
    this.key(0xffe3, true); this.press(0x6c); this.key(0xffe3, false)
    for (const char of url) this.press(char.charCodeAt(0))
    this.press(0xff0d)
  }
  request() {
    if (!this.ready || this.requestPending) return
    const b = Buffer.alloc(10); b[0] = 3; b[1] = this.frames ? 1 : 0; b.writeUInt16BE(this.width, 6); b.writeUInt16BE(this.height, 8); this.requestPending = true; this.send(b)
  }
  feed(bytes) {
    if (this.buffer.length + bytes.length > MAX) throw new Error('RFB buffer limit exceeded')
    this.buffer = Buffer.concat([this.buffer, bytes])
    const take = count => { const out = this.buffer.subarray(0, count); this.buffer = this.buffer.subarray(count); return out }
    while (true) {
      const b = this.buffer
      if (this.stage === 'version') {
        if (b.length < 12) return
        if (take(12).toString() !== 'RFB 003.008\n') throw new Error('Unsupported RFB version')
        this.send(Buffer.from('RFB 003.008\n')); this.stage = 'security'
      } else if (this.stage === 'security') {
        if (b.length < 1 || b.length < 1 + b[0]) return
        const list = take(1 + b[0]).subarray(1)
        // Existing x11vnc uses None internally; outer broker WS must authenticate.
        if (!list.includes(1)) throw new Error('Unsupported inner VNC authentication')
        this.send(Buffer.from([1])); this.stage = 'result'
      } else if (this.stage === 'result') {
        if (b.length < 4) return
        if (take(4).readUInt32BE() !== 0) throw new Error('RFB authentication failed')
        this.send(Buffer.from([1])); this.stage = 'init'
      } else if (this.stage === 'init') {
        if (b.length < 24) return
        const nameLength = b.readUInt32BE(20)
        if (nameLength > 4096) throw new Error('RFB name too large')
        if (b.length < 24 + nameLength) return
        this.width = b.readUInt16BE(0); this.height = b.readUInt16BE(2)
        if (!this.width || !this.height || this.width * this.height * 4 > MAX - 4096) throw new Error('Unsupported framebuffer size')
        take(24 + nameLength) // Never log server names or clipboard contents.
        const format = Buffer.alloc(20); format[4] = 32; format[5] = 24; format[7] = 1
        for (const at of [8, 10, 12]) format.writeUInt16BE(255, at)
        format[14] = 16; format[15] = 8
        this.send(format); this.send(Buffer.from([2, 0, 0, 1, 0, 0, 0, 0])) // Raw only; no resizing.
        this.stage = 'messages'; this.ready = true; this.request()
      } else if (this.stage === 'pixels') {
        if (b.length < this.pixels) return
        const pixels = take(this.pixels)
        for (let at = 0; at + 3 < pixels.length; at += 64) {
          const match = colors.findIndex(([r, g, blue]) => pixels[at] === blue && pixels[at + 1] === g && pixels[at + 2] === r)
          if (match >= 0) this.pixelCounts[match]++
        }
        this.rectangles--; this.stage = 'rectangles'
      } else if (this.stage === 'rectangles') {
        if (!this.rectangles) { this.frames++; this.requestPending = false; this.stage = 'messages'; continue }
        if (b.length < 12) return
        const x = b.readUInt16BE(0), y = b.readUInt16BE(2), w = b.readUInt16BE(4), h = b.readUInt16BE(6), encoding = b.readInt32BE(8)
        if (encoding !== 0 || x + w > this.width || y + h > this.height || !w || !h) throw new Error('Unexpected RFB rectangle')
        take(12); this.pixels = w * h * 4; this.stage = 'pixels'
      } else {
        if (!b.length) return
        if (b[0] === 2) { take(1); continue }
        if (b[0] === 3) {
          if (b.length < 8) return
          const length = b.readUInt32BE(4)
          if (length > 65536) throw new Error('Clipboard limit exceeded')
          if (b.length < 8 + length) return
          take(8 + length); continue
        }
        if (b[0] !== 0) throw new Error('Unsupported RFB message')
        if (b.length < 4) return
        this.rectangles = b.readUInt16BE(2)
        if (this.rectangles > 4096) throw new Error('RFB rectangle limit exceeded')
        take(4); this.stage = 'rectangles'
      }
    }
  }
}

export function openProbe({ route, token, cookie, origin, ownerCheck, index, rejectOnly = false, timeoutMs = 15000, createSocket = (url, options) => new WebSocket(url, options) }) {
  ownerCheck()
  if (!['/audio', '/websockify'].includes(route)) throw new Error('Unsupported probe route')
  const socket = createSocket(`ws://127.0.0.1:3997${route}?token=${encodeURIComponent(token)}`, { headers: { Cookie: cookie, Origin: origin, 'X-Forwarded-Proto': 'https' }, maxPayload: MAX, followRedirects: false })
  const result = { bytes: 0, nonzeroSamples: 0, audioWindows: 0, foreignToneWindows: 0, failed: false, closed: false, lastData: 0 }
  let audio = [], timer
  const rfb = route === '/websockify' && !rejectOnly ? new RfbProbe(bytes => socket.send(bytes)) : null
  const ready = new Promise((resolve, reject) => {
    let settled = false
    const finish = error => { if (!settled) { settled = true; clearTimeout(timer); error ? reject(new Error('Authenticated stream probe failed')) : resolve(result) } }
    timer = setTimeout(() => { socket.terminate(); finish(true) }, timeoutMs)
    socket.on('open', () => { if (rejectOnly) { socket.terminate(); finish(true) } })
    socket.on('message', bytes => {
      try {
        if (rejectOnly) throw new Error('Unauthorized stream accepted')
        result.bytes += bytes.length; result.lastData = Date.now()
        if (rfb) { rfb.feed(bytes); if (rfb.ready && rfb.frames) finish(false) }
        else {
          if (bytes.length % 4) throw new Error('Misaligned stereo PCM')
          for (let at = 0; at < bytes.length; at += 4) {
            const sample = bytes.readInt16LE(at); if (sample) result.nonzeroSamples++
            audio.push(sample)
            if (audio.length === 4096) {
              const power = tonePowers(audio), own = power[index], foreign = Math.max(...power.filter((_, i) => i !== index))
              if (own > 1e10) { result.audioWindows++; if (foreign > own * 0.05) result.foreignToneWindows++; finish(false) }
              audio = []
            }
          }
        }
      } catch { result.failed = true; socket.terminate(); finish(true) }
    })
    socket.on('error', error => {
      let refused = false
      try { ownerCheck(); refused = rejectOnly && error.code === 'ECONNRESET' } catch {}
      if (!refused) result.failed = true
      finish(!refused)
    })
    socket.on('close', () => { result.closed = true; finish(true) })
    socket.on('unexpected-response', (_request, response) => {
      response.resume()
      // Network failure/500 is NOT evidence that authorization correctly rejected.
      finish(!(rejectOnly && [401, 403, 404].includes(response.statusCode)))
      socket.terminate()
    })
  })
  const poll = rfb ? setInterval(() => { if (rfb.ready && socket.readyState === WebSocket.OPEN) rfb.request() }, 200) : null
  return { ready, result, rfb, close() { clearInterval(poll); clearTimeout(timer); socket.terminate() } }
}
