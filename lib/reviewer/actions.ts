'use server'

import { revalidatePath } from 'next/cache'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { sendEmail } from '@/lib/email/resend'
import {
  renderReviewerApplicationConfirmation,
  getReviewerApplicationConfirmationSubject,
} from '@/lib/email/templates/reviewerApplicationConfirmation'
import {
  renderReviewerApplicationInternalNotification,
  getReviewerApplicationInternalSubject,
} from '@/lib/email/templates/reviewerApplicationInternalNotification'
import {
  renderReviewerInvitation,
  getReviewerInvitationSubject,
} from '@/lib/email/templates/reviewerInvitation'
import {
  renderReviewerInvitationConfirmation,
  getReviewerInvitationConfirmationSubject,
} from '@/lib/email/templates/reviewerInvitationConfirmation'
import {
  renderReviewerInvitationEditorNotification,
  getReviewerInvitationEditorNotificationSubject,
} from '@/lib/email/templates/reviewerInvitationEditorNotification'
import type {
  ManuscriptRow,
  ReviewInvitationRow,
  ReviewerApplicationRow,
  ReviewerApplicationStatus,
} from '@/lib/types/database'

// Editorial triage inbox. Temporarily Kanwar's Gmail until the
// `editorial@oscrsj.com` Google Workspace mailbox is provisioned
// (Kanwar action item 3a on the CEO Dashboard). Flip this single
// constant once Workspace is live; server action picks it up on next
// deploy, no schema change.
const INTERNAL_EDITORIAL_EMAIL = 'kanwarparhar@gmail.com'

const CAREER_STAGES = [
  'med_student',
  'resident',
  'fellow',
  'attending',
  'other',
] as const

type CareerStage = (typeof CAREER_STAGES)[number]

const ORCID_REGEX = /^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/

export interface ReviewerApplicationPayload {
  firstName: string
  lastName: string
  email: string
  orcidId: string | null
  affiliation: string
  country: string
  careerStage: CareerStage
  subspecialtyInterests: string[]
  writingSampleUrl: string | null
  heardAbout: string | null
  consentAccepted: boolean
}

export interface ReviewerApplicationResult {
  success?: true
  applicationId?: string
  error?: string
}

function normalizeString(value: unknown, max = 500): string {
  if (typeof value !== 'string') return ''
  return value.trim().slice(0, max)
}

function normalizeOptional(value: unknown, max = 500): string | null {
  const trimmed = normalizeString(value, max)
  return trimmed.length > 0 ? trimmed : null
}

function isValidEmail(email: string): boolean {
  // Minimal sanity check — let Resend / the DB catch edge cases.
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254
}

function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

