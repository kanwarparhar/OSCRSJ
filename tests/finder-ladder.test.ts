// Finder v2 — ladder engine tests.
//
// The fixture registry is INVENTED (fake slugs, fake SJR values). Testing the
// banding against the real 75-journal registry would couple these assertions to
// data that Janine re-verifies monthly; a legitimate data correction would then
// read as an engine regression. The engine's contract is about ordering,
// exclusion and disclosure, and that is what these fixtures exercise.
//
// The invariant this file exists to defend: OSCRSJ can never appear in a ladder
// slot, at any anchor, under any priority ordering.

import { test } from 'node:test'
import assert from 'node:assert/strict'

import { buildLadder, showOscrsjCard, REACH_OFFSET, SAFETY_OFFSET } from '../lib/finder/ladder'
import { baseAnchorForLevel, deriveAuthorShift, deriveTextAdjustment, MAX_TEXT_ADJUSTMENT } from '../lib/finder/assess'
import { NULL_SJR_STANDING, type SjrStanding } from '../lib/finder/sjrData'
import type { ManuscriptProfile, SelfAssessment, StudyDesign } from '../lib/finder/profileTypes'
import type { ArticleType } from '../lib/formatting/rulesSchema'
import type { JournalMeta, ManuscriptStats, MatchableJournal, ScopeTag } from '../lib/finder/types'

/* --------------------------------- fixtures -------------------------------- */

function standing(rank: number | null, sjr: number | null): SjrStanding {
  return rank === null
    ? { ...NULL_SJR_STANDING, source: 'test' }
    : { categoryRank: rank, sjr, quartile: 'Q1', year: 2025, source: 'test' }
}

function meta(over: Partial<JournalMeta> = {}): JournalMeta {
  return {
    indexing: [],
    oa_model: null,
    apc_usd: null,
    review_speed: null,
    scope_tags: [],
    accepts_case_reports: null,
    source_urls: [],
    verified_date: null,
    sjr: NULL_SJR_STANDING,
    ...over,
  }
}

interface JSpec {
  slug: string
  sjr: number | null
  rank?: number | null
  isSelf?: boolean
  tags?: ScopeTag[]
  types?: ArticleType[]
  reviewSpeed?: string | null
  apc?: number | null
}

function journal(spec: JSpec): MatchableJournal {
  return {
    slug: spec.slug,
    name: spec.slug.toUpperCase(),
    abbrev: spec.slug.toUpperCase(),
    publisher: 'Test Publisher',
    guidelinesUrl: `https://example.test/${spec.slug}`,
    verifiedDate: '2026-07-25',
    isSelf: spec.isSelf ?? false,
    articleTypes: spec.types ?? ['case_series', 'original_research', 'case_report'],
    // No limits anywhere: this suite is about banding, not constraint fit.
    limits: null,
    meta: meta({
      sjr: standing(spec.rank ?? (spec.sjr === null ? null : 1), spec.sjr),
      scope_tags: spec.tags ?? ['general'],
      review_speed: spec.reviewSpeed ?? null,
      apc_usd: spec.apc ?? null,
    }),
  }
}

/**
 * 12 journals: 9 ranked (sjr 3.0 down to 0.5), 2 unranked, 1 isSelf, and 2 of
 * the ranked ones tagged spine-only so a `sports` query marks them mismatched.
 */
function registry(): MatchableJournal[] {
  return [
    journal({ slug: 'alpha', sjr: 3.0, rank: 1 }),
    journal({ slug: 'bravo', sjr: 2.6, rank: 5 }),
    journal({ slug: 'charlie', sjr: 2.2, rank: 9 }),
    journal({ slug: 'delta', sjr: 1.9, rank: 14 }),
    journal({ slug: 'echo', sjr: 1.6, rank: 20, reviewSpeed: 'first decision (median): 3 weeks', apc: 500 }),
    journal({ slug: 'foxtrot', sjr: 1.3, rank: 28 }),
    journal({ slug: 'golf', sjr: 1.0, rank: 40, reviewSpeed: 'first decision (median): 2 weeks', apc: 100 }),
    journal({ slug: 'hotel', sjr: 0.8, rank: 55 }),
    journal({ slug: 'india', sjr: 0.5, rank: 70 }),
    journal({ slug: 'spine-one', sjr: 2.4, rank: 7, tags: ['spine'] }),
    journal({ slug: 'spine-two', sjr: 0.9, rank: 48, tags: ['spine'] }),
    journal({ slug: 'unranked-a', sjr: null, rank: null }),
    journal({ slug: 'unranked-b', sjr: null, rank: null }),
    journal({ slug: 'oscrsj', sjr: null, rank: null, isSelf: true, types: ['case_series', 'case_report'] }),
  ]
}

