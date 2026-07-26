// Journal Finder v2 — manuscript profile + recommendation ladder contracts
// (2026-07-25, per docs/2026-07-25-finder-v2-ladder-build-brief.md).
//
// WHAT V2 ADDS OVER V1. v1 ranked journals by formatting-constraint fit. That is
// not how anyone picks a journal (Rowley 2022: formatting ranks near the bottom
// of author criteria; scope, reputation and review quality rank at the top).
// v2 builds a PROFILE of what the manuscript demonstrably shows, then lays out a
// reach / target / safety ladder banded by SJR standing RELATIVE to the journals
// eligible for that manuscript. v1 survives underneath as the eligibility gate
// and the per-journal formatting-fit detail.
//
// TWO DOCTRINES BIND EVERY TYPE IN THIS FILE:
//
//   1. EVIDENCE OR NULL. Every extracted fact carries the verbatim manuscript
//      sentence behind it, and the code VERIFIES that quote is really a substring
//      of the manuscript before trusting the value (see assess.ts). An LLM that
//      paraphrases loses the field. Silence in the text is a null, never a guess.
//
//   2. NO ACCEPTANCE PREDICTION. Nothing here models, stores or reports a
//      probability of acceptance. The product reports TIER ALIGNMENT — where this
//      manuscript's verifiable characteristics sit against journals' standing —
//      and says plainly that no honest tool can predict an editorial decision.
//      Do not add a score, a percentage, or a "likelihood" field to these types.
//
//      ONE NARROW EXCEPTION, added 2026-07-26: a `methodologyScore` from
//      lib/quality/. The prohibition above was written against an INVENTED,
//      UNVERIFIABLE acceptance-likelihood number, and it still forbids exactly
//      that. A published instrument's score is a different kind of object, and
//      it is permitted only while ALL FIVE of these hold:
//
//        1. It is the score of a NAMED, PUBLISHED, EXTERNALLY VALIDATED
//           instrument (MINORS, Newcastle-Ottawa, Cochrane RoB 2, CARE,
//           AMSTAR-2), carried together with its citation string.
//        2. Every scored item carries a VERBATIM QUOTE that code has verified is
//           a substring of the manuscript — the same `verifyQuote` gate as
//           doctrine 1 above, applied per item.
//        3. Items the text cannot answer are `not_assessable` and are EXCLUDED
//           FROM THE DENOMINATOR. They never lower the score.
//        4. It is reported as `obtained / applicableMax` beside the instrument
//           name ("MINORS 18/24") — never as a percentage, never as a
//           probability, never as a bare "quality: 7/10".
//        5. It carries no editorial-decision language anywhere.
//
//      Fail any one of the five and the original prohibition applies again and
//      the field comes out. What is being measured is METHODOLOGICAL
//      COMPLETENESS of what the manuscript states about itself. It is not, and
//      may never be described as, a prediction of what an editor will do.

import type { ArticleType } from '@/lib/formatting/rulesSchema'
import type { MethodologyScore, ReadinessChecklist } from '@/lib/quality'
import type { ConstraintCheck, JournalMeta, JournalScore } from './types'

/** One extracted fact plus the verbatim manuscript evidence behind it. */
export interface ProfileField<T> {
  value: T | null
  /** Verbatim substring of the manuscript body (whitespace-normalized match). null when value is null. */
  quote: string | null
  confidence: 'high' | 'low' | null
  /** True when the model supplied a quote that failed substring verification — the value was nulled. */
  quoteRejected?: boolean
  /**
   * True when the AUTHOR supplied or corrected this value.
   *
   * An edited field carries NO quote and NO confidence, ever: the card's promise
   * is "here is what your text says", and an author's correction is a different
   * kind of claim. It is used (it feeds the anchor like any other value) and it
   * is LABELLED. What must never happen is an author-stated number rendered in
   * the same visual language as a quote-verified one.
   */
  authorEdited?: boolean
}

export type StudyDesign =
  | 'rct'
  | 'prospective_cohort'
  | 'retrospective_comparative'
  | 'case_control'
  | 'case_series'
  | 'case_report'
  | 'systematic_review'
  | 'meta_analysis'
  | 'narrative_review'
  | 'technical_note'
  | 'basic_science'
  | 'other'

export const STUDY_DESIGNS: readonly StudyDesign[] = [
  'rct',
  'prospective_cohort',
  'retrospective_comparative',
  'case_control',
  'case_series',
  'case_report',
  'systematic_review',
  'meta_analysis',
  'narrative_review',
  'technical_note',
  'basic_science',
  'other',
]

