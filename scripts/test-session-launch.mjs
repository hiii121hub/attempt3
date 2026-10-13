// Opt-in integration test: creates five real Chrome sessions on an idle local backend.
// Uses the exact frontend retry helper, never prints bearer tokens, ends only its sessions.
import fs from 'node:fs'
import ts from 'typescript'
import assert from 'node:assert/strict'
import { WebSocket } from 'ws'

const base = 'http://127.0.0.1:3997'
const health = await (await fetch(`${base}/health`)).json()
assert.equal(health.sessions, 0, 'Run only when the backend has no active users')
const source = fs.readFileSync(new URL('../frontend/src/sessionLaunch.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText
const { requestSession } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`)
const sessions = []
const started = Date.now()
const nativeFetch = globalThis.fetch
let busyResponses = 0
globalThis.fetch = async (...args) => {
  const response = await nativeFetch(...args)
  if (response.status === 429) busyResponses++
  return response
}
const controllers = Array.from({ length: 5 }, () => new AbortController())
function probe(path, expectOpen) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(`ws://127.0.0.1:3997${path}`)
    let done = false
    const finish = (error, value) => {
      if (done) return
      done = true
      clearTimeout(timer)
      socket.terminate()
      error ? reject(error) : resolve(value)
    }
    const timer = setTimeout(() => finish(new Error('WebSocket probe timed out')), 5000)
    socket.on('open', () => { if (!expectOpen) finish(new Error('Invalid token accepted')) })
    socket.on('message', data => finish(expectOpen ? null : new Error('Invalid token received data'), data.length))
    socket.on('error', () => finish(expectOpen ? new Error('Valid token rejected') : null, 'rejected'))
    socket.on('close', () => { if (!done) finish(expectOpen ? new Error('Stream closed before data') : null, 'rejected') })
  })
}
try {
  const outcomes = await Promise.allSettled(controllers.map(async (controller, client) => {
    const { response, data } = await requestSession(`${base}/session/create`, controller.signal)
    assert.equal(response.status, 201)
    assert.ok(data.token)
    sessions.push(data)
    console.log(JSON.stringify({ client: client + 1, status: response.status, elapsedMs: Date.now() - started, id: data.id, remainingMs: data.remainingMs }))
  }))
  for (const outcome of outcomes) if (outcome.status === 'rejected') throw outcome.reason
  assert.equal(new Set(sessions.map(s => s.token)).size, 5)
  assert.equal(new Set(sessions.map(s => s.id)).size, 5)
  assert.equal((await (await nativeFetch(`${base}/health`)).json()).sessions, 5)
  for (const path of ['/audio', '/websockify']) {
    assert.equal(await probe(`${path}?token=invalid-test-token`, false), 'rejected')
    for (const session of sessions) assert.ok(await probe(`${path}?token=${encodeURIComponent(session.token)}`, true))
    console.log(`${path}: five valid tokens received bytes; invalid token rejected`)
  }
  console.log(JSON.stringify({ created: sessions.length, busyResponses, elapsedMs: Date.now() - started, note: 'API and stream handshake test only; not connected frontend viewers or audible playback' }))
} finally {
  controllers.forEach(controller => controller.abort())
  globalThis.fetch = nativeFetch
  for (const session of sessions) {
    const response = await nativeFetch(`${base}/session/end`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: session.token }),
    })
    console.log(JSON.stringify({ ended: session.id, status: response.status }))
  }
  console.log('Final health:', await (await nativeFetch(`${base}/health`)).text())
}
