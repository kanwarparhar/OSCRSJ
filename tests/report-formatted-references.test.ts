// The journal-styled reference list in the report (Session 97, Part A).
// Run: npx tsx --test tests/report-formatted-references.test.ts
//
// Covers the join between verify.ts (Crossref-enriched records) and render.ts
// (deterministic style renderers) that the pipeline previously never made, plus
// the report sections that surface it.

import { test } from 'node:test'
import assert from 'node:assert'

import { buildFormattedReferences, hasStyleCaveat, isUnparsedReference } from '../lib/formatting/references/formattedList'
import { buildReport, renderReportHtml, renderReportDocx } from '../lib/formatting/report'
import type { CslReference, VerifiedReference } from '../lib/formatting/types'
import type { JournalRules } from '../lib/formatting/rulesSchema'

type RefRules = JournalRules['references']

// Only rules.references is read by the renderer, so tests build that block and
// wrap it in a JournalRules shell (same pattern as references-render.test.ts).
const baseRefRules: RefRules = {
  style: 'vancouver',
  in_text: 'superscript',
  in_text_punctuation: null,
  order: 'cited',
  journal_abbrev: 'nlm',
  include_doi: true,
  et_al_threshold: null,
  max_count: null,
}

function rules(overrides: Partial<RefRules> = {}): JournalRules {
  return { references: { ...baseRefRules, ...overrides } } as unknown as JournalRules
}

// --- Fixtures --------------------------------------------------------------

function ref(overrides: Partial<CslReference> = {}): CslReference {
  return {
    id: '1',
    type: 'article-journal',
    title: 'Outcomes of reverse shoulder arthroplasty',
    authors: [{ family: 'Kim', given: 'David H' }],
    containerTitle: 'Journal of Bone and Joint Surgery',
    volume: '104',
    issue: '3',
    page: '210-218',
    year: '2022',
    doi: '10.2106/JBJS.21.00456',
    pmid: null,
    ...overrides,
  }
}

function verified(overrides: Partial<VerifiedReference> = {}): VerifiedReference {
  return {
    reference: ref(),
    status: 'verified',
    matchConfidence: 0.98,
    source: 'crossref',
    ...overrides,
  }
}

/** The parse.ts `fallbackRef` shape: raw string preserved as title, nothing structured. */
const fallbackShape = ref({
  title: 'Smith J, Jones A. Some citation the parser could not segment. Injury 2019.',
  authors: [],
  containerTitle: null,
  volume: null,
  issue: null,
  page: null,
  // fallbackRef regex-scrapes a year out of the raw text, so this is NOT null —
  // the exact case that makes containerTitle the better unparsed discriminator.
  year: '2019',
  doi: null,
})

// --- buildFormattedReferences ---------------------------------------------

test('renders a verified reference into the journal style, preserving order', () => {
  const out = buildFormattedReferences([verified(), verified()], rules())
  assert.ok(out)
  assert.equal(out!.length, 2)
  assert.deepEqual(
    out!.map((r) => r.index),
    [1, 2],
  )
  assert.equal(out![0].unparsed, false)
  assert.equal(out![0].status, 'verified')
  assert.match(out![0].text, /^Kim DH\. Outcomes of reverse shoulder arthroplasty\./)
  assert.match(out![0].text, /J Bone Joint Surg\./)
  assert.match(out![0].text, /2022;104\(3\):210-218\./)
  assert.match(out![0].text, /doi:10\.2106\/JBJS\.21\.00456/)
})

test('returns null when the manuscript carried no references', () => {
  assert.equal(buildFormattedReferences([], rules()), null)
})

test('carries unverified status through without altering the rendered text', () => {
  const out = buildFormattedReferences(
    [verified({ status: 'unverified', source: 'none', matchConfidence: 0 })],
    rules(),
  )
  assert.equal(out![0].status, 'unverified')
  assert.equal(out![0].unparsed, false)
  assert.match(out![0].text, /^Kim DH\./)
})

test('carries possibly-retracted status through', () => {
  const out = buildFormattedReferences([verified({ status: 'possibly-retracted' })], rules())
  assert.equal(out![0].status, 'possibly-retracted')
})

test('an unparsed fallback reference is passed through verbatim, never rendered', () => {
  const out = buildFormattedReferences(
    [verified({ reference: fallbackShape, status: 'unverified', source: 'none' })],
    rules(),
  )
  assert.equal(out![0].unparsed, true)
  // Verbatim: the author's original string, with no renderer punctuation added.
  assert.equal(out![0].text, fallbackShape.title)
})

test('isUnparsedReference catches the fallback shape even when a year was scraped', () => {
  assert.equal(isUnparsedReference(fallbackShape), true)
  assert.equal(isUnparsedReference(ref()), false)
  // Authors present but no container: structured enough to render.
  assert.equal(isUnparsedReference(ref({ containerTitle: null })), false)
})

// --- et-al threshold (the AJSM case) ---------------------------------------

