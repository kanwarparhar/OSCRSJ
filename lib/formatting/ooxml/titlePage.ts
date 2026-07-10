// Title-page builder (Sushant, Session 87 scaffold → Session B).
// Rebuild a standalone title-page .docx from extracted metadata, in the exact
// element order the journal specifies (`ctx.rules.title_page.elements`). This is
// one of only two parts the engine rebuilds rather than edits in place (the
// other is the reference list) — it carries no author prose, so a rebuild is
// content-safe.

import type { ExtractedTitlePageData, FormattingContext } from '../types'

/** @returns the title-page .docx bytes. */
export function buildTitlePage(
  data: ExtractedTitlePageData,
  ctx: FormattingContext,
): Uint8Array {
  // TODO(Session B): emit title-page parts per rules.title_page.elements order,
  // enforcing title case/word cap, author degree include/strip, affiliation
  // numbering + superscripts, corresponding-author block, running title cap.
  void data
  void ctx
  throw new Error('buildTitlePage not implemented — Session B')
}
