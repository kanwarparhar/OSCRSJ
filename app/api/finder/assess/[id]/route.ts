// Finder v2 assessment job — advance (POST) and poll (GET).
//
// Access control copies the formatter: the unguessable job id PLUS a matching
// email in the x-job-email header. A mismatch returns 404 so job existence never
// leaks. The email rides a header, never a query string (Session 98, Part F:
// personal data does not belong in URLs, which land in logs and proxies).
//
// Why POST-to-advance rather than running the work inside GET: the DeepSeek pass
// takes tens of seconds and must run exactly once. A polling GET that also did
// the work would fire it again on every poll.
//
// The response NEVER carries cost fields (Session 98 F-rule).

import { NextRequest, NextResponse } from 'next/server'
import { getJob, updateJob } from '@/lib/formatting/pipeline/jobs'
import type { FormattingJob } from '@/lib/formatting/pipeline/stages'
import { runAssessment, type AssessReport } from '@/lib/finder/assessJob'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

function emailOf(req: NextRequest): string | null {
  const raw = req.headers.get('x-job-email')
  return raw ? raw.toLowerCase().trim() : null
}

async function authorize(req: NextRequest, id: string): Promise<FormattingJob | null> {
  const email = emailOf(req)
  const job = await getJob(id)
  if (!job || !email || job.email.toLowerCase().trim() !== email) return null
  return job
}

/** Strip anything cost-shaped before the report crosses the wire. */
function publicReport(report: unknown): AssessReport | null {
  if (!report || typeof report !== 'object') return null
  const { cost: _cost, ...rest } = report as Record<string, unknown>
  return rest as unknown as AssessReport
}

function statusBody(job: FormattingJob) {
  const report = publicReport(job.report)
  return {
    jobId: job.id,
    status: job.status,
    done: job.status === 'complete' || job.status === 'failed',
    profile: report?.profile ?? null,
    ladder: report?.ladder ?? null,
    uncheckedStats: report?.uncheckedStats ?? [],
    error: job.error ? { stage: job.error.stage, message: job.error.message } : null,
  }
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const job = await authorize(req, params.id)
  if (!job) return NextResponse.json({ error: 'Not found.' }, { status: 404 })
  return NextResponse.json(statusBody(job))
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const job = await authorize(req, params.id)
  if (!job) return NextResponse.json({ error: 'Not found.' }, { status: 404 })

  // Already terminal — return the result rather than re-running (and re-billing).
  if (job.status === 'complete' || job.status === 'failed') {
    return NextResponse.json(statusBody(job))
  }

  // Claim the job before doing any work, so two racing advances cannot both run
  // the extraction. The status guard on the update is the compare-and-set.
  if (job.status === 'uploaded') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await updateJob(job.id, { status: 'extracted', updated_at: new Date().toISOString() } as any)
  }

  await runAssessment(job)
  const after = await getJob(params.id)
  if (!after) return NextResponse.json({ error: 'Not found.' }, { status: 404 })
  return NextResponse.json(statusBody(after))
}
