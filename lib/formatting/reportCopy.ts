// Report copy shared between the server-side renderers (report.ts, which pulls
// in the OOXML builder) and the client results screen (FormatClient.tsx).
//
// This module exists so the client can render a report sentence WITHOUT
// importing report.ts and dragging the .docx builder into the browser bundle —
// the same client-safe split registry-meta got in Session 92. Keep it free of
// imports so it stays cheap to pull into a client component.

/**
 * Shown when the journal prescribes no manuscript layout at all (26 of 75
 * journals): the layout transform is a deliberate no-op and the author should
 * be told, not left wondering why "formatting" changed nothing.
 *
 * No em-dashes: this string renders inside the Studio UI, where the
 * no-em-dash convention applies.
 */
export const layoutNotPrescribedLine = (journal: string): string =>
  `${journal} does not prescribe manuscript layout (font, margins, spacing). ` +
  'Your formatting was preserved, and this report audits content rules instead.'

/* -------------------------------------------------------------------------- */
/* Methodological quality (2026-07-26)                                         */
/* -------------------------------------------------------------------------- */

export const METHODOLOGY_HEADING = 'Methodological quality'

/**
 * The doctrinal sentence that authorises a score field at all.
 *
 * DUPLICATED, DELIBERATELY, AND THIS IS THE CANONICAL COPY. The identical string
 * lives in app/(formatter)/_components/FinderProfileCard.tsx as
 * INSTRUMENT_TRUST_LINE, whose own comment already says it belongs here — that
 * session could not move it because the file it would have edited was not on its
 * permitted list, and neither is it on mine. The two must stay character-for-
 * character identical: they are the same claim made to the same reader on two
 * screens, and a drifted version is a differently-worded promise. Whoever next
 * opens FinderProfileCard.tsx should delete its copy and re-export this one;
 * this module imports nothing, so it is safe to pull into a client component.
 *
 * The em-dash is intentional here and is NOT a violation of the Studio's
 * no-em-dash convention: this is the Finder's existing published sentence, and
 * matching it exactly matters more than the punctuation house style.
 */
export const INSTRUMENT_TRUST_LINE =
  'Study quality is scored with published, validated instruments (MINORS, Newcastle-Ottawa, Cochrane RoB 2, CARE, AMSTAR-2) applied item by item to what your manuscript states — as an aid to strengthen your study and to gauge which journals’ standing it aligns with. It is not a prediction of acceptance.'

/**
 * Said when the study design has no validated instrument.
 *
 * There is no honest alternative to saying this plainly. Inventing a generic
 * checklist so the section is never empty would hand an author a score that no
 * instrument's authors ever endorsed, which is the one failure mode this whole
 * feature exists to avoid.
 */
export const NO_INSTRUMENT_LINE =
  'No validated quality instrument applies to this design, so we did not score it.'

/** Item verdicts in the author's words. Mirrors the Finder card's vocabulary. */
export const VERDICT_LABELS: Record<string, string> = {
  met: 'Reported',
  partial: 'Partly reported',
  not_met: 'Not reported',
  not_assessable: 'Could not tell',
}

/** RoB 2 and AMSTAR-2 publish judgements, not totals. Render their own words. */
export const RATING_LABELS: Record<string, string> = {
  low: 'Low risk of bias',
  some_concerns: 'Some concerns',
  high: 'High risk of bias',
  moderate: 'Moderate confidence',
  critically_low: 'Critically low confidence',
}

export const IMPROVEMENTS_HEADING = 'What would strengthen this study'

/**
 * Why the improvements list is framed as advice and never as a defect.
 *
 * A formatting error is something we can prove wrong against the journal's own
 * rules. A methodological gap is not: it is a statement about what the
 * manuscript does not say, which may be an omission worth fixing or may be a
 * study that genuinely could not do the thing. So these lines never carry
 * 'action-required' severity and never enter the summary verdict's
 * "items need your attention" count -- see buildReport.
 */
export const IMPROVEMENTS_INTRO =
  'These are suggestions drawn from the instrument above, not formatting errors. ' +
  'Each one is either something your manuscript does not currently state, or ' +
  'something we could not determine from the text we read.'

/** Nothing to improve: every item the text could answer, it answered. */
export const NO_GAPS_LINE =
  'Every item this instrument could be judged on was reported.'

/**
 * Where the study design came from, said out loud, every single time.
 *
 * THIS LINE IS NOT OPTIONAL AND IS NOT DECORATION. Every other number in this
 * product is anchored to a sentence from the manuscript that code has verified
 * as a substring. The study design is the one input that is not: it comes from a
 * dropdown the author filled in, and the instrument is chosen entirely from it.
 * A wrong answer there does not degrade the score, it invalidates it -- a chart
 * review appraised as a prospective cohort produces a Newcastle-Ottawa number
 * that means nothing, and the author may quote it to an editor.
 *
 * So the report says what the appraisal rests on and what happens if it is
 * wrong. Any future version that hides this to make the section read more
 * confidently has broken the only promise the feature makes.
 */
export const designBasisLine = (designLabel: string): string =>
  `Appraised as a ${designLabel.toLowerCase()}, because that is what you told us. ` +
  'We did not read the study design from your manuscript. If it is wrong, the ' +
  'instrument below is the wrong instrument and its score does not apply.'

/** The picker's own copy, on the formatter form. */
export const DESIGN_PICKER_LABEL = 'Study design'

export const DESIGN_PICKER_HELP =
  'We use this to choose the published appraisal instrument for your study. ' +
  'Leave it blank if you are not sure: we would rather show you nothing than ' +
  'appraise your work with the wrong instrument.'

export const DESIGN_PICKER_UNSET = 'Not specified — skip the quality appraisal'
