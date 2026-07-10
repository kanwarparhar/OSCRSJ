import { test } from 'node:test'
import assert from 'node:assert'
import { readFileSync } from 'node:fs'
import { ingestDocx } from '../lib/formatting/ooxml/ingest'
import { emitDocx } from '../lib/formatting/ooxml/emit'
import { Docx, PART, extractBodyText } from '../lib/formatting/ooxml/docx'

const FIXTURE = 'public/downloads/oscrsj-example-case-report.docx'

test('ingest: detects sections, references, and article type', async () => {
  const { model } = await ingestDocx(readFileSync(FIXTURE))
  const keys = model.detectedSections.map((s) => s.normalized)
  assert.ok(keys.includes('abstract'), 'abstract detected')
  assert.ok(keys.includes('introduction'), 'introduction detected')
  assert.ok(keys.includes('case_presentation'), 'case presentation detected')
  assert.ok(keys.includes('discussion'), 'discussion detected')
  assert.ok(keys.includes('references'), 'references detected')
  assert.equal(model.articleTypeGuess, 'case_report')
  assert.ok(model.rawReferences.length >= 5, `>=5 refs (got ${model.rawReferences.length})`)
  assert.ok(
    model.rawReferences.every((r) => !/^\d+[.):]/.test(r)),
    'leading numbering stripped from raw references',
  )
  assert.equal(model.hazards.filter((h) => h.fatal).length, 0, 'no fatal hazards on a clean fixture')
})

test('round-trip: emit with no edits preserves body text byte-for-byte and reopens', async () => {
  const bytes = readFileSync(FIXTURE)
  const { docx, model } = await ingestDocx(bytes)
  const before = model.bodyText
  assert.ok(before.includes('median nerve'), 'body text captured')

  const out = emitDocx(docx)
  assert.ok(out.length > 2000, 'output is a real zip')

  const reopened = new Docx(out)
  const reDoc = reopened.part(PART.document)
  assert.ok(reDoc, 'reopened document.xml present')
  assert.equal(extractBodyText(reDoc!), before, 'body text identical after round-trip')
})
