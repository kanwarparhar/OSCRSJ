import { test } from 'node:test'
import assert from 'node:assert'
import { readFileSync } from 'node:fs'
import { ingestDocx } from '../lib/formatting/ooxml/ingest'
import { applyLayout } from '../lib/formatting/ooxml/layout'
import { emitDocx } from '../lib/formatting/ooxml/emit'
import { Docx, PART, extractBodyText, mmToTwips } from '../lib/formatting/ooxml/docx'
import { parseJournalRules } from '../lib/formatting/index'
import type { FormattingContext } from '../lib/formatting/types'

const FIXTURE = 'public/downloads/oscrsj-example-case-report.docx'

function loadRules(slug: string) {
  return parseJournalRules(JSON.parse(readFileSync(`lib/formatting/journals/${slug}.json`, 'utf8')))
}

// Golden layout assertions across the 3 pilot journals (brief task 6).
for (const slug of ['oscrsj', 'jbjs', 'ajsm']) {
  test(`layout → ${slug}: rule-driven, body-text immutable, reopens`, async () => {
    const rules = loadRules(slug)
    const ctx: FormattingContext = { rules, articleType: 'case_report' }
    const { docx, model } = await ingestDocx(readFileSync(FIXTURE))
    const before = model.bodyText

    applyLayout(docx, model, ctx)
    const doc = docx.part(PART.document)!

    // line numbering matches the rule
    if (rules.layout.line_numbers === 'continuous') {
      assert.match(doc, /<w:lnNumType[^>]*w:restart="continuous"/, `${slug}: continuous line numbers`)
    } else if (rules.layout.line_numbers === 'none') {
      assert.ok(!/<w:lnNumType/.test(doc), `${slug}: no line numbers`)
    }

    // margins match the rule when specified
    if (rules.layout.margins_mm) {
      const t = mmToTwips(rules.layout.margins_mm.top_mm)
      assert.match(doc, new RegExp(`<w:pgMar[^>]*w:top="${t}"`), `${slug}: top margin`)
    }

    // immutability: body text unchanged by a layout pass
    assert.equal(extractBodyText(doc), before, `${slug}: layout must not change body text`)

    // reopens with body intact
    const re = new Docx(emitDocx(docx))
    assert.equal(extractBodyText(re.part(PART.document)!), before, `${slug}: reopens intact`)
  })
}

test('layout → OSCRSJ applies font/size/spacing/page-numbers/running-head', async () => {
  const rules = loadRules('oscrsj')
  const ctx: FormattingContext = { rules, articleType: 'case_report' }
  const { docx, model } = await ingestDocx(readFileSync(FIXTURE))
  const { changes } = applyLayout(docx, model, ctx)

  const doc = docx.part(PART.document)!
  const styles = docx.part(PART.styles)!

  assert.match(styles, /<w:rFonts[^>]*w:ascii="Times New Roman"/, 'font → Times New Roman')
  assert.match(styles, /<w:sz w:val="24"\/>/, 'size → 12pt (24 half-pt)')
  assert.match(styles, /<w:spacing[^>]*w:line="480"/, 'double spacing')
  assert.match(doc, /<w:footerReference/, 'page-number footer wired into sectPr')
  assert.ok(
    docx.listParts().some((p) => /word\/footer\d+\.xml/.test(p)),
    'footer part created',
  )
  const footerPart = docx.listParts().find((p) => /word\/footer\d+\.xml/.test(p))!
  assert.match(docx.part(footerPart)!, /w:instr=" PAGE "/, 'PAGE field in footer')
  // running head still present (header part carries the running title)
  const headerPart = docx.listParts().find((p) => /word\/header\d+\.xml/.test(p))!
  assert.match(docx.part(headerPart)!, /Iatrogenic median nerve/, 'running head text present')

  assert.ok(changes.length >= 4, `report changes recorded (${changes.length})`)
})
