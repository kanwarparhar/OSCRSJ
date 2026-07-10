// Content-immutability gate (Sushant, Session B — HARD requirement).
//
// Doctrine (build brief + OSCRSJ AI Layer): the service NEVER alters an
// author's prose. This gate proves it mechanically. It compares the body text
// extracted before and after all transforms; the ONLY permitted delta is the
// in-text citation-marker renumber/restyle, supplied as an ordered list of
// {from,to} edits produced by renumber.ts.
//
// Algorithm: normalise whitespace, then segment both strings around the ordered
// marker strings (the `from` markers in the before-text, the `to` markers in
// the after-text) and require every inter-marker prose segment to match exactly.
// With no marker edits the two texts must be identical. Any other divergence —
// a changed word, number, dosage, or p-value — fails the job.

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
 * in document order). Returns null if a marker can't be found in order — which
 * itself signals the body was altered.
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
  const segA = segmentByMarkers(na, edits.map((e) => e.to))
  if (!segB || !segA) {
    return { ok: false, diffExcerpt: 'citation markers not found in the expected order' }
  }
  if (segB.length !== segA.length) {
    return { ok: false, diffExcerpt: 'citation-marker count mismatch' }
  }
  for (let i = 0; i < segB.length; i++) {
    if (segB[i] !== segA[i]) {
      return { ok: false, diffExcerpt: firstDivergence(segB[i], segA[i]) }
    }
  }
  return { ok: true }
}
