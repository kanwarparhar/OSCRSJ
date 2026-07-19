// Journal Finder v1 — the deterministic match engine (Sushant, Session 2).
//
// PURE function of (manuscript stats, preferences, journal list). No LLM, no
// network, no DB, no clock. Same inputs → same output, always. This is the
// unit-tested heart of the Finder (tests/finder-match.test.ts).
//
// Pipeline per journal:
//   1. Eligibility gate — requested article type ∈ journal.articleTypes.
//      Fail → bucket 'not_eligible' with a reason; no scoring.
//   2. Constraint checks — word/abstract/references/figures/tables against the
//      journal's per-type limits. A null limit contributes NO check (neutral).
//      Each check is fit / near (≤10% over) / over, with the exact delta.
//   3. Scope match — user subspecialty vs journal.scope_tags (ordering only).
//   4. Bucket — Fits (0 over, 0 near) · Near fit (0 over, 1–2 near) ·
//      Needs work (any over, or ≥3 near) · Not eligible.
//   5. Order — bucket → scope → fit score → user-selected secondary sort → name.
//
// OSCRSJ is scored by the identical math; `isSelf` only drives UI badging.

import type {
  ConstraintCheck,
  ConstraintKey,
  FinderPreferences,
  FinderResult,
  IndexingService,
  JournalLimits,
  JournalScore,
  ManuscriptStats,
  MatchableJournal,
  SortKey,
  UncheckedStat,
} from './types'
import { INDEXING_SERVICES, SCOPE_TAG_LABELS } from './types'

/** A value at exactly +10% of the cap is still "near"; +10.0001% tips to "over". */
export const NEAR_FIT_RATIO = 0.1

/** Bucket sort rank (lower sorts first). */
const BUCKET_RANK = { fits: 0, near_fit: 1, needs_work: 2, not_eligible: 3 } as const

/**
 * Which supplied stat each constraint check is derived from. references_max and
 * references_min both come from referenceCount, so counting raw checks would
 * double-count one number — hence the map (see JournalScore.checkedCount).
 */
const CHECK_SOURCE_STAT: Record<ConstraintKey, keyof ManuscriptStats> = {
  word_count: 'wordCount',
  abstract: 'abstractWordCount',
  references: 'referenceCount',
  references_min: 'referenceCount',
  figures: 'figureCount',
  tables: 'tableCount',
}

/** The manuscript numbers the matcher can check, in display order. */
export const SUPPLIABLE_STATS = [
  'wordCount',
  'abstractWordCount',
  'referenceCount',
  'figureCount',
  'tableCount',
] as const satisfies readonly (keyof ManuscriptStats)[]

/** Human labels for the sparse-input warning. */
export const STAT_LABELS: Record<(typeof SUPPLIABLE_STATS)[number], string> = {
  wordCount: 'word count',
  abstractWordCount: 'abstract word count',
  referenceCount: 'reference count',
  figureCount: 'figure count',
  tableCount: 'table count',
}

/** How many of the five checkable numbers the author actually supplied. */
export function countSuppliedStats(stats: ManuscriptStats): number {
  return SUPPLIABLE_STATS.filter((k) => stats[k] !== null).length
}

interface CheckSpec {
  key: ConstraintKey
  label: string
  value: number | null
  limit: number | null
  /** references_min is a floor, not a cap: "over" means the count is too LOW. */
  floor?: boolean
}

/**
 * Classify one constraint. Returns null when it doesn't apply:
 *   - the journal is silent on this limit (limit === null → neutral), or
 *   - the author didn't supply the number (value === null → skipped).
 */
function classify(spec: CheckSpec): ConstraintCheck | null {
  if (spec.limit === null || spec.value === null) return null
  const { value, limit } = spec

  if (spec.floor) {
    // references_min: fit when value >= floor; otherwise short by (floor - value).
    if (value >= limit) return null // meeting a floor is unremarkable → no card
    const short = limit - value
    const status = short <= limit * NEAR_FIT_RATIO ? 'near' : 'over'
    return { key: spec.key, label: spec.label, value, limit, status, delta: short }
  }

  if (value <= limit) {
    return { key: spec.key, label: spec.label, value, limit, status: 'fit', delta: 0 }
  }
  const over = value - limit
  // Guard the boundary against float dust so exactly +10% lands on 'near'.
  const status = over <= limit * NEAR_FIT_RATIO + 1e-9 ? 'near' : 'over'
  return { key: spec.key, label: spec.label, value, limit, status, delta: over }
}

/** Rank of the best index a journal holds (lower = more prestigious). */
function bestIndexRank(indexing: IndexingService[]): number {
  let best: number = INDEXING_SERVICES.length // "unindexed" sorts last
  for (const svc of indexing) {
    const r = INDEXING_SERVICES.indexOf(svc)
    if (r >= 0 && r < best) best = r
  }
  return best
}

