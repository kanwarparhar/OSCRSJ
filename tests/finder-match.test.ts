// Journal Finder match-engine unit tests (Sushant, Session 2). The engine is a
// pure function, so every case is constructed from hand-built fixtures — no
// registry, no network. Covers: eligibility gate, the ±10% near-fit boundary,
// null-limit neutrality, unsupplied-stat skipping, references_min floor, bucket
// assignment, OSCRSJ no-boost, scope ordering, and each secondary sort.

import { test } from 'node:test'
import assert from 'node:assert'
import { scoreJournals, NEAR_FIT_RATIO, parseReviewWeeks } from '../lib/finder/match'
import type {
  JournalMeta,
  JournalLimits,
  ManuscriptStats,
  MatchableJournal,
  ScopeTag,
  IndexingService,
  OaModel,
} from '../lib/finder/types'
import type { ArticleType } from '../lib/formatting/rulesSchema'

/* --------------------------------- fixtures -------------------------------- */

const NO_LIMITS: JournalLimits = {
  manuscript_max_words: null,
  abstract_max_words: null,
  references_min: null,
  references_max: null,
  figures_max: null,
  tables_max: null,
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
    ...over,
  }
}

function journal(over: Partial<MatchableJournal> & { slug: string }): MatchableJournal {
  return {
    name: over.slug.toUpperCase(),
    abbrev: over.slug.toUpperCase(),
    publisher: 'Test Publisher',
    guidelinesUrl: 'https://example.com/guide',
    verifiedDate: '2026-07-15',
    isSelf: false,
    articleTypes: ['case_report'],
    limits: { ...NO_LIMITS },
    meta: meta(),
    ...over,
  }
}

function stats(over: Partial<ManuscriptStats> = {}): ManuscriptStats {
  return {
    articleType: 'case_report',
    wordCount: null,
    abstractWordCount: null,
    figureCount: null,
    tableCount: null,
    referenceCount: null,
    subspecialty: null,
    ...over,
  }
}

const FIT = { sortBy: 'fit' } as const

/* ---------------------------------- tests ---------------------------------- */

test('1. eligibility gate: journal that does not accept the type is not_eligible', () => {
  const jbjs = journal({ slug: 'jbjs', name: 'JBJS', articleTypes: ['original_research', 'letter'] })
  const r = scoreJournals(stats({ articleType: 'case_report' }), FIT, [jbjs])
  const s = r.results[0]
  assert.equal(s.bucket, 'not_eligible')
  assert.equal(s.eligible, false)
  assert.match(s.ineligibleReason ?? '', /JBJS does not accept case reports/)
  assert.equal(r.topResult, null)
})

test('2. all constraints fit → bucket fits, no over/near checks', () => {
  const j = journal({
    slug: 'ok',
    limits: { ...NO_LIMITS, manuscript_max_words: 3000, figures_max: 8 },
  })
  const r = scoreJournals(stats({ wordCount: 1800, figureCount: 3 }), FIT, [j])
  const s = r.results[0]
  assert.equal(s.bucket, 'fits')
  assert.ok(s.checks.every((c) => c.status === 'fit'))
})

test('3. near-fit boundary: EXACTLY +10% over is "near"', () => {
  const j = journal({ slug: 'edge', limits: { ...NO_LIMITS, manuscript_max_words: 3000 } })
  // 3000 * 1.10 = 3300 → exactly the boundary.
  const r = scoreJournals(stats({ wordCount: 3300 }), FIT, [j])
  const wc = r.results[0].checks.find((c) => c.key === 'word_count')!
  assert.equal(wc.status, 'near')
  assert.equal(wc.delta, 300)
  assert.equal(r.results[0].bucket, 'near_fit')
})

test('4. just past +10% is "over" → needs_work', () => {
  const j = journal({ slug: 'edge2', limits: { ...NO_LIMITS, manuscript_max_words: 3000 } })
  const r = scoreJournals(stats({ wordCount: 3301 }), FIT, [j])
  const wc = r.results[0].checks.find((c) => c.key === 'word_count')!
  assert.equal(wc.status, 'over')
  assert.equal(r.results[0].bucket, 'needs_work')
})

