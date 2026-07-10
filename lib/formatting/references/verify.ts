// Reference verification (Sushant, Session 87 scaffold → Session B).
// Look each parsed reference up in Crossref (then PubMed as fallback), enrich
// DOI/PMID, and check Crossref retraction data. Accept enrichment only on
// ≥0.85 title similarity; below that, mark 'unverified' (flagged, never
// dropped). Batched + resumable via a cursor to respect the ~50s Vercel
// budget. Crossref calls include a `mailto` (etiquette); NCBI stays under
// 3 req/s. No LLM here — external-fact verification is deterministic HTTP.
//
// HARD INVARIANT (mirrors render.ts / renumber.ts): this file imports NO LLM
// client. Verification against the literature is pure HTTP + string math.

import type { CslReference, VerifiedReference } from '../types'

export interface VerifyBatchResult {
  verified: VerifiedReference[]
  /** Index of the next reference to process, or null when the list is done. */
  nextCursor: number | null
}

/** Title-similarity acceptance gate. Deliberately strict: favour precision
 *  (mark 'unverified') over enriching against the wrong record. */
const SIMILARITY_THRESHOLD = 0.85

/** Wall-clock budget for one invocation. Vercel Hobby caps ~50s; we stop at
 *  ~40s and hand back a cursor so the caller can resume. */
const BUDGET_MS = 40_000

/** Per-request network timeout. */
const REQUEST_TIMEOUT_MS = 15_000

/** Politeness pause between the two NCBI E-utilities calls (keeps us <3 req/s
 *  even without an API key). */
const NCBI_PAUSE_MS = 350

const CONTACT_EMAIL = 'oscrsjournal@gmail.com'
const USER_AGENT = `OSCRSJ-Formatter/1.0 (mailto:${CONTACT_EMAIL})`

// ---------------------------------------------------------------------------
// Pure string helpers (exported for unit tests)
// ---------------------------------------------------------------------------

/** Lowercase, strip accents + punctuation, collapse whitespace. */
export function normalizeTitle(s: string): string {
  return (s ?? '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // fold accents (é → e) before stripping
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Classic Levenshtein edit distance, two-row DP (O(n) memory). */
export function levenshtein(a: string, b: string): number {
  const m = a.length
  const n = b.length
  if (m === 0) return n
  if (n === 0) return m
  let prev = new Array<number>(n + 1)
  for (let j = 0; j <= n; j++) prev[j] = j
  for (let i = 1; i <= m; i++) {
    const cur = new Array<number>(n + 1)
    cur[0] = i
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost)
    }
    prev = cur
  }
  return prev[n]
}

/**
 * Title similarity in [0,1]. Normalized Levenshtein ratio over the normalized
 * strings: 1 = identical, 0 = maximally different. Chosen over token Jaccard
 * because bibliographic titles returned by Crossref/PubMed are near-verbatim,
 * so character-level fidelity (robust to a stray typo, punctuation, or casing)
 * matches the use case better than bag-of-words overlap, which over-penalizes
 * a single differing token. Trade-off: it penalizes length gaps, so a title
 * that is a strict *substring* of the candidate (or vice-versa) scores low —
 * acceptable here since the 0.85 gate is intentionally precision-biased.
 */
export function titleSimilarity(a: string, b: string): number {
  const na = normalizeTitle(a ?? '')
  const nb = normalizeTitle(b ?? '')
  const maxLen = Math.max(na.length, nb.length)
  if (maxLen === 0) return 0
  return 1 - levenshtein(na, nb) / maxLen
}

// ---------------------------------------------------------------------------
// Crossref / PubMed response shapes + parsing helpers (exported for tests)
// ---------------------------------------------------------------------------

export interface CrossrefWork {
  DOI?: string
  title?: string[] | string
  'container-title'?: string[]
  'short-container-title'?: string[]
  volume?: string
  issue?: string
  page?: string
  author?: Array<{ family?: string; given?: string; name?: string }>
  issued?: { 'date-parts'?: number[][] }
  'published-print'?: { 'date-parts'?: number[][] }
  'published-online'?: { 'date-parts'?: number[][] }
  published?: { 'date-parts'?: number[][] }
  type?: string
  relation?: Record<string, unknown>
  'update-to'?: Array<{ type?: string }>
  'updated-by'?: Array<{ type?: string }>
}