/**
 * Best-effort "weeks to first decision" parsed from the free-text review_speed
 * string, for the review-speed sort only. Unparseable → Infinity (sorts last).
 */
export function parseReviewWeeks(speed: string | null): number {
  if (!speed) return Infinity
  const m = speed.match(/(\d+(?:\.\d+)?)\s*(day|week|month)/i)
  if (!m) return Infinity
  const n = parseFloat(m[1])
  const unit = m[2].toLowerCase()
  if (unit === 'day') return n / 7
  if (unit === 'month') return n * 4.345
  return n
}

/** Score one journal against the manuscript. Deterministic + side-effect-free. */
function scoreOne(stats: ManuscriptStats, j: MatchableJournal): JournalScore {
  const base = {
    slug: j.slug,
    name: j.name,
    abbrev: j.abbrev,
    publisher: j.publisher,
    guidelinesUrl: j.guidelinesUrl,
    verifiedDate: j.verifiedDate,
    isSelf: j.isSelf,
    meta: j.meta,
  }

  // 1. Eligibility gate ------------------------------------------------------
  if (!j.articleTypes.includes(stats.articleType)) {
    return {
      ...base,
      bucket: 'not_eligible',
      eligible: false,
      ineligibleReason: `${j.name} does not accept ${articleTypePhrase(stats.articleType)}.`,
      checks: [],
      checkedCount: 0,
      suppliedCount: countSuppliedStats(stats),
      scopeMatch: false,
      scopeMismatch: false,
      scopeScore: 0,
      fitScore: 0,
    }
  }

  // 2. Constraint checks -----------------------------------------------------
  const lim = j.limits
  const specs: CheckSpec[] = [
    { key: 'word_count', label: 'Word count', value: stats.wordCount, limit: lim?.manuscript_max_words ?? null },
    { key: 'abstract', label: 'Abstract words', value: stats.abstractWordCount, limit: lim?.abstract_max_words ?? null },
    { key: 'references', label: 'References', value: stats.referenceCount, limit: lim?.references_max ?? null },
    { key: 'references_min', label: 'References (minimum)', value: stats.referenceCount, limit: lim?.references_min ?? null, floor: true },
    { key: 'figures', label: 'Figures', value: stats.figureCount, limit: lim?.figures_max ?? null },
    { key: 'tables', label: 'Tables', value: stats.tableCount, limit: lim?.tables_max ?? null },
  ]
  const checks = specs.map(classify).filter((c): c is ConstraintCheck => c !== null)

  const overCount = checks.filter((c) => c.status === 'over').length
  const nearCount = checks.filter((c) => c.status === 'near').length
  const fitCount = checks.filter((c) => c.status === 'fit').length

  // Distinct supplied numbers this journal actually had a limit for.
  const checkedCount = new Set(checks.map((c) => CHECK_SOURCE_STAT[c.key])).size

  // 3. Scope match -----------------------------------------------------------
  let scopeScore = 0
  let scopeMatch = false
  let scopeMismatch = false
  if (stats.subspecialty) {
    if (j.meta.scope_tags.includes(stats.subspecialty)) {
      scopeScore = 1
      scopeMatch = true
    } else if (j.meta.scope_tags.includes('general')) {
      scopeScore = 0.5
    } else if (j.meta.scope_tags.length > 0) {
      // The journal publishes a scope and this manuscript is outside it. An
      // empty tag list means "we don't know this journal's scope", which is
      // silence, not a mismatch (unknown ⇒ null doctrine).
      scopeMismatch = true
    }
  }

  // 4. Bucket ----------------------------------------------------------------
  let bucket: JournalScore['bucket']
  if (overCount > 0) bucket = 'needs_work'
  else if (nearCount === 0) bucket = 'fits'
  else if (nearCount <= 2) bucket = 'near_fit'
  else bucket = 'needs_work'

  // Fit score for ordering within a bucket: rewards clean fits, penalises misses.
  const fitScore = fitCount * 1 - nearCount * 0.5 - overCount * 2

  return {
    ...base,
    bucket,
    eligible: true,
    ineligibleReason: null,
    checks,
    checkedCount,
    suppliedCount: countSuppliedStats(stats),
    scopeMatch,
    scopeMismatch,
    scopeScore,
    fitScore,
  }
}

/** Article-type phrase used in the ineligibility reason ("does not accept …"). */
function articleTypePhrase(t: ManuscriptStats['articleType']): string {
  const map: Record<string, string> = {
    case_report: 'case reports',
    case_series: 'case series',
    original_research: 'original research articles',
    review: 'review articles',
    systematic_review: 'systematic reviews / meta-analyses',
    narrative_review: 'narrative reviews',
    technical_note: 'technical notes / surgical techniques',
    letter: 'letters to the editor',
    editorial: 'editorials',
  }
  return map[t] ?? 'this article type'
}