const sevenAuthors = ref({
  authors: [
    { family: 'Kim', given: 'David H' },
    { family: 'Smith', given: 'John A' },
    { family: 'Patel', given: 'Rina' },
    { family: 'Nguyen', given: 'Tran' },
    { family: 'Garcia', given: 'Maria L' },
    { family: 'Okafor', given: 'Chidi' },
    { family: 'Lee', given: 'Sang Hoon' },
  ],
})

test('a journal requiring every author produces the full list from the enriched record', () => {
  // et_al_threshold === null encodes "list every author" (AJSM, JBJS). This is
  // the exact case the live run flagged as action-required while the pipeline
  // held the full author list in memory.
  const out = buildFormattedReferences(
    [verified({ reference: sevenAuthors })],
    rules({ et_al_threshold: null }),
  )
  assert.doesNotMatch(out![0].text, /et al/)
  for (const family of ['Kim', 'Smith', 'Patel', 'Nguyen', 'Garcia', 'Okafor', 'Lee']) {
    assert.match(out![0].text, new RegExp(family))
  }
})

test('a journal with an et-al threshold truncates at the threshold', () => {
  const out = buildFormattedReferences(
    [verified({ reference: sevenAuthors })],
    rules({ et_al_threshold: 3 }),
  )
  assert.match(out![0].text, /Kim DH, Smith JA, Patel R, et al\./)
  assert.doesNotMatch(out![0].text, /Okafor/)
})

// --- style caveat ----------------------------------------------------------

test('hasStyleCaveat is true only for the custom style', () => {
  assert.equal(hasStyleCaveat(rules({ style: 'custom' })), true)
  assert.equal(hasStyleCaveat(rules({ style: 'vancouver' })), false)
  assert.equal(hasStyleCaveat(rules({ style: 'nlm' })), false)
  assert.equal(hasStyleCaveat(rules({ style: 'ama' })), false)
})

// --- report rendering ------------------------------------------------------

function report(overrides: Parameters<typeof buildReport>[0] extends infer T ? Partial<T> : never = {}) {
  return buildReport({
    journalName: 'American Journal of Sports Medicine',
    verifiedDate: '2026-07-18',
    guidelinesUrl: 'https://example.org/guide',
    rulesVersion: '1.0.0',
    changes: [],
    suggestions: [],
    referenceAudit: [],
    checklist: [],
    ...overrides,
  })
}

test('buildReport defaults the new fields so existing callers keep working', () => {
  const r = report()
  assert.equal(r.formattedReferences, null)
  assert.equal(r.styleCaveat, false)
})

test('HTML report carries the formatted list, its heading, and the flags', () => {
  const r = report({
    formattedReferences: buildFormattedReferences(
      [
        verified(),
        verified({ status: 'possibly-retracted' }),
        verified({ reference: fallbackShape, status: 'unverified', source: 'none' }),
      ],
      rules(),
    ),
    styleCaveat: true,
  })
  const html = renderReportHtml(r)
  assert.match(html, /Your reference list, formatted for American Journal of Sports Medicine/)
  assert.match(html, /Paste this over your bibliography/)
  assert.match(html, /your uploaded reference text is unchanged/)
  assert.match(html, /This journal uses its own citation variant/)
  assert.match(html, /POSSIBLY RETRACTED, verify before citing/)
  assert.match(html, /could not parse/)
  assert.match(html, /✳/)
  assert.match(html, /⚠/)
})

test('HTML report omits the section entirely when there are no references', () => {
  const html = renderReportHtml(report())
  assert.doesNotMatch(html, /Your reference list, formatted for/)
  // and the neighbouring sections still render
  assert.match(html, /Reference audit/)
  assert.match(html, /Submission checklist/)
})

test('HTML report omits the style caveat when the style is standard', () => {
  const r = report({ formattedReferences: buildFormattedReferences([verified()], rules()), styleCaveat: false })
  const html = renderReportHtml(r)
  assert.match(html, /Your reference list, formatted for/)
  assert.doesNotMatch(html, /This journal uses its own citation variant/)
})

test('the formatted list sits between the reference audit and the checklist', () => {
  const r = report({ formattedReferences: buildFormattedReferences([verified()], rules()) })
  const html = renderReportHtml(r)
  const audit = html.indexOf('Reference audit')
  const formatted = html.indexOf('Your reference list, formatted for')
  const checklist = html.indexOf('Submission checklist')
  assert.ok(audit < formatted, 'formatted list should follow the reference audit')
  assert.ok(formatted < checklist, 'formatted list should precede the submission checklist')
})

test('docx report renders without throwing and produces bytes', () => {
  const r = report({
    formattedReferences: buildFormattedReferences(
      [verified(), verified({ reference: fallbackShape, status: 'unverified', source: 'none' })],
      rules(),
    ),
    styleCaveat: true,
  })
  const bytes = renderReportDocx(r)
  assert.ok(bytes.byteLength > 0)
})