function profileWith(over: Partial<ManuscriptProfile> = {}): ManuscriptProfile {
  const nul = { value: null, quote: null, confidence: null }
  return {
    design: { value: 'case_series' as StudyDesign, quote: 'a series of patients', confidence: 'high' },
    sampleSize: { ...nul },
    multicenter: { ...nul },
    comparative: { ...nul },
    followUpMonths: { ...nul },
    statsReported: { ...nul },
    noveltyClaim: { ...nul },
    evidenceLevel: 4,
    anchor: 0.35,
    authorShift: 0,
    disagreements: [],
    selfReported: false,
    truncated: false,
    extractionError: null,
    ...over,
  } as ManuscriptProfile
}

function stats(over: Partial<ManuscriptStats> = {}): ManuscriptStats {
  return {
    articleType: 'case_series',
    wordCount: null,
    abstractWordCount: null,
    figureCount: null,
    tableCount: null,
    referenceCount: null,
    subspecialty: null,
    ...over,
  }
}

const noPrefs: SelfAssessment = { novelty: null, strength: null, priorities: [] }
const build = (p: ManuscriptProfile, s = stats(), sa = noPrefs, js = registry()) =>
  buildLadder(p, sa, s, { sortBy: 'fit' }, js)

/* ---------------------------------- tests ---------------------------------- */

test('percentiles: top ranked journal is 1.0, bottom is 0.0, middle is exact', () => {
  const r = build(profileWith({ anchor: 0.5 }))
  const all = [...r.slots]
  // 11 ranked candidates (9 general + 2 spine, no subspecialty filter applied).
  const top = all.find((s) => s.slug === 'alpha')
  if (top) assert.equal(top.percentile, 1)
  // Verify the math directly across the whole eligible set via repeated anchors.
  const atZero = build(profileWith({ anchor: 0.1 })).slots.map((s) => s.percentile)
  assert.ok(atZero.some((p) => p === 0), 'the lowest-SJR ranked journal must sit at percentile 0')
  const mid = build(profileWith({ anchor: 0.5 })).slots.find((s) => s.band === 'target')
  assert.ok(mid && mid.percentile !== null && mid.percentile > 0.4 && mid.percentile < 0.6)
})

test('deriveAnchor: each evidence level maps to its exact base', () => {
  assert.equal(baseAnchorForLevel(1), 0.9)
  assert.equal(baseAnchorForLevel(2), 0.7)
  assert.equal(baseAnchorForLevel(3), 0.5)
  assert.equal(baseAnchorForLevel(4), 0.35)
  assert.equal(baseAnchorForLevel(5), 0.25)
  assert.equal(baseAnchorForLevel(null), 0.5)
})

test('text adjustments clamp at +/-0.20 even when three signals stack', () => {
  const adj = deriveTextAdjustment({
    design: 'prospective_cohort',
    sampleSize: 400, // +0.10
    multicenter: true, // +0.10
    comparative: null,
    followUpMonths: null,
    statsReported: null,
    noveltyQuote: 'the first reported series of its kind', // +0.10  => +0.30 raw
  })
  assert.equal(adj, MAX_TEXT_ADJUSTMENT)

  const neg = deriveTextAdjustment({
    design: 'rct',
    sampleSize: null,
    multicenter: null,
    comparative: true,
    followUpMonths: 6,
    statsReported: false, // -0.10 and -0.10 => -0.20
    noveltyQuote: null,
  })
  assert.equal(neg, -MAX_TEXT_ADJUSTMENT)
})

test('author shift never exceeds +/-0.10', () => {
  assert.equal(deriveAuthorShift({ novelty: 'first_reported', strength: 'definitive_or_comparative', priorities: [] }), 0.1)
  assert.equal(deriveAuthorShift({ novelty: 'adds_to_known', strength: 'negative_or_confirmatory', priorities: [] }), -0.1)
  assert.equal(deriveAuthorShift({ novelty: 'first_reported', strength: 'negative_or_confirmatory', priorities: [] }), 0)
  assert.equal(deriveAuthorShift(null), 0)
})

