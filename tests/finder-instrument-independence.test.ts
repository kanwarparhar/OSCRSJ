// Finder v2 — what the methodology score is NOT allowed to move (2026-07-26).
//
// Letting a graded quality score steer the ladder is the riskiest thing in this
// build, so the blast radius is fenced by tests rather than by intention:
//
//   1. THE KILL SWITCH IS REAL. FINDER_INSTRUMENT_ANCHOR=off must return the
//      anchor to exactly its pre-instrument value — not approximately, exactly.
//      A rollback that leaves a residue is not a rollback, and this switch is
//      the only thing standing between a disappointing live reproducibility
//      result and a redeploy.
//   2. OSCRSJ VISIBILITY IS UNTOUCHABLE. Whether our own journal is shown must
//      stay a pure function of article type and scope. The moment a quality
//      score could influence it, "we show you OSCRSJ" becomes "we show you
//      OSCRSJ when we think you are good enough for it", which is precisely the
//      self-dealing the Finder's whole design refuses.
//   3. THE CLAMP HOLDS. Text signals and the instrument grade are each bounded,
//      but two bounded movements are not a bounded movement. The combined
//      text-derived movement may never exceed MAX_TEXT_ADJUSTMENT.

import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  MAX_TEXT_ADJUSTMENT,
  baseAnchorForLevel,
  deriveInstrumentAdjustment,
  deriveTextAdjustment,
  finalizeProfile,
  instrumentAnchorEnabled,
} from '@/lib/finder/assess'
import { showOscrsjCard } from '@/lib/finder/ladder'
import { INSTRUMENTS, scoreNumericInstrument, type MethodologyScore } from '@/lib/quality'
import type { ManuscriptStats, MatchableJournal } from '@/lib/finder/types'
import type { ArticleType } from '@/lib/formatting/rulesSchema'

/* --------------------------------- fixtures -------------------------------- */

const nul = { value: null, quote: null, confidence: null }

/** A fixed, maximal comparative study: every text signal pushing upward. */
const MAXIMAL_FIELDS = {
  design: { value: 'retrospective_comparative' as const, quote: 'retrospective comparative study', confidence: 'high' as const },
  sampleSize: { value: 480, quote: '480 patients were analyzed', confidence: 'high' as const },
  multicenter: { value: true, quote: 'across four centers', confidence: 'high' as const },
  comparative: { value: true, quote: 'compared with the control group', confidence: 'high' as const },
  followUpMonths: { value: 60, quote: 'followed for five years', confidence: 'high' as const },
  statsReported: { value: true, quote: '24% vs 9%, p = 0.03', confidence: 'high' as const },
  noveltyClaim: { value: 'the first series of its kind', quote: 'the first series of its kind', confidence: 'high' as const },
}

const PLAIN_FIELDS = {
  design: { value: 'case_series' as const, quote: 'a consecutive series', confidence: 'high' as const },
  sampleSize: { ...nul },
  multicenter: { ...nul },
  comparative: { ...nul },
  followUpMonths: { ...nul },
  statsReported: { ...nul },
  noveltyClaim: { ...nul },
}

const EXTRA = { selfReported: false, truncated: false, extractionError: null }

const perfectScore = (): MethodologyScore =>
  scoreNumericInstrument(
    INSTRUMENTS.MINORS_COMPARATIVE,
    INSTRUMENTS.MINORS_COMPARATIVE.items.map((i) => ({ id: i.id, verdict: 'met' as const, quote: `q ${i.id}` })),
  )

const worstScore = (): MethodologyScore =>
  scoreNumericInstrument(
    INSTRUMENTS.MINORS_COMPARATIVE,
    INSTRUMENTS.MINORS_COMPARATIVE.items.map((i) => ({ id: i.id, verdict: 'not_met' as const, quote: `q ${i.id}` })),
  )

/** Run `fn` with FINDER_INSTRUMENT_ANCHOR set, then restore the environment. */
function withAnchorEnv<T>(value: string | undefined, fn: () => T): T {
  const previous = process.env.FINDER_INSTRUMENT_ANCHOR
  if (value === undefined) delete process.env.FINDER_INSTRUMENT_ANCHOR
  else process.env.FINDER_INSTRUMENT_ANCHOR = value
  try {
    return fn()
  } finally {
    if (previous === undefined) delete process.env.FINDER_INSTRUMENT_ANCHOR
    else process.env.FINDER_INSTRUMENT_ANCHOR = previous
  }
}

/* -------------------------------------------------------------------------- */
/* 1. The kill switch                                                          */
/* -------------------------------------------------------------------------- */

