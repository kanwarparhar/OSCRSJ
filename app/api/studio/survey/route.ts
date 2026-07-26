// POST /api/studio/survey — record a feedback survey and, if the address has
// spent its free runs and has never reset before, hand back a fresh allowance.
//
// This is the transaction at the centre of the free period: three more runs in
// exchange for a straight answer about whether the tool worked. Two properties
// matter more than anything else here, and the code is shaped around them.
//
//   1. THE RESPONSE IS SAVED EVEN IF THE RESET FAILS. The feedback is the thing
//      we actually want; the reset is what we pay for it. Writing them in the
//      other order, or making the write conditional on the grant, means a user
//      who already used their reset has their answers thrown away for no reason.
//      So: validate, insert the response, THEN attempt the grant, then reflect
//      the outcome back honestly.
//
//   2. DOUBLE SUBMIT MUST NOT GRANT TWICE. A slow response plus an impatient
//      second click is the normal case, not the edge case. grantSurveyReset()
//      guards this with a conditional update rather than a read-then-write, so
//      the second caller matches zero rows and is told the truth.
//
// Validation runs server-side from the same lib/studio/survey.ts definition the
// form renders from. The client validates too, purely so errors appear inline
// without a round trip; this is the copy that decides.

import { NextRequest, NextResponse } from 'next/server'
import {
  SURVEY_VERSION,
  validateSurvey,
  promotedColumns,
  type SurveyAnswers,
} from '@/lib/studio/survey'
import { grantSurveyReset, recordSurveyWithoutReset, getQuotaStatus } from '@/lib/studio/quota'
import { createAdminClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

function clientIp(req: NextRequest): string | null {
  const xff = req.headers.get('x-forwarded-for')
  return xff ? xff.split(',')[0].trim() : req.headers.get('x-real-ip')
}

/**
 * Per-IP submission cap, in memory.
 *
 * The read-only quota lookup is throttled, so leaving the WRITE unthrottled
 * was the wrong way round: this endpoint inserts rows, mutates allowance
 * state and appends to a Google Sheet. Two abuses it closes:
 *
 *   * Spending a known-locked third party's one lifetime reset by submitting
 *     garbage under their address. They get runs they did not ask for, and
 *     their real feedback can then never buy anything.
 *   * Flooding studio_survey_responses and the Sheet, which poisons exactly
 *     the dataset this whole exercise exists to collect.
 *
 * Same per-warm-instance caveat as lib/finder/rateLimit.ts. A genuine person
 * fills this in once or twice, so the cap can be tight without ever being felt.
 */
const SUBMIT_WINDOW_MS = 60 * 60 * 1000
const SUBMIT_MAX_PER_WINDOW = 8
const submissions = new Map<string, number[]>()

function submitThrottled(ip: string | null): boolean {
  if (!ip) return false
  const now = Date.now()
  const cutoff = now - SUBMIT_WINDOW_MS
  const hits = (submissions.get(ip) ?? []).filter((t) => t > cutoff)
  if (hits.length >= SUBMIT_MAX_PER_WINDOW) {
    submissions.set(ip, hits)
    return true
  }
  hits.push(now)
  submissions.set(ip, hits)
  if (submissions.size > 5000) {
    for (const k of Array.from(submissions.keys())) {
      const v = submissions.get(k)
      if (v && v.every((t: number) => t <= cutoff)) submissions.delete(k)
    }
  }
  return false
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }
  const { email, answers, followUpOk, durationSeconds } = body as Record<string, unknown>

  if (typeof email !== 'string' || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: 'A valid email is required.' }, { status: 400 })
  }
  if (!answers || typeof answers !== 'object' || Array.isArray(answers)) {
    return NextResponse.json({ error: 'No answers were submitted.' }, { status: 400 })
  }
  if (submitThrottled(clientIp(req))) {
    return NextResponse.json(
      { error: 'Too many submissions from this network. Please try again later.' },
      { status: 429 },
    )
  }

  const validation = validateSurvey(answers as SurveyAnswers)
  if (!validation.ok || !validation.clean) {
    // Field-level errors go back keyed by question id so the form can put each
    // message under the question it belongs to, rather than showing one banner
    // that makes the user hunt for what they missed.
    return NextResponse.json(
      { error: 'Some answers need another look.', fieldErrors: validation.errors },
      { status: 400 },
    )
  }

  const clean = validation.clean
  const ip = clientIp(req)
  const now = new Date()
  const admin = createAdminClient()

  // Clamp rather than reject: the duration is advisory (see migration 031) and
  // a nonsense value from a tab left open overnight should not cost someone
  // their feedback submission.
  const rawDuration = Number(durationSeconds)
  const duration =
    Number.isFinite(rawDuration) && rawDuration >= 0 ? Math.min(Math.round(rawDuration), 86_400) : null

  const promoted = promotedColumns(clean)

  // Was this address actually locked out? Determines whether a reset is owed.
  // Read BEFORE the grant, because the grant changes the answer.
  let wasLocked = false
  let couldUnlock = false
  let quotaUnknown = false
  try {
    const before = await getQuotaStatus(email, now, admin)
    wasLocked = before.locked
    couldUnlock = before.canUnlockWithSurvey
  } catch {
    // A quota read failure must not eat the feedback, so we still store the
    // response and grant nothing. But it must NOT be reported as the happy
    // "you still have runs left" path: that told a locked-out user they had
    // zero runs AND that nothing was spent, with no prompt to retry. Flag it
    // and say plainly that the balance could not be checked.
    quotaUnknown = true
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const responses = admin.from('studio_survey_responses') as any
  const { data: inserted, error: insertError } = await responses
    .insert({
      email: email.toLowerCase().trim(),
      survey_version: SURVEY_VERSION,
      responses: clean,
      usefulness: promoted.usefulness,
      granted_reset: false, // corrected below if the grant lands
      follow_up_ok: followUpOk === true,
      duration_seconds: duration,
      ip,
    })
    .select('id')
    .single()

  if (insertError || !inserted?.id) {
    return NextResponse.json(
      { error: 'We could not save your answers. Please try again.' },
      { status: 500 },
    )
  }

  const surveyId = inserted.id as string

  // Grant only when the address is actually out of runs AND has a reset left.
  // Someone who fills the survey in early keeps their remaining runs and their
  // one reset for later; silently burning the reset because they were helpful
  // would be a trap.
  let granted = false
  let grantMessage: string | null = null
  if (wasLocked && couldUnlock) {
    try {
      const result = await grantSurveyReset(email, surveyId, now, admin)
      granted = result.granted
      grantMessage = result.reason ?? null
      if (granted) {
        await responses.update({ granted_reset: true }).eq('id', surveyId)
      }
    } catch {
      // The response is already saved. Never turn a post-save fault into a 500,
      // because the client's retry prompt would ask the user to resubmit work
      // that is already stored and might already have been paid for.
      grantMessage =
        'We saved your answers but could not restore your runs just now. Please try again in a moment.'
    }
  } else if (!quotaUnknown) {
    try {
      await recordSurveyWithoutReset(email, now, admin)
    } catch {
      // Bookkeeping only. The response row is the deliverable and it is safe.
    }
  }

  // NO Google Sheets push from here (Kanwar directive, 2026-07-26): the survey
  // data and its analytics must live in the SAME spreadsheet as the Admin
  // Manuscript Hub, and the Hub is pull-based -- docs/admin-manuscript-hub.gs
  // reads studio_survey_responses straight out of Supabase on its hourly
  // trigger and writes both the raw dump and the analytics tab there.
  //
  // Pushing a row here as well would put half the survey record in a second
  // spreadsheet ("OSCRSJ Form Submissions") on a different refresh path, which
  // is exactly the split-brain the directive is closing. Supabase is the
  // system of record either way; the Hub is the one place that renders it.

  let status = null
  try {
    status = await getQuotaStatus(email, now, admin)
  } catch {
    // Non-fatal: the submission succeeded, we just cannot echo the new balance.
  }

  return NextResponse.json({
    ok: true,
    granted,
    // Distinguishes "you got your runs" from "thanks, but this address already
    // used its reset" from "thanks, you still have runs left". The client shows
    // a different confirmation for each; one generic thank-you would leave
    // someone who expected three runs wondering whether it worked.
    outcome: granted
      ? 'reset_granted'
      : quotaUnknown
        ? 'recorded_quota_unknown'
        : wasLocked
          ? 'reset_already_used'
          : 'recorded_runs_remaining',
    message: grantMessage,
    quota: status
      ? {
          used: status.used,
          limit: status.limit,
          remaining: status.remaining,
          locked: status.locked,
        }
      : null,
  })
}
