// Methodological quality grading — extraction, verification, cache (2026-07-26).
//
// No test here touches the network: `fetchImpl` is injected everywhere.
//
// The contract:
//   1. REPRODUCIBILITY. A fixed model response yields a fixed MethodologyScore,
//      byte for byte. This is what lets the Finder promise the same manuscript
//      produces the same ladder twice.
//   2. THE QUOTE CHECK IS THE PRODUCT. A verdict whose quote is not a substring
//      of the manuscript is DISCARDED to not_assessable — not downgraded, not
//      kept with a warning. Evidence that evaporated is not weaker evidence.
//   3. DEGRADATION IS NEVER FATAL. Bad JSON twice, a missing key or an HTTP
//      failure produce gradingError + normalized null, and the ladder anchor is
//      then identical to a run where no instrument existed at all.
//   4. The helpers duplicated from lib/finder/assess.ts have not drifted.

import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  INSTRUMENTS,
  contentHash,
  createMemoryCacheStore,
  extractMethodology,
  parseGradingResponse,
  withQualityCache,
} from '@/lib/quality'
import {
  normalizeForQuoteMatch as qNormalize,
  truncateForExtraction as qTruncate,
  verifyQuote as qVerify,
} from '@/lib/quality/extract'
import {
  finalizeProfile,
  instrumentAnchorEnabled,
  deriveInstrumentAdjustment,
  normalizeForQuoteMatch as fNormalize,
  truncateForExtraction as fTruncate,
  verifyQuote as fVerify,
} from '@/lib/finder/assess'
import { gradingErrorScore } from '@/lib/quality'

/* -------------------------------------------------------------------------- */
/* fixtures                                                                    */
/* -------------------------------------------------------------------------- */

const BODY = [
  'Introduction. The aim of this study was to compare open reduction with external fixation for tibial pilon fractures.',
  'Methods. We consecutively enrolled all eligible patients presenting between 2019 and 2022.',
  'Data were collected prospectively using a predefined protocol.',
  'Outcomes were assessed by an independent observer blinded to treatment allocation.',
  'Results. The deep infection rate was higher in the delayed group, 24% vs 9%, p = 0.03.',
  'The study was approved by the institutional review board.',
  'The authors declare no conflicts of interest.',
].join(' ')

/** A model response whose quotes are all genuine substrings of BODY. */
const GOOD_RESPONSE = {
  items: [
    { id: 'min1_aim', verdict: 'met', quote: 'The aim of this study was to compare open reduction with external fixation' },
    { id: 'min2_consecutive', verdict: 'met', quote: 'We consecutively enrolled all eligible patients' },
    { id: 'min3_prospective', verdict: 'met', quote: 'Data were collected prospectively using a predefined protocol' },
    { id: 'min5_unbiased_assessment', verdict: 'met', quote: 'assessed by an independent observer blinded to treatment allocation' },
    { id: 'min12_stats_adequate', verdict: 'partial', quote: 'The deep infection rate was higher in the delayed group' },
    { id: 'min8_prospective_size', verdict: 'not_met', quote: 'Methods. We consecutively enrolled all eligible patients' },
  ],
  readiness: {
    ethicsApproval: { present: true, quote: 'approved by the institutional review board' },
    conflictOfInterest: { present: true, quote: 'The authors declare no conflicts of interest' },
    registration: { present: false, quote: null },
    reportingGuideline: { present: false, quote: null },
    funding: { present: false, quote: null },
    informedConsent: { present: false, quote: null },
  },
}

const mockFetchContent = (content: string): typeof fetch =>
  (async () =>
    ({
      ok: true,
      status: 200,
      json: async () => ({ choices: [{ message: { content } }] }),
      text: async () => content,
    }) as unknown as Response) as unknown as typeof fetch

const mockFetchJson = (payload: unknown): typeof fetch => mockFetchContent(JSON.stringify(payload))

const mockFetchHttpError = (status: number): typeof fetch =>
  (async () =>
    ({
      ok: false,
      status,
      json: async () => ({}),
      text: async () => 'upstream exploded',
    }) as unknown as Response) as unknown as typeof fetch

