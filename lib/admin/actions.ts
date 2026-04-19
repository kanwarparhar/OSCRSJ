'use server'

import { revalidatePath } from 'next/cache'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { sendEmail } from '@/lib/email/resend'
import {
  renderEditorialDecisionAccept,
  getEditorialDecisionAcceptSubject,
} from '@/lib/email/templates/editorialDecisionAccept'
import {
  renderEditorialDecisionMinorRevisions,
  getEditorialDecisionMinorRevisionsSubject,
} from '@/lib/email/templates/editorialDecisionMinorRevisions'
import {
  renderEditorialDecisionMajorRevisions,
  getEditorialDecisionMajorRevisionsSubject,
} from '@/lib/email/templates/editorialDecisionMajorRevisions'
import {
  renderEditorialDecisionReject,
  getEditorialDecisionRejectSubject,
} from '@/lib/email/templates/editorialDecisionReject'
import {
  renderDecisionRescindedAuthor,
  getDecisionRescindedAuthorSubject,
} from '@/lib/email/templates/decisionRescindedAuthor'
import {
  renderReviewerInvitation,
  getReviewerInvitationSubject,
} from '@/lib/email/templates/reviewerInvitation'
import type {
  ManuscriptFileRow,
  ManuscriptRow,
  ManuscriptStatus,
  EditorialDecisionType,
  EditorialDecisionRow,
  UserRow,
  ManuscriptAuthorRow,
  ReviewInvitationRow,
} from '@/lib/types/database'

// Admin-scoped server actions. Every export here re-checks editor/admin
// role on the authenticated user before touching the admin (service-role)
// client. The UI layout at /dashboard/admin/* also gates on the same
// check — the re-check here closes the gap for direct POSTs bypassing
// the UI.

const SIGNED_URL_TTL_SECONDS = 30 * 60

// Rescind window — must match the UI gate in DecisionComposerPanel.
// Past 15 minutes a superseding decision is required (a second
// editorial_decisions row), not a rescind.
const RESCIND_WINDOW_MS = 15 * 60 * 1000

async function requireEditorOrAdmin(): Promise<
  { userId: string } | { error: string }
> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  const { data, error } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (error || !data) return { error: 'Profile not found.' }
  const role = (data as { role: string }).role
  if (role !== 'editor' && role !== 'admin') {
    return { error: 'Editor or admin role required.' }
  }
  return { userId: user.id }
}

export interface GetAdminFileSignedUrlResult {
  signedUrl?: string
  fileName?: string
  error?: string
  notFound?: true
  forbidden?: true
}

// Editor-only file-download signed URL. Unlike the reviewer variant in
// lib/reviewer/actions.ts, this one has no double-blind allowlist —
// editors may download every file type (cover letter, un-blinded
// manuscript, figures, ethics approval, response-to-reviewers,
// tracked-changes, supplements).
export async function getAdminFileSignedUrl(
  fileId: string
): Promise<GetAdminFileSignedUrlResult> {
  const gate = await requireEditorOrAdmin()
  if ('error' in gate) return { forbidden: true, error: gate.error }

  if (!fileId || typeof fileId !== 'string') {
    return { notFound: true, error: 'File id is required.' }
  }

  const admin = createAdminClient()

  const { data: fData, error: fErr } = await admin
    .from('manuscript_files')
    .select('*')
    .eq('id', fileId)
    .maybeSingle()

  if (fErr || !fData) return { notFound: true, error: 'File not found.' }
  const file = fData as ManuscriptFileRow

  const { data: signed, error: signErr } = await admin.storage
    .from('submissions')
    .createSignedUrl(file.storage_path, SIGNED_URL_TTL_SECONDS, {
      download: file.original_filename || file.file_name,
    })

  if (signErr || !signed) {
    return {
      error: `Failed to generate download link: ${
        signErr?.message || 'unknown error'
      }`,
    }
  }

  // Audit log — required per brief acceptance criteria. Best-effort;
  // never fail the download on a log error.
  try {
    await (admin.from('audit_logs') as any).insert({
      user_id: gate.userId,
      action: 'editor_file_downloaded',
      resource_type: 'manuscript_file',
      resource_id: file.id,
      details: {
        file_id: file.id,
        manuscript_id: file.manuscript_id,
        file_type: file.file_type,
        editor_id: gate.userId,
      },
    })
  } catch {
    // swallow
  }

  return {
    signedUrl: signed.signedUrl,
    fileName: file.original_filename || file.file_name,
  }
}

