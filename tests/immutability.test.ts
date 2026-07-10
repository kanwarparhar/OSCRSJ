import { test } from 'node:test'
import assert from 'node:assert'
import { readFileSync } from 'node:fs'
import { ingestDocx } from '../lib/formatting/ooxml/ingest'
import { applyLayout } from '../lib/formatting/ooxml/layout'
import { assertBodyImmutable } from '../lib/formatting/pipeline/immutability'
import { PART, extractBodyText } from '../lib/formatting/ooxml/docx'
import { parseJournalRules } from '../lib/formatting/index'

test('immutability: a full layout pass leaves body text immutable', async () => {
  const rules = parseJournalRules(
    JSON.parse(readFileSync('lib/formatting/journals/oscrsj.json', 'utf8')),
  )
  const { docx, model } = await ingestDocx(
    readFileSync('public/downloads/oscrsj-example-case-report.docx'),
  )
  const before = model.bodyText
  applyLayout(docx, model, { rules, articleType: 'case_report' })
  const after = extractBodyText(docx.part(PART.document)!)
  assert.equal(assertBodyImmutable(before, after, []).ok, true)
})

test('immutability: DELIBERATE body mutation is caught (gate fires)', () => {
  const before = 'The 7-year-old boy received 300 mg of the drug.'
  const mutated = 'The 7-year-old boy received 500 mg of the drug.' // dosage tamper
  const r = assertBodyImmutable(before, mutated, [])
  assert.equal(r.ok, false)
  assert.ok(r.diffExcerpt && r.diffExcerpt.includes('300'), 'excerpt names the divergence')
})

test('immutability: sanctioned citation-marker renumber is permitted', () => {
  const before = 'Prior work supports this.12 Others disagree.7'
  const after = 'Prior work supports this.7 Others disagree.3'
  const edits = [
    { from: '.12', to: '.7' },
    { from: '.7', to: '.3' },
  ]
  assert.equal(assertBodyImmutable(before, after, edits).ok, true)
})

test('immutability: a prose change hidden among renumbers still fires', () => {
  const before = 'Prior work supports this.12 The dose was 300 mg.7'
  const after = 'Prior work supports this.7 The dose was 500 mg.3' // dose tamper
  const edits = [
    { from: '.12', to: '.7' },
    { from: '.7', to: '.3' },
  ]
  assert.equal(assertBodyImmutable(before, after, edits).ok, false)
})
