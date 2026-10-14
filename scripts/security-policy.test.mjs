import test from 'node:test'
import assert from 'node:assert/strict'
import { readRuntimeConfig, developmentStateDir, requestAllowed, sessionUsable, childEnvironment, chromeSandboxArgs, websocketAllowed, parseSessionBody, decodeCookie } from './security-policy.mjs'

const env = { NODE_ENV: 'production', POXEY_PUBLIC_ORIGIN: 'https://poxey.example', POXEY_STATE_DIR: '/var/lib/poxey/state' }
const linux = { platform: 'linux', uid: 1001 }
const config = readRuntimeConfig(env, linux)
const req = { headers: { origin: config.origin, 'x-forwarded-proto': 'https' } }
const session = () => ({ deviceId: 'device-a', expiresAt: Date.now() + 60000, audioClients: new Set(), vncClients: new Set() })

test('development retains its cap and Chrome flag but uses persistent accounting', () => {
  const dev = readRuntimeConfig({}, { platform: 'darwin', uid: 0 })
  assert.equal(dev.maxSessions, 100)
  assert.equal(dev.stateDir, developmentStateDir)
  assert.equal(readRuntimeConfig({ POXEY_STATE_DIR: '/workspaces/.poxey-state/test' }).stateDir, '/workspaces/.poxey-state/test')
  assert.deepEqual(chromeSandboxArgs(dev), ['--no-sandbox'])
  assert.equal(requestAllowed({ headers: {} }, dev), true)
})
test('development cannot opt back into temporary or project-contained accounting', () => {
  for (const stateDir of ['/tmp/state', '/private/tmp/state', '/var/tmp/state', new URL('..', import.meta.url).pathname.slice(0, -1)]) {
    assert.throws(() => readRuntimeConfig({ POXEY_STATE_DIR: stateDir }))
  }
})
test('production defaults to one supervised tester and accepts a validated cap of five', () => {
  assert.equal(config.maxSessions, 1)
  assert.equal(readRuntimeConfig({ ...env, POXEY_MAX_SESSIONS: '5' }, linux).maxSessions, 5)
  assert.deepEqual(chromeSandboxArgs(config), [])
})
for (const limit of ['0', '-1', '1.5', '101', 'NaN', '', ' 5', '5x']) {
  test(`rejects invalid maximum ${JSON.stringify(limit)}`, () => {
    assert.throws(() => readRuntimeConfig({ POXEY_MAX_SESSIONS: limit }))
  })
}
for (const runtime of [{ platform: 'linux', uid: 0 }, { platform: 'darwin', uid: 501 }, { platform: 'linux' }]) {
  test(`production refuses unsafe runtime ${JSON.stringify(runtime)}`, () => assert.throws(() => readRuntimeConfig(env, runtime)))
}
for (const origin of ['', 'http://poxey.example', 'https://poxey.example/', 'https://poxey.example/path', 'https://user:secret@poxey.example', 'https://poxey.example?x=1']) {
  test(`rejects unsafe public origin ${JSON.stringify(origin)}`, () => assert.throws(() => readRuntimeConfig({ ...env, POXEY_PUBLIC_ORIGIN: origin }, linux)))
}
for (const stateDir of ['', 'state', '/', '/tmp', '/tmp/state', '/var/lib/poxey/../state']) {
  test(`rejects unsafe persistent directory ${JSON.stringify(stateDir)}`, () => assert.throws(() => readRuntimeConfig({ ...env, POXEY_STATE_DIR: stateDir }, linux)))
}
test('production requires exact configured origin and trusted HTTPS forwarding', () => {
  assert.equal(requestAllowed(req, config), true)
  for (const headers of [{}, { origin: 'null' }, { origin: 'https://evil.example', host: 'poxey.example', 'x-forwarded-proto': 'https' }, { origin: config.origin }, { origin: config.origin, 'x-forwarded-proto': 'http' }, { origin: config.origin, 'x-forwarded-proto': 'https,http' }]) {
    assert.equal(requestAllowed({ headers }, config), false)
  }
})
test('expired and cleaning sessions fail closed at the exact expiry boundary', () => {
  assert.equal(sessionUsable({ expiresAt: 100 }, 99), true)
  assert.equal(sessionUsable({ expiresAt: 100 }, 100), false)
  assert.equal(sessionUsable({ expiresAt: 100, cleaningUp: true }, 99), false)
  assert.equal(sessionUsable(null), false)
})
test('production child processes do not inherit application or cloud secrets', () => {
  const input = { PATH: '/unsafe/bin', HOME: '/var/lib/poxey', LANG: 'en_US.UTF-8', XDG_RUNTIME_DIR: '/run/poxey', PULSE_SERVER: 'unix:/run/poxey/pulse/native', GITHUB_TOKEN: 'secret', AWS_SECRET_ACCESS_KEY: 'secret', POXEY_FREE_COOKIE_SECRET: 'secret', NODE_OPTIONS: '--inspect', LD_PRELOAD: '/unsafe.so' }
  assert.deepEqual(childEnvironment(input, true), { PATH: '/usr/local/bin:/usr/bin:/bin', HOME: input.HOME, LANG: input.LANG, XDG_RUNTIME_DIR: input.XDG_RUNTIME_DIR, PULSE_SERVER: input.PULSE_SERVER })
  assert.deepEqual(childEnvironment(input, false), input)
})
for (const route of ['/audio', '/websockify']) {
  test(`${route} requires the owning device, valid origin, and a live session`, () => {
    assert.equal(websocketAllowed(req, config, session(), 'device-a', route), true)
    assert.equal(websocketAllowed(req, config, session(), 'device-b', route), false)
    assert.equal(websocketAllowed(req, config, session(), null, route), false)
    assert.equal(websocketAllowed({ headers: {} }, config, session(), 'device-a', route), false)
    assert.equal(websocketAllowed(req, config, null, 'device-a', route), false)
    assert.equal(websocketAllowed(req, config, { ...session(), expiresAt: 0 }, 'device-a', route), false)
  })
  test(`${route} bounds reconnect overlap and frees slots when clients disconnect`, () => {
    const current = session()
    const clients = route === '/audio' ? current.audioClients : current.vncClients
    clients.add('one')
    assert.equal(websocketAllowed(req, config, current, 'device-a', route), true)
    clients.add('two')
    assert.equal(websocketAllowed(req, config, current, 'device-a', route), false)
    clients.delete('one')
    assert.equal(websocketAllowed(req, config, current, 'device-a', route), true)
  })
}
test('malformed and non-object JSON cannot reach session handlers', () => {
  for (const body of ['null', '[]', '1', 'true', '"text"', '{']) assert.throws(() => parseSessionBody(body))
  assert.deepEqual(parseSessionBody('{"token":"example"}'), { token: 'example' })
  assert.deepEqual(parseSessionBody(''), {})
})
test('malformed cookie encoding is rejected instead of throwing', () => {
  assert.equal(decodeCookie('%E0%A4%A'), null)
  assert.equal(decodeCookie('a%2Eb'), 'a.b')
})
