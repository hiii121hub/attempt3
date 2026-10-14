import http from 'node:http'
import net from 'node:net'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { spawn, spawnSync } from 'node:child_process'
import { WebSocketServer } from 'ws'
import { readRuntimeConfig, requestAllowed, sessionUsable, childEnvironment, chromeSandboxArgs, websocketAllowed, parseSessionBody, decodeCookie } from './security-policy.mjs'
import { startupResources } from './startup-resources.mjs'
import { sessionCapacity } from './session-capacity.mjs'
import { processRunning, teardownResources } from './session-teardown.mjs'
import { createSessionSink } from './session-audio.mjs'
import { startAudioCapture } from './audio-capture.mjs'
import { openAccountingState, freeAllowance, signDeviceId, verifyDeviceCookie } from './accounting-state.mjs'

const runtimeConfig = readRuntimeConfig()
// Validate persisted identity/accounting before creating runtime files or listening.
const accounting = openAccountingState(runtimeConfig.stateDir)

const HOST = '127.0.0.1'
const PORT = 3997
const BASE_DIR = '/tmp/poxey-sessions'
const DISPLAY_START = 2
const VNC_PORT_START = 5902
const MAX_SESSIONS = runtimeConfig.maxSessions
const BASE_WIDTH = 1024
const BASE_HEIGHT = 700
const MIN_SIZE_PERCENT = 75
const MAX_SIZE_PERCENT = 150
const IDLE_TIMEOUT_MS = 5 * 60 * 1000
const FREE_SESSION_TIMEOUT_MS = 25 * 60 * 1000
const FREE_DAILY_ALLOWANCE_MS = 25 * 60 * 1000
const FREE_ALLOWANCE_WINDOW_MS = 24 * 60 * 60 * 1000
const FREE_DEVICE_COOKIE = 'poxey-free-id'
const FREE_DEVICE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365

// Each Chrome session gets its own PulseAudio null sink and monitor.
function pulseEnvironment() {
  // Let PulseAudio discover its active server unless deployment explicitly
  // supplies a server address. This keeps pactl, FFmpeg, and Chrome aligned.
  const env = childEnvironment(process.env, runtimeConfig.production)

  if (!process.env.PULSE_SERVER) {
    delete env.PULSE_SERVER
  }

  delete env.PULSE_RUNTIME_PATH
  return env
}

function removeAudioSink(moduleId) {
  if (moduleId) return spawnSync('pactl', ['unload-module', moduleId], {
    env: pulseEnvironment(), timeout: 5000,
  })
}

const sessions = new Map()
const capacity = sessionCapacity(MAX_SESSIONS)
const pendingCleanup = new Set()
const retiringSessions = new Set()
const startingFreeDevices = new Set()
let sessionCreationLock = false

fs.mkdirSync(BASE_DIR, { recursive: true, mode: 0o700 })
fs.chmodSync(BASE_DIR, 0o700)
const TOKEN_DIR = runtimeConfig.stateDir
const TOKEN_FILE = path.join(TOKEN_DIR, 'poxey.tokens')

fs.mkdirSync(TOKEN_DIR, { recursive: true, mode: 0o700 })
fs.chmodSync(TOKEN_DIR, 0o700)

async function waitForTcpPort(port, timeoutMs = 10000) {
  const started = Date.now()

  while (Date.now() - started < timeoutMs) {
    const ready = await new Promise(resolve => {
      const socket = net.createConnection({
        host: '127.0.0.1',
        port,
      })

      const finish = value => {
        socket.destroy()
        resolve(value)
      }

      socket.once('connect', () => finish(true))
      socket.once('error', () => finish(false))
      socket.setTimeout(500, () => finish(false))
    })

    if (ready) return true

    await new Promise(resolve => setTimeout(resolve, 250))
  }

  return false
}

function findChromeWindowId(display) {
  const env = {
    ...childEnvironment(process.env, runtimeConfig.production),
    DISPLAY: display,
  }

  for (let attempt = 0; attempt < 10; attempt++) {
    const result = spawnSync(
      '/usr/bin/xdotool',
      ['search', '--onlyvisible', '--name', '.*'],
      {
        env,
        encoding: 'utf8',
      }
    )

    if (result.status === 0) {
      const ids = result.stdout
        .trim()
        .split(/\\s+/)
        .filter(Boolean)

      if (ids.length) return ids[0]
    }

    if (attempt < 9) {
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 500)
    }
  }

  return null
}

