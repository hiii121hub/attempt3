import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import os from 'node:os'

export const ALLOWANCE_MS = 25 * 60 * 1000
export const WINDOW_MS = 24 * 60 * 60 * 1000
export const names = { ledger: 'poxey-free-usage.json', key: 'poxey-free-cookie.secret', manifest: 'identity-state.json' }
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const digest = bytes => crypto.createHash('sha256').update(bytes).digest('hex')
const fail = () => { throw new Error('IDENTITY_STATE_BLOCKED: preserve state; run node scripts/accounting-recovery.mjs status <configured-state-directory>, then follow deploy/IDENTITY-RECOVERY.md. No allowances were initialized.') }

export function validateStatePath(dir) {
  const project = path.resolve(new URL('..', import.meta.url).pathname)
  if (!path.isAbsolute(dir) || path.normalize(dir) !== dir || dir === '/' ||
      [project, '/tmp', '/private/tmp', '/var/tmp'].some(root => dir === root || dir.startsWith(root + path.sep))) fail()
  return dir
}

function privateEntry(file, directory = false) {
  const stat = fs.lstatSync(file)
  if (stat.isSymbolicLink() || (directory ? !stat.isDirectory() : !stat.isFile()) ||
      stat.uid !== process.getuid?.() || (stat.mode & 0o777) !== (directory ? 0o700 : 0o600) ||
      (!directory && (stat.nlink !== 1 || stat.size > 1024 * 1024))) fail()
}
function directory(dir) {
  validateStatePath(dir)
  privateEntry(dir, true)
  if (fs.realpathSync(dir) !== dir) fail()
}
function read(dir, kind) {
  const file = path.join(dir, names[kind])
  privateEntry(file)
  return fs.readFileSync(file)
}
function syncDirectory(dir) {
  const fd = fs.openSync(dir, 'r')
  try { fs.fsyncSync(fd) } finally { fs.closeSync(fd) }
}
function writeExclusive(file, bytes) {
  const fd = fs.openSync(file, 'wx', 0o600)
  try { fs.writeFileSync(fd, bytes); fs.fsyncSync(fd) } finally { fs.closeSync(fd) }
}
function atomic(dir, kind, bytes) {
  const target = path.join(dir, names[kind]), temporary = `${target}.${crypto.randomUUID()}.pending`
  writeExclusive(temporary, bytes)
  fs.renameSync(temporary, target)
  syncDirectory(dir)
}
function manifest(dir) { return JSON.parse(read(dir, 'manifest')) }
function writeManifest(dir, value) { atomic(dir, 'manifest', JSON.stringify(value)) }
function validManifest(meta) {
  if (meta?.version !== 1 || !['blocked', 'activating', 'ready'].includes(meta.phase) ||
      !Number.isSafeInteger(meta.observedAt) || !Number.isSafeInteger(meta.notBefore) ||
      meta.observedAt < 0 || meta.notBefore < meta.observedAt + WINDOW_MS ||
      !Number.isSafeInteger(meta.observedUptimeMs) || meta.observedUptimeMs < 0 ||
      !/^[a-f0-9]{64}$/.test(meta.ledgerSha256) || typeof meta.bootId !== 'string' || !meta.bootId) fail()
}
export function validateLedger(bytes, now = Date.now()) {
  const ledger = JSON.parse(bytes)
  if (!ledger || typeof ledger !== 'object' || Array.isArray(ledger)) fail()
  for (const [id, value] of Object.entries(ledger)) {
    if (!uuid.test(id) || !value || Object.keys(value).sort().join(',') !== 'usedMs,windowStartedAt' ||
        !Number.isSafeInteger(value.windowStartedAt) || value.windowStartedAt < 0 || value.windowStartedAt > now ||
        !Number.isSafeInteger(value.usedMs) || value.usedMs < 0 || value.usedMs > ALLOWANCE_MS) fail()
  }
  return ledger
}

