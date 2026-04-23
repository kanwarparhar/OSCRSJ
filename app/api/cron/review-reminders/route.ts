// ============================================================
// GET /api/cron/review-reminders
// ============================================================
// Daily Vercel Cron entry point (14:00 UTC — vercel.json). Scans
// review_invitations rows where status = 'accepted' and fires one
// of three reminder kinds depending on the deadline window:
//
//   - 'ten_day'  → deadline is 9–11 days away, reminder_ten_day_sent_at IS NULL
//   - 'five_day' → deadline is 4–6 days away,  reminder_five_day_sent_at IS NULL
//   - 'overdue'  → deadline is in the past,    reminder_overdue_sent_at IS NULL
//
// After each successful send, the matching timestamp column is
// set to now() so subsequent cron ticks skip the row.
//
// Gated by a bearer-header check against CRON_SECRET — this is
// the only auth on the endpoint. Without the header the endpoint
// returns 401. Vercel Cron injects the header automatically; any
// ad-hoc invocation must include it explicitly (e.g. the local
// smoke test with curl).
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { sendEmail } from '@/lib/email/resend'
import {
  renderReviewReminder,
  getReviewReminderSubject,
  type ReviewReminderKind,
} from '@/lib/email/templates/reviewReminder'
import type {
  ReviewInvitationRow,
  ManuscriptRow,
} from '@/lib/types/database'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const header = req.headers.get('authorization') || ''
  return header === `Bearer ${secret}`
}

function siteUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    'https://www.oscrsj.com'
  return raw.replace(/\/$/, '')
}

function formatDeadline(iso: string | null): string {
  if (!iso) return 'Not specified'
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  } catch {
    return iso
  }
}

function daysBetween(from: Date, to: Date): number {
  const ms = to.getTime() - from.getTime()
  return Math.round(ms / (1000 * 60 * 60 * 24))
}

const TIMESTAMP_COLUMN: Record<ReviewReminderKind, string> = {
  ten_day: 'reminder_ten_day_sent_at',
  five_day: 'reminder_five_day_sent_at',
  overdue: 'reminder_overdue_sent_at',
}

async function loadManuscriptTitles(
  admin: ReturnType<typeof createAdminClient>,
  manuscriptIds: string[]
): Promise<Map<string, ManuscriptRow>> {
  const out = new Map<string, ManuscriptRow>()
  if (manuscriptIds.length === 0) return out
  const unique = Array.from(new Set(manuscriptIds))
  const { data } = await admin
    .from('manuscripts')
    .select('*')
    .in('id', unique)
  for (const row of (data as ManuscriptRow[]) || []) {
    out.set(row.id, row)
  }
  return out
}

