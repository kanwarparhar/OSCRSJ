// OOXML layout transforms (Sushant, Session 87 scaffold → Session B).
// In-place edits only: sectPr (pgMar margins, lnNumType line numbers,
// pgNumType page numbers), header/footer parts (running head + page numbers),
// and style overrides (font family/size, line spacing, alignment, heading
// case). NEVER rebuilds body runs — this is a layout pass, not a content pass.
//
// Every change this transform makes is driven by `ctx.rules.layout` — no
// hardcoded per-journal behaviour.

import type { ContentModel, FormattingContext, ReportChange } from '../types'

export interface LayoutResult {
  model: ContentModel
  changes: ReportChange[]
}

export function applyLayout(model: ContentModel, ctx: FormattingContext): LayoutResult {
  // TODO(Session B): margins, font, line spacing, alignment, line numbers,
  // page numbers, running head, heading case — each emitting a ReportChange.
  void model
  void ctx
  throw new Error('applyLayout not implemented — Session B')
}
