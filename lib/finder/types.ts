// Journal Finder v1 — shared contracts (Sushant, Session 2 / 2026-07-15).
//
// The Finder answers "where does this manuscript actually fit?" by scoring the
// journal registry against the numbers that describe a manuscript. The scoring
// engine (./match.ts) is a PURE, deterministic, unit-tested function — no LLM,
// no network, no DB. This module holds only the data shapes it reads and emits.
//
// DOCTRINE (mirrors the formatting service):
//   - Unknown ⇒ null. A journal silent on a limit contributes NEUTRAL — never a
//     guessed default, never a penalty. The engine never invents a requirement.
//   - Eligibility is a hard gate (article type). Everything else affects ordering
//     and the per-journal scorecard, never eligibility.
//   - OSCRSJ is scored by the same math as every other journal. No self-boost.

import type { ArticleType } from '@/lib/formatting/rulesSchema'

/** Controlled subspecialty vocabulary (build brief §8.3 `scope_tags`). */
export const SCOPE_TAGS = [
  'trauma',
  'arthroplasty',
  'sports',
  'spine',
  'hand',
  'foot-ankle',
  'shoulder-elbow',
  'pediatric',
  'oncology',
  'basic-science',
  'general',
] as const
export type ScopeTag = (typeof SCOPE_TAGS)[number]

/** Human labels for the subspecialty chips. */
export const SCOPE_TAG_LABELS: Record<ScopeTag, string> = {
  trauma: 'Trauma',
  arthroplasty: 'Arthroplasty',
  sports: 'Sports medicine',
  spine: 'Spine',
  hand: 'Hand & wrist',
  'foot-ankle': 'Foot & ankle',
  'shoulder-elbow': 'Shoulder & elbow',
  pediatric: 'Pediatric',
  oncology: 'Orthopedic oncology',
  'basic-science': 'Basic science',
  general: 'General orthopedics',
}

/** Indexing services, ranked most→least prestigious for the "Indexing" sort. */
export const INDEXING_SERVICES = ['MEDLINE', 'PMC', 'Scopus', 'ESCI', 'DOAJ'] as const
export type IndexingService = (typeof INDEXING_SERVICES)[number]

export type OaModel = 'oa' | 'hybrid' | 'subscription'

/**
 * Additive per-journal metadata the Finder needs but the formatting rule files
 * deliberately do not carry (kept separate so the Top-100 expansion lane stays
 * unblocked). Populated in lib/finder/journalMeta.ts from each journal's own
 * about / open-access pages; anything unverifiable is `null`, never guessed.
 */
export interface JournalMeta {
  indexing: IndexingService[]
  oa_model: OaModel | null
  apc_usd: number | null
  /** Verbatim from the journal page, e.g. "~4 weeks to first decision". */
  review_speed: string | null
  scope_tags: ScopeTag[]
  /** Derived from the rule file's article_types; not fetched. */
  accepts_case_reports: boolean | null
  source_urls: string[]
  /** ISO date the cells above were verified; null while unenriched. */
  verified_date: string | null
}

/** The numbers that describe a manuscript — the Finder's input. */
export interface ManuscriptStats {
  articleType: ArticleType
  /** null = the author didn't supply it → that constraint is skipped. */
  wordCount: number | null
  abstractWordCount: number | null
  figureCount: number | null
  tableCount: number | null
  referenceCount: number | null
  /** Single subspecialty pick; null = no scope preference. */
  subspecialty: ScopeTag | null
}

export type SortKey = 'fit' | 'indexing' | 'review_speed' | 'apc_asc'

export interface FinderPreferences {
  /** Secondary sort applied AFTER bucket → scope → fit (build brief §8.2). */
  sortBy: SortKey
}

/** Per-type limit slice pulled from a rule file's `word_limits[articleType]`. */
export interface JournalLimits {
  manuscript_max_words: number | null
  abstract_max_words: number | null
  references_min: number | null
  references_max: number | null
  figures_max: number | null
  tables_max: number | null
}

/**
 * Everything the pure matcher needs about one journal. The API route builds
 * these from JOURNALS + JOURNAL_META; tests construct them directly. Kept free
 * of the server-only rule registry so match.ts imports nothing heavy.
 */
export interface MatchableJournal {
  slug: string
  name: string
  abbrev: string
  publisher: string | null
  guidelinesUrl: string
  verifiedDate: string
  /** true only for OSCRSJ — used for badging + the disclosure line, NOT scoring. */
  isSelf: boolean
  articleTypes: ArticleType[]
  /** Limits for the requested article type (null when the journal doesn't take it). */
  limits: JournalLimits | null
  meta: JournalMeta
}

export type ConstraintStatus = 'fit' | 'near' | 'over' | 'neutral'

export type ConstraintKey =
  | 'word_count'
  | 'abstract'
  | 'references'
  | 'references_min'
  | 'figures'
  | 'tables'

/** One constraint check for one journal, with the exact numbers behind it. */
export interface ConstraintCheck {
  key: ConstraintKey
  label: string
  value: number
  limit: number
  status: Exclude<ConstraintStatus, 'neutral'>
  /** Signed overage (positive = over the cap; for references_min, positive = short). */
  delta: number
}

export type Bucket = 'fits' | 'near_fit' | 'needs_work' | 'not_eligible'

export interface JournalScore {
  slug: string
  name: string
  abbrev: string
  publisher: string | null
  guidelinesUrl: string
  verifiedDate: string
  isSelf: boolean
  bucket: Bucket
  eligible: boolean
  /** Non-null only when bucket === 'not_eligible'. */
  ineligibleReason: string | null
  /** Non-neutral checks only (a null limit produces no check). */
  checks: ConstraintCheck[]
  /**
   * How many of the author's supplied numbers this journal actually had a
   * limit for — i.e. how much of the verdict is evidence rather than silence.
   * A 'fits' bucket with checkedCount === 0 means NOTHING was verified; the UI
   * must not render that as a green "Fits" chip.
   *
   * Counts DISTINCT supplied stats, not raw checks: references_max and
   * references_min both derive from referenceCount and can both fire, which
   * would otherwise let checkedCount exceed suppliedCount ("checked 2 of 1").
   */
  checkedCount: number
  /** How many numbers the author supplied at all (same for every journal). */
  suppliedCount: number
  scopeMatch: boolean
  /**
   * true when the author named a subspecialty, the journal publishes scope
   * tags, and this journal is not tagged for that subspecialty nor 'general'.
   * Ordering already demotes these; the UI adds a marker. Never changes the
   * bucket — scope is editorial judgement, not a hard constraint.
   */
  scopeMismatch: boolean
  scopeScore: number
  fitScore: number
  meta: JournalMeta
  /** Optional DeepSeek one-liner (off by default; never affects scoring). */
  explanation?: string | null
}

/**
 * One stat the author left blank, and how many ELIGIBLE journals publish a
 * limit for it. Powers the sparse-input warning: "you left word count blank —
 * 51 journals state a word limit we couldn't check." Computed server-side,
 * because the client cannot know limits for stats it never sent.
 */
export interface UncheckedStat {
  /** ManuscriptStats key, e.g. 'wordCount'. */
  stat: string
  /** Human label for the warning line, e.g. 'word count'. */
  label: string
  journalsWithLimit: number
}

export interface FinderResult {
  results: JournalScore[]
  counts: Record<Bucket, number>
  /** Slug of the single best result (top of the sorted list), or null if none. */
  topResult: string | null
  /** Blank stats that eligible journals do publish limits for; may be empty. */
  uncheckedStats?: UncheckedStat[]
}
