import { processRunning } from './session-teardown.mjs'

// Same PCM format/FFmpeg options, with bounded initialization and owned teardown.
export function startAudioCapture({ client, session, spawn, env, log = () => {}, schedule = setTimeout, cancel = clearTimeout, now = Date.now }) {
  if (!session.audioSink?.name || session.cleaningUp) { client.close(1011, 'Audio unavailable'); return }
  session.audioCaptures ??= new Set()
  let capture, stopped = false, firstData = false, startupTimer, killTimer
  const started = now()
  const stop = () => {
    if (stopped) return
    stopped = true
    cancel(startupTimer)
    session.audioClients.delete(client)
    if (processRunning(capture)) {
      capture.kill('SIGTERM')
      killTimer = schedule(() => { if (processRunning(capture)) capture.kill('SIGKILL') }, 1500)
      killTimer.unref?.()
    }
  }
  const fail = reason => {
    log({ event: reason, sessionId: session.id, elapsedMs: now() - started })
    stop()
    if (client.readyState === 1) client.close(1011, 'Audio capture unavailable')
  }
  try {
    capture = spawn('ffmpeg', [
      '-hide_banner', '-loglevel', 'warning',
      '-f', 'pulse', '-i', `${session.audioSink.name}.monitor`,
      '-ac', '2', '-ar', '44100', '-f', 's16le', 'pipe:1',
    ], { env, stdio: ['ignore', 'pipe', 'pipe'] })
  } catch { fail('capture-spawn-failed'); return }
  session.audioCaptures.add(capture)
  session.audioClients.add(client)
  log({ event: 'capture-spawned', sessionId: session.id, elapsedMs: now() - started })
  startupTimer = schedule(() => fail('capture-first-pcm-timeout'), 10000)
  startupTimer.unref?.()
  capture.stdout.on('data', chunk => {
    if (stopped || !chunk.length) return
    if (!firstData) {
      firstData = true; cancel(startupTimer)
      log({ event: 'capture-first-pcm', sessionId: session.id, elapsedMs: now() - started })
    }
    if (client.readyState === 1 && client.bufferedAmount < 1024 * 1024) client.send(chunk, { binary: true })
  })
  // Drain stderr without exposing arbitrary executable output/tokens in logs.
  capture.stderr.on('data', () => {})
  capture.on('error', () => fail('capture-process-error'))
  capture.once('close', (code, signal) => {
    log({ event: 'capture-exited', sessionId: session.id, elapsedMs: now() - started, code, signal })
    cancel(startupTimer); cancel(killTimer)
    session.audioCaptures.delete(capture)
    session.audioClients.delete(client)
    if (!stopped) fail('capture-ended')
  })
  client.once('close', stop)
  client.once('error', stop)
  return { process: capture, stop }
}
