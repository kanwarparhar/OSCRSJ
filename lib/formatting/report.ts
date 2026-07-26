// Analysis & Suggestions Report — model builder + renderers (Sushant, Session C).
// The report is the trust product. It is assembled as a structured ReportModel
// and rendered to BOTH an HTML view (results page / email) and a .docx (reusing
// the OOXML builder — no PDF engine). Severity vocab: fixed / action-required /
// suggestion / info. No LLM client imported here.

import type {
  ReportModel,
  ReportChange,
  ReportSuggestion,
  ReferenceAuditRow,
  FormattedReference,
  ChecklistRow,
  MethodologyReportSection,
} from './types'
// Direct module imports, never the '@/lib/quality' barrel: it re-exports
// cache.ts, which imports node:crypto (see the note in types.ts).
import type { MethodologyScore, ScoredItem, StudyDesign } from '@/lib/quality/types'
import { STUDY_DESIGN_LABELS } from '@/lib/quality/types'
import { createDocx, paraXml } from './ooxml/docx'
import {
  designBasisLine,
  layoutNotPrescribedLine,
  IMPROVEMENTS_HEADING,
  IMPROVEMENTS_INTRO,
  INSTRUMENT_TRUST_LINE,
  METHODOLOGY_HEADING,
  NO_GAPS_LINE,
  NO_INSTRUMENT_LINE,
  RATING_LABELS,
  VERDICT_LABELS,
} from './reportCopy'

const DISCLAIMER =
  'This is an automated formatting aid, not a guarantee of acceptance. Always verify the ' +
  'output against the journal’s current Guide for Authors before submitting — journal rules ' +
  'change, and OSCRSJ formats from a snapshot taken on the date shown above. The tool never ' +
  'edits your scientific content; every substantive item is flagged for you to resolve.'

// ---------------------------------------------------------------------------
// Methodological quality (2026-07-26)
// ---------------------------------------------------------------------------

/**
 * The headline result, in the instrument's own scale.
 *
 * Numeric instruments read as "18 of 24 applicable points" rather than "18/24"
 * because the denominator is the applicable max, not the published max, and the
 * word "applicable" is the only thing carrying that distinction to a reader who
 * will not read the paragraph explaining it.
 */
function scoreLineFor(score: MethodologyScore): string | null {
  if (score.noInstrument) return null
  if (score.overallRating) return RATING_LABELS[score.overallRating] ?? score.overallRating
  if (score.obtained === null || score.applicableMax === null) return null
  return `${score.obtained} of ${score.applicableMax} applicable points`
}

/**
 * One actionable line per gap.
 *
 * The two gap kinds are kept distinct because they ask for different things. A
 * `not_met` item is an omission the author can close by writing a sentence. A
 * `not_assessable` item may already be in the manuscript somewhere we could not
 * read, so telling the author to "add" it would be telling them to duplicate
 * their own work. The criterion is quoted rather than reworded into an
 * imperative: the instrument's published wording is the thing an editor will
 * recognise, and paraphrasing it into "Report a clearly stated aim" costs that
 * recognition for no gain.
 */
function improvementLine(item: ScoredItem): string {
  return item.verdict === 'not_met'
    ? `Not stated: ${item.criterion}.`
    : `Could not tell from the text: ${item.criterion}.`
}

/**
 * Reduce a MethodologyScore to the render-ready section, or null when there is
 * nothing honest to render.
 *
 * A `gradingError` returns null, so the section vanishes rather than appearing
 * as an apology. The author's formatting job succeeded; a failed side-quest
 * should not leave a scar on the document they keep.
 */
