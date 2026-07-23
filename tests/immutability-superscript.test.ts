// Regression tests for the 2026-07-22 integrity fix (Part A):
//  - the immutability gate's bare-digit collision (a superscript `to` marker
//    matching an earlier prose digit mis-segmented the after-text and failed
//    perfectly formatted manuscripts), and
//  - superscript restyle as a real run split carrying w:vertAlign, instead of
//    stripping brackets to a bare prose digit.

import { test } from 'node:test'
import assert from 'node:assert'
import { readFileSync } from 'node:fs'
import { assertBodyImmutable } from '../lib/formatting/pipeline/immutability'
import { renumberCitations } from '../lib/formatting/references/renumber'
import { ingestDocx } from '../lib/formatting/ooxml/ingest'
import { applyLayout } from '../lib/formatting/ooxml/layout'
import { blindManuscript } from '../lib/formatting/ooxml/blinding'
import { emitDocx } from '../lib/formatting/ooxml/emit'
import { Docx, PART, createDocx, paraXml, extractBodyText } from '../lib/formatting/ooxml/docx'
import { parseJournalRules } from '../lib/formatting/index'
import type { FormattingContext } from '../lib/formatting/types'

const loadRules = (slug: string) =>
  parseJournalRules(JSON.parse(readFileSync(`lib/formatting/journals/${slug}.json`, 'utf8')))

/* ------------------------------ the gate ------------------------------ */

test('gate: digit-heavy prose with superscript edits passes (the exact shipped failure)', () => {
  // Verified failure case from the 2026-07-22 audit: the `to` marker "3"
  // matched "cohort of 3 patients" before the real marker site.
  const before = 'A cohort of 3 patients improved. Prior reports [3] agree.'
  const after = 'A cohort of 3 patients improved. Prior reports 3 agree.'
  const result = assertBodyImmutable(before, after, [{ from: '[3]', to: '3' }])
  assert.equal(result.ok, true, result.diffExcerpt)
})

test('gate: a genuinely altered word between markers still fails', () => {
  const before = 'Outcomes were good [1]. Recovery was complete [2].'
  const after = 'Outcomes were excellent 1. Recovery was complete 2.'
  const result = assertBodyImmutable(before, after, [
    { from: '[1]', to: '1' },
    { from: '[2]', to: '2' },
  ])
  assert.equal(result.ok, false)
  assert.ok(result.diffExcerpt, 'diff excerpt present')
})

test('gate: an altered digit elsewhere in prose fails even under superscript edits', () => {
  const before = 'A cohort of 3 patients improved [3].'
  const after = 'A cohort of 4 patients improved 3.'
  const result = assertBodyImmutable(before, after, [{ from: '[3]', to: '3' }])
  assert.equal(result.ok, false)
})

test('gate: repeated markers match in document order', () => {
  const before = 'First noted [3]. Later confirmed [3] again.'
  const after = 'First noted 3. Later confirmed 3 again.'
  const result = assertBodyImmutable(before, after, [
    { from: '[3]', to: '3' },
    { from: '[3]', to: '3' },
  ])
  assert.equal(result.ok, true, result.diffExcerpt)
})

test('gate: overlapping-prefix markers ([1] vs [1,2]) segment consistently', () => {
  const before = 'Shown in [1] and reviewed in [1,2].'
  const after = 'Shown in 1 and reviewed in 1,2.'
  const result = assertBodyImmutable(before, after, [
    { from: '[1]', to: '1' },
    { from: '[1,2]', to: '1,2' },
  ])
  assert.equal(result.ok, true, result.diffExcerpt)
})

test('gate: missing marker in the before-text fails', () => {
  const result = assertBodyImmutable('No markers here.', 'No markers here.', [
    { from: '[9]', to: '9' },
  ])
  assert.equal(result.ok, false)
})

/* --------------------------- superscript renumber --------------------------- */

