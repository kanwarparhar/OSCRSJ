// In-text citation renumber/restyle (Sushant, Session B). Restyle in-text
// markers (superscript / bracket / paren, range collapsing 1–3) and renumber to
// the target citation order, producing an explicit MarkerEdit list. That list is
// the ONLY body delta the immutability gate permits — every marker change here
// is reported so the gate can prove nothing else moved.
//
// No LLM client imported (emit-path invariant).

import type { JournalRules } from '../rulesSchema'
import type { MarkerEdit } from '../pipeline/immutability'
import { Docx, PART } from '../ooxml/docx'

export interface RenumberResult {
  /** old marker text → new marker text, in document order (for the gate). */
  markerEdits: MarkerEdit[]
}

/** [1,2,3,5,6] → "1-3,5-6"; single numbers left bare. */
export function collapseRanges(nums: number[]): string {
  const sorted = Array.from(new Set(nums)).sort((a, b) => a - b)
  const parts: string[] = []
  let i = 0
  while (i < sorted.length) {
    let j = i
    while (j + 1 < sorted.length && sorted[j + 1] === sorted[j] + 1) j++
    parts.push(j > i ? `${sorted[i]}-${sorted[j]}` : `${sorted[i]}`)
    i = j + 1
  }
  return parts.join(',')
}

/** Render marker text for a target style (the number payload, styled). */
export function formatMarkerText(
  nums: number[],
  style: 'superscript' | 'bracket' | 'paren',
): string {
  const body = collapseRanges(nums)
  if (style === 'bracket') return `[${body}]`
  if (style === 'paren') return `(${body})`
  return body // superscript: bare digits (the run carries vertAlign)
}

/** Parse the number payload out of a marker body like "1-3,5". */
export function parseMarkerNumbers(body: string): number[] {
  const nums: number[] = []
  for (const token of body.split(',')) {
    const range = token.trim().match(/^(\d+)\s*[-–]\s*(\d+)$/)
    if (range) {
      const a = Number(range[1])
      const b = Number(range[2])
      for (let n = Math.min(a, b); n <= Math.max(a, b); n++) nums.push(n)
    } else {
      const single = token.trim().match(/^\d+$/)
      if (single) nums.push(Number(token.trim()))
    }
  }
  return nums
}

const applyMap = (nums: number[], map?: Record<number, number>): number[] =>
  map ? nums.map((n) => map[n] ?? n) : nums

/** Bracketed in-text marker, e.g. "[12]" or "[1-3,5]". */
const MARKER_RE = /\[(\d+(?:\s*[-–,]\s*\d+)*)\]/g

/** In-place marker replace inside every <w:t> of `xml` (bracket/paren styles,
 *  and the mixed-content fallback for superscript). */
function replaceInTextBlocks(
  xml: string,
  style: 'superscript' | 'bracket' | 'paren',
  numberMap: Record<number, number> | undefined,
  markerEdits: MarkerEdit[],
): string {
  return xml.replace(/(<w:t\b[^>]*>)([\s\S]*?)(<\/w:t>)/g, (_full, open, text, close) => {
    const next = text.replace(MARKER_RE, (marker: string, body: string) => {
      const mapped = applyMap(parseMarkerNumbers(body), numberMap)
      if (mapped.length === 0) return marker
      const rendered = formatMarkerText(mapped, style)
      if (rendered !== marker) markerEdits.push({ from: marker, to: rendered })
      return rendered
    })
    return `${open}${next}${close}`
  })
}

/** The run properties for a superscript marker run: the original rPr with any
 *  existing vertAlign replaced by superscript (created when absent). */
function superscriptRPr(rPr: string | null): string {
  if (!rPr || /^<w:rPr\b[^>]*\/>$/.test(rPr)) {
    return '<w:rPr><w:vertAlign w:val="superscript"/></w:rPr>'
  }
  const stripped = rPr.replace(/<w:vertAlign\b[^>]*\/>/g, '')
  return stripped.replace(/<\/w:rPr>$/, '<w:vertAlign w:val="superscript"/></w:rPr>')
}

/**
 * Rewrite one <w:r> for the superscript style: split it into prose runs
 * (original rPr) and marker runs (original rPr + w:vertAlign superscript).
 * Runs with non-text children (breaks, tabs, drawings) fall back to the
 * in-place text replace — renumbered but not superscripted — rather than risk
 * dropping content while rebuilding.
 */
