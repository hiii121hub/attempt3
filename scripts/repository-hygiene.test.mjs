import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const root = fileURLToPath(new URL('../', import.meta.url))
const read = name => fs.readFileSync(path.join(root, name), 'utf8')

test('root verification runs offline suites once, including backend regressions', () => {
  const { scripts } = JSON.parse(read('package.json'))
  assert.match(scripts.test, /test:backend/)
  assert.match(scripts.test, /workspace frontend -- --run/)
  assert.match(scripts.test, /workspace worker -- --run/)
  assert.match(scripts['test:backend'], /scripts\/\*\.test\.mjs/)
  assert.match(scripts['test:backend'], /deploy\/isolation\/\*\.test\.mjs/)
  assert.match(scripts['test:backend'], /scripts\/load-test\/\*\.test\.mjs/)
})

test('worker checks TypeScript without generating shadow source or duplicate tests', () => {
  assert.equal(JSON.parse(read('worker/tsconfig.json')).compilerOptions.noEmit, true)
  for (const directory of ['worker/src', 'worker/src/__tests__']) {
    for (const file of fs.readdirSync(path.join(root, directory))) {
      if (file.endsWith('.ts')) {
        assert.equal(fs.existsSync(path.join(root, directory, file.replace(/\.ts$/, '.js'))), false, file)
      }
    }
  }
  assert.ok(fs.existsSync(path.join(root, 'worker/src/__tests__/index.test.js')))
  assert.match(read('worker/wrangler.toml'), /main = "src\/index.ts"/)
})

for (const file of ['scripts/audio-server.mjs', 'scripts/start-remote-browser.sh', 'scripts/stop-remote-browser.sh']) {
  test(`unsafe historical entrypoint refuses before any side effects: ${file}`, () => {
    // Assert the guard before execution: a future regression must never launch
    // the legacy service or run its broad cleanup merely to test its rejection.
    const source = read(file)
    if (file.endsWith('.mjs')) {
      assert.ok(source.indexOf('throw new Error(') < source.indexOf('new WebSocketServer('))
    } else {
      assert.match(source, /^#![^\n]+\necho '[^\n]+disabled[^\n]+' >&2\nexit 1\n/)
    }
    const child = spawnSync(file.endsWith('.mjs') ? process.execPath : 'bash', [path.join(root, file)], { encoding: 'utf8', timeout: 3000 })
    assert.equal(child.error, undefined)
    assert.equal(child.status, 1)
    assert.match(child.stderr, /[Ll]egacy .*disabled/)
    assert.doesNotMatch(child.stdout, /listening|Starting|Stopping|Killing/)
  })
}

test('new handoff documentation has no broken local Markdown links', () => {
  for (const name of ['README.md', 'CONTRIBUTING.md', 'SECURITY.md', 'THIRD_PARTY_NOTICES.md', 'deploy/INDEX.md', 'deploy/TROUBLESHOOTING.md', 'deploy/CLEANUP-REPORT.md']) {
    for (const [, target] of read(name).matchAll(/\]\(([^)]+)\)/g)) {
      if (/^https?:/.test(target) || target.startsWith('#')) continue
      assert.ok(fs.existsSync(path.resolve(root, path.dirname(name), target.split('#')[0])), `${name}: ${target}`)
    }
  }
})

test('static distribution retains required third-party notices', () => {
  assert.match(read('frontend/public/LICENSE.txt'), /MPL-2\.0/)
  assert.match(read('frontend/public/licenses/MPL-2.0.txt'), /Mozilla Public License/)
  assert.match(read('frontend/public/vendor/pako/LICENSE'), /Vitaly Puzrin/)
})