async function resizeChromeWindow(session, width, height) {
  const result = spawnSync(
    '/usr/bin/xdotool',
    [
      'windowsize',
      String(session.chromeWindowId),
      String(width),
      String(height),
    ],
    {
      env: {
        ...childEnvironment(process.env, runtimeConfig.production),
        DISPLAY: String(session.display).startsWith(':') ? String(session.display) : `:${session.display}`,
      },
      encoding: 'utf8',
    }
  )

  if (result.status !== 0) {
    throw new Error(
      `Failed to resize Chrome: ${(result.stderr || result.stdout || '').trim()}`
    )
  }

  return { width, height }
}

function writeTokenFile() {
  const lines = [...sessions.values()].map(
    session => `${session.token}: 127.0.0.1:${session.vncPort}`
  )

  const tempFile = `${TOKEN_FILE}.tmp`

  fs.writeFileSync(
    tempFile,
    lines.length ? `${lines.join('\n')}\n` : '',
    { mode: 0o600 }
  )

  fs.chmodSync(tempFile, 0o600)
  fs.renameSync(tempFile, TOKEN_FILE)
}

writeTokenFile()

function json(res, status, data) {
  const body = JSON.stringify(data)
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
    'Content-Length': Buffer.byteLength(body),
  })
  res.end(body)
}

function token() {
  return crypto.randomBytes(32).toString('base64url')
}

function sessionId() {
  return crypto.randomUUID()
}

function createFreeDeviceCookieValue(deviceId) {
  return signDeviceId(deviceId, accounting.secret)
}

function verifyFreeDeviceCookieValue(value) {
  return verifyDeviceCookie(value, accounting.secret)
}

function getCookie(req, name) {
  const header = req.headers.cookie || ''

  for (const part of header.split(';')) {
    const separator = part.indexOf('=')

    if (separator === -1) continue

    const key = part.slice(0, separator).trim()
    const value = part.slice(separator + 1).trim()

    if (key === name) {
      return decodeCookie(value)
    }
  }

  return null
}

function getOrCreateFreeDevice(req, res) {
  const deviceCookies = (req.headers.cookie || '').split(';').filter(part => part.trim().split('=', 1)[0] === FREE_DEVICE_COOKIE)
  if (deviceCookies.length > 1) throw new Error('INVALID_DEVICE_COOKIE')
  const existing = verifyFreeDeviceCookieValue(
    getCookie(req, FREE_DEVICE_COOKIE)
  )

  if (existing) {
    return {
      deviceId: existing,
      isNew: false,
    }
  }

  if (deviceCookies.length) {
    throw new Error('INVALID_DEVICE_COOKIE')
  }

  const deviceId = crypto.randomUUID()
  const value = createFreeDeviceCookieValue(deviceId)
  const forwardedProto = String(req.headers['x-forwarded-proto'] || '')
  const secure = runtimeConfig.production || forwardedProto === 'https'

  const cookie = [
    `${FREE_DEVICE_COOKIE}=${encodeURIComponent(value)}`,
    'Path=/',
    `Max-Age=${FREE_DEVICE_COOKIE_MAX_AGE}`,
    'HttpOnly',
    'SameSite=Lax',
    secure ? 'Secure' : '',
  ].filter(Boolean).join('; ')

  res.setHeader('Set-Cookie', cookie)

  return {
    deviceId,
    isNew: true,
  }
}

function loadFreeUsage() {
  return accounting.load()
}

function saveFreeUsage(usage) {
  accounting.save(usage)
}

function getFreeAllowance(deviceId, now = Date.now()) {
  return freeAllowance(loadFreeUsage(), deviceId, now)
}

function saveFreeAllowance(deviceId, allowance) {
  allowance.usage[deviceId] = allowance.record
  saveFreeUsage(allowance.usage)
}