/**
 * Re-order an already-scored list. Pure + client-safe (operates on JournalScore
 * objects only), so the UI can switch the secondary sort without re-fetching /
 * re-scoring — the registry the matcher needs is server-only.
 *
 * Ordering (build brief §8.2): bucket → scope match → fit score → the
 * user-selected secondary sort → name (stable final tiebreak).
 */
export function sortScores(scored: JournalScore[], sortBy: SortKey): JournalScore[] {
  const secondary = (a: JournalScore, b: JournalScore): number => {
    switch (sortBy) {
      case 'indexing':
        return bestIndexRank(a.meta.indexing) - bestIndexRank(b.meta.indexing)
      case 'review_speed':
        return parseReviewWeeks(a.meta.review_speed) - parseReviewWeeks(b.meta.review_speed)
      case 'apc_asc': {
        const av = a.meta.apc_usd ?? Number.POSITIVE_INFINITY
        const bv = b.meta.apc_usd ?? Number.POSITIVE_INFINITY
        return av - bv
      }
      default:
        return 0
    }
  }

  return [...scored].sort((a, b) => {
    const byBucket = BUCKET_RANK[a.bucket] - BUCKET_RANK[b.bucket]
    if (byBucket !== 0) return byBucket
    // Ineligible journals: order alphabetically, nothing else applies.
    if (a.bucket === 'not_eligible') return a.name.localeCompare(b.name)
    if (b.scopeScore !== a.scopeScore) return b.scopeScore - a.scopeScore
    // Evidence outranks silence: a journal verified against at least one real
    // limit sorts above a journal where nothing could be checked, within the
    // same bucket. Without this, journals that publish no limits float to the
    // top of "Fits" purely because there was nothing there to fail.
    const aHasChecks = a.checkedCount > 0 ? 1 : 0
    const bHasChecks = b.checkedCount > 0 ? 1 : 0
    if (aHasChecks !== bHasChecks) return bHasChecks - aHasChecks
    if (b.fitScore !== a.fitScore) return b.fitScore - a.fitScore
    const bySecondary = secondary(a, b)
    if (bySecondary !== 0) return bySecondary
    return a.name.localeCompare(b.name)
  })
}

/** The journal limit each supplied stat is checked against. */
const STAT_LIMIT_KEY: Record<(typeof SUPPLIABLE_STATS)[number], keyof JournalLimits> = {
  wordCount: 'manuscript_max_words',
  abstractWordCount: 'abstract_max_words',
  // references_min exists too, but the cap is the headline constraint.
  referenceCount: 'references_max',
  figureCount: 'figures_max',
  tableCount: 'tables_max',
}

/**
 * For each number the author left blank, how many ELIGIBLE journals publish a
 * limit we therefore could not check. Only eligible journals count: a limit on
 * a journal that will not take this article type is not a missed check.
 * Stats no eligible journal has a limit for are omitted (nothing to warn about).
 *
 * The client cannot compute this — it has no view of limits for stats it never
 * sent — so it is derived here alongside the scoring.
 */
export function computeUncheckedStats(
  stats: ManuscriptStats,
  journals: MatchableJournal[],
): UncheckedStat[] {
  const eligible = journals.filter((j) => j.articleTypes.includes(stats.articleType))
  const out: UncheckedStat[] = []
  for (const stat of SUPPLIABLE_STATS) {
    if (stats[stat] !== null) continue
    const journalsWithLimit = eligible.filter((j) => j.limits?.[STAT_LIMIT_KEY[stat]] != null).length
    if (journalsWithLimit > 0) {
      out.push({ stat, label: STAT_LABELS[stat], journalsWithLimit })
    }
  }
  return out
}

/**
 * Score + rank the whole registry against one manuscript. Pure.
 */
export function scoreJournals(
  stats: ManuscriptStats,
  prefs: FinderPreferences,
  journals: MatchableJournal[],
): FinderResult {
  const scored = sortScores(
    journals.map((j) => scoreOne(stats, j)),
    prefs.sortBy,
  )

  const counts = { fits: 0, near_fit: 0, needs_work: 0, not_eligible: 0 }
  for (const s of scored) counts[s.bucket]++

  const topResult = scored.length > 0 && scored[0].bucket !== 'not_eligible' ? scored[0].slug : null

  return {
    results: scored,
    counts,
    topResult,
    uncheckedStats: computeUncheckedStats(stats, journals),
  }
}

/** Short human summary of a check for the scorecard, e.g. "3,180 / 3,000 — 180 over". */
export function describeCheck(c: ConstraintCheck): string {
  const v = c.value.toLocaleString('en-US')
  const l = c.limit.toLocaleString('en-US')
  if (c.status === 'fit') return `${v} / ${l}`
  if (c.key === 'references_min') return `${v} / ${l} min — ${c.delta.toLocaleString('en-US')} short`
  return `${v} / ${l} — ${c.delta.toLocaleString('en-US')} over`
}

export { SCOPE_TAG_LABELS }
