// Opt-in private Linux diagnostic: three fresh Pulse/manager/Chrome process starts.
// Does not clear the allowance ledger, change Chrome flags, or touch a shared daemon.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import http from 'node:http'
import crypto from 'node:crypto'
import { spawn, spawnSync } from 'node:child_process'
import { WebSocket } from 'ws'

assert.ok(process.platform === 'linux' && process.env.NODE_ENV !== 'production' && process.env.POXEY_AUDIO_COLD === '1', 'Requires opt-in idle Linux development host')
const base = 'http://127.0.0.1:3997', runtime = '/tmp/poxey-sessions'
const wait = ms => new Promise(resolve => setTimeout(resolve, ms))
const profiles = () => fs.existsSync(runtime) ? fs.readdirSync(runtime).filter(name => /^[0-9a-f-]{36}$/.test(name)) : []
assert.equal(profiles().length, 0, 'Existing profiles must not be disturbed')
let existing = false
try { await fetch(`${base}/health`, { signal: AbortSignal.timeout(2000) }); existing = true } catch {}
assert.equal(existing, false, 'Existing manager must not be disturbed')
const until = async (predicate, timeout = 10000) => {
  const deadline = Date.now() + timeout
  while (Date.now() < deadline) { if (await predicate()) return; await wait(100) }
  throw new Error('Diagnostic condition timed out')
}
async function stop(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return
  child.kill('SIGTERM')
  try { await until(() => child.exitCode !== null || child.signalCode !== null, 5000) }
  catch { child.kill('SIGKILL'); await until(() => child.signalCode !== null, 2000) }
}
function command(binary, args, env) {
  const result = spawnSync(binary, args, { env, encoding: 'utf8', timeout: 5000 })
  assert.equal(result.status, 0, `${binary} failed: ${(result.stderr || result.error?.message || '').slice(0, 300)}`)
  return result.stdout
}
const post = async (route, body = {}) => {
  const response = await fetch(base + route, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(45000) })
  return { status: response.status, data: await response.json() }
}
const health = async () => (await fetch(`${base}/health`, { signal: AbortSignal.timeout(2000) })).json()
if (process.env.POXEY_AUDIO_FAULT === 'missing-server') {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'poxey-audio-fault-'))
  const manager = spawn(process.execPath, [new URL('./poxey-session-manager.mjs', import.meta.url).pathname], {
    env: { ...process.env, NODE_ENV: 'development', POXEY_MAX_SESSIONS: '1', PULSE_SERVER: `unix:${temporary}/missing-native` }, stdio: 'ignore',
  })
  try {
    await until(async () => { try { return (await health()).ok } catch { return false } })
    const response = await post('/session/create')
    console.log(JSON.stringify({ missingPulseServer: true, actualStatus: response.status, actualError: response.data.error || null, publishedSession: response.status === 201 }))
    assert.equal(response.status, 500, 'Missing per-session audio must not publish a Chrome session')
    assert.equal((await health()).occupiedSlots, 0)
    assert.equal(profiles().length, 0)
    console.log('Missing-server startup rejected and capacity recovered.')
  } finally {
    await stop(manager)
    fs.rmSync(temporary, { recursive: true, force: true })
  }
} else for (let round = 1; round <= 3; round++) {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'poxey-audio-cold-'))
  fs.mkdirSync(path.join(temporary, 'runtime'), { mode: 0o700 })
  fs.writeFileSync(path.join(temporary, 'cookie'), crypto.randomBytes(256), { mode: 0o600 })
  const env = { ...process.env, NODE_ENV: 'development', POXEY_MAX_SESSIONS: '1', PULSE_SERVER: `unix:${temporary}/native`, PULSE_COOKIE: path.join(temporary, 'cookie'), PULSE_RUNTIME_PATH: path.join(temporary, 'runtime') }
  let pulse, manager, socket, session, web, played = false, audioError = '', managerAudio = []
  const measured = { round, processColdStart: true, hostCacheCold: false }
  try {
    const pulseStarted = Date.now()
    pulse = spawn('pulseaudio', ['-n', '--daemonize=no', '--use-pid-file=no', '--exit-idle-time=-1', '--log-level=warning', `--load=module-native-protocol-unix socket=${temporary}/native auth-cookie=${temporary}/cookie`], { env, stdio: ['ignore', 'ignore', 'pipe'] })
    pulse.stderr.on('data', bytes => { audioError = bytes.toString().slice(-500) })
    await until(() => spawnSync('pactl', ['info'], { env, timeout: 1000, stdio: 'ignore' }).status === 0)
    measured.pulseReadyMs = Date.now() - pulseStarted
    manager = spawn(process.execPath, [new URL('./poxey-session-manager.mjs', import.meta.url).pathname], { env, stdio: ['ignore', 'pipe', 'pipe'] })
    manager.stdout.on('data', bytes => { for (const line of bytes.toString().split('\n')) if (line.startsWith('[Poxey Audio]')) managerAudio.push(line.slice(0, 300)); managerAudio = managerAudio.slice(-10) })
    manager.stderr.on('data', bytes => { for (const line of bytes.toString().split('\n')) if (line.startsWith('[Poxey Audio]')) managerAudio.push(line.slice(0, 300)); managerAudio = managerAudio.slice(-10) })
    await until(async () => { try { return (await health()).ok } catch { return false } })
    const started = Date.now(), created = await post('/session/create')
    assert.equal(created.status, 201); session = created.data
    measured.chromeReadyMs = Date.now() - started
    measured.remainingMs = session.remainingMs
    const sinkName = `poxey_${session.id.replace(/-/g, '_')}`
    const sinks = command('pactl', ['--format=json', 'list', 'sinks'], env)
    const sink = JSON.parse(sinks).find(item => item.name === sinkName)
    assert.ok(sink, 'Session sink missing')
    measured.sinkPresent = true
    // The only sound producer is the unchanged real Chrome process, using a trusted
    // X11 key gesture on a temporary test page; this is not a connected noVNC viewer.
    web = http.createServer((req, res) => {
      if (req.url === '/playing') { played = true; res.end('ok'); return }
      res.setHeader('Content-Type', 'text/html')
      res.end('<button autofocus onclick="const c=new AudioContext();const o=c.createOscillator();o.frequency.value=440;o.connect(c.destination);o.start();window.testAudio=c;fetch(\'/playing\')">Play synthetic test tone</button>')
    })
    await new Promise(resolve => web.listen(0, '127.0.0.1', resolve))
    const displayEnv = { ...env, DISPLAY: `:${session.display}` }
    const windowId = command('xdotool', ['search', '--onlyvisible', '--name', '.*'], displayEnv).trim().split('\n')[0]
    command('xdotool', ['windowfocus', windowId], displayEnv)
    command('xdotool', ['key', '--clearmodifiers', 'ctrl+l'], displayEnv)
    command('xdotool', ['type', '--clearmodifiers', `http://127.0.0.1:${web.address().port}/`], displayEnv)
    command('xdotool', ['key', 'Return'], displayEnv)
    await wait(1000)
    command('xdotool', ['key', 'space'], displayEnv)
    await until(() => played)
    measured.chromeToneStarted = true
    const inputs = JSON.parse(command('pactl', ['--format=json', 'list', 'sink-inputs'], env))
    assert.ok(inputs.some(input => input.sink === sink.index), 'Chrome did not route to its session sink')
    measured.chromeSinkMatched = true
    const streamStarted = Date.now()
    let received = 0, nonzero = 0, peak = 0, firstPacketMs = null, streamError
    socket = new WebSocket(`ws://127.0.0.1:3997/audio?token=${encodeURIComponent(session.token)}`)
    socket.on('open', () => { measured.websocketOpenMs = Date.now() - streamStarted })
    socket.on('error', () => { streamError = new Error('Audio WebSocket error') })
    socket.on('close', () => { if (received === 0) streamError = new Error('Audio stream closed before PCM') })
    socket.on('message', bytes => {
      firstPacketMs ??= Date.now() - streamStarted
      received += bytes.length
      for (let offset = 0; offset + 1 < bytes.length; offset += 2) { const value = Math.abs(bytes.readInt16LE(offset)); if (value > 100) nonzero++; peak = Math.max(peak, value) }
    })
    await until(() => { if (streamError) throw streamError; return nonzero > 1000 }, 10000)
    Object.assign(measured, { firstPacketMs, pcmBytes: received, nonzeroSamples: nonzero, peak, result: 'PASS' })
    socket.terminate(); socket = null
    assert.equal((await post('/session/end', { token: session.token })).status, 200)
    await until(async () => (await health()).occupiedSlots === 0)
    assert.equal(profiles().length, 0)
    const remainingSinks = JSON.parse(command('pactl', ['--format=json', 'list', 'sinks'], env))
    assert.ok(!remainingSinks.some(item => item.name.startsWith('poxey_')))
    const ledger = path.join(runtime, 'tokens/poxey-free-usage.json')
    assert.ok(fs.statSync(ledger).size > 0)
    measured.cleanupPassed = true
    console.log(JSON.stringify(measured))
  } catch (error) {
    console.error(JSON.stringify({ ...measured, result: 'FAILED', error: error.message, managerAudio, pulseDiagnostic: audioError }))
    throw error
  } finally {
    socket?.terminate()
    if (session) { try { await post('/session/end', { token: session.token }) } catch {} }
    await stop(manager)
    if (web) await new Promise(resolve => web.close(resolve))
    await stop(pulse)
    fs.rmSync(temporary, { recursive: true, force: true }) // Only this harness's mkdtemp data.
  }
}
if (!process.env.POXEY_AUDIO_FAULT) console.log('Three process-cold Chrome audio rounds passed; audible client playback NOT VERIFIED.')
