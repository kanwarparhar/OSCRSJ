import { test } from 'node:test'
import assert from 'node:assert'
import { JOURNALS, getJournal, JOURNAL_SUMMARIES } from '../lib/formatting/journalList'
import { analyze, manuscriptWordCount } from '../lib/formatting/pipeline/analyze'
import { buildReport, renderReportHtml, renderReportDocx } from '../lib/formatting/report'
import { Docx, PART, extractBodyText } from '../lib/formatting/ooxml/docx'
import { progressFor } from '../lib/formatting/pipeline/api'
import type { ContentModel } from '../lib/formatting/types'

test('journal registry: all validated + OSCRSJ present, summaries in sync', () => {
  // The registry grows with the top-100 expansion; assert structural invariants
  // rather than a fixed count so the test survives every wave.
  assert.ok(JOURNALS.length >= 14, 'registry should not shrink below the original 14')
  assert.ok(getJournal('oscrsj'))
  assert.equal(JOURNAL_SUMMARIES.length, JOURNALS.length)
  assert.ok(JOURNAL_SUMMARIES.every((j) => j.slug && j.name && j.abbrev && j.guidelinesUrl))
  // slugs are unique across the registry
  assert.equal(new Set(JOURNALS.map((j) => j.identity.slug)).size, JOURNALS.length)
})

function fakeModel(): ContentModel {
  return {
    documentXml: '',
    stylesXml: null,
    bodyText: 'body',
    detectedSections: [
      { heading: 'Introduction', normalized: 'introduction', range: [0, 2], wordCount: 1600 },
      { heading: 'Case Presentation', normalized: 'case_presentation', range: [2, 4], wordCount: 1600 },
      { heading: 'References', normalized: 'references', range: [4, 6], wordCount: 200 },
    ],
    rawReferences: Array.from({ length: 30 }, (_, i) => `Ref ${i + 1}`),
    hazards: [],
    articleTypeGuess: 'case_report',
  }
}

test('analyze: flags over-word-limit, over-reference-count, and missing sections', () => {
  const rules = getJournal('oscrsj')!
  const { suggestions, checklist } = analyze({
    model: fakeModel(),
    rules,
    articleType: 'case_report',
    keywordCount: 4,
  })
  assert.equal(manuscriptWordCount(fakeModel()), 3200) // excludes references section
  assert.ok(suggestions.some((s) => /word limit/i.test(s.title)), 'over-limit flagged')
  assert.ok(suggestions.some((s) => /Too many references/i.test(s.title)), 'ref count flagged (30 > 25)')
  assert.ok(suggestions.some((s) => /Missing required section/i.test(s.title)), 'missing sections flagged')
  assert.ok(checklist.some((c) => c.status === 'action-needed'), 'checklist reflects issues')
})

test('report: builds a model and renders HTML + a valid .docx', () => {
  const report = buildReport({
    journalName: 'OSCRSJ',
    verifiedDate: '2026-07-09',
    guidelinesUrl: 'https://www.oscrsj.com/guide-for-authors',
    rulesVersion: '1.0.0',
    changes: [{ element: 'Line numbering', before: 'none', after: 'continuous', severity: 'fixed' }],
    suggestions: [
      { title: 'Over the 2000-word limit', location: '2400 words', detail: 'Trim 400 words.', suggestedWording: null, severity: 'action-required' },
    ],
    referenceAudit: [
      { index: 1, status: 'corrected', changed: 'DOI added', doi: '10.2106/JBJS.19.00123', pmid: null },
      { index: 2, status: 'unverified', changed: 'check manually', doi: null, pmid: null },
    ],
    checklist: [{ requirement: 'Within 2000-word limit', status: 'action-needed' }],
  })
  assert.equal(report.summaryVerdict.changesApplied, 1)
  assert.equal(report.summaryVerdict.itemsNeedingAttention, 1)

  const html = renderReportHtml(report)
  assert.match(html, /Analysis &amp; Suggestions Report/)
  assert.match(html, /10\.2106\/JBJS\.19\.00123/)
  assert.match(html, /🔧|corrected/)

  const docxBytes = renderReportDocx(report)
  const re = new Docx(docxBytes)
  assert.match(extractBodyText(re.part(PART.document)!), /Analysis & Suggestions Report/)
})

test('api: progress mapping is monotonic and complete at 1', () => {
  assert.equal(progressFor('uploaded').progress < progressFor('rendered').progress, true)
  assert.equal(progressFor('complete').progress, 1)
})