const opts = (fetchImpl: typeof fetch) => ({ apiKey: 'test-key', fetchImpl, model: 'deepseek-v4-flash' })

/* -------------------------------------------------------------------------- */
/* Duplicate-helper drift guard                                                */
/* -------------------------------------------------------------------------- */

test('the quote helpers duplicated into lib/quality have not drifted', () => {
  // lib/quality/ deliberately cannot import from lib/finder/, so these three
  // pure functions are copied. This is the only place both copies are visible,
  // so it is where they are held identical.
  const samples: Array<[string, string]> = [
    ['consecutively enrolled', BODY],
    ['CONSECUTIVELY ENROLLED', BODY],
    ['consecutively   enrolled', BODY],
    ['a phrase that is absent', BODY],
    ['', BODY],
  ]
  for (const [quote, body] of samples) {
    assert.equal(qVerify(quote, body), fVerify(quote, body), `verifyQuote disagreed on "${quote}"`)
  }
  assert.equal(qNormalize('  a   b \n c '), fNormalize('  a   b \n c '))

  const long = Array.from({ length: 12_000 }, (_, i) => `w${i}`).join(' ')
  assert.deepEqual(qTruncate(long), fTruncate(long))
  assert.deepEqual(qTruncate('short body'), fTruncate('short body'))
  assert.equal(qTruncate(long).truncated, true)
})

/* -------------------------------------------------------------------------- */
/* Reproducibility                                                             */
/* -------------------------------------------------------------------------- */

test('a fixed model response yields a fixed score', async () => {
  const a = await extractMethodology(BODY, 'retrospective_comparative', true, opts(mockFetchJson(GOOD_RESPONSE)))
  const b = await extractMethodology(BODY, 'retrospective_comparative', true, opts(mockFetchJson(GOOD_RESPONSE)))

  assert.deepEqual(a, b)
  assert.equal(a.score.instrumentId, 'MINORS_COMPARATIVE')
  assert.equal(a.score.gradingError, null)

  // 4 met (8 pts) + 1 partial (1 pt) + 1 not_met (0 pts) = 9 of 12 applicable.
  assert.equal(a.score.obtained, 9)
  assert.equal(a.score.applicableMax, 12)
  assert.equal(a.score.normalized, 0.75)

  // The six items the model never mentioned are not_assessable, not zeros.
  const untouched = a.score.items.filter((i) => i.verdict === 'not_assessable')
  assert.equal(untouched.length, 6)
})

test('readiness gates are extracted in the same call and quote-verified', async () => {
  const r = await extractMethodology(BODY, 'retrospective_comparative', true, opts(mockFetchJson(GOOD_RESPONSE)))
  assert.equal(r.readiness.ethicsApproval.present, true)
  assert.ok(r.readiness.ethicsApproval.quote)
  assert.equal(r.readiness.conflictOfInterest.present, true)
  assert.equal(r.readiness.funding.present, false)
  assert.equal(r.readiness.funding.quote, null)
  assert.equal(r.quoteRejections, 0)
})

/* -------------------------------------------------------------------------- */
/* The quote check                                                             */
/* -------------------------------------------------------------------------- */

test('a verdict whose quote is not in the manuscript is discarded', () => {
  const parsed = parseGradingResponse(
    {
      items: [
        { id: 'min1_aim', verdict: 'met', quote: 'The aim of this study was to compare open reduction' },
        { id: 'min2_consecutive', verdict: 'met', quote: 'patients were enrolled consecutively and at random' },
      ],
    },
    INSTRUMENTS.MINORS_COMPARATIVE,
    BODY,
  )

  const kept = parsed.rawItems.find((i) => i.id === 'min1_aim')!
  const dropped = parsed.rawItems.find((i) => i.id === 'min2_consecutive')!
  assert.equal(kept.verdict, 'met')
  // Discarded, not downgraded to not_met — that would be a judgement we cannot
  // support, dressed as a finding against the author.
  assert.equal(dropped.verdict, 'not_assessable')
  assert.equal(dropped.quote, null)
  assert.equal(parsed.quoteRejections, 1)
})

