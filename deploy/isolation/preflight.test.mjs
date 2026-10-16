import test from 'node:test'
import assert from 'node:assert/strict'
import { evaluateHost } from './preflight.mjs'
const qualified = { platform: 'linux', uid: 1001, podmanMajor: 5, rootless: true, cgroupVersion: 'v2', controllers: ['cpu', 'memory', 'pids'], subuids: 327680, subgids: 327680, userNamespaces: true }
test('qualified Linux prerequisites allow prototyping without asserting isolation', () => {
  assert.equal(Object.values(evaluateHost(qualified)).every(Boolean), true)
})
for (const [name, value] of Object.entries({ platform: 'darwin', uid: 0, podmanMajor: 4, rootless: false, cgroupVersion: 'v1', controllers: ['cpu'], subuids: 65536, subgids: 65536, userNamespaces: false })) {
  test(`missing or unsafe ${name} prevents host qualification`, () => assert.equal(Object.values(evaluateHost({ ...qualified, [name]: value })).every(Boolean), false))
}
test('unknown prerequisite values cannot silently pass', () => {
  assert.equal(Object.values(evaluateHost({})).some(Boolean), false)
})
