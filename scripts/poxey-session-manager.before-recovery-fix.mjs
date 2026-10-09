import http from 'node:http'
import net from 'node:net'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { spawn, spawnSync } from 'node:child_process'
import { WebSocketServer } from 'ws'

const HOST = '127.0.0.1'
const PORT = 3997
const BASE_DIR = '/tmp/poxey-sessions'
const DISPLAY_START = 2
const VNC_PORT_START = 5902
const MAX_SESSIONS = 100
const BASE_WIDTH = 1024
const BASE_HEIGHT = 768
const MIN_SIZE_PERCENT = 75
const MAX_SIZE_PERCENT = 150
const IDLE_TIMEOUT_MS = 5 * 60 * 1000
const FREE_SESSION_TIMEOUT_MS = 25 * 60 * 1000
const FREE_DAILY_ALLOWANCE_MS = 25 * 60 * 1000
const FREE_ALLOWANCE_WINDOW_MS = 24 * 60 * 60 * 1000
const FREE_DEVICE_COOKIE = 'poxey-free-id'
const FREE_DEVICE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365

const sessions = new Map()
const startingFreeDevices = new Set()

fs.mkdirSync(BASE_DIR, { recursive: true })
const TOKEN_DIR = path.join(BASE_DIR, 'tokens')
const TOKEN_FILE = path.join(TOKEN_DIR, 'poxey.tokens')
const FREE_USAGE_FILE = path.join(TOKEN_DIR, 'poxey-free-usage.json')
const FREE_COOKIE_SECRET_FILE = path.join(TOKEN_DIR, 'poxey-free-cookie.secret')

fs.mkdirSync(TOKEN_DIR, { recursive: true })

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
    ...process.env,
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
        ...process.env,
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

function loadFreeCookieSecret() {
  if (process.env.POXEY_FREE_COOKIE_SECRET) {
    return process.env.POXEY_FREE_COOKIE_SECRET
  }

  if (fs.existsSync(FREE_COOKIE_SECRET_FILE)) {
    return fs.readFileSync(FREE_COOKIE_SECRET_FILE, 'utf8').trim()
  }

  const secret = crypto.randomBytes(32).toString('base64url')
  fs.writeFileSync(FREE_COOKIE_SECRET_FILE, secret, { mode: 0o600 })
  fs.chmodSync(FREE_COOKIE_SECRET_FILE, 0o600)
  return secret
}

const FREE_COOKIE_SECRET = loadFreeCookieSecret()

function signFreeDeviceId(deviceId) {
  return crypto
    .createHmac('sha256', FREE_COOKIE_SECRET)
    .update(deviceId)
    .digest('base64url')
}

function createFreeDeviceCookieValue(deviceId) {
  return `${deviceId}.${signFreeDeviceId(deviceId)}`
}

function verifyFreeDeviceCookieValue(value) {
  if (!value) return null

  const separator = value.lastIndexOf('.')
  if (separator <= 0) return null

  const deviceId = value.slice(0, separator)
  const signature = value.slice(separator + 1)
  const expected = signFreeDeviceId(deviceId)

  const actualBuffer = Buffer.from(signature)
  const expectedBuffer = Buffer.from(expected)

  if (
    actualBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(actualBuffer, expectedBuffer)
  ) {
    return null
  }

  return deviceId
}

function getCookie(req, name) {
  const header = req.headers.cookie || ''

  for (const part of header.split(';')) {
    const separator = part.indexOf('=')

    if (separator === -1) continue

    const key = part.slice(0, separator).trim()
    const value = part.slice(separator + 1).trim()

    if (key === name) {
      return decodeURIComponent(value)
    }
  }

  return null
}

function getOrCreateFreeDevice(req, res) {
  const existing = verifyFreeDeviceCookieValue(
    getCookie(req, FREE_DEVICE_COOKIE)
  )

  if (existing) {
    return {
      deviceId: existing,
      isNew: false,
    }
  }

  const deviceId = crypto.randomUUID()
  const value = createFreeDeviceCookieValue(deviceId)
  const forwardedProto = String(req.headers['x-forwarded-proto'] || '')
  const secure = forwardedProto === 'https'

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
  if (!fs.existsSync(FREE_USAGE_FILE)) {
    return {}
  }

  try {
    const data = JSON.parse(fs.readFileSync(FREE_USAGE_FILE, 'utf8'))

    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      return {}
    }

    return data
  } catch {
    return {}
  }
}

function saveFreeUsage(usage) {
  const tempFile = `${FREE_USAGE_FILE}.tmp`

  fs.writeFileSync(
    tempFile,
    JSON.stringify(usage),
    { mode: 0o600 }
  )

  fs.chmodSync(tempFile, 0o600)
  fs.renameSync(tempFile, FREE_USAGE_FILE)
}

