// End-to-end engine composition (no network): ingest → layout → blind →
// renumber → immutability gate → emit → reopen. Proves the OOXML modules
// compose into a Word-openable output whose body prose is provably unchanged.

import { test } from 'node:test'
import assert from 'node:assert'
import { readFileSync } from 'node:fs'
import { ingestDocx } from '../lib/formatting/ooxml/ingest'
import { applyLayout } from '../lib/formatting/ooxml/layout'
import { blindManuscript } from '../lib/formatting/ooxml/blinding'
import { renumberCitations } from '../lib/formatting/references/renumber'
import { emitDocx } from '../lib/formatting/ooxml/emit'
import { assertBodyImmutable } from '../lib/formatting/pipeline/immutability'
import { Docx, PART, extractBodyText } from '../lib/formatting/ooxml/docx'
import { parseJournalRules } from '../lib/formatting/index'
import type { FormattingContext } from '../lib/formatting/types'

test('engine e2e: format an OSCRSJ case report, prove immutability, reopen', async () => {
  const rules = parseJournalRules(
    JSON.parse(readFileSync('lib/formatting/journals/oscrsj.json', 'utf8')),
  )
  const ctx: FormattingContext = { rules, articleType: 'case_report' }

  const { docx, model } = await ingestDocx(
    readFileSync('public/downloads/oscrsj-example-case-report.docx'),
  )
  const before = model.bodyText

  const layout = applyLayout(docx, model, ctx)
  const blinding = blindManuscript(docx, model, ctx)
  const renumber = renumberCitations(docx, rules) // no inline markers in this fixture → no-op

  // Immutability: the only permitted body delta is the (empty) marker edit set.
  const after = extractBodyText(docx.part(PART.document)!)
  const gate = assertBodyImmutable(before, after, renumber.markerEdits)
  assert.equal(gate.ok, true, gate.diffExcerpt ?? 'body must be immutable')

  // The report accumulates real changes.
  assert.ok(layout.changes.length >= 4, 'layout recorded changes')

  // Output reopens as a valid docx with body intact.
  const out = emitDocx(docx)
  const reopened = new Docx(out)
  assert.equal(extractBodyText(reopened.part(PART.document)!), before, 'reopens with body intact')

  // Formatted-to-OSCRSJ assertions survive the round-trip.
  const doc = reopened.part(PART.document)!
  const styles = reopened.part(PART.styles)!
  assert.match(doc, /<w:lnNumType[^>]*w:restart="continuous"/, 'continuous line numbers')
  assert.match(doc, /<w:pgMar[^>]*w:top="1440"/, '1-inch top margin')
  assert.match(doc, /<w:footerReference/, 'page-number footer wired')
  assert.match(styles, /w:ascii="Times New Roman"/, 'body font Times New Roman')
  assert.match(styles, /<w:sz w:val="24"\/>/, '12-pt body size')
  assert.equal(blinding.flags.every((f) => f.suggestedWording === null), true, 'blinding never rewrites prose')
})
