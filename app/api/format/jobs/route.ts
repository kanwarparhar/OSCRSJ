// POST /api/format/jobs — create a formatting job (Sushant, Session C).
// Unauthenticated: email only. Per-email weekly allowance + per-IP backstop. Returns
// signed upload URLs; the client PUTs the manuscript (+ figures) then calls
// /advance. Runs on Node (the pipeline uses pizzip/@xmldom).

import { NextRequest, NextResponse } from 'next/server'
import { getJournal, ARTICLE_TYPE_LABELS } from '@/lib/formatting/journalList'
import { SCHEMA_VERSION, type ArticleType } from '@/lib/formatting/rulesSchema'
import { createJob, checkRateLimit, createSignedUpload, writeJobMeta } from '@/lib/formatting/pipeline/jobs'
import { storagePaths, MAX_FIGURES } from '@/lib/formatting/pipeline/api'
import { parseDeclaredDesign } from '@/lib/formatting/studyDesign'
import { appendRowToSheet } from '@/lib/integrations/googleSheets'
import { CONSENT_SCOPE } from '@/lib/studio/consent'
import { STUDIO_TERMS_VERSION, MARKETING_CONSENT_VERSION } from '@/lib/studio/terms'
import { checkStudioQuota, isFreeJournalRun } from '@/lib/studio/quota'

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
    studyDesign,
    figureCount,
    figureFilenames,
    manuscriptFilename,
    termsAccepted,
    marketingConsent,
  } = body as Record<string, unknown>

  if (typeof email !== 'string' || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: 'A valid email is required.' }, { status: 400 })
  }
  // Accepting the Studio Terms is REQUIRED and is gated here as well as in the
  // UI, so a hand-rolled POST cannot create a job carrying an address that
  // never agreed to anything. Versions are stamped server-side rather than
  // accepted from the client: a client-supplied version could claim agreement
  // to wording the user never saw, which is precisely the thing a version
  // string exists to prove.
  if (termsAccepted !== true) {
    return NextResponse.json(
      { error: 'Please accept the Submission Studio Terms and Conditions to continue.' },
      { status: 400 },
    )
  }
  // Marketing consent is SEPARATE and OPTIONAL (Kanwar directive, 2026-07-26).
  // Declining must cost the user nothing, so there is deliberately no gate
  // here and no penalty anywhere downstream. Recording false is the point:
  // a marketing_consent column where everyone is true carries no information
  // and cannot be relied on when someone asks who agreed to what.
  const wantsMarketing = marketingConsent === true
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

  // Per-email lifetime allowance first, then the per-network daily cap.
  // Order matters for the message the user sees: someone who has genuinely
  // spent their three runs should be told about the survey, not told their
  // office network is busy. The network cap is the backstop, so it speaks last.
  // OSCRSJ runs bypass the gate outright (Kanwar directive, 2026-07-26). Not a
  // larger allowance -- an actual bypass, so an address that has spent every run
  // can still format a manuscript for us. The check is BEFORE checkStudioQuota
  // rather than inside it because a locked-out address must not be refused on
  // the way to reading its own status; countUsage separately skips these rows,
  // so the run is invisible to the allowance in both directions.
  const quota = isFreeJournalRun(rules.identity.slug)
    ? ({ ok: true } as const)
    : await checkStudioQuota(email)
  if (!quota.ok) {
    if (quota.code === 'quota_unavailable') {
      return NextResponse.json({ error: quota.reason }, { status: 503 })
    }
    return NextResponse.json(
      {
        error: quota.reason,
        code: quota.code,
        // The client branches on `canUnlockWithSurvey` to decide between
        // showing the unlock call to action and showing the "that was your
        // reset" message, so it is returned rather than re-derived there.
        quota: quota.status
          ? {
              used: quota.status.used,
              limit: quota.status.limit,
              remaining: quota.status.remaining,
              canUnlockWithSurvey: quota.status.canUnlockWithSurvey,
            }
          : undefined,
      },
      { status: 429 },
    )
  }

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
    consent: wantsMarketing
      ? { version: MARKETING_CONSENT_VERSION, scope: CONSENT_SCOPE }
      : undefined,
    terms: { version: STUDIO_TERMS_VERSION },
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
    // Validated against the choices for THIS article type, so a hand-rolled POST
    // cannot pair "original research" with "case report" and get CARE applied to
    // a study that is not a case report. Anything unrecognised becomes null,
    // which means no appraisal -- never a fallback design.
    studyDesign: parseDeclaredDesign(studyDesign, articleType as ArticleType),
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
      wantsMarketing ? 'yes' : 'no',
      wantsMarketing ? MARKETING_CONSENT_VERSION : '',
      wantsMarketing ? CONSENT_SCOPE : '',
    ],
  })

  return NextResponse.json({ jobId: job.id, manuscriptUpload, figureUploads })
}
