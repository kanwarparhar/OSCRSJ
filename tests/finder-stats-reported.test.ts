// Finder v2 — the stats_reported methods-boilerplate gate (2026-07-26).
//
// THE DEFECT THESE TESTS PIN SHUT. A live run on 2026-07-25 against a
// pilon-fracture manuscript returned stats_reported = true on the sentence
// "Statistical significance was set at a p-value of <0.05" — an alpha threshold,
// not a result, and a sentence very nearly every manuscript contains.
//
// It was not cosmetic. A spurious `true` suppresses deriveTextAdjustment's -0.10
// comparative-without-stats penalty AND silences deriveDisagreements' strength
// warning, so a manuscript's own methods boilerplate muted the one line most
// worth reading — on exactly the papers least entitled to the benefit of the
// doubt.
//
// The contract:
//   1. A threshold, a test list or a software name is NOT a reported result.
//   2. Boilerplate flips the field to FALSE, never to null. null means "unknown"
//      and would go on suppressing the penalty — that IS the bug.
//   3. The quote is KEPT, so the author can see which sentence we read.
//   4. The downstream penalty and the strength disagreement actually fire again.

import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  METHODS_BOILERPLATE,
  REPORTED_RESULT,
  deriveDisagreements,
  deriveTextAdjustment,
  fieldsFromRaw,
  gateStatsReported,
} from '@/lib/finder/assess'

/** The exact sentence from the 2026-07-25 live run. */
const PILON_QUOTE = 'Statistical significance was set at a p-value of <0.05'

const REAL_RESULT = 'The deep infection rate was higher in the delayed group, 24% vs 9%, p = 0.03'

const field = (value: boolean | null, quote: string | null) => ({
  value,
  quote,
  confidence: 'high' as const,
})

/* -------------------------------------------------------------------------- */
/* The two named cases from the brief                                          */
/* -------------------------------------------------------------------------- */

test('the pilon threshold sentence is NOT a reported result', () => {
  const gated = gateStatsReported(field(true, PILON_QUOTE))
  assert.equal(gated.value, false)
  // false, not null — null would go on suppressing the penalty.
  assert.notEqual(gated.value, null)
  // and the author still sees which sentence we judged.
  assert.equal(gated.quote, PILON_QUOTE)
})

test('a P value on a specific comparison IS a reported result', () => {
  const gated = gateStatsReported(field(true, REAL_RESULT))
  assert.equal(gated.value, true)
  assert.equal(gated.quote, REAL_RESULT)
})

/* -------------------------------------------------------------------------- */
/* The boundary, in both directions                                            */
/* -------------------------------------------------------------------------- */

test('methods boilerplate of every common shape is rejected', () => {
  const boilerplate = [
    PILON_QUOTE,
    'Statistical significance was set at p < 0.05 for all comparisons',
    'P values less than 0.05 were considered statistically significant',
    'A p-value of less than 0.05 was deemed significant',
    'The level of significance was 0.05',
    'Alpha was set at 0.05 for all two-tailed tests',
    'All analyses were performed using SPSS version 26.0',
    'Statistical analysis was conducted using Stata 17',
    'Continuous variables were compared with the Student t-test and categorical variables with the chi-square test, and significance was defined as p<0.05',
  ]
  for (const quote of boilerplate) {
    assert.equal(gateStatsReported(field(true, quote)).value, false, `should be false: ${quote}`)
  }
})

test('genuine inferential results of every common shape survive', () => {
  const results = [
    REAL_RESULT,
    'Union was achieved in 92% of the treated group versus 71% of controls (p = 0.008)',
    'Mortality was lower in the intervention arm (p < 0.001)',
    'The mean difference in Constant score was 4.2 points (95% CI 1.1 to 7.3)',
    'The odds ratio for reoperation was 2.4 (95% confidence interval 1.3-4.5)',
    'Adjusted HR: 1.8 for the revision cohort',
  ]
  for (const quote of results) {
    assert.equal(gateStatsReported(field(true, quote)).value, true, `should be true: ${quote}`)
  }
})