export async function submitReviewerApplication(
  payload: ReviewerApplicationPayload
): Promise<ReviewerApplicationResult> {
  // ---- Validate ----
  const firstName = normalizeString(payload.firstName, 120)
  const lastName = normalizeString(payload.lastName, 120)
  const email = normalizeString(payload.email, 254).toLowerCase()
  const affiliation = normalizeString(payload.affiliation, 250)
  const country = normalizeString(payload.country, 120)
  const orcidId = normalizeOptional(payload.orcidId, 40)
  const writingSampleUrl = normalizeOptional(payload.writingSampleUrl, 500)
  const heardAbout = normalizeOptional(payload.heardAbout, 500)
  const subspecialtyInterests = Array.isArray(payload.subspecialtyInterests)
    ? Array.from(
        new Set(
          payload.subspecialtyInterests
            .map((s) => normalizeString(s, 80))
            .filter((s) => s.length > 0)
        )
      ).slice(0, 20)
    : []

  if (!firstName) return { error: 'First name is required.' }
  if (!lastName) return { error: 'Last name is required.' }
  if (!email || !isValidEmail(email))
    return { error: 'A valid email address is required.' }
  if (!affiliation) return { error: 'Institutional affiliation is required.' }
  if (!country) return { error: 'Country is required.' }
  if (!CAREER_STAGES.includes(payload.careerStage))
    return { error: 'Career stage is required.' }
  if (subspecialtyInterests.length === 0)
    return { error: 'Select at least one subspecialty interest.' }
  if (orcidId && !ORCID_REGEX.test(orcidId))
    return {
      error: 'ORCID iD must match the format 0000-0000-0000-0000.',
    }
  if (writingSampleUrl && !isValidUrl(writingSampleUrl))
    return { error: 'Writing sample URL must be a valid http/https link.' }
  if (!payload.consentAccepted)
    return {
      error:
        'Please confirm the privacy / outreach consent before submitting.',
    }

  // ---- Insert ----
  const admin = createAdminClient()

  const { data: inserted, error: insertErr } = await (
    admin.from('reviewer_applications') as any
  )
    .insert({
      first_name: firstName,
      last_name: lastName,
      email,
      orcid_id: orcidId,
      affiliation,
      country,
      career_stage: payload.careerStage,
      subspecialty_interests: subspecialtyInterests,
      writing_sample_url: writingSampleUrl,
      heard_about: heardAbout,
    })
    .select('id')
    .single()

  if (insertErr || !inserted) {
    // Unique constraint on `email` surfaces with Postgres code 23505.
    if (insertErr?.code === '23505') {
      return {
        error:
          'An application with this email address already exists. If you need to update it, reply to our earlier confirmation email.',
      }
    }
    return {
      error: `Failed to submit application: ${
        insertErr?.message || 'unknown error'
      }`,
    }
  }

  const applicationId = (inserted as { id: string }).id

  // ---- Fire emails (fire-and-forget) ----
  // A mail failure must NOT roll back the application row. The
  // applicant's data is the source of truth; email is a convenience
  // notification on top.
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    'https://www.oscrsj.com'
  const forReviewersUrl = `${siteUrl.replace(/\/$/, '')}/for-reviewers`

  try {
    const applicantName = `${firstName} ${lastName}`
    const applicant = renderReviewerApplicationConfirmation({
      applicantName,
      forReviewersUrl,
    })
    await sendEmail({
      to: email,
      subject: getReviewerApplicationConfirmationSubject(),
      html: applicant.html,
      text: applicant.text,
      emailType: 'reviewer_application_confirmation',
    })
  } catch {
    // Logged inside sendEmail; don't fail the flow.
  }

  try {
    const internal = renderReviewerApplicationInternalNotification({
      firstName,
      lastName,
      email,
      orcidId,
      affiliation,
      country,
      careerStage: payload.careerStage,
      subspecialtyInterests,
      writingSampleUrl,
      heardAbout,
      applicationId,
    })
    await sendEmail({
      to: INTERNAL_EDITORIAL_EMAIL,
      subject: getReviewerApplicationInternalSubject(firstName, lastName),
      html: internal.html,
      text: internal.text,
      emailType: 'reviewer_application_internal',
    })
  } catch {
    // Same — internal notification is convenience, not correctness.
  }

  return { success: true, applicationId }
}


// ============================================================
// Admin — list + triage
// ============================================================
//
// Every admin action below re-checks editor/admin role on the
// authenticated user before touching the admin client. The UI
// layout at /dashboard/admin/* also gates on the same check — the
// re-check here closes the gap for direct POSTs bypassing the UI.

const REVIEWER_APPLICATION_STATUSES: readonly ReviewerApplicationStatus[] = [
  'pending',
  'approved',
  'active',
  'declined',
  'withdrawn',
] as const

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

export interface ListReviewerApplicationsArgs {
  status?: ReviewerApplicationStatus | 'all'
}

export interface ListReviewerApplicationsResult {
  applications?: ReviewerApplicationRow[]
  error?: string
}

export async function listReviewerApplications(
  args: ListReviewerApplicationsArgs = {}
): Promise<ListReviewerApplicationsResult> {
  const gate = await requireEditorOrAdmin()
  if ('error' in gate) return { error: gate.error }

  const admin = createAdminClient()
  let query = (admin.from('reviewer_applications') as any)
    .select('*')
    .order('created_at', { ascending: false })

  if (args.status && args.status !== 'all') {
    query = query.eq('status', args.status)
  }

  const { data, error } = await query
  if (error) return { error: error.message }
  return { applications: (data || []) as ReviewerApplicationRow[] }
}

export interface UpdateReviewerApplicationStatusArgs {
  applicationId: string
  newStatus: ReviewerApplicationStatus
  adminNotes?: string | null
}

export interface UpdateReviewerApplicationStatusResult {
  success?: true
  error?: string
}