function chargeSessionUsage(session, now = Date.now()) {
  if (!session || !session.deviceId || !session.usageStartedAt) {
    return 0
  }

  const endTime = Math.min(now, session.expiresAt)
  const lastChargedAt = session.lastUsageUpdateAt || session.usageStartedAt
  const elapsedMs = Math.max(0, endTime - lastChargedAt)

  if (elapsedMs <= 0) {
    return 0
  }

  const allowance = getFreeAllowance(session.deviceId, now)
  allowance.record.usedMs = Math.min(
    FREE_DAILY_ALLOWANCE_MS,
    allowance.record.usedMs + elapsedMs,
  )

  saveFreeAllowance(session.deviceId, allowance)

  session.lastUsageUpdateAt = endTime

  return elapsedMs
}

function freeNumber(start, used) {
  let n = start
  while (used.has(n)) n++
  return n
}

function spawnLogged(command, args, env, logFile) {
  const log = fs.openSync(logFile, 'a')
  let child
  try {
    child = spawn(command, args, {
      env: { ...childEnvironment(process.env, runtimeConfig.production), ...env },
      stdio: ['ignore', log, log],
      detached: false,
    })
  } catch (error) {
    fs.closeSync(log)
    throw error
  }
  child.on('error', error => console.error(`[Poxey Session] Failed to spawn ${command}: ${error.message}`))
  child.once('close', () => fs.closeSync(log))
  return child
}

function isAlive(child) {
  return processRunning(child)
}

function processDescendants(pid) {
const children = []

for (const entry of fs.readdirSync('/proc', { withFileTypes: true })) {
if (!entry.isDirectory() || !/^\d+$/.test(entry.name)) continue

try {
const stat = fs.readFileSync(`/proc/${entry.name}/stat`, 'utf8')
const match = stat.match(/^\d+\s+\([^)]*\)\s+\S\s+(\d+)/)
if (match && Number(match[1]) === pid) {
children.push(Number(entry.name))
}
} catch {}
}

return children
}

function killProcessTree(child, signal) {
if (!child?.pid) return

const killPid = (pid) => {
for (const descendant of processDescendants(pid)) {
killPid(descendant)
}

try {
process.kill(pid, signal)
} catch {}
}

killPid(child.pid)
}

function cleanupOrphanedVncProcesses() {
  for (const entry of fs.readdirSync('/proc', { withFileTypes: true })) {
    if (!entry.isDirectory() || !/^\d+$/.test(entry.name)) continue

    const pid = Number(entry.name)

    try {
      const status = fs.readFileSync(`/proc/${pid}/status`, 'utf8')
      const ppidMatch = status.match(/^PPid:\s+(\d+)/m)
      if (!ppidMatch || Number(ppidMatch[1]) !== 1) continue

      const cmdline = fs.readFileSync(`/proc/${pid}/cmdline`, 'utf8')
        .split('\0')
        .filter(Boolean)

      const command = cmdline[0] || ''
      const isPoxeyXvfb =
        command === 'Xvfb' &&
        cmdline.includes('-nolisten')

      const isPoxeyVnc =
        command === 'x11vnc' &&
        cmdline.includes('-localhost') &&
        cmdline.includes('-nopw')

      const isPoxeyChrome =
        (
          command === '/usr/bin/google-chrome' ||
          command.endsWith('/google-chrome')
        ) &&
        cmdline.some(arg => arg.startsWith('--user-data-dir=/tmp/poxey-sessions/'))

      if (!isPoxeyXvfb && !isPoxeyVnc && !isPoxeyChrome) continue

      const displayIndex = cmdline.indexOf('-display')
      const display =
        displayIndex !== -1 ? cmdline[displayIndex + 1] : null

      const portIndex = cmdline.indexOf('-rfbport')
      const port =
        portIndex !== -1 ? Number(cmdline[portIndex + 1]) : null

      const type = isPoxeyXvfb
        ? 'Xvfb'
        : isPoxeyVnc
          ? 'x11vnc'
          : 'Chrome'

      console.log(
        `[Poxey Session] Removing orphaned ${type} pid=${pid}` +
        `${display ? ` display=${display}` : ''}` +
        `${Number.isInteger(port) ? ` port=${port}` : ''}`
      )

      killProcessTree({ pid }, 'SIGTERM')
    } catch {}
  }
}

