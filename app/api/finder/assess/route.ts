// POST /api/finder/assess — create a Finder v2 manuscript-assessment job.
//
// Mirrors POST /api/format/jobs deliberately: same rate limits, same consent
// gate, same signed-upload handshake, same storage layout. That reuse is not
// laziness — storing the upload at formatting/<jobId>/input/manuscript.docx is
// what puts Finder uploads inside the EXISTING 7-day retention reaper with no
// changes to it (verified by reading /api/cron/cleanup-preview-artifacts: it
// selects formatting_jobs rows by updated_at with no kind filter and derives
// every path from the row id). A bespoke upload path would have quietly sat
// outside the only retention promise the Studio makes in writing.
//
// The job row is tagged kind='finder_assess' (migration 030).

import { NextRequest, NextResponse } from 'next/server'
import { ARTICLE_TYPES } from '@/lib/formatting/rulesSchema'
import { SCHEMA_VERSION } from '@/lib/formatting/rulesSchema'
import { createJob, checkRateLimit, createSignedUpload, writeJobMeta } from '@/lib/formatting/pipeline/jobs'
import { storagePaths } from '@/lib/formatting/pipeline/api'
import { CONSENT_VERSION, CONSENT_SCOPE } from '@/lib/studio/consent'
import {
  markJobKind,
  deleteJobRow,
  FINDER_ASSESS_KIND,
  parseSelfAssessment,
  writeAssessInput,
} from '@/lib/finder/assessJob'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

function clientIp(req: NextRequest): string | null {
  const xff = req.headers.get('x-forwarded-for')
  return xff ? xff.split(',')[0].trim() : req.headers.get('x-real-ip')
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }
  const { email, articleType, subspecialty, selfAssessment, manuscriptFilename, marketingConsent } =
    body as Record<string, unknown>

  if (typeof email !== 'string' || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: 'A valid email is required.' }, { status: 400 })
  }
  // Same consent gate as the formatter (Kanwar directive, 2026-07-25). This path
  // collects an address, so it collects it under exactly the same disclosed
  // terms; leaving it ungated would make the Studio's data-handling copy false
  // again and would put addresses on the list with no recorded agreement.
  if (marketingConsent !== true) {
    return NextResponse.json(
      { error: 'Please accept the email consent to use Submission Studio.' },
      { status: 400 },
    )
  }
  if (typeof articleType !== 'string' || !(ARTICLE_TYPES as readonly string[]).includes(articleType)) {
    return NextResponse.json({ error: 'Select a valid article type.' }, { status: 400 })
  }

  const ip = clientIp(req)
  const rl = await checkRateLimit(email, ip)
  if (!rl.ok) return NextResponse.json({ error: rl.reason }, { status: 429 })

  const job = await createJob({
    email,
    // formatting_jobs.journal_id is NOT NULL and an assessment has no target
    // journal — that is the whole point of the Finder. A documented sentinel is
    // honest here; a real slug would be a fabricated target.
    journalId: FINDER_ASSESS_KIND,
    articleType,
    ip,
    rulesVersion: SCHEMA_VERSION,
    consent: { version: CONSENT_VERSION, scope: CONSENT_SCOPE },
  })
  if (!job) {
    return NextResponse.json({ error: 'Could not create the job. Try again.' }, { status: 500 })
  }

  const kindOk = await markJobKind(job.id)
  if (!kindOk) {
    // Roll the row back rather than leaving an untagged orphan that burns a
    // rate-limit slot and reads as a formatter job in the metrics.
    await deleteJobRow(job.id)
    return NextResponse.json(
      {
        error:
          'The assessment service is not fully set up yet (database migration 030_finder_assess_kind.sql has not been run). Please try again later.',
      },
      { status: 503 },
    )
  }

  const originalFilename =
    typeof manuscriptFilename === 'string' && manuscriptFilename.trim()
      ? manuscriptFilename.trim().slice(0, 255)
      : null
  await writeJobMeta(job.id, { originalFilename, figureCount: 0, figureFilenames: [] })

  // The author's own answers + scope live beside the upload, not in the job row:
  // they are inputs to the ladder, and they are reaped with the upload.
  await writeAssessInput(job.id, {
    selfAssessment: parseSelfAssessment(selfAssessment),
    subspecialty: typeof subspecialty === 'string' ? subspecialty : null,
  })

  const manuscriptUpload = await createSignedUpload(storagePaths.input(job.id))
  if (!manuscriptUpload) {
    return NextResponse.json({ error: 'Could not prepare the upload. Try again.' }, { status: 500 })
  }

  return NextResponse.json({ jobId: job.id, manuscriptUpload })
}
