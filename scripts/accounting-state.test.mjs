import test, { after } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { prepareRecovery as prepare, activateRecovery as activate, openAccountingState, validateLedger, validateStatePath, freeAllowance, signDeviceId, verifyDeviceCookie, names, WINDOW_MS, ALLOWANCE_MS } from './accounting-state.mjs'

// Explicit synthetic clock proof; production CLI has no clock override.
const prepareRecovery = (dir, bytes, options) => prepare(dir, bytes, { uptimeMs: 0, ...options })
const activateRecovery = (dir, options) => activate(dir, { uptimeMs: WINDOW_MS, ...options })

// Owned disposable state outside Git and /tmp; never use the surviving ledger.
const parent = path.resolve(new URL('../..', import.meta.url).pathname)
const root = fs.mkdtempSync(path.join(parent, '.poxey-accounting-test-'))
after(() => fs.rmSync(root, { recursive: true, force: true }))
const now = Date.now(), bootId = 'test-host-boot'
const a = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa', b = 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb'
let sequence = 0
const destination = () => path.join(root, String(++sequence))
const record = (usedMs = 1234, windowStartedAt = now - 10000) => ({ windowStartedAt, usedMs })
function ready() {
  const dir = destination()
  prepareRecovery(dir, Buffer.from('{}'), { now: now - 2 * WINDOW_MS, bootId })
  activateRecovery(dir, { now: now - WINDOW_MS, bootId, quiescent: true })
  const store = openAccountingState(dir, { now: () => now })
  store.save({ [a]: record(), [b]: record(5678) })
  return { dir, store }
}

