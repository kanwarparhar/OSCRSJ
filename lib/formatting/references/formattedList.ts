// The journal-styled reference list handed back to the author (Sushant,
// Session 97, Part A).
//
// `render.ts` has been complete and unit-tested since Session B but was never
// called by the pipeline: `verify.ts` fetched Crossref-enriched author lists,
// volumes, pages and DOIs, and the pipeline then threw them away and showed
// only a DOI audit table. This module is the missing join.
//
// HARD INVARIANTS:
//   - PURE. No LLM, no network, no DB, no clock — the only imports are the
//     renderer and types, so this stays on the safe side of the no-LLM-on-the-
//     emit-path rule.
//   - ADDITIVE ONLY. The manuscript body is never touched; this list is a
//     report artifact the author may choose to paste over their bibliography.
//     The content-immutability gate is unaffected.
//   - Original order is preserved. The engine does not renumber the list.

import type { CslReference, FormattedReference, VerifiedReference } from '../types'
import type { JournalRules } from '../rulesSchema'
import { renderReference } from './render'

/**
 * Detect the `fallbackRef` shape from references/parse.ts — a reference the
 * structurer could not segment, where the author's raw string was preserved
 * wholesale as `title`. Rendering one would emit a mangled citation (the entire
 * raw string sitting in the title slot), so it is passed through verbatim and
 * flagged instead.
 *
 * The build brief specifies `authors.length === 0 && year === null`. This uses
 * `containerTitle === null` for the second half instead, because `fallbackRef`
 * regex-scrapes a year out of the raw text — so a fallback ref frequently DOES
 * carry a year and would slip through the brief's predicate and be rendered as
 * garbage. `containerTitle` is always null on the fallback shape and is
 * effectively always present on a genuinely parsed journal article, making it
 * the more reliable discriminator. Erring toward "unparsed" is the safe
 * direction: verbatim passthrough is never wrong, a mangled render is.
 */
export function isUnparsedReference(ref: CslReference): boolean {
  return ref.authors.length === 0 && ref.containerTitle === null
}

/**
 * Render every verified reference into the target journal's citation style.
 * Returns null when the manuscript carried no references at all (the report
 * then omits the section entirely rather than showing an empty list).
 */
export function buildFormattedReferences(
  verified: VerifiedReference[],
  rules: JournalRules,
): FormattedReference[] | null {
  if (verified.length === 0) return null
  return verified.map((v, i) => {
    const unparsed = isUnparsedReference(v.reference)
    return {
      index: i + 1,
      text: unparsed ? (v.reference.title ?? '') : renderReference(v.reference, rules),
      status: v.status,
      unparsed,
    }
  })
}

/**
 * True when the journal's citation style is 'custom' (29 of 75 rule files).
 * `render.ts` routes 'custom' through the NLM/Vancouver core, which is the
 * closest standard — the report says so rather than implying an exact match.
 */
export function hasStyleCaveat(rules: JournalRules): boolean {
  return rules.references.style === 'custom'
}
