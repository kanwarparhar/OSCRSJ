// Content-immutability gate (Sushant, Session 87 scaffold — HARD requirement).
//
// The doctrine (build brief + OSCRSJ AI Layer): the service NEVER alters an
// author's prose. This gate proves it mechanically. Extract all body `<w:t>`
// text pre- and post-transform, normalise whitespace, apply the citation-marker
// mapping (old marker → new marker) as the ONLY permitted delta. Any other diff
// fails the job with the offending excerpt.
//
// Implemented in Session B, with a golden-file test that includes a deliberate
// body-mutation case proving the gate FIRES (not just that it passes on clean
// input).

import type { CitationMarkerMap } from '../types'

export interface ImmutabilityResult {
  ok: boolean
  /** Present when ok === false: a short excerpt of the disallowed change. */
  diffExcerpt?: string
}

/**
 * @param before  body text extracted before any transform
 * @param after   body text extracted after all transforms
 * @param markerMap the only sanctioned delta (in-text citation renumber/restyle)
 */
export function assertBodyImmutable(
  before: string,
  after: string,
  markerMap: CitationMarkerMap,
): ImmutabilityResult {
  // TODO(Session B): normalise whitespace; project `before` through `markerMap`
  // to its expected post-form; compare against `after`; return the first
  // divergence as `diffExcerpt`. Must be deterministic.
  void before
  void after
  void markerMap
  throw new Error('immutability gate not implemented — Session B')
}