function waitForPort(port, timeoutMs = 5000) {
  return new Promise((resolve) => {
    const deadline = Date.now() + timeoutMs

    const check = () => {
      const socket = new net.Socket()
      socket.setTimeout(300)

      socket.once('connect', () => {
        socket.destroy()
        resolve(true)
      })

      socket.once('error', () => {
        socket.destroy()
        if (Date.now() >= deadline) resolve(false)
        else setTimeout(check, 100)
      })

      socket.once('timeout', () => {
        socket.destroy()
        if (Date.now() >= deadline) resolve(false)
        else setTimeout(check, 100)
      })

      socket.connect(port, HOST)
    }

    check()
  })
}

function usedDisplays() {
  return new Set([...sessions.values(), ...retiringSessions].map(s => s.display))
}

function usedPorts() {
  return new Set([...sessions.values(), ...retiringSessions].map(s => s.vncPort))
}

function isPortAvailable(port, host = HOST) {
  return new Promise(resolve => {
    const server = net.createServer()

    server.once('error', () => {
      resolve(false)
    })

    server.once('listening', () => {
      server.close(() => resolve(true))
    })

    server.listen(port, host)
  })
}

function findByToken(value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(value)) return null
  for (const session of sessions.values()) {
    if (session.token === value) {
      if (!sessionUsable(session)) {
        cleanupSession(session, 'expired token rejected')
        return null
      }
      return session
    }
  }
  return null
}

function authorizedSession(req, value) {
  const session = findByToken(value)
  if (runtimeConfig.production && session?.deviceId !== verifyFreeDeviceCookieValue(getCookie(req, FREE_DEVICE_COOKIE))) return null
  return session
}