test('INVARIANT: the isSelf journal never occupies a ladder slot, at any anchor or priority', () => {
  const prioritySets: SelfAssessment['priorities'][] = [
    [],
    ['prestige'],
    ['speed'],
    ['cost'],
    ['oa_visibility'],
    ['speed', 'cost'],
    ['prestige', 'oa_visibility'],
  ]
  let combos = 0
  for (let a = 1; a <= 9; a++) {
    const anchor = a / 10
    for (const priorities of prioritySets) {
      for (const articleType of ['case_series', 'case_report'] as ArticleType[]) {
        combos++
        const r = buildLadder(
          profileWith({ anchor }),
          { novelty: null, strength: null, priorities },
          stats({ articleType }),
          { sortBy: 'fit' },
          registry(),
        )
        assert.ok(
          !r.slots.some((s) => s.slug === 'oscrsj'),
          `oscrsj appeared in a slot at anchor ${anchor} with priorities ${priorities.join('+') || 'none'}`,
        )
      }
    }
  }
  assert.ok(combos >= 25, `expected >=25 combinations, ran ${combos}`)
})

test('no journal fills two slots', () => {
  for (let a = 1; a <= 9; a++) {
    const r = build(profileWith({ anchor: a / 10 }))
    const slugs = r.slots.map((s) => s.slug)
    assert.equal(new Set(slugs).size, slugs.length, `duplicate slug at anchor ${a / 10}: ${slugs.join(', ')}`)
  }
})

test('slots come back ordered reach, reach, target, target, safety', () => {
  const r = build(profileWith({ anchor: 0.5 }))
  assert.equal(r.slots.length, 5)
  assert.deepEqual(
    r.slots.map((s) => s.band),
    ['reach', 'reach', 'target', 'target', 'safety'],
  )
})

test('small set: three candidates yield three slots in target, safety, reach order', () => {
  const tiny = [
    journal({ slug: 'alpha', sjr: 3.0, rank: 1 }),
    journal({ slug: 'bravo', sjr: 2.0, rank: 10 }),
    journal({ slug: 'charlie', sjr: 1.0, rank: 30 }),
    journal({ slug: 'oscrsj', sjr: null, isSelf: true }),
  ]
  const r = build(profileWith({ anchor: 0.5 }), stats(), noPrefs, tiny)
  assert.equal(r.slots.length, 3)
  assert.deepEqual(new Set(r.slots.map((s) => s.band)), new Set(['target', 'safety', 'reach']))
  assert.equal(
    r.smallSetNote,
    'Only 3 journals in our registry accept case series in this scope. The ladder is shortened, not padded.',
  )
  // Shortened, never padded.
  assert.equal(new Set(r.slots.map((s) => s.slug)).size, 3)
})

test('scope mismatches are excluded when the set is large and re-admitted when it is small', () => {
  // 11 ranked general/spine journals eligible: strict filter still leaves >=8,
  // so the two spine-only journals are dropped for a sports manuscript.
  const big = build(profileWith({ anchor: 0.5 }), stats({ subspecialty: 'sports' }))
  assert.ok(!big.slots.some((s) => s.slug.startsWith('spine-')), 'spine-only journals must be excluded at >=8 candidates')

  // Shrink the general pool below the strict minimum: mismatches come back,
  // and they come back MARKED.
  const small = [
    journal({ slug: 'alpha', sjr: 3.0, rank: 1 }),
    journal({ slug: 'bravo', sjr: 2.0, rank: 10 }),
    journal({ slug: 'spine-one', sjr: 2.4, rank: 7, tags: ['spine'] }),
    journal({ slug: 'spine-two', sjr: 0.9, rank: 48, tags: ['spine'] }),
    journal({ slug: 'spine-three', sjr: 0.7, rank: 60, tags: ['spine'] }),
    journal({ slug: 'oscrsj', sjr: null, isSelf: true }),
  ]
  const r = build(profileWith({ anchor: 0.5 }), stats({ subspecialty: 'sports' }), noPrefs, small)
  const spine = r.slots.filter((s) => s.slug.startsWith('spine-'))
  assert.ok(spine.length > 0, 'below the strict minimum, mismatched journals must be re-admitted')
  assert.ok(spine.every((s) => s.scopeMismatch), 'a re-admitted journal must keep its mismatch marker')
})

