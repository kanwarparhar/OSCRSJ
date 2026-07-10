// Reference renderers (Sushant, Session 87 scaffold → Session B).
// Deterministic, hand-rolled per-style renderers over CSL-JSON (NLM/Vancouver,
// AMA variants) — NOT citeproc-js. Handles et-al threshold, NLM journal
// abbreviation, punctuation, DOI format, volume/issue style per the journal's
// `references` rules.
//
// HARD INVARIANT: this file imports NO LLM client (grep-provable acceptance
// criterion). Rendering is pure and deterministic — the only imports are types.

import type { CslReference } from '../types'
import type { JournalRules } from '../rulesSchema'

// ---------------------------------------------------------------------------
// NLM (Index Medicus) journal-title abbreviation
// ---------------------------------------------------------------------------
//
// A hand-built word→abbreviation map. Index Medicus style carries NO periods on
// the abbreviated words (e.g. "Surg", "Am", "Orthop"); the trailing period in a
// rendered citation is the sentence separator, not an abbreviation dot. Keys are
// lowercase; both British/American and singular/plural spellings map to the same
// stem. Words not in the map are kept and only their first letter is upcased, so
// unknown terms and acronyms (e.g. "MRI") survive intact. Connective words
// (of/and/the) are dropped per NLM convention.

const NLM_ABBREV: Record<string, string> = {
  // structural / general
  journal: 'J',
  journals: 'J',
  surgery: 'Surg',
  surgical: 'Surg',
  medicine: 'Med',
  medical: 'Med',
  clinical: 'Clin',
  clinics: 'Clin',
  research: 'Res',
  related: 'Relat',
  reports: 'Rep',
  report: 'Rep',
  case: 'Case',
  review: 'Rev',
  reviews: 'Rev',
  annals: 'Ann',
  annual: 'Annu',
  archives: 'Arch',
  association: 'Assoc',
  society: 'Soc',
  official: 'Off',
  volume: 'Vol',
  // geography / language
  american: 'Am',
  america: 'Am',
  british: 'Br',
  european: 'Eur',
  international: 'Int',
  north: 'N',
  south: 'S',
  east: 'E',
  west: 'W',
  // orthopaedic domain
  orthopaedic: 'Orthop',
  orthopedic: 'Orthop',
  orthopaedics: 'Orthop',
  orthopedics: 'Orthop',
  bone: 'Bone',
  joint: 'Joint',
  sports: 'Sports',
  arthroplasty: 'Arthroplasty',
  arthroscopy: 'Arthrosc',
  trauma: 'Trauma',
  shoulder: 'Shoulder',
  elbow: 'Elbow',
  hand: 'Hand',
  wrist: 'Wrist',
  foot: 'Foot',
  ankle: 'Ankle',
  knee: 'Knee',
  hip: 'Hip',
  spine: 'Spine',
  cartilage: 'Cartilage',
  injury: 'Injury',
  fracture: 'Fract',
  fractures: 'Fract',
  rheumatology: 'Rheumatol',
  rehabilitation: 'Rehabil',
  biomechanics: 'Biomech',
  pediatric: 'Pediatr',
  paediatric: 'Paediatr',
  disease: 'Dis',
  diseases: 'Dis',
}

/** Connective words NLM drops from abbreviated journal titles. */
const DROP_WORDS = new Set(['of', 'and', 'the'])

/** Abbreviate a container (journal) title to NLM/Index Medicus style. */
function abbreviateJournalNlm(name: string): string {
  const out: string[] = []
  for (const raw of name.split(/\s+/)) {
    // Strip surrounding punctuation (commas, periods, colons) but keep the word.
    const cleaned = raw.replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g, '')
    if (!cleaned) continue
    const lower = cleaned.toLowerCase()
    if (DROP_WORDS.has(lower)) continue
    const mapped = NLM_ABBREV[lower]
    out.push(mapped ?? cleaned.charAt(0).toUpperCase() + cleaned.slice(1))
  }
  return out.join(' ')
}

// ---------------------------------------------------------------------------
// Field-level helpers
// ---------------------------------------------------------------------------