/** Build the `query.bibliographic` string from the structured reference. */
export function buildQuery(ref: CslReference): string {
  const parts: string[] = []
  if (ref.title) parts.push(ref.title)
  const authors = (ref.authors ?? [])
    .map((a) => a.family)
    .filter((f): f is string => !!f && f.trim().length > 0)
    .join(' ')
  if (authors) parts.push(authors)
  if (ref.year) parts.push(ref.year)
  if (ref.containerTitle) parts.push(ref.containerTitle)
  return parts.join(' ').replace(/\s+/g, ' ').trim()
}

function firstStr(v: unknown): string | null {
  if (Array.isArray(v)) {
    const s = v.find((x) => typeof x === 'string' && x.trim().length > 0)
    return typeof s === 'string' ? s : null
  }
  return typeof v === 'string' && v.trim().length > 0 ? v : null
}

/** Pull the display title off a Crossref work (title is an array of strings). */
export function crossrefTitle(item: CrossrefWork): string {
  return firstStr(item.title) ?? ''
}

/**
 * Among Crossref `message.items`, return the candidate whose title is most
 * similar to `title`, plus that similarity. Empty/malformed input → no match.
 */
export function pickBestCrossrefCandidate(
  json: unknown,
  title: string | null,
): { item: CrossrefWork | null; similarity: number } {
  const items = ((json as { message?: { items?: CrossrefWork[] } })?.message?.items) ?? []
  let best: CrossrefWork | null = null
  let bestSim = 0
  for (const item of items) {
    const sim = titleSimilarity(title ?? '', crossrefTitle(item))
    if (sim > bestSim) {
      bestSim = sim
      best = item
    }
  }
  return { item: best, similarity: bestSim }
}

/** First-year from the richest available Crossref date field. */
export function crossrefYear(item: CrossrefWork): string | null {
  const dp =
    item.issued?.['date-parts'] ??
    item['published-print']?.['date-parts'] ??
    item['published-online']?.['date-parts'] ??
    item.published?.['date-parts']
  const y = dp?.[0]?.[0]
  return y != null ? String(y) : null
}

/** Normalize a Crossref/PubMed author array to CSL {family, given}. */
export function crossrefAuthors(item: CrossrefWork): { family: string; given: string }[] {
  const arr = item.author
  if (!Array.isArray(arr)) return []
  return arr
    .map((a) => ({
      family: (a.family ?? a.name ?? '').trim(),
      given: (a.given ?? '').trim(),
    }))
    .filter((a) => a.family.length > 0)
}

/**
 * Best-effort retraction detection from a Crossref work.
 *
 * LIMITATION: Crossref only carries retraction signals when the publisher
 * deposited CrossMark `update-to` / `updated-by` relations or an
 * `is-retracted-by` relation. Coverage is incomplete and lags real
 * retractions; the authoritative source is the Retraction Watch database
 * (now folded into Crossref Labs) which we do NOT query here. So a `false`
 * from this function is "no retraction flag found", NOT "confirmed clean".
 */
export function isRetractedCrossrefWork(item: CrossrefWork | null | undefined): boolean {
  if (!item) return false

  // 1. relation.is-retracted-by present + non-empty
  const rel = item.relation as Record<string, unknown> | undefined
  if (rel && 'is-retracted-by' in rel) {
    const v = rel['is-retracted-by']
    if (Array.isArray(v) ? v.length > 0 : v != null) return true
  }

  // 2. an update-to / updated-by entry whose type mentions "retraction"
  const mentionsRetraction = (list: unknown): boolean =>
    Array.isArray(list) &&
    list.some(
      (u) =>
        typeof (u as { type?: unknown })?.type === 'string' &&
        (u as { type: string }).type.toLowerCase().includes('retraction'),
    )
  if (mentionsRetraction(item['update-to'])) return true
  if (mentionsRetraction(item['updated-by'])) return true

  // 3. the work is itself typed as a retracted article
  if (typeof item.type === 'string' && item.type.toLowerCase() === 'retracted-article') {
    return true
  }

  return false
}