async function createSession(req, res) {
  if (sessionCreationLock) {
    return {
      error: 'SESSION_CREATION_BUSY',
      message: 'A session is currently starting. Please try again shortly.',
    }
  }

  sessionCreationLock = true
  let capacitySlot
  let published = false
  let rollbackComplete = true

  try {
    capacitySlot = capacity.reserve()
    if (!capacitySlot) {
      return {
        error: 'MAX_SESSIONS',
        message: `Maximum of ${MAX_SESSIONS} active sessions reached.`,
      }
    }

    const { deviceId } = getOrCreateFreeDevice(req, res)
  const now = Date.now()
  const allowance = getFreeAllowance(deviceId, now)

  const existingSession = [...sessions.values()].find(
    session => session.deviceId === deviceId
  )

  if (existingSession) {
    console.log(
      `[Poxey Session] ACTIVE_SESSION existing device=${deviceId} session=${existingSession.id} lastHeartbeat=${new Date(existingSession.lastHeartbeat).toISOString()}`
    )

    if (now - existingSession.lastHeartbeat >= IDLE_TIMEOUT_MS) {
      cleanupSession(existingSession, 'stale device session replaced')
    } else {
      return {
        error: 'ACTIVE_SESSION',
        message: 'This device already has an active Free session.',
      }
    }
  }

  if (startingFreeDevices.has(deviceId)) {
    console.log(
      `[Poxey Session] ACTIVE_SESSION starting device=${deviceId}`
    )

    return {
      error: 'ACTIVE_SESSION',
      message: 'This device already has an active Free session.',
    }
  }

  if (allowance.remainingMs <= 0) {
    saveFreeAllowance(deviceId, allowance)

    return {
      error: 'ALLOWANCE_EXHAUSTED',
      message: 'Your 25-minute Free allowance has been used.',
      remainingMs: 0,
      resetAt: allowance.record.windowStartedAt + FREE_ALLOWANCE_WINDOW_MS,
    }
  }

  saveFreeAllowance(deviceId, allowance)
  startingFreeDevices.add(deviceId)

  const startup = startupResources({
    killTree: killProcessTree,
    isAlive,
    removeSink: removeAudioSink,
    removeDirectory: dir => fs.rmSync(dir, { recursive: true, force: true }),
    wait: ms => new Promise(resolve => setTimeout(resolve, ms)),
  })
  try {
    const display = freeNumber(DISPLAY_START, usedDisplays())

    const reservedPorts = usedPorts()
    let vncPort = VNC_PORT_START

    while (
      reservedPorts.has(vncPort) ||
      !(await isPortAvailable(vncPort))
    ) {
      vncPort++
    }
    const id = sessionId()
    const authToken = token()

    const dir = path.join(BASE_DIR, id)
    startup.directory(dir)
    const profile = path.join(dir, 'profile')
    const logDir = path.join(dir, 'logs')

    fs.mkdirSync(dir, { recursive: true, mode: 0o700 })
    fs.chmodSync(dir, 0o700)
    fs.mkdirSync(profile, { recursive: true, mode: 0o700 })
    fs.chmodSync(profile, 0o700)
    fs.mkdirSync(logDir, { recursive: true, mode: 0o700 })
    fs.chmodSync(logDir, 0o700)

    const displayName = `:${display}`

    const xvfb = startup.child(spawnLogged(
      'Xvfb',
      [
        displayName,
        '-screen',
        '0',
        '1600x1200x24',
        '-nolisten',
        'tcp',
      ],
      {},
      path.join(logDir, 'xvfb.log'),
    ))

    await new Promise(r => setTimeout(r, 1000))

    if (!isAlive(xvfb)) {
      return {
        error: 'XVFB_FAILED',
        message: 'Failed to start Xvfb.',
      }
    }

    const audioSink = createSessionSink(id, { run: spawnSync, env: pulseEnvironment(), own: sink => startup.sink(sink) })

    const chromeEnv = {
      ...pulseEnvironment(),
      DISPLAY: displayName,
      ...(audioSink.name ? { PULSE_SINK: audioSink.name } : {}),
    }

    const chrome = startup.child(spawnLogged(
      '/usr/bin/google-chrome',
      [
        '--disable-gpu',
        '--num-raster-threads=2',
        '--use-pulseaudio',
        '--disable-features=AudioServiceOutOfProcess',
        ...chromeSandboxArgs(runtimeConfig),
        `--user-data-dir=${profile}`,
        '--no-first-run',
        '--no-default-browser-check',
        `--display=${displayName}`,
        `--window-size=${BASE_WIDTH},${BASE_HEIGHT}`,
      ],
      chromeEnv,
      path.join(logDir, 'chrome.log'),
    ))

    await new Promise(r => setTimeout(r, 2000))

    if (!isAlive(chrome)) {
      return {
        error: 'CHROME_FAILED',
        message: 'Failed to start Chrome.',
      }
    }

    const chromeWindowId = findChromeWindowId(displayName)

    if (!chromeWindowId) {
      return {
        error: 'CHROME_WINDOW_NOT_FOUND',
        message: 'Chrome started, but its window could not be detected.',
      }
    }

    try {
      resizeChromeWindow(
        { chromeWindowId, display: displayName },
        BASE_WIDTH,
        BASE_HEIGHT,
      )

      const centeredX = Math.round((1600 - BASE_WIDTH) / 2)
      const centeredY = Math.round((1200 - BASE_HEIGHT) / 2)

      spawnSync(
        '/usr/bin/xdotool',
        [
          'windowmove',
          String(chromeWindowId),
          String(centeredX),
          String(centeredY),
        ],
        {
          env: {
            ...childEnvironment(process.env, runtimeConfig.production),
            DISPLAY: displayName,
          },
          encoding: 'utf8',
        }
      )
    } catch (error) {
      return {
        error: 'CHROME_RESIZE_FAILED',
        message: error instanceof Error ? error.message : String(error),
      }
    }

    const x11vnc = startup.child(spawnLogged(
      'x11vnc',
      [
        '-display',
        displayName,
        '-rfbport',
        String(vncPort),
        '-localhost',
        '-nopw',
        '-forever',
        '-shared',
        '-wait',
        '2',
        '-defer',
        '0',
        '-speeds',
        'lan',
      ],
      {},
      path.join(logDir, 'x11vnc.log'),
    ))

    await new Promise(r => setTimeout(r, 1000))

    if (!isAlive(x11vnc)) {
      let x11vncLog = ''
      try {
        x11vncLog = fs.readFileSync(path.join(logDir, 'x11vnc.log'), 'utf8')
      } catch (error) {
        x11vncLog = `Unable to read x11vnc log: ${error instanceof Error ? error.message : String(error)}`
      }

      console.error(`[Poxey Session] X11VNC_FAILED_LOG\n${x11vncLog}`)

      return {
        error: 'VNC_FAILED',
        message: 'Failed to start x11vnc.',
      }
    }

    const vncReady = await waitForTcpPort(vncPort)

    if (!vncReady) {
      return {
        error: 'VNC_NOT_READY',
        message: 'VNC server did not become ready.',
      }
    }

    const session = {
      id,
      token: authToken,
      display,
      vncPort,
      dir,
      profile,
      xvfb,
      x11vnc,
      chrome,
      chromeWindowId,
      audioSink,
      audioClients: new Set(),
      audioCaptures: new Set(),
      vncClients: new Set(),
      width: BASE_WIDTH,
      height: BASE_HEIGHT,
      deviceId,
      createdAt: now,
      expiresAt: now + Math.min(
        FREE_SESSION_TIMEOUT_MS,
        allowance.remainingMs,
      ),
      lastHeartbeat: now,
      usageStartedAt: now,
      lastUsageUpdateAt: now,
      capacitySlot,
    }

    sessions.set(id, session)

    const watchProcess = (name, child) => {
      child.on('exit', (code, signal) => {
        console.log(
          `[Poxey Session] Process exited session=${session.id} process=${name} pid=${child.pid} code=${code} signal=${signal ?? 'none'}`
        )

        if (sessions.get(session.id) !== session || session.cleaningUp) {
          return
        }

        cleanupSession(session, `${name} exited`)
      })
    }

    watchProcess('chrome', chrome)
    watchProcess('x11vnc', x11vnc)
    watchProcess('xvfb', xvfb)

    try {
      writeTokenFile()
    } catch (error) {
      sessions.delete(id)
      throw error
    }
    startup.commit()
    published = true

    return {
      id,
      token: authToken,
      display,
      vncPort,
      createdAt: session.createdAt,
      expiresAt: session.expiresAt,
      remainingMs: allowance.remainingMs,
    }
  } finally {
    try { await startup.rollback() } catch (error) {
      rollbackComplete = false
      throw error
    } finally { startingFreeDevices.delete(deviceId) }
  }
  } finally {
    if (!published && rollbackComplete) capacitySlot?.release()
    sessionCreationLock = false
  }
}

