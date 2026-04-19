// ============================================================
// GET /api/cron/revision-reminders
// ============================================================
// Daily Vercel Cron entry point (14:00 UTC — vercel.json). Scans
// manuscripts in `revision_requested` status whose latest
// non-rescinded editorial decision has a revision_deadline within
// the next 10 days, and which have not yet had a revision-reminder
// fired (manuscript_metadata.revision_reminder_sent_at IS NULL).
//
// One-shot per revision cycle — no second tier. The amber dashboard
// banner already nudges authors on every login; the email is for
// inactive authors who haven't logged in.
//
// Mirrors Session 11's review-reminder cron exactly:
//   - bearer-header gate against CRON_SECRET (no other auth)
//   - runtime: 'nodejs'
//   - admin client for DB writes
//   - audit-logged on each successful send
//   - returns {reminders_sent, scanned, timestamp}
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { sendEmail } from '@/lib/email/resend'
import {
  renderRevisionDeadlineReminder,
  getRevisionDeadlineReminderSubject,
} from '@/lib/email/templates/revisionDeadlineReminder'
import type {
  ManuscriptRow,
  EditorialDecisionRow,
  ManuscriptAuthorRow,
  UserRow,
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

interface CandidateRow {
  manuscript: ManuscriptRow
  decision: EditorialDecisionRow
  metadataId: string
}

async function loadCandidates(
  admin: ReturnType<typeof createAdminClient>
): Promise<CandidateRow[]> {
  const nowIso = new Date().toISOString()
  const tenDaysIso = new Date(
    Date.now() + 10 * 24 * 60 * 60 * 1000
  ).toISOString()

  // 1. All revision_requested manuscripts whose metadata row has
  //    not yet been stamped with a revision reminder.
  const { data: metaData } = await admin
    .from('manuscript_metadata')
    .select('id, manuscript_id')
    .is('revision_reminder_sent_at', null)

  const metaRows = (metaData as { id: string; manuscript_id: string }[] | null) || []
  if (metaRows.length === 0) return []

  const manuscriptIds = metaRows.map((r) => r.manuscript_id)
  const metaIdByManuscript = new Map(
    metaRows.map((r) => [r.manuscript_id, r.id])
  )

  const { data: manuscriptsData } = await admin
    .from('manuscripts')
    .select('*')
    .in('id', manuscriptIds)
    .eq('status', 'revision_requested')

  const manuscripts = (manuscriptsData as ManuscriptRow[] | null) || []
  if (manuscripts.length === 0) return []

  // 2. Latest non-rescinded editorial_decisions row per manuscript,
  //    revision_deadline within the next 10 days (and in the future).
  //    PostgREST doesn't support DISTINCT ON, so fetch all candidates
  //    and reduce in JS.
  const { data: decisionsData } = await admin
    .from('editorial_decisions')
    .select('*')
    .in('manuscript_id', manuscripts.map((m) => m.id))
    .is('rescinded_at', null)
    .not('revision_deadline', 'is', null)
    .gt('revision_deadline', nowIso)
    .lte('revision_deadline', tenDaysIso)
    .order('decision_date', { ascending: false })

  const decisions = (decisionsData as EditorialDecisionRow[] | null) || []

  const latestDecisionByManuscript = new Map<string, EditorialDecisionRow>()
  for (const d of decisions) {
    if (!latestDecisionByManuscript.has(d.manuscript_id)) {
      latestDecisionByManuscript.set(d.manuscript_id, d)
    }
  }

  const out: CandidateRow[] = []
  for (const m of manuscripts) {
    const d = latestDecisionByManuscript.get(m.id)
    if (!d) continue
    const metadataId = metaIdByManuscript.get(m.id)
    if (!metadataId) continue
    out.push({ manuscript: m, decision: d, metadataId })
  }
  return out
}

async function resolveAuthorContact(
  admin: ReturnType<typeof createAdminClient>,
  manuscript: ManuscriptRow
): Promise<{ name: string; email: string | null }> {
  const { data: authorsData } = await admin
    .from('manuscript_authors')
    .select('*')
    .eq('manuscript_id', manuscript.id)
    .order('author_order', { ascending: true })
  const authors = (authorsData as ManuscriptAuthorRow[] | null) || []

  const { data: userData } = await admin
    .from('users')
    .select('*')
    .eq('id', manuscript.corresponding_author_id)
    .maybeSingle()
  const user = (userData as UserRow | null) || null

  const correspondingAuthor =
    authors.find((a) => a.is_corresponding) ||
    authors.find((a) => a.author_id === manuscript.corresponding_author_id) ||
    null

  return {
    name: correspondingAuthor?.full_name || user?.full_name || 'Author',
    email: correspondingAuthor?.email || user?.email || null,
  }
}

async function fireReminder(
  admin: ReturnType<typeof createAdminClient>,
  candidate: CandidateRow
): Promise<boolean> {
  const { manuscript, decision, metadataId } = candidate
  const contact = await resolveAuthorContact(admin, manuscript)
  if (!contact.email) return false

  const now = new Date()
  const deadlineDate = decision.revision_deadline
    ? new Date(decision.revision_deadline)
    : now
  const daysRemaining = daysBetween(now, deadlineDate)

  const base = siteUrl()
  const revisingUrl = `${base}/dashboard/submit?revising=${manuscript.id}`

  const { html, text } = renderRevisionDeadlineReminder({
    authorName: contact.name,
    submissionId: manuscript.submission_id,
    manuscriptTitle: manuscript.title || '(untitled manuscript)',
    deadlineLabel: formatDeadline(decision.revision_deadline),
    daysRemaining,
    revisingUrl,
  })

  const { error: sendErr } = await sendEmail({
    to: contact.email,
    subject: getRevisionDeadlineReminderSubject(
      manuscript.submission_id,
      daysRemaining
    ),
    html,
    text,
    emailType: 'revision_deadline_reminder',
    manuscriptId: manuscript.id,
  })

  if (sendErr) return false

  // Stamp the idempotency column. If this fails the email already
  // went out — log the anomaly but count the send for observability;
  // a duplicate send next tick is preferable to a silent miss.
  const { error: updateErr } = await (
    admin.from('manuscript_metadata') as any
  )
    .update({ revision_reminder_sent_at: new Date().toISOString() })
    .eq('id', metadataId)

  if (updateErr) {
    try {
      await (admin.from('audit_logs') as any).insert({
        action: 'revision_reminder_record_failed',
        resource_type: 'manuscript',
        resource_id: manuscript.id,
        details: {
          manuscript_id: manuscript.id,
          metadata_id: metadataId,
          error: updateErr.message,
        },
      })
    } catch {
      // swallow
    }
    return true
  }

  try {
    await (admin.from('audit_logs') as any).insert({
      action: 'revision_reminder_sent',
      resource_type: 'manuscript',
      resource_id: manuscript.id,
      details: {
        manuscript_id: manuscript.id,
        days_to_deadline: daysRemaining,
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

  const candidates = await loadCandidates(admin)

  let remindersSent = 0
  for (const candidate of candidates) {
    const sent = await fireReminder(admin, candidate)
    if (sent) remindersSent += 1
  }

  return NextResponse.json({
    reminders_sent: remindersSent,
    scanned: candidates.length,
    timestamp: nowIso,
  })
}
