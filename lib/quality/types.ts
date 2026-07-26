// Methodological quality grading — contracts (2026-07-26).
//
// WHAT THIS LIBRARY IS. `lib/quality/` applies a published, externally validated
// appraisal instrument (MINORS, Newcastle-Ottawa, Cochrane RoB 2, CARE,
// AMSTAR-2) to a manuscript ITEM BY ITEM, where every scored item carries a
// verbatim quote that code has verified is a substring of the manuscript. The
// total is arithmetic performed here, never a number a model was asked to pick.
//
// WHAT IT IS NOT. It is not a prediction of acceptance, and no code, comment,
// copy or report in this library may imply one. A MINORS 18/24 is a statement
// about how completely a manuscript reports its own methods. It is not a
// probability, a percentage of anything, or an editorial opinion.
//
// PORTABILITY IS A HARD CONSTRAINT, NOT A PREFERENCE. OSCRSJ will later run this
// same grading inside the journal's own submission intake, server-side and
// authoritative, so an editor sees the same breakdown the author saw. Nothing in
// `lib/quality/` may import from `app/`, `lib/finder/`, or `lib/formatting/`, or
// reach Next.js request context. That is why StudyDesign is redeclared below
// rather than imported: one string-literal union is a cheap duplicate, whereas
// importing it would drag the Finder's whole type graph into the journal's
// intake. The duplication is pinned by a compile-time assertion in
// tests/quality-score.test.ts, which may import both sides.

/**
 * One vocabulary for every instrument, so display, gap-building and scoring do
 * not each need per-instrument special cases. Each instrument maps its own
 * published wording onto these four:
 *
 *   MINORS / NOS / CARE : met = reported and adequate  · partial = reported but
 *                         inadequate · not_met = not reported
 *   Cochrane RoB 2      : met = LOW risk of bias · partial = SOME CONCERNS ·
 *                         not_met = HIGH risk of bias
 *   AMSTAR-2            : met = Yes · partial = Partial Yes · not_met = No
 *
 * `not_assessable` is never a failure. It means the manuscript text does not let
 * the item be judged, and such items are excluded from the denominator entirely
 * (see MethodologyScore.applicableMax) so that silence never depresses a score.
 */
export type ItemVerdict = 'met' | 'partial' | 'not_met' | 'not_assessable'

export type InstrumentId =
  | 'MINORS_NONCOMPARATIVE'
  | 'MINORS_COMPARATIVE'
  | 'NOS'
  | 'ROB2'
  | 'CARE'
  | 'AMSTAR2'
  | 'NONE'

/**
 * Study designs this library can be asked about.
 *
 * Deliberately a structural mirror of `StudyDesign` in lib/finder/profileTypes.ts
 * — same members, same order — so a value from either side is assignable to the
 * other without a cast. Drift is caught at compile time by the bidirectional
 * assertion in tests/quality-score.test.ts. If you add a member there, add it
 * here in the same commit.
 */
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

export interface InstrumentItem {
  id: string
  /** Plain-language statement of what a quote must show. Drives the prompt. */
  criterion: string
  /**
   * Points a `met` verdict earns on a numeric instrument (MINORS 2, NOS 1, NOS
   * comparability 2, CARE 1). Categorical instruments (RoB 2, AMSTAR-2) carry 0:
   * their items are judged, not summed.
   */
  maxPoints: number
  /** AMSTAR-2 only: one of the seven critical domains. */
  critical?: boolean
}

export interface InstrumentDef {
  id: InstrumentId
  /** Shown to the author verbatim, e.g. "MINORS (comparative)". */
  name: string
  /** Full published citation, shown verbatim. The citability IS the product. */
  citation: string
  scaleKind: 'numeric' | 'domain_rob2' | 'rating_amstar2'
  /** 16, 24, 9, 13. null for the categorical instruments and for NONE. */
  numericMax: number | null
  items: InstrumentItem[]
}

/**
 * What the extraction layer hands the scorer: a verdict per item plus the quote
 * that justified it. Quote verification has already happened by this point — an
 * unverifiable quote arrives here as `not_assessable` with a null quote, never
 * as a downgraded-but-still-scored item.
 */
export interface RawGradedItem {
  id: string
  verdict: ItemVerdict
  quote: string | null
}