async function fireReminder(
  admin: ReturnType<typeof createAdminClient>,
  invitation: ReviewInvitationRow,
  manuscript: ManuscriptRow | null,
  kind: ReviewReminderKind
): Promise<boolean> {
  const reviewerEmail = invitation.reviewer_email
  if (!reviewerEmail) return false

  const firstName = invitation.reviewer_first_name || 'Reviewer'
  const manuscriptTitle = manuscript?.title || '(untitled manuscript)'
  const reviewFormUrl = `${siteUrl()}/review/${invitation.review_token}/form`

  const now = new Date()
  const deadlineDate = invitation.deadline ? new Date(invitation.deadline) : now
  const daysRemaining = daysBetween(now, deadlineDate)

  const { html, text } = renderReviewReminder({
    kind,
    firstName,
    manuscriptTitle,
    deadlineLabel: formatDeadline(invitation.deadline),
    daysRemaining,
    reviewFormUrl,
  })

  const { error: sendErr } = await sendEmail({
    to: reviewerEmail,
    subject: getReviewReminderSubject(kind, manuscriptTitle),
    html,
    text,
    emailType: `review_reminder_${kind}`,
    manuscriptId: invitation.manuscript_id,
  })

  if (sendErr) return false

  const column = TIMESTAMP_COLUMN[kind]
  const { error: updateErr } = await (
    admin.from('review_invitations') as any
  )
    .update({ [column]: new Date().toISOString() })
    .eq('id', invitation.id)

  if (updateErr) {
    // The email went out but we failed to record it. Log and let the
    // next cron run potentially resend — better than silent duplicate
    // sends going unnoticed. Audit log captures the anomaly.
    try {
      await (admin.from('audit_logs') as any).insert({
        action: 'review_reminder_record_failed',
        resource_type: 'review_invitation',
        resource_id: invitation.id,
        details: {
          kind,
          invitation_id: invitation.id,
          error: updateErr.message,
        },
      })
    } catch {
      // swallow
    }
    return true // email still counted as sent for observability
  }

  try {
    await (admin.from('audit_logs') as any).insert({
      action: 'review_reminder_sent',
      resource_type: 'review_invitation',
      resource_id: invitation.id,
      details: {
        kind,
        invitation_id: invitation.id,
      },
    })
  } catch {
    // swallow
  }

  return true
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const nowIso = new Date().toISOString()

  // Reasonable bounded windows keep the scan small even at scale.
  // ±1 day buffer on the ten/five windows gives us slack for cron
  // retries or daily jitter without emailing twice (the timestamp
  // column is still the authoritative "already sent" gate).
  const nineDaysIso = new Date(
    Date.now() + 9 * 24 * 60 * 60 * 1000
  ).toISOString()
  const elevenDaysIso = new Date(
    Date.now() + 11 * 24 * 60 * 60 * 1000
  ).toISOString()
  const fourDaysIso = new Date(
    Date.now() + 4 * 24 * 60 * 60 * 1000
  ).toISOString()
  const sixDaysIso = new Date(
    Date.now() + 6 * 24 * 60 * 60 * 1000
  ).toISOString()

  const [tenDayRes, fiveDayRes, overdueRes] = await Promise.all([
    admin
      .from('review_invitations')
      .select('*')
      .eq('status', 'accepted')
      .is('reminder_ten_day_sent_at', null)
      .gte('deadline', nineDaysIso)
      .lte('deadline', elevenDaysIso),
    admin
      .from('review_invitations')
      .select('*')
      .eq('status', 'accepted')
      .is('reminder_five_day_sent_at', null)
      .gte('deadline', fourDaysIso)
      .lte('deadline', sixDaysIso),
    admin
      .from('review_invitations')
      .select('*')
      .eq('status', 'accepted')
      .is('reminder_overdue_sent_at', null)
      .lt('deadline', nowIso),
  ])

  const tenDayRows = (tenDayRes.data as ReviewInvitationRow[]) || []
  const fiveDayRows = (fiveDayRes.data as ReviewInvitationRow[]) || []
  const overdueRows = (overdueRes.data as ReviewInvitationRow[]) || []

  const manuscripts = await loadManuscriptTitles(admin, [
    ...tenDayRows.map((r) => r.manuscript_id),
    ...fiveDayRows.map((r) => r.manuscript_id),
    ...overdueRows.map((r) => r.manuscript_id),
  ])

  let tenDaySent = 0
  for (const row of tenDayRows) {
    const sent = await fireReminder(
      admin,
      row,
      manuscripts.get(row.manuscript_id) || null,
      'ten_day'
    )
    if (sent) tenDaySent += 1
  }

  let fiveDaySent = 0
  for (const row of fiveDayRows) {
    const sent = await fireReminder(
      admin,
      row,
      manuscripts.get(row.manuscript_id) || null,
      'five_day'
    )
    if (sent) fiveDaySent += 1
  }

  let overdueSent = 0
  for (const row of overdueRows) {
    const sent = await fireReminder(
      admin,
      row,
      manuscripts.get(row.manuscript_id) || null,
      'overdue'
    )
    if (sent) overdueSent += 1
  }

  return NextResponse.json({
    ten_day_sent: tenDaySent,
    five_day_sent: fiveDaySent,
    overdue_sent: overdueSent,
    scanned: {
      ten_day: tenDayRows.length,
      five_day: fiveDayRows.length,
      overdue: overdueRows.length,
    },
    timestamp: nowIso,
  })
}
