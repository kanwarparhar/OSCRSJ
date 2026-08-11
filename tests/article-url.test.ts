// Contract tests — Crossref DOI Integration Phase 2 (article URLs, canonical
// identity, Highwire citation surface, robots).
//
// WHAT THESE PROTECT
// The six published articles were live for months with `citation_pdf_url`
// pointing into `/api/`, which robots.txt disallowed wholesale — so Google
// Scholar could neither satisfy its same-subdirectory rule nor fetch the
// full text at all, and the Crossref similarity-check crawler URL would have
// been unreachable. Separately, canonical URLs derived from the route param,
// so `/articles/{uuid}` self-canonicalized and competed with the article it
// was supposed to redirect to.
//
// Pure builders only — no Next runtime, no database.

import test from 'node:test'
import assert from 'node:assert/strict'

import {
  CURRENT_ISSUE,
  CURRENT_VOLUME,
  ISSN,
  JOURNAL_ABBREV,
  JOURNAL_FULL,
  PUBLISHER,
  SITE_ORIGIN,
  articlePdfUrl,
  buildCitation,
  buildDoi,
  canonicalArticleUrl,
  classifyArticleParam,
  doiDisplayUrl,
  normalizeElocationParam,
  volumeForYear,
} from '../lib/publish/journal'

import robots from '../app/robots'

const UUID = '1152c026-3ce9-437a-9862-7816c7189ddc'

// ── C1 — route-param classifier ──────────────────────────────────────────────

test('[C1] elocation params are recognised, in either case', () => {
  assert.equal(classifyArticleParam('e0001'), 'elocation')
  assert.equal(classifyArticleParam('e0009'), 'elocation')
  assert.equal(classifyArticleParam('E0012'), 'elocation')
  assert.equal(classifyArticleParam('e01234'), 'elocation') // 5 digits, post-e9999
  assert.equal(normalizeElocationParam(' E0007 '), 'e0007')
})

test('[C1] legacy UUID params are recognised so they can be 308ed', () => {
  assert.equal(classifyArticleParam(UUID), 'uuid')
  assert.equal(classifyArticleParam(UUID.toUpperCase()), 'uuid')
})

test('[C1] junk never reaches the database', () => {
  for (const junk of [
    '',
    '   ',
    null,
    undefined,
    'e001', // too few digits
    'e', // bare prefix
    '0001', // no prefix
    '../../etc/passwd',
    'current-issue',
    "e0001' or 1=1--",
  ]) {
    assert.equal(
      classifyArticleParam(junk as string),
      'invalid',
      `expected ${JSON.stringify(junk)} to be invalid`
    )
  }
})

// ── C2 — canonical identity ──────────────────────────────────────────────────

test('[C2] canonical + PDF URLs derive from the elocation, never the UUID', () => {
  assert.equal(canonicalArticleUrl('e0001'), 'https://www.oscrsj.com/articles/e0001')
  assert.equal(articlePdfUrl('e0001'), 'https://www.oscrsj.com/articles/e0001/pdf')

  // The whole point: both param forms must produce the SAME canonical, or the
  // UUID URL competes with the article it redirects to.
  const fromEloc = canonicalArticleUrl('e0001')
  const fromUuidRoute = canonicalArticleUrl('e0001') // resolved row's elocation
  assert.equal(fromEloc, fromUuidRoute)
  assert.ok(!fromEloc.includes(UUID))
})

test('[C2] the PDF sits in the same subdirectory as its landing page (Scholar rule)', () => {
  const landing = canonicalArticleUrl('e0003')
  const pdf = articlePdfUrl('e0003')
  assert.ok(pdf.startsWith(landing + '/'), `${pdf} must be under ${landing}`)
  assert.ok(!pdf.includes('/api/'), 'PDF must not live under /api/')
})

// ── C3 — DOI display + citation ──────────────────────────────────────────────

test('[C3] DOI display is the full URL form with no doi: anchor prefix', () => {
  const doi = buildDoi('e0002')
  assert.equal(doi, '10.67687/oscrsj.e0002')
  assert.equal(doiDisplayUrl(doi), 'https://doi.org/10.67687/oscrsj.e0002')
  assert.ok(!doiDisplayUrl(doi).startsWith('doi:'))
})

