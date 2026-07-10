// GET /api/format/jobs/[id]?email=… — job status + signed download URLs
// (Sushant, Session C). Access is the unguessable job id + a matching email;
// a mismatch returns 404 so job existence never leaks.

import { NextRequest, NextResponse } from 'next/server'
import { getJob, createSignedDownload } from '@/lib/formatting/pipeline/jobs'
import { progressFor, type JobStatusResponse, type JobOutputs } from '@/lib/formatting/pipeline/api'

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
    const [m, t, r, z] = await Promise.all([
      op.manuscript ? createSignedDownload(op.manuscript) : null,
      op.title_page ? createSignedDownload(op.title_page) : null,
      op.report_docx ? createSignedDownload(op.report_docx) : null,
      op.zip ? createSignedDownload(op.zip) : null,
    ])
    if (m) downloads.manuscript = m
    if (t) downloads.titlePage = t
    if (r) downloads.reportDocx = r
    if (z) downloads.zip = z
  }

  const meta = progressFor(job.status)
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