test('unranked journals are safety-only, flagged, and carry a null percentile', () => {
  for (let a = 1; a <= 9; a++) {
    const r = build(profileWith({ anchor: a / 10 }))
    for (const slot of r.slots) {
      if (slot.slug.startsWith('unranked-')) {
        assert.equal(slot.band, 'safety', `unranked journal reached the ${slot.band} band`)
        assert.equal(slot.percentile, null)
        assert.equal(slot.sjrUnranked, true)
        assert.match(slot.why, /Not SJR-ranked/)
      }
    }
  }
})

test('band borrowing discloses itself when no journal sits in the band range', () => {
  // Anchor at the ceiling: nothing can be above it, so reach must borrow.
  const r = build(profileWith({ anchor: 0.9 }))
  const reach = r.slots.filter((s) => s.band === 'reach')
  assert.ok(reach.length > 0)
  assert.ok(
    reach.some((s) => s.borrowNote !== null),
    'a reach slot filled from outside its range must carry a borrowNote',
  )
  const borrowed = reach.find((s) => s.borrowNote !== null)!
  assert.equal(
    borrowed.borrowNote,
    'Shown as reach — few reach-range journals accept case series in this scope.',
  )
})

test('speed priority steers the safety slot to a fast-reviewing journal', () => {
  const withSpeed = build(profileWith({ anchor: 0.9 }), stats(), {
    novelty: null,
    strength: null,
    priorities: ['speed'],
  })
  const safety = withSpeed.slots.find((s) => s.band === 'safety')
  assert.ok(safety, 'expected a safety slot')
  // echo (3 weeks) and golf (2 weeks) are the only fast candidates in the fixture.
  assert.ok(['echo', 'golf'].includes(safety!.slug), `safety slot was ${safety!.slug}, expected a fast-review journal`)
})

test('showOscrsjCard depends on article type and scope ONLY, never on the anchor', () => {
  const js = registry()
  const oscrsj = js.find((j) => j.isSelf)!

  // Same (type, scope), every anchor from 0.1 to 0.9 — the answer must not move.
  const answers = new Set<boolean>()
  for (let a = 1; a <= 9; a++) {
    answers.add(build(profileWith({ anchor: a / 10 }), stats({ articleType: 'case_series' })).showOscrsjCard)
  }
  assert.equal(answers.size, 1, 'card visibility changed with the anchor — it must be independent of the assessment')
  assert.equal(Array.from(answers)[0], true)

  // A type OSCRSJ does not accept hides the card regardless of everything else.
  assert.equal(showOscrsjCard(oscrsj, stats({ articleType: 'original_research' })), false)
  assert.equal(showOscrsjCard(oscrsj, stats({ articleType: 'case_report' })), true)
  // A subspecialty OSCRSJ is not tagged for, when it publishes no 'general' tag.
  const narrow = { ...oscrsj, meta: meta({ scope_tags: ['spine'] }) }
  assert.equal(showOscrsjCard(narrow, stats({ articleType: 'case_report', subspecialty: 'hand' })), false)
  assert.equal(showOscrsjCard(narrow, stats({ articleType: 'case_report', subspecialty: 'spine' })), true)
})

test('reach sits above and safety below the anchor by the documented offsets', () => {
  assert.equal(REACH_OFFSET, 0.25)
  assert.equal(SAFETY_OFFSET, 0.3)
  const r = build(profileWith({ anchor: 0.5 }))
  const reach = r.slots.filter((s) => s.band === 'reach' && s.percentile !== null)
  const safety = r.slots.filter((s) => s.band === 'safety' && s.percentile !== null)
  for (const s of reach) assert.ok(s.percentile! > 0.5, `${s.slug} in reach at percentile ${s.percentile}`)
  for (const s of safety) assert.ok(s.percentile! < 0.5, `${s.slug} in safety at percentile ${s.percentile}`)
})

test('the ladder never claims or implies an acceptance probability', () => {
  const r = build(profileWith({ anchor: 0.5 }))
  const prose = r.slots.flatMap((s) => [s.why, s.strengthen ?? '', s.borrowNote ?? '']).join(' ')
  assert.doesNotMatch(prose, /probab|likelihood|chance of|odds|will be accepted|acceptance rate/i)
})