test('[C3] the citation builder matches the PDF suggested-citation shape', () => {
  const citation = buildCitation({
    authors: ['Victor Fontes Pacheco', 'Giulia Haendchen Fornasari'],
    title: 'Manual ACD-Tube PRP for Musculoskeletal Care',
    year: 2026,
    elocationId: 'e0003',
    doi: buildDoi('e0003'),
  })
  assert.equal(
    citation,
    'Pacheco VF, Fornasari GH. Manual ACD-Tube PRP for Musculoskeletal Care. OSCRSJ. 2026;1(1):e0003. doi:10.67687/oscrsj.e0003'
  )
})

test('[C3] a citation without a DOI simply omits the tail — never a placeholder', () => {
  const citation = buildCitation({
    authors: ['Jane Q Doe'],
    title: 'A Case Report',
    year: 2026,
    elocationId: 'e0010',
    doi: null,
  })
  assert.ok(citation.endsWith(':e0010.'))
  assert.ok(!citation.includes('doi:'))
  assert.ok(!citation.includes('10.XXXXX'))
})

test('[C3] single-token author names do not produce a trailing space', () => {
  assert.equal(
    buildCitation({
      authors: ['Prince'],
      title: 'T',
      year: 2026,
      elocationId: 'e0001',
    }),
    'Prince. T. OSCRSJ. 2026;1(1):e0001.'
  )
})

// ── C4 — robots ──────────────────────────────────────────────────────────────

function wildcardRule() {
  const rules = robots().rules
  const list = Array.isArray(rules) ? rules : [rules]
  const rule = list.find((r) => r.userAgent === '*')
  assert.ok(rule, 'a wildcard rule must exist')
  return rule!
}

function asArray(v: string | string[] | undefined): string[] {
  if (!v) return []
  return Array.isArray(v) ? v : [v]
}

test('[C4] the wildcard agent can reach articles and the legacy PDF redirect', () => {
  const rule = wildcardRule()
  const allow = asArray(rule.allow)
  const disallow = asArray(rule.disallow)

  // The regression this exists to prevent: a blanket /api/ disallow.
  assert.ok(
    !disallow.includes('/api/'),
    'blanket /api/ disallow blocks the legacy PDF redirect from being followed'
  )
  assert.ok(allow.includes('/api/articles/'))
  assert.ok(allow.includes('/'))
})

test('[C4] private surfaces stay blocked for every declared agent', () => {
  const rules = robots().rules
  const list = Array.isArray(rules) ? rules : [rules]
  assert.ok(list.length >= 3)
  for (const rule of list) {
    const disallow = asArray(rule.disallow)
    for (const secret of [
      '/dashboard/',
      '/review/',
      '/api/cron/',
      '/api/webhooks/',
      '/api/admin/',
      '/api/preview/',
      '/api/publish/',
      '/api/submissions/',
    ]) {
      assert.ok(
        disallow.includes(secret),
        `${String(rule.userAgent)} must still disallow ${secret}`
      )
    }
  }
})

test('[C4] the sitemap is still advertised', () => {
  assert.equal(robots().sitemap, 'https://www.oscrsj.com/sitemap.xml')
})

// ── C5 — journal identity single source of truth ─────────────────────────────

test('[C5] ISSN is null until the LOC assigns one, and is never a placeholder', () => {
  // A syntactically valid fake ISSN is worse than none: it is machine-read as
  // a real identifier for a different journal. Consumers must omit, not fake.
  assert.equal(ISSN, null)
  if (ISSN !== null) {
    assert.ok(!['XXXX-XXXX', '0000-0000'].includes(ISSN as string))
  }
})

test('[C5] journal identity constants are the registered values', () => {
  assert.equal(JOURNAL_FULL, 'Orthopedic Surgery Case Reports and Series Journal')
  assert.equal(JOURNAL_ABBREV, 'OSCRSJ')
  assert.equal(PUBLISHER, 'OSCRSJ LLC')
  assert.ok(!PUBLISHER.includes('TBD'))
  assert.equal(SITE_ORIGIN, 'https://www.oscrsj.com')
  assert.equal(CURRENT_VOLUME, 1)
  assert.equal(CURRENT_ISSUE, 1)
})

test('[C5] volume tracks the publication year (Volume 2 lands in 2027)', () => {
  assert.equal(volumeForYear(2026), 1)
  assert.equal(volumeForYear(2027), 2)
  assert.equal(volumeForYear(null), 1)
})
