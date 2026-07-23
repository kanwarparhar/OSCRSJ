// GET /api/format/jobs/[id] — job status + signed download URLs
// (Sushant, Session C). Access is the unguessable job id + a matching email;
// a mismatch returns 404 so job existence never leaks. The email rides the
// x-job-email header (2026-07-22, Part F — personal data does not belong in
// URL query strings, which land in logs and proxies); the ?email= query param
// is still accepted for ONE release as a fallback for in-flight clients, then
// should be dropped.

import { NextRequest, NextResponse } from 'next/server'
import { getJob, createSignedDownload, readJobMeta } from '@/lib/formatting/pipeline/jobs'
import { progressFor, outputBaseName, type JobStatusResponse, type JobOutputs } from '@/lib/formatting/pipeline/api'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const email = (req.headers.get('x-job-email') ?? req.nextUrl.searchParams.get('email'))
    ?.toLowerCase()
    .trim()
  const job = await getJob(params.id)
  if (!job || !email || job.email.toLowerCase().trim() !== email) {
    return NextResponse.json({ error: 'Not found.' }, { status: 404 })
  }

  const downloads: JobOutputs = {}
  if (job.output_paths && (job.status === 'rendered' || job.status === 'complete')) {
    const op = job.output_paths
    // Downloads are served under the original filename + _<journal abbrev>.
    const jobMeta = await readJobMeta(job.id)
    const base = outputBaseName(jobMeta?.originalFilename, job.journal_id)
    const [m, r, t, z] = await Promise.all([
      op.manuscript ? createSignedDownload(op.manuscript, `${base}.docx`) : null,
      op.report_docx ? createSignedDownload(op.report_docx, `${base}_report.docx`) : null,
      op.title_page ? createSignedDownload(op.title_page, `${base}_title-page.docx`) : null,
      op.zip ? createSignedDownload(op.zip, `${base}_package.zip`) : null,
    ])
    if (m) downloads.manuscript = m
    if (r) downloads.reportDocx = r
    if (t) downloads.titlePage = t
    if (z) downloads.zip = z
  }

  const meta = progressFor(job.status, job.stage_cursor)
  // ReportModel.cost is internal-only (documented: never rendered) — strip it
  // from the wire instead of shipping our DeepSeek spend to every status poll
  // (2026-07-22, Part F). The DB row keeps it.
  let report = job.report ?? null
  if (report && 'cost' in report) {
    const { cost: _cost, ...rest } = report
    report = rest
  }
  const res: JobStatusResponse = {
    jobId: job.id,
    status: job.status,
    progress: meta.progress,
    stageLabel: meta.label,
    report,
    downloads,
    error: job.error ? { stage: job.error.stage, message: job.error.message } : null,
  }
  return NextResponse.json(res)
}