/** PubMed esearch → ordered PMID list. */
export function parseEsearchIds(json: unknown): string[] {
  const ids = (json as { esearchresult?: { idlist?: unknown } })?.esearchresult?.idlist
  return Array.isArray(ids) ? ids.filter((x): x is string => typeof x === 'string') : []
}

export interface PubmedSummary {
  pmid: string
  title: string
  doi: string | null
}

/** PubMed esummary record for `pmid` → {pmid, title, doi}. */
export function parsePubmedSummary(json: unknown, pmid: string): PubmedSummary | null {
  const rec = (json as { result?: Record<string, unknown> })?.result?.[pmid] as
    | {
        title?: string
        articleids?: Array<{ idtype?: string; value?: string }>
      }
    | undefined
  if (!rec) return null
  const doiEntry = (rec.articleids ?? []).find(
    (a) => typeof a?.idtype === 'string' && a.idtype.toLowerCase() === 'doi',
  )
  return {
    pmid,
    title: typeof rec.title === 'string' ? rec.title : '',
    doi: doiEntry?.value ? normalizeDoi(doiEntry.value) : null,
  }
}

/** Strip URL/`doi:` prefixes, lowercase (DOIs are case-insensitive). */
export function normalizeDoi(doi: string | null | undefined): string | null {
  if (!doi) return null
  const trimmed = doi
    .trim()
    .replace(/^https?:\/\/(dx\.)?doi\.org\//i, '')
    .replace(/^doi:\s*/i, '')
  return trimmed.length > 0 ? trimmed.toLowerCase() : null
}

// ---------------------------------------------------------------------------
// Enrichment (pure: reference-in → reference-out + changed flag)
// ---------------------------------------------------------------------------

function isEmpty(v: string | null | undefined): boolean {
  return v == null || v.trim().length === 0
}

function sameAuthors(
  a: { family: string; given: string }[],
  b: { family: string; given: string }[],
): boolean {
  if (a.length !== b.length) return false
  const norm = (x: { family: string; given: string }) =>
    `${x.family.trim().toLowerCase()}|${x.given.trim().toLowerCase()}`
  return a.every((x, i) => norm(x) === norm(b[i]))
}

export function enrichFromCrossref(
  ref: CslReference,
  item: CrossrefWork,
): { reference: CslReference; changed: boolean } {
  const next: CslReference = { ...ref }
  let changed = false

  const fillMissing = (key: 'doi' | 'containerTitle' | 'volume' | 'issue' | 'page' | 'year', value: string | null) => {
    if (value != null && value.trim().length > 0 && isEmpty(next[key])) {
      next[key] = value
      changed = true
    }
  }

  fillMissing('doi', normalizeDoi(item.DOI))
  fillMissing('containerTitle', firstStr(item['container-title']) ?? firstStr(item['short-container-title']))
  fillMissing('volume', item.volume ?? null)
  fillMissing('issue', item.issue ?? null)
  fillMissing('page', item.page ?? null)
  fillMissing('year', crossrefYear(item))

  const crAuthors = crossrefAuthors(item)
  if (crAuthors.length > 0 && !sameAuthors(next.authors ?? [], crAuthors)) {
    next.authors = crAuthors
    changed = true
  }

  return { reference: next, changed }
}

export function enrichFromPubmed(
  ref: CslReference,
  summary: PubmedSummary,
): { reference: CslReference; changed: boolean } {
  const next: CslReference = { ...ref }
  let changed = false
  if (isEmpty(next.pmid) && summary.pmid) {
    next.pmid = summary.pmid
    changed = true
  }
  if (isEmpty(next.doi) && summary.doi) {
    next.doi = summary.doi
    changed = true
  }
  return { reference: next, changed }
}

// ---------------------------------------------------------------------------
// Networking
// ---------------------------------------------------------------------------

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

/** GET + JSON with a hard timeout; any failure resolves to null (never throws). */
async function fetchJson(url: string): Promise<unknown> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
    })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

