// Opt-in Linux development test. Never run against a live/production service.
// Starts its own cap-one manager; creates two real Chrome sessions sequentially.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { WebSocket } from 'ws'

assert.ok(process.platform === 'linux' && process.env.NODE_ENV !== 'production' && process.env.POXEY_CAPACITY_SMOKE === '1', 'Requires explicit POXEY_CAPACITY_SMOKE=1 on an idle Linux development host')
const base = 'http://127.0.0.1:3997', root = '/tmp/poxey-sessions'
const wait = ms => new Promise(resolve => setTimeout(resolve, ms))
const dirs = () => fs.existsSync(root) ? fs.readdirSync(root).filter(name => /^[0-9a-f-]{36}$/.test(name)) : []
assert.equal(dirs().length, 0, 'Existing profiles must not be disturbed')
let running = false
try { await fetch(`${base}/health`); running = true } catch {}
assert.equal(running, false, 'Existing manager must not be disturbed')
const manager = spawn(process.execPath, [new URL('./poxey-session-manager.mjs', import.meta.url).pathname], {
  env: { ...process.env, NODE_ENV: 'development', POXEY_MAX_SESSIONS: '1' }, stdio: ['ignore', 'ignore', 'pipe'],
})
// Keep diagnostics narrow: never dump the environment, tokens or browser logs.
const audioErrors = []
manager.stderr.on('data', bytes => {
  for (const line of bytes.toString().split('\n')) if (line.startsWith('[Poxey Audio]')) audioErrors.push(line.slice(0, 500))
  if (audioErrors.length > 10) audioErrors.shift()
})
const exited = once(manager, 'exit')
const health = async () => (await fetch(`${base}/health`)).json()
const until = async fn => {
  for (let i = 0; i < 150; i++) { if (await fn()) return; await wait(100) }
  throw new Error('Smoke condition timed out')
}
const post = async (route, body = {}) => {
  const response = await fetch(base + route, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(45000) })
  return { status: response.status, data: await response.json() }
}
function probe(route, token, valid) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(`ws://127.0.0.1:3997${route}?token=${encodeURIComponent(token)}`)
    let done = false
    const finish = (ok, value) => {
      if (done) return
      done = true; clearTimeout(timer); socket.terminate()
      ok ? resolve(value) : reject(new Error(`Stream probe failed ${route}`))
    }
    const timer = setTimeout(() => finish(false), 15000)
    socket.on('open', () => { if (!valid) finish(false) })
    socket.on('message', bytes => finish(valid, bytes.length))
    socket.on('error', () => finish(!valid, 'rejected'))
    socket.on('close', () => finish(!valid, 'rejected'))
  })
}
try {
  await until(async () => { try { return (await health()).ok } catch { return false } })
  assert.equal((await health()).maxSessions, 1)
  const secretFile = `${root}/tokens/poxey-free-cookie.secret`, ledgerFile = `${root}/tokens/poxey-free-usage.json`
  const secret = fs.readFileSync(secretFile)
  const prior = fs.existsSync(ledgerFile) ? JSON.parse(fs.readFileSync(ledgerFile)) : {}
  const failureStarted = Date.now(), failed = post('/session/create')
  let ownedXvfb
  await until(() => {
    const children = fs.readFileSync(`/proc/${manager.pid}/task/${manager.pid}/children`, 'utf8').trim().split(/\s+/).filter(Boolean)
    for (const pid of children) {
      try {
        if (fs.readFileSync(`/proc/${pid}/cmdline`, 'utf8').split('\0')[0] === 'Xvfb') { ownedXvfb = Number(pid); return true }
      } catch {}
    }
    return false
  })
  process.kill(ownedXvfb, 'SIGTERM') // Only the test manager's own direct Xvfb child.
  const failure = await failed
  assert.equal(failure.status, 500); assert.equal(failure.data.error, 'XVFB_FAILED')
  assert.equal((await health()).occupiedSlots, 0); assert.equal(dirs().length, 0)
  console.log(JSON.stringify({ startupFailure: failure.data.error, elapsedMs: Date.now() - failureStarted, slotReleased: true }))
  let started = Date.now()
  const a = await post('/session/create'); assert.equal(a.status, 201)
  console.log(JSON.stringify({ launch: 1, status: a.status, startupMs: Date.now() - started, remainingMs: a.data.remainingMs }))
  const full = await post('/session/create')
  assert.equal(full.status, 429); assert.equal(full.data.error, 'MAX_SESSIONS'); assert.equal((await health()).sessions, 1)
  let audioPassed = false
  for (const route of ['/websockify', '/audio']) {
    assert.equal(await probe(route, 'invalid-test-token', false), 'rejected')
    const probeStarted = Date.now()
    try {
      const validBytes = await probe(route, a.data.token, true)
      console.log(JSON.stringify({ route, invalid: 'rejected', validBytes, elapsedMs: Date.now() - probeStarted }))
      if (route === '/audio') audioPassed = true
    } catch (error) {
      if (route !== '/audio') throw error
      console.error(JSON.stringify({ route, invalid: 'rejected', valid: 'FAILED', elapsedMs: Date.now() - probeStarted, audioErrors }))
    }
  }
  assert.equal((await post('/session/end', { token: a.data.token })).status, 200)
  const during = await post('/session/create')
  assert.equal(during.status, 429); assert.equal(during.data.error, 'MAX_SESSIONS'); assert.equal((await health()).occupiedSlots, 1)
  await until(async () => (await health()).occupiedSlots === 0)
  assert.equal(fs.existsSync(`${root}/${a.data.id}`), false)
  started = Date.now()
  const b = await post('/session/create'); assert.equal(b.status, 201)
  console.log(JSON.stringify({ launch: 2, status: b.status, startupMs: Date.now() - started, slotReused: true }))
  manager.kill('SIGTERM'); await exited
  assert.equal(dirs().length, 0); assert.deepEqual(fs.readFileSync(secretFile), secret)
  const ledger = JSON.parse(fs.readFileSync(ledgerFile))
  for (const [id, record] of Object.entries(prior)) assert.deepEqual(ledger[id], record)
  assert.ok(Object.values(ledger).some(record => record.usedMs > 0))
  console.log(JSON.stringify({ result: audioPassed ? 'PASS' : 'PARTIAL_AUDIO_FAILED', activeAndRetiringAdmission: true, shutdownProfileCleanup: true, ledgerRetained: true, secretRetained: true, fullViewers: false, audiblePlayback: false }))
  if (!audioPassed) process.exitCode = 1
} finally {
  if (manager.exitCode === null && manager.signalCode === null) { manager.kill('SIGTERM'); await exited }
  console.log('Final owned profile count:', dirs().length)
}
