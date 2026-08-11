/**
 * OSCRSJ journal identity — the single source of truth.
 *
 * WHY THIS FILE EXISTS (execution-plan gap G12)
 * Journal identity was scattered and already diverging: `synthesize.ts`
 * hardcoded `volume: 1`, the article page hardcoded `citation_volume '1'` /
 * `citation_issue '1'`, and TWO different citation builders (the site page's
 * and the renderer payload's `suggested_citation_html`) had drifted apart.
 * The Crossref deposit generator asserts all of this as a matter of public
 * record, so it needs one place to read it from.
 *
 * Deliberately pure and dependency-free — no `server-only`, no node builtins,
 * no Supabase. Client components and the offline test suite both import it.
 */

import { DOI_PREFIX, DOI_SUFFIX_NS, buildDoi, isValidOscrsjDoi } from './doi'

export { DOI_PREFIX, DOI_SUFFIX_NS, buildDoi, isValidOscrsjDoi }

// ---- Identity ----
export const JOURNAL_FULL = 'Orthopedic Surgery Case Reports and Series Journal'
export const JOURNAL_SHORT = 'OSCRSJ'
export const JOURNAL_ABBREV = 'OSCRSJ'
export const PUBLISHER = 'OSCRSJ LLC'
export const PUBLISHER_PLACE = 'Kent, Washington, United States'
export const LICENSE_URL = 'https://creativecommons.org/licenses/by/4.0/'
export const SITE_ORIGIN = 'https://www.oscrsj.com'

/**
 * Electronic ISSN. NULL until the Library of Congress assigns one
 * (application APPL0007345, filed 2026-07-25).
 *
 * Every consumer MUST treat null as "omit the field entirely" rather than
 * emitting a placeholder. A syntactically-valid fake ISSN in a Crossref
 * deposit or a Highwire tag is worse than an absent one: it is machine-read
 * as a real identifier for a different (or nonexistent) journal.
 *
 * Flipping this is TWO changes, not one (gap G10): this constant AND the
 * renderer's `JOURNAL_ISSN` env var (plus the launchd plist environment on
 * the render host). Neither alone is sufficient.
 */
export const ISSN: string | null = null

// ---- Volume / issue ----
// OSCRSJ publishes continuously within an annual volume. Volume 1 = 2026.
// Before 2027 this needs real per-article volume handling backed by columns
// (gap G12) — until then every published article is genuinely 1(1) and this
// constant is true rather than merely convenient.
export const VOLUME_START_YEAR = 2026
export const CURRENT_VOLUME = 1
export const CURRENT_ISSUE = 1

export function volumeForYear(year: number | null | undefined): number {
  if (!year || !Number.isFinite(year)) return CURRENT_VOLUME
  return Math.max(1, year - VOLUME_START_YEAR + 1)
}

// ---- URLs ----
// Canonical article URLs are ALWAYS the elocation form. Deriving them from a
// route param instead lets `/articles/{uuid}` self-canonicalize, which is a
// duplicate-content signal against our own article (gap G14) — and, worse,
// would make the Crossref `resource` URL disagree with the canonical tag.
export function canonicalArticleUrl(elocationId: string): string {
  return `${SITE_ORIGIN}/articles/${elocationId}`
}

export function articlePdfUrl(elocationId: string): string {
  return `${SITE_ORIGIN}/articles/${elocationId}/pdf`
}

/**
 * Crossref's display guidelines require the full-URL form, hyperlinked, with
 * no `doi:` anchor-text prefix.
 */
export function doiDisplayUrl(doi: string): string {
  return `https://doi.org/${doi}`
}

// ---- Route params ----
const ELOCATION_RE = /^e\d{4,}$/i
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export type ArticleParamKind = 'elocation' | 'uuid' | 'invalid'

/**
 * Classifies an `/articles/[id]` route param. `elocation` is served directly;
 * `uuid` is served then permanently redirected to the elocation form;
 * `invalid` is a 404 (never a database round-trip).
 */
export function classifyArticleParam(param: string | null | undefined): ArticleParamKind {
  const p = (param || '').trim()
  if (!p) return 'invalid'
  if (ELOCATION_RE.test(p)) return 'elocation'
  if (UUID_RE.test(p)) return 'uuid'
  return 'invalid'
}

export function normalizeElocationParam(param: string): string {
  return param.trim().toLowerCase()
}

// ---- Citation ----
export interface CitationParts {
  authors: string[]
  title: string
  year: number | string
  volume?: number
  issue?: number
  elocationId: string
  doi?: string | null
}

/**
 * The ONE citation builder. `synthesize.ts` (which bakes the string into the
 * PDF) and the article page's copy-paste box must not drift again — they
 * already had, before this function existed.
 *
 * Format: `Last AB, Last CD. Title. OSCRSJ. 2026;1(1):e0001. doi:10.67687/oscrsj.e0001`
 */
export function buildCitation(parts: CitationParts): string {
  const names = parts.authors
    .map((full) => {
      const tokens = full.trim().split(/\s+/).filter(Boolean)
      if (tokens.length === 0) return ''
      const last = tokens[tokens.length - 1]
      const initials = tokens
        .slice(0, -1)
        .map((t) => t[0]?.toUpperCase() || '')
        .join('')
      return initials ? `${last} ${initials}` : last
    })
    .filter(Boolean)
    .join(', ')

  const vol = parts.volume ?? CURRENT_VOLUME
  const iss = parts.issue ?? CURRENT_ISSUE
  const head = `${names}. ${parts.title}. ${JOURNAL_SHORT}. ${parts.year};${vol}(${iss}):${parts.elocationId}.`
  return parts.doi ? `${head} doi:${parts.doi}` : head
}