test('the anchor moves with the grade by default', () => {
  withAnchorEnv(undefined, () => {
    assert.equal(instrumentAnchorEnabled(), true)
    const without = finalizeProfile(PLAIN_FIELDS, null, EXTRA)
    const withGrade = finalizeProfile(PLAIN_FIELDS, null, { ...EXTRA, methodologyScore: perfectScore() })
    assert.notEqual(withGrade.anchor, without.anchor)
    assert.ok(withGrade.anchor > without.anchor)
  })
})

test('FINDER_INSTRUMENT_ANCHOR=off restores the pre-instrument anchor EXACTLY', () => {
  const preInstrument = withAnchorEnv('off', () => finalizeProfile(PLAIN_FIELDS, null, EXTRA).anchor)

  for (const score of [perfectScore(), worstScore()]) {
    const off = withAnchorEnv('off', () => finalizeProfile(PLAIN_FIELDS, null, { ...EXTRA, methodologyScore: score }).anchor)
    assert.equal(off, preInstrument)
  }

  // And the switch genuinely is the thing making the difference.
  const on = withAnchorEnv(undefined, () => finalizeProfile(PLAIN_FIELDS, null, { ...EXTRA, methodologyScore: perfectScore() }).anchor)
  assert.notEqual(on, preInstrument)
})

test('the kill switch is case- and whitespace-tolerant, and only "off" disables', () => {
  for (const v of ['off', 'OFF', '  Off  ']) {
    withAnchorEnv(v, () => assert.equal(instrumentAnchorEnabled(), false, `"${v}" should disable`))
  }
  for (const v of ['on', '', 'true', 'anything']) {
    withAnchorEnv(v, () => assert.equal(instrumentAnchorEnabled(), true, `"${v}" should leave it enabled`))
  }
})

test('with the switch off the score is still fully present for display', () => {
  withAnchorEnv('off', () => {
    const p = finalizeProfile(PLAIN_FIELDS, null, { ...EXTRA, methodologyScore: perfectScore() })
    // Display-only, not deleted: the author still gets the item breakdown.
    assert.ok(p.methodologyScore)
    assert.equal(p.methodologyScore?.obtained, 24)
  })
})

/* -------------------------------------------------------------------------- */
/* 2. OSCRSJ visibility                                                        */
/* -------------------------------------------------------------------------- */

function oscrsjJournal(types: ArticleType[], scopeTags: string[] = ['general']): MatchableJournal {
  return {
    slug: 'oscrsj',
    name: 'OSCRSJ',
    abbrev: 'OSCRSJ',
    publisher: 'OSCRSJ',
    guidelinesUrl: 'https://example.test/oscrsj',
    verifiedDate: '2026-07-26',
    isSelf: true,
    articleTypes: types,
    limits: null,
    meta: {
      indexing: [],
      oa_model: null,
      apc_usd: null,
      review_speed: null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      scope_tags: scopeTags as any,
      accepts_case_reports: null,
      source_urls: [],
      verified_date: null,
      sjr: { categoryRank: null, sjr: null, quartile: null, year: null, source: 'test' },
    },
  } as unknown as MatchableJournal
}

const statsFor = (articleType: ArticleType, subspecialty: ManuscriptStats['subspecialty'] = null): ManuscriptStats => ({
  articleType,
  wordCount: null,
  abstractWordCount: null,
  figureCount: null,
  tableCount: null,
  referenceCount: null,
  subspecialty,
})

test('showOscrsjCard cannot see a methodology score at all', () => {
  // The strongest available form of this guarantee is structural: the function
  // takes (journal, stats) and no profile, so no grade can reach it. This test
  // fails the moment someone widens that signature.
  assert.equal(showOscrsjCard.length, 2)
})

test('OSCRSJ visibility is identical across every possible grade', () => {
  const journal = oscrsjJournal(['case_series', 'case_report'])
  const stats = statsFor('case_series')
  const baseline = showOscrsjCard(journal, stats)
  assert.equal(baseline, true)

  const grades: Array<MethodologyScore | null> = [null, perfectScore(), worstScore()]
  for (const score of grades) {
    // Build a real profile at each grade, prove its anchor genuinely differs,
    // and prove OSCRSJ visibility does not.
    const p = finalizeProfile(PLAIN_FIELDS, null, { ...EXTRA, methodologyScore: score })
    assert.ok(typeof p.anchor === 'number')
    assert.equal(showOscrsjCard(journal, stats), baseline)
  }

  // Anchors really did move — otherwise the assertion above proves nothing.
  const low = finalizeProfile(PLAIN_FIELDS, null, { ...EXTRA, methodologyScore: worstScore() }).anchor
  const high = finalizeProfile(PLAIN_FIELDS, null, { ...EXTRA, methodologyScore: perfectScore() }).anchor
  assert.ok(high > low)
})

