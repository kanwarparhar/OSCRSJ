// Finder v2 — author corrections to the extracted profile (2026-07-26).
//
// The contract these tests pin down:
//   1. A corrected field KEEPS its value and LOSES its quote. The product's
//      promise is "here is what your text says"; an author's correction is a
//      different claim and must never be dressed as a quote-verified one.
//   2. An untouched field is untouched — corrections are surgical, not a
//      wholesale re-extraction.
//   3. An explicit null CLEARS a field, and everything derived from it follows.
//   4. Garbage in an edit is IGNORED rather than applied as null, so a bad
//      client cannot silently erase a fact we did verify.
//   5. The anchor stays clamped no matter what an author claims.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { applyProfileEdits, parseProfileEdits, buildEmptyProfile, buildSelfReportedProfile, finalizeProfile } from '@/lib/finder/assess'

const empty = buildEmptyProfile(null, { truncated: false, extractionError: null })

test('extracted field survives when not edited', () => {
  const p = finalizeProfile({
    design: { value: 'retrospective_comparative', quote: 'Design: Retrospective cohort study', confidence: 'high' },
    sampleSize: { value: 124, quote: 'A total of 124 patients', confidence: 'high' },
    multicenter: { value: null, quote: null, confidence: null },
    comparative: { value: true, quote: 'two groups', confidence: 'high' },
    followUpMonths: { value: 10.28, quote: 'mean follow-up was 312.8 days', confidence: 'high' },
    statsReported: { value: true, quote: 'p-value of <0.05', confidence: 'high' },
    noveltyClaim: { value: null, quote: null, confidence: null },
  } as any, null, { selfReported: false, truncated: false, extractionError: null })
  assert.equal(p.evidenceLevel, 3)
  assert.deepEqual(p.authorEditedFields, [])

  const edited = applyProfileEdits(p, { sampleSize: 240, multicenter: true }, null)
  assert.equal(edited.sampleSize.value, 240)
  assert.equal(edited.sampleSize.quote, null, 'an edited field must lose its quote')
  assert.equal(edited.sampleSize.authorEdited, true)
  assert.equal(edited.design.value, 'retrospective_comparative', 'untouched field preserved')
  assert.equal(edited.design.quote, 'Design: Retrospective cohort study')
  assert.deepEqual(edited.authorEditedFields.sort(), ['multicenter', 'sampleSize'])
  // level-3 base 0.50, +0.10 multicenter, +0.10 n>=100, -0.10 for <12mo follow-up
  // on a comparative design. The short-follow-up penalty is the interesting one:
  // it fires on exactly the manuscript in the 2026-07-25 screenshot (10.28 months).
  assert.equal(edited.anchor, 0.6)
})

test('clearing to null erases the value and the quote', () => {
  const p = applyProfileEdits(
    finalizeProfile({
      design: { value: 'rct', quote: 'randomized', confidence: 'high' },
      sampleSize: { value: 50, quote: '50 patients', confidence: 'high' },
      multicenter: { value: false, quote: 'single centre', confidence: 'high' },
      comparative: { value: null, quote: null, confidence: null },
      followUpMonths: { value: null, quote: null, confidence: null },
      statsReported: { value: null, quote: null, confidence: null },
      noveltyClaim: { value: null, quote: null, confidence: null },
    } as any, null, { selfReported: false, truncated: false, extractionError: null }),
    { design: null }, null)
  assert.equal(p.design.value, null)
  assert.equal(p.design.quote, null)
  assert.equal(p.evidenceLevel, null, 'clearing the design clears the derived level')
})

test('unparseable edits are ignored, not applied as null', () => {
  const p = applyProfileEdits(empty, { sampleSize: 'banana', design: 'not_a_design' } as any, null)
  assert.equal(p.sampleSize.value, null)
  assert.equal(p.sampleSize.authorEdited, undefined, 'a rejected edit must not be labelled as an author edit')
  assert.deepEqual(p.authorEditedFields, [])
})

test('parseProfileEdits drops unknown keys and non-scalars', () => {
  const e = parseProfileEdits({ sampleSize: 12, noveltyClaim: 'first ever', evidenceLevel: 1, design: null, junk: {} })
  assert.deepEqual(e, { sampleSize: 12, design: null })
})

test('manual mode: author-stated design drives the level', () => {
  const base = buildSelfReportedProfile('original_research', null)
  assert.equal(base.evidenceLevel, 3)
  const p = applyProfileEdits(base, { design: 'rct', multicenter: true }, null)
  assert.equal(p.evidenceLevel, 1)
  assert.equal(p.selfReported, true, 'manual mode stays labelled self-reported')
})

test('an author edit cannot outrun the clamp', () => {
  const p = applyProfileEdits(
    buildSelfReportedProfile('original_research', { novelty: 'first_reported', strength: 'definitive_or_comparative', priorities: [] }),
    { multicenter: true, sampleSize: 5000, design: 'rct' }, { novelty: 'first_reported', strength: 'definitive_or_comparative', priorities: [] })
  assert.ok(p.anchor <= 0.9, `anchor ${p.anchor} must stay clamped`)
})
