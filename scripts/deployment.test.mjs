import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { spawnSync } from 'node:child_process'
const read = name => fs.readFileSync(new URL(`../${name}`, import.meta.url), 'utf8')

// Static regression guards, not a replacement for Linux/Caddy runtime validation.
test('backend runtime dependency survives production-only installation', () => {
  const manifest = JSON.parse(read('package.json'))
  const lock = JSON.parse(read('package-lock.json'))
  assert.equal(manifest.dependencies.ws, lock.packages['node_modules/ws'].version)
  assert.notEqual(lock.packages['node_modules/ws'].dev, true)
  assert.equal(lock.packages['node_modules/source-map-js'].version, '1.2.2')
})
test('production proxy retains session rewrite and unchanged VNC/audio paths on loopback', () => {
  const proxy = read('deploy/Caddyfile')
  assert.match(proxy, /handle_path \/__poxey_session\/\*/)
  assert.match(proxy, /@streams path \/websockify \/audio/)
  assert.equal((proxy.match(/reverse_proxy 127\.0\.0\.1:3997/g) || []).length, 2)
  assert.match(proxy, /bind \{\$POXEY_BIND:127\.0\.0\.1\}/)
  assert.match(proxy, /file_server/)
  assert.match(proxy, /admin off/)
  assert.match(proxy, /auto_https disable_redirects/)
  assert.equal((proxy.match(/bind \{\$POXEY_BIND:127\.0\.0\.1\}/g) || []).length, 2)
  assert.doesNotMatch(proxy, /3999|vite|tls_insecure_skip_verify/)
  assert.match(proxy, /wss:\/\/\{\$POXEY_HOSTNAME\}/)
})
test('systemd stops the complete process group and separates private runtime from persistent state', () => {
  const unit = read('deploy/poxey.service')
  for (const setting of ['User=poxey', 'KillMode=control-group', 'PrivateTmp=true', 'ProtectSystem=strict', 'ProtectHome=true', 'NoNewPrivileges=true', 'StateDirectory=poxey', 'Restart=on-failure']) assert.ok(unit.includes(setting))
  assert.doesNotMatch(unit, /ExecStart=.*vite|RestrictNamespaces=true/)
})
test('production startup shell syntax is valid and sandbox failures have no fallback', () => {
  assert.equal(spawnSync('bash', ['-n', new URL('./start-production.sh', import.meta.url).pathname]).status, 0)
  const startup = read('scripts/start-production.sh')
  assert.match(startup, /unshare --user --map-root-user true \|\|/)
  assert.match(startup, /exec node scripts\/poxey-session-manager.mjs/)
  assert.doesNotMatch(startup, /npm run dev/)
})
test('session handler wiring preserves timer, sizes, loopback, and uses security checks', () => {
  const manager = read('scripts/poxey-session-manager.mjs')
  for (const constant of ["const HOST = '127.0.0.1'", 'const PORT = 3997', 'const BASE_WIDTH = 1024', 'const BASE_HEIGHT = 700', 'const FREE_DAILY_ALLOWANCE_MS = 25 * 60 * 1000', 'const FREE_ALLOWANCE_WINDOW_MS = 24 * 60 * 60 * 1000']) assert.ok(manager.includes(constant))
  assert.equal((manager.match(/authorizedSession\(req, body.token\)/g) || []).length, 3)
  assert.match(manager, /resolve\(parseSessionBody\(body\)\)/)
  assert.match(manager, /websocketAllowed\(req, runtimeConfig/)
  assert.match(manager, /runtimeConfig.production \|\| forwardedProto === 'https'/)
  assert.match(manager, /runtimeConfig.production\) throw new Error\('Usage ledger unavailable/)
})
test('capacity covers startup, active and cleanup resources and shutdown awaits cleanup', () => {
  const manager = read('scripts/poxey-session-manager.mjs')
  assert.match(manager, /capacitySlot = capacity.reserve\(\)/)
  assert.match(manager, /if \(!published && rollbackComplete\) capacitySlot\?\.release\(\)/)
  assert.match(manager, /session.capacitySlot.release\(\)/)
  assert.match(manager, /occupiedSlots: capacity.occupied/)
  assert.match(manager, /Promise.all\(\[\.\.\.pendingCleanup\]\)/)
  assert.match(manager, /if \(bookkeepingFailed\) throw/)
  assert.equal((manager.match(/\.\.\.sessions.values\(\), \.\.\.retiringSessions/g) || []).length, 2)
  assert.doesNotMatch(manager, /sessions.size >= MAX_SESSIONS|!child.killed/)
})
test('session audio readiness and owned captures use existing authorized route and teardown', () => {
  const manager = read('scripts/poxey-session-manager.mjs')
  assert.match(manager, /createSessionSink\(id, \{ run: spawnSync, env: pulseEnvironment\(\), own: sink => startup.sink\(sink\) \}\)/)
  assert.match(manager, /startAudioCapture\(\{ client, session, spawn, env: pulseEnvironment\(\)/)
  assert.match(manager, /\.\.\.\(session.audioCaptures \|\| \[\]\)/)
  assert.doesNotMatch(manager, /return \{ name: null, moduleId: null \}/)
})