function rewriteRunSuperscript(
  run: string,
  numberMap: Record<number, number> | undefined,
  markerEdits: MarkerEdit[],
): string {
  const openTag = run.match(/^<w:r\b[^>]*>/)
  if (!openTag) return run
  const inner = run.slice(openTag[0].length, run.length - '</w:r>'.length)

  const rPrMatch = inner.match(/^<w:rPr\b[^>]*>[\s\S]*?<\/w:rPr>|^<w:rPr\b[^>]*\/>/)
  const rPr = rPrMatch ? rPrMatch[0] : null
  const content = rPr ? inner.slice(rPr.length) : inner

  // Guardrail: rebuild only when the run's content is exclusively <w:t> text.
  const nonText = content.replace(/<w:t\b[^>]*>[\s\S]*?<\/w:t>/g, '').trim()
  if (nonText !== '') {
    return replaceInTextBlocks(run, 'superscript', numberMap, markerEdits)
  }

  const tBlocks = content.match(/<w:t\b[^>]*>[\s\S]*?<\/w:t>/g) ?? []
  // Raw (still XML-encoded) text — markers are plain [digits], unaffected by
  // encoding, and prose segments are re-emitted verbatim so entities survive.
  const raw = tBlocks.map((t) => t.replace(/^<w:t\b[^>]*>/, '').replace(/<\/w:t>$/, '')).join('')
  MARKER_RE.lastIndex = 0
  if (!MARKER_RE.test(raw)) return run
  MARKER_RE.lastIndex = 0

  const proseRPr = rPr ?? ''
  const markerRPr = superscriptRPr(rPr)
  const out: string[] = []
  let cursor = 0
  let changed = false
  for (let m = MARKER_RE.exec(raw); m !== null; m = MARKER_RE.exec(raw)) {
    const marker = m[0]
    const mapped = applyMap(parseMarkerNumbers(m[1]), numberMap)
    if (mapped.length === 0) continue
    const rendered = formatMarkerText(mapped, 'superscript')
    const prose = raw.slice(cursor, m.index)
    if (prose !== '') {
      out.push(`${openTag[0]}${proseRPr}<w:t xml:space="preserve">${prose}</w:t></w:r>`)
    }
    out.push(`${openTag[0]}${markerRPr}<w:t xml:space="preserve">${rendered}</w:t></w:r>`)
    markerEdits.push({ from: marker, to: rendered })
    cursor = m.index + marker.length
    changed = true
  }
  if (!changed) return run
  const tail = raw.slice(cursor)
  if (tail !== '') {
    out.push(`${openTag[0]}${proseRPr}<w:t xml:space="preserve">${tail}</w:t></w:r>`)
  }
  return out.join('')
}

/**
 * Renumber + restyle bracketed in-text markers ("[12]", "[1-3,5]") inside body
 * runs. Bracket/paren targets are replaced in place inside <w:t> text; a
 * superscript target splits the run so the marker run carries a real
 * <w:vertAlign w:val="superscript"/> (2026-07-22 — previously the brackets
 * were stripped to a bare prose digit, indistinguishable from a quantity).
 * Pre-existing author superscript citations (no brackets) are NOT renumbered —
 * known limitation, unchanged. Every text change is recorded as a MarkerEdit.
 *
 * @param numberMap optional old-number → new-number remap (dedup / reorder /
 *                  alphabetical→cited). Omit for a pure restyle.
 */
export function renumberCitations(
  docx: Docx,
  rules: JournalRules,
  numberMap?: Record<number, number>,
): RenumberResult {
  const style = rules.references.in_text
  let doc = docx.part(PART.document)
  const markerEdits: MarkerEdit[] = []
  if (!doc) return { markerEdits }

  if (style === 'superscript') {
    // Whole-run rewrite so the marker run can carry vertAlign. <w:r\b never
    // matches <w:rPr (no word boundary between "r" and "P"), the negative
    // lookahead skips self-closing <w:r/> (which would otherwise swallow up to
    // the NEXT run's close tag), and runs never nest, so the non-greedy match
    // is exact.
    doc = doc.replace(/<w:r\b(?![^>]*\/>)[^>]*>[\s\S]*?<\/w:r>/g, (run) =>
      rewriteRunSuperscript(run, numberMap, markerEdits),
    )
  } else {
    // Bracketed markers inside <w:t> text. Restricted to <w:t> content so we
    // never touch bracketed text outside runs (there is none in a body, but be
    // safe).
    doc = replaceInTextBlocks(doc, style, numberMap, markerEdits)
  }

  docx.setPart(PART.document, doc)
  return { markerEdits }
}
