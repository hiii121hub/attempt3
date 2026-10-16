import fs from 'node:fs'
import net from 'node:net'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

export async function checkNoWebProxy(connect = options => net.createConnection(options)) {
  for (const host of ['127.0.0.1', '::1']) for (const port of [80, 443]) await new Promise((resolve, reject) => {
    const socket = connect({ host, port })
    socket.setTimeout(1000)
    socket.on('connect', () => { socket.destroy(); reject(new Error('Web proxy listener present')) })
    socket.on('timeout', () => { socket.destroy(); reject(new Error('Web proxy inspection uncertain')) })
    socket.on('error', error => error.code === 'ECONNREFUSED' ? resolve() : reject(error))
  })
  return true
}

export async function qualifyDisposableHost({ platform = process.platform, uid = process.getuid?.(), configuredState = process.env.POXEY_STATE_DIR, exists = file => {
  try { fs.lstatSync(file); return true } catch (error) { if (error.code === 'ENOENT') return false; throw error }
}, processes = () => spawnSync('ps', ['-eo', 'comm='], { encoding: 'utf8', timeout: 3000 }), portFree = port => new Promise((resolve, reject) => {
  const server = net.createServer()
  server.once('error', reject)
  server.listen(port, '127.0.0.1', () => server.close(() => resolve(true)))
}), quietWebPorts = checkNoWebProxy } = {}) {
  if (platform !== 'linux' || !Number.isInteger(uid) || uid <= 0) throw new Error('Requires a dedicated disposable non-root Linux host')
  // No force flag: never run on the original Codespace, even while it is stopped.
  if (configuredState) throw new Error('Existing accounting configuration must not enter a disposable fixture')
  for (const file of ['/workspaces/attempt3', '/workspaces/.poxey-state/attempt3', '/workspaces/poxey-phase4-backup.3BVWya', '/tmp/poxey-sessions', '/var/lib/poxey', '/etc/poxey']) {
    if (exists(file)) throw new Error('Protected checkout/state or existing runtime present; load test refused')
  }
  const result = processes()
  if (result.error || result.status !== 0 || result.stdout.split('\n').some(comm => /^(chrome.*|google-chrome.*|Xvfb|x11vnc|ffmpeg|pulseaudio|caddy|nginx|apache2|httpd)$/.test(comm.trim()))) throw new Error('Host is busy or ownership is uncertain')
  if (!(await quietWebPorts())) throw new Error('Existing web proxy must not be disturbed')
  for (const port of [3997, 3999]) if (!(await portFree(port))) throw new Error('Existing listener must not be disturbed')
  return true
}

export function loadConfig({ durationSeconds = 900, outputRoot, acknowledgeDisposableHost } = {}) {
  if (acknowledgeDisposableHost !== true) throw new Error('Explicit disposable-host acknowledgement required')
  if (!Number.isInteger(durationSeconds) || durationSeconds < 1 || durationSeconds > 1200) throw new Error('Duration must be 1–1200 seconds; target 900–1200')
  if (typeof outputRoot !== 'string' || !path.isAbsolute(outputRoot) || path.normalize(outputRoot) !== outputRoot ||
      ['/tmp', '/private/tmp', '/var/tmp', '/workspaces', '/'].includes(outputRoot) ||
      outputRoot.includes('/.poxey-state') || outputRoot.includes('/poxey-phase4') || outputRoot.startsWith('/workspaces/attempt3')) throw new Error('Use a new private disposable output location, not recovery storage')
  return Object.freeze({ durationSeconds, outputRoot, users: 5, automatedOnly: true })
}

// Verify the listening socket belongs to OUR child, not a service winning a bind race.
export function verifyOwnedListener(pid, startTicks, read = file => fs.readFileSync(file, 'utf8'), list = dir => fs.readdirSync(dir), link = file => fs.readlinkSync(file)) {
  const current = read(`/proc/${pid}/stat`).split(') ')[1]?.split(' ')[19]
  if (!startTicks || current !== startTicks) throw new Error('Owned manager exited or changed')
  const sockets = list(`/proc/${pid}/fd`).map(fd => { try { return link(`/proc/${pid}/fd/${fd}`) } catch { return '' } })
  const owned = read('/proc/net/tcp').split('\n').some(line => {
    const fields = line.trim().split(/\s+/)
    return fields[1] === '0100007F:0F9D' && fields[3] === '0A' && sockets.includes(`socket:[${fields[9]}]`)
  })
  if (!owned) throw new Error('Port 3997 is not owned by the disposable manager')
}