function cleanupSession(session, reason = 'cleanup') {
  if (!session || session.cleaningUp) return session?.cleanupPromise

  session.cleaningUp = true
  retiringSessions.add(session)
  sessions.delete(session.id)
  let bookkeepingFailed = false
  // An accounting/token-file error must not prevent owned OS-resource cleanup.
  for (const action of [
    ...[...(session.audioClients || []), ...(session.vncClients || [])].map(client => () => client.close()),
    writeTokenFile,
    () => chargeSessionUsage(session, Date.now()),
  ]) {
    try { action() } catch (error) {
      bookkeepingFailed = true
      console.error('[Poxey Session] Cleanup bookkeeping failed:', error.message)
    }
  }

  console.log(`[Poxey Session] Cleaning ${session.id}: ${reason}`)

  session.cleanupPromise = teardownResources({
    children: [session.chrome, session.x11vnc, session.xvfb, ...(session.audioCaptures || [])],
    killTree: killProcessTree,
    isAlive,
    removeSink: () => {
      const result = removeAudioSink(session.audioSink?.moduleId)
      if (result && result.status !== 0) throw new Error('Session audio sink removal failed')
    },
    removeDirectory: () => fs.rmSync(session.dir, { recursive: true, force: true }),
    wait: ms => new Promise(resolve => setTimeout(resolve, ms)),
  }).then(() => {
    if (bookkeepingFailed) throw new Error('Session bookkeeping did not complete')
    retiringSessions.delete(session)
    session.capacitySlot.release()
  }).catch(error => {
    // Fail closed: retain the capacity reservation if cleanup cannot be verified.
    console.error(`[Poxey Session] Cleanup incomplete session=${session.id}:`, error.message)
  }).finally(() => pendingCleanup.delete(session.cleanupPromise))
  pendingCleanup.add(session.cleanupPromise)
  return session.cleanupPromise
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    const MAX_BODY_BYTES = 10 * 1024
    let body = ''
    let settled = false

    const fail = error => {
      if (settled) return
      settled = true
      reject(error)
    }

    req.on('data', chunk => {
      if (settled) return

      body += chunk.toString()

      if (Buffer.byteLength(body, 'utf8') > MAX_BODY_BYTES) {
        fail(new Error('REQUEST_BODY_TOO_LARGE'))
      }
    })

    req.on('aborted', () => {
      fail(new Error('REQUEST_ABORTED'))
    })

    req.on('error', error => {
      fail(error)
    })

    req.on('end', () => {
      if (settled) return

      try {
        settled = true
        resolve(parseSessionBody(body))
      } catch {
        settled = true
        reject(new Error('INVALID_JSON'))
      }
    })
  })
}

