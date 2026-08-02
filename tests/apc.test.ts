// ============================================================
// APC amount logic — unit tests.
//
// This is where the real risk in the payment system lives. Everything
// downstream (Stripe, the webhook, the emails) is plumbing; the
// question of whether a given author owes $399 or $0 is decided here,
// and getting it wrong means billing someone who was promised they
// would never be billed.
// ============================================================

import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  isWithinFreeWindow,
  computeApcCents,
  deriveWaiverFields,
  computeDueDate,
  formatCents,
  ApcAmountError,
} from '../lib/payments/apc'
import { APC_STANDARD_CENTS } from '../lib/payments/constants'

// ---- the boundary ----

test('isWithinFreeWindow: the last instant of July 31 is free', () => {
  assert.equal(isWithinFreeWindow('2026-07-31T23:59:59Z'), true)
})

test('isWithinFreeWindow: midnight August 1 UTC is chargeable', () => {
  assert.equal(isWithinFreeWindow('2026-08-01T00:00:00Z'), false)
})

test('isWithinFreeWindow: null fails safe to free', () => {
  // A missing submission_date must never result in billing a real
  // person. The column is nullable and a never-submitted draft has no
  // date at all.
  assert.equal(isWithinFreeWindow(null), true)
  assert.equal(isWithinFreeWindow(undefined), true)
})

test('isWithinFreeWindow: an unparseable date fails safe to free', () => {
  assert.equal(isWithinFreeWindow('not a date'), true)
})

// ---- THE TRAP CASE ----

test('a July submission accepted in November is still free', () => {
  // The boundary is the SUBMISSION date, not the decision date. This
  // is the bug most likely to actually happen: an editor works through
  // the backlog in the autumn and the system bills a manuscript that
  // was promised the launch-window terms. /publication-agreement makes
  // this promise in writing.
  assert.equal(isWithinFreeWindow('2026-07-20T10:00:00Z'), true)
  assert.equal(computeApcCents('2026-07-20T10:00:00Z'), 0)
})

// ---- amounts ----

test('computeApcCents: outside the window, no override → standard', () => {
  assert.equal(computeApcCents('2026-08-15T00:00:00Z'), APC_STANDARD_CENTS)
})

test('computeApcCents: inside the window returns 0 even with an override', () => {
  // An override must not be able to make a grandfathered manuscript
  // payable. This is a hard rule, not a default.
  assert.equal(computeApcCents('2026-07-01T00:00:00Z', 25_000), 0)
  assert.equal(computeApcCents(null, APC_STANDARD_CENTS), 0)
})

test('computeApcCents: a lower override is honored', () => {
  assert.equal(computeApcCents('2026-09-01T00:00:00Z', 25_000), 25_000)
})

test('computeApcCents: an override above standard throws', () => {
  // Nothing may bill an author more than the rate they accepted at
  // submission.
  assert.throws(
    () => computeApcCents('2026-09-01T00:00:00Z', APC_STANDARD_CENTS + 1),
    ApcAmountError
  )
})

test('computeApcCents: negative and non-integer amounts throw', () => {
  assert.throws(() => computeApcCents('2026-09-01T00:00:00Z', -1), ApcAmountError)
  assert.throws(() => computeApcCents('2026-09-01T00:00:00Z', 100.5), ApcAmountError)
})

test('computeApcCents: an explicit zero outside the window is allowed', () => {
  // The action layer rejects a zero-amount invoice and routes it to
  // recordWaivedApc; the pure function just reports the number.
  assert.equal(computeApcCents('2026-09-01T00:00:00Z', 0), 0)
})

// ---- waiver bookkeeping ----

test('deriveWaiverFields: zero is a full waiver', () => {
  assert.deepEqual(deriveWaiverFields(0), { waiver_type: 'full', waiver_percentage: 100 })
})

test('deriveWaiverFields: the standard amount is no waiver', () => {
  assert.deepEqual(deriveWaiverFields(APC_STANDARD_CENTS), {
    waiver_type: 'none',
    waiver_percentage: 0,
  })
})

test('deriveWaiverFields: half the standard amount is a 50% custom waiver', () => {
  const half = Math.round(APC_STANDARD_CENTS / 2)
  const got = deriveWaiverFields(half)
  assert.equal(got.waiver_type, 'custom')
  assert.equal(got.waiver_percentage, 50)
})

// ---- due dates ----

test('computeDueDate: adds the term in whole UTC days', () => {
  const sent = new Date('2026-08-15T12:00:00Z')
  const due = computeDueDate(sent, 30)
  assert.equal(due.toISOString(), '2026-09-14T12:00:00.000Z')
})

test('computeDueDate: does not mutate its input', () => {
  const sent = new Date('2026-08-15T12:00:00Z')
  computeDueDate(sent, 30)
  assert.equal(sent.toISOString(), '2026-08-15T12:00:00.000Z')
})

test('computeDueDate: crosses a month boundary correctly', () => {
  const due = computeDueDate(new Date('2026-12-20T00:00:00Z'), 30)
  assert.equal(due.toISOString().slice(0, 10), '2027-01-19')
})

// ---- display ----

test('formatCents renders whole dollars with two decimals', () => {
  assert.equal(formatCents(39_900), '$399.00')
  assert.equal(formatCents(0), '$0.00')
})

test('the standard APC is a positive whole number of cents', () => {
  // Guards against a bad edit to lib/apc/config.ts reaching production
  // as a zero-dollar or fractional charge.
  assert.ok(Number.isInteger(APC_STANDARD_CENTS))
  assert.ok(APC_STANDARD_CENTS > 0)
})
