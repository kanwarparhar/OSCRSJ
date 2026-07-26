// The Methodological Quality section of the formatter report (2026-07-26).
// Run: npx tsx --test tests/formatting-report-methodology.test.ts
//
// Three things are under test, in descending order of how much damage they would
// do if they broke:
//
//   1. The section is ADDITIVE. A report built without a methodology is
//      byte-identical to the report this pipeline produced before the feature
//      existed, and a grading failure is indistinguishable from never having
//      asked. Every formatter job that ran before today must keep rendering.
//   2. The HTML and the .docx say the same thing, because they are built from
//      one already-reduced section rather than each formatting its own copy.
//   3. The article-type -> study-design map stays honest. This is the one that
//      will be under pressure later: the section is invisible for most original
//      research, and the tempting fix is a one-line lie.

import { test } from 'node:test'
import assert from 'node:assert'

import {
  buildMethodologySection,
  buildReport,
  renderReportDocx,
  renderReportHtml,
} from '../lib/formatting/report'
import {
  DESIGN_CHOICES_BY_ARTICLE_TYPE,
  needsDeclaredDesign,
  parseDeclaredDesign,
  resolveStudyDesign,
  studyDesignForArticleType,
} from '../lib/formatting/studyDesign'
import {
  IMPROVEMENTS_HEADING,
  INSTRUMENT_TRUST_LINE,
  METHODOLOGY_HEADING,
  NO_GAPS_LINE,
  NO_INSTRUMENT_LINE,
} from '../lib/formatting/reportCopy'
import { designBasisLine } from '../lib/formatting/reportCopy'
import { INSTRUMENTS } from '../lib/quality/instruments'
import { scoreInstrument, scoreNone, gradingErrorScore } from '../lib/quality/score'
import type { MethodologyScore, RawGradedItem, StudyDesign } from '../lib/quality/types'
import { STUDY_DESIGN_LABELS, STUDY_DESIGNS } from '../lib/quality/types'
import type { ArticleType } from '../lib/formatting/rulesSchema'

// --- Fixtures --------------------------------------------------------------

function report(methodology?: MethodologyScore | null, design?: StudyDesign | null) {
  return buildReport({
    journalName: 'Orthopedic Surgery Case Reports & Series Journal (OSCRSJ)',
    verifiedDate: '2026-07-01',
    guidelinesUrl: 'https://www.oscrsj.com/guide-for-authors',
    rulesVersion: '1.0.0',
    changes: [],
    suggestions: [],
    referenceAudit: [],
    checklist: [{ requirement: 'Structured abstract', status: 'met' }],
    ...(methodology === undefined ? {} : { methodology }),
    ...(design === undefined ? {} : { methodologyDesign: design }),
  })
}

/**
 * A real CARE grade, built through the real scorer rather than hand-written, so
 * the test cannot pass against a MethodologyScore shape that scoreInstrument
 * would never actually produce.
 */
function careScore(): MethodologyScore {
  const def = INSTRUMENTS.CARE
  const raw: RawGradedItem[] = def.items.map((item, i) => {
    if (i === 0) return { id: item.id, verdict: 'met', quote: 'A rare case report of bilateral compartment syndrome' }
    if (i === 1) return { id: item.id, verdict: 'not_met', quote: null }
    if (i === 2) return { id: item.id, verdict: 'not_assessable', quote: null }
    return { id: item.id, verdict: 'met', quote: `evidence sentence number ${i}` }
  })
  return scoreInstrument(def, raw)
}

// --- 1. The section is additive --------------------------------------------

test('a report built without a methodology is identical to one built before the feature existed', () => {
  const withoutKey = report()
  const explicitNull = report(null)

  assert.equal(withoutKey.methodology, null, 'omitting the key must mean "no section", not undefined')
  assert.deepEqual(withoutKey, explicitNull, 'omitted and explicitly-null must not differ')

  const html = renderReportHtml(withoutKey)
  assert.equal(
    html,
    renderReportHtml(explicitNull),
    'the rendered HTML must be byte-identical, not merely equivalent',
  )
  assert.doesNotMatch(html, new RegExp(METHODOLOGY_HEADING))
  assert.doesNotMatch(html, /MINORS|Newcastle|AMSTAR/)

  // The .docx renderer must not throw and must not gain the section either.
  assert.ok(renderReportDocx(withoutKey).byteLength > 0)
})