export interface ManuscriptProfile {
  design: ProfileField<StudyDesign>
  sampleSize: ProfileField<number>
  multicenter: ProfileField<boolean>
  comparative: ProfileField<boolean>
  followUpMonths: ProfileField<number>
  /** Primary outcome reported with a P value and/or confidence interval. */
  statsReported: ProfileField<boolean>
  /** The manuscript's OWN novelty sentence, when it makes one. */
  noveltyClaim: ProfileField<string>
  /** Orthopedic level of evidence I–V derived deterministically; null when design is unknown. */
  evidenceLevel: 1 | 2 | 3 | 4 | 5 | null
  /** Percentile anchor 0.10–0.90 the ladder bands around. */
  anchor: number
  /** Which self-assessment shift was applied (−0.10 … +0.10). */
  authorShift: number
  /** Fields where the author's self-rating exceeded what the text verified. */
  disagreements: string[]
  /** True in manual mode: nothing here was read from a manuscript. */
  selfReported: boolean
  /**
   * Names of the fields the author corrected by hand, derived in finalizeProfile
   * from the fields themselves so it can never drift out of sync with them.
   * Surfaced on the profile card and under the ladder.
   */
  authorEditedFields: EditableProfileField[]
  /** True when the body was truncated before extraction (disclosed in the UI). */
  truncated: boolean
  /** Set when extraction degraded (bad JSON twice, no API key). Disclosed, never fatal. */
  extractionError: string | null
  /**
   * The published instrument's item-by-item grade, under the §1.3 carve-out at
   * the top of this file. null when grading was not run at all (manual mode, or
   * a caller that did not ask for it) — which is different from a score that ran
   * and produced `noInstrument` or a `gradingError`, both of which are real
   * results the card renders.
   */
  methodologyScore: MethodologyScore | null
  /**
   * Six desk-reject gates the manuscript either states or does not.
   *
   * DISPLAY ONLY. This never reaches the anchor: a missing funding statement is
   * a paperwork problem, not a weak study, and letting it move the ladder would
   * recommend a lesser journal for a fixable omission.
   */
  readiness: ReadinessChecklist
}

/**
 * The fields an author may correct on the profile card.
 *
 * `noveltyClaim` is deliberately ABSENT and must stay absent. That row reports
 * whether the manuscript makes a novelty claim IN ITS OWN WORDS; letting an
 * author type one in would manufacture a sentence their paper does not contain,
 * and an editor reading the paper would find nothing there. When it is blank the
 * fix belongs in the manuscript, and the card says so.
 *
 * `evidenceLevel` is absent because it is derived, not observed — correct the
 * design and the level follows.
 */
export const EDITABLE_PROFILE_FIELDS = [
  'design',
  'sampleSize',
  'comparative',
  'multicenter',
  'followUpMonths',
  'statsReported',
] as const
export type EditableProfileField = (typeof EDITABLE_PROFILE_FIELDS)[number]

/**
 * An author's corrections, keyed by field. An explicit `null` means "the author
 * cleared this back to unknown", which is different from the key being absent
 * (leave whatever we extracted alone).
 */
export type ProfileEdits = Partial<Record<EditableProfileField, string | number | boolean | null>>

export const EDITABLE_FIELD_LABELS: Record<EditableProfileField, string> = {
  design: 'Study design',
  sampleSize: 'Patients analyzed',
  comparative: 'Comparison group',
  multicenter: 'Multicenter',
  followUpMonths: 'Follow-up',
  statsReported: 'Statistics reported',
}

export interface SelfAssessment {
  novelty: 'first_reported' | 'uncommon_variant' | 'adds_to_known' | null
  strength: 'definitive_or_comparative' | 'suggestive_descriptive' | 'negative_or_confirmatory' | null
  /** Max 2, in the order the author picked them (that order drives tie-breaks). */
  priorities: Array<'prestige' | 'speed' | 'cost' | 'oa_visibility'>
}

export type AuthorPriority = SelfAssessment['priorities'][number]

export const AUTHOR_PRIORITIES: readonly AuthorPriority[] = ['prestige', 'speed', 'cost', 'oa_visibility']

export type LadderBand = 'reach' | 'target' | 'safety'

export interface LadderSlot {
  band: LadderBand
  slug: string
  name: string
  abbrev: string
  /** 0–1 percentile of this journal within the eligible set (1 = highest SJR); null when unranked. */
  percentile: number | null
  sjrUnranked: boolean
  /** Why this journal, this band, this manuscript — template-composed, never model freeform. */
  why: string
  /** REACH slots only: the single most common gate at the next tier up. null when none applies. */
  strengthen: string | null
  /** Disclosure when this slot was borrowed from outside its band range. */
  borrowNote: string | null
  /** v1 constraint checks, for the formatting-fit detail row. */
  checks: ConstraintCheck[]
  checkedCount: number
  /** True when the author named a subspecialty this journal is not tagged for. */
  scopeMismatch: boolean
  meta: JournalMeta
  guidelinesUrl: string
}

export interface LadderResult {
  /** Ordered reach, reach, target, target, safety (shortened, never padded). */
  slots: LadderSlot[]
  eligibleCount: number
  /**
   * OSCRSJ card shown? Derived from article type + scope ONLY — never from the
   * profile or the anchor. OSCRSJ is excluded from the ladder before slotting
   * and appears only as a separately disclosed card.
   */
  showOscrsjCard: boolean
  /** Full scored eligible list (v1 shape) behind the "all eligible journals" expander. */
  allEligible: JournalScore[]
  /** Set when the eligible set was too small for a full five-slot ladder. */
  smallSetNote: string | null
}

/** Conservative design mapping for manual (no-upload) mode — see assess.ts. */
export const MANUAL_DESIGN_BY_ARTICLE_TYPE: Record<ArticleType, StudyDesign> = {
  case_report: 'case_report',
  case_series: 'case_series',
  // Deliberately conservative: an author declaring "original research" has not
  // told us it is prospective or randomized, so we assume the commonest
  // orthopedic design rather than the strongest one.
  original_research: 'retrospective_comparative',
  review: 'narrative_review',
  systematic_review: 'systematic_review',
  narrative_review: 'narrative_review',
  technical_note: 'technical_note',
  letter: 'other',
  editorial: 'other',
}