test('a paraphrase fails exactly like an invention', () => {
  // The model "helpfully" tidies the sentence. Substring check says no.
  const parsed = parseGradingResponse(
    { items: [{ id: 'min2_consecutive', verdict: 'met', quote: 'We consecutively enrolled all of the eligible patients' }] },
    INSTRUMENTS.MINORS_COMPARATIVE,
    BODY,
  )
  assert.equal(parsed.rawItems[0].verdict, 'not_assessable')
})

test('a verdict with no quote at all is discarded', () => {
  const parsed = parseGradingResponse(
    { items: [{ id: 'min1_aim', verdict: 'met', quote: null }] },
    INSTRUMENTS.MINORS_COMPARATIVE,
    BODY,
  )
  assert.equal(parsed.rawItems[0].verdict, 'not_assessable')
  assert.equal(parsed.quoteRejections, 1)
})

test('an unevidenced readiness gate stays absent', () => {
  const parsed = parseGradingResponse(
    { readiness: { funding: { present: true, quote: 'this study was funded by a grant' } } },
    INSTRUMENTS.CARE,
    BODY,
  )
  // Telling an author a desk-reject gate is cleared when it may not be is worse
  // than telling them it is not.
  assert.equal(parsed.readiness.funding.present, false)
  assert.equal(parsed.quoteRejections, 1)
})

test('an item id the instrument does not contain is ignored', () => {
  const parsed = parseGradingResponse(
    {
      items: [
        { id: 'min9_control_adequate', verdict: 'met', quote: 'The aim of this study was to compare open reduction' },
        { id: 'nos_s1_representative', verdict: 'met', quote: 'The aim of this study was to compare open reduction' },
      ],
    },
    INSTRUMENTS.MINORS_COMPARATIVE,
    BODY,
  )
  assert.equal(parsed.rawItems.length, 1)
  assert.equal(parsed.rawItems[0].id, 'min9_control_adequate')
})

test('an unrecognised verdict string becomes not_assessable, never a guess', () => {
  const parsed = parseGradingResponse(
    { items: [{ id: 'min1_aim', verdict: 'excellent', quote: 'The aim of this study was to compare open reduction' }] },
    INSTRUMENTS.MINORS_COMPARATIVE,
    BODY,
  )
  assert.equal(parsed.rawItems[0].verdict, 'not_assessable')
})

/* -------------------------------------------------------------------------- */
/* Degradation                                                                 */
/* -------------------------------------------------------------------------- */

test('two bad JSON responses degrade honestly', async () => {
  const r = await extractMethodology(BODY, 'case_series', false, opts(mockFetchContent('not json at all')))
  assert.ok(r.score.gradingError)
  assert.equal(r.score.normalized, null)
  // The design HAS an instrument; we simply could not apply it.
  assert.equal(r.score.noInstrument, false)
  assert.equal(r.score.instrumentId, 'MINORS_NONCOMPARATIVE')
})

test('an HTTP failure degrades honestly', async () => {
  const r = await extractMethodology(BODY, 'case_report', false, opts(mockFetchHttpError(500)))
  assert.ok(r.score.gradingError?.includes('500'))
  assert.equal(r.score.normalized, null)
})

test('a missing API key is disclosed, not thrown', async () => {
  const r = await extractMethodology(BODY, 'case_report', false, { apiKey: '', fetchImpl: mockFetchJson({}) })
  assert.equal(r.score.gradingError, 'Missing DEEPSEEK_API_KEY')
  assert.equal(r.score.normalized, null)
})

test('a design with no instrument never becomes a grading error', async () => {
  const r = await extractMethodology(BODY, 'narrative_review', null, opts(mockFetchJson({ items: [], readiness: {} })))
  assert.equal(r.score.noInstrument, true)
  assert.equal(r.score.gradingError, null)
  assert.equal(r.score.normalized, null)
})

