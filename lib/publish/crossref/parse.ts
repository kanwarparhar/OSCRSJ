/**
 * Pure parsing helpers for the deposit record.
 *
 * Split out of depositInput.ts so they are testable offline: depositInput
 * imports the Supabase server client, which the `tsx --test` suite cannot
 * resolve (no path aliases) and should not need to.
 */

import type { DepositReference } from './depositXml'

// Name particles that belong to the surname, and suffixes that are not one.
const PARTICLES = new Set([
  'van', 'von', 'der', 'den', 'de', 'del', 'della', 'da', 'das', 'dos', 'di',
  'du', 'la', 'le', 'ter', 'ten', 'bin', 'ibn', 'al', 'st', 'st.',
])
const SUFFIXES = new Set(['jr', 'jr.', 'sr', 'sr.', 'ii', 'iii', 'iv', 'v'])

/**
 * Splits a display name into Crossref's given_name / surname.
 *
 * A heuristic writing to a PERMANENT record, so it errs toward keeping more in
 * the surname (particles stay attached) rather than fabricating a split. Names
 * that defeat it should be corrected in the metadata editor before acceptance
 * — afterwards, fixing one means a full re-deposit.
 */
export function splitName(fullName: string): { givenName: string | null; surname: string } {
  const tokens = (fullName || '').trim().split(/\s+/).filter(Boolean)
  if (tokens.length === 0) return { givenName: null, surname: '' }
  if (tokens.length === 1) return { givenName: null, surname: tokens[0] }

  let end = tokens.length
  while (end > 1 && SUFFIXES.has(tokens[end - 1].toLowerCase().replace(/,$/, ''))) {
    end -= 1
  }
  let start = end - 1
  while (start > 1 && PARTICLES.has(tokens[start - 1].toLowerCase())) {
    start -= 1
  }

  // Suffix tokens rejoin the surname so nothing is silently dropped.
  const surname = tokens.slice(start).join(' ')
  const given = tokens.slice(0, start).join(' ')
  return { givenName: given || null, surname: surname || tokens[tokens.length - 1] }
}

/**
 * Pulls references out of stored JATS.
 *
 * Reference DOIs only exist when an author literally typed a doi.org URL, so
 * most come through as unstructured text — which Crossref matches
 * server-side. That is a supported deposit path, not a shortfall.
 */
export function extractReferencesFromJats(jats: string): DepositReference[] {
  const refs: DepositReference[] = []
  // `<ref\b` also matches `<ref-list>` (a hyphen IS a word boundary), which
  // swallowed the wrapper as reference #1 and shifted every key by one.
  // Require whitespace or the tag close immediately after `ref`.
  const refRe = /<ref(\s[^>]*)?>([\s\S]*?)<\/ref>/gi
  let m: RegExpExecArray | null
  let i = 0
  while ((m = refRe.exec(jats)) !== null) {
    i += 1
    const attrs = m[1] || ''
    const id = /\bid="([^"]*)"/i.exec(attrs)?.[1] || `ref${i}`
    const body = m[2]
    const doiMatch =
      /<pub-id[^>]*pub-id-type="doi"[^>]*>([\s\S]*?)<\/pub-id>/i.exec(body)?.[1] ||
      /\b(10\.\d{4,9}\/[^\s"'<>]+)/.exec(body)?.[1]
    const text = body
      .replace(/<[^>]+>/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/\s+/g, ' ')
      .trim()
    if (!doiMatch && !text) continue
    refs.push({
      key: id,
      doi: doiMatch ? doiMatch.replace(/[.,;]+$/, '').trim() : null,
      unstructured: text || null,
    })
  }
  return refs
}
