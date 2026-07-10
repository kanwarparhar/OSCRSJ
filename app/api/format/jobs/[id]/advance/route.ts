// POST /api/format/jobs/[id]/advance — run the next pipeline stage
// (Sushant, Session C). Body: { email }. Client-driven: the /format page calls
// this in a loop, polling status between calls, until complete|failed. Stages
// are idempotent (re-ingest is deterministic; render overwrites outputs) and
// terminal states short-circuit, so a re-run is safe.

import { NextRequest, NextResponse } from 'next/server'
import { getJob } from '@/lib/formatting/pipeline/jobs'
import { runNextStage } from '@/lib/formatting/pipeline/run'
import { progressFor } from '@/lib/formatting/pipeline/api'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60 // each stage is designed to finish within the Vercel budget

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const body = (await req.json().catch(() => ({}))) as { email?: unknown }
  const email = typeof body.email === 'string' ? body.email.toLowerCase().trim() : null

  const job = await getJob(params.id)
  if (!job || !email || job.email.toLowerCase().trim() !== email) {
    return NextResponse.json({ error: 'Not found.' }, { status: 404 })
  }

  if (job.status === 'complete' || job.status === 'failed') {
    const meta = progressFor(job.status)
    return NextResponse.json({
      status: job.status,
      progress: meta.progress,
      stageLabel: meta.label,
      error: job.error?.message ?? null,
    })
  }

  const outcome = await runNextStage(params.id)
  const meta = progressFor(outcome.status)
  return NextResponse.json({
    status: outcome.status,
    progress: meta.progress,
    stageLabel: meta.label,
    error: outcome.error ?? null,
  })
}