export async function updateReviewerApplicationStatus(
  args: UpdateReviewerApplicationStatusArgs
): Promise<UpdateReviewerApplicationStatusResult> {
  const gate = await requireEditorOrAdmin()
  if ('error' in gate) return { error: gate.error }

  if (!REVIEWER_APPLICATION_STATUSES.includes(args.newStatus)) {
    return { error: 'Invalid status.' }
  }
  if (!args.applicationId || typeof args.applicationId !== 'string') {
    return { error: 'Application id is required.' }
  }

  const admin = createAdminClient()

  // Snapshot prior status for the audit trail.
  const { data: prior, error: priorErr } = await (
    admin.from('reviewer_applications') as any
  )
    .select('status')
    .eq('id', args.applicationId)
    .single()

  if (priorErr || !prior) {
    return { error: 'Application not found.' }
  }

  const patch: Record<string, unknown> = {
    status: args.newStatus,
    reviewed_by: gate.userId,
    reviewed_at: new Date().toISOString(),
  }
  if (typeof args.adminNotes === 'string') {
    patch.admin_notes = args.adminNotes.trim().slice(0, 4000) || null
  }

  const { error: updateErr } = await (
    admin.from('reviewer_applications') as any
  )
    .update(patch)
    .eq('id', args.applicationId)

  if (updateErr) return { error: updateErr.message }

  // Best-effort audit log. Never fail the action on a log error.
  try {
    await (admin.from('audit_logs') as any).insert({
      user_id: gate.userId,
      action: 'reviewer_application_status_changed',
      resource_type: 'reviewer_application',
      resource_id: args.applicationId,
      details: {
        from_status: (prior as { status: string }).status,
        to_status: args.newStatus,
        notes_updated: typeof args.adminNotes === 'string',
      },
    })
  } catch {
    // swallow
  }

  revalidatePath('/dashboard/admin/reviewer-applications')
  return { success: true }
}

export interface UpdateReviewerApplicationAdminNotesArgs {
  applicationId: string
  notes: string
}