async function crossrefLookup(
  ref: CslReference,
): Promise<{ item: CrossrefWork | null; similarity: number }> {
  const query = buildQuery(ref)
  if (!query) return { item: null, similarity: 0 }
  const url =
    'https://api.crossref.org/works?query.bibliographic=' +
    encodeURIComponent(query) +
    '&rows=5&mailto=' +
    encodeURIComponent(CONTACT_EMAIL)
  const json = await fetchJson(url)
  if (!json) return { item: null, similarity: 0 }
  return pickBestCrossrefCandidate(json, ref.title)
}

async function pubmedLookup(
  ref: CslReference,
): Promise<{ summary: PubmedSummary | null; similarity: number }> {
  const term = buildQuery(ref)
  if (!term) return { summary: null, similarity: 0 }

  const esearchUrl =
    'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&retmode=json&term=' +
    encodeURIComponent(term) +
    '&retmax=1&tool=oscrsj-formatter&email=' +
    encodeURIComponent(CONTACT_EMAIL)
  const searchJson = await fetchJson(esearchUrl)
  const ids = parseEsearchIds(searchJson)
  if (ids.length === 0) return { summary: null, similarity: 0 }
  const pmid = ids[0]

  // Etiquette pause between the two NCBI calls.
  await sleep(NCBI_PAUSE_MS)

  const esummaryUrl =
    'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&retmode=json&id=' +
    encodeURIComponent(pmid) +
    '&tool=oscrsj-formatter&email=' +
    encodeURIComponent(CONTACT_EMAIL)
  const summaryJson = await fetchJson(esummaryUrl)
  const summary = parsePubmedSummary(summaryJson, pmid)
  if (!summary) return { summary: null, similarity: 0 }

  const similarity = titleSimilarity(ref.title ?? '', summary.title)
  return { summary, similarity }
}

/**
 * Verify a single reference: Crossref first, PubMed fallback only when Crossref
 * is below the gate. Never throws — worst case returns 'unverified'/'none'.
 */
async function verifyOne(ref: CslReference): Promise<VerifiedReference> {
  let bestSimilarity = 0

  // 1. Crossref
  const cr = await crossrefLookup(ref)
  bestSimilarity = Math.max(bestSimilarity, cr.similarity)
  if (cr.item && cr.similarity >= SIMILARITY_THRESHOLD) {
    const { reference, changed } = enrichFromCrossref(ref, cr.item)
    const status = isRetractedCrossrefWork(cr.item)
      ? 'possibly-retracted'
      : changed
        ? 'corrected'
        : 'verified'
    return { reference, status, matchConfidence: cr.similarity, source: 'crossref' }
  }

  // 2. PubMed fallback (only reached when Crossref < gate)
  const pm = await pubmedLookup(ref)
  bestSimilarity = Math.max(bestSimilarity, pm.similarity)
  if (pm.summary && pm.similarity >= SIMILARITY_THRESHOLD) {
    const { reference, changed } = enrichFromPubmed(ref, pm.summary)
    const status = changed ? 'corrected' : 'verified'
    return { reference, status, matchConfidence: pm.similarity, source: 'pubmed' }
  }

  // 3. No match — flag, but never drop the reference.
  return {
    reference: ref,
    status: 'unverified',
    matchConfidence: bestSimilarity,
    source: 'none',
  }
}

/**
 * Verify references from `startCursor` onward until the list is exhausted or
 * the ~40s wall-clock budget is spent. Returns the batch and `nextCursor` =
 * the index of the first unprocessed reference (or null when done). Always
 * makes progress on at least one reference so the cursor can't stall.
 */
export async function verifyReferences(
  refs: CslReference[],
  startCursor: number,
): Promise<VerifyBatchResult> {
  // Captured at entry (NOT module top-level) so the budget is per-invocation.
  const startedAt = Date.now()
  const verified: VerifiedReference[] = []

  let i = Math.max(0, startCursor)
  for (; i < refs.length; i++) {
    // Stop once over budget, but guarantee ≥1 reference processed per call.
    if (verified.length > 0 && Date.now() - startedAt > BUDGET_MS) break
    verified.push(await verifyOne(refs[i]))
  }

  const nextCursor = i < refs.length ? i : null
  return { verified, nextCursor }
}
