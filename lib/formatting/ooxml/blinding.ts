// Blinding transforms (Sushant, Session B). Driven by rules.blinding.
// AUTO: strip docx core-properties author metadata (does NOT touch body text).
// FLAG (never auto-rewrite prose): body self-identification ("our institution,
// X University") is detected and reported with an excerpt for the author to fix.
// Producing the separate anonymized title page is titlePage.ts's job.

import type { ContentModel, FormattingContext, ReportChange, ReportSuggestion } from '../types'
import { Docx, PART } from './docx'

export interface BlindingResult {
  changes: ReportChange[]
  /** Self-identification the engine deliberately did NOT rewrite — flagged. */
  flags: ReportSuggestion[]
}

function blankTag(xml: string, tag: string): { xml: string; had: boolean } {
  let had = false
  const withBody = new RegExp(`(<${tag}\\b[^>]*>)[\\s\\S]*?(</${tag}>)`)
  if (withBody.test(xml)) {
    const next = xml.replace(withBody, (_m, open, close) => {
      if (/[^>]/.test(_m.replace(/<[^>]*>/g, ''))) had = true
      return `${open}${close}`
    })
    return { xml: next, had }
  }
  return { xml, had }
}

function scrubCoreProps(docx: Docx, changes: ReportChange[]): void {
  const core = docx.part(PART.coreProps)
  if (core) {
    let out = core
    let scrubbed = false
    for (const tag of ['dc:creator', 'cp:lastModifiedBy']) {
      const r = blankTag(out, tag)
      out = r.xml
      scrubbed = scrubbed || r.had
    }
    docx.setPart(PART.coreProps, out)
    if (scrubbed) {
      changes.push({
        element: 'Document metadata',
        before: 'author name in file properties',
        after: 'scrubbed',
        severity: 'fixed',
      })
    }
  }
  const app = docx.part(PART.appProps)
  if (app) {
    let out = app
    for (const tag of ['Company', 'Manager']) out = blankTag(out, tag).xml
    docx.setPart(PART.appProps, out)
  }
}

// Body self-identification patterns. Deliberately conservative — these are
// FLAGGED for the author, never rewritten, so a false positive costs a glance.
const SELF_ID_PATTERNS: { re: RegExp; label: string }[] = [
  { re: /\bour\s+(institution|department|hospital|clinic|centre|center|unit|service|practice)\b/gi, label: 'first-person institution reference' },
  { re: /\bat\s+our\b/gi, label: 'first-person institution reference' },
  { re: /\b(we|authors?)\s+at\s+[A-Z][A-Za-z.'-]+/g, label: 'named affiliation' },
  { re: /\b(University|Hospital|Institute|College|Faculty|School)\s+of\s+[A-Z][A-Za-z.'-]+/g, label: 'named institution' },
]

function detectSelfIdentification(bodyText: string): ReportSuggestion[] {
  const flags: ReportSuggestion[] = []
  const seen = new Set<string>()
  for (const { re, label } of SELF_ID_PATTERNS) {
    for (const m of Array.from(bodyText.matchAll(re))) {
      const at = m.index ?? 0
      const excerpt = bodyText.slice(Math.max(0, at - 30), at + m[0].length + 30).replace(/\s+/g, ' ').trim()
      const key = m[0].toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      flags.push({
        title: `Possible author self-identification (${label})`,
        location: `"…${excerpt}…"`,
        detail:
          'The blinded manuscript may reveal your identity here. Edit this phrasing before submission — the tool does not rewrite your prose.',
        suggestedWording: null,
        severity: 'action-required',
      })
    }
  }
  return flags
}

export function blindManuscript(
  docx: Docx,
  model: ContentModel,
  ctx: FormattingContext,
): BlindingResult {
  const changes: ReportChange[] = []
  let flags: ReportSuggestion[] = []

  if (ctx.rules.blinding.scrub_metadata) scrubCoreProps(docx, changes)
  if (ctx.rules.blinding.scrub_body_identifiers) {
    flags = detectSelfIdentification(model.bodyText)
  }

  return { changes, flags }
}