const wsOptions = { noServer: true, ...(runtimeConfig.production ? { maxPayload: 1024 * 1024 } : {}) }
const audioProxy = new WebSocketServer(wsOptions)

audioProxy.on('connection', (client, session) => {
  startAudioCapture({ client, session, spawn, env: pulseEnvironment(),
    log: event => console.log('[Poxey Audio]', JSON.stringify(event)),
  })
})

const vncProxy = new WebSocketServer(wsOptions)

vncProxy.on('connection', (client, session) => {
  session.vncClients.add(client)
  const upstream = net.createConnection({
    host: '127.0.0.1',
    port: session.vncPort,
  })

  upstream.on('connect', () => {
    client.on('message', data => {
      if (!upstream.destroyed) upstream.write(data)
    })
  })

  upstream.on('data', data => {
    if (client.readyState === 1) client.send(data)
  })

  const closeBoth = () => {
    session.vncClients.delete(client)
    if (!upstream.destroyed) upstream.destroy()
    if (client.readyState === 1) client.close()
  }

  client.on('close', closeBoth)
  client.on('error', closeBoth)
  upstream.on('close', closeBoth)
  upstream.on('error', closeBoth)
})

const server = http.createServer(async (req, res) => {
  try { accounting.assertReady() } catch {
    return json(res, 503, { ok: false, error: 'IDENTITY_STATE_BLOCKED' })
  }
  if (req.method !== 'GET' && !requestAllowed(req, runtimeConfig)) {
    return json(res, 403, { error: 'ORIGIN_REJECTED' })
  }
  if (req.method === 'GET' && req.url === '/health') {
    return json(res, 200, {
      ok: true,
      sessions: sessions.size,
      maxSessions: MAX_SESSIONS,
      occupiedSlots: capacity.occupied,
    })
  }

  if (req.method === 'POST' && req.url === '/session/create') {
    try {
      const result = await createSession(req, res)

      if (result.error) {
      let status = 500

      if (
        result.error === 'MAX_SESSIONS' ||
        result.error === 'ALLOWANCE_EXHAUSTED' ||
        result.error === 'ACTIVE_SESSION' ||
        result.error === 'SESSION_CREATION_BUSY'
      ) {
        status = 429
      }

      return json(res, status, result)
    }

      return json(res, 201, result)
    } catch (error) {
      if (error?.message === 'INVALID_DEVICE_COOKIE') {
        return json(res, 401, { error: 'INVALID_DEVICE_COOKIE' })
      }
      console.error(
        '[Poxey Session] CREATE_SESSION_EXCEPTION',
        error instanceof Error ? error.stack : String(error)
      )

      return json(res, 500, {
        error: 'SESSION_CREATE_FAILED',
        message: runtimeConfig.production ? 'Session could not be started.' : error instanceof Error ? error.message : String(error),
      })
    }
  }

  if (req.method === 'POST' && req.url === '/session/resize') {
    let body

    try {
      body = await parseBody(req)
    } catch (error) {
      return json(res, 400, {
        error: 'INVALID_REQUEST',
        message: error instanceof Error ? error.message : 'Invalid request',
      })
    }

    const session = authorizedSession(req, body.token)

    if (!session) {
      return json(res, 401, { error: 'INVALID_SESSION' })
    }

    const sizePercent = Number(body.sizePercent)

    if (
      !Number.isFinite(sizePercent) ||
      sizePercent < MIN_SIZE_PERCENT ||
      sizePercent > MAX_SIZE_PERCENT
    ) {
      return json(res, 400, { error: 'INVALID_SIZE' })
    }

    const width = Math.round(BASE_WIDTH * (sizePercent / 100))
    const height = Math.round(BASE_HEIGHT * (sizePercent / 100))

    try {
      await resizeChromeWindow(session, width, height)
      session.width = width
      session.height = height

      return json(res, 200, {
        ok: true,
        id: session.id,
        width,
        height,
        sizePercent,
      })
    } catch (error) {
      return json(res, 500, {
        error: 'RESIZE_FAILED',
        message: error instanceof Error ? error.message : String(error),
      })
    }
  }

if (req.method === 'POST' && req.url === '/session/heartbeat') {
    let body

    try {
      body = await parseBody(req)
    } catch (error) {
      return json(res, 400, {
        error: 'INVALID_REQUEST',
        message: error instanceof Error ? error.message : 'Invalid request',
      })
    }

    const session = authorizedSession(req, body.token)

    if (!session) {
      return json(res, 401, {
        error: 'INVALID_SESSION',
      })
    }

    const now = Date.now()

    chargeSessionUsage(session, now)

    const allowance = getFreeAllowance(session.deviceId, now)
    const remainingMs = Math.min(
      allowance.remainingMs,
      Math.max(0, session.expiresAt - now),
    )

    session.lastHeartbeat = now

    if (remainingMs <= 0) {
      cleanupSession(session, 'free allowance exhausted')

      return json(res, 410, {
        error: 'ALLOWANCE_EXHAUSTED',
        remainingMs: 0,
        resetAt: allowance.record.windowStartedAt + FREE_ALLOWANCE_WINDOW_MS,
      })
    }

    return json(res, 200, {
      ok: true,
      id: session.id,
      display: session.display,
      remainingMs,
    })
  }

  if (req.method === 'POST' && req.url === '/session/end') {
    let body

    try {
      body = await parseBody(req)
    } catch (error) {
      return json(res, 400, {
        error: 'INVALID_REQUEST',
        message: error instanceof Error ? error.message : 'Invalid request',
      })
    }

    const session = authorizedSession(req, body.token)

    if (!session) {
      return json(res, 404, {
        error: 'INVALID_SESSION',
      })
    }

    cleanupSession(session, 'client requested end')

    return json(res, 200, {
      ok: true,
    })
  }

  return json(res, 404, {
    error: 'NOT_FOUND',
  })
})