// Explicit operator action only. Byte-for-byte ledger copy; never called by startup.
// A full quiet window covers unknown usage after an incomplete backup snapshot.
export function prepareRecovery(dir, ledgerBytes, { now = Date.now(), bootId, uptimeMs = Math.floor(os.uptime() * 1000) } = {}) {
  validateStatePath(dir)
  const ledger = validateLedger(ledgerBytes, now)
  if (!bootId || !Number.isSafeInteger(now) || !Number.isSafeInteger(uptimeMs) || uptimeMs < 0) fail()
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 })
  directory(dir)
  if (fs.readdirSync(dir).length) fail()
  const meta = { version: 1, phase: 'blocked', observedAt: now, observedUptimeMs: uptimeMs, bootId,
    notBefore: Math.max(now + WINDOW_MS, ...Object.values(ledger).map(r => r.windowStartedAt + WINDOW_MS)),
    ledgerSha256: digest(ledgerBytes) }
  writeExclusive(path.join(dir, names.ledger), ledgerBytes)
  syncDirectory(dir)
  writeManifest(dir, meta)
  return { phase: meta.phase, notBefore: meta.notBefore }
}

// Read-only diagnostics expose no key, cookie, identity or usage-record contents.
export function recoveryStatus(dir, { now = Date.now(), bootId, uptimeMs } = {}) {
  try {
    if (!Number.isSafeInteger(now) || now < 0) fail()
    directory(dir)
    const meta = manifest(dir)
    validManifest(meta)
    const bytes = read(dir, 'ledger')
    const ledger = validateLedger(bytes, now)
    if (digest(bytes) !== meta.ledgerSha256) fail()
    if (meta.phase === 'ready') {
      openAccountingState(dir, { now: () => now }).assertReady()
      return { code: 'READY', admissionReady: true }
    }
    if (meta.phase === 'activating') return { code: 'INTERRUPTED_ACTIVATION_REVIEW', admissionReady: false }
    if (fs.readdirSync(dir).includes(names.key)) fail()
    const summary = { admissionReady: false, notBeforeUTC: new Date(meta.notBefore).toISOString(), ledgerVerified: true }
    if (!bootId) return { ...summary, code: 'HOST_BOOT_UNVERIFIED' }
    if (meta.bootId !== bootId) return { ...summary, code: 'RECOVERY_BOOT_CHANGED' }
    try { uptimeMs ??= Math.floor(os.uptime() * 1000) }
    catch { return { ...summary, code: 'UPTIME_PROOF_UNAVAILABLE' } }
    if (!Number.isSafeInteger(uptimeMs) || uptimeMs < meta.observedUptimeMs) return { ...summary, code: 'UPTIME_PROOF_INVALID' }
    if (now < meta.notBefore || uptimeMs - meta.observedUptimeMs < WINDOW_MS ||
        Object.values(ledger).some(r => now < r.windowStartedAt + WINDOW_MS)) {
      return { ...summary, code: 'RECOVERY_WAITING' }
    }
    return { ...summary, code: 'ELIGIBLE_FOR_IDLE_HOST_RECHECK' }
  } catch {
    return { code: 'STATE_MISSING_OR_INVALID', admissionReady: false }
  }
}

// Explicit reviewed re-observation after a reboot, never automatic startup.
// Preserve the source and its old gate; create a separate blocked copy with a
// fresh full waiting window, no key and no live configuration change.
export function reobserveRecovery(source, destination, { now = Date.now(), bootId, uptimeMs = Math.floor(os.uptime() * 1000), quiescent = false } = {}) {
  directory(source)
  validateStatePath(destination)
  const meta = manifest(source)
  validManifest(meta)
  if (!quiescent || !bootId || meta.bootId === bootId || meta.phase !== 'blocked' ||
      !Number.isSafeInteger(now) || now < meta.observedAt ||
      !Number.isSafeInteger(uptimeMs) || uptimeMs < 0 ||
      destination === source || destination.startsWith(source + path.sep) ||
      source.startsWith(destination + path.sep) || fs.existsSync(destination) ||
      fs.readdirSync(source).some(n => ![names.manifest, names.ledger].includes(n))) fail()
  const bytes = read(source, 'ledger')
  const ledger = validateLedger(bytes, now)
  if (digest(bytes) !== meta.ledgerSha256 ||
      meta.notBefore > Math.max(now + WINDOW_MS, ...Object.values(ledger).map(r => r.windowStartedAt + WINDOW_MS))) fail()
  const result = prepareRecovery(destination, bytes, { now, bootId, uptimeMs })
  return { ...result, sourcePreserved: true, ledgerPreserved: true, keyGenerated: false }
}