export interface ScoredItem {
  id: string
  criterion: string
  verdict: ItemVerdict
  /** Numeric instruments only. null when not_assessable or the instrument is categorical. */
  points: number | null
  /** Verified verbatim manuscript substring. null for not_assessable. */
  quote: string | null
}

export interface MethodologyScore {
  instrumentId: InstrumentId
  instrumentName: string
  citation: string
  items: ScoredItem[]
  /** Numeric instruments: sum of points over assessable items. Categorical: null. */
  obtained: number | null
  /**
   * Sum of maxPoints over APPLICABLE (assessable) items only.
   *
   * This is the honest denominator and the reason the score cannot be gamed
   * downward by an unreadable manuscript: an item we could not judge is removed
   * from both sides of the fraction rather than counted as a zero.
   */
  applicableMax: number | null
  /** rob2: low|some_concerns|high · amstar2: high|moderate|low|critically_low · else null. */
  overallRating: string | null
  /** 0..1 quality used by the ladder anchor. null when NONE, nothing assessable, or grading failed. */
  normalized: number | null
  /** not_met first, then not_assessable, item order preserved. The "what to improve" source. */
  gaps: ScoredItem[]
  /** True when the study design has no validated instrument — an honest outcome, not an error. */
  noInstrument: boolean
  /** Set when grading degraded (bad JSON, no key, network). Disclosed, never fatal. */
  gradingError: string | null
}

/* -------------------------------------------------------------------------- */
/* Submission readiness                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Six things a manuscript either states or does not, extracted in the same call
 * as the instrument items.
 *
 * THESE MUST NEVER TOUCH THE ANCHOR. A missing COI statement says nothing about
 * whether a study is strong enough for a given journal — it says an editor will
 * bounce it back before anyone reads it. That makes this a desk-reject screen
 * displayed as its own list, not a quality signal, and deriveInstrumentAdjustment
 * deliberately never sees it. Feeding it into the ladder would conflate "your
 * paperwork is incomplete" with "your study is weak", which are different
 * problems with different fixes.
 *
 * They live in lib/quality/ rather than in the Finder because OSCRSJ's own
 * intake wants exactly this checklist on receipt.
 */
export type ReadinessGate =
  | 'ethicsApproval'
  | 'registration'
  | 'reportingGuideline'
  | 'conflictOfInterest'
  | 'funding'
  | 'informedConsent'

export const READINESS_GATES: readonly ReadinessGate[] = [
  'ethicsApproval',
  'registration',
  'reportingGuideline',
  'conflictOfInterest',
  'funding',
  'informedConsent',
]

export const READINESS_LABELS: Record<ReadinessGate, string> = {
  ethicsApproval: 'IRB / ethics approval',
  registration: 'Trial or protocol registration',
  reportingGuideline: 'Reporting guideline named',
  conflictOfInterest: 'Conflict-of-interest statement',
  funding: 'Funding statement',
  informedConsent: 'Informed-consent statement',
}

/** What the grading call is asked to look for, in the model's own terms. */
export const READINESS_CRITERIA: Record<ReadinessGate, string> = {
  ethicsApproval: 'A statement of institutional review board or research ethics committee approval (or an explicit exemption)',
  registration: 'A trial or protocol registration statement, with or without a registry number',
  reportingGuideline: 'An explicit statement that a reporting guideline was followed (STROBE, CONSORT, PRISMA, CARE)',
  conflictOfInterest: 'A conflict-of-interest or competing-interests statement, including an explicit declaration of none',
  funding: 'A funding or financial-support statement, including an explicit statement that none was received',
  informedConsent: 'A statement that informed consent was obtained from the patient or participants',
}

/**
 * One readiness gate. `present: false` means the manuscript is silent on it —
 * which is the actionable finding — and carries no quote, because there is
 * nothing to point at. A present gate always carries the sentence that states it.
 */
export interface ReadinessItem {
  present: boolean
  quote: string | null
}

export type ReadinessChecklist = Record<ReadinessGate, ReadinessItem>

/** Every gate absent. The honest starting point, and the result when grading fails. */
export function emptyReadiness(): ReadinessChecklist {
  return {
    ethicsApproval: { present: false, quote: null },
    registration: { present: false, quote: null },
    reportingGuideline: { present: false, quote: null },
    conflictOfInterest: { present: false, quote: null },
    funding: { present: false, quote: null },
    informedConsent: { present: false, quote: null },
  }
}