test('a grading failure omits the section entirely and never throws', () => {
  const failed = gradingErrorScore(INSTRUMENTS.CARE, 'DeepSeek HTTP 503: upstream unavailable')
  const r = report(failed)

  assert.equal(r.methodology, null, 'a failed grade renders nothing, not an apology')
  const html = renderReportHtml(r)
  assert.doesNotMatch(html, new RegExp(METHODOLOGY_HEADING))
  // The reason must never reach the author's report.
  assert.doesNotMatch(html, /DeepSeek|503|upstream/)
  assert.ok(renderReportDocx(r).byteLength > 0)

  // And it is indistinguishable from never having graded at all.
  assert.equal(html, renderReportHtml(report()))
})

test('an instrument where NOTHING could be judged renders nothing', () => {
  // Grading "succeeded" and appraised nothing: the scorer fills every item as
  // not_assessable, so applicableMax is 0 and normalized is null. Rendering that
  // would print "0 of 0 applicable points" over thirteen "could not tell" rows,
  // which reads as a failed appraisal rather than an absent one.
  const empty = scoreInstrument(INSTRUMENTS.CARE, [])
  assert.equal(empty.normalized, null, 'precondition: nothing assessable')
  assert.equal(empty.items.length, 13, 'the scorer fills items rather than leaving them out')
  assert.equal(buildMethodologySection(empty), null)

  const html = renderReportHtml(report(empty))
  assert.doesNotMatch(html, /0 of 0/)
  assert.equal(html, renderReportHtml(report()), 'indistinguishable from no grading at all')
})

test('quality gaps never inflate the "items need your attention" count', () => {
  // The whole report's headline number is a claim about the journal's own rules.
  // A methodological gap is advice, and folding advice into that count would
  // make the number mean less every time this feature grows.
  const clean = report()
  const graded = report(careScore())

  assert.ok(graded.methodology, 'fixture must actually produce a section')
  assert.ok(graded.methodology!.improvements.length > 0, 'fixture must actually have gaps')
  assert.equal(
    graded.summaryVerdict.itemsNeedingAttention,
    clean.summaryVerdict.itemsNeedingAttention,
  )
})

// --- 2. HTML and .docx agree ------------------------------------------------

test('a scored methodology reaches BOTH the HTML and the .docx', () => {
  const score = careScore()
  const r = report(score)
  const section = r.methodology
  assert.ok(section, 'CARE grade must produce a section')

  const html = renderReportHtml(r)
  const docxText = docxPlainText(renderReportDocx(r))

  for (const surface of [html, docxText]) {
    assert.match(surface, new RegExp(escapeRe(section!.instrumentName)), 'instrument name')
    assert.match(surface, new RegExp(escapeRe(section!.citation.slice(0, 40))), 'citation')
    assert.match(surface, new RegExp(escapeRe(section!.scoreLine!)), 'score line')
    assert.match(surface, new RegExp(escapeRe(IMPROVEMENTS_HEADING)), 'gap list heading')
    assert.match(surface, new RegExp(escapeRe(INSTRUMENT_TRUST_LINE.slice(0, 60))), 'trust line')
    for (const line of section!.improvements) {
      assert.match(surface, new RegExp(escapeRe(line)), `gap line: ${line}`)
    }
  }
})

test('the score line reports the APPLICABLE max and discloses what was excluded', () => {
  const section = buildMethodologySection(careScore())
  assert.ok(section)
  // One item is not_assessable, so CARE's published max of 13 drops to 12 and
  // the excluded item is stated rather than silently dropped.
  assert.equal(section!.notAssessableCount, 1)
  assert.match(section!.scoreLine!, /of 12 applicable points$/)

  const html = renderReportHtml(report(careScore()))
  assert.match(html, /excluded from both sides of that total/)
})

test('every item carries either its verified quote or the reason it has none', () => {
  const html = renderReportHtml(report(careScore()))
  // not_met and not_assessable read differently, because they ask the author for
  // different things: write this, versus tell us where this already is.
  assert.match(html, /Not stated in the text we read\./)
  assert.match(html, /Not determinable from the text we read\./)
  assert.match(html, /A rare case report of bilateral compartment syndrome/)
})

