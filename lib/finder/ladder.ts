// Journal Finder v2 — the reach / target / safety ladder (2026-07-25).
//
// Pure and deterministic: same inputs, same five journals, every time. No LLM,
// no network, no DB. Everything the author is shown is either a verified number
// or a template composed from one.
//
// WHY THE BANDS ARE RELATIVE, NOT ABSOLUTE. All 75 registry journals were drawn
// from the SJR top-100 of a single Scimago category, so nearly all are Q1 —
// absolute quartiles discriminate nothing. Absolute category rank is worse: it
// puts JBJS at #31, below several sports-science titles, because SJR rewards
// citation volume rather than the standing a surgeon would recognize. So a
// journal's percentile is computed WITHIN THE SET ELIGIBLE FOR THIS MANUSCRIPT.
// A spine case series is banded among spine-eligible journals; JBJS and BJSM
// never appear in that ladder unless they genuinely accept the work. This is
// also what makes case-report ladders work at all, since case-report venues
// cluster low in absolute rank.
//
// OSCRSJ IS EXCLUDED BEFORE SLOTTING, NOT DEMOTED WITHIN IT. Our own journal is
// removed at candidate-set construction (step 2). It can only reach the author
// through the separately disclosed OSCRSJ card, whose visibility is a pure
// function of article type and scope — never of the manuscript's assessment.
// Recommending ourselves off the back of an assessment we performed is the
// conflict of interest this whole product is positioned against.
//
// NO ACCEPTANCE PREDICTION. There is no probability anywhere in this file, and
// there must never be one. The ladder reports tier alignment.

import { articleTypePhrase, bestIndexRank, parseReviewWeeks, scoreJournals } from './match'
import { SJR_CATEGORY } from './sjrData'
import { SCOPE_TAG_LABELS, type FinderPreferences, type JournalScore, type ManuscriptStats, type MatchableJournal } from './types'
import type {
  AuthorPriority,
  LadderBand,
  LadderResult,
  LadderSlot,
  ManuscriptProfile,
  SelfAssessment,
} from './profileTypes'

/** How far above the anchor a reach journal sits. */
export const REACH_OFFSET = 0.25
/** How far below the anchor a safety journal sits. */
export const SAFETY_OFFSET = 0.3
/** Below this many candidates, scope-mismatched journals are re-admitted. */
export const SCOPE_STRICT_MIN = 8
/** Below this many candidates the ladder is shortened rather than padded. */
export const SMALL_SET_MIN = 5
/** "Fast" for the speed-priority safety preference. */
export const FAST_REVIEW_WEEKS = 26

interface Candidate {
  score: JournalScore
  journal: MatchableJournal
  percentile: number | null
  sjrUnranked: boolean
}

/* -------------------------------- templates -------------------------------- */

const BAND_OPENER: Record<LadderBand, string> = {
  reach: "Above your manuscript's verified tier — worth a shot if you can absorb a longer path.",
  target: "Aligned with your manuscript's verified tier.",
  safety: "A dependable venue if higher-tier submissions don't land.",
}

/**
 * Compose the "why" line. Template-only by design: a model-written rationale
 * would be the one place in the product where a claim appears that nothing
 * verified. Every clause here is driven by a value we hold.
 */
export function composeWhy(c: Candidate, band: LadderBand, subspecialty: ManuscriptStats['subspecialty']): string {
  let s = BAND_OPENER[band]
  if (c.score.scopeMatch && subspecialty) {
    s += ` Publishes ${SCOPE_TAG_LABELS[subspecialty].toLowerCase()} work specifically.`
  }
  const sjr = c.journal.meta.sjr
  if (c.percentile !== null && sjr.sjr !== null && sjr.categoryRank !== null) {
    s += ` SJR ${sjr.sjr} — #${sjr.categoryRank} in ${SJR_CATEGORY}.`
  }
  if (c.sjrUnranked) {
    const idx = c.journal.meta.indexing
    s += ` Not SJR-ranked; indexing: ${idx.length ? idx.join(', ') : 'none recorded'}.`
  }
  return s
}

/**
 * The single most common gate at the next tier up, for REACH slots only.
 * First match wins — one concrete thing to fix beats a list nobody acts on.
 * Every line describes what the manuscript does not yet show; none of them
 * promises that fixing it changes an editorial decision.
 */