test('a grading failure leaves the anchor exactly where no instrument would', () => {
  const fields = {
    design: { value: 'case_series' as const, quote: 'a case series of', confidence: 'high' as const },
    sampleSize: { value: null, quote: null, confidence: null },
    multicenter: { value: null, quote: null, confidence: null },
    comparative: { value: null, quote: null, confidence: null },
    followUpMonths: { value: null, quote: null, confidence: null },
    statsReported: { value: null, quote: null, confidence: null },
    noveltyClaim: { value: null, quote: null, confidence: null },
  }
  const base = { selfReported: false, truncated: false, extractionError: null }

  const noScore = finalizeProfile(fields, null, base)
  const failed = finalizeProfile(fields, null, {
    ...base,
    methodologyScore: gradingErrorScore(INSTRUMENTS.MINORS_NONCOMPARATIVE, 'DeepSeek HTTP 500'),
  })

  assert.equal(failed.anchor, noScore.anchor)
})

/* -------------------------------------------------------------------------- */
/* Anchor adjustment                                                           */
/* -------------------------------------------------------------------------- */

test('the instrument adjustment is centred at 0.6 and bounded', () => {
  assert.equal(instrumentAnchorEnabled(), true) // default ON
  assert.equal(deriveInstrumentAdjustment({ normalized: 0.6 }), 0)
  assert.equal(deriveInstrumentAdjustment({ normalized: 1 }), 0.1)
  assert.ok(Math.abs(deriveInstrumentAdjustment({ normalized: 0 }) - -0.15) < 1e-9)
  assert.ok(deriveInstrumentAdjustment({ normalized: 0.8 })! > 0)
  assert.ok(deriveInstrumentAdjustment({ normalized: 0.4 })! < 0)
})

test('nothing to grade contributes exactly nothing', () => {
  assert.equal(deriveInstrumentAdjustment(null), 0)
  assert.equal(deriveInstrumentAdjustment({ normalized: null }), 0)
})

/* -------------------------------------------------------------------------- */
/* Cache                                                                       */
/* -------------------------------------------------------------------------- */

test('the content hash keys on both the text and the instrument', () => {
  const a = contentHash('body text', 'CARE')
  assert.equal(a, contentHash('body text', 'CARE'))
  // Correcting the study design must re-grade, not reuse the old instrument.
  assert.notEqual(a, contentHash('body text', 'MINORS_COMPARATIVE'))
  assert.notEqual(a, contentHash('body text.', 'CARE'))
  assert.equal(a.length, 64)
})

test('a cache hit returns the stored score without recomputing', async () => {
  const store = createMemoryCacheStore()
  const score = (await extractMethodology(BODY, 'retrospective_comparative', true, opts(mockFetchJson(GOOD_RESPONSE)))).score
  const hash = contentHash(BODY, 'MINORS_COMPARATIVE')

  let computes = 0
  const compute = async () => {
    computes++
    return score
  }

  const first = await withQualityCache(store, hash, 'MINORS_COMPARATIVE', compute)
  const second = await withQualityCache(store, hash, 'MINORS_COMPARATIVE', compute)

  assert.equal(computes, 1)
  assert.equal(first.cacheHit, false)
  assert.equal(second.cacheHit, true)
  assert.deepEqual(second.score, first.score)
})

test('a failed grading is never cached', async () => {
  const store = createMemoryCacheStore()
  const failed = gradingErrorScore(INSTRUMENTS.CARE, 'transient network blip')

  await withQualityCache(store, 'h1', 'CARE', async () => failed)
  assert.equal(store.size(), 0)

  // ...so the retry is a real retry rather than the blip served back forever.
  const retry = await withQualityCache(store, 'h1', 'CARE', async () => failed)
  assert.equal(retry.cacheHit, false)
})

test('a broken cache never breaks a run', async () => {
  const exploding = {
    async get(): Promise<never> {
      throw new Error('supabase is down')
    },
    async set(): Promise<never> {
      throw new Error('supabase is still down')
    },
  }
  const score = gradingErrorScore(INSTRUMENTS.CARE, 'x')
  const ok = { ...score, gradingError: null }

  const r = await withQualityCache(exploding, 'h', 'CARE', async () => ok)
  assert.equal(r.cacheHit, false)
  assert.deepEqual(r.score, ok)
})

test('no store at all is a supported configuration', async () => {
  const score = { ...gradingErrorScore(INSTRUMENTS.CARE, 'x'), gradingError: null }
  const r = await withQualityCache(null, 'h', 'CARE', async () => score)
  assert.equal(r.cacheHit, false)
})