// ============================================================
// Editorial decision composer (Session 12 + Session 13)
// ============================================================
// Gates: editor/admin role + manuscript status in DECIDABLE_STATUSES.
// Status mapping (Session 13 reject-enum split):
//   accept              → 'accepted'
//   minor_revisions     → 'revision_requested'
//   major_revisions     → 'revision_requested'
//   post_review_reject  → 'rejected'              (new in S13)
//   reject              → 'rejected'              (legacy alias —
//                                                   composer no longer
//                                                   emits this; kept
//                                                   for any rows
//                                                   inserted before
//                                                   the split landed)
//   desk_reject         → 'desk_rejected'
//
// DECIDABLE_STATUSES is local to this module — do not import it
// cross-module. Each gate stays close to the action that enforces it.

const DECIDABLE_STATUSES = [
  'submitted',
  'under_review',
  'revision_received',
] as const

const REVISION_DECISIONS = new Set<EditorialDecisionType>([
  'minor_revisions',
  'major_revisions',
])

const DECISION_TO_STATUS: Record<EditorialDecisionType, ManuscriptStatus> = {
  accept: 'accepted',
  minor_revisions: 'revision_requested',
  major_revisions: 'revision_requested',
  post_review_reject: 'rejected',
  reject: 'rejected',
  desk_reject: 'desk_rejected',
}

const MIN_DECISION_LETTER_LENGTH = 120
const MAX_DECISION_LETTER_LENGTH = 20_000

function siteUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    'https://www.oscrsj.com'
  return raw.replace(/\/$/, '')
}

