// OPT-IN FUTURE dedicated-host diagnostic. Never attach to an existing service.
// This sprint runs its unit tests ONLY; the original Codespace always refuses.
import fs from 'node:fs'
import path from 'node:path'
import http from 'node:http'
import crypto from 'node:crypto'
import os from 'node:os'
import { spawn, spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { prepareRecovery, activateRecovery, openAccountingState, signDeviceId, WINDOW_MS, validateStatePath } from '../accounting-state.mjs'
import { childEnvironment } from '../security-policy.mjs'
import { loadConfig, qualifyDisposableHost, verifyOwnedListener } from './guard.mjs'
import { fiveUserRun } from './runner.mjs'
import { openProbe, colors, tones, verifyCanaries } from './rfb.mjs'
import { linuxSampler } from './metrics.mjs'

const wait = ms => new Promise(resolve => setTimeout(resolve, ms))
async function until(check, ms = 15000) {
  const deadline = Date.now() + ms
  while (Date.now() < deadline) { if (await check()) return; await wait(100) }
  throw new Error('Disposable fixture readiness/cleanup deadline exceeded')
}
async function stop(child) {
  if (!child?.pid) return
  try { process.kill(-child.pid, 'SIGTERM') } catch (error) { if (error.code !== 'ESRCH') throw error }
  try { await until(() => child.exitCode !== null || child.signalCode !== null, 5000) } catch {}
  try { process.kill(-child.pid, 'SIGKILL') } catch (error) { if (error.code !== 'ESRCH') throw error }
  await until(() => {
    try { process.kill(-child.pid, 0); return false } catch (error) { if (error.code === 'ESRCH') return true; throw error }
  }, 3000)
}
function mediaPage(index, nonce) {
  const color = colors[index].join(','), frequency = tones[index]
  // Synthetic local video and sine wave, NOT YouTube/ChatGPT or audible acceptance.
  return `<!doctype html><body style="margin:0;background:rgb(${color})"><h1>Disposable client ${index + 1}</h1><video autoplay muted playsinline></video><script>
  const canvas=document.createElement('canvas');canvas.width=320;canvas.height=180;const g=canvas.getContext('2d');
  setInterval(()=>{g.fillStyle='rgb(${color})';g.fillRect(0,0,320,180);g.fillStyle='black';g.fillRect(Date.now()/30%280,40,30,30)},50);
  document.querySelector('video').srcObject=canvas.captureStream(20);let context;
  document.onkeydown=e=>{if(e.code==='Space'&&!context){context=new AudioContext({sampleRate:44100});const o=context.createOscillator(),v=context.createGain();o.frequency.value=${frequency};v.gain.value=.1;o.connect(v).connect(context.destination);o.start();context.resume()}
  fetch('/ack/${nonce}/${index}',{method:'POST',body:'interaction'}).catch(()=>{})};
  fetch('/ack/${nonce}/${index}',{method:'POST',body:'ready'}).catch(()=>{});
  </script>`
}

let directory, manager, pulse, media, report, sourceState, startTicks, stage = 'arguments'
const probes = [], controller = new AbortController()
try {
  const args = process.argv.slice(2)
  if (args[0] !== '--disposable-host' || !args[1] || args.length > 3) throw new Error('Use --disposable-host ABS_PRIVATE_OUTPUT_ROOT [SECONDS]; no URL or force switch')
  const config = loadConfig({ outputRoot: args[1], durationSeconds: args[2] === undefined ? 900 : Number(args[2]), acknowledgeDisposableHost: true })
  stage = 'disposable-host-guard'
  await qualifyDisposableHost() // No files, keys, services or requests before this.
  if (process.arch !== 'x64') throw new Error('Current real Chrome fixture requires Linux x86-64')
  validateStatePath(path.join(config.outputRoot, 'accounting'))
  const rootStat = fs.lstatSync(config.outputRoot)
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink() || fs.realpathSync(config.outputRoot) !== config.outputRoot || rootStat.uid !== process.getuid() || (rootStat.mode & 0o777) !== 0o700) throw new Error('Output root must already be private 0700 and operator-owned')
  stage = 'host-dependencies'
  for (const binary of ['pulseaudio', 'pactl', 'ffmpeg', 'Xvfb', 'x11vnc', 'xdotool', 'unshare']) {
    if (spawnSync('which', [binary], { stdio: 'ignore', timeout: 2000 }).status !== 0) throw new Error('Required disposable-host dependency missing')
  }
  if (!fs.existsSync('/usr/bin/google-chrome') || spawnSync('unshare', ['--user', '--map-root-user', 'true'], { stdio: 'ignore', timeout: 3000 }).status !== 0) throw new Error('Real sandbox-capable Chrome host required')
  const sample = linuxSampler()
  if (sample().memoryAvailableMiB < 2048) throw new Error('Insufficient initial memory headroom for bounded test')
  stage = 'synthetic-fixture-preparation'
  directory = fs.mkdtempSync(path.join(config.outputRoot, 'poxey-load-')); fs.chmodSync(directory, 0o700)
  const stateDir = path.join(directory, 'synthetic-accounting'), nonce = crypto.randomBytes(16).toString('hex'), bootId = 'synthetic-load-fixture-only'
  // Exactly the isolated synthetic-clock fixture pattern used by accounting tests.
  // No live/imported usage or existing key can enter this newly-created directory.
  prepareRecovery(stateDir, '{}', { now: Date.now() - 2 * WINDOW_MS, uptimeMs: 0, bootId })
  activateRecovery(stateDir, { now: Date.now() - WINDOW_MS, uptimeMs: WINDOW_MS, bootId, quiescent: true })
  sourceState = openAccountingState(stateDir)
  const origin = 'https://poxey-load.invalid'
  const clients = Array.from({ length: 6 }, () => ({ cookie: `poxey-free-id=${signDeviceId(crypto.randomUUID(), sourceState.secret)}` }))
  fs.mkdirSync(path.join(directory, 'pulse-runtime'), { mode: 0o700 })
  fs.writeFileSync(path.join(directory, 'pulse-cookie'), crypto.randomBytes(256), { mode: 0o600, flag: 'wx' })
  const env = { ...childEnvironment(process.env, true), NODE_ENV: 'production', POXEY_MAX_SESSIONS: '5', POXEY_PUBLIC_ORIGIN: origin, POXEY_STATE_DIR: stateDir,
    PULSE_SERVER: `unix:${directory}/pulse-native`, PULSE_COOKIE: path.join(directory, 'pulse-cookie'), PULSE_RUNTIME_PATH: path.join(directory, 'pulse-runtime') }
  stage = 'private-pulse-startup'
  pulse = spawn('pulseaudio', ['-n', '--daemonize=no', '--use-pid-file=no', '--exit-idle-time=-1', '--log-level=error', `--load=module-native-protocol-unix socket=${directory}/pulse-native auth-cookie=${directory}/pulse-cookie`], { env, detached: true, stdio: 'ignore' })
  pulse.on('error', () => controller.abort())
  await until(() => spawnSync('pactl', ['info'], { env, stdio: 'ignore', timeout: 1000 }).status === 0)
  stage = 'owned-manager-startup'
  manager = spawn(process.execPath, [fileURLToPath(new URL('../poxey-session-manager.mjs', import.meta.url))], { env, detached: true, stdio: 'ignore' })
  manager.on('error', () => controller.abort())
  await until(() => {
    if (manager.exitCode !== null || manager.signalCode !== null) throw new Error('Owned manager exited')
    startTicks ||= fs.readFileSync(`/proc/${manager.pid}/stat`, 'utf8').split(') ')[1].split(' ')[19]
    try { verifyOwnedListener(manager.pid, startTicks); return true } catch { return false }
  })
  const ownerCheck = () => verifyOwnedListener(manager.pid, startTicks)
  const post = async (client, route, body = {}) => {
    ownerCheck()
    const response = await fetch(`http://127.0.0.1:3997${route}`, { method: 'POST', redirect: 'error',
      headers: { Cookie: client.cookie, Origin: origin, 'X-Forwarded-Proto': 'https', 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(45000) })
    return { status: response.status, data: await response.json() }
  }
  const acknowledgements = Array.from({ length: 5 }, () => ({ ready: false, interaction: false, interactions: 0, lastSent: 0, maxMs: 0 }))
  media = http.createServer((req, res) => {
    const page = new RegExp(`^/load/${nonce}/([0-4])$`).exec(req.url || ''), ack = new RegExp(`^/ack/${nonce}/([0-4])$`).exec(req.url || '')
    if (req.method === 'GET' && page) { res.writeHead(200, { 'Content-Type': 'text/html', 'Cache-Control': 'no-store' }); res.end(mediaPage(Number(page[1]), nonce)); return }
    if (req.method === 'POST' && ack) {
      let body = ''; req.on('data', bytes => { body += bytes.toString(); if (body.length > 64) req.destroy() })
      req.on('end', () => { const a = acknowledgements[Number(ack[1])]; a.ready = true; if (body === 'interaction') { a.interaction = true; a.interactions++; if (a.lastSent) a.maxMs = Math.max(a.maxMs, Date.now() - a.lastSent) } res.writeHead(204); res.end() }); return
    }
    res.writeHead(404); res.end()
  })
  await new Promise(resolve => media.listen(0, '127.0.0.1', resolve))
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => controller.abort())
  stage = 'protocol-driver'
  report = await fiveUserRun({ ...config, clients, signal: controller.signal, sample,
    create: client => post(client, '/session/create'), heartbeat: owner => post(owner.client, '/session/heartbeat', { token: owner.session.token }),
    open: async ({ route, owner, wrongClient, invalidToken, rejectOnly }) => {
      const connect = target => { const p = openProbe({ route: target, token: invalidToken ? 'invalid-load-token' : owner.session.token, cookie: (wrongClient || owner.client).cookie, origin, ownerCheck, index: owner.index, rejectOnly }); probes.push(p); return p }
      if (rejectOnly) { const p = connect(route); try { await p.ready } finally { p.close() }; return }
      const vnc = connect('/websockify'); await vnc.ready
      vnc.rfb.navigate(`http://127.0.0.1:${media.address().port}/load/${nonce}/${owner.index}`)
      await until(() => acknowledgements[owner.index].ready)
      acknowledgements[owner.index].lastSent = Date.now(); vnc.rfb.press(0x20)
      await until(() => acknowledgements[owner.index].interaction)
      const audio = connect('/audio'); await audio.ready
      return {
        async check() {
          ownerCheck(); controller.signal.throwIfAborted()
          verifyCanaries(vnc, audio, owner.index)
          const ack = acknowledgements[owner.index], previous = ack.interactions
          ack.lastSent = Date.now(); vnc.rfb.press(0xff54)
          await until(() => ack.interactions > previous, 5000)
        },
        summary: () => ({ client: owner.index + 1, rfbFrames: vnc.rfb.frames, vncBytes: vnc.result.bytes, audioBytes: audio.result.bytes,
          matchingToneWindows: audio.result.audioWindows, foreignToneWindows: audio.result.foreignToneWindows, ownColorSamples: vnc.rfb.pixelCounts[owner.index], interactionAckMaxMs: acknowledgements[owner.index].maxMs }),
        close() { vnc.close(); audio.close() },
      }
    },
    cleanup: async owned => {
      const ends = await Promise.allSettled(owned.map(owner => post(owner.client, '/session/end', { token: owner.session.token })))
      if (ends.some(v => v.status === 'rejected' || ![200, 404].includes(v.value.status))) throw new Error('End request failed')
      await until(async () => {
        ownerCheck()
        const h = await (await fetch('http://127.0.0.1:3997/health', { signal: AbortSignal.timeout(3000) })).json()
        return h.ok && h.sessions === 0 && h.occupiedSlots === 0 && fs.readdirSync('/tmp/poxey-sessions').length === 0
      }, 20000)
      const sinks = spawnSync('pactl', ['list', 'sinks', 'short'], { env, encoding: 'utf8', timeout: 3000 })
      if (sinks.status !== 0 || /poxey_/.test(sinks.stdout)) throw new Error('Owned sink cleanup not verified')
      sourceState.assertReady()
    },
  })
  const revision = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: fileURLToPath(new URL('../..', import.meta.url)), encoding: 'utf8', timeout: 2000 })
  report.sourceCommit = revision.status === 0 ? revision.stdout.trim() : 'UNKNOWN'
  report.host = { platform: process.platform, arch: process.arch, kernel: os.release(), logicalCpus: os.cpus().length, node: process.version }
  report.backendMode = 'native-production-policy-fixture-NOT-container-isolation'
  report.workload = 'owned local canvas video and sine tones; raw RFB maximum 5 requests/s, not noVNC/YouTube'
} catch { report = { result: 'BLOCKED', blockedStage: stage, kind: 'automated-RFB-PCM-load-test', humanAcceptance: 'NOT VERIFIED', reason: 'Disposable host/fixture preflight or bounded startup failed; no existing service is an allowed target' } }
finally {
  for (const probe of probes) probe.close()
  try {
    await stop(manager); await stop(pulse)
    if (media) { media.closeAllConnections(); await new Promise(resolve => media.close(resolve)) }
    if (directory && fs.existsSync('/tmp/poxey-sessions')) fs.rmdirSync('/tmp/poxey-sessions') // Empty, newly owned root only; never recursive.
  } catch { report = { ...report, result: 'FAIL', shutdownCleanup: 'NOT VERIFIED' } }
  if (directory) fs.writeFileSync(path.join(directory, 'load-report.json'), JSON.stringify(report, null, 2), { mode: 0o600, flag: 'wx' })
  console.log(JSON.stringify({ result: report?.result || 'BLOCKED', report: directory ? path.join(directory, 'load-report.json') : null, humanAcceptance: 'NOT VERIFIED', ...(report?.blockedStage ? { blockedStage: report.blockedStage } : {}) }))
  process.exitCode = report?.result === 'PASS' ? 0 : 1
}
