// Part G (2026-07-22): running head actually written + inflation-cap plumbing.
// applyRunningHead previously accepted runningTitle and never used it — a
// document with no header part got nothing and nothing was flagged.

import { test } from 'node:test'
import assert from 'node:assert'
import { readFileSync } from 'node:fs'
import { applyLayout } from '../lib/formatting/ooxml/layout'
import { ingestDocx, MAX_DOCUMENT_XML_BYTES } from '../lib/formatting/ooxml/ingest'
import {
  Docx,
  PART,
  createDocx,
  paraXml,
  extractBodyText,
} from '../lib/formatting/ooxml/docx'
import { assertBodyImmutable } from '../lib/formatting/pipeline/immutability'
import { parseJournalRules } from '../lib/formatting/index'
import type { FormattingContext } from '../lib/formatting/types'

const loadRules = (slug: string) =>
  parseJournalRules(JSON.parse(readFileSync(`lib/formatting/journals/${slug}.json`, 'utf8')))

const fixture = () =>
  createDocx([
    paraXml('Introduction', { bold: true }),
    paraXml('Body paragraph one.'),
    paraXml('Discussion', { bold: true }),
    paraXml('Body paragraph two.'),
  ])

test('running head: created as a real header part when the document has none', async () => {
  const rules = loadRules('oscrsj') // running_head.show = true, top-right
  const ctx: FormattingContext = { rules, articleType: 'case_report' }
  const docx = fixture()
  const before = extractBodyText(docx.part(PART.document)!)

  const { model } = await ingestDocx(docx.toUint8Array())
  const { changes } = applyLayout(docx, model, ctx, { runningTitle: 'Median nerve injury' })

  // Header part exists and carries the uppercased title.
  const headerPart = docx.listParts().find((p) => /^word\/header\d+\.xml$/.test(p))
  assert.ok(headerPart, 'header part created')
  assert.match(docx.part(headerPart!)!, /MEDIAN NERVE INJURY/)
  assert.match(docx.part(headerPart!)!, /<w:jc w:val="right"\/>/, 'aligned per rules position')
  // Wired: relationship + content type + sectPr reference.
  assert.match(docx.part(PART.documentRels)!, /header\d+\.xml/)
  assert.match(docx.part(PART.contentTypes)!, /header\+xml/)
  assert.match(docx.part(PART.document)!, /<w:headerReference w:type="default"/)
  // Reported.
  assert.ok(changes.some((c) => c.element === 'Running head' && /added/.test(c.after)))
  // Body prose untouched (headers are separate parts).
  const after = extractBodyText(docx.part(PART.document)!)
  assert.equal(assertBodyImmutable(before, after).ok, true)
})

test('running head: truncated to the journal character cap', async () => {
  const base = loadRules('oscrsj')
  const rules = {
    ...base,
    title_page: { ...base.title_page, running_title_max_chars: 10 },
  }
  const ctx: FormattingContext = { rules, articleType: 'case_report' }
  const docx = fixture()
  const { model } = await ingestDocx(docx.toUint8Array())
  applyLayout(docx, model, ctx, { runningTitle: 'Median nerve injury' })
  const headerPart = docx.listParts().find((p) => /^word\/header\d+\.xml$/.test(p))!
  assert.match(docx.part(headerPart)!, /MEDIAN NER</, 'cut at 10 chars (trailing space trimmed)')
  assert.doesNotMatch(docx.part(headerPart)!, /MEDIAN NERVE/)
})

test('running head: no extracted title → nothing invented, nothing created', async () => {
  const rules = loadRules('oscrsj')
  const ctx: FormattingContext = { rules, articleType: 'case_report' }
  const docx = fixture()
  const { model } = await ingestDocx(docx.toUint8Array())
  applyLayout(docx, model, ctx) // no runningTitle
  assert.equal(
    docx.listParts().some((p) => /^word\/header\d+\.xml$/.test(p)),
    false,
  )
})

test('running head: existing header keeps its text, only alignment set', async () => {
  const rules = loadRules('oscrsj')
  const ctx: FormattingContext = { rules, articleType: 'case_report' }
  const docx = fixture()
  // simulate an author-provided header part
  docx.addPart(
    'word/header1.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:p><w:r><w:t>Author's own head</w:t></w:r></w:p></w:hdr>`,
  )
  const { model } = await ingestDocx(docx.toUint8Array())
  const { changes } = applyLayout(docx, model, ctx, { runningTitle: 'Should not overwrite' })
  const h = docx.part('word/header1.xml')!
  assert.match(h, /Author's own head/, "author's text untouched")
  assert.doesNotMatch(h, /SHOULD NOT OVERWRITE/)
  assert.ok(changes.some((c) => c.element === 'Running head' && /aligned right/.test(c.after)))
})

/* ------------------------- inflation cap plumbing ------------------------- */

test('declaredPartSize: reads the zip header size before inflation', () => {
  const built = fixture()
  const expected = built.part(PART.document)!.length
  const reopened = new Docx(built.toBuffer())
  const declared = reopened.declaredPartSize(PART.document)
  assert.equal(declared, expected, 'declared size matches the real part size')
  assert.ok(MAX_DOCUMENT_XML_BYTES > expected, 'sanity: real fixtures are far under the cap')
})

test('declaredPartSize: null for string-backed parts (fallback path exists)', () => {
  const built = fixture() // parts set as strings, never deflated
  assert.equal(built.declaredPartSize(PART.document), null)
})