function formatDeadlineLabel(iso: string | null): string {
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

export interface SubmitEditorialDecisionArgs {
  manuscriptId: string
  decision: EditorialDecisionType
  decisionLetter: string
  revisionDeadline?: string | null
  // Session 13 — when true and decision === 'major_revisions',
  // enumerates reviewers who completed round 1 and seeds fresh
  // 'invited' review_invitations rows for round 2. Best-effort:
  // a re-invite failure does NOT roll back the decision.
  reInviteOriginalReviewers?: boolean
}

export interface SubmitEditorialDecisionResult {
  ok: boolean
  decisionId?: string
  error?: string
  forbidden?: true
  notFound?: true
  invalidState?: true
  // Session 13 — populated when reInviteOriginalReviewers was true.
  reInvited?: number
  reInviteSkipped?: number
  reInviteFailed?: number
}

export async function submitEditorialDecision(
  args: SubmitEditorialDecisionArgs
): Promise<SubmitEditorialDecisionResult> {
  const gate = await requireEditorOrAdmin()
  if ('error' in gate) return { ok: false, forbidden: true, error: gate.error }

  if (!args.manuscriptId || typeof args.manuscriptId !== 'string') {
    return { ok: false, error: 'Manuscript id is required.' }
  }

  const validDecisions: EditorialDecisionType[] = [
    'accept',
    'minor_revisions',
    'major_revisions',
    'post_review_reject',
    'reject',
    'desk_reject',
  ]
  if (!validDecisions.includes(args.decision)) {
    return { ok: false, error: 'Invalid decision type.' }
  }

  const letter =
    typeof args.decisionLetter === 'string' ? args.decisionLetter.trim() : ''
  if (letter.length < MIN_DECISION_LETTER_LENGTH) {
    return {
      ok: false,
      error: `Decision letter must be at least ${MIN_DECISION_LETTER_LENGTH} characters.`,
    }
  }
  if (letter.length > MAX_DECISION_LETTER_LENGTH) {
    return {
      ok: false,
      error: `Decision letter exceeds maximum length (${MAX_DECISION_LETTER_LENGTH} characters).`,
    }
  }

  let deadlineIso: string | null = null
  if (REVISION_DECISIONS.has(args.decision)) {
    if (!args.revisionDeadline || typeof args.revisionDeadline !== 'string') {
      return {
        ok: false,
        error: 'A revision deadline is required for revision decisions.',
      }
    }
    const parsed = new Date(args.revisionDeadline)
    if (Number.isNaN(parsed.getTime())) {
      return { ok: false, error: 'Revision deadline is not a valid date.' }
    }
    if (parsed.getTime() <= Date.now()) {
      return { ok: false, error: 'Revision deadline must be in the future.' }
    }
    deadlineIso = parsed.toISOString()
  }

  const admin = createAdminClient()

  // Load manuscript + gate on decidable status.
  const { data: mData, error: mErr } = await admin
    .from('manuscripts')
    .select('*')
    .eq('id', args.manuscriptId)
    .maybeSingle()

  if (mErr || !mData) {
    return { ok: false, notFound: true, error: 'Manuscript not found.' }
  }
  const manuscript = mData as ManuscriptRow

  if (!(DECIDABLE_STATUSES as readonly string[]).includes(manuscript.status)) {
    return {
      ok: false,
      invalidState: true,
      error: `Manuscripts in status "${manuscript.status}" cannot receive a new editorial decision.`,
    }
  }

  // Desk reject is only valid from 'submitted'.
  if (args.decision === 'desk_reject' && manuscript.status !== 'submitted') {
    return {
      ok: false,
      invalidState: true,
      error: 'Desk reject is only available on manuscripts in "submitted" status.',
    }
  }

  const nowIso = new Date().toISOString()
  const targetStatus = DECISION_TO_STATUS[args.decision]

  // 1. Insert decision row.
  const { data: inserted, error: insertErr } = await (
    admin.from('editorial_decisions') as any
  )
    .insert({
      manuscript_id: args.manuscriptId,
      editor_id: gate.userId,
      decision: args.decision,
      decision_letter: letter,
      revision_deadline: deadlineIso,
      decision_date: nowIso,
    })
    .select('id')
    .single()

  if (insertErr || !inserted) {
    return {
      ok: false,
      error: `Failed to record decision: ${
        insertErr?.message || 'unknown error'
      }`,
    }
  }
  const decisionId = (inserted as { id: string }).id

  // 2. Flip manuscript status + stamp decision_date.
  const { error: updErr } = await (admin.from('manuscripts') as any)
    .update({ status: targetStatus, decision_date: nowIso })
    .eq('id', args.manuscriptId)

  if (updErr) {
    return {
      ok: false,
      error: `Decision recorded but status update failed: ${updErr.message}`,
    }
  }

  // 3. Audit log.
  try {
    await (admin.from('audit_logs') as any).insert({
      user_id: gate.userId,
      action: 'editorial_decision_issued',
      resource_type: 'editorial_decision',
      resource_id: decisionId,
      details: {
        decision_id: decisionId,
        manuscript_id: args.manuscriptId,
        decision: args.decision,
        from_status: manuscript.status,
        to_status: targetStatus,
        revision_deadline: deadlineIso,
        letter_length: letter.length,
      },
    })
  } catch {
    // swallow
  }

  // 4. Fire-and-forget decision-letter email.
  try {
    // Load corresponding author identity + email. Prefer
    // manuscript_authors.is_corresponding (the snapshot on the
    // submission) then fall back to the users row.
    const { data: authorsData } = await admin
      .from('manuscript_authors')
      .select('*')
      .eq('manuscript_id', args.manuscriptId)
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

    const authorName =
      correspondingAuthor?.full_name || user?.full_name || 'Author'
    const authorEmail =
      correspondingAuthor?.email || user?.email || null

    if (authorEmail) {
      const base = siteUrl()
      const title = manuscript.title || '(untitled manuscript)'
      const submissionId = manuscript.submission_id

      if (args.decision === 'accept') {
        const { html, text } = renderEditorialDecisionAccept({
          authorName,
          submissionId,
          title,
          decisionLetter: letter,
          dashboardUrl: `${base}/dashboard`,
        })
        await sendEmail({
          to: authorEmail,
          subject: getEditorialDecisionAcceptSubject(submissionId),
          html,
          text,
          emailType: 'editorial_decision_accept',
          manuscriptId: args.manuscriptId,
        })
      } else if (args.decision === 'minor_revisions') {
        const { html, text } = renderEditorialDecisionMinorRevisions({
          authorName,
          submissionId,
          title,
          decisionLetter: letter,
          deadlineLabel: formatDeadlineLabel(deadlineIso),
          revisingUrl: `${base}/dashboard/submit?revising=${args.manuscriptId}`,
        })
        await sendEmail({
          to: authorEmail,
          subject: getEditorialDecisionMinorRevisionsSubject(submissionId),
          html,
          text,
          emailType: 'editorial_decision_minor_revisions',
          manuscriptId: args.manuscriptId,
        })
      } else if (args.decision === 'major_revisions') {
        const { html, text } = renderEditorialDecisionMajorRevisions({
          authorName,
          submissionId,
          title,
          decisionLetter: letter,
          deadlineLabel: formatDeadlineLabel(deadlineIso),
          revisingUrl: `${base}/dashboard/submit?revising=${args.manuscriptId}`,
        })
        await sendEmail({
          to: authorEmail,
          subject: getEditorialDecisionMajorRevisionsSubject(submissionId),
          html,
          text,
          emailType: 'editorial_decision_major_revisions',
          manuscriptId: args.manuscriptId,
        })
      } else {
        // post_review_reject (Session 13), legacy reject, or desk_reject
        const isDeskReject = args.decision === 'desk_reject'
        const { html, text } = renderEditorialDecisionReject({
          authorName,
          submissionId,
          title,
          decisionLetter: letter,
          isDeskReject,
        })
        await sendEmail({
          to: authorEmail,
          subject: getEditorialDecisionRejectSubject(submissionId, isDeskReject),
          html,
          text,
          emailType: isDeskReject
            ? 'editorial_decision_desk_reject'
            : args.decision === 'post_review_reject'
              ? 'editorial_decision_post_review_reject'
              : 'editorial_decision_reject',
          manuscriptId: args.manuscriptId,
        })
      }
    }
  } catch {
    // fire-and-forget
  }

  // 5. Optional: re-invite original reviewers on Major Revisions.
  let reInvited = 0
  let reInviteSkipped = 0
  let reInviteFailed = 0
  if (
    args.reInviteOriginalReviewers &&
    args.decision === 'major_revisions'
  ) {
    const result = await reInviteOriginalReviewers({
      admin,
      manuscriptId: args.manuscriptId,
      decisionDateIso: nowIso,
      manuscript,
    })
    reInvited = result.invited
    reInviteSkipped = result.skipped
    reInviteFailed = result.failed
  }

  revalidatePath(`/dashboard/admin/manuscripts/${args.manuscriptId}`)
  return {
    ok: true,
    decisionId,
    reInvited,
    reInviteSkipped,
    reInviteFailed,
  }
}

// ============================================================
// Decision rescind 15-min window (Session 13)
// ============================================================
// Editor-only undo of an editorial decision they themselves issued
// within the last 15 minutes. Beyond 15 min a superseding decision
// is required (a second editorial_decisions row), not a rescind.
// Desk-rejects ARE rescindable under the same 15-min window.
//
// On success:
//   1. editorial_decisions.rescinded_at + rescinded_reason set
//   2. manuscripts.status reverted to its pre-decision state
//      (see deriveRestoredStatus)
//   3. audit log: editorial_decision_rescinded
//   4. fire-and-forget apologetic email to corresponding author

export interface RescindEditorialDecisionArgs {
  decisionId: string
  reason: string
}

export interface RescindEditorialDecisionResult {
  ok: boolean
  error?: string
  forbidden?: true
  notFound?: true
  tooLate?: true
  alreadyRescinded?: true
  restoredStatus?: ManuscriptStatus
}

const MIN_RESCIND_REASON_LENGTH = 50
const MAX_RESCIND_REASON_LENGTH = 1000

async function deriveRestoredStatus(
  admin: ReturnType<typeof createAdminClient>,
  manuscriptId: string,
  rescindingDecisionId: string
): Promise<ManuscriptStatus> {
  // Look at all prior non-rescinded decisions on this manuscript,
  // EXCLUDING the one being rescinded. Most-recent first.
  const { data: priorDecisionsData } = await admin
    .from('editorial_decisions')
    .select('*')
    .eq('manuscript_id', manuscriptId)
    .is('rescinded_at', null)
    .neq('id', rescindingDecisionId)
    .order('decision_date', { ascending: false })

  const priorDecisions =
    (priorDecisionsData as EditorialDecisionRow[] | null) || []

  if (priorDecisions.length > 0) {
    // Most recent prior non-rescinded decision wins.
    const priorMapped = DECISION_TO_STATUS[priorDecisions[0].decision]
    if (priorMapped) return priorMapped
  }

  // No prior decisions. Did the manuscript ever receive a revision?
  const { data: revisionsData } = await admin
    .from('manuscript_revisions')
    .select('id')
    .eq('manuscript_id', manuscriptId)
    .limit(1)
  if (Array.isArray(revisionsData) && revisionsData.length > 0) {
    return 'revision_received'
  }

  // No revisions either. If any non-draft review exists, the
  // manuscript was already under review when the decision was
  // issued — restore to under_review. Otherwise, restore to
  // submitted.
  const { count } = await admin
    .from('reviews')
    .select('id', { count: 'exact', head: true })
    .eq('manuscript_id', manuscriptId)
    .eq('is_draft', false)

  if ((count || 0) > 0) return 'under_review'
  return 'submitted'
}

export async function rescindEditorialDecision(
  args: RescindEditorialDecisionArgs
): Promise<RescindEditorialDecisionResult> {
  const gate = await requireEditorOrAdmin()
  if ('error' in gate) return { ok: false, forbidden: true, error: gate.error }

  if (!args.decisionId || typeof args.decisionId !== 'string') {
    return { ok: false, error: 'Decision id is required.' }
  }
  const reason =
    typeof args.reason === 'string' ? args.reason.trim() : ''
  if (reason.length < MIN_RESCIND_REASON_LENGTH) {
    return {
      ok: false,
      error: `A reason of at least ${MIN_RESCIND_REASON_LENGTH} characters is required so the author understands why the decision is being undone.`,
    }
  }
  const truncatedReason = reason.slice(0, MAX_RESCIND_REASON_LENGTH)

  const admin = createAdminClient()

  const { data: dData, error: dErr } = await admin
    .from('editorial_decisions')
    .select('*')
    .eq('id', args.decisionId)
    .maybeSingle()
  if (dErr || !dData) {
    return { ok: false, notFound: true, error: 'Decision not found.' }
  }
  const decision = dData as EditorialDecisionRow

  // Ownership: only the issuing editor may rescind. Prevents one
  // editor undoing another's decision during the 15-min window.
  if (decision.editor_id !== gate.userId) {
    return {
      ok: false,
      forbidden: true,
      error: 'Only the editor who issued this decision may rescind it.',
    }
  }

  if (decision.rescinded_at) {
    return {
      ok: false,
      alreadyRescinded: true,
      error: 'This decision has already been rescinded.',
    }
  }

  const issuedAt = new Date(decision.decision_date).getTime()
  const elapsed = Date.now() - issuedAt
  if (elapsed > RESCIND_WINDOW_MS) {
    return {
      ok: false,
      tooLate: true,
      error: `The 15-minute rescind window has passed. To override this decision, issue a superseding decision instead.`,
    }
  }

  const restoredStatus = await deriveRestoredStatus(
    admin,
    decision.manuscript_id,
    decision.id
  )

  const nowIso = new Date().toISOString()

  // 1. Stamp rescinded_at + reason.
  const { error: updateDecErr } = await (
    admin.from('editorial_decisions') as any
  )
    .update({ rescinded_at: nowIso, rescinded_reason: truncatedReason })
    .eq('id', decision.id)
  if (updateDecErr) {
    return {
      ok: false,
      error: `Failed to rescind decision: ${updateDecErr.message}`,
    }
  }

  // 2. Revert manuscript status.
  const { error: updateMsErr } = await (admin.from('manuscripts') as any)
    .update({ status: restoredStatus, decision_date: null })
    .eq('id', decision.manuscript_id)
  if (updateMsErr) {
    // The rescind landed on the decision but status revert failed.
    // Surface as an error so the editor sees it; the audit-log
    // event below still fires for traceability.
    try {
      await (admin.from('audit_logs') as any).insert({
        user_id: gate.userId,
        action: 'editorial_decision_rescind_status_revert_failed',
        resource_type: 'editorial_decision',
        resource_id: decision.id,
        details: {
          decision_id: decision.id,
          manuscript_id: decision.manuscript_id,
          attempted_status: restoredStatus,
          error: updateMsErr.message,
        },
      })
    } catch {
      // swallow
    }
    return {
      ok: false,
      error: `Decision rescinded but status revert failed: ${updateMsErr.message}`,
    }
  }

  // 3. Audit log.
  const elapsedMinutes = Math.round(elapsed / 60000)
  try {
    await (admin.from('audit_logs') as any).insert({
      user_id: gate.userId,
      action: 'editorial_decision_rescinded',
      resource_type: 'editorial_decision',
      resource_id: decision.id,
      details: {
        decision_id: decision.id,
        manuscript_id: decision.manuscript_id,
        reason: truncatedReason,
        restored_status: restoredStatus,
        rescinded_minutes_after_issue: elapsedMinutes,
      },
    })
  } catch {
    // swallow
  }

  // 4. Fire-and-forget apology email.
  try {
    const { data: mData } = await admin
      .from('manuscripts')
      .select('*')
      .eq('id', decision.manuscript_id)
      .maybeSingle()
    const manuscript = (mData as ManuscriptRow | null) || null

    if (manuscript) {
      const { data: authorsData } = await admin
        .from('manuscript_authors')
        .select('*')
        .eq('manuscript_id', decision.manuscript_id)
        .order('author_order', { ascending: true })
      const authors = (authorsData as ManuscriptAuthorRow[] | null) || []
      const { data: userData } = await admin
        .from('users')
        .select('*')
        .eq('id', manuscript.corresponding_author_id)
        .maybeSingle()
      const user = (userData as UserRow | null) || null
      const corresponding =
        authors.find((a) => a.is_corresponding) ||
        authors.find(
          (a) => a.author_id === manuscript.corresponding_author_id
        ) ||
        null
      const authorName =
        corresponding?.full_name || user?.full_name || 'Author'
      const authorEmail = corresponding?.email || user?.email || null

      if (authorEmail) {
        const base = siteUrl()
        const { html, text } = renderDecisionRescindedAuthor({
          authorName,
          submissionId: manuscript.submission_id,
          manuscriptTitle: manuscript.title || '(untitled manuscript)',
          rescindedReason: truncatedReason,
          dashboardUrl: `${base}/dashboard`,
        })
        await sendEmail({
          to: authorEmail,
          subject: getDecisionRescindedAuthorSubject(manuscript.submission_id),
          html,
          text,
          emailType: 'editorial_decision_rescinded',
          manuscriptId: decision.manuscript_id,
        })
      }
    }
  } catch {
    // fire-and-forget
  }

  revalidatePath(`/dashboard/admin/manuscripts/${decision.manuscript_id}`)
  return { ok: true, restoredStatus }
}

// ============================================================
// Major-Revisions reviewer auto-re-invite (Session 13)
// ============================================================
// Helper invoked from submitEditorialDecision when
// reInviteOriginalReviewers === true and decision === 'major_revisions'.
// Enumerates reviewers who completed round 1 (non-draft reviews
// on this manuscript) and seeds fresh review_invitations rows for
// round 2, with the editor note pre-filled. Idempotent — skips
// reviewers who already have an invitation created AFTER this
// decision's date (defends against double-submits + cron retries).

const ROUND_2_DEADLINE_DAYS = 21
const ROUND_2_NOTE = `Round 2: this is a revised manuscript following major revisions. The original reviewer reports are accessible via your review dashboard.`

interface ReInviteContext {
  admin: ReturnType<typeof createAdminClient>
  manuscriptId: string
  decisionDateIso: string
  manuscript: ManuscriptRow
}

interface ReInviteResult {
  invited: number
  skipped: number
  failed: number
}

const MANUSCRIPT_TYPE_LABELS: Record<string, string> = {
  case_report: 'Case Report',
  case_series: 'Case Series',
  surgical_technique: 'Surgical Technique',
  images_in_orthopedics: 'Images in Orthopedics',
  letter_to_editor: 'Letter to the Editor',
  review_article: 'Review Article',
}

function teaseAbstract(abstract: string | null, maxLength = 900): string {
  const trimmed = (abstract || '').trim()
  if (!trimmed) return 'No abstract provided.'
  if (trimmed.length <= maxLength) return trimmed
  return `${trimmed.slice(0, maxLength).trimEnd()}…`
}

async function reInviteOriginalReviewers(
  ctx: ReInviteContext
): Promise<ReInviteResult> {
  const { admin, manuscriptId, decisionDateIso, manuscript } = ctx
  const out: ReInviteResult = { invited: 0, skipped: 0, failed: 0 }

  // Find invitations whose reviewer submitted a non-draft review.
  const { data: invData } = await admin
    .from('review_invitations')
    .select('*')
    .eq('manuscript_id', manuscriptId)
    .in('status', ['accepted', 'submitted'])

  const allInvitations =
    (invData as ReviewInvitationRow[] | null) || []
  if (allInvitations.length === 0) return out

  const { data: reviewsData } = await admin
    .from('reviews')
    .select('review_invitation_id')
    .eq('manuscript_id', manuscriptId)
    .eq('is_draft', false)

  const submittedInvitationIds = new Set<string>(
    ((reviewsData as { review_invitation_id: string }[] | null) || []).map(
      (r) => r.review_invitation_id
    )
  )

  // Dedupe by reviewer email — same human shouldn't be re-invited
  // twice if they happened to have multiple round-1 invitations.
  const seenEmails = new Set<string>()
  const round1Reviewers: ReviewInvitationRow[] = []
  for (const inv of allInvitations) {
    if (!submittedInvitationIds.has(inv.id)) continue
    const email = (inv.reviewer_email || '').toLowerCase()
    if (!email) continue
    if (seenEmails.has(email)) continue
    seenEmails.add(email)
    round1Reviewers.push(inv)
  }

  if (round1Reviewers.length === 0) return out

  // Idempotency — find any invitations CREATED AFTER decisionDateIso.
  // If a reviewer already has one, skip them.
  const { data: postDecisionInvitations } = await admin
    .from('review_invitations')
    .select('reviewer_email, status, created_at')
    .eq('manuscript_id', manuscriptId)
    .gt('created_at', decisionDateIso)

  const alreadyReInvited = new Set<string>(
    (
      (postDecisionInvitations as
        | { reviewer_email: string | null; status: string }[]
        | null) || []
    )
      .filter(
        (r) =>
          r.reviewer_email &&
          ['invited', 'accepted', 'submitted'].includes(r.status)
      )
      .map((r) => (r.reviewer_email as string).toLowerCase())
  )

  const base = siteUrl()
  const deadlineDate = new Date(decisionDateIso)
  deadlineDate.setUTCDate(deadlineDate.getUTCDate() + ROUND_2_DEADLINE_DAYS)
  const deadlineIso = deadlineDate.toISOString()

  for (const prior of round1Reviewers) {
    const email = (prior.reviewer_email || '').toLowerCase()
    if (alreadyReInvited.has(email)) {
      out.skipped += 1
      continue
    }

    const insertPayload: Record<string, unknown> = {
      manuscript_id: manuscriptId,
      reviewer_id: prior.reviewer_id,
      reviewer_application_id: prior.reviewer_application_id,
      reviewer_email: prior.reviewer_email,
      reviewer_first_name: prior.reviewer_first_name,
      reviewer_last_name: prior.reviewer_last_name,
      deadline: deadlineIso,
      // status defaults to 'invited' per schema
    }

    const { data: inserted, error: insertErr } = await (
      admin.from('review_invitations') as any
    )
      .insert(insertPayload)
      .select('id, review_token')
      .single()

    if (insertErr || !inserted) {
      out.failed += 1
      try {
        await (admin.from('audit_logs') as any).insert({
          action: 'reviewer_re_invite_failed',
          resource_type: 'review_invitation',
          resource_id: prior.id,
          details: {
            prior_review_invitation_id: prior.id,
            manuscript_id: manuscriptId,
            reviewer_email: prior.reviewer_email,
            error: insertErr?.message || 'unknown',
          },
        })
      } catch {
        // swallow
      }
      continue
    }

    const newInv = inserted as { id: string; review_token: string }

    // Fire reviewer-invitation email with Round 2 note.
    try {
      const acceptUrl = `${base}/review/${newInv.review_token}?action=accept`
      const declineUrl = `${base}/review/${newInv.review_token}?action=decline`
      const { html, text } = renderReviewerInvitation({
        firstName: prior.reviewer_first_name || 'Reviewer',
        manuscriptTitle: manuscript.title || '(untitled manuscript)',
        manuscriptType:
          MANUSCRIPT_TYPE_LABELS[manuscript.manuscript_type || ''] ||
          manuscript.manuscript_type ||
          'Not specified',
        subspecialty: manuscript.subspecialty || 'Not specified',
        abstractTeaser: teaseAbstract(manuscript.abstract),
        deadlineLabel: new Date(deadlineIso).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        }),
        editorNote: ROUND_2_NOTE,
        acceptUrl,
        declineUrl,
      })
      await sendEmail({
        to: prior.reviewer_email!,
        subject: getReviewerInvitationSubject(
          manuscript.title || '(untitled manuscript)'
        ),
        html,
        text,
        emailType: 'reviewer_invitation_round_2',
        manuscriptId,
      })
    } catch {
      // swallow — invitation row is the source of truth
    }

    try {
      await (admin.from('audit_logs') as any).insert({
        action: 'reviewer_re_invited',
        resource_type: 'review_invitation',
        resource_id: newInv.id,
        details: {
          prior_review_invitation_id: prior.id,
          new_review_invitation_id: newInv.id,
          manuscript_id: manuscriptId,
          reviewer_email: prior.reviewer_email,
          round: 2,
        },
      })
    } catch {
      // swallow
    }

    out.invited += 1
  }

  return out
}
