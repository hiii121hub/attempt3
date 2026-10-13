import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { startupResources } from './startup-resources.mjs'

function fixture() {
  const calls = []
  const owner = startupResources({
    killTree: (child, signal) => calls.push([child.name, signal]),
    isAlive: child => child.alive,
    removeSink: id => calls.push(['sink', id]),
    removeDirectory: dir => calls.push(['directory', dir]),
    wait: async ms => calls.push(['wait', ms]),
  })
  return { calls, owner }
}
for (const stage of ['XVFB_FAILED', 'CHROME_FAILED', 'CHROME_WINDOW_NOT_FOUND', 'CHROME_RESIZE_FAILED', 'VNC_FAILED', 'VNC_NOT_READY', 'UNEXPECTED_EXCEPTION']) {
  test(`${stage} rollback releases exactly the resources created by that attempt`, async () => {
    const { owner, calls } = fixture()
    owner.directory('/test/session-a')
    owner.child({ name: 'xvfb', alive: false })
    if (stage !== 'XVFB_FAILED') {
      owner.sink({ moduleId: '42' })
      owner.child({ name: 'chrome', alive: true })
    }
    if (stage.startsWith('VNC_')) owner.child({ name: 'vnc', alive: true })
    await owner.rollback()
    assert.equal(calls.filter(x => x[0] === 'sink').length, stage === 'XVFB_FAILED' ? 0 : 1)
    assert.deepEqual(calls.at(-1), ['directory', '/test/session-a'])
    assert.ok(!calls.some(([name, signal]) => name === 'xvfb' && signal === 'SIGKILL'))
    if (stage !== 'XVFB_FAILED') assert.ok(calls.some(([name, signal]) => name === 'chrome' && signal === 'SIGKILL'))
    const first = structuredClone(calls)
    await Promise.all([owner.rollback(), owner.rollback()])
    assert.deepEqual(calls, first)
  })
}
test('successful publication transfers ownership and rollback leaves the active session intact', async () => {
  const { owner, calls } = fixture()
  owner.directory('/test/session')
  owner.child({ name: 'chrome', alive: true })
  owner.sink({ moduleId: '42' })
  owner.commit()
  await owner.rollback()
  assert.deepEqual(calls, [])
})
test('rollback continues after cleanup errors and reports all failures', async () => {
  const attempts = []
  const owner = startupResources({
    killTree: (_, signal) => { attempts.push(signal); throw new Error(signal) },
    isAlive: () => true,
    wait: async () => {},
    removeSink: () => { attempts.push('sink'); throw new Error('sink') },
    removeDirectory: () => attempts.push('directory'),
  })
  owner.child({})
  owner.sink({ moduleId: '42' })
  owner.directory('/test/session')
  await assert.rejects(owner.rollback(), error => error instanceof AggregateError && error.errors.length === 3)
  assert.deepEqual(attempts, ['SIGTERM', 'SIGKILL', 'sink', 'directory'])
})
test('a failed attempt deletes its real profile but preserves the usage ledger and another profile', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'poxey-rollback-test-'))
  try {
    const owned = path.join(root, 'session-a')
    const other = path.join(root, 'session-b')
    fs.mkdirSync(owned); fs.mkdirSync(other)
    fs.writeFileSync(path.join(owned, 'profile'), 'test profile')
    fs.writeFileSync(path.join(root, 'poxey-free-usage.json'), '{"usage":123}')
    const owner = startupResources({ killTree() {}, isAlive: () => false, removeSink() {}, wait: async () => {}, removeDirectory: dir => fs.rmSync(dir, { recursive: true }) })
    owner.directory(owned)
    await owner.rollback()
    assert.equal(fs.existsSync(owned), false)
    assert.equal(fs.existsSync(other), true)
    assert.equal(fs.readFileSync(path.join(root, 'poxey-free-usage.json'), 'utf8'), '{"usage":123}')
  } finally { fs.rmSync(root, { recursive: true, force: true }) }
})
test('rollback terminates a real owned child process', async () => {
  const child = spawn(process.execPath, ['-e', 'process.stdout.write("ready"); setInterval(()=>{},1000)'], { stdio: ['ignore', 'pipe', 'ignore'] })
  try {
    await once(child.stdout, 'data')
    const exited = once(child, 'exit')
    const owner = startupResources({ killTree: (process, signal) => process.kill(signal), isAlive: process => process.exitCode === null && process.signalCode === null, removeSink() {}, removeDirectory() {}, wait: ms => new Promise(resolve => setTimeout(resolve, ms)) })
    owner.child(child)
    await owner.rollback()
    const [, signal] = await exited
    assert.equal(signal, 'SIGTERM')
  } finally { if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL') }
})