setInterval(() => {
  const now = Date.now()

  for (const session of sessions.values()) {
    if (now >= session.expiresAt) {
      cleanupSession(session, 'free session expired')
      continue
    }

    if (now - session.lastHeartbeat >= IDLE_TIMEOUT_MS) {
      cleanupSession(session, 'idle timeout')
    }
  }
}, 10000)

server.on('upgrade', (req, socket, head) => {
  try {
    accounting.assertReady()
    const requestUrl = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`)

    if (requestUrl.pathname !== '/websockify' && requestUrl.pathname !== '/audio') {
      socket.destroy()
      return
    }

    const authToken = requestUrl.searchParams.get('token')
    const session = authorizedSession(req, authToken || '')

    if (!websocketAllowed(req, runtimeConfig, session, verifyFreeDeviceCookieValue(getCookie(req, FREE_DEVICE_COOKIE)), requestUrl.pathname)) {
      socket.destroy()
      return
    }

    if (requestUrl.pathname === '/audio') {
      audioProxy.handleUpgrade(req, socket, head, client => {
        audioProxy.emit('connection', client, session)
      })
    } else {
      vncProxy.handleUpgrade(req, socket, head, client => {
        vncProxy.emit('connection', client, session)
      })
    }
  } catch {
    socket.destroy()
  }
})

cleanupOrphanedVncProcesses()

server.listen(PORT, HOST, () => {
  console.log(`[Poxey Session] Manager listening on http://${HOST}:${PORT}`)
})

function shutdown() {
  console.log('[Poxey Session] Shutting down...')
  for (const session of sessions.values()) {
    cleanupSession(session, 'manager shutdown')
  }
  server.close(() => {
    Promise.all([...pendingCleanup]).then(() => process.exit(0))
  })
}

process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)
