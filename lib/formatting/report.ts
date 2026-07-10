// Analysis & Suggestions Report — model + renderers (Sushant, Session 87
// scaffold). The report is the trust product: it is generated as a structured
// `ReportModel` (see ../types) and rendered to BOTH an HTML view (results page)
// and a `.docx` (via the OOXML emit tooling — do NOT add a PDF engine for this).
// Severity vocabulary throughout: fixed / action-required / suggestion / info.
//
// Implemented in Session C.

import type { ReportModel } from './types'

/** Render the report to standalone HTML for the `/format` results page. */
export function renderReportHtml(report: ReportModel): string {
  // TODO(Session C): deterministic HTML render of all six sections
  // (summary verdict, changes applied, suggested changes, reference audit,
  // submission checklist, disclaimer). Never render `report.cost`.
  void report
  throw new Error('renderReportHtml not implemented — Session C')
}

/**
 * Render the report to a .docx by reusing the OOXML emit tooling.
 * @returns the .docx bytes
 */
export function renderReportDocx(report: ReportModel): Uint8Array {
  // TODO(Session C): build a simple OOXML document from the ReportModel using
  // the same emit primitives as the manuscript output.
  void report
  throw new Error('renderReportDocx not implemented — Session C')
}
