import test from 'node:test'
import assert from 'node:assert/strict'
import { fiveUserRun } from './runner.mjs'
function fixture(options = {}) {
  let time = 0, cleanupCount = 0, closed = 0, checks = 0, negatives = 0, createCount = 0
  const clients = Array.from({ length: 6 }, (_, i) => ({ index: i, cookie: `secret-cookie-${i}` })), active = new Set()
  const config = { durationSeconds: 15, clients, now: () => time, wait: async ms => { time += Math.max(0, ms) },
    create: async client => {
      createCount++
      if (options.busy && createCount === 1) return { status: 429, data: { error: 'SESSION_CREATION_BUSY' } }
      if (options.failOne && client.index === 2) return { status: 500, data: {} }
      if (client.index === 5 && !options.sixthAccepted) return { status: 429, data: { error: 'MAX_SESSIONS' } }
      active.add(client.index)
      return { status: 201, data: { id: options.duplicates ? 'same' : `session-${client.index}`, token: `secret-token-${client.index}` } }
    },
    heartbeat: async () => ({ status: options.heartbeatFailure ? 401 : 200, data: { remainingMs: options.lowAllowance ? 100 : 1500000 } }),
    open: async ({ rejectOnly }) => {
      if (rejectOnly) { negatives++; if (options.authFailure) throw new Error('cross owner accepted'); return }
      return { check: async () => { checks++; if (options.streamFailure) throw new Error('lost stream') }, summary: () => ({ vncBytes: checks * 100, audioBytes: checks * 50, rfbFrames: checks }), close: () => { closed++ } }
    },
    sample: async () => ({ cpuPercent: options.cpuPressure ? 99 : 10, memoryAvailableMiB: options.memoryPressure ? 100 : 4096, memoryUsedFraction: 0.5, oomEvents: options.oom ? 1 : 0 }),
    cleanup: async owned => { cleanupCount = owned.length; active.clear(); if (options.cleanupFailure) throw new Error('unverified') },
  }
  return { config, state: () => ({ cleanupCount, closed, checks, negatives, createCount, active: active.size }) }
}
test('five independent simulated transport clients sustain, reject sixth and clean up; not Chrome evidence', async () => {
  const f = fixture({ busy: true }), report = await fiveUserRun(f.config)
  assert.equal(report.result, 'PASS'); assert.equal(report.sustainedSeconds, 15)
  assert.equal(report.humanAcceptance, 'NOT VERIFIED'); assert.equal(report.fileIsolation, 'NOT VERIFIED')
  assert.equal(report.sixthRejected, true); assert.equal(report.cleanupVerified, true)
  assert.equal(report.streams[0].sustainedVncBytes, 1500)
  assert.deepEqual(f.state(), { cleanupCount: 5, closed: 5, checks: 15, negatives: 4, createCount: 7, active: 0 })
  assert.doesNotMatch(JSON.stringify(report), /secret-token|secret-cookie|session-/)
})
for (const option of ['failOne', 'duplicates', 'sixthAccepted', 'heartbeatFailure', 'lowAllowance', 'authFailure', 'streamFailure', 'cpuPressure', 'memoryPressure', 'oom', 'cleanupFailure']) {
  test(`${option} causes a failed report while attempting owned cleanup`, async () => {
    const f = fixture({ [option]: true }), report = await fiveUserRun(f.config)
    assert.equal(report.result, 'FAIL'); assert.equal(f.state().active, 0)
    assert.equal(f.state().cleanupCount, option === 'failOne' ? 4 : option === 'sixthAccepted' ? 6 : 5)
    assert.equal(report.cleanupVerified, option !== 'cleanupFailure')
  })
}
test('operator cancellation aborts before creating anything and still runs cleanup', async () => {
  const f = fixture(), abort = new AbortController(); abort.abort()
  const report = await fiveUserRun({ ...f.config, signal: abort.signal })
  assert.equal(report.result, 'FAIL'); assert.equal(f.state().createCount, 0); assert.equal(report.cleanupVerified, true)
})
