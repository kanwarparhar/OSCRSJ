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
} from './types'
import { createDocx, paraXml } from './ooxml/docx'
import { layoutNotPrescribedLine } from './reportCopy'

const DISCLAIMER =
  'This is an automated formatting aid, not a guarantee of acceptance. Always verify the ' +
  'output against the journal’s current Guide for Authors before submitting — journal rules ' +
  'change, and OSCRSJ formats from a snapshot taken on the date shown above. The tool never ' +
  'edits your scientific content; every substantive item is flagged for you to resolve.'

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
  cost?: { deepseekTokens: number; usd: number }
}): ReportModel {
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
h1,h2{color:#3d2a18}h2{border-bottom:1px solid rgba(153,126,103,.25);padding-bottom:.25rem;margin-top:2rem}
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
${formattedRefsSection}
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

  p.push(paraXml('Submission checklist', { bold: true, sizePt: 13 }))
  for (const c of report.submissionChecklist) p.push(paraXml(`• ${c.requirement}: ${c.status}`))

  p.push(paraXml(report.disclaimer, { italic: true }))
  return createDocx(p).toUint8Array()
}
