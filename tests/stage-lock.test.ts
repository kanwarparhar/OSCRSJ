// Stage-lock pure helpers (2026-07-22, Part C). The CAS write itself is
// service-role Supabase and is exercised by the post-deploy battery (two
// parallel advance calls → one stage execution); these tests pin the pure
// claim-vs-skip decision and the lock-release cursor shape.

import { test } from 'node:test'
import assert from 'node:assert'
import {
  STAGE_LOCK_SECONDS,
  isLockActive,
  stripLock,
} from '../lib/formatting/pipeline/stages'

const NOW = Date.parse('2026-07-22T12:00:00.000Z')

test('isLockActive: no lock → claimable', () => {
  assert.equal(isLockActive(null, NOW), false)
  assert.equal(isLockActive(undefined, NOW), false)
})

test('isLockActive: future lock → skip (another caller is running the stage)', () => {
  const future = new Date(NOW + 30_000).toISOString()
  assert.equal(isLockActive(future, NOW), true)
})

test('isLockActive: expired lock → claimable again (killed-function escape)', () => {
  const past = new Date(NOW - 1_000).toISOString()
  assert.equal(isLockActive(past, NOW), false)
  // exactly at expiry is claimable (strict >)
  const exact = new Date(NOW).toISOString()
  assert.equal(isLockActive(exact, NOW), false)
})

test('isLockActive: unparseable timestamp never wedges the job', () => {
  assert.equal(isLockActive('not-a-date', NOW), false)
})

test('lock duration exceeds the advance route wall clock (60s)', () => {
  // A live function must never lose its own lock mid-stage.
  assert.ok(STAGE_LOCK_SECONDS > 60)
})

test('stripLock: removes the lock, keeps resume progress', () => {
  assert.deepEqual(
    stripLock({ references_verified: 40, references_total: 120, lock_until: 'x' }),
    { references_verified: 40, references_total: 120 },
  )
})

test('stripLock: a lock-only cursor collapses to null', () => {
  assert.equal(stripLock({ lock_until: 'x' }), null)
  assert.equal(stripLock(null), null)
})
