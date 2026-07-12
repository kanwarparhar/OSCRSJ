// GET /api/format/jobs/[id]?email=… — job status + signed download URLs
// (Sushant, Session C). Access is the unguessable job id + a matching email;
// a mismatch returns 404 so job existence never leaks.

import { NextRequest, NextResponse } from 'next/server'
import { getJob, createSignedDownload, readJobMeta } from '@/lib/formatting/pipeline/jobs'
import { progressFor, outputBaseName, type JobStatusResponse, type JobOutputs } from '@/lib/formatting/pipeline/api'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const email = req.nextUrl.searchParams.get('email')?.toLowerCase().trim()
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
    const [m, r, z] = await Promise.all([
      op.manuscript ? createSignedDownload(op.manuscript, `${base}.docx`) : null,
      op.report_docx ? createSignedDownload(op.report_docx, `${base}_report.docx`) : null,
      op.zip ? createSignedDownload(op.zip, `${base}_package.zip`) : null,
    ])
    if (m) downloads.manuscript = m
    if (r) downloads.reportDocx = r
    if (z) downloads.zip = z
  }

  const meta = progressFor(job.status, job.stage_cursor)
  const res: JobStatusResponse = {
    jobId: job.id,
    status: job.status,
    progress: meta.progress,
    stageLabel: meta.label,
    report: job.report ?? null,
    downloads,
    error: job.error ? { stage: job.error.stage, message: job.error.message } : null,
  }
  return NextResponse.json(res)
}