export function buildMethodologySection(
  score: MethodologyScore | null | undefined,
  /** The design the appraisal rests on. Rendered as the basis disclosure. */
  design?: StudyDesign | null,
): MethodologyReportSection | null {
  if (!score || score.gradingError !== null) return null
  const designLabel = design ? STUDY_DESIGN_LABELS[design] : null

  if (score.noInstrument) {
    return {
      designLabel,
      instrumentName: score.instrumentName,
      citation: score.citation,
      scoreLine: null,
      notAssessableCount: 0,
      items: [],
      improvements: [],
      noInstrument: true,
    }
  }

  // Grading ran, the instrument applied, and yet not one item could be judged.
  // `normalized` is null in exactly that case, for all three scorers.
  //
  // This is an absence of evidence, not a score of zero, and the difference is
  // the whole doctrine: rendering it would print "0 of 0 applicable points" over
  // a table of thirteen "could not tell" rows, which an author reads as having
  // failed an appraisal that never actually happened.
  if (score.normalized === null) return null

  return {
    designLabel,
    instrumentName: score.instrumentName,
    citation: score.citation,
    scoreLine: scoreLineFor(score),
    notAssessableCount: score.items.filter((i) => i.verdict === 'not_assessable').length,
    items: score.items,
    improvements: score.gaps.map(improvementLine),
    noInstrument: false,
  }
}

export function buildReport(input: {
  journalName: string
  verifiedDate: string
  guidelinesUrl: string
  rulesVersion: string
  changes: ReportChange[]
  suggestions: ReportSuggestion[]
  referenceAudit: ReferenceAuditRow[]
  formattedReferences?: FormattedReference[] | null
  styleCaveat?: boolean
  layoutNotPrescribed?: boolean
  checklist: ChecklistRow[]
  /**
   * The graded instrument, when one was run. Optional so every existing caller
   * (and every test) keeps compiling and keeps producing today's report exactly.
   */
  methodology?: MethodologyScore | null
  /** The design the grade rests on, disclosed in the section. */
  methodologyDesign?: StudyDesign | null
  cost?: { deepseekTokens: number; usd: number }
}): ReportModel {
  // Deliberately counts ONLY suggestions. A methodological gap must never
  // inflate this number: "3 items need your attention before submission" is a
  // promise about things the journal's own rules say are wrong, and quietly
  // folding advice about study design into it would make the headline count
  // unfalsifiable and the report's central claim softer every release.
  const itemsNeedingAttention = input.suggestions.filter(
    (s) => s.severity === 'action-required',
  ).length
  return {
    summaryVerdict: {
      journal: input.journalName,
      changesApplied: input.changes.length,
      itemsNeedingAttention,
      verifiedDate: input.verifiedDate,
      guidelinesUrl: input.guidelinesUrl,
    },
    changesApplied: input.changes,
    suggestedChanges: input.suggestions,
    referenceAudit: input.referenceAudit,
    formattedReferences: input.formattedReferences ?? null,
    styleCaveat: input.styleCaveat ?? false,
    layoutNotPrescribed: input.layoutNotPrescribed ?? false,
    submissionChecklist: input.checklist,
    methodology: buildMethodologySection(input.methodology, input.methodologyDesign),
    rulesVersion: input.rulesVersion,
    disclaimer: DISCLAIMER,
    ...(input.cost ? { cost: input.cost } : {}),
  }
}

// ---------------------------------------------------------------------------
// HTML render (results page + email) — self-contained, inline styles
// ---------------------------------------------------------------------------

const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const STATUS_ICON: Record<ReferenceAuditRow['status'], string> = {
  verified: '✅',
  corrected: '🔧',
  unverified: '⚠️',
  'possibly-retracted': '🚩',
}

// --- formatted reference list (Part A) ------------------------------------
// Copy lives here as shared constants so the HTML and .docx renderers cannot
// drift apart.

const FORMATTED_REFS_INTRO =
  'Paste this over your bibliography, then regenerate any citation-manager fields. ' +
  'We never edit your manuscript directly — your uploaded reference text is unchanged.'

const STYLE_CAVEAT =
  'This journal uses its own citation variant — we rendered the closest standard ' +
  '(Vancouver); check punctuation against the guide.'

/**
 * Prefix + trailing note for one formatted entry. `unparsed` takes precedence
 * over verification status: if we could not structure the reference we did not
 * render it at all, so its verification state is not the useful signal.
 */
