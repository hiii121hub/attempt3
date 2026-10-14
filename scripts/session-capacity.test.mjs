import test from 'node:test'
import assert from 'node:assert/strict'
import { sessionCapacity } from './session-capacity.mjs'

test('five reservations reject a sixth without disrupting existing leases', () => {
  const capacity = sessionCapacity(5)
  const users = Array.from({ length: 5 }, () => capacity.reserve())
  assert.ok(users.every(Boolean))
  assert.equal(capacity.occupied, 5)
  assert.equal(capacity.reserve(), null)
  assert.equal(capacity.occupied, 5)
  users[2].release()
  assert.ok(capacity.reserve())
  assert.equal(capacity.occupied, 5)
})
test('one hundred concurrent launch attempts cannot oversubscribe five slots', async () => {
  const capacity = sessionCapacity(5)
  const leases = await Promise.all(Array.from({ length: 100 }, async () => {
    await Promise.resolve()
    return capacity.reserve()
  }))
  assert.equal(leases.filter(Boolean).length, 5)
  assert.equal(capacity.occupied, 5)
})
test('release is idempotent and an old lease cannot free a new or unrelated slot', () => {
  const a = sessionCapacity(1), b = sessionCapacity(1)
  const old = a.reserve(), other = b.reserve()
  old.release(); assert.ok(a.reserve()); old.release()
  assert.equal(a.reserve(), null)
  assert.equal(b.occupied, 1)
  other.release(); assert.equal(b.occupied, 0)
})
test('a failed start retains its slot during rollback then frees it exactly once', async () => {
  const capacity = sessionCapacity(1)
  const slot = capacity.reserve()
  let finishRollback
  const rollback = new Promise(resolve => { finishRollback = resolve })
  const startup = rollback.then(() => slot.release())
  assert.equal(capacity.reserve(), null)
  finishRollback(); await startup
  assert.equal(capacity.occupied, 0)
  assert.ok(capacity.reserve())
  slot.release(); assert.equal(capacity.occupied, 1)
})
test('an active or ending session retains its slot until cleanup completes', async () => {
  const capacity = sessionCapacity(5)
  const leases = Array.from({ length: 5 }, () => capacity.reserve())
  let finishCleanup
  const cleanup = new Promise(resolve => { finishCleanup = resolve }).then(() => leases[0].release())
  assert.equal(capacity.reserve(), null)
  finishCleanup(); await cleanup
  assert.equal(capacity.occupied, 4)
  assert.ok(capacity.reserve())
})
test('invalid capacity limits cannot silently disable admission', () => {
  for (const limit of [0, -1, 1.1, 101, NaN, Infinity, '5', undefined]) assert.throws(() => sessionCapacity(limit))
})