/** Initials from a given name: "John A" → "JA", "Sang Hoon" → "SH". No dots. */
function initials(given: string): string {
  return given
    .split(/[\s.\-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase())
    .join('')
}

/** One author as "Family AB" (family + space + concatenated initials, no dots). */
function formatAuthor(author: { family: string; given: string }): string {
  const inits = initials(author.given ?? '')
  return [author.family ?? '', inits].filter(Boolean).join(' ')
}

/**
 * Author-list segment ending in a period. Applies the et-al threshold: when
 * non-null and the list is longer than the threshold, the first `threshold`
 * authors are listed followed by "et al."; when null, every author is listed.
 */
function authorsSegment(ref: CslReference, rules: JournalRules): string {
  const authors = ref.authors ?? []
  if (authors.length === 0) return ''

  const threshold = rules.references.et_al_threshold
  const truncate = threshold !== null && authors.length > threshold
  const listed = truncate ? authors.slice(0, threshold) : authors

  let s = listed.map(formatAuthor).join(', ')
  if (truncate) s += ', et al'
  return s + '.'
}

/** Title segment kept verbatim, terminated with a period unless it already ends in .?!. */
function titleSegment(ref: CslReference): string {
  const title = ref.title?.trim()
  if (!title) return ''
  return /[.?!]$/.test(title) ? title : title + '.'
}

/** Journal segment: NLM-abbreviated or verbatim per rules, terminated with a period. */
function journalSegment(ref: CslReference, rules: JournalRules): string {
  const container = ref.containerTitle?.trim()
  if (!container) return ''
  const journal =
    rules.references.journal_abbrev === 'nlm'
      ? abbreviateJournalNlm(container)
      : container
  return journal ? journal + '.' : ''
}

/**
 * Publication-detail segment: "Year;Volume(Issue):Pages." — every element is
 * optional and omitted absences leave no stray separators.
 */
function publicationSegment(ref: CslReference): string {
  let s = ''
  if (ref.year) s += ref.year
  if (ref.volume) s += (s ? ';' : '') + ref.volume
  if (ref.issue) s += '(' + ref.issue + ')'
  if (ref.page) s += (s ? ':' : '') + ref.page
  return s ? s + '.' : ''
}

/** DOI segment "doi:10.xxxx" — only when include_doi is set and a DOI exists. No period. */
function doiSegment(ref: CslReference, rules: JournalRules): string {
  if (!rules.references.include_doi) return ''
  const doi = ref.doi?.trim()
  return doi ? 'doi:' + doi : ''
}

// ---------------------------------------------------------------------------
// Style cores
// ---------------------------------------------------------------------------
//
// The renderer assembles a list of period-terminated segments and joins them
// with a single space. Empty segments (missing fields) are dropped, so absent
// data never produces stray punctuation.

function assemble(segments: string[]): string {
  return segments.filter(Boolean).join(' ')
}

/** NLM / Vancouver core (also the fallback for the 'custom' style). */
function renderNlm(ref: CslReference, rules: JournalRules): string {
  return assemble([
    authorsSegment(ref, rules),
    titleSegment(ref),
    journalSegment(ref, rules),
    publicationSegment(ref),
    doiSegment(ref, rules),
  ])
}

/**
 * AMA 11th core. For a journal article over this field set, AMA 11th coincides
 * with NLM/Vancouver in plain text: the same author-initials style (no dots),
 * NLM journal abbreviation, "Year;Vol(Issue):Pages." block, and "doi:10.xxxx".
 * AMA's only formal divergence here is italicising the journal title, which is a
 * character-run attribute the emit layer applies — not part of the plain string.
 * Kept as a distinct function so book/chapter divergence can land without
 * touching the NLM path.
 */
function renderAma(ref: CslReference, rules: JournalRules): string {
  return assemble([
    authorsSegment(ref, rules),
    titleSegment(ref),
    journalSegment(ref, rules),
    publicationSegment(ref),
    doiSegment(ref, rules),
  ])
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Render one reference to the journal's exact style string. */
export function renderReference(ref: CslReference, rules: JournalRules): string {
  switch (rules.references.style) {
    case 'ama':
      return renderAma(ref, rules)
    case 'nlm':
    case 'vancouver':
    case 'custom':
    default:
      return renderNlm(ref, rules)
  }
}

/**
 * Render the full reference list. Ordering is decided upstream
 * (rules.references.order is resolved before this call); here we simply map.
 */
export function renderReferenceList(refs: CslReference[], rules: JournalRules): string[] {
  return refs.map((ref) => renderReference(ref, rules))
}
