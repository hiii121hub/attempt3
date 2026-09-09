import http from 'node:http'
import net from 'node:net'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'

const HOST = '127.0.0.1'
const PORT = 3997
const BASE_DIR = '/tmp/poxey-sessions'
const DISPLAY_START = 2
const VNC_PORT_START = 5902
const MAX_SESSIONS = 2
const IDLE_TIMEOUT_MS = 5 * 60 * 1000

const sessions = new Map()

fs.mkdirSync(BASE_DIR, { recursive: true })
const TOKEN_DIR = path.join(BASE_DIR, 'tokens')
const TOKEN_FILE = path.join(TOKEN_DIR, 'poxey.tokens')

fs.mkdirSync(TOKEN_DIR, { recursive: true })

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

async function createSession() {
  if (sessions.size >= MAX_SESSIONS) {
    return {
      error: 'MAX_SESSIONS',
      message: `Maximum of ${MAX_SESSIONS} active sessions reached.`,
    }
  }

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
      '1024x768x24',
      '-nolisten',
      'tcp',
    ],
    {},
    path.join(logDir, 'xvfb.log'),
  )

  await new Promise(r => setTimeout(r, 1000))

  if (!isAlive(xvfb)) {
    fs.rmSync(dir, { recursive: true, force: true })
    return {
      error: 'XVFB_FAILED',
      message: 'Failed to start Xvfb.',
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
      '2',
      '-speeds',
      'lan',
    ],
    {},
    path.join(logDir, 'x11vnc.log'),
  )

  await new Promise(r => setTimeout(r, 1000))

  if (!isAlive(x11vnc)) {
    xvfb.kill('SIGTERM')
    fs.rmSync(dir, { recursive: true, force: true })
    return {
      error: 'VNC_FAILED',
      message: 'Failed to start x11vnc.',
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
      '--use-pulseaudio',
      '--disable-features=AudioServiceOutOfProcess',
      '--no-sandbox',
      `--user-data-dir=${profile}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--start-maximized',
      `--display=${displayName}`,
    ],
    chromeEnv,
    path.join(logDir, 'chrome.log'),
  )

  await new Promise(r => setTimeout(r, 2000))

  if (!isAlive(chrome)) {
    x11vnc.kill('SIGTERM')
    xvfb.kill('SIGTERM')
    fs.rmSync(dir, { recursive: true, force: true })
    return {
      error: 'CHROME_FAILED',
      message: 'Failed to start Chrome.',
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
    createdAt: Date.now(),
    lastHeartbeat: Date.now(),
  }

  sessions.set(id, session)
  writeTokenFile()

  return {
    id,
    token: authToken,
    display,
    vncPort,
    createdAt: session.createdAt,
  }
}

function cleanupSession(session, reason = 'cleanup') {
  if (!session) return

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

const server = http.createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/health') {
    return json(res, 200, {
      ok: true,
      sessions: sessions.size,
      maxSessions: MAX_SESSIONS,
    })
  }

  if (req.method === 'POST' && req.url === '/session/create') {
    const result = await createSession()

    if (result.error) {
      const status = result.error === 'MAX_SESSIONS' ? 429 : 500
      return json(res, status, result)
    }

    return json(res, 201, result)
  }

  if (req.method === 'POST' && req.url === '/session/heartbeat') {
    const body = await parseBody(req)
    const session = findByToken(body.token)

    if (!session) {
      return json(res, 401, {
        error: 'INVALID_SESSION',
      })
    }

    session.lastHeartbeat = Date.now()

    return json(res, 200, {
      ok: true,
      id: session.id,
      display: session.display,
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
    if (now - session.lastHeartbeat >= IDLE_TIMEOUT_MS) {
      cleanupSession(session, 'idle timeout')
    }
  }
}, 10000)

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
