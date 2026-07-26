// Finder v2 — assessment engine tests.
//
// The quote guardrail is the feature. If these tests pass, an LLM that
// paraphrases, embellishes or hallucinates a study characteristic loses the
// field rather than shipping it to an author as a verified fact.
//
// No test here touches the network: the DeepSeek client is injected.

import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  acceptField,
  buildEmptyProfile,
  buildSelfReportedProfile,
  deriveAuthorShift,
  deriveDisagreements,
  deriveEvidenceLevel,
  extractProfile,
  fieldsFromRaw,
  normalizeForQuoteMatch,
  truncateForExtraction,
  verifyQuote,
  HEAD_WORDS,
  TAIL_WORDS,
} from '../lib/finder/assess'
import type { SelfAssessment } from '../lib/finder/profileTypes'

const BODY =
  'We retrospectively reviewed 42 consecutive patients treated at a single institution. ' +
  'Mean follow-up was 18 months. To our knowledge, this is the first reported series of this technique.'

/* ------------------------------ the guardrail ------------------------------ */

test('a fabricated quote nulls the field and is disclosed as rejected', () => {
  const f = acceptField<number>(
    { value: 42, quote: 'We prospectively enrolled 42 patients across four centers.', confidence: 'high' },
    BODY,
    (v) => (typeof v === 'number' ? v : null),
  )
  assert.equal(f.value, null, 'a value whose quote is not in the text must not survive')
  assert.equal(f.quote, null)
  assert.equal(f.confidence, null)
  assert.equal(f.quoteRejected, true)
})

test('a real quote is accepted with its confidence', () => {
  const f = acceptField<number>(
    { value: 42, quote: 'We retrospectively reviewed 42 consecutive patients', confidence: 'high' },
    BODY,
    (v) => (typeof v === 'number' ? v : null),
  )
  assert.equal(f.value, 42)
  assert.equal(f.confidence, 'high')
  assert.ok(!f.quoteRejected)
})

test('a value with no quote at all is dropped — unevidenced claims never ship', () => {
  const f = acceptField<boolean>({ value: true, quote: null, confidence: 'high' }, BODY, (v) =>
    typeof v === 'boolean' ? v : null,
  )
  assert.equal(f.value, null)
  assert.equal(f.quoteRejected, true)
})

test('whitespace differences are forgiven; wording differences are not', () => {
  // .docx extraction introduces line wrapping of its own, so newline-vs-space
  // must pass. Everything else must fail.
  assert.equal(verifyQuote('We retrospectively\nreviewed 42   consecutive patients', BODY), true)
  assert.equal(normalizeForQuoteMatch('a  b\n\tc'), 'a b c')
  // A "corrected" word is a different sentence.
  assert.equal(verifyQuote('We retrospectively reviewed 42 consecutive patient', BODY), true) // substring, legitimately
  assert.equal(verifyQuote('We retrospectively examined 42 consecutive patients', BODY), false)
  // Case folding is deliberately NOT applied.
  assert.equal(verifyQuote('we retrospectively reviewed 42', BODY), false)
  assert.equal(verifyQuote('', BODY), false)
})

/* --------------------------- deterministic derivation ---------------------- */

test('deriveEvidenceLevel covers every design, including the rct downgrade', () => {
  assert.equal(deriveEvidenceLevel('rct', true, 40), 1, 'multicentre rct stays level 1')
  assert.equal(deriveEvidenceLevel('rct', null, 40), 1, 'unknown centre count must not downgrade')
  assert.equal(deriveEvidenceLevel('rct', false, 400), 1, 'a large single-centre rct stays level 1')
  assert.equal(deriveEvidenceLevel('rct', false, 40), 2, 'small single-centre rct downgrades to 2')
  assert.equal(deriveEvidenceLevel('rct', false, null), 1, 'unknown n must not downgrade')
  assert.equal(deriveEvidenceLevel('systematic_review', null, null), 1)
  assert.equal(deriveEvidenceLevel('meta_analysis', null, null), 1)
  assert.equal(deriveEvidenceLevel('prospective_cohort', null, null), 2)
  assert.equal(deriveEvidenceLevel('retrospective_comparative', null, null), 3)
  assert.equal(deriveEvidenceLevel('case_control', null, null), 3)
  assert.equal(deriveEvidenceLevel('case_series', null, null), 4)
  assert.equal(deriveEvidenceLevel('case_report', null, null), 5)
  for (const d of ['narrative_review', 'technical_note', 'basic_science', 'other'] as const) {
    assert.equal(deriveEvidenceLevel(d, null, null), null, `${d} carries no level of evidence`)
  }
  assert.equal(deriveEvidenceLevel(null, null, null), null)
})

test('manual mode maps article type conservatively and verifies nothing', () => {
  const p = buildSelfReportedProfile('original_research', null)
  assert.equal(p.design.value, 'retrospective_comparative', 'declared original research must not be assumed prospective')
  assert.equal(p.design.quote, null)
  assert.equal(p.selfReported, true)
  for (const f of [p.sampleSize, p.multicenter, p.comparative, p.followUpMonths, p.statsReported, p.noveltyClaim]) {
    assert.equal(f.value, null)
    assert.equal(f.quote, null)
  }
  assert.equal(buildSelfReportedProfile('case_report', null).design.value, 'case_report')
  assert.equal(buildSelfReportedProfile('case_series', null).design.value, 'case_series')
  assert.equal(buildSelfReportedProfile('systematic_review', null).design.value, 'systematic_review')
  assert.equal(buildSelfReportedProfile('letter', null).design.value, 'other')
  // Level 3 base 0.50, no adjustments, no self-assessment.
  assert.equal(buildSelfReportedProfile('original_research', null).anchor, 0.5)
})