function getFreeAllowance(deviceId, now = Date.now()) {
  const usage = loadFreeUsage()
  const record = usage[deviceId]

  if (
    !record ||
    !Number.isFinite(record.windowStartedAt) ||
    !Number.isFinite(record.usedMs) ||
    now - record.windowStartedAt >= FREE_ALLOWANCE_WINDOW_MS
  ) {
    return {
      usage,
      record: {
        windowStartedAt: now,
        usedMs: 0,
      },
      remainingMs: FREE_DAILY_ALLOWANCE_MS,
    }
  }

  const usedMs = Math.min(
    FREE_DAILY_ALLOWANCE_MS,
    Math.max(0, record.usedMs),
  )

  return {
    usage,
    record: {
      windowStartedAt: record.windowStartedAt,
      usedMs,
    },
    remainingMs: Math.max(0, FREE_DAILY_ALLOWANCE_MS - usedMs),
  }
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
  const child = spawn(command, args, {
    env: { ...process.env, ...env },
    stdio: ['ignore', log, log],
    detached: false,
  })
  child.on('exit', () => fs.closeSync(log))
  return child
}

function isAlive(child) {
  return child && child.exitCode === null && !child.killed
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
  return new Set([...sessions.values()].map(s => s.display))
}

function usedPorts() {
  return new Set([...sessions.values()].map(s => s.vncPort))
}

function findByToken(value) {
  for (const session of sessions.values()) {
    if (session.token === value) return session
  }
  return null
}

async function createSession(req, res) {
  if (sessions.size >= MAX_SESSIONS) {
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

  const display = freeNumber(DISPLAY_START, usedDisplays())
  const vncPort = freeNumber(VNC_PORT_START, usedPorts())
  const id = sessionId()
  const authToken = token()

  const dir = path.join(BASE_DIR, id)
  const profile = path.join(dir, 'profile')
  const logDir = path.join(dir, 'logs')

  fs.mkdirSync(profile, { recursive: true })
  fs.mkdirSync(logDir, { recursive: true })

  const displayName = `:${display}`

  const xvfb = spawnLogged(
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
  )

  await new Promise(r => setTimeout(r, 1000))

  if (!isAlive(xvfb)) {
    fs.rmSync(dir, { recursive: true, force: true })
    startingFreeDevices.delete(deviceId)
    return {
      error: 'XVFB_FAILED',
      message: 'Failed to start Xvfb.',
    }
  }

  const runtimeDir =
    process.env.XDG_RUNTIME_DIR || `/tmp/runtime-${process.getuid?.() ?? 1000}`

  const pulseRuntimePath = path.join(runtimeDir, 'pulse')
  fs.mkdirSync(pulseRuntimePath, { recursive: true })

  const chromeEnv = {
    DISPLAY: displayName,
    XDG_RUNTIME_DIR: runtimeDir,
    PULSE_RUNTIME_PATH: pulseRuntimePath,
    PULSE_SERVER: `unix:${pulseRuntimePath}/native`,
    PULSE_SINK: 'poxey_output',
  }

  const chrome = spawnLogged(
    '/usr/bin/google-chrome',
    [
      '--disable-gpu',
      '--num-raster-threads=2',
      '--use-pulseaudio',
      '--disable-features=AudioServiceOutOfProcess',
      '--no-sandbox',
      `--user-data-dir=${profile}`,
      '--no-first-run',
      '--no-default-browser-check',
      `--display=${displayName}`,
    ],
    chromeEnv,
    path.join(logDir, 'chrome.log'),
  )

  await new Promise(r => setTimeout(r, 2000))

  if (!isAlive(chrome)) {
    xvfb.kill('SIGTERM')
    fs.rmSync(dir, { recursive: true, force: true })
    startingFreeDevices.delete(deviceId)
    return {
      error: 'CHROME_FAILED',
      message: 'Failed to start Chrome.',
    }
  }

  const chromeWindowId = findChromeWindowId(displayName)

  if (!chromeWindowId) {
    chrome.kill('SIGTERM')
    xvfb.kill('SIGTERM')
    fs.rmSync(dir, { recursive: true, force: true })
    startingFreeDevices.delete(deviceId)
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
          ...process.env,
          DISPLAY: displayName,
        },
        encoding: 'utf8',
      }
    )
  } catch (error) {
    chrome.kill('SIGTERM')
    xvfb.kill('SIGTERM')
    fs.rmSync(dir, { recursive: true, force: true })
    startingFreeDevices.delete(deviceId)
    return {
      error: 'CHROME_RESIZE_FAILED',
      message: error instanceof Error ? error.message : String(error),
    }
  }

  const x11vnc = spawnLogged(
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
  )

  await new Promise(r => setTimeout(r, 1000))

  if (!isAlive(x11vnc)) {
    let x11vncLog = ''
    try {
      x11vncLog = fs.readFileSync(path.join(logDir, 'x11vnc.log'), 'utf8')
    } catch (error) {
      x11vncLog = `Unable to read x11vnc log: ${error instanceof Error ? error.message : String(error)}`
    }

    console.error(`[Poxey Session] X11VNC_FAILED_LOG\n${x11vncLog}`)

    chrome.kill('SIGTERM')
    xvfb.kill('SIGTERM')
    fs.rmSync(dir, { recursive: true, force: true })
    startingFreeDevices.delete(deviceId)
    return {
      error: 'VNC_FAILED',
      message: 'Failed to start x11vnc.',
    }
  }

  const vncReady = await waitForTcpPort(vncPort)

  if (!vncReady) {
    chrome.kill('SIGTERM')
    x11vnc.kill('SIGTERM')
    xvfb.kill('SIGTERM')
    fs.rmSync(dir, { recursive: true, force: true })
    startingFreeDevices.delete(deviceId)
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
  }

  sessions.set(id, session)
  startingFreeDevices.delete(deviceId)
  writeTokenFile()

  return {
    id,
    token: authToken,
    display,
    vncPort,
    createdAt: session.createdAt,
    expiresAt: session.expiresAt,
    remainingMs: allowance.remainingMs,
  }
}

