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

/**
 * Renumber + restyle bracketed in-text markers ("[12]", "[1-3,5]") inside body
 * runs. Superscript-run markers are renumbered in place when already in the
 * target style. Every text change is recorded as a MarkerEdit.
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

  // Bracketed markers inside <w:t> text. Restricted to <w:t> content so we never
  // touch bracketed text outside runs (there is none in a body, but be safe).
  doc = doc.replace(/(<w:t\b[^>]*>)([\s\S]*?)(<\/w:t>)/g, (_full, open, text, close) => {
    const next = text.replace(/\[(\d+(?:\s*[-–,]\s*\d+)*)\]/g, (marker: string, body: string) => {
      const mapped = applyMap(parseMarkerNumbers(body), numberMap)
      if (mapped.length === 0) return marker
      const rendered = formatMarkerText(mapped, style)
      if (rendered !== marker) markerEdits.push({ from: marker, to: rendered })
      return rendered
    })
    return `${open}${next}${close}`
  })

  docx.setPart(PART.document, doc)
  return { markerEdits }
}