test('a study with no gaps says so rather than showing an empty list', () => {
  const def = INSTRUMENTS.CARE
  const perfect = scoreInstrument(
    def,
    def.items.map((i) => ({ id: i.id, verdict: 'met' as const, quote: `quote for ${i.id}` })),
  )
  const r = report(perfect)
  assert.deepEqual(r.methodology!.improvements, [])
  assert.match(renderReportHtml(r), new RegExp(escapeRe(NO_GAPS_LINE)))
  assert.match(docxPlainText(renderReportDocx(r)), new RegExp(escapeRe(NO_GAPS_LINE)))
})

test('no validated instrument renders one honest line and no table', () => {
  const r = report(scoreNone())
  assert.equal(r.methodology!.noInstrument, true)
  assert.equal(r.methodology!.scoreLine, null)

  const html = renderReportHtml(r)
  assert.match(html, new RegExp(escapeRe(NO_INSTRUMENT_LINE)))
  assert.doesNotMatch(html, new RegExp(escapeRe(IMPROVEMENTS_HEADING)))
  assert.match(docxPlainText(renderReportDocx(r)), new RegExp(escapeRe(NO_INSTRUMENT_LINE)))
})

test('nothing in a rendered section predicts acceptance', () => {
  const surfaces = [
    renderReportHtml(report(careScore())),
    docxPlainText(renderReportDocx(report(careScore()))),
    renderReportHtml(report(scoreNone())),
  ]
  for (const s of surfaces) {
    // The disclaimer's own "not a guarantee of acceptance" is allowed; a claim
    // about likelihood, odds or chance of acceptance is not.
    assert.doesNotMatch(s, /likelihood|probability|chance of acceptance|odds/i)
  }
})

// --- 3. The design map stays honest ----------------------------------------

test('article types map to a study design ONLY where the type IS the design', () => {
  assert.equal(studyDesignForArticleType('case_report'), 'case_report')
  assert.equal(studyDesignForArticleType('case_series'), 'case_series')
  assert.equal(studyDesignForArticleType('systematic_review'), 'systematic_review')
  assert.equal(studyDesignForArticleType('narrative_review'), 'narrative_review')
  assert.equal(studyDesignForArticleType('technical_note'), 'technical_note')
})

test('original_research maps to NO design, and this is the point of the map', () => {
  // An original-research upload may be an RCT, a prospective cohort, a
  // retrospective comparison or a chart review. Those take four different
  // instruments with four different item sets. Anyone reaching for a one-line
  // "fix" here is about to print a published instrument's name over a score that
  // manuscript never earned. Ask the author instead -- which is what the picker
  // below does.
  assert.equal(studyDesignForArticleType('original_research'), null)

  for (const t of ['review', 'letter', 'editorial'] as ArticleType[]) {
    assert.equal(studyDesignForArticleType(t), null, `${t} must not claim a design`)
  }
})

// --- 4. The author declares the design -------------------------------------

test('the picker is offered exactly where the article type leaves the design open', () => {
  assert.equal(needsDeclaredDesign('original_research'), true)
  assert.equal(needsDeclaredDesign('review'), true)

  // Already determined: asking would be asking a question we know the answer to.
  for (const t of ['case_report', 'case_series', 'systematic_review', 'narrative_review', 'technical_note'] as ArticleType[]) {
    assert.equal(needsDeclaredDesign(t), false, `${t} is already determined`)
  }
  // No design a letter or editorial could carry has a validated instrument, so
  // the question would be asked for nothing.
  assert.equal(needsDeclaredDesign('letter'), false)
  assert.equal(needsDeclaredDesign('editorial'), false)
})

test('every offered design is a real design with a label and a hint', () => {
  for (const [type, choices] of Object.entries(DESIGN_CHOICES_BY_ARTICLE_TYPE)) {
    for (const d of choices ?? []) {
      assert.ok(STUDY_DESIGNS.includes(d), `${type} offers unknown design ${d}`)
      assert.ok(STUDY_DESIGN_LABELS[d], `${d} has no label`)
    }
  }
})