test('prepare preserves populated ledger bytes and creates no signing key', () => {
  const dir = destination(), bytes = Buffer.from(JSON.stringify({ [a]: record() }) + '\n')
  const result = prepareRecovery(dir, bytes, { now, bootId })
  assert.deepEqual(fs.readFileSync(path.join(dir, names.ledger)), bytes)
  assert.equal(result.notBefore, now + WINDOW_MS)
  assert.equal(fs.existsSync(path.join(dir, names.key)), false)
  assert.throws(() => openAccountingState(dir))
})
test('outstanding/unknown windows block rotation; no key is generated early', () => {
  const dir = destination()
  prepareRecovery(dir, JSON.stringify({ [a]: record() }), { now, bootId })
  for (const time of [now, now + WINDOW_MS - 1]) {
    assert.throws(() => activateRecovery(dir, { now: time, bootId, quiescent: true }))
    assert.equal(fs.existsSync(path.join(dir, names.key)), false)
  }
})
test('exact recovery boundary permits explicit rotation without altering historical ledger', () => {
  const dir = destination(), bytes = Buffer.from(JSON.stringify({ [a]: record() }))
  prepareRecovery(dir, bytes, { now, bootId })
  activateRecovery(dir, { now: now + WINDOW_MS, bootId, quiescent: true })
  assert.deepEqual(fs.readFileSync(path.join(dir, names.ledger)), bytes)
  const key = fs.readFileSync(path.join(dir, names.key), 'utf8')
  assert.equal(Buffer.from(key, 'base64url').length, 32)
})
test('boot change or absent quiescence proof cannot activate recovery', () => {
  const dir = destination()
  prepareRecovery(dir, '{}', { now, bootId })
  for (const options of [{ bootId: 'another-boot', quiescent: true }, { bootId, quiescent: false }]) {
    assert.throws(() => activateRecovery(dir, { now: now + WINDOW_MS, ...options }))
  }
})
test('a forward wall-clock jump cannot shorten the real recovery interval', () => {
  const dir = destination()
  prepareRecovery(dir, '{}', { now, bootId })
  assert.throws(() => activateRecovery(dir, { now: now + 2 * WINDOW_MS, uptimeMs: WINDOW_MS - 1, bootId, quiescent: true }))
  assert.equal(fs.existsSync(path.join(dir, names.key)), false)
})
test('prepare never overwrites populated state or a partial migration', () => {
  const { dir } = ready(), before = fs.readFileSync(path.join(dir, names.ledger))
  assert.throws(() => prepareRecovery(dir, '{}', { now, bootId }))
  assert.deepEqual(fs.readFileSync(path.join(dir, names.ledger)), before)
})
for (const kind of ['key', 'ledger', 'manifest']) {
  test(`missing ${kind} blocks startup without recreating any file`, () => {
    const { dir } = ready(), file = path.join(dir, names[kind])
    fs.unlinkSync(file)
    assert.throws(() => openAccountingState(dir))
    assert.equal(fs.existsSync(file), false)
  })
}
for (const bytes of ['{', 'null', '[]', JSON.stringify({ [a]: record(-1) }), JSON.stringify({ [a]: record(0, now + 1) }), JSON.stringify({ [a]: { usedMs: 0 } }), JSON.stringify({ [a]: record(ALLOWANCE_MS + 1) })]) {
  test(`invalid ledger blocks initialization (${bytes.length} bytes, case ${++sequence})`, () => assert.throws(() => validateLedger(bytes, now)))
}
test('corrupt/replaced ledger and changed secret fail closed even while manager is running', () => {
  for (const kind of ['ledger', 'key']) {
    const { dir, store } = ready()
    fs.writeFileSync(path.join(dir, names[kind]), kind === 'ledger' ? '{}' : crypto.randomBytes(32).toString('base64url'))
    assert.throws(() => store.assertReady())
    assert.throws(() => openAccountingState(dir))
  }
})
test('wrong private-file or directory permissions are rejected, not silently repaired', () => {
  for (const kind of [...Object.keys(names), 'directory']) {
    const { dir } = ready(), file = kind === 'directory' ? dir : path.join(dir, names[kind])
    fs.chmodSync(file, kind === 'directory' ? 0o755 : 0o644)
    assert.throws(() => openAccountingState(dir))
  }
})
test('symlink state and temporary/project state paths are rejected', () => {
  const { dir } = ready(), link = destination()
  fs.symlinkSync(dir, link)
  assert.throws(() => openAccountingState(link))
  for (const value of ['/', '/tmp/state', '/private/tmp/state', '/var/tmp/state', 'relative', new URL('..', import.meta.url).pathname.slice(0, -1)]) assert.throws(() => validateStatePath(value))
})
test('valid cookie survives fresh process restart with exactly the same consumption', () => {
  const { dir, store } = ready(), cookie = signDeviceId(a, store.secret)
  assert.equal(verifyDeviceCookie(cookie, openAccountingState(dir).secret), a)
  const child = spawnSync(process.execPath, ['--input-type=module', '-e', `import { openAccountingState } from ${JSON.stringify(new URL('./accounting-state.mjs', import.meta.url).href)}; const s=openAccountingState(process.argv[1]); if(Object.values(s.load()).reduce((n,r)=>n+r.usedMs,0)!==6912)process.exit(2)`, dir])
  assert.equal(child.status, 0)
  assert.equal(freeAllowance(openAccountingState(dir).load(), a, now).remainingMs, ALLOWANCE_MS - 1234)
})
test('unsigned, tampered, malformed and differently signed cookies are rejected', () => {
  const { store } = ready(), cookie = signDeviceId(a, store.secret)
  for (const value of [a, '', null, cookie + 'x', signDeviceId(b, store.secret).replace(b, a), signDeviceId(a, crypto.randomBytes(32).toString('base64url'))]) assert.equal(verifyDeviceCookie(value, store.secret), null)
})
test('refresh/end saves consumption without replenishing or changing another identity', () => {
  const { dir, store } = ready(), ledger = store.load(), other = { ...ledger[b] }
  ledger[a].usedMs += 2500
  store.save(ledger)
  assert.equal(freeAllowance(openAccountingState(dir).load(), a, now).remainingMs, ALLOWANCE_MS - 3734)
  assert.deepEqual(openAccountingState(dir).load()[b], other)
})
test('ledger cannot delete a user, decrease consumption or renew an unexpired window', () => {
  for (const mutate of [v => delete v[a], v => v[a].usedMs--, v => v[a] = record(0, now)]) {
    const { store } = ready(), ledger = store.load()
    mutate(ledger)
    assert.throws(() => store.save(ledger))
    assert.equal(store.load()[a].usedMs, 1234)
  }
})
test('expired window renews only at its existing normal 24-hour boundary', () => {
  const start = now - WINDOW_MS, ledger = { [a]: record(ALLOWANCE_MS, start) }
  assert.equal(freeAllowance(ledger, a, now - 1).remainingMs, 0)
  assert.equal(freeAllowance(ledger, a, now).remainingMs, ALLOWANCE_MS)
})
for (const stage of ['before-key', 'after-key']) {
  test(`interrupted rotation at ${stage} never enables startup`, () => {
    const dir = destination()
    prepareRecovery(dir, '{}', { now, bootId })
    assert.throws(() => activateRecovery(dir, { now: now + WINDOW_MS, bootId, quiescent: true, checkpoint: point => { if (point === stage) throw new Error('injected crash') } }))
    assert.throws(() => openAccountingState(dir, { now: () => now + WINDOW_MS }))
    if (stage === 'after-key') {
      const before = fs.readFileSync(path.join(dir, names.key))
      activateRecovery(dir, { now: now + WINDOW_MS, bootId, quiescent: true })
      assert.deepEqual(fs.readFileSync(path.join(dir, names.key)), before)
    }
  })
}
test('interrupted ledger commit retains new consumption and blocks ambiguous startup', () => {
  const { dir } = ready(), store = openAccountingState(dir, { checkpoint: () => { throw new Error('injected crash') } })
  const ledger = store.load(); ledger[a].usedMs += 1000
  assert.throws(() => store.save(ledger))
  assert.equal(JSON.parse(fs.readFileSync(path.join(dir, names.ledger)))[a].usedMs, 2234)
  assert.throws(() => openAccountingState(dir))
})
test('temporary profile deletion leaves persistent identities and records intact', () => {
  const { dir, store } = ready(), cookie = signDeviceId(a, store.secret)
  const profile = fs.mkdtempSync(path.join(root, 'profile-'))
  fs.writeFileSync(path.join(profile, 'canary'), 'disposable')
  fs.rmSync(profile, { recursive: true })
  assert.equal(verifyDeviceCookie(cookie, openAccountingState(dir).secret), a)
  assert.equal(openAccountingState(dir).load()[a].usedMs, 1234)
})
test('mismatching environment override cannot change the persisted signing identity', () => {
  const { dir } = ready()
  assert.throws(() => openAccountingState(dir, { expectedSecret: 'different-key' }))
})