test('OSCRSJ visibility still turns on article type and scope, as it always did', () => {
  assert.equal(showOscrsjCard(oscrsjJournal(['case_series']), statsFor('original_research')), false)
  assert.equal(showOscrsjCard(oscrsjJournal(['case_series']), statsFor('case_series')), true)
  assert.equal(showOscrsjCard(oscrsjJournal(['case_series'], ['spine']), statsFor('case_series', 'sports')), false)
  assert.equal(showOscrsjCard(undefined, statsFor('case_series')), false)
})

/* -------------------------------------------------------------------------- */
/* 3. The combined clamp                                                       */
/* -------------------------------------------------------------------------- */

test('a maximal study with a perfect grade never breaches the combined clamp', () => {
  withAnchorEnv(undefined, () => {
    const textAdj = deriveTextAdjustment({
      design: MAXIMAL_FIELDS.design.value,
      sampleSize: MAXIMAL_FIELDS.sampleSize.value,
      multicenter: MAXIMAL_FIELDS.multicenter.value,
      comparative: MAXIMAL_FIELDS.comparative.value,
      followUpMonths: MAXIMAL_FIELDS.followUpMonths.value,
      statsReported: MAXIMAL_FIELDS.statsReported.value,
      noveltyQuote: MAXIMAL_FIELDS.noveltyClaim.quote,
    })
    const instrumentAdj = deriveInstrumentAdjustment(perfectScore())

    // Each half is bounded...
    assert.ok(Math.abs(textAdj) <= MAX_TEXT_ADJUSTMENT)
    assert.ok(instrumentAdj > 0)
    // ...and unclamped they would together exceed the cap, which is exactly why
    // the combined clamp has to exist.
    assert.ok(Math.abs(textAdj + instrumentAdj) > MAX_TEXT_ADJUSTMENT)

    const level = 3 // retrospective_comparative
    const profile = finalizeProfile(MAXIMAL_FIELDS, null, { ...EXTRA, methodologyScore: perfectScore() })
    const movement = profile.anchor - baseAnchorForLevel(level)
    assert.ok(
      movement <= MAX_TEXT_ADJUSTMENT + 1e-9,
      `combined movement ${movement} breached the ${MAX_TEXT_ADJUSTMENT} clamp`,
    )
  })
})

test('the clamp holds downward too', () => {
  withAnchorEnv(undefined, () => {
    const weak = {
      ...MAXIMAL_FIELDS,
      multicenter: { ...nul },
      sampleSize: { ...nul },
      noveltyClaim: { ...nul },
      statsReported: { value: false, quote: 'significance was set at p<0.05', confidence: 'high' as const },
      followUpMonths: { value: 3, quote: 'followed for three months', confidence: 'high' as const },
    }
    const profile = finalizeProfile(weak, null, { ...EXTRA, methodologyScore: worstScore() })
    const movement = profile.anchor - baseAnchorForLevel(3)
    assert.ok(
      movement >= -MAX_TEXT_ADJUSTMENT - 1e-9,
      `combined movement ${movement} breached the -${MAX_TEXT_ADJUSTMENT} clamp`,
    )
  })
})

test('the anchor stays inside its published 0.1-0.9 range at both extremes', () => {
  withAnchorEnv(undefined, () => {
    const best = finalizeProfile(MAXIMAL_FIELDS, null, { ...EXTRA, methodologyScore: perfectScore() })
    const worst = finalizeProfile(PLAIN_FIELDS, null, { ...EXTRA, methodologyScore: worstScore() })
    for (const p of [best, worst]) {
      assert.ok(p.anchor >= 0.1 && p.anchor <= 0.9, `anchor ${p.anchor} out of range`)
    }
  })
})

/* -------------------------------------------------------------------------- */
/* 4. Readiness never reaches the anchor                                       */
/* -------------------------------------------------------------------------- */

test('the readiness checklist cannot move the ladder', () => {
  withAnchorEnv(undefined, () => {
    const allPresent = {
      ethicsApproval: { present: true, quote: 'IRB approved' },
      registration: { present: true, quote: 'registered at' },
      reportingGuideline: { present: true, quote: 'STROBE' },
      conflictOfInterest: { present: true, quote: 'no conflicts' },
      funding: { present: true, quote: 'no funding' },
      informedConsent: { present: true, quote: 'consent obtained' },
    }
    const bare = finalizeProfile(PLAIN_FIELDS, null, EXTRA)
    const full = finalizeProfile(PLAIN_FIELDS, null, { ...EXTRA, readiness: allPresent })

    // A complete paperwork trail is worth saying out loud and worth exactly zero
    // percentile points — it is a desk-reject screen, not a quality signal.
    assert.equal(full.anchor, bare.anchor)
    assert.equal(full.readiness.funding.present, true)
  })
})
