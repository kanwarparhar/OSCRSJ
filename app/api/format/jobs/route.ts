// POST /api/format/jobs — create a formatting job (Sushant, Session C).
// Unauthenticated: email only. Rate-limited per email + IP. Returns
// signed upload URLs; the client PUTs the manuscript (+ figures) then calls
// /advance. Runs on Node (the pipeline uses pizzip/@xmldom).

import { NextRequest, NextResponse } from 'next/server'
import { getJournal, ARTICLE_TYPE_LABELS } from '@/lib/formatting/journalList'
import { SCHEMA_VERSION } from '@/lib/formatting/rulesSchema'
import { createJob, checkRateLimit, createSignedUpload, writeJobMeta } from '@/lib/formatting/pipeline/jobs'
import { storagePaths, MAX_FIGURES } from '@/lib/formatting/pipeline/api'
import { appendRowToSheet } from '@/lib/integrations/googleSheets'
import { CONSENT_VERSION, CONSENT_SCOPE } from '@/lib/studio/consent'

/** Tab in the shared "OSCRSJ Form Submissions" Google Sheet. */
const FORMATTER_SHEET_TAB = 'Formatter Submissions'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function clientIp(req: NextRequest): string | null {
  const xff = req.headers.get('x-forwarded-for')
  return xff ? xff.split(',')[0].trim() : req.headers.get('x-real-ip')
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }
  const {
    email,
    journalId,
    articleType,
    figureCount,
    figureFilenames,
    manuscriptFilename,
    marketingConsent,
  } = body as Record<string, unknown>

  if (typeof email !== 'string' || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: 'A valid email is required.' }, { status: 400 })
  }
  // Consent is REQUIRED to use the Studio (Kanwar directive, 2026-07-25) and is
  // gated here as well as in the UI, so a hand-rolled POST cannot create a job
  // carrying an address that never agreed to anything. The consent VERSION is
  // stamped server-side from lib/studio/consent.ts rather than accepted from
  // the client: a client-supplied version could claim agreement to wording the
  // user never saw, which is precisely the thing the version exists to prove.
  if (marketingConsent !== true) {
    return NextResponse.json(
      { error: 'Please accept the email consent to use Submission Studio.' },
      { status: 400 },
    )
  }
  const rules = typeof journalId === 'string' ? getJournal(journalId) : null
  if (!rules) {
    return NextResponse.json({ error: 'Unknown target journal.' }, { status: 400 })
  }
  if (typeof articleType !== 'string' || !(articleType in ARTICLE_TYPE_LABELS)) {
    return NextResponse.json({ error: 'Select a valid article type.' }, { status: 400 })
  }
  // Eligibility is gated in the UI but was NOT gated here, so the API happily
  // accepted (and billed a pipeline run for) a case report "for" Injury, whose
  // own rule file records that Injury does not accept case reports. Same source
  // of truth the Finder and registry-meta's JournalSummary.articleTypes use.
  const typeLabel = ARTICLE_TYPE_LABELS[articleType as keyof typeof ARTICLE_TYPE_LABELS]
  if (!(rules.article_types as readonly string[]).includes(articleType)) {
    return NextResponse.json(
      { error: `${rules.identity.name} does not accept ${typeLabel} submissions.` },
      { status: 400 },
    )
  }
  const ip = clientIp(req)
  const rl = await checkRateLimit(email, ip)
  if (!rl.ok) {
    return NextResponse.json({ error: rl.reason }, { status: 429 })
  }

  const job = await createJob({
    email,
    journalId: rules.identity.slug,
    articleType,
    ip,
    rulesVersion: SCHEMA_VERSION,
    consent: { version: CONSENT_VERSION, scope: CONSENT_SCOPE },
  })
  if (!job) {
    return NextResponse.json({ error: 'Could not create the job. Try again.' }, { status: 500 })
  }

  // Persist the original filename (names the outputs at render/download time).
  const originalFilename =
    typeof manuscriptFilename === 'string' && manuscriptFilename.trim()
      ? manuscriptFilename.trim().slice(0, 255)
      : null
  const nFigs = Math.min(Math.max(0, Number(figureCount) || 0), MAX_FIGURES)
  // The author's own figure filenames drive the report-only format check; the
  // storage path hardcodes a `.img` extension so it cannot tell us the format.
  const figureNames = Array.isArray(figureFilenames)
    ? figureFilenames
        .filter((n): n is string => typeof n === 'string' && n.trim() !== '')
        .slice(0, MAX_FIGURES)
        .map((n) => n.trim().slice(0, 255))
    : []
  await writeJobMeta(job.id, {
    originalFilename,
    figureCount: nFigs,
    figureFilenames: figureNames,
  })

  const manuscriptUpload = await createSignedUpload(storagePaths.input(job.id))
  if (!manuscriptUpload) {
    return NextResponse.json({ error: 'Could not prepare the upload. Try again.' }, { status: 500 })
  }

  const figureUploads = []
  for (let i = 0; i < nFigs; i++) {
    const u = await createSignedUpload(storagePaths.figure(job.id, i, 'img'))
    if (u) figureUploads.push(u)
  }

  // Running submission log → Google Sheet ("Formatter Submissions" tab).
  // Fire-and-forget: appendRowToSheet never throws and a Sheets outage must
  // not block the job. Column order must match docs/google-sheets-apps-script.gs.
  void appendRowToSheet({
    sheetName: FORMATTER_SHEET_TAB,
    row: [
      new Date().toISOString(),
      job.id,
      email,
      originalFilename ?? '',
      rules.identity.name,
      typeLabel ?? articleType,
      nFigs,
      ip ?? '',
      'yes',
      CONSENT_VERSION,
      CONSENT_SCOPE,
    ],
  })

  return NextResponse.json({ jobId: job.id, manuscriptUpload, figureUploads })
}