test('renumber superscript: multiple markers in one run split into prose + vertAlign runs', () => {
  const rules = loadRules('oscrsj') // in_text = superscript
  const docx = createDocx([paraXml('As shown [12] and also [7,8] previously.')])
  const before = extractBodyText(docx.part(PART.document)!)
  const { markerEdits } = renumberCitations(docx, rules, { 12: 1, 7: 2, 8: 3 })
  const doc = docx.part(PART.document)!

  // Two marker runs, each with vertAlign
  const markerRuns = doc.match(/<w:vertAlign w:val="superscript"\/>/g) ?? []
  assert.equal(markerRuns.length, 2, 'both markers superscripted')
  // Body text: markers renumbered, brackets gone, prose intact (incl. spacing)
  const after = extractBodyText(doc)
  assert.equal(after, 'As shown 1 and also 2-3 previously.')
  assert.deepEqual(markerEdits, [
    { from: '[12]', to: '1' },
    { from: '[7,8]', to: '2-3' },
  ])
  // Gate accepts exactly these edits
  assert.equal(assertBodyImmutable(before, after, markerEdits).ok, true)
  // Round-trips through the zip layer as a valid document
  const reopened = new Docx(docx.toBuffer())
  assert.equal(extractBodyText(reopened.part(PART.document)!), after)
})

test('renumber superscript: marker run inherits the original run properties', () => {
  const rules = loadRules('oscrsj')
  // A bold run: the split prose runs must keep <w:b/>, the marker run must
  // keep <w:b/> AND gain vertAlign.
  const docx = createDocx([paraXml('Bold claim [4] here.', { bold: true })])
  renumberCitations(docx, rules)
  const doc = docx.part(PART.document)!
  assert.match(
    doc,
    /<w:rPr><w:b\/><w:vertAlign w:val="superscript"\/><\/w:rPr><w:t xml:space="preserve">4<\/w:t>/,
    'marker run keeps bold and gains vertAlign',
  )
  assert.match(
    doc,
    /<w:rPr><w:b\/><\/w:rPr><w:t xml:space="preserve">Bold claim <\/w:t>/,
    'prose run keeps original rPr without vertAlign',
  )
})

test('renumber superscript: digit-heavy prose is untouched outside markers', () => {
  const rules = loadRules('oscrsj')
  const docx = createDocx([
    paraXml('A cohort of 3 patients aged 3 to 13 improved over 3 months [3].'),
  ])
  const before = extractBodyText(docx.part(PART.document)!)
  const { markerEdits } = renumberCitations(docx, rules)
  const after = extractBodyText(docx.part(PART.document)!)
  assert.equal(after, 'A cohort of 3 patients aged 3 to 13 improved over 3 months 3.')
  assert.deepEqual(markerEdits, [{ from: '[3]', to: '3' }])
  assert.equal(assertBodyImmutable(before, after, markerEdits).ok, true, 'gate passes')
})

/* ------------------------- e2e with inline markers ------------------------- */

test('e2e: digit-heavy manuscript with bracketed markers formats against oscrsj (superscript)', async () => {
  // The shipped e2e fixture has no inline markers — the exact blind spot that
  // let the gate false-positive reach production. This fixture has both
  // markers and colliding prose digits.
  const rules = loadRules('oscrsj')
  const ctx: FormattingContext = { rules, articleType: 'case_report' }

  const fixture = createDocx([
    paraXml('Introduction', { bold: true }),
    paraXml('A cohort of 3 patients improved [1]. Prior reports [2,3] agree.'),
    paraXml('Discussion', { bold: true }),
    paraXml('Follow-up at 3 months confirmed the outcome [3].'),
    paraXml('References', { bold: true }),
    paraXml('1. Doe J. First report. J Example. 2020;1:1-5.'),
    paraXml('2. Roe R. Second report. J Example. 2021;2:6-10.'),
    paraXml('3. Poe P. Third report. J Example. 2022;3:11-15.'),
  ])

  const { docx, model } = await ingestDocx(fixture.toUint8Array())
  const before = model.bodyText

  applyLayout(docx, model, ctx)
  blindManuscript(docx, model, ctx)
  const renumber = renumberCitations(docx, rules)

  const after = extractBodyText(docx.part(PART.document)!)
  const gate = assertBodyImmutable(before, after, renumber.markerEdits)
  assert.equal(gate.ok, true, gate.diffExcerpt ?? 'gate must pass with superscript markers')
  assert.ok(renumber.markerEdits.length >= 3, 'markers were actually restyled')

  // Output reopens with vertAlign marker runs intact
  const reopened = new Docx(emitDocx(docx))
  const doc = reopened.part(PART.document)!
  assert.match(doc, /<w:vertAlign w:val="superscript"\/>/)
  assert.equal(extractBodyText(doc), after, 'reopens with body intact')
})
