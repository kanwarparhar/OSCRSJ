// ============================================================
// GET /api/cron/daily-digest
// ============================================================
// Daily Vercel Cron entry point (13:00 UTC — vercel.json). Scans the
// last 24 hours of editorial activity across:
//
//   - users (registrations)
//   - manuscripts (status flipped to submitted via submission_date)
//   - manuscript_revisions (revisions received)
//   - reviewer_applications (reviewer intake form)
//   - reviews (is_draft = false flips, scored by submitted_date)
//
// Sends ONE email to INTERNAL_EDITORIAL_EMAIL with all five sections
// inlined so triage can happen from the inbox without the dashboard.
// Empty 24-hour windows skip the send entirely (no zero-noise emails)
// — the audit_logs entry distinguishes daily_digest_sent from
// daily_digest_skipped_empty.
//
// Gated by a bearer-header check against CRON_SECRET (same secret as
// /api/cron/review-reminders + /api/cron/revision-reminders). Without
// the header the endpoint returns 401. Vercel Cron injects the header
// automatically; ad-hoc invocation must include it explicitly.
//
// Time window: rolling 24 hours from now() backwards, NOT calendar-day
// based. Cron tick at 13:00 UTC daily means the window is the prior
// day's 13:00 UTC → today's 13:00 UTC. Drift across DST transitions is
// negligible (1h skew once a year).
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { runStudioDaily } from '@/app/api/cron/studio-daily/route'
import { sendEmail } from '@/lib/email/resend'
import {
  renderDailyDigest,
  getDailyDigestSubject,
  type DigestRegistration,
  type DigestSubmission,
  type DigestRevision,
  type DigestReviewerApplication,
  type DigestReviewSubmitted,
} from '@/lib/email/templates/dailyDigest'
import type {
  UserRow,
  ManuscriptRow,
  ManuscriptRevisionRow,
  ReviewerApplicationRow,
  ReviewRow,
  ReviewInvitationRow,
} from '@/lib/types/database'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Editorial digest recipient. Override via DIGEST_RECIPIENT_EMAIL env
// var, falling back to EMAIL_REPLY_TO (the journal Reply-To inbox the
// rest of the email pipeline routes replies to), then to the journal's
// primary Gmail (`oscrsjournal@gmail.com`). Same fallback ladder pattern
// as lib/reviewer/actions.ts:61. Flip via env var when the
// `editorial@oscrsj.com` Google Workspace inbox is provisioned — no
// code change needed.
function digestRecipient(): string {
  return (
    process.env.DIGEST_RECIPIENT_EMAIL ||
    process.env.EMAIL_REPLY_TO ||
    'oscrsjournal@gmail.com'
  )
}

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const header = req.headers.get('authorization') || ''
  return header === `Bearer ${secret}`
}

const HUMAN_RECOMMENDATION: Record<string, string> = {
  accept: 'Accept',
  minor_revisions: 'Minor revisions',
  major_revisions: 'Major revisions',
  reject: 'Reject',
}

function humanCareerStage(stage: string): string {
  switch (stage) {
    case 'med_student':
      return 'Medical Student'
    case 'resident':
      return 'Resident'
    case 'fellow':
      return 'Fellow'
    case 'attending':
      return 'Attending'
    default:
      return stage
  }
}