export function composeStrengthen(profile: ManuscriptProfile, selfAssessment: SelfAssessment | null): string | null {
  const design = profile.design.value
  const n = profile.sampleSize.value
  const m = profile.followUpMonths.value

  if (profile.comparative.value === false && (design === 'case_series' || design === 'retrospective_comparative')) {
    return 'A comparison or control group is the most common gate at higher-tier journals.'
  }
  if (n !== null && n < 30 && design !== 'case_report') {
    return `A larger cohort (this study reports n=${n}) would strengthen candidacy at this tier.`
  }
  if (profile.statsReported.value === false && profile.comparative.value === true) {
    return 'Reporting effect sizes with confidence intervals for the primary outcome would materially strengthen the submission.'
  }
  if (design === 'case_report' && selfAssessment?.novelty === 'adds_to_known') {
    return 'Higher-tier case-report venues prioritize first-reported or management-changing cases — lead with what this case changes.'
  }
  if (
    m !== null &&
    m < 12 &&
    (design === 'rct' || design === 'prospective_cohort' || design === 'retrospective_comparative')
  ) {
    return `Longer follow-up (currently ${m} months) would strengthen the submission.`
  }
  return null
}

/* ------------------------------- comparators ------------------------------- */

function priorityComparator(p: AuthorPriority): (a: Candidate, b: Candidate) => number {
  switch (p) {
    case 'speed':
      return (a, b) => parseReviewWeeks(a.journal.meta.review_speed) - parseReviewWeeks(b.journal.meta.review_speed)
    case 'cost':
      return (a, b) => {
        const av = a.journal.meta.apc_usd
        const bv = b.journal.meta.apc_usd
        if (av === null && bv === null) return 0
        if (av === null) return 1
        if (bv === null) return -1
        return av - bv
      }
    case 'oa_visibility':
      return (a, b) => {
        const oa = (c: Candidate) => (c.journal.meta.oa_model === 'oa' ? 0 : 1)
        const d = oa(a) - oa(b)
        return d !== 0 ? d : bestIndexRank(a.journal.meta.indexing) - bestIndexRank(b.journal.meta.indexing)
      }
    case 'prestige':
      return (a, b) => (b.journal.meta.sjr.sjr ?? -Infinity) - (a.journal.meta.sjr.sjr ?? -Infinity)
  }
}

/** Distance to the band's anchor, then the author's priorities in their order, then name. */
function pickBest(pool: Candidate[], anchor: number, priorities: AuthorPriority[]): Candidate | null {
  if (pool.length === 0) return null
  const comparators = priorities.map(priorityComparator)
  const sorted = [...pool].sort((a, b) => {
    const da = Math.abs((a.percentile ?? 0) - anchor)
    const db = Math.abs((b.percentile ?? 0) - anchor)
    if (da !== db) return da - db
    for (const cmp of comparators) {
      const d = cmp(a, b)
      if (d !== 0) return d
    }
    return a.journal.name.localeCompare(b.journal.name)
  })
  return sorted[0]
}

/* -------------------------------- the ladder ------------------------------- */

/**
 * Should the OSCRSJ card appear?
 *
 * PURE FUNCTION OF (article type, subspecialty). The profile and the anchor are
 * deliberately NOT parameters of this function, and must never become them: if
 * our own journal's visibility depended on an assessment we performed, the
 * disclosure on the card would be a fig leaf. A test asserts this independence.
 */
export function showOscrsjCard(oscrsj: MatchableJournal | undefined, stats: ManuscriptStats): boolean {
  if (!oscrsj) return false
  if (!oscrsj.articleTypes.includes(stats.articleType)) return false
  if (stats.subspecialty === null) return true
  const tags = oscrsj.meta.scope_tags
  return tags.length === 0 || tags.includes(stats.subspecialty) || tags.includes('general')
}