export async function updateReviewerApplicationAdminNotes(
  args: UpdateReviewerApplicationAdminNotesArgs
): Promise<UpdateReviewerApplicationStatusResult> {
  const gate = await requireEditorOrAdmin()
  if ('error' in gate) return { error: gate.error }

  if (!args.applicationId || typeof args.applicationId !== 'string') {
    return { error: 'Application id is required.' }
  }

  const admin = createAdminClient()
  const trimmed = (args.notes || '').trim().slice(0, 4000)

  const { error } = await (admin.from('reviewer_applications') as any)
    .update({
      admin_notes: trimmed.length > 0 ? trimmed : null,
      reviewed_by: gate.userId,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', args.applicationId)

  if (error) return { error: error.message }
  revalidatePath('/dashboard/admin/reviewer-applications')
  return { success: true }
}


// ============================================================
// Reviewer invitation workflow (Session 9, Phase 2 kickoff)
// ============================================================

const MANUSCRIPT_TYPE_LABELS: Record<string, string> = {
  case_report: 'Case Report',
  case_series: 'Case Series',
  surgical_technique: 'Surgical Technique',
  images_in_orthopedics: 'Images in Orthopedics',
  letter_to_editor: 'Letter to the Editor',
  review_article: 'Review Article',
}

const INVITABLE_MANUSCRIPT_STATUSES = [
  'submitted',
  'under_review',
  'revision_received',
] as const

function siteUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    'https://www.oscrsj.com'
  return raw.replace(/\/$/, '')
}

function addDays(from: Date, days: number): Date {
  const d = new Date(from)
  d.setUTCDate(d.getUTCDate() + days)
  return d
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

function teaseAbstract(abstract: string | null, maxLength = 900): string {
  const trimmed = (abstract || '').trim()
  if (!trimmed) return 'No abstract provided.'
  if (trimmed.length <= maxLength) return trimmed
  return `${trimmed.slice(0, maxLength).trimEnd()}…`
}

export interface InviteReviewerArgs {
  manuscriptId: string
  reviewerApplicationId: string
  deadline?: string | null
  editorNote?: string | null
}

export interface InviteReviewerResult {
  success?: true
  invitationId?: string
  alreadyInvited?: true
  error?: string
}

export async function inviteReviewer(
  args: InviteReviewerArgs
): Promise<InviteReviewerResult> {
  const gate = await requireEditorOrAdmin()
  if ('error' in gate) return { error: gate.error }

  if (!args.manuscriptId || typeof args.manuscriptId !== 'string') {
    return { error: 'Manuscript id is required.' }
  }
  if (
    !args.reviewerApplicationId ||
    typeof args.reviewerApplicationId !== 'string'
  ) {
    return { error: 'Reviewer application id is required.' }
  }

  const admin = createAdminClient()

  // Load + validate application
  const { data: appData, error: appErr } = await admin
    .from('reviewer_applications')
    .select('*')
    .eq('id', args.reviewerApplicationId)
    .single()

  if (appErr || !appData) return { error: 'Reviewer application not found.' }
  const application = appData as ReviewerApplicationRow
  if (application.status !== 'active') {
    return {
      error:
        'Only reviewer applications with status "active" may be invited.',
    }
  }

  // Load + validate manuscript
  const { data: mData, error: mErr } = await admin
    .from('manuscripts')
    .select('*')
    .eq('id', args.manuscriptId)
    .single()

  if (mErr || !mData) return { error: 'Manuscript not found.' }
  const manuscript = mData as ManuscriptRow
  if (
    !(INVITABLE_MANUSCRIPT_STATUSES as readonly string[]).includes(
      manuscript.status
    )
  ) {
    return {
      error: `Manuscripts in status "${manuscript.status}" cannot have reviewer invitations issued.`,
    }
  }

  // Idempotency: skip if a non-terminal invitation already exists for this
  // (manuscript, application) pair.
  const { data: existing } = await admin
    .from('review_invitations')
    .select('id, status')
    .eq('manuscript_id', args.manuscriptId)
    .eq('reviewer_application_id', args.reviewerApplicationId)
    .in('status', ['invited', 'accepted'])
    .limit(1)

  if (Array.isArray(existing) && existing.length > 0) {
    return { alreadyInvited: true, invitationId: (existing[0] as any).id }
  }

  // Compute deadline. Default to invited_date + 21 days per §4.5 of
  // the Submission Portal Architecture Plan.
  let deadlineIso: string | null = null
  if (args.deadline && typeof args.deadline === 'string') {
    const parsed = new Date(args.deadline)
    if (!Number.isNaN(parsed.getTime())) deadlineIso = parsed.toISOString()
  }
  if (!deadlineIso) {
    deadlineIso = addDays(new Date(), 21).toISOString()
  }

  const editorNote =
    typeof args.editorNote === 'string'
      ? args.editorNote.trim().slice(0, 500) || null
      : null

  const insertPayload: Record<string, unknown> = {
    manuscript_id: args.manuscriptId,
    reviewer_application_id: args.reviewerApplicationId,
    reviewer_email: application.email,
    reviewer_first_name: application.first_name,
    reviewer_last_name: application.last_name,
    deadline: deadlineIso,
  }

  const { data: inserted, error: insertErr } = await (
    admin.from('review_invitations') as any
  )
    .insert(insertPayload)
    .select('id, review_token')
    .single()

  if (insertErr || !inserted) {
    return {
      error: `Failed to create invitation: ${
        insertErr?.message || 'unknown error'
      }`,
    }
  }

  const invitation = inserted as { id: string; review_token: string }
  const base = siteUrl()
  const acceptUrl = `${base}/review/${invitation.review_token}?action=accept`
  const declineUrl = `${base}/review/${invitation.review_token}?action=decline`

  // Fire invitation email (fire-and-forget)
  try {
    const { html, text } = renderReviewerInvitation({
      firstName: application.first_name,
      manuscriptTitle: manuscript.title || '(untitled manuscript)',
      manuscriptType:
        MANUSCRIPT_TYPE_LABELS[manuscript.manuscript_type || ''] ||
        manuscript.manuscript_type ||
        'Not specified',
      subspecialty: manuscript.subspecialty || 'Not specified',
      abstractTeaser: teaseAbstract(manuscript.abstract),
      deadlineLabel: formatDeadline(deadlineIso),
      editorNote,
      acceptUrl,
      declineUrl,
    })
    await sendEmail({
      to: application.email,
      subject: getReviewerInvitationSubject(
        manuscript.title || '(untitled manuscript)'
      ),
      html,
      text,
      emailType: 'reviewer_invitation',
      manuscriptId: args.manuscriptId,
    })
  } catch {
    // fire-and-forget
  }

  // Audit log
  try {
    await (admin.from('audit_logs') as any).insert({
      user_id: gate.userId,
      action: 'invite_sent',
      resource_type: 'review_invitation',
      resource_id: invitation.id,
      details: {
        invitation_id: invitation.id,
        manuscript_id: args.manuscriptId,
        reviewer_application_id: args.reviewerApplicationId,
        reviewer_email: application.email,
      },
    })
  } catch {
    // swallow
  }

  revalidatePath(`/dashboard/admin/manuscripts/${args.manuscriptId}`)
  return { success: true, invitationId: invitation.id }
}

// ---- List helpers used by the admin UI ----

export interface ListInvitationsForManuscriptResult {
  invitations?: ReviewInvitationRow[]
  error?: string
}

export async function listInvitationsForManuscript(
  manuscriptId: string
): Promise<ListInvitationsForManuscriptResult> {
  const gate = await requireEditorOrAdmin()
  if ('error' in gate) return { error: gate.error }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('review_invitations')
    .select('*')
    .eq('manuscript_id', manuscriptId)
    .order('invited_date', { ascending: false })

  if (error) return { error: error.message }
  return { invitations: (data || []) as ReviewInvitationRow[] }
}

// ============================================================
// Public token-based accept / decline
// ============================================================
// The review_token is a gen_random_uuid()::text value (122 bits of
// entropy) embedded in the invitation email. It is the sole
// authentication gate for these two actions -- the invitee does not
// need an OSCRSJ account.

const INVITATION_EXPIRY_DAYS = 60

function isInvitationExpired(invitedDate: string): boolean {
  try {
    const invited = new Date(invitedDate).getTime()
    const now = Date.now()
    const msPerDay = 1000 * 60 * 60 * 24
    return now - invited > INVITATION_EXPIRY_DAYS * msPerDay
  } catch {
    return false
  }
}

export interface InvitationResponseResult {
  success?: true
  invitationStatus?: 'accepted' | 'declined'
  manuscriptId?: string
  error?: string
  alreadyResponded?: true
  expired?: true
  notFound?: true
  cancelled?: true
}

async function sendInvitationFollowupEmails(
  invitation: ReviewInvitationRow,
  manuscript: ManuscriptRow | null,
  accepted: boolean,
  declinedReason: string | null
) {
  const firstName = invitation.reviewer_first_name || 'Reviewer'
  const reviewerName =
    [invitation.reviewer_first_name, invitation.reviewer_last_name]
      .filter(Boolean)
      .join(' ')
      .trim() || 'Reviewer'
  const reviewerEmail = invitation.reviewer_email || ''
  const title = manuscript?.title || '(untitled manuscript)'
  const submissionId = manuscript?.submission_id || manuscript?.id || '—'

  if (reviewerEmail) {
    try {
      const { html, text } = renderReviewerInvitationConfirmation({
        firstName,
        manuscriptTitle: title,
        accepted,
        declinedReason,
      })
      await sendEmail({
        to: reviewerEmail,
        subject: getReviewerInvitationConfirmationSubject(accepted),
        html,
        text,
        emailType: accepted
          ? 'reviewer_invitation_accepted_confirmation'
          : 'reviewer_invitation_declined_confirmation',
        manuscriptId: invitation.manuscript_id,
      })
    } catch {
      // swallow
    }
  }

  try {
    const { html, text } = renderReviewerInvitationEditorNotification({
      invitationId: invitation.id,
      manuscriptTitle: title,
      submissionId,
      reviewerName,
      reviewerEmail,
      accepted,
      declinedReason,
      respondedAt: new Date().toISOString(),
    })
    await sendEmail({
      to: INTERNAL_EDITORIAL_EMAIL,
      subject: getReviewerInvitationEditorNotificationSubject(
        submissionId,
        accepted
      ),
      html,
      text,
      emailType: accepted
        ? 'reviewer_invitation_accepted_editor'
        : 'reviewer_invitation_declined_editor',
      manuscriptId: invitation.manuscript_id,
    })
  } catch {
    // swallow
  }
}

export async function acceptReviewInvitation(
  token: string
): Promise<InvitationResponseResult> {
  if (!token || typeof token !== 'string') {
    return { error: 'Invitation token is required.', notFound: true }
  }

  const admin = createAdminClient()
  const { data: invData, error: invErr } = await admin
    .from('review_invitations')
    .select('*')
    .eq('review_token', token)
    .single()

  if (invErr || !invData) return { notFound: true, error: 'Invitation not found.' }
  const invitation = invData as ReviewInvitationRow

  if (invitation.status === 'cancelled') {
    return {
      cancelled: true,
      error: 'This invitation has been cancelled.',
    }
  }
  if (
    invitation.status === 'accepted' ||
    invitation.status === 'declined' ||
    invitation.status === 'submitted'
  ) {
    return {
      alreadyResponded: true,
      error: 'This invitation has already been responded to.',
    }
  }
  if (isInvitationExpired(invitation.invited_date)) {
    return {
      expired: true,
      error: 'This invitation has expired.',
    }
  }

  const nowIso = new Date().toISOString()
  const { error: updateErr } = await (
    admin.from('review_invitations') as any
  )
    .update({ status: 'accepted', response_date: nowIso })
    .eq('id', invitation.id)

  if (updateErr) return { error: updateErr.message }

  // Load manuscript for email context
  const { data: mData } = await admin
    .from('manuscripts')
    .select('*')
    .eq('id', invitation.manuscript_id)
    .single()
  const manuscript = (mData as ManuscriptRow | null) || null

  try {
    await (admin.from('audit_logs') as any).insert({
      action: 'invitation_accepted',
      resource_type: 'review_invitation',
      resource_id: invitation.id,
      details: {
        invitation_id: invitation.id,
        manuscript_id: invitation.manuscript_id,
        reviewer_email: invitation.reviewer_email,
      },
    })
  } catch {
    // swallow
  }

  await sendInvitationFollowupEmails(
    { ...invitation, status: 'accepted', response_date: nowIso },
    manuscript,
    true,
    null
  )

  revalidatePath(`/review/${token}`)
  return {
    success: true,
    invitationStatus: 'accepted',
    manuscriptId: invitation.manuscript_id,
  }
}

export async function declineReviewInvitation(
  token: string,
  reason?: string | null
): Promise<InvitationResponseResult> {
  if (!token || typeof token !== 'string') {
    return { error: 'Invitation token is required.', notFound: true }
  }

  const admin = createAdminClient()
  const { data: invData, error: invErr } = await admin
    .from('review_invitations')
    .select('*')
    .eq('review_token', token)
    .single()

  if (invErr || !invData) return { notFound: true, error: 'Invitation not found.' }
  const invitation = invData as ReviewInvitationRow

  if (invitation.status === 'cancelled') {
    return { cancelled: true, error: 'This invitation has been cancelled.' }
  }
  if (
    invitation.status === 'accepted' ||
    invitation.status === 'declined' ||
    invitation.status === 'submitted'
  ) {
    return {
      alreadyResponded: true,
      error: 'This invitation has already been responded to.',
    }
  }
  if (isInvitationExpired(invitation.invited_date)) {
    return { expired: true, error: 'This invitation has expired.' }
  }

  const trimmedReason =
    typeof reason === 'string' ? reason.trim().slice(0, 500) || null : null

  const nowIso = new Date().toISOString()
  const { error: updateErr } = await (
    admin.from('review_invitations') as any
  )
    .update({
      status: 'declined',
      response_date: nowIso,
      declined_reason: trimmedReason,
    })
    .eq('id', invitation.id)

  if (updateErr) return { error: updateErr.message }

  const { data: mData } = await admin
    .from('manuscripts')
    .select('*')
    .eq('id', invitation.manuscript_id)
    .single()
  const manuscript = (mData as ManuscriptRow | null) || null

  try {
    await (admin.from('audit_logs') as any).insert({
      action: 'invitation_declined',
      resource_type: 'review_invitation',
      resource_id: invitation.id,
      details: {
        invitation_id: invitation.id,
        manuscript_id: invitation.manuscript_id,
        reviewer_email: invitation.reviewer_email,
        declined_reason: trimmedReason,
      },
    })
  } catch {
    // swallow
  }

  await sendInvitationFollowupEmails(
    {
      ...invitation,
      status: 'declined',
      response_date: nowIso,
      declined_reason: trimmedReason,
    },
    manuscript,
    false,
    trimmedReason
  )

  revalidatePath(`/review/${token}`)
  return {
    success: true,
    invitationStatus: 'declined',
    manuscriptId: invitation.manuscript_id,
  }
}
