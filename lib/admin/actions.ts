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
import type {
  ManuscriptFileRow,
  ManuscriptRow,
  ManuscriptStatus,
  EditorialDecisionType,
  UserRow,
  ManuscriptAuthorRow,
} from '@/lib/types/database'

// Admin-scoped server actions. Every export here re-checks editor/admin
// role on the authenticated user before touching the admin (service-role)
// client. The UI layout at /dashboard/admin/* also gates on the same
// check — the re-check here closes the gap for direct POSTs bypassing
// the UI.

const SIGNED_URL_TTL_SECONDS = 30 * 60

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
// Editorial decision composer (Session 12)
// ============================================================
// Gates: editor/admin role + manuscript status in DECIDABLE_STATUSES.
// Status mapping:
//   accept              → 'accepted'              (APC invoice is a
//                                                   later admin action
//                                                   once Stripe lands)
//   minor_revisions     → 'revision_requested'
//   major_revisions     → 'revision_requested'
//   reject              → 'desk_rejected'          (enum split deferred
//                                                   to Phase 3.5 —
//                                                   post_review_reject
//                                                   vs desk_reject)
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
  reject: 'desk_rejected',
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
}

export interface SubmitEditorialDecisionResult {
  ok: boolean
  decisionId?: string
  error?: string
  forbidden?: true
  notFound?: true
  invalidState?: true
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
        // reject or desk_reject
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
            : 'editorial_decision_reject',
          manuscriptId: args.manuscriptId,
        })
      }
    }
  } catch {
    // fire-and-forget
  }

  revalidatePath(`/dashboard/admin/manuscripts/${args.manuscriptId}`)
  return { ok: true, decisionId }
}