function humanManuscriptType(type: string | null): string | null {
  if (!type) return null
  // Stored as snake_case enum (e.g. case_report) — humanise for display.
  return type
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

function humanRole(role: string): string {
  return role.charAt(0).toUpperCase() + role.slice(1)
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Submission Studio morning brief rides this tick (13:00 UTC = 06:00
  // America/Los_Angeles) rather than claiming a sixth cron slot, following the
  // Session 98 precedent. It runs FIRST and unconditionally: this digest skips
  // its own send on an empty editorial window, but a zero-activity Studio day
  // is itself a number Kanwar wants to see, and a silently-skipped brief is
  // indistinguishable from a broken cron. runStudioDaily never throws, so a
  // Studio-side failure cannot take the editorial digest down with it.
  const studio = await runStudioDaily()

  const admin = createAdminClient()
  const now = new Date()
  const windowEndIso = now.toISOString()
  const windowStartIso = new Date(
    now.getTime() - 24 * 60 * 60 * 1000
  ).toISOString()

  // Five parallel queries. Each is independent — failures in one
  // surface should not poison the rest of the digest.
  const [
    regsRes,
    subsRes,
    revsRes,
    appsRes,
    reviewsRes,
  ] = await Promise.all([
    admin
      .from('users')
      .select('*')
      .gte('created_at', windowStartIso)
      .lt('created_at', windowEndIso)
      .order('created_at', { ascending: false }),
    admin
      .from('manuscripts')
      .select('*')
      .gte('submission_date', windowStartIso)
      .lt('submission_date', windowEndIso)
      .neq('status', 'draft')
      .order('submission_date', { ascending: false }),
    admin
      .from('manuscript_revisions')
      .select('*')
      .gte('submitted_date', windowStartIso)
      .lt('submitted_date', windowEndIso)
      .order('submitted_date', { ascending: false }),
    admin
      .from('reviewer_applications')
      .select('*')
      .gte('created_at', windowStartIso)
      .lt('created_at', windowEndIso)
      .order('created_at', { ascending: false }),
    admin
      .from('reviews')
      .select('*')
      .eq('is_draft', false)
      .gte('submitted_date', windowStartIso)
      .lt('submitted_date', windowEndIso)
      .order('submitted_date', { ascending: false }),
  ])

  const userRows = (regsRes.data as UserRow[]) || []
  const manuscriptRows = (subsRes.data as ManuscriptRow[]) || []
  const revisionRows = (revsRes.data as ManuscriptRevisionRow[]) || []
  const applicationRows = (appsRes.data as ReviewerApplicationRow[]) || []
  const reviewRows = (reviewsRes.data as ReviewRow[]) || []

  // ---- Enrichment ----
  // Revisions + reviews need their parent manuscript's title +
  // submission_id. Fetch in one batch keyed by manuscript_id.
  const enrichmentManuscriptIds = Array.from(
    new Set([
      ...revisionRows.map((r) => r.manuscript_id),
      ...reviewRows.map((r) => r.manuscript_id),
    ])
  )

  const manuscriptIndex = new Map<string, ManuscriptRow>()
  // Seed with any manuscripts already loaded from the submissions query —
  // saves a refetch when a manuscript shows up in two sections (e.g.
  // submitted today AND received a revision today).
  for (const m of manuscriptRows) {
    manuscriptIndex.set(m.id, m)
  }
  const missingIds = enrichmentManuscriptIds.filter(
    (id) => !manuscriptIndex.has(id)
  )
  if (missingIds.length > 0) {
    const { data: enrichRows } = await admin
      .from('manuscripts')
      .select('*')
      .in('id', missingIds)
    for (const m of (enrichRows as ManuscriptRow[]) || []) {
      manuscriptIndex.set(m.id, m)
    }
  }

  // Corresponding-author display name for the submissions section.
  // One join keyed by corresponding_author_id.
  const correspondingAuthorIds = Array.from(
    new Set(manuscriptRows.map((m) => m.corresponding_author_id))
  )
  const userIndex = new Map<string, UserRow>()
  if (correspondingAuthorIds.length > 0) {
    const { data: authorUsers } = await admin
      .from('users')
      .select('*')
      .in('id', correspondingAuthorIds)
    for (const u of (authorUsers as UserRow[]) || []) {
      userIndex.set(u.id, u)
    }
  }

  // Reviewer-name resolution for the reviews section. A review's
  // reviewer can be either a registered user (reviewer_id NOT NULL) or
  // an external invitee (we read the name off the review_invitations
  // snapshot via review_invitation_id_snapshot_email — the email is
  // stable; first/last name lives on the invitation row).
  const reviewerUserIds = Array.from(
    new Set(reviewRows.map((r) => r.reviewer_id).filter((id): id is string => !!id))
  )
  const reviewerInvitationEmails = Array.from(
    new Set(
      reviewRows
        .map((r) => r.review_invitation_id_snapshot_email)
        .filter((e): e is string => !!e)
    )
  )

  if (reviewerUserIds.length > 0) {
    const { data: reviewerUsers } = await admin
      .from('users')
      .select('*')
      .in('id', reviewerUserIds)
    for (const u of (reviewerUsers as UserRow[]) || []) {
      userIndex.set(u.id, u)
    }
  }

  const invitationByEmail = new Map<string, ReviewInvitationRow>()
  if (reviewerInvitationEmails.length > 0) {
    const { data: invRows } = await admin
      .from('review_invitations')
      .select('*')
      .in('reviewer_email', reviewerInvitationEmails)
    for (const inv of (invRows as ReviewInvitationRow[]) || []) {
      if (inv.reviewer_email) {
        invitationByEmail.set(inv.reviewer_email.toLowerCase(), inv)
      }
    }
  }

  // ---- Shape into digest payloads ----

  const registrations: DigestRegistration[] = userRows.map((u) => ({
    fullName: u.full_name,
    email: u.email,
    affiliation: u.affiliation,
    country: u.country,
    role: humanRole(u.role),
    orcidId: u.orcid_id,
    createdAt: u.created_at,
  }))

  const submissions: DigestSubmission[] = manuscriptRows.map((m) => {
    const author = userIndex.get(m.corresponding_author_id)
    const correspondingAuthor = author
      ? `${author.full_name} <${author.email}>`
      : null
    return {
      submissionId: m.submission_id,
      title: m.title,
      manuscriptType: humanManuscriptType(m.manuscript_type),
      correspondingAuthor,
      submissionDate: m.submission_date,
      manuscriptId: m.id,
    }
  })

  const revisions: DigestRevision[] = revisionRows.map((r) => {
    const ms = manuscriptIndex.get(r.manuscript_id)
    return {
      submissionId: ms?.submission_id || r.manuscript_id,
      title: ms?.title || null,
      revisionNumber: r.revision_number,
      submittedDate: r.submitted_date,
      manuscriptId: r.manuscript_id,
    }
  })

  const reviewerApplications: DigestReviewerApplication[] = applicationRows.map(
    (a) => ({
      fullName: `${a.first_name} ${a.last_name}`,
      email: a.email,
      affiliation: a.affiliation,
      country: a.country,
      careerStage: humanCareerStage(a.career_stage),
      applicationId: a.id,
      createdAt: a.created_at,
    })
  )

  const reviewsSubmitted: DigestReviewSubmitted[] = reviewRows.map((r) => {
    const ms = manuscriptIndex.get(r.manuscript_id)
    let reviewerName: string | null = null
    if (r.reviewer_id) {
      const u = userIndex.get(r.reviewer_id)
      reviewerName = u ? u.full_name : null
    } else if (r.review_invitation_id_snapshot_email) {
      const inv = invitationByEmail.get(
        r.review_invitation_id_snapshot_email.toLowerCase()
      )
      if (inv && (inv.reviewer_first_name || inv.reviewer_last_name)) {
        reviewerName = [inv.reviewer_first_name, inv.reviewer_last_name]
          .filter(Boolean)
          .join(' ')
          .trim() || null
      }
      if (!reviewerName) {
        reviewerName = r.review_invitation_id_snapshot_email
      }
    }
    return {
      submissionId: ms?.submission_id || r.manuscript_id,
      manuscriptTitle: ms?.title || null,
      reviewerName,
      recommendation: r.recommendation
        ? HUMAN_RECOMMENDATION[r.recommendation] || r.recommendation
        : null,
      submittedDate: r.submitted_date || r.created_at,
      reviewId: r.id,
      manuscriptId: r.manuscript_id,
    }
  })

  const counts = {
    registrationCount: registrations.length,
    submissionCount: submissions.length,
    revisionCount: revisions.length,
    reviewerApplicationCount: reviewerApplications.length,
    reviewSubmittedCount: reviewsSubmitted.length,
  }
  const totalCount =
    counts.registrationCount +
    counts.submissionCount +
    counts.revisionCount +
    counts.reviewerApplicationCount +
    counts.reviewSubmittedCount

  // ---- Skip empty windows ----
  if (totalCount === 0) {
    try {
      await (admin.from('audit_logs') as any).insert({
        action: 'daily_digest_skipped_empty',
        resource_type: 'cron',
        resource_id: null,
        details: {
          window_start: windowStartIso,
          window_end: windowEndIso,
        },
      })
    } catch {
      // swallow
    }
    return NextResponse.json({
      sent: false,
      reason: 'no_activity',
      studio,
      counts,
      window: { start: windowStartIso, end: windowEndIso },
    })
  }

  // ---- Render + send ----
  const { html, text } = renderDailyDigest({
    windowStartIso,
    windowEndIso,
    registrations,
    submissions,
    revisions,
    reviewerApplications,
    reviewsSubmitted,
  })

  const subject = getDailyDigestSubject(counts)

  const { error: sendErr, messageId } = await sendEmail({
    to: digestRecipient(),
    subject,
    html,
    text,
    emailType: 'daily_digest',
  })

  try {
    await (admin.from('audit_logs') as any).insert({
      action: sendErr ? 'daily_digest_send_failed' : 'daily_digest_sent',
      resource_type: 'cron',
      resource_id: null,
      details: {
        window_start: windowStartIso,
        window_end: windowEndIso,
        counts,
        recipient: digestRecipient(),
        message_id: messageId,
        error: sendErr,
      },
    })
  } catch {
    // swallow
  }

  if (sendErr) {
    return NextResponse.json(
      {
        sent: false,
        error: sendErr,
        studio,
        counts,
        window: { start: windowStartIso, end: windowEndIso },
      },
      { status: 500 }
    )
  }

  return NextResponse.json({
    sent: true,
    studio,
    recipient: digestRecipient(),
    subject,
    counts,
    window: { start: windowStartIso, end: windowEndIso },
    message_id: messageId,
  })
}
