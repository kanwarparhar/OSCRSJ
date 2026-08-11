/**
 * Crossref deposit XML generator — schema 5.5.0.
 *
 * PURE. No database, no env reads, no clock. Everything arrives via the input
 * object so the generator is fully unit-testable offline and so the exact
 * bytes we send can be hashed and stored (`crossref_deposits.deposit_xml_sha256`).
 *
 * THE RULE THAT GOVERNS THIS FILE
 * Crossref deposits are UPSERTS with overwrite semantics: re-depositing a DOI
 * NULLS every field the new record does not supply. There is no patch
 * operation. So every deposit must be a complete record built from the
 * database — never a diff, never "just fix the title". `buildDepositInput`
 * enforces the assembly side; this module refuses to emit a partial record.
 *
 * And the identifier itself is permanent. A wrong DOI cannot be withdrawn,
 * only superseded by a corrected full re-deposit of the same DOI. That is why
 * this module hard-throws rather than degrading gracefully.
 */

import { isValidOscrsjDoi } from '../doi'
import {
  JOURNAL_ABBREV,
  JOURNAL_FULL,
  LICENSE_URL,
  PUBLISHER,
} from '../journal'

export interface DepositAuthor {
  givenName: string | null
  surname: string
  /** Bare ORCID (0000-0002-1825-0097) or full URL; normalised on emit. */
  orcid?: string | null
  affiliation?: string | null
  /** Research Organization Registry id, when we have one. */
  rorId?: string | null
}

export interface DepositReference {
  /** Stable key within the article, e.g. 'ref1'. */
  key: string
  /** Full citation text, used when no DOI is known. */
  unstructured?: string | null
  /** Reference DOI, when the author actually supplied one. */
  doi?: string | null
}

export interface DepositInput {
  doi: string
  elocationId: string
  title: string
  abstract?: string | null
  authors: DepositAuthor[]
  /** The ORIGINAL publication date. Never "today" — see G1. */
  publishedDate: { year: number; month: number; day: number }
  volume: number
  issue: number
  /** Omitted from the XML entirely when null (no placeholder ISSN, ever). */
  issn?: string | null
  canonicalUrl: string
  pdfUrl: string
  references?: DepositReference[]
  depositorEmail: string
  /** Deterministic, caller-supplied: `oscrsj-{eloc}-{unixSeconds}`. */
  batchId: string
  /** YYYYMMDDHHMMSS. Crossref treats a HIGHER timestamp as more recent and
   *  will not apply an older one over a newer one. */
  timestamp: string
}

const NS = 'http://www.crossref.org/schema/5.5.0'
const NS_XSI = 'http://www.w3.org/2001/XMLSchema-instance'
const NS_JATS = 'http://www.ncbi.nlm.nih.gov/JATS1'
const NS_AI = 'http://www.crossref.org/AccessIndicators.xsd'
const SCHEMA_LOCATION =
  'http://www.crossref.org/schema/5.5.0 https://www.crossref.org/schemas/crossref5.5.0.xsd'

