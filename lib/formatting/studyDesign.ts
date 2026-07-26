// Which study design the formatter is entitled to claim, and where it came from
// (2026-07-26).
//
// THE PROBLEM THIS SOLVES. The formatter, unlike the Finder, never reads a study
// design out of the manuscript -- it knows only which article type the author
// picked from a dropdown. For five article types the type IS the design, so the
// instrument follows. For `original_research`, easily the commonest submission
// there is, it does not: an original-research upload may be a randomized trial, a
// prospective cohort, a retrospective comparison or a chart review, and those
// take four different instruments with different item sets and different maxima.
//
// The first cut of this feature simply produced no quality section for those
// manuscripts. That was honest but it silently withheld the most valuable output
// from most users. So we ASK. The author states the design, we appraise on that
// basis, and we say plainly in the report that the basis was their answer rather
// than our reading. That is the only version of this that is both useful and
// true.
//
// WHAT WE STILL WILL NOT DO IS GUESS. If the author leaves it blank there is no
// design, no instrument and no section. A blank answer is not an invitation to
// assume the commonest design; it is the author declining to tell us, and
// appraising them anyway would put a published instrument's name on a score
// their manuscript never earned.
//
// CLIENT-SAFE. The journal picker renders this list in the browser, so this
// module has type-only imports and nothing else. Never add a runtime import.

import type { StudyDesign } from '@/lib/quality/types'
import type { ArticleType } from './rulesSchema'

/**
 * Article types where the type IS the design, so no question is needed.
 *
 * READ THIS BEFORE ADDING A LINE. Every entry here is an identity, not an
 * inference. `original_research` is deliberately absent and must stay absent:
 * the way to grade original research is the picker below, not a row in this map.
 */
const DESIGN_BY_ARTICLE_TYPE: Partial<Record<ArticleType, StudyDesign>> = {
  case_report: 'case_report',
  case_series: 'case_series',
  systematic_review: 'systematic_review',
  narrative_review: 'narrative_review',
  technical_note: 'technical_note',
}

export function studyDesignForArticleType(articleType: ArticleType): StudyDesign | null {
  return DESIGN_BY_ARTICLE_TYPE[articleType] ?? null
}

/**
 * The designs offered per article type, in the order they are shown.
 *
 * Scoped rather than showing all twelve everywhere, because a list containing
 * "Case report" under an article type of "Original research" invites a misclick
 * that silently swaps CARE in for MINORS. Only article types whose design is
 * genuinely open get a picker; the rest are already determined above.
 *
 * `letter` and `editorial` get no picker at all. No design they could plausibly
 * carry has a validated appraisal instrument, so the question would be asked for
 * nothing.
 */
export const DESIGN_CHOICES_BY_ARTICLE_TYPE: Partial<Record<ArticleType, readonly StudyDesign[]>> = {
  original_research: [
    'rct',
    'prospective_cohort',
    'retrospective_comparative',
    'case_control',
    'case_series',
    'basic_science',
    'other',
  ],
  // "Review" is the ambiguous label journals use for both kinds. Asking is how
  // we tell a protocol-driven systematic review (AMSTAR-2 applies) from a
  // narrative one (nothing applies).
  review: ['systematic_review', 'meta_analysis', 'narrative_review'],
}

/** True when this article type needs the author to state the design. */
export function needsDeclaredDesign(articleType: ArticleType): boolean {
  return DESIGN_CHOICES_BY_ARTICLE_TYPE[articleType] !== undefined
}

/**
 * Validate an untrusted design from the request body.
 *
 * Checked against the choices for THIS article type, not against the whole
 * union: a hand-rolled POST claiming `original_research` + `case_report` would
 * otherwise pick CARE for a study that is not a case report. Anything
 * unrecognised becomes null, which means no grading -- never a fallback design.
 */
export function parseDeclaredDesign(
  raw: unknown,
  articleType: ArticleType,
): StudyDesign | null {
  if (typeof raw !== 'string' || raw === '') return null
  const allowed = DESIGN_CHOICES_BY_ARTICLE_TYPE[articleType]
  if (!allowed) return null
  return (allowed as readonly string[]).includes(raw) ? (raw as StudyDesign) : null
}

/**
 * The design to appraise against, or null for no section.
 *
 * The article type wins when it determines the design, because it is the same
 * author answering a narrower question: someone who selected "Case report" and
 * then somehow supplied a conflicting design has contradicted themselves, and
 * the narrower answer is the safer one to honour.
 */
export function resolveStudyDesign(
  articleType: ArticleType,
  declared: StudyDesign | null | undefined,
): StudyDesign | null {
  return studyDesignForArticleType(articleType) ?? declared ?? null
}