test('disagreements fire on both branches and do not cancel the shift', () => {
  const sa: SelfAssessment = { novelty: 'first_reported', strength: 'definitive_or_comparative', priorities: [] }
  assert.deepEqual(deriveDisagreements(sa, null, null), ['novelty', 'strength'])
  // Author claims novelty; the manuscript makes the claim itself → no disagreement.
  assert.deepEqual(deriveDisagreements(sa, 'the first reported series', true), [])
  // stats present but false is still a disagreement with "definitive".
  assert.deepEqual(deriveDisagreements(sa, 'the first reported series', false), ['strength'])
  assert.deepEqual(deriveDisagreements(null, null, null), [])
  // The shift is bounded by its clamp, not cancelled by the disagreement.
  assert.equal(deriveAuthorShift(sa), 0.1)
})

test('truncation keeps the head and the tail and reports itself', () => {
  const short = truncateForExtraction('one two three')
  assert.equal(short.truncated, false)
  assert.equal(short.text, 'one two three')

  const long = Array.from({ length: HEAD_WORDS + TAIL_WORDS + 500 }, (_, i) => `w${i}`).join(' ')
  const cut = truncateForExtraction(long)
  assert.equal(cut.truncated, true)
  assert.ok(cut.text.startsWith('w0 w1 '), 'head must be preserved')
  assert.ok(cut.text.trimEnd().endsWith(`w${HEAD_WORDS + TAIL_WORDS + 499}`), 'tail must be preserved')
  assert.match(cut.text, /middle of manuscript omitted/)
})

/* -------------------------------- extraction ------------------------------- */

function mockFetch(responses: string[]): typeof fetch {
  let i = 0
  return (async () => {
    const content = responses[Math.min(i++, responses.length - 1)]
    return {
      ok: true,
      json: async () => ({ choices: [{ message: { content } }] }),
      text: async () => content,
    } as unknown as Response
  }) as unknown as typeof fetch
}

test('two invalid JSON responses degrade to an all-null profile without throwing', async () => {
  const p = await extractProfile(BODY, null, {
    apiKey: 'test-key',
    fetchImpl: mockFetch(['not json at all', 'still {not} json']),
  })
  assert.equal(p.design.value, null)
  assert.equal(p.sampleSize.value, null)
  assert.equal(p.evidenceLevel, null)
  assert.equal(p.anchor, 0.5, 'an unknown design anchors mid-field')
  assert.ok(p.extractionError, 'the failure must be disclosed, not swallowed')
})

test('a missing API key degrades honestly rather than inventing a profile', async () => {
  const p = await extractProfile(BODY, null, { apiKey: '', fetchImpl: mockFetch(['{}']) })
  assert.equal(p.design.value, null)
  assert.equal(p.extractionError, 'Missing DEEPSEEK_API_KEY')
})

test('a valid response is accepted field-by-field, and only the quoted fields survive', async () => {
  const good = JSON.stringify({
    study_design: { value: 'case_series', quote: 'We retrospectively reviewed 42 consecutive patients', confidence: 'high' },
    sample_size: { value: 42, quote: 'reviewed 42 consecutive patients', confidence: 'high' },
    // Quote is not in the body — this one must be rejected.
    multicenter: { value: true, quote: 'across seven participating centers', confidence: 'high' },
    comparative: { value: false, quote: null, confidence: null },
    follow_up_months: { value: 18, quote: 'Mean follow-up was 18 months', confidence: 'high' },
    stats_reported: { value: null, quote: null, confidence: null },
    novelty_claim: {
      value: 'first reported series of this technique',
      quote: 'this is the first reported series of this technique',
      confidence: 'high',
    },
  })
  const p = await extractProfile(BODY, null, { apiKey: 'k', fetchImpl: mockFetch([good]) })

  assert.equal(p.design.value, 'case_series')
  assert.equal(p.sampleSize.value, 42)
  assert.equal(p.multicenter.value, null, 'the unquotable claim must be dropped')
  assert.equal(p.multicenter.quoteRejected, true)
  assert.equal(p.followUpMonths.value, 18)
  assert.equal(p.statsReported.value, null)
  assert.equal(p.evidenceLevel, 4, 'case series is level 4')
  // base 0.35, +0.10 for the "first" novelty quote. Sample size 42 < 100 adds nothing.
  assert.equal(p.anchor, 0.45)
})

test('fieldsFromRaw tolerates a malformed object without throwing', () => {
  const f = fieldsFromRaw({ study_design: 'nonsense', sample_size: { value: -3, quote: 'x' } }, BODY)
  assert.equal(f.design.value, null)
  assert.equal(f.sampleSize.value, null)
})

test('an empty profile still carries a usable anchor and no invented facts', () => {
  const p = buildEmptyProfile(null, { truncated: true, extractionError: 'boom' })
  assert.equal(p.anchor, 0.5)
  assert.equal(p.truncated, true)
  assert.equal(p.selfReported, false)
  assert.equal(p.design.value, null)
})