/** XML text-node escaping. Attribute values additionally escape quotes. */
export function xmlEscape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function xmlAttr(value: string): string {
  return xmlEscape(value).replace(/"/g, '&quot;').replace(/'/g, '&apos;')
}

// Inline face markup our editor produces. ONLY these are stripped.
const INLINE_TAGS =
  'em|i|b|strong|sub|sup|span|u|small|mark|abbr|cite|var|br|p|div'
const INLINE_TAG_RE = new RegExp(`</?(?:${INLINE_TAGS})(?:\\s[^>]*)?/?>`, 'gi')

/**
 * Flattens markup to plain text for Crossref.
 *
 * DELIBERATELY NOT `/<[^>]+>/g`. That naive strip silently deletes anything
 * angle-bracketed, and clinical prose is full of things that merely LOOK like
 * tags: "CRP <5 mg/L", "flexion <30 degrees", "<2 mm displacement". A title or
 * abstract deposited with "CRP 40" where the author wrote "CRP <5 mg/L & ESR
 * >40" is a permanent, publicly-visible corruption of the record.
 *
 * So: strip the inline face markup we actually emit, and treat every other
 * angle bracket as literal text (xmlEscape then makes it safe). The known cost
 * is losing italics on species names — acceptable; corrupting numbers is not.
 */
function toPlainText(html: string): string {
  return html
    .replace(INLINE_TAG_RE, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeOrcid(raw: string): string | null {
  const m = raw.trim().match(/(\d{4}-\d{4}-\d{4}-\d{3}[\dXx])$/)
  if (!m) return null
  return `https://orcid.org/${m[1].toUpperCase()}`
}

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

function publicationDate(
  d: DepositInput['publishedDate'],
  indent: string
): string {
  return [
    `${indent}<publication_date media_type="online">`,
    `${indent}  <month>${pad2(d.month)}</month>`,
    `${indent}  <day>${pad2(d.day)}</day>`,
    `${indent}  <year>${d.year}</year>`,
    `${indent}</publication_date>`,
  ].join('\n')
}

function contributorsBlock(authors: DepositAuthor[], indent: string): string {
  if (authors.length === 0) return ''
  const people = authors.map((a, i) => {
    const seq = i === 0 ? 'first' : 'additional'
    const lines = [
      `${indent}  <person_name sequence="${seq}" contributor_role="author">`,
    ]
    if (a.givenName && a.givenName.trim()) {
      lines.push(`${indent}    <given_name>${xmlEscape(a.givenName.trim())}</given_name>`)
    }
    lines.push(`${indent}    <surname>${xmlEscape(a.surname.trim())}</surname>`)
    if (a.affiliation && a.affiliation.trim()) {
      lines.push(`${indent}    <affiliations>`)
      lines.push(`${indent}      <institution>`)
      lines.push(
        `${indent}        <institution_name>${xmlEscape(a.affiliation.trim())}</institution_name>`
      )
      if (a.rorId && a.rorId.trim()) {
        lines.push(
          `${indent}        <institution_id type="ror">${xmlEscape(a.rorId.trim())}</institution_id>`
        )
      }
      lines.push(`${indent}      </institution>`)
      lines.push(`${indent}    </affiliations>`)
    }
    // ORCID is emitted only when it parses to the canonical 16-digit form. A
    // malformed ORCID fails the batch; a missing one costs nothing.
    if (a.orcid) {
      const orcid = normalizeOrcid(a.orcid)
      if (orcid) lines.push(`${indent}    <ORCID>${orcid}</ORCID>`)
    }
    lines.push(`${indent}  </person_name>`)
    return lines.join('\n')
  })
  return [`${indent}<contributors>`, ...people, `${indent}</contributors>`].join('\n')
}

function citationList(refs: DepositReference[], indent: string): string {
  const usable = refs.filter((r) => (r.doi && r.doi.trim()) || (r.unstructured && r.unstructured.trim()))
  if (usable.length === 0) return ''
  const items = usable.map((r) => {
    const lines = [`${indent}  <citation key="${xmlAttr(r.key)}">`]
    // A reference DOI is only supplied when the author literally typed a
    // doi.org URL. Everything else goes as unstructured text, which Crossref
    // matches server-side — that is a supported path, not a degradation.
    if (r.doi && r.doi.trim()) {
      lines.push(`${indent}    <doi>${xmlEscape(r.doi.trim())}</doi>`)
    } else {
      lines.push(
        `${indent}    <unstructured_citation>${xmlEscape(
          toPlainText(r.unstructured || '')
        )}</unstructured_citation>`
      )
    }
    lines.push(`${indent}  </citation>`)
    return lines.join('\n')
  })
  return [`${indent}<citation_list>`, ...items, `${indent}</citation_list>`].join('\n')
}

export function buildDepositXml(input: DepositInput): string {
  // ---- Refuse to build anything we would regret registering ----
  if (!isValidOscrsjDoi(input.doi)) {
    throw new Error(
      `Refusing to build a deposit for invalid DOI "${input.doi}". DOIs are permanent once registered.`
    )
  }
  if (!input.title || !toPlainText(input.title)) {
    throw new Error('Refusing to build a deposit with an empty title.')
  }
  if (input.authors.length === 0) {
    throw new Error('Refusing to build a deposit with no contributors.')
  }
  const d = input.publishedDate
  if (!d || !d.year || !d.month || !d.day) {
    throw new Error(
      'Refusing to build a deposit without a complete publication date — the deposit asserts it as public record.'
    )
  }
  if (!/^\d{14}$/.test(input.timestamp)) {
    throw new Error(`Deposit timestamp must be YYYYMMDDHHMMSS, got "${input.timestamp}".`)
  }
  if (!input.canonicalUrl.startsWith('https://')) {
    throw new Error('Deposit resource URL must be absolute https.')
  }

  const parts: string[] = []
  parts.push('<?xml version="1.0" encoding="UTF-8"?>')
  parts.push(
    `<doi_batch xmlns="${NS}" xmlns:xsi="${NS_XSI}" xmlns:jats="${NS_JATS}" xmlns:ai="${NS_AI}" version="5.5.0" xsi:schemaLocation="${SCHEMA_LOCATION}">`
  )

  // ---- head ----
  parts.push('  <head>')
  parts.push(`    <doi_batch_id>${xmlEscape(input.batchId)}</doi_batch_id>`)
  parts.push(`    <timestamp>${input.timestamp}</timestamp>`)
  parts.push('    <depositor>')
  parts.push(`      <depositor_name>${xmlEscape(PUBLISHER)}</depositor_name>`)
  parts.push(`      <email_address>${xmlEscape(input.depositorEmail)}</email_address>`)
  parts.push('    </depositor>')
  parts.push(`    <registrant>${xmlEscape(PUBLISHER)}</registrant>`)
  parts.push('  </head>')

  // ---- body ----
  parts.push('  <body>')
  parts.push('    <journal>')
  parts.push('      <journal_metadata language="en">')
  parts.push(`        <full_title>${xmlEscape(JOURNAL_FULL)}</full_title>`)
  parts.push(`        <abbrev_title>${xmlEscape(JOURNAL_ABBREV)}</abbrev_title>`)
  // ISSN is emitted ONLY when we actually have one. Crossref accepts a
  // journal record without an ISSN; it does not forgive a wrong one.
  if (input.issn && input.issn.trim()) {
    parts.push(
      `        <issn media_type="electronic">${xmlEscape(input.issn.trim())}</issn>`
    )
  }
  parts.push('      </journal_metadata>')

  parts.push('      <journal_issue>')
  parts.push(publicationDate(d, '        '))
  parts.push('        <journal_volume>')
  parts.push(`          <volume>${input.volume}</volume>`)
  parts.push('        </journal_volume>')
  parts.push(`        <issue>${input.issue}</issue>`)
  parts.push('      </journal_issue>')

  parts.push('      <journal_article publication_type="full_text">')
  parts.push('        <titles>')
  parts.push(`          <title>${xmlEscape(toPlainText(input.title))}</title>`)
  parts.push('        </titles>')

  const contribs = contributorsBlock(input.authors, '        ')
  if (contribs) parts.push(contribs)

  if (input.abstract && toPlainText(input.abstract)) {
    parts.push('        <jats:abstract>')
    parts.push(
      `          <jats:p>${xmlEscape(toPlainText(input.abstract))}</jats:p>`
    )
    parts.push('        </jats:abstract>')
  }

  parts.push(publicationDate(d, '        '))

  // eLocator, NOT first_page. OSCRSJ publishes continuously with no page
  // numbers; declaring the eLocator as a page would make every citation to us
  // structurally wrong in every downstream index.
  parts.push('        <publisher_item>')
  parts.push(
    `          <item_number item_number_type="article_number">${xmlEscape(input.elocationId)}</item_number>`
  )
  parts.push('        </publisher_item>')

  parts.push('        <ai:program name="AccessIndicators">')
  parts.push('          <ai:free_to_read/>')
  for (const appliesTo of ['vor', 'am', 'tdm']) {
    parts.push(
      `          <ai:license_ref applies_to="${appliesTo}">${xmlEscape(LICENSE_URL)}</ai:license_ref>`
    )
  }
  parts.push('        </ai:program>')

  parts.push('        <doi_data>')
  parts.push(`          <doi>${xmlEscape(input.doi)}</doi>`)
  parts.push(`          <resource>${xmlEscape(input.canonicalUrl)}</resource>`)
  // Similarity Check crawler URL. Crossref's `crawler` attribute is a fixed
  // vocabulary — the Similarity Check value is "iParadigms" (Turnitin's
  // corporate name), NOT "similarity-check". Getting this wrong fails the
  // batch schema validation.
  parts.push('          <collection property="crawler-based">')
  parts.push('            <item crawler="iParadigms">')
  parts.push(`              <resource>${xmlEscape(input.pdfUrl)}</resource>`)
  parts.push('            </item>')
  parts.push('          </collection>')
  // text-mining lets TDM consumers fetch the full text directly.
  parts.push('          <collection property="text-mining">')
  parts.push('            <item>')
  parts.push(
    `              <resource mime_type="application/pdf">${xmlEscape(input.pdfUrl)}</resource>`
  )
  parts.push('            </item>')
  parts.push('          </collection>')
  parts.push('        </doi_data>')

  const cites = citationList(input.references || [], '        ')
  if (cites) parts.push(cites)

  parts.push('      </journal_article>')
  parts.push('    </journal>')
  parts.push('  </body>')
  parts.push('</doi_batch>')

  return parts.join('\n') + '\n'
}

/** Deterministic batch id. Crossref requires uniqueness per submission. */
export function buildBatchId(elocationId: string, unixSeconds: number): string {
  return `oscrsj-${elocationId}-${unixSeconds}`
}

/** YYYYMMDDHHMMSS in UTC, from an explicit Date (never an implicit clock). */
export function buildTimestamp(now: Date): string {
  return (
    String(now.getUTCFullYear()) +
    pad2(now.getUTCMonth() + 1) +
    pad2(now.getUTCDate()) +
    pad2(now.getUTCHours()) +
    pad2(now.getUTCMinutes()) +
    pad2(now.getUTCSeconds())
  )
}