test('a declared design is validated against ITS OWN article type', () => {
  assert.equal(parseDeclaredDesign('rct', 'original_research'), 'rct')
  assert.equal(parseDeclaredDesign('retrospective_comparative', 'original_research'), 'retrospective_comparative')
  assert.equal(parseDeclaredDesign('systematic_review', 'review'), 'systematic_review')

  // The attack this closes: a hand-rolled POST pairing "original research" with
  // "case report" would otherwise get CARE applied to a study that is not a case
  // report, and CARE's thirteen completeness items would score it generously.
  assert.equal(parseDeclaredDesign('case_report', 'original_research'), null)
  assert.equal(parseDeclaredDesign('rct', 'review'), null)

  // Anything unrecognised is null -- never a fallback design.
  assert.equal(parseDeclaredDesign('', 'original_research'), null)
  assert.equal(parseDeclaredDesign(null, 'original_research'), null)
  assert.equal(parseDeclaredDesign(42, 'original_research'), null)
  assert.equal(parseDeclaredDesign('definitely_not_a_design', 'original_research'), null)
  // An article type with no picker accepts nothing, however plausible.
  assert.equal(parseDeclaredDesign('rct', 'case_report'), null)
})

test('a blank answer means no appraisal, never a guessed design', () => {
  // The whole doctrine in one assertion. Leaving the picker blank must land on
  // null, so gradeQuietly skips the call and the section is absent. If this ever
  // returns a design, someone has added a fallback and the product is now
  // printing instrument scores for studies whose design nobody stated.
  assert.equal(resolveStudyDesign('original_research', null), null)
  assert.equal(resolveStudyDesign('original_research', undefined), null)
})

test('the article type wins over a contradicting declared design', () => {
  // Same author, narrower question. Someone who selected "Case report" and then
  // supplied a conflicting design has contradicted themselves; honour the
  // narrower answer rather than letting the looser one select the instrument.
  assert.equal(resolveStudyDesign('case_report', 'rct'), 'case_report')
  assert.equal(resolveStudyDesign('original_research', 'rct'), 'rct')
})

test('the report DISCLOSES that the design came from the author, not the manuscript', () => {
  // This is the load-bearing test of the whole change. Every other number in the
  // product is anchored to a verified quote; the design is not, and the
  // instrument is chosen entirely from it. A wrong answer does not degrade the
  // score, it invalidates it -- so the report must say what it rests on.
  const r = report(careScore(), 'case_report')
  const section = r.methodology
  assert.equal(section!.designLabel, 'Case report')

  const expected = designBasisLine('Case report')
  assert.match(expected, /that is what you told us/)
  assert.match(expected, /did not read the study design from your manuscript/)
  assert.match(expected, /the wrong instrument/)

  for (const surface of [renderReportHtml(r), docxPlainText(renderReportDocx(r))]) {
    assert.match(surface, new RegExp(escapeRe(expected)), 'basis disclosure must appear')
  }
})

test('the disclosure appears for a declared design too, not just a derived one', () => {
  const minors = scoreInstrument(
    INSTRUMENTS.MINORS_COMPARATIVE,
    INSTRUMENTS.MINORS_COMPARATIVE.items.map((i) => ({
      id: i.id,
      verdict: 'met' as const,
      quote: `quote for ${i.id}`,
    })),
  )
  const r = report(minors, 'retrospective_comparative')
  assert.equal(r.methodology!.designLabel, 'Retrospective comparative')
  assert.match(renderReportHtml(r), /retrospective comparative, because that is what you told us/)
  // 24/24 on the comparative instrument, which is the max in the brief's table.
  assert.match(r.methodology!.scoreLine!, /^24 of 24 applicable points$/)
})

test('a section with no design still renders, without a false disclosure', () => {
  // Reports written before this change carry no design. They must not grow a
  // disclosure claiming the author told us something they never did.
  const r = report(careScore())
  assert.equal(r.methodology!.designLabel, null)
  assert.doesNotMatch(renderReportHtml(r), /because that is what you told us/)
})

// --- helpers ---------------------------------------------------------------

const escapeRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * Pull the visible text out of a report .docx.
 *
 * The report builder writes plain `<w:t>` runs with no rsid noise, so a tag
 * sweep is enough and is far cheaper than unzipping with a real OOXML reader.
 * createDocx returns a zip, so the XML is deflated -- but paraXml text survives
 * as literal bytes often enough to be unreliable, so we inflate properly.
 */
function docxPlainText(bytes: Uint8Array): string {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const PizZip = require('pizzip')
  const zip = new PizZip(Buffer.from(bytes))
  const xml: string = zip.file('word/document.xml').asText()
  return xml
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
}
