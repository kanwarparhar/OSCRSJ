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

/**
 * Normalize a SHOUTED family name to NLM casing.
 *
 * Why this exists: `verify.ts` replaces a matched reference's author list with
 * Crossref's record, and Crossref metadata is inconsistently cased — some
 * publishers deposit "SKAGGS DL". Observed live (job 2efc02ee): the author's
 * own manuscript said "Skaggs DL" and the enrichment step made it WORSE.
 * NLM/Vancouver/AMA never render an all-caps surname, so this is safe in one
 * direction only.
 *
 * SAFETY PROPERTY: a name containing ANY lowercase letter is returned
 * untouched. "McKee", "van der Berg", "d'Auvergne" are already correct and
 * must never be rewritten — we only repair names that carry no case
 * information at all, where any casing we produce is strictly better than
 * shouting.
 *
 * This is deterministic string work on the emit path. It is NOT delegated to
 * the structurer: the model is told to copy verbatim, and correctness here
 * must not depend on which model is behind the parse step.
 */
export function normalizeFamilyName(family: string): string {
  if (!family || /[a-z]/.test(family)) return family
  // Case each run of letters, so separators (space, hyphen, apostrophe) are
  // preserved exactly: "O'BRIEN" → "O'Brien", "SMITH-JONES" → "Smith-Jones".
  const cased = family.replace(
    /[A-Z]+/g,
    (w) => w.charAt(0) + w.slice(1).toLowerCase(),
  )
  // "MCKEE" → "Mckee" → "McKee". Mc- surnames essentially always capitalize
  // the following letter. Mac- is deliberately NOT handled: it is genuinely
  // ambiguous (MacDonald vs Macon vs Mackey), and "Macdonald" is an accepted
  // NLM rendering, so guessing there could make a correct name wrong.
  return cased.replace(/\bMc([a-z])/g, (_, c: string) => 'Mc' + c.toUpperCase())
}

/**
 * Initials from a given name: "John A" → "JA", "Sang Hoon" → "SH". No dots.
 *
 * A token that is ALREADY an unseparated initial block keeps all its letters:
 * the structurer parses "Skaggs DL" into given "DL", and taking only the first
 * character would silently DROP an initial from the author's own citation.
 *
 * The all-caps test is capped at two letters on purpose. "DL"/"JM" as a
 * two-letter full given name effectively does not occur, whereas a shouted
 * three-letter given name ("ANN", "AMY") very much does — and those must still
 * reduce to a single initial. Beyond two letters we treat it as a name.
 */
function initials(given: string): string {
  return given
    .split(/[\s.\-]+/)
    .filter(Boolean)
    .map((part) =>
      !/[a-z]/.test(part) && part.length === 2 ? part.toUpperCase() : part.charAt(0).toUpperCase(),
    )
    .join('')
}

/** One author as "Family AB" (family + space + concatenated initials, no dots). */
function formatAuthor(author: { family: string; given: string }): string {
  const inits = initials(author.given ?? '')
  return [normalizeFamilyName(author.family ?? ''), inits].filter(Boolean).join(' ')
}

/**
 * Per-style author-list default, applied when the journal's guide is silent
 * (et_al_threshold === null). 2026-07-22 doctrine fix: null used to mean
 * "list every author", which fabricated a rule out of guide silence.
 *
 * Style-manual grounding for 6:
 *  - Vancouver / ICMJE Recommendations (Citing Medicine sample citations):
 *    "list the first six authors followed by et al."
 *  - NLM Citing Medicine, Ch. 1: all authors, or first six + "et al." as the
 *    accepted space-saving form — 6 is the standard truncation point.
 *  - AMA Manual of Style 11th ed. §3.7 technically truncates >6 lists to the
 *    first THREE + "et al."; the single-N schema field cannot express
 *    "3-of->6", and the build brief prescribes 6 — the conservative direction
 *    (listing more authors than AMA's floor is never a violation an editor
 *    rejects over; listing three when the journal wanted six could be).
 *  - 'custom': no manual to consult, so no truncation — every author is
 *    listed, which is never wrong and preserves prior behavior for the 29
 *    custom-style journals.
 */
const STYLE_DEFAULT_ET_AL: Record<JournalRules['references']['style'], number | null> = {
  nlm: 6,
  vancouver: 6,
  ama: 6,
  custom: null,
}

/**
 * Author-list segment ending in a period. Three-state et-al threshold:
 * number N → first N authors then "et al."; 'all' → every author (the guide
 * explicitly requires it); null → the citation style's own default above.
 */
function authorsSegment(ref: CslReference, rules: JournalRules): string {
  const authors = ref.authors ?? []
  if (authors.length === 0) return ''

  const declared = rules.references.et_al_threshold
  const threshold =
    declared === 'all' ? null : declared ?? STYLE_DEFAULT_ET_AL[rules.references.style]
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
/**
 * Page ranges use a plain hyphen in NLM/Vancouver/AMA. Crossref deposits
 * frequently carry a typographic en dash ("702–707"), which then ships in a
 * list we told the author is formatted for their journal. Only dash characters
 * are touched, so "e51", "S12-S18" and single pages are unaffected.
 */
function normalizePageRange(page: string): string {
  return page.replace(/[‐‑‒–—―−]/g, '-')
}

function publicationSegment(ref: CslReference): string {
  let s = ''
  if (ref.year) s += ref.year
  if (ref.volume) s += (s ? ';' : '') + ref.volume
  if (ref.issue) s += '(' + ref.issue + ')'
  if (ref.page) s += (s ? ':' : '') + normalizePageRange(ref.page)
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
