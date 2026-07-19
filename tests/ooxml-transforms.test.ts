import { test } from 'node:test'
import assert from 'node:assert'
import { readFileSync } from 'node:fs'
import { buildTitlePage } from '../lib/formatting/ooxml/titlePage'
import { blindManuscript } from '../lib/formatting/ooxml/blinding'
import {
  renumberCitations,
  collapseRanges,
  formatMarkerText,
  parseMarkerNumbers,
} from '../lib/formatting/references/renumber'
import { ingestDocx } from '../lib/formatting/ooxml/ingest'
import { assertBodyImmutable } from '../lib/formatting/pipeline/immutability'
import { Docx, PART, createDocx, paraXml, extractBodyText } from '../lib/formatting/ooxml/docx'
import { parseJournalRules } from '../lib/formatting/index'
import type { ExtractedTitlePageData, FormattingContext } from '../lib/formatting/types'

const loadRules = (slug: string) =>
  parseJournalRules(JSON.parse(readFileSync(`lib/formatting/journals/${slug}.json`, 'utf8')))

const SAMPLE: ExtractedTitlePageData = {
  title: 'Iatrogenic median nerve injury after supracondylar pinning',
  runningTitle: 'Median nerve injury',
  authors: [
    { name: 'Jane A Doe', degrees: 'MD', affiliationRefs: [1], isCorresponding: true, orcid: null },
    { name: 'John B Roe', degrees: 'MD PhD', affiliationRefs: [2], isCorresponding: false, orcid: null },
  ],
  affiliations: ['Department of Orthopaedics, Example Hospital', 'Example University'],
  correspondingAuthor: { name: 'Jane A Doe', email: 'jane@example.com', address: '123 Main St', phone: null },
  keywords: ['median nerve', 'supracondylar fracture', 'pediatric'],
}

test('title page: elements rendered in the journal-specified order', () => {
  const rules = loadRules('oscrsj')
  const ctx: FormattingContext = { rules, articleType: 'case_report' }
  const { order, bytes } = buildTitlePage(SAMPLE, ctx)
  assert.deepEqual(order.slice(0, 5), [
    'article_title',
    'running_title',
    'authors',
    'affiliations',
    'corresponding_author',
  ])
  const re = new Docx(bytes)
  const doc = re.part(PART.document)!
  assert.match(doc, /Iatrogenic median nerve injury/, 'title present')
  assert.match(doc, /Jane A Doe, MD/, 'author + degree present (degrees included)')
  // title appears before authors in document order
  assert.ok(doc.indexOf('Iatrogenic') < doc.indexOf('Jane A Doe'), 'title precedes authors')
})

test('title page: strips degrees when the journal requires it', () => {
  const rules = loadRules('oscrsj')
  const ctx: FormattingContext = {
    rules: { ...rules, title_page: { ...rules.title_page, authors_degrees: 'strip' } },
    articleType: 'case_report',
  }
  const { bytes } = buildTitlePage(SAMPLE, ctx)
  const doc = new Docx(bytes).part(PART.document)!
  assert.ok(!/Jane A Doe, MD/.test(doc), 'degrees stripped')
  assert.match(doc, /Jane A Doe/, 'name kept')
})

test('renumber helpers: range collapse, format, parse', () => {
  assert.equal(collapseRanges([1, 2, 3, 5, 6]), '1-3,5-6')
  assert.equal(collapseRanges([4, 2, 1, 3]), '1-4')
  assert.equal(formatMarkerText([1, 2, 3], 'bracket'), '[1-3]')
  assert.equal(formatMarkerText([1, 2, 3], 'paren'), '(1-3)')
  assert.equal(formatMarkerText([5], 'superscript'), '5')
  assert.deepEqual(parseMarkerNumbers('1-3,5'), [1, 2, 3, 5])
})

test('renumber: bracket markers renumber to a bracket-style journal + report edits', () => {
  const rules = loadRules('jocr') // in_text = bracket
  const docx = createDocx([paraXml('As shown [12] and also [7,8].')])
  const before = extractBodyText(docx.part(PART.document)!)
  const { markerEdits } = renumberCitations(docx, rules, { 12: 1, 7: 2, 8: 3 })
  const doc = docx.part(PART.document)!
  assert.match(doc, /As shown \[1\] and also \[2-3\]\./)
  assert.equal(markerEdits.length, 2)
  // the immutability gate accepts exactly these marker edits
  const after = extractBodyText(doc)
  assert.equal(assertBodyImmutable(before, after, markerEdits).ok, true)
})