// CLI must independently verify an idle Linux host immediately before this call.
export function activateRecovery(dir, { now = Date.now(), bootId, uptimeMs = Math.floor(os.uptime() * 1000), quiescent = false, checkpoint = () => {} } = {}) {
  directory(dir)
  let meta = manifest(dir)
  validManifest(meta)
  if (!quiescent || meta.bootId !== bootId || now < meta.notBefore || meta.phase === 'ready' ||
      !Number.isSafeInteger(uptimeMs) || uptimeMs - meta.observedUptimeMs < WINDOW_MS) fail()
  const bytes = read(dir, 'ledger')
  const ledger = validateLedger(bytes, now)
  if (digest(bytes) !== meta.ledgerSha256 || Object.values(ledger).some(r => now < r.windowStartedAt + WINDOW_MS)) fail()
  if (meta.phase === 'blocked') {
    if (fs.existsSync(path.join(dir, names.key))) fail()
    const key = crypto.randomBytes(32).toString('base64url')
    meta = { ...meta, phase: 'activating', keySha256: digest(key), activatedAt: now }
    writeManifest(dir, meta)
    checkpoint('before-key')
    writeExclusive(path.join(dir, names.key), key)
    syncDirectory(dir)
    checkpoint('after-key')
  }
  // An interrupted activation may resume only with the exact pinned key.
  const key = read(dir, 'key').toString()
  if (!/^[A-Za-z0-9_-]{43}$/.test(key) || digest(key) !== meta.keySha256) fail()
  writeManifest(dir, { ...meta, phase: 'ready' })
  return { phase: 'ready', oldCookiesInvalidated: true }
}

export function openAccountingState(dir, { now = () => Date.now(), checkpoint = () => {}, expectedSecret = process.env.POXEY_FREE_COOKIE_SECRET } = {}) {
  let pinnedKeyHash
  function inspect() {
    try {
      directory(dir)
      const meta = manifest(dir)
      validManifest(meta)
      if (meta.phase !== 'ready' || !Number.isSafeInteger(meta.activatedAt) || now() < meta.activatedAt) fail()
      const key = read(dir, 'key').toString(), bytes = read(dir, 'ledger')
      if (!/^[A-Za-z0-9_-]{43}$/.test(key) || digest(key) !== meta.keySha256 || digest(bytes) !== meta.ledgerSha256 ||
          (pinnedKeyHash && pinnedKeyHash !== meta.keySha256) || (expectedSecret && key !== expectedSecret)) fail()
      return { meta, key, ledger: validateLedger(bytes, now()) }
    } catch { fail() }
  }
  const initial = inspect()
  pinnedKeyHash = initial.meta.keySha256
  return {
    secret: initial.key,
    load() { return inspect().ledger },
    assertReady() { inspect() },
    save(ledger) {
      const prior = inspect(), bytes = Buffer.from(JSON.stringify(ledger))
      validateLedger(bytes, now())
      for (const [id, record] of Object.entries(prior.ledger)) {
        const next = ledger[id]
        if (!next || (next.windowStartedAt === record.windowStartedAt ? next.usedMs < record.usedMs :
          next.windowStartedAt < record.windowStartedAt + WINDOW_MS || now() < record.windowStartedAt + WINDOW_MS)) fail()
      }
      // A crash between these durable writes blocks admission on checksum mismatch,
      // preserving the newer ledger for reviewed repair instead of rolling it back.
      atomic(dir, 'ledger', bytes)
      checkpoint('after-ledger')
      writeManifest(dir, { ...prior.meta, ledgerSha256: digest(bytes) })
    },
  }
}

export function freeAllowance(usage, deviceId, now = Date.now()) {
  const record = usage[deviceId]
  if (!record || now - record.windowStartedAt >= WINDOW_MS) {
    return { usage, record: { windowStartedAt: now, usedMs: 0 }, remainingMs: ALLOWANCE_MS }
  }
  return { usage, record: { ...record }, remainingMs: ALLOWANCE_MS - record.usedMs }
}
export function signDeviceId(id, secret) {
  if (!uuid.test(id)) fail()
  return `${id}.${crypto.createHmac('sha256', secret).update(id).digest('base64url')}`
}
export function verifyDeviceCookie(value, secret) {
  if (typeof value !== 'string') return null
  const separator = value.lastIndexOf('.'), id = value.slice(0, separator)
  if (separator < 1 || !uuid.test(id)) return null
  const expected = Buffer.from(signDeviceId(id, secret)), actual = Buffer.from(value)
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected) ? id : null
}