test('5. null limit contributes NEUTRAL — no check, no bucket effect', () => {
  const j = journal({ slug: 'silent', limits: { ...NO_LIMITS, figures_max: null } })
  const r = scoreJournals(stats({ figureCount: 99 }), FIT, [j])
  const s = r.results[0]
  assert.equal(s.checks.length, 0, 'a null limit produces no check')
  assert.equal(s.bucket, 'fits')
})

test('6. unsupplied stat is skipped even when the journal has a limit', () => {
  const j = journal({ slug: 'nostat', limits: { ...NO_LIMITS, manuscript_max_words: 100 } })
  const r = scoreJournals(stats({ wordCount: null }), FIT, [j])
  assert.equal(r.results[0].checks.length, 0)
  assert.equal(r.results[0].bucket, 'fits')
})

test('7. references_min floor: below the minimum flags "over" (short)', () => {
  const j = journal({ slug: 'floor', limits: { ...NO_LIMITS, references_min: 30 } })
  const r = scoreJournals(stats({ referenceCount: 10 }), FIT, [j])
  const c = r.results[0].checks.find((x) => x.key === 'references_min')!
  assert.equal(c.status, 'over')
  assert.equal(c.delta, 20)
  assert.equal(r.results[0].bucket, 'needs_work')
})

test('7b. references_min met → no card', () => {
  const j = journal({ slug: 'floor2', limits: { ...NO_LIMITS, references_min: 5 } })
  const r = scoreJournals(stats({ referenceCount: 12 }), FIT, [j])
  assert.equal(r.results[0].checks.length, 0)
  assert.equal(r.results[0].bucket, 'fits')
})

test('8. references_max cap over → needs_work with exact delta', () => {
  const j = journal({ slug: 'refcap', limits: { ...NO_LIMITS, references_max: 25 } })
  const r = scoreJournals(stats({ referenceCount: 40 }), FIT, [j])
  const c = r.results[0].checks.find((x) => x.key === 'references')!
  assert.equal(c.status, 'over')
  assert.equal(c.delta, 15)
})

test('9. bucket: 1–2 near with zero over → near_fit', () => {
  const j = journal({
    slug: 'twonear',
    limits: { ...NO_LIMITS, manuscript_max_words: 3000, abstract_max_words: 300 },
  })
  // both exactly +10% → two near, zero over
  const r = scoreJournals(stats({ wordCount: 3300, abstractWordCount: 330 }), FIT, [j])
  assert.equal(r.results[0].bucket, 'near_fit')
})

test('10. bucket: 3 near with zero over → needs_work', () => {
  const j = journal({
    slug: 'threenear',
    limits: { ...NO_LIMITS, manuscript_max_words: 3000, abstract_max_words: 300, references_max: 30 },
  })
  const r = scoreJournals(
    stats({ wordCount: 3300, abstractWordCount: 330, referenceCount: 33 }),
    FIT,
    [j],
  )
  assert.equal(r.results[0].bucket, 'needs_work')
})

test('11. OSCRSJ no-boost: a better-fitting rival ranks above self', () => {
  const oscrsj = journal({
    slug: 'oscrsj',
    name: 'OSCRSJ',
    isSelf: true,
    limits: { ...NO_LIMITS, manuscript_max_words: 2000 }, // 2100 → over → needs_work
  })
  const rival = journal({
    slug: 'jocr',
    name: 'JOCR',
    limits: { ...NO_LIMITS, manuscript_max_words: 3000 }, // 2100 → fits
  })
  const r = scoreJournals(stats({ wordCount: 2100 }), FIT, [oscrsj, rival])
  assert.equal(r.results[0].slug, 'jocr', 'the better fit wins regardless of self')
  assert.equal(r.results[1].slug, 'oscrsj')
  assert.equal(r.topResult, 'jocr')
})

test('11b. OSCRSJ self does NOT jump ahead of an equal-fit rival', () => {
  const oscrsj = journal({ slug: 'oscrsj', name: 'OSCRSJ', isSelf: true, limits: { ...NO_LIMITS, manuscript_max_words: 3000 } })
  const rival = journal({ slug: 'aaa', name: 'AAA Journal', limits: { ...NO_LIMITS, manuscript_max_words: 3000 } })
  const r = scoreJournals(stats({ wordCount: 1000 }), FIT, [oscrsj, rival])
  // Equal bucket/scope/fit → alphabetical by name; "AAA Journal" precedes "OSCRSJ".
  assert.equal(r.results[0].slug, 'aaa')
})

