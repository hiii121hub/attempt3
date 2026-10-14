// Opt-in, single-user development smoke against the already running ORIGINAL checkout.
// Never resets usage, restarts services, or touches a session it did not create.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { WebSocket } from 'ws'

assert.equal(process.platform, 'linux')
assert.equal(process.env.POXEY_ORIGINAL_SMOKE, '1')
assert.notEqual(process.env.NODE_ENV, 'production')
assert.equal(fs.realpathSync(process.cwd()), '/workspaces/attempt3')
const base = 'http://127.0.0.1:3997'
const root = '/tmp/poxey-sessions'
const ledgerPath = `${root}/tokens/poxey-free-usage.json`
const ledger = () => JSON.parse(fs.readFileSync(ledgerPath, 'utf8'))
const health = async () => (await fetch(`${base}/health`, { signal: AbortSignal.timeout(3000) })).json()
const wait = ms => new Promise(resolve => setTimeout(resolve, ms))
const until = async check => {
  for (let i = 0; i < 200; i++) { if (await check()) return; await wait(100) }
  throw new Error('Cleanup did not finish within 20 seconds')
}
let cookie = ''
const post = async (route, body = {}) => {
  const response = await fetch(base + route, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...(cookie ? { cookie } : {}) },
    body: JSON.stringify(body), signal: AbortSignal.timeout(45000),
  })
  const setCookie = response.headers.get('set-cookie')
  if (setCookie) cookie = setCookie.split(';')[0]
  return { status: response.status, data: await response.json() }
}
function probe(route, token, valid) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(`ws://127.0.0.1:3997${route}?token=${encodeURIComponent(token)}`)
    let done = false
    const finish = (ok, value) => {
      if (done) return
      done = true; clearTimeout(timer); socket.terminate()
      ok ? resolve(value) : reject(new Error(`Stream failed: ${route}`))
    }
    const timer = setTimeout(() => finish(false), 12000)
    socket.on('open', () => { if (!valid) finish(false) })
    socket.on('message', bytes => { if (bytes.length) finish(valid, bytes.length) })
    socket.on('error', () => finish(!valid, 'rejected'))
    socket.on('close', () => finish(!valid, 'rejected'))
  })
}
const initial = await health()
assert.equal(initial.sessions, 0, 'Do not disturb active users')
assert.equal(initial.occupiedSlots, 0, 'Do not overlap pending startup/cleanup')
assert.equal(fs.readdirSync(root).filter(name => /^[0-9a-f-]{36}$/.test(name)).length, 0)
const before = ledger()
const owned = new Map()
async function end(id, token) {
  const response = await post('/session/end', { token })
  assert.equal(response.status, 200)
  await until(async () => !fs.existsSync(`${root}/${id}`) && (await health()).occupiedSlots === 0)
  owned.delete(id)
}
try {
  const started = Date.now(), first = await post('/session/create')
  assert.equal(first.status, 201)
  owned.set(first.data.id, first.data.token)
  assert.equal(first.data.remainingMs, 25 * 60 * 1000)
  assert.ok(cookie)
  assert.ok(fs.existsSync(`${root}/${first.data.id}`))
  console.log(JSON.stringify({ chromeLaunchMs: Date.now() - started, remainingMs: first.data.remainingMs }))
  for (const route of ['/websockify', '/audio']) {
    assert.equal(await probe(route, 'invalid-integration-token', false), 'rejected')
    const begun = Date.now(), bytes = await probe(route, first.data.token, true)
    console.log(JSON.stringify({ route, invalidToken: 'rejected', authenticatedBytes: bytes, elapsedMs: Date.now() - begun }))
  }
  // Same authorized endpoint used by the frontend's pagehide beacon.
  await end(first.data.id, first.data.token)
  const second = await post('/session/create')
  assert.equal(second.status, 201)
  owned.set(second.data.id, second.data.token)
  assert.ok(second.data.remainingMs > 0 && second.data.remainingMs < first.data.remainingMs)
  console.log(JSON.stringify({ sameDeviceRelaunchRemainingMs: second.data.remainingMs, allowanceNotReset: true }))
  await end(second.data.id, second.data.token)
  const after = ledger()
  for (const [id, record] of Object.entries(before)) assert.deepEqual(after[id], record)
  assert.equal(Object.keys(after).length, Object.keys(before).length + 1)
  assert.ok(Object.entries(after).some(([id, record]) => !(id in before) && record.usedMs > 0))
  assert.equal((await health()).sessions, 0)
  console.log(JSON.stringify({ result: 'PASS', profilesDeleted: true, capacityRecovered: true, priorUsageRecordsPreserved: true, audiblePlayback: 'NOT TESTED', actualBrowserRefresh: 'NOT TESTED', fiveViewers: 'NOT TESTED' }))
} finally {
  for (const [id, token] of owned) await end(id, token)
}
