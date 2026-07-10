// Reference renderers (Sushant, Session 87 scaffold → Session B).
// Deterministic, hand-rolled per-style renderers over CSL-JSON (NLM/Vancouver,
// AMA variants) — NOT citeproc-js. Handles et-al threshold, NLM journal
// abbreviation, punctuation, DOI format, volume/issue style per the journal's
// `references` rules.
//
// HARD INVARIANT: this file imports NO LLM client (grep-provable acceptance
// criterion). Rendering is pure and deterministic.

import type { CslReference } from '../types'
import type { JournalRules } from '../rulesSchema'

/** Render one reference to the journal's exact style string. */
export function renderReference(ref: CslReference, rules: JournalRules): string {
  // TODO(Session B): switch on rules.references.style; apply abbrev, et-al
  // threshold, DOI include, punctuation. Pure function.
  void ref
  void rules
  throw new Error('renderReference not implemented — Session B')
}

/** Render the full reference list in `rules.references.order`. */
export function renderReferenceList(refs: CslReference[], rules: JournalRules): string[] {
  void refs
  void rules
  throw new Error('renderReferenceList not implemented — Session B')
}
