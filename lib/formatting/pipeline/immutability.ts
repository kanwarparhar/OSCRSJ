// Content-immutability gate (Sushant, Session B — HARD requirement).
//
// Doctrine (build brief + OSCRSJ AI Layer): the service NEVER alters an
// author's prose. This gate proves it mechanically. It compares the body text
// extracted before and after all transforms; the ONLY permitted delta is the
// in-text citation-marker renumber/restyle, supplied as an ordered list of
// {from,to} edits produced by renumber.ts.
//
// Algorithm: normalise whitespace, segment the BEFORE-text around the ordered
// `from` markers (bracketed markers are collision-resistant), then rebuild the
// expected after-text as seg[0] + to[0] + seg[1] + … + seg[n] and require it to
// equal the actual after-text exactly. With no marker edits the two texts must
// be identical. Any other divergence — a changed word, number, dosage, or
// p-value — fails the job.
//
// Why expected-after construction and not dual segmentation (2026-07-22): for
// superscript journals the `to` marker is a BARE DIGIT ("3"), and re-searching
// the after-text for it collides with any earlier prose occurrence of that
// digit ("a cohort of 3 patients…") — mis-segmenting the after-text and
// hard-failing manuscripts that were formatted perfectly. Paren markers had a
// milder version of the same collision. Building the expected after-text from
// the before-segments eliminates the collision class for every style.

export interface MarkerEdit {
  /** The marker text as it appeared before renumber (e.g. "12" or "[12]"). */
  from: string
  /** The marker text after renumber (e.g. "7" or "[7]"). */
  to: string
}

export interface ImmutabilityResult {
  ok: boolean
  /** Present when ok === false: a short excerpt around the first disallowed change. */
  diffExcerpt?: string
}

function normalizeWs(s: string): string {
  return s.replace(/\s+/g, ' ').trim()
}

function firstDivergence(a: string, b: string): string {
  let i = 0
  const n = Math.min(a.length, b.length)
  while (i < n && a[i] === b[i]) i++
  const start = Math.max(0, i - 30)
  return `…${a.slice(start, i + 30)}  ≠  ${b.slice(start, i + 30)}…`
}

/**
 * Split `text` into the prose segments between the ordered `markers`. Each
 * marker is located from the running cursor (so repeated marker strings match
 * in document order, and an edit list produced by a single left-to-right regex
 * pass — renumber.ts — stays consistent even when one marker string is a
 * prefix of another, e.g. "[1]" vs "[1,2]"). Returns null if a marker can't be
 * found in order — which itself signals the body was altered.
 *
 * Only ever called on the BEFORE-text with the `from` markers: those are
 * always bracketed and therefore collision-resistant. Never re-search the
 * after-text — bare-digit `to` markers collide with prose digits.
 */
function segmentByMarkers(text: string, markers: string[]): string[] | null {
  const segments: string[] = []
  let cursor = 0
  for (const marker of markers) {
    const at = text.indexOf(marker, cursor)
    if (at === -1) return null
    segments.push(text.slice(cursor, at))
    cursor = at + marker.length
  }
  segments.push(text.slice(cursor))
  return segments
}

/**
 * @param before body text extracted before any transform
 * @param after  body text extracted after all transforms
 * @param edits  the sanctioned citation-marker edits (empty for layout/blinding-only)
 */
export function assertBodyImmutable(
  before: string,
  after: string,
  edits: MarkerEdit[] = [],
): ImmutabilityResult {
  const nb = normalizeWs(before)
  const na = normalizeWs(after)

  if (edits.length === 0) {
    return nb === na ? { ok: true } : { ok: false, diffExcerpt: firstDivergence(nb, na) }
  }

  const segB = segmentByMarkers(nb, edits.map((e) => e.from))
  if (!segB) {
    return { ok: false, diffExcerpt: 'citation markers not found in the expected order' }
  }
  // Rebuild what the after-text MUST be if the only delta is the marker edits.
  let expected = segB[0]
  for (let i = 0; i < edits.length; i++) {
    expected += edits[i].to + segB[i + 1]
  }
  if (expected !== na) {
    return { ok: false, diffExcerpt: firstDivergence(expected, na) }
  }
  return { ok: true }
}