test('a quote carrying BOTH a threshold and a result reads as false', () => {
  // Veto beats match, deliberately. This product leans toward telling an author
  // something may be missing rather than toward telling them it is fine.
  const mixed = 'Significance was set at p<0.05; the infection rate differed between groups, p = 0.02'
  assert.equal(gateStatsReported(field(true, mixed)).value, false)
})

test('the gate only ever touches a true — it never invents or erases one', () => {
  // Genuinely unknown stays unknown.
  assert.equal(gateStatsReported(field(null, null)).value, null)
  // An explicit false stays false, quote intact.
  const alreadyFalse = gateStatsReported(field(false, PILON_QUOTE))
  assert.equal(alreadyFalse.value, false)
  assert.equal(alreadyFalse.quote, PILON_QUOTE)
  // A true with no quote never reached the gate as a value (acceptField drops
  // it first), but the gate must not crash or upgrade it if it does.
  assert.equal(gateStatsReported(field(true, null)).value, true)
})

test('the two regexes are independently correct', () => {
  assert.ok(METHODS_BOILERPLATE.test(PILON_QUOTE))
  assert.ok(!METHODS_BOILERPLATE.test(REAL_RESULT))
  assert.ok(REPORTED_RESULT.test(REAL_RESULT))
  assert.ok(!REPORTED_RESULT.test('We recorded union, infection and reoperation as outcomes'))
})

test('the regexes are stateless across repeated calls', () => {
  // A stray /g flag would make every second .test() lie. Cheap to prove.
  for (let i = 0; i < 4; i++) {
    assert.equal(METHODS_BOILERPLATE.test(PILON_QUOTE), true)
    assert.equal(REPORTED_RESULT.test(REAL_RESULT), true)
  }
})

/* -------------------------------------------------------------------------- */
/* Wired into extraction, and the downstream effects that were being muted     */
/* -------------------------------------------------------------------------- */

test('extraction applies the gate after quote verification', () => {
  const body = `Methods. ${PILON_QUOTE}. Results. Union occurred in most patients.`
  const fields = fieldsFromRaw(
    { stats_reported: { value: true, quote: PILON_QUOTE, confidence: 'high' } },
    body,
  )
  assert.equal(fields.statsReported.value, false)
  assert.equal(fields.statsReported.quote, PILON_QUOTE)
})

test('a quote that is verbatim AND a real result survives extraction', () => {
  const body = `Results. ${REAL_RESULT}. Discussion follows.`
  const fields = fieldsFromRaw(
    { stats_reported: { value: true, quote: REAL_RESULT, confidence: 'high' } },
    body,
  )
  assert.equal(fields.statsReported.value, true)
})

test('an unverifiable quote is still dropped before the gate ever sees it', () => {
  const fields = fieldsFromRaw(
    { stats_reported: { value: true, quote: 'a sentence this manuscript does not contain', confidence: 'high' } },
    'The manuscript body says something else entirely.',
  )
  assert.equal(fields.statsReported.value, null)
  assert.equal(fields.statsReported.quoteRejected, true)
})

test('the comparative-without-stats penalty fires again once the gate flips it', () => {
  const base = {
    design: 'retrospective_comparative' as const,
    sampleSize: null,
    multicenter: null,
    comparative: true,
    followUpMonths: null,
    noveltyQuote: null,
  }
  // What the defect produced: boilerplate read as a result, penalty suppressed.
  assert.equal(deriveTextAdjustment({ ...base, statsReported: true }), 0)
  // What the gate restores.
  assert.equal(deriveTextAdjustment({ ...base, statsReported: false }), -0.1)
})

test('the strength disagreement is heard again once the gate flips it', () => {
  const sa = {
    novelty: null,
    strength: 'definitive_or_comparative' as const,
    priorities: [],
  }
  assert.deepEqual(deriveDisagreements(sa, null, true), [])
  assert.deepEqual(deriveDisagreements(sa, null, false), ['strength'])
})
