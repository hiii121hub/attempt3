import test, { after } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { prepareRecovery, activateRecovery, recoveryStatus, reobserveRecovery, names, WINDOW_MS } from './accounting-state.mjs'

const project = path.resolve(new URL('..', import.meta.url).pathname)
const root = fs.mkdtempSync(path.join(path.dirname(project), '.poxey-reboot-test-'))
after(() => fs.rmSync(root, { recursive: true, force: true }))
let sequence = 0
const dir = () => path.join(root, String(++sequence))
const now = Date.now(), oldBoot = 'synthetic-old-boot', bootId = 'synthetic-new-boot'
const bytes = Buffer.from(JSON.stringify({ 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa': {
  windowStartedAt: now - WINDOW_MS, usedMs: 415257,
} }) + '\n')
const snapshot = source => Object.fromEntries(fs.readdirSync(source).map(n => [n, fs.readFileSync(path.join(source, n)).toString('base64')]))
function sourceState() {
  const source = dir()
  prepareRecovery(source, bytes, { now, bootId: oldBoot, uptimeMs: 0 })
  return source
}
const options = { now: now + WINDOW_MS, bootId, uptimeMs: 1000, quiescent: true }

test('reboot is diagnosed even after wall-clock deadline; status is read-only and redacted', () => {
  const source = sourceState(), before = snapshot(source)
  const result = recoveryStatus(source, options)
  assert.equal(result.code, 'RECOVERY_BOOT_CHANGED')
  assert.equal(result.admissionReady, false)
  assert.equal(JSON.stringify(result).includes('aaaaaaaa'), false)
  assert.equal(JSON.stringify(result).includes('415257'), false)
  assert.deepEqual(snapshot(source), before)
})
test('status distinguishes missing state, unknown boot, wait and eligibility without granting admission', () => {
  assert.equal(recoveryStatus(dir()).code, 'STATE_MISSING_OR_INVALID')
  const source = sourceState()
  assert.equal(recoveryStatus(source, { now }).code, 'HOST_BOOT_UNVERIFIED')
  assert.equal(recoveryStatus(source, { now, bootId: oldBoot, uptimeMs: 0 }).code, 'RECOVERY_WAITING')
  const result = recoveryStatus(source, { now: now + WINDOW_MS, bootId: oldBoot, uptimeMs: WINDOW_MS })
  assert.equal(result.code, 'ELIGIBLE_FOR_IDLE_HOST_RECHECK')
  assert.equal(result.admissionReady, false)
})
test('re-observation copies exact historical bytes, preserves old manifest and creates no key', () => {
  const source = sourceState(), destination = dir(), before = snapshot(source)
  const result = reobserveRecovery(source, destination, options)
  assert.equal(result.notBefore, options.now + WINDOW_MS)
  assert.equal(result.keyGenerated, false)
  assert.deepEqual(snapshot(source), before)
  assert.deepEqual(fs.readFileSync(path.join(destination, names.ledger)), bytes)
  assert.equal(fs.existsSync(path.join(destination, names.key)), false)
  assert.equal(fs.statSync(destination).mode & 0o777, 0o700)
  for (const name of [names.ledger, names.manifest]) assert.equal(fs.statSync(path.join(destination, name)).mode & 0o777, 0o600)
})
test('new recovery cannot activate early, after another reboot, or on wall-clock jump', () => {
  const source = sourceState(), destination = dir()
  reobserveRecovery(source, destination, options)
  for (const bad of [
    { now: options.now + WINDOW_MS - 1, uptimeMs: 1000 + WINDOW_MS },
    { now: options.now + WINDOW_MS, uptimeMs: 1000 + WINDOW_MS, bootId: 'third-boot' },
    { now: options.now + 4 * WINDOW_MS, uptimeMs: 1000 + WINDOW_MS - 1 },
  ]) assert.throws(() => activateRecovery(destination, { ...options, ...bad }))
  assert.equal(fs.existsSync(path.join(destination, names.key)), false)
  activateRecovery(destination, { ...options, now: options.now + WINDOW_MS, uptimeMs: 1000 + WINDOW_MS })
  assert.deepEqual(fs.readFileSync(path.join(destination, names.ledger)), bytes)
  assert.equal(recoveryStatus(destination, { now: options.now + WINDOW_MS }).code, 'READY')
})
for (const kind of ['same-boot', 'not-idle', 'clock-backward', 'occupied-destination', 'nested-destination', 'changed-ledger', 'bad-permissions', 'unexpected-file', 'existing-key', 'ready-source']) {
  test(`re-observation refuses ${kind} without modifying source`, () => {
    const source = sourceState()
    let destination = dir(), settings = { ...options }
    if (kind === 'same-boot') settings.bootId = oldBoot
    if (kind === 'not-idle') settings.quiescent = false
    if (kind === 'clock-backward') settings.now = now - 1
    if (kind === 'occupied-destination') fs.mkdirSync(destination, { mode: 0o700 })
    if (kind === 'nested-destination') destination = path.join(source, 'nested')
    if (kind === 'changed-ledger') fs.writeFileSync(path.join(source, names.ledger), '{}')
    if (kind === 'bad-permissions') fs.chmodSync(path.join(source, names.ledger), 0o644)
    if (kind === 'unexpected-file') fs.writeFileSync(path.join(source, 'unknown.pending'), 'synthetic', { mode: 0o600 })
    if (kind === 'existing-key') fs.writeFileSync(path.join(source, names.key), 'synthetic', { mode: 0o600 })
    if (kind === 'ready-source') activateRecovery(source, { now: now + WINDOW_MS, uptimeMs: WINDOW_MS, bootId: oldBoot, quiescent: true })
    const before = snapshot(source)
    assert.throws(() => reobserveRecovery(source, destination, settings))
    assert.deepEqual(snapshot(source), before)
  })
}
test('status CLI refuses missing state without host mutation or secret output', () => {
  const destination = dir()
  const result = spawnSync(process.execPath, ['scripts/accounting-recovery.mjs', 'status', destination], {
    cwd: project, encoding: 'utf8', timeout: 5000,
  })
  assert.equal(result.status, 2)
  assert.equal(JSON.parse(result.stdout).code, 'STATE_MISSING_OR_INVALID')
  assert.equal(fs.existsSync(destination), false)
})
test('status defaults to configured state without initializing it', () => {
  const destination = dir()
  const result = spawnSync(process.execPath, ['scripts/accounting-recovery.mjs', 'status'], {
    cwd: project, env: { ...process.env, NODE_ENV: 'development', POXEY_STATE_DIR: destination },
    encoding: 'utf8', timeout: 5000,
  })
  assert.equal(result.status, 2)
  assert.equal(JSON.parse(result.stdout).code, 'STATE_MISSING_OR_INVALID')
  assert.equal(fs.existsSync(destination), false)
})