function formattedRefParts(r: FormattedReference): { prefix: string; suffix: string } {
  if (r.unparsed) return { prefix: '✳ ', suffix: ' (could not parse — original text kept)' }
  if (r.status === 'possibly-retracted') {
    return { prefix: '⚠ ', suffix: ' — POSSIBLY RETRACTED, verify before citing' }
  }
  if (r.status === 'unverified') return { prefix: '⚠ ', suffix: '' }
  return { prefix: '', suffix: '' }
}

/**
 * The evidence line under an item: the verified quote, or the reason there is
 * none. Never blank -- an empty cell reads as a rendering bug, and the whole
 * point of this table is that a judgement without a quote is visibly a
 * judgement without a quote.
 */
function itemEvidence(item: ScoredItem): string {
  if (item.quote) return `“${item.quote}”`
  return item.verdict === 'not_met'
    ? 'Not stated in the text we read.'
    : 'Not determinable from the text we read.'
}

function itemVerdictLabel(item: ScoredItem): string {
  const label = VERDICT_LABELS[item.verdict] ?? VERDICT_LABELS.not_assessable
  return item.points !== null ? `${label} · ${item.points} pt` : label
}

function methodologyHtml(m: MethodologyReportSection | null): string {
  if (!m) return ''
  const head = `<h2>${esc(METHODOLOGY_HEADING)}</h2>`
  if (m.noInstrument) {
    return `${head}\n<p>${esc(NO_INSTRUMENT_LINE)}</p>
<p class="disc">${esc(INSTRUMENT_TRUST_LINE)}</p>`
  }

  const rows = m.items
    .map(
      (i) =>
        `<tr><td>${esc(i.criterion)}</td><td>${esc(itemVerdictLabel(i))}</td><td>${esc(itemEvidence(i))}</td></tr>`,
    )
    .join('')
  const excluded =
    m.notAssessableCount > 0
      ? ` <small>${m.notAssessableCount} item${m.notAssessableCount === 1 ? ' was' : 's were'} excluded from both sides of that total because the manuscript text did not let ${m.notAssessableCount === 1 ? 'it' : 'them'} be judged.</small>`
      : ''
  const improvements = m.improvements.length
    ? `<p>${esc(IMPROVEMENTS_INTRO)}</p><ul>${m.improvements.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>`
    : `<p>${esc(NO_GAPS_LINE)}</p>`

  // The basis disclosure sits ABOVE the score, not in a footnote. A reader who
  // stops after the number must already have been told what it rests on.
  const basis = m.designLabel ? `<p><em>${esc(designBasisLine(m.designLabel))}</em></p>` : ''

  return `${head}
${basis}
<div class="verdict"><strong>${esc(m.instrumentName)}${m.scoreLine ? `: ${esc(m.scoreLine)}` : ''}</strong>${excluded}<br>
<small>${esc(m.citation)}</small></div>
<table><tr><th>Item</th><th>Result</th><th>Evidence from your manuscript</th></tr>${rows}</table>
<h3>${esc(IMPROVEMENTS_HEADING)}</h3>${improvements}
<p class="disc">${esc(INSTRUMENT_TRUST_LINE)}</p>`
}

