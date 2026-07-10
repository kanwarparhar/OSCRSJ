// Blinding transforms (Sushant, Session 87 scaffold → Session B).
// AUTO: produce a separate anonymised title page, strip docx core-properties
// author metadata, move acknowledgments/funding to the title page for the
// blinded body. FLAG (never auto-rewrite prose): body self-identification such
// as "our institution, X University" — reported with exact locations.
//
// Driven by `ctx.rules.blinding`.

import type { ContentModel, FormattingContext, ReportChange, ReportSuggestion } from '../types'

export interface BlindingResult {
  /** The blinded body content model (author-identifying content removed AUTO). */
  model: ContentModel
  changes: ReportChange[]
  /** Self-identification the engine deliberately did NOT rewrite — flagged. */
  flags: ReportSuggestion[]
}

export function blindManuscript(model: ContentModel, ctx: FormattingContext): BlindingResult {
  // TODO(Session B): scrub core-properties; relocate acknowledgments/funding;
  // detect (never rewrite) in-body self-identification and flag with locations.
  void model
  void ctx
  throw new Error('blindManuscript not implemented — Session B')
}