export function buildLadder(
  profile: ManuscriptProfile,
  selfAssessment: SelfAssessment | null,
  stats: ManuscriptStats,
  prefs: FinderPreferences,
  journals: MatchableJournal[],
): LadderResult {
  // 1. v1 scores everything — this is what preserves the constraint checks for
  //    the formatting-fit rows and the full "all eligible journals" list.
  const scored = scoreJournals(stats, prefs, journals)
  const bySlug = new Map(journals.map((j) => [j.slug, j]))

  const allEligible = scored.results.filter((r) => r.eligible)

  // 2. Candidate set. isSelf is dropped HERE, before any slotting, and nothing
  //    downstream may re-admit it.
  const eligibleNonSelf = allEligible.filter((r) => !r.isSelf)
  const strict = eligibleNonSelf.filter((r) => !r.scopeMismatch)
  // A strict scope filter that leaves almost nothing is worse than a marked
  // mismatch: the author gets a shortened ladder instead of usable options.
  const chosen = strict.length >= SCOPE_STRICT_MIN ? strict : eligibleNonSelf

  // 3. Order by SJR; unranked journals go last, alphabetically among themselves.
  const ranked = chosen
    .filter((r) => bySlug.get(r.slug)?.meta.sjr.sjr != null)
    .sort((a, b) => (bySlug.get(b.slug)!.meta.sjr.sjr ?? 0) - (bySlug.get(a.slug)!.meta.sjr.sjr ?? 0))
  const unranked = chosen
    .filter((r) => bySlug.get(r.slug)?.meta.sjr.sjr == null)
    .sort((a, b) => a.name.localeCompare(b.name))

  const R = ranked.length

  // 4. Percentile within the eligible set (1 = highest SJR present).
  const candidates: Candidate[] = [
    ...ranked.map((score, i) => ({
      score,
      journal: bySlug.get(score.slug)!,
      percentile: R === 1 ? 0.5 : 1 - i / (R - 1),
      sjrUnranked: false,
    })),
    ...unranked.map((score) => ({
      score,
      journal: bySlug.get(score.slug)!,
      percentile: null,
      sjrUnranked: true,
    })),
  ]

  const anchor = profile.anchor
  const priorities = selfAssessment?.priorities ?? []
  const used = new Set<string>()
  const slots: LadderSlot[] = []

  const remaining = () => candidates.filter((c) => !used.has(c.score.slug))

  /**
   * Fill one slot. `restrict` narrows to the band's own range; when that range
   * is empty we BORROW the nearest journal from the whole pool and say so on the
   * card. A borrowed slot with a disclosure beats a silently mislabelled one,
   * and beats an empty rung.
   */
  const fill = (band: LadderBand, bandAnchor: number, restrict: (c: Candidate) => boolean) => {
    const pool = remaining()
    if (pool.length === 0) return
    const inRange = pool.filter(restrict)
    const borrowed = inRange.length === 0
    const pick = pickBest(borrowed ? pool : inRange, bandAnchor, priorities)
    if (!pick) return
    used.add(pick.score.slug)
    slots.push({
      band,
      slug: pick.score.slug,
      name: pick.score.name,
      abbrev: pick.score.abbrev,
      percentile: pick.percentile,
      sjrUnranked: pick.sjrUnranked,
      why: composeWhy(pick, band, stats.subspecialty),
      strengthen: band === 'reach' ? composeStrengthen(profile, selfAssessment) : null,
      borrowNote: borrowed
        ? `Shown as ${band} — few ${band}-range journals accept ${articleTypePhrase(stats.articleType)} in this scope.`
        : null,
      checks: pick.score.checks,
      checkedCount: pick.score.checkedCount,
      scopeMismatch: pick.score.scopeMismatch,
      meta: pick.journal.meta,
      guidelinesUrl: pick.journal.guidelinesUrl,
    })
  }

  const reachAnchor = Math.min(anchor + REACH_OFFSET, 0.98)
  const safetyAnchor = Math.max(anchor - SAFETY_OFFSET, 0.02)

  // Unranked journals are safety-only: with no standing we cannot honestly call
  // one a reach. Excluding them outright would gut case-report ladders (jocr is
  // the registry's canonical case-report venue and carries no SJR rank).
  const reachOk = (c: Candidate) => c.percentile !== null && c.percentile > anchor
  const targetOk = (c: Candidate) => c.percentile !== null
  const safetyOk = (c: Candidate) => c.percentile === null || c.percentile < anchor

  const smallSet = candidates.length < SMALL_SET_MIN
  if (smallSet) {
    // Shortened, never padded: fill the rungs that matter most first.
    fill('target', anchor, targetOk)
    fill('safety', safetyAnchor, safetyOk)
    fill('reach', reachAnchor, reachOk)
  } else {
    fill('reach', reachAnchor, reachOk)
    fill('reach', reachAnchor, reachOk)
    fill('target', anchor, targetOk)
    fill('target', anchor, targetOk)
    // Speed-first authors get the fastest qualifying safety net, when one exists.
    const wantsSpeed = priorities.includes('speed')
    const fastPool = candidates.filter(
      (c) => !used.has(c.score.slug) && safetyOk(c) && parseReviewWeeks(c.journal.meta.review_speed) < FAST_REVIEW_WEEKS,
    )
    if (wantsSpeed && fastPool.length > 0) {
      fill('safety', safetyAnchor, (c) => safetyOk(c) && parseReviewWeeks(c.journal.meta.review_speed) < FAST_REVIEW_WEEKS)
    } else {
      fill('safety', safetyAnchor, safetyOk)
    }
  }

  const order: Record<LadderBand, number> = { reach: 0, target: 1, safety: 2 }
  slots.sort((a, b) => order[a.band] - order[b.band])

  const oscrsj = journals.find((j) => j.isSelf)

  return {
    slots,
    eligibleCount: allEligible.length,
    showOscrsjCard: showOscrsjCard(oscrsj, stats),
    allEligible,
    smallSetNote: smallSet
      ? `Only ${candidates.length} journals in our registry accept ${articleTypePhrase(stats.articleType)} in this scope. The ladder is shortened, not padded.`
      : null,
  }
}