export function renderReportHtml(report: ReportModel): string {
  const v = report.summaryVerdict
  const changeRows = report.changesApplied
    .map(
      (c) =>
        `<tr><td>${esc(c.element)}</td><td>${esc(c.before)} → ${esc(c.after)}</td></tr>`,
    )
    .join('')
  const suggestions = report.suggestedChanges
    .map(
      (s) =>
        `<li><strong>${esc(s.title)}</strong>${s.location ? ` <em>${esc(s.location)}</em>` : ''}<br>${esc(s.detail)}${s.suggestedWording ? `<br><em>Suggested wording:</em> ${esc(s.suggestedWording)}` : ''}</li>`,
    )
    .join('')
  const refRows = report.referenceAudit
    .map(
      (r) =>
        `<tr><td>${r.index}</td><td>${STATUS_ICON[r.status]} ${r.status}</td><td>${esc(r.changed)}</td><td>${r.doi ? esc(r.doi) : r.pmid ? 'PMID ' + esc(r.pmid) : '—'}</td></tr>`,
    )
    .join('')
  const checklist = report.submissionChecklist
    .map((c) => `<tr><td>${esc(c.requirement)}</td><td>${c.status}</td></tr>`)
    .join('')
  const formattedRefs = (report.formattedReferences ?? [])
    .map((r) => {
      const { prefix, suffix } = formattedRefParts(r)
      return `<li>${esc(prefix)}${esc(r.text)}${esc(suffix)}</li>`
    })
    .join('')
  const formattedRefsSection = report.formattedReferences
    ? `<h2>Your reference list, formatted for ${esc(v.journal)}</h2>
<p>${esc(FORMATTED_REFS_INTRO)}</p>${report.styleCaveat ? `<p><em>${esc(STYLE_CAVEAT)}</em></p>` : ''}
<ol class="fmtrefs">${formattedRefs}</ol>`
    : ''

  return `<!doctype html><html><head><meta charset="utf-8"><title>Analysis &amp; Suggestions — ${esc(v.journal)}</title>
<style>body{font-family:Georgia,serif;color:#120D08;max-width:820px;margin:2rem auto;padding:0 1rem;line-height:1.5}
h1,h2,h3{color:#3d2a18}h2{border-bottom:1px solid rgba(153,126,103,.25);padding-bottom:.25rem;margin-top:2rem}h3{margin-top:1.5rem;font-size:1.05rem}
table{width:100%;border-collapse:collapse;margin:.5rem 0}td,th{border:1px solid rgba(153,126,103,.25);padding:.4rem .6rem;text-align:left;vertical-align:top}
.verdict{background:#F8F4ED;border-radius:8px;padding:1rem 1.25rem}.disc{font-size:.85rem;color:#664930;margin-top:2rem}
ol.fmtrefs li{margin:.45rem 0}</style></head><body>
<h1>Analysis &amp; Suggestions Report</h1>
<div class="verdict"><strong>Formatted for ${esc(v.journal)}.</strong> ${v.changesApplied} change(s) applied automatically. ${v.itemsNeedingAttention} item(s) need your attention before submission.<br>
${report.layoutNotPrescribed ? `<br>${esc(layoutNotPrescribedLine(v.journal))}` : ''}
<small>Rules verified ${esc(v.verifiedDate)} · <a href="${esc(v.guidelinesUrl)}">Guide for Authors</a> · rules v${esc(report.rulesVersion)}</small></div>
<h2>Changes applied</h2>${changeRows ? `<table><tr><th>Element</th><th>Before → After</th></tr>${changeRows}</table>` : '<p>No automatic changes were needed.</p>'}
<h2>Suggested changes (author action required)</h2>${suggestions ? `<ul>${suggestions}</ul>` : '<p>Nothing flagged.</p>'}
<h2>Reference audit</h2>${refRows ? `<table><tr><th>#</th><th>Status</th><th>What changed</th><th>DOI / PMID</th></tr>${refRows}</table>` : '<p>No references detected.</p>'}
${formattedRefsSection}${methodologyHtml(report.methodology)}
<h2>Submission checklist</h2>${checklist ? `<table><tr><th>Requirement</th><th>Status</th></tr>${checklist}</table>` : ''}
<p class="disc">${esc(report.disclaimer)}</p></body></html>`
}

// ---------------------------------------------------------------------------
// .docx render — reuse the OOXML builder
// ---------------------------------------------------------------------------

export function renderReportDocx(report: ReportModel): Uint8Array {
  const v = report.summaryVerdict
  const p: string[] = []
  p.push(paraXml('Analysis & Suggestions Report', { bold: true, sizePt: 16 }))
  p.push(
    paraXml(
      `Formatted for ${v.journal}. ${v.changesApplied} change(s) applied automatically. ${v.itemsNeedingAttention} item(s) need your attention before submission.`,
    ),
  )
  if (report.layoutNotPrescribed) p.push(paraXml(layoutNotPrescribedLine(v.journal)))
  p.push(paraXml(`Rules verified ${v.verifiedDate} · ${v.guidelinesUrl} · rules v${report.rulesVersion}`, { italic: true }))

  p.push(paraXml('Changes applied', { bold: true, sizePt: 13 }))
  if (report.changesApplied.length === 0) p.push(paraXml('No automatic changes were needed.'))
  for (const c of report.changesApplied) p.push(paraXml(`• ${c.element}: ${c.before} → ${c.after}`))

  p.push(paraXml('Suggested changes (author action required)', { bold: true, sizePt: 13 }))
  if (report.suggestedChanges.length === 0) p.push(paraXml('Nothing flagged.'))
  for (const s of report.suggestedChanges) {
    p.push(paraXml(`• [${s.severity}] ${s.title}${s.location ? ` — ${s.location}` : ''}`, { bold: true }))
    p.push(paraXml(`   ${s.detail}`))
    if (s.suggestedWording) p.push(paraXml(`   Suggested wording: ${s.suggestedWording}`, { italic: true }))
  }

  p.push(paraXml('Reference audit', { bold: true, sizePt: 13 }))
  if (report.referenceAudit.length === 0) p.push(paraXml('No references detected.'))
  for (const r of report.referenceAudit) {
    const id = r.doi ? r.doi : r.pmid ? `PMID ${r.pmid}` : '—'
    p.push(paraXml(`${r.index}. ${STATUS_ICON[r.status]} ${r.status} — ${r.changed} — ${id}`))
  }

  if (report.formattedReferences) {
    p.push(paraXml(`Your reference list, formatted for ${v.journal}`, { bold: true, sizePt: 13 }))
    p.push(paraXml(FORMATTED_REFS_INTRO))
    if (report.styleCaveat) p.push(paraXml(STYLE_CAVEAT, { italic: true }))
    for (const r of report.formattedReferences) {
      const { prefix, suffix } = formattedRefParts(r)
      p.push(paraXml(`${prefix}${r.index}. ${r.text}${suffix}`))
    }
  }

  // The .docx carries the same section as the HTML, built from the same
  // MethodologyReportSection, so the file the author keeps cannot say something
  // different from the screen they read it on.
  const m = report.methodology
  if (m) {
    p.push(paraXml(METHODOLOGY_HEADING, { bold: true, sizePt: 13 }))
    if (m.designLabel) p.push(paraXml(designBasisLine(m.designLabel), { italic: true }))
    if (m.noInstrument) {
      p.push(paraXml(NO_INSTRUMENT_LINE))
    } else {
      p.push(paraXml(m.scoreLine ? `${m.instrumentName}: ${m.scoreLine}` : m.instrumentName, { bold: true }))
      if (m.notAssessableCount > 0) {
        p.push(
          paraXml(
            `${m.notAssessableCount} item${m.notAssessableCount === 1 ? ' was' : 's were'} excluded from both sides of that total because the manuscript text did not let ${m.notAssessableCount === 1 ? 'it' : 'them'} be judged.`,
            { italic: true },
          ),
        )
      }
      p.push(paraXml(m.citation, { italic: true }))
      for (const item of m.items) {
        p.push(paraXml(`• ${item.criterion} — ${itemVerdictLabel(item)}`))
        p.push(paraXml(`   ${itemEvidence(item)}`, { italic: true }))
      }
      p.push(paraXml(IMPROVEMENTS_HEADING, { bold: true }))
      if (m.improvements.length === 0) {
        p.push(paraXml(NO_GAPS_LINE))
      } else {
        p.push(paraXml(IMPROVEMENTS_INTRO))
        for (const line of m.improvements) p.push(paraXml(`• ${line}`))
      }
    }
    p.push(paraXml(INSTRUMENT_TRUST_LINE, { italic: true }))
  }

  p.push(paraXml('Submission checklist', { bold: true, sizePt: 13 }))
  for (const c of report.submissionChecklist) p.push(paraXml(`• ${c.requirement}: ${c.status}`))

  p.push(paraXml(report.disclaimer, { italic: true }))
  return createDocx(p).toUint8Array()
}