function cleanupSession(session, reason = 'cleanup') {
  if (!session) return

  chargeSessionUsage(session, Date.now())

  console.log(`[Poxey Session] Cleaning ${session.id}: ${reason}`)

  for (const child of [session.chrome, session.x11vnc, session.xvfb]) {
    if (isAlive(child)) {
      child.kill('SIGTERM')
    }
  }

  setTimeout(() => {
    for (const child of [session.chrome, session.x11vnc, session.xvfb]) {
      if (isAlive(child)) {
        child.kill('SIGKILL')
      }
    }

    fs.rmSync(session.dir, { recursive: true, force: true })
  }, 1500)

  sessions.delete(session.id)
  writeTokenFile()
}

function parseBody(req) {
  return new Promise((resolve) => {
    let body = ''
    req.on('data', chunk => {
      body += chunk
      if (body.length > 10000) req.destroy()
    })
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {})
      } catch {
        resolve({})
      }
    })
  })
}

const vncProxy = new WebSocketServer({ noServer: true })

vncProxy.on('connection', (client, session) => {
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
    if (!upstream.destroyed) upstream.destroy()
    if (client.readyState === 1) client.close()
  }

  client.on('close', closeBoth)
  client.on('error', closeBoth)
  upstream.on('close', closeBoth)
  upstream.on('error', closeBoth)
})

const server = http.createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/health') {
    return json(res, 200, {
      ok: true,
      sessions: sessions.size,
      maxSessions: MAX_SESSIONS,
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
        result.error === 'ACTIVE_SESSION'
      ) {
        status = 429
      }

      return json(res, status, result)
    }

      return json(res, 201, result)
    } catch (error) {
      console.error(
        '[Poxey Session] CREATE_SESSION_EXCEPTION',
        error instanceof Error ? error.stack : String(error)
      )

      return json(res, 500, {
        error: 'SESSION_CREATE_FAILED',
        message: error instanceof Error ? error.message : String(error),
      })
    }
  }

  if (req.method === 'POST' && req.url === '/session/resize') {
    const body = await parseBody(req)
    const session = findByToken(body.token)

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
    const body = await parseBody(req)
    const session = findByToken(body.token)

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
    const body = await parseBody(req)
    const session = findByToken(body.token)

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
    const requestUrl = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`)

    if (requestUrl.pathname !== '/websockify') {
      socket.destroy()
      return
    }

    const authToken = requestUrl.searchParams.get('token')
    const session = findByToken(authToken || '')

    if (!session) {
      socket.destroy()
      return
    }

    vncProxy.handleUpgrade(req, socket, head, client => {
      vncProxy.emit('connection', client, session)
    })
  } catch {
    socket.destroy()
  }
})

server.listen(PORT, HOST, () => {
  console.log(`[Poxey Session] Manager listening on http://${HOST}:${PORT}`)
})

function shutdown() {
  console.log('[Poxey Session] Shutting down...')
  for (const session of sessions.values()) {
    cleanupSession(session, 'manager shutdown')
  }
  server.close(() => process.exit(0))
}

process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)