test('12. scope match orders above an equal-fit non-matching journal', () => {
  const spineJ = journal({
    slug: 'spine',
    name: 'Spine Journal',
    articleTypes: ['case_report'],
    limits: { ...NO_LIMITS },
    meta: meta({ scope_tags: ['spine'] as ScopeTag[] }),
  })
  const sportsJ = journal({
    slug: 'sports',
    name: 'Sports Journal',
    articleTypes: ['case_report'],
    limits: { ...NO_LIMITS },
    meta: meta({ scope_tags: ['sports'] as ScopeTag[] }),
  })
  const r = scoreJournals(stats({ subspecialty: 'spine' }), FIT, [sportsJ, spineJ])
  assert.equal(r.results[0].slug, 'spine')
  assert.equal(r.results[0].scopeMatch, true)
  assert.equal(r.results[1].scopeMatch, false)
})

test('12b. general-tagged journal beats a no-match journal but loses to an exact match', () => {
  const exact = journal({ slug: 'exact', name: 'Exact', meta: meta({ scope_tags: ['hand'] as ScopeTag[] }) })
  const general = journal({ slug: 'general', name: 'General', meta: meta({ scope_tags: ['general'] as ScopeTag[] }) })
  const none = journal({ slug: 'none', name: 'None', meta: meta({ scope_tags: ['spine'] as ScopeTag[] }) })
  const r = scoreJournals(stats({ subspecialty: 'hand' }), FIT, [none, general, exact])
  assert.deepEqual(r.results.map((x) => x.slug), ['exact', 'general', 'none'])
})

test('13. secondary sort apc_asc: cheaper APC first among ties (null APC last)', () => {
  const cheap = journal({ slug: 'cheap', name: 'Zeta', meta: meta({ apc_usd: 100 }) })
  const pricey = journal({ slug: 'pricey', name: 'Alpha', meta: meta({ apc_usd: 2000 }) })
  const unknown = journal({ slug: 'unknown', name: 'Beta', meta: meta({ apc_usd: null }) })
  const r = scoreJournals(stats(), { sortBy: 'apc_asc' }, [pricey, unknown, cheap])
  assert.deepEqual(r.results.map((x) => x.slug), ['cheap', 'pricey', 'unknown'])
})

test('14. secondary sort indexing: MEDLINE ranks above DOAJ-only among ties', () => {
  const medline = journal({ slug: 'med', name: 'Zeta', meta: meta({ indexing: ['MEDLINE'] as IndexingService[] }) })
  const doaj = journal({ slug: 'doaj', name: 'Alpha', meta: meta({ indexing: ['DOAJ'] as IndexingService[] }) })
  const none = journal({ slug: 'none', name: 'Mu', meta: meta({ indexing: [] }) })
  const r = scoreJournals(stats(), { sortBy: 'indexing' }, [none, doaj, medline])
  assert.deepEqual(r.results.map((x) => x.slug), ['med', 'doaj', 'none'])
})

test('15. counts + topResult reflect the full sorted set', () => {
  const fits = journal({ slug: 'a', name: 'A', limits: { ...NO_LIMITS, manuscript_max_words: 5000 } })
  const needs = journal({ slug: 'b', name: 'B', limits: { ...NO_LIMITS, manuscript_max_words: 1000 } })
  const inelig = journal({ slug: 'c', name: 'C', articleTypes: ['letter'] })
  const r = scoreJournals(stats({ wordCount: 2000 }), FIT, [needs, inelig, fits])
  assert.equal(r.counts.fits, 1)
  assert.equal(r.counts.needs_work, 1)
  assert.equal(r.counts.not_eligible, 1)
  assert.equal(r.topResult, 'a')
  assert.equal(r.results[r.results.length - 1].bucket, 'not_eligible')
})

test('16. sanity: exported constants + review-speed parser', () => {
  assert.equal(NEAR_FIT_RATIO, 0.1)
  assert.equal(parseReviewWeeks('~4 weeks to first decision'), 4)
  assert.equal(parseReviewWeeks('about 2 months'), 2 * 4.345)
  assert.equal(parseReviewWeeks('14 days'), 2)
  assert.equal(parseReviewWeeks(null), Infinity)
  assert.equal(parseReviewWeeks('fast'), Infinity)
})
