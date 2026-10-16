import test, { after } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { resetUnusedDevelopmentState as reset, openAccountingState, names } from './accounting-state.mjs'

const parent = path.resolve(new URL('../..', import.meta.url).pathname)
const root = fs.mkdtempSync(path.join(parent, '.poxey-owner-reset-test-'))
fs.chmodSync(root, 0o700)
after(() => fs.rmSync(root, { recursive: true, force: true }))
let sequence = 0
const target = () => path.join(root, String(++sequence))
const options = { confirmation: 'RESET-UNUSED-DEVELOPMENT-ALLOWANCES', production: false,
  quiescent: true, bootId: 'synthetic-idle-host' }
for (const change of [{ production: true }, { confirmation: '' }, { quiescent: false }, { bootId: '' }]) {
  test(`rejects unsafe reset ${Object.keys(change)[0]}`, () => {
    const dir = target()
    assert.throws(() => reset(dir, { ...options, ...change }))
    assert.equal(fs.existsSync(dir), false)
  })
}
test('explicit reset initializes private signed state that survives reopening', () => {
  const dir = target()
  assert.equal(reset(dir, options).allowancesReset, true)
  const store = openAccountingState(dir)
  assert.deepEqual(store.load(), {})
  assert.equal(store.secret, openAccountingState(dir).secret)
  assert.equal(fs.statSync(dir).mode & 0o777, 0o700)
  for (const name of Object.values(names)) assert.equal(fs.statSync(path.join(dir, name)).mode & 0o777, 0o600)
})
test('all old records, damaged state and unrelated files survive exact backup', () => {
  const dir = target()
  fs.mkdirSync(dir, { mode: 0o700 })
  const bytes = Buffer.from('preserve damaged state verbatim')
  fs.writeFileSync(path.join(dir, names.ledger), bytes, { mode: 0o600 })
  fs.writeFileSync(path.join(dir, 'operator-note'), 'preserve me')
  const result = reset(dir, options)
  assert.deepEqual(fs.readFileSync(path.join(result.backup, names.ledger)), bytes)
  assert.equal(fs.readFileSync(path.join(result.backup, 'operator-note'), 'utf8'), 'preserve me')
  assert.deepEqual(openAccountingState(dir).load(), {})
})
test('interruption after backup cannot silently enable startup or lose original data', () => {
  const dir = target()
  reset(dir, options)
  const before = fs.readFileSync(path.join(dir, names.key))
  assert.throws(() => reset(dir, { ...options, checkpoint(step) {
    if (step === 'after-backup') throw Error('synthetic interruption')
  } }))
  assert.throws(() => openAccountingState(dir))
  const backup = fs.readdirSync(root).find(name => name.startsWith(path.basename(dir) + '.owner-backup-'))
  assert.deepEqual(fs.readFileSync(path.join(root, backup, names.key)), before)
})
test('unsafe existing directory is rejected before backup or replacement', () => {
  const dir = target()
  fs.mkdirSync(dir, { mode: 0o755 })
  assert.throws(() => reset(dir, options))
  assert.equal(fs.statSync(dir).mode & 0o777, 0o755)
})