test('renumber: restyle bracket → superscript strips the brackets', () => {
  const rules = loadRules('oscrsj') // in_text = superscript
  const docx = createDocx([paraXml('Prior reports [3] agree.')])
  const { markerEdits } = renumberCitations(docx, rules)
  assert.match(docx.part(PART.document)!, /Prior reports 3 agree\./)
  assert.deepEqual(markerEdits, [{ from: '[3]', to: '3' }])
})

test('blinding: scrubs author metadata (AUTO) and flags body self-identification (FLAG)', async () => {
  const rules = loadRules('oscrsj')
  const ctx: FormattingContext = { rules, articleType: 'case_report' }
  const { docx, model } = await ingestDocx(
    readFileSync('public/downloads/oscrsj-example-case-report.docx'),
  )
  // inject a self-identifying phrase into the analysed body text (report-only path)
  const model2 = { ...model, bodyText: model.bodyText + ' This work was performed at our institution.' }
  const { changes, flags } = blindManuscript(docx, model2, ctx)
  assert.ok(changes.some((c) => c.element === 'Document metadata'), 'metadata scrubbed')
  assert.match(docx.part(PART.coreProps)!, /<dc:creator><\/dc:creator>/, 'creator blanked')
  assert.ok(flags.some((f) => /self-identification/i.test(f.title)), 'self-id flagged')
  assert.ok(flags.every((f) => f.suggestedWording === null), 'never proposes a rewrite')
})

/* ---------- Session 97 Part H: title-page placeholders (never invented) ------ */

const EMPTY_EXTRACT: ExtractedTitlePageData = {
  title: null,
  runningTitle: null,
  authors: [],
  affiliations: [],
  correspondingAuthor: null,
  keywords: [],
}

test('title page: unextractable fields become bracketed prompts, not invented values', async () => {
  // A pre-blinded upload extracts nothing. The file is then mostly prompts —
  // acceptable and stated, but it must never contain a fabricated name or email.
  const rules = loadRules('ajsm')
  const ctx: FormattingContext = { rules, articleType: 'case_report' }
  const { bytes, placeholders, order } = buildTitlePage(EMPTY_EXTRACT, ctx)

  assert.ok(placeholders.length > 0, 'everything should be a placeholder')
  assert.equal(
    order.length,
    rules.title_page.elements.length,
    'every element the journal asks for is represented, none silently dropped',
  )

  const doc = new Docx(bytes).part(PART.document)!
  assert.match(doc, /\[Add: /, 'bracketed prompts present')
  // Nothing fabricated.
  assert.doesNotMatch(doc, /@/, 'no invented email address')
  assert.doesNotMatch(doc, /Jane|John|Doe|Roe/, 'no invented author names')
})

test('title page: a populated extract produces no placeholders for the fields it has', async () => {
  const rules = loadRules('ajsm')
  const ctx: FormattingContext = { rules, articleType: 'case_report' }
  const { placeholders } = buildTitlePage(SAMPLE, ctx)

  for (const el of ['article_title', 'running_title', 'authors', 'affiliations'] as const) {
    assert.ok(!placeholders.includes(el), `${el} was extracted, so must not be a placeholder`)
  }
})

test('title page: a missing corresponding-author email is prompted for specifically', async () => {
  const rules = loadRules('ajsm')
  const ctx: FormattingContext = { rules, articleType: 'case_report' }
  const partial: ExtractedTitlePageData = {
    ...SAMPLE,
    correspondingAuthor: { name: 'Jane A Doe', email: null, address: null, phone: null },
  }
  const { bytes, placeholders } = buildTitlePage(partial, ctx)
  const doc = new Docx(bytes).part(PART.document)!

  assert.match(doc, /\[Add: corresponding author email\]/)
  assert.match(doc, /Jane A Doe/, 'the name we DID extract is kept')
  assert.ok(placeholders.includes('corresponding_author'))
})
