import test, { after } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { prepareRecovery as prepare, activateRecovery as activate, names, WINDOW_MS } from './accounting-state.mjs'

const prepareRecovery = (dir, bytes, options) => prepare(dir, bytes, { uptimeMs: 0, ...options })
const activateRecovery = (dir, options) => activate(dir, { uptimeMs: WINDOW_MS, ...options })

const project = path.resolve(new URL('..', import.meta.url).pathname)
const root = fs.mkdtempSync(path.join(path.dirname(project), '.poxey-startup-test-'))
after(() => fs.rmSync(root, { recursive: true, force: true }))
const now = Date.now(), bootId = 'isolated-startup-test'
let sequence = 0
for (const failure of ['uninitialized', 'blocked', 'key', 'ledger', 'corrupt', 'permissions']) {
  test(`real manager refuses ${failure} accounting before exposing a listener`, () => {
    const dir = path.join(root, String(++sequence))
    if (failure !== 'uninitialized') {
      prepareRecovery(dir, '{}', { now: now - 2 * WINDOW_MS, bootId })
      if (failure !== 'blocked') activateRecovery(dir, { now: now - WINDOW_MS, bootId, quiescent: true })
      if (['key', 'ledger'].includes(failure)) fs.unlinkSync(path.join(dir, names[failure]))
      if (failure === 'corrupt') fs.writeFileSync(path.join(dir, names.ledger), '{')
      if (failure === 'permissions') fs.chmodSync(path.join(dir, names.key), 0o644)
    }
    const before = fs.existsSync(dir) ? fs.readdirSync(dir).sort() : null
    const result = spawnSync(process.execPath, [path.join(project, 'scripts/poxey-session-manager.mjs')], {
      cwd: project, env: { PATH: process.env.PATH, HOME: process.env.HOME, NODE_ENV: 'development', POXEY_STATE_DIR: dir },
      encoding: 'utf8', timeout: 5000,
    })
    assert.equal(result.error, undefined)
    assert.notEqual(result.status, 0)
    assert.match(result.stderr, /IDENTITY_STATE_BLOCKED/)
    assert.doesNotMatch(result.stdout, /Manager listening/)
    assert.deepEqual(fs.existsSync(dir) ? fs.readdirSync(dir).sort() : null, before)
  })
}
test('normal development startup refuses blocked state before starting PulseAudio or Vite', () => {
  const dir = path.join(root, String(++sequence))
  prepareRecovery(dir, '{}', { now, bootId })
  const result = spawnSync('bash', ['scripts/start-project.sh'], {
    cwd: project, env: { PATH: process.env.PATH, HOME: process.env.HOME, POXEY_STATE_DIR: dir }, encoding: 'utf8', timeout: 5000,
  })
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /IDENTITY_STATE_BLOCKED/)
  assert.doesNotMatch(result.stdout + result.stderr, /Starting session manager|VITE v|PulseAudio tools/)
})
