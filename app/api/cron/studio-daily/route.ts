// ============================================================
// GET /api/cron/studio-daily
// ============================================================
// The Submission Studio morning job. Runs once per day for the PREVIOUS local
// day (America/Los_Angeles) and does four things:
//
//   1. Computes the day's Studio metrics from formatting_jobs + finder_queries.
//   2. Reads the DeepSeek account balance, so actual spend can be differenced
//      against yesterday's snapshot (DeepSeek publishes no usage-history API;
//      see lib/studio/deepseekBalance.ts).
//   3. Upserts a snapshot row.
//   4. Emails the brief.
//
// It does NOT write to Google Sheets. The two Studio tabs live in the "OSCRSJ
// — Admin Manuscript Hub" spreadsheet (Kanwar's call, 2026-07-25), whose Apps
// Script already pulls straight from Supabase on an hourly trigger and now
// builds "Studio Daily Metrics" and "Studio Marketing List" the same way it
// builds the manuscript tabs. That is strictly better than pushing rows from
// here: the numbers stay live between cron runs, the marketing list dedupes
// from a query instead of needing a whole-tab replace, and a cron outage shows
// as a stale history table rather than as a tab that quietly stops updating.
// This job owns the daily snapshot and the email; the sheet owns presentation.
//
// NOT registered in vercel.json. It is invoked from the daily-digest cron tick
// (13:00 UTC = 06:00 America/Los_Angeles), deliberately: vercel.json already
// declares five crons and the plan's cron allowance is unverified, so Session
// 98 set the precedent of extending an existing tick rather than claiming a
// sixth slot. The route still exists standalone so it can be run by hand, and
// so registering it later is a two-line vercel.json change if the allowance
// turns out to be there.
//
// Gated by Bearer ${CRON_SECRET}, same convention as every other cron.
//
// Idempotent by construction: the snapshot is keyed on `day` and upserted, the
// marketing tab is replaced rather than appended, and the metrics tab dedupes
// on the date column Apps Script side. A re-run for the same day corrects the
// day rather than duplicating it. `?day=YYYY-MM-DD` backfills a specific day;
// `?email=0` computes and stores without sending.
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { sendEmail } from '@/lib/email/resend'
import { getDeepSeekBalance } from '@/lib/studio/deepseekBalance'
import {
  computeStudioDailyMetrics,
  yesterdayLocal,
  STUDIO_TZ,
  type StudioDailyMetrics,
} from '@/lib/studio/metrics'
import {
  renderStudioDailyBrief,
  getStudioDailyBriefSubject,
} from '@/lib/email/templates/studioDailyBrief'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/

/** Same recipient ladder as the editorial daily digest. */
function briefRecipient(): string {
  return (
    process.env.DIGEST_RECIPIENT_EMAIL ||
    process.env.EMAIL_REPLY_TO ||
    'oscrsjournal@gmail.com'
  )
}

export interface StudioDailyResult {
  ok: boolean
  day: string
  metrics?: StudioDailyMetrics
  /** Deduplicated consenting addresses at snapshot time. The list itself is
   *  rendered by the Admin Manuscript Hub sheet, not written from here. */
  marketingContacts?: number
  emailed: boolean
  emailError?: string | null
  error?: string
}

/**
 * The whole morning job. Exported so the daily-digest cron can call it inline
 * without an HTTP hop (and without needing its own bearer round trip).
 * Never throws: a failure here must not take down the editorial digest.
 */
export async function runStudioDaily(opts?: {
  day?: string
  sendBrief?: boolean
}): Promise<StudioDailyResult> {
  const day = opts?.day && DAY_RE.test(opts.day) ? opts.day : yesterdayLocal()
  const sendBrief = opts?.sendBrief !== false
  const result: StudioDailyResult = { ok: false, day, emailed: false }

  try {
    const admin = createAdminClient()
    const balance = await getDeepSeekBalance()
    const metrics = await computeStudioDailyMetrics({ admin, day, balance, timeZone: STUDIO_TZ })
    result.metrics = metrics

    // ---- Snapshot (idempotent on `day`) ----
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (admin.from('studio_daily_metrics') as any).upsert(
        {
          day,
          metrics,
          deepseek_balance_usd: metrics.balanceUsd,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'day' },
      )
    } catch (err) {
      console.error('[studio-daily] snapshot upsert failed:', err)
    }

    result.marketingContacts = metrics.cumulativeMarketingContacts

    // ---- Email ----
    if (sendBrief) {
      const { html, text } = renderStudioDailyBrief(metrics)
      const { error: sendErr } = await sendEmail({
        to: briefRecipient(),
        subject: getStudioDailyBriefSubject(metrics),
        html,
        text,
        emailType: 'studio_daily_brief',
      })
      result.emailed = !sendErr
      result.emailError = sendErr ?? null
    }

    // ---- Audit ----
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (admin.from('audit_logs') as any).insert({
        action: 'studio_daily_brief',
        resource_type: 'cron',
        resource_id: null,
        details: {
          day,
          jobs_started: metrics.jobsStarted,
          jobs_completed: metrics.jobsCompleted,
          finder_queries: metrics.finderQueries,
          cost_usd_est: metrics.deepseekCostUsdEst,
          balance_usd: metrics.balanceUsd,
          marketing_contacts: metrics.cumulativeMarketingContacts,
          emailed: result.emailed,
        },
      })
    } catch {
      // swallow
    }

    result.ok = true
    return result
  } catch (err) {
    console.error('[studio-daily] failed:', err)
    result.error = err instanceof Error ? err.message : String(err)
    return result
  }
}

export async function GET(req: NextRequest) {
  const expected = process.env.CRON_SECRET
  if (!expected) {
    return NextResponse.json(
      { error: 'CRON_SECRET not configured on this deployment.' },
      { status: 503 },
    )
  }
  const auth = req.headers.get('authorization') || ''
  const got = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  if (got !== expected) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  const url = new URL(req.url)
  const day = url.searchParams.get('day') ?? undefined
  const sendBrief = url.searchParams.get('email') !== '0'

  const result = await runStudioDaily({ day, sendBrief })
  return NextResponse.json(result, { status: result.ok ? 200 : 500 })
}
