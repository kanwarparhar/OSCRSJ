// In-text citation renumber/restyle (Sushant, Session 87 scaffold → Session B).
// Restyle in-text markers (superscript / bracket / paren, punctuation
// placement, range collapsing 1–3) and renumber to citation order (incl.
// alphabetical→cited), producing an explicit run-level CitationMarkerMap. That
// map is the ONLY body delta the immutability gate permits.
//
// No LLM client imported (emit-path invariant).

import type { ContentModel, CitationMarkerMap } from '../types'
import type { JournalRules } from '../rulesSchema'

export interface RenumberResult {
  model: ContentModel
  /** old marker index → new marker index; consumed by the immutability gate. */
  markerMap: CitationMarkerMap
}

export function renumberCitations(model: ContentModel, rules: JournalRules): RenumberResult {
  // TODO(Session B): locate in-text markers; compute renumbering per
  // rules.references.order; restyle per rules.references.in_text; emit map.
  void model
  void rules
  throw new Error('renumberCitations not implemented — Session B')
}
