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
import {
  renderReviewerManuscriptPackage,
  getReviewerManuscriptPackageSubject,
} from '@/lib/email/templates/reviewerManuscriptPackage'
import {
  buildReviewerPackage,
  getReviewerPackageSignedUrl,
} from '@/lib/reviewer-package/build'
import {
  renderReviewSubmittedConfirmation,
  getReviewSubmittedConfirmationSubject,
} from '@/lib/email/templates/reviewSubmittedConfirmation'
import {
  renderReviewSubmittedEditorNotification,
  getReviewSubmittedEditorNotificationSubject,
} from '@/lib/email/templates/reviewSubmittedEditorNotification'
import {
  renderAllReviewsReceivedEditorNotification,
  getAllReviewsReceivedEditorNotificationSubject,
} from '@/lib/email/templates/allReviewsReceivedEditorNotification'
import type {
  ManuscriptRow,
  ManuscriptFileRow,
  ReviewInvitationRow,
  ReviewRow,
  ReviewRecommendation,
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

export type InviteReviewerArgs =
  | {
      mode: 'application'
      manuscriptId: string
      reviewerApplicationId: string
      deadline?: string | null
      editorNote?: string | null
    }
  | {
      mode: 'email'
      manuscriptId: string
      reviewerEmail: string
      reviewerFirstName: string
      reviewerLastName: string
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
  if (args.mode !== 'application' && args.mode !== 'email') {
    return { error: 'Invalid invite mode.' }
  }

  const admin = createAdminClient()

  // ---- Resolve invitee identity from mode ----
  let reviewerApplicationId: string | null = null
  let reviewerEmail = ''
  let reviewerFirstName = ''
  let reviewerLastName = ''

  if (args.mode === 'application') {
    if (
      !args.reviewerApplicationId ||
      typeof args.reviewerApplicationId !== 'string'
    ) {
      return { error: 'Reviewer application id is required.' }
    }

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
    reviewerApplicationId = application.id
    reviewerEmail = application.email
    reviewerFirstName = application.first_name
    reviewerLastName = application.last_name
  } else {
    // mode === 'email'
    const firstName = normalizeString(args.reviewerFirstName, 120)
    const lastName = normalizeString(args.reviewerLastName, 120)
    const emailRaw = normalizeString(args.reviewerEmail, 254).toLowerCase()
    if (!firstName) return { error: 'First name is required.' }
    if (!lastName) return { error: 'Last name is required.' }
    if (!emailRaw || !isValidEmail(emailRaw)) {
      return { error: 'A valid reviewer email address is required.' }
    }
    reviewerEmail = emailRaw
    reviewerFirstName = firstName
    reviewerLastName = lastName
  }

  // ---- Load + validate manuscript ----
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

  // ---- Idempotency ----
  // Application path: match on (manuscript, application_id).
  // Email path: match on (manuscript, lower(reviewer_email)) — covers both
  // prior email-path invites and prior application-path invites whose snapshot
  // email matches, so we don't double-invite the same human across both paths.
  if (args.mode === 'application' && reviewerApplicationId) {
    const { data: existing } = await admin
      .from('review_invitations')
      .select('id, status')
      .eq('manuscript_id', args.manuscriptId)
      .eq('reviewer_application_id', reviewerApplicationId)
      .in('status', ['invited', 'accepted'])
      .limit(1)

    if (Array.isArray(existing) && existing.length > 0) {
      return { alreadyInvited: true, invitationId: (existing[0] as any).id }
    }
  } else {
    const { data: existing } = await admin
      .from('review_invitations')
      .select('id, status')
      .eq('manuscript_id', args.manuscriptId)
      .ilike('reviewer_email', reviewerEmail)
      .in('status', ['invited', 'accepted'])
      .limit(1)

    if (Array.isArray(existing) && existing.length > 0) {
      return { alreadyInvited: true, invitationId: (existing[0] as any).id }
    }
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
    reviewer_application_id: reviewerApplicationId,
    reviewer_email: reviewerEmail,
    reviewer_first_name: reviewerFirstName,
    reviewer_last_name: reviewerLastName,
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
      firstName: reviewerFirstName,
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
      to: reviewerEmail,
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
        invite_method: args.mode,
        reviewer_application_id: reviewerApplicationId,
        reviewer_email: reviewerEmail,
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

// ---- Reviewer package delivery (fired after acceptance) ----
//
// On accept, kick off the combined-.docx build, then deliver the
// package to the reviewer in a separate editorial-team email.
// First reviewer on a given version pays the build cost (~5-8 sec
// for typical case reports); subsequent reviewers hit the cache.
// Hard cap: ~22 MB raw bytes for inline attachment (Resend's 40 MB
// per-message ceiling minus base64 inflation overhead). Anything
// larger ships as a 14-day signed download URL instead.
const PACKAGE_ATTACHMENT_MAX_BYTES = 22 * 1024 * 1024
const PACKAGE_LINK_TTL_SECONDS = 14 * 24 * 60 * 60 // 14 days

async function sendReviewerPackageEmail(
  invitation: ReviewInvitationRow,
  manuscript: ManuscriptRow | null
): Promise<void> {
  const reviewerEmail = invitation.reviewer_email || ''
  if (!reviewerEmail) return
  const firstName = invitation.reviewer_first_name || 'Reviewer'
  const manuscriptTitle = manuscript?.title || '(untitled manuscript)'
  const submissionId = manuscript?.submission_id || invitation.manuscript_id
  const manuscriptType =
    MANUSCRIPT_TYPE_LABELS[manuscript?.manuscript_type || ''] ||
    manuscript?.manuscript_type ||
    'Not specified'
  const subspecialty = manuscript?.subspecialty || 'Not specified'
  const reviewFormUrl = `${siteUrl()}/review/${invitation.review_token}/form`
  const fallbackManuscriptUrl = `${siteUrl()}/review/${invitation.review_token}/manuscript`
  const deadlineLabel = formatDeadline(invitation.deadline)

  const admin = createAdminClient()

  // ---- Run the build ----
  // No timeout race here: the build runs synchronously inside the
  // function. On Vercel Hobby (10s ceiling) a manuscript with many
  // high-res figures may exceed the limit. If that happens, the
  // function is killed and the reviewer doesn't get the package
  // email — but acceptance already committed earlier in
  // acceptReviewInvitation, so they retain access via
  // /review/[token]/manuscript.
  let result
  try {
    result = await buildReviewerPackage({ manuscriptId: invitation.manuscript_id })
  } catch (err) {
    result = {
      ok: false as const,
      error: err instanceof Error ? err.message : 'unknown error',
    }
  }

  // ---- Failure path: fallback email pointing at per-file page ----
  if (!result.ok) {
    try {
      await (admin.from('audit_logs') as any).insert({
        action: 'reviewer_package_build_failed',
        resource_type: 'review_invitation',
        resource_id: invitation.id,
        details: {
          invitation_id: invitation.id,
          manuscript_id: invitation.manuscript_id,
          error: result.error,
          build_in_progress: 'buildInProgress' in result && result.buildInProgress,
        },
      })
    } catch {
      // swallow
    }

    // Notify Kanwar so he can intervene if needed (don't block on this).
    try {
      const subject = `[OSCRSJ alert] Reviewer package build failed — ${submissionId}`
      const note =
        'buildInProgress' in result && result.buildInProgress
          ? 'Another build is already running for this manuscript. The reviewer will receive a fallback email pointing to the per-file download page.'
          : `Reason: ${result.error}`
      await sendEmail({
        to: INTERNAL_EDITORIAL_EMAIL,
        subject,
        html: `<p>${note}</p><p>Reviewer: ${reviewerEmail}<br/>Manuscript: ${submissionId}<br/>Invitation: ${invitation.id}</p><p><a href="${siteUrl()}/dashboard/admin/manuscripts/${invitation.manuscript_id}">Open admin view</a></p>`,
        text: `${note}\n\nReviewer: ${reviewerEmail}\nManuscript: ${submissionId}\nInvitation: ${invitation.id}\n\nAdmin: ${siteUrl()}/dashboard/admin/manuscripts/${invitation.manuscript_id}`,
        emailType: 'reviewer_package_build_failed_internal',
        manuscriptId: invitation.manuscript_id,
      })
    } catch {
      // swallow
    }

    // Reviewer-facing fallback email — keep it simple, point them
    // at the per-file download page so they're never blocked.
    try {
      const fallbackHtml = `
        <p>Dear ${escapeBasic(firstName)},</p>
        <p>Thank you again for agreeing to review for OSCRSJ. Your blinded manuscript files are ready for download.</p>
        <p>The combined package is still being assembled. While we finish that, you can already access the individual files:</p>
        <p><a href="${fallbackManuscriptUrl}">Open the reviewer file page</a></p>
        <p>If you'd prefer the combined Word document, please reply to this email and we'll send it along once it's ready.</p>
        <p>With appreciation,<br/>The OSCRSJ Editorial Office</p>
      `
      await sendEmail({
        to: reviewerEmail,
        subject: `Manuscript files ready — ${submissionId} — OSCRSJ`,
        html: fallbackHtml,
        text: `Dear ${firstName},\n\nThank you again for agreeing to review for OSCRSJ. Your blinded manuscript files are ready for download.\n\nThe combined package is still being assembled. While we finish that, you can already access the individual files:\n${fallbackManuscriptUrl}\n\nIf you'd prefer the combined Word document, please reply to this email and we'll send it along once it's ready.\n\nWith appreciation,\nThe OSCRSJ Editorial Office`,
        emailType: 'reviewer_package_fallback',
        manuscriptId: invitation.manuscript_id,
      })
    } catch {
      // swallow
    }
    return
  }

  // ---- Success path: decide attachment vs link ----
  // For a cache hit we don't have bytes in hand. Re-download to
  // measure size + (if attaching) embed.
  let packageBytes: Buffer | null = null
  let packageBytesLen = result.bytes
  if (packageBytesLen === 0 || result.cached) {
    try {
      const { data, error } = await admin.storage
        .from('submissions')
        .download(result.storagePath)
      if (!error && data) {
        const ab = await data.arrayBuffer()
        packageBytes = Buffer.from(ab)
        packageBytesLen = packageBytes.length
      }
    } catch {
      // fall through; we'll send the link form
    }
  } else {
    // We just built it; re-download to get the bytes for attachment.
    try {
      const { data } = await admin.storage
        .from('submissions')
        .download(result.storagePath)
      if (data) {
        const ab = await data.arrayBuffer()
        packageBytes = Buffer.from(ab)
        packageBytesLen = packageBytes.length
      }
    } catch {
      // fall through
    }
  }

  const useAttachment =
    packageBytes !== null && packageBytesLen <= PACKAGE_ATTACHMENT_MAX_BYTES

  let downloadUrl: string | null = null
  if (!useAttachment) {
    const { signedUrl } = await getReviewerPackageSignedUrl(
      invitation.manuscript_id,
      result.storagePath,
      PACKAGE_LINK_TTL_SECONDS
    )
    downloadUrl = signedUrl
  }

  const sizeLabel = formatBytes(packageBytesLen)
  const attachmentName = `OSCRSJ-${submissionId}-package.docx`

  try {
    const { html, text } = renderReviewerManuscriptPackage({
      firstName,
      manuscriptTitle,
      submissionId,
      manuscriptType,
      subspecialty,
      deliveryMode: useAttachment ? 'attached' : 'link',
      downloadUrl,
      reviewFormUrl,
      deadlineLabel,
      packageSizeLabel: sizeLabel,
      figureCount: result.figureCount,
      hasTables: result.hasTables,
    })

    await sendEmail({
      to: reviewerEmail,
      subject: getReviewerManuscriptPackageSubject(submissionId),
      html,
      text,
      emailType: 'reviewer_manuscript_package',
      manuscriptId: invitation.manuscript_id,
      ...(useAttachment && packageBytes
        ? {
            attachments: [
              {
                filename: attachmentName,
                content: packageBytes,
                contentType:
                  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
              },
            ],
          }
        : {}),
    })

    // Audit-log success
    try {
      await (admin.from('audit_logs') as any).insert({
        action: result.cached
          ? 'reviewer_package_email_sent'
          : 'reviewer_package_built',
        resource_type: 'review_invitation',
        resource_id: invitation.id,
        details: {
          invitation_id: invitation.id,
          manuscript_id: invitation.manuscript_id,
          version: result.version,
          bytes: packageBytesLen,
          delivery_mode: useAttachment ? 'attached' : 'link',
          cached: result.cached,
          figure_count: result.figureCount,
          has_tables: result.hasTables,
        },
      })
    } catch {
      // swallow
    }
  } catch {
    // sendEmail already logs to email_logs; nothing else to do.
  }
}

function formatBytes(bytes: number): string {
  if (!bytes || bytes < 1) return 'unknown'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function escapeBasic(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
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

  const finalInvitation = {
    ...invitation,
    status: 'accepted' as const,
    response_date: nowIso,
  }

  await sendInvitationFollowupEmails(finalInvitation, manuscript, true, null)

  // Build + deliver the combined manuscript package. Runs after the
  // confirmation/editor emails so that even if the build hits the
  // function-timeout ceiling on a heavy manuscript, the reviewer
  // already has confirmation that their acceptance was recorded.
  // The build itself is cached on `manuscript_metadata` so the
  // second-and-onward reviewers of this manuscript-version skip
  // straight to email delivery (~1-2 sec vs. 5-8 sec).
  await sendReviewerPackageEmail(finalInvitation, manuscript)

  revalidatePath(`/review/${token}`)
  return {
    success: true,
    invitationStatus: 'accepted',
    manuscriptId: invitation.manuscript_id,
  }
}

export interface DeclineSuggestion {
  name?: string | null
  email?: string | null
  reason?: string | null
}

export async function declineReviewInvitation(
  token: string,
  reason?: string | null,
  suggestion?: DeclineSuggestion | null
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

  const altName =
    suggestion && typeof suggestion.name === 'string'
      ? suggestion.name.trim().slice(0, 200) || null
      : null
  const altEmailRaw =
    suggestion && typeof suggestion.email === 'string'
      ? suggestion.email.trim().toLowerCase().slice(0, 254) || null
      : null
  const altEmail =
    altEmailRaw && isValidEmail(altEmailRaw) ? altEmailRaw : null
  if (altEmailRaw && !altEmail) {
    return {
      error:
        'The suggested alternative reviewer email looks invalid. Please double-check it or leave the field blank.',
    }
  }
  const altReason =
    suggestion && typeof suggestion.reason === 'string'
      ? suggestion.reason.trim().slice(0, 500) || null
      : null
  const hasSuggestion = Boolean(altName || altEmail || altReason)

  const nowIso = new Date().toISOString()
  const { error: updateErr } = await (
    admin.from('review_invitations') as any
  )
    .update({
      status: 'declined',
      response_date: nowIso,
      declined_reason: trimmedReason,
      suggested_alternative_name: altName,
      suggested_alternative_email: altEmail,
      suggested_alternative_reason: altReason,
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

  if (hasSuggestion) {
    try {
      await (admin.from('audit_logs') as any).insert({
        action: 'suggested_alternative_reviewer_recorded',
        resource_type: 'review_invitation',
        resource_id: invitation.id,
        details: {
          invitation_id: invitation.id,
          has_name: Boolean(altName),
          has_email: Boolean(altEmail),
          has_reason: Boolean(altReason),
        },
      })
    } catch {
      // swallow
    }
  }

  await sendInvitationFollowupEmails(
    {
      ...invitation,
      status: 'declined',
      response_date: nowIso,
      declined_reason: trimmedReason,
      suggested_alternative_name: altName,
      suggested_alternative_email: altEmail,
      suggested_alternative_reason: altReason,
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


// ============================================================
// Structured review form: save draft + submit (Session 10)
// ============================================================
// Both actions are token-gated — the review_token in the URL IS the
// authentication. No user account is required. The admin client
// bypasses RLS; we re-validate the invitation state on every call.
//
// saveReviewDraft: UPSERT a `reviews` row with is_draft = true.
//   Auto-save fires this every 30s. Never transitions the
//   invitation status. Never fires emails. Silently no-ops if the
//   invitation is not in status = 'accepted'.
//
// submitReview: validate all required fields, UPSERT the `reviews`
//   row with is_draft = false + submitted_date = now(), flip
//   `review_invitations.status` from 'accepted' → 'submitted',
//   audit-log, fire both emails fire-and-forget.

const RECOMMENDATIONS: readonly ReviewRecommendation[] = [
  'accept',
  'minor_revisions',
  'major_revisions',
  'reject',
] as const

const CONFLICT_LEVELS = ['none', 'minor', 'major'] as const
type ConflictLevel = (typeof CONFLICT_LEVELS)[number]

export interface ReviewSubmissionPayload {
  qualityScore: number | null
  noveltyScore: number | null
  rigorScore: number | null
  dataScore: number | null
  clarityScore: number | null
  scopeScore: number | null
  recommendation: ReviewRecommendation | null
  commentsToAuthor: string
  commentsToEditor: string
  conflictLevel: ConflictLevel | null
  conflictDetails: string
}

export interface SaveReviewDraftResult {
  success?: true
  reviewId?: string
  error?: string
  notFound?: true
  wrongState?: true
}

export interface SubmitReviewResult {
  success?: true
  reviewId?: string
  error?: string
  notFound?: true
  alreadySubmitted?: true
  wrongState?: true
  validation?: string
}

function clampLikert(value: unknown, min: number, max: number): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  const rounded = Math.round(value)
  if (rounded < min || rounded > max) return null
  return rounded
}

function formatConflictOfInterest(
  level: ConflictLevel | null,
  details: string
): string | null {
  if (!level) return null
  const trimmed = details.trim().slice(0, 500)
  if (level === 'none') return 'None declared'
  const label = level === 'minor' ? 'Minor' : 'Major'
  if (!trimmed) return label
  return `${label}: ${trimmed}`
}

function normalizePayload(
  raw: ReviewSubmissionPayload
): ReviewSubmissionPayload {
  return {
    qualityScore: clampLikert(raw.qualityScore, 1, 5),
    noveltyScore: clampLikert(raw.noveltyScore, 1, 5),
    rigorScore: clampLikert(raw.rigorScore, 1, 5),
    dataScore: clampLikert(raw.dataScore, 1, 5),
    clarityScore: clampLikert(raw.clarityScore, 1, 5),
    scopeScore: clampLikert(raw.scopeScore, 1, 4),
    recommendation:
      raw.recommendation && RECOMMENDATIONS.includes(raw.recommendation)
        ? raw.recommendation
        : null,
    commentsToAuthor:
      typeof raw.commentsToAuthor === 'string'
        ? raw.commentsToAuthor.slice(0, 20000)
        : '',
    commentsToEditor:
      typeof raw.commentsToEditor === 'string'
        ? raw.commentsToEditor.slice(0, 20000)
        : '',
    conflictLevel:
      raw.conflictLevel && CONFLICT_LEVELS.includes(raw.conflictLevel)
        ? raw.conflictLevel
        : null,
    conflictDetails:
      typeof raw.conflictDetails === 'string'
        ? raw.conflictDetails.slice(0, 2000)
        : '',
  }
}

async function loadInvitationByToken(
  token: string
): Promise<ReviewInvitationRow | null> {
  if (!token || typeof token !== 'string') return null
  const admin = createAdminClient()
  const { data } = await admin
    .from('review_invitations')
    .select('*')
    .eq('review_token', token)
    .maybeSingle()
  return (data as ReviewInvitationRow | null) || null
}

async function loadExistingReviewForInvitation(
  invitationId: string
): Promise<ReviewRow | null> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('reviews')
    .select('*')
    .eq('review_invitation_id', invitationId)
    .maybeSingle()
  return (data as ReviewRow | null) || null
}

export async function saveReviewDraft(
  token: string,
  rawPayload: ReviewSubmissionPayload
): Promise<SaveReviewDraftResult> {
  const invitation = await loadInvitationByToken(token)
  if (!invitation) return { notFound: true, error: 'Invitation not found.' }
  if (invitation.status !== 'accepted') {
    return {
      wrongState: true,
      error: 'This invitation is not in a state that accepts review drafts.',
    }
  }
  if (isInvitationExpired(invitation.invited_date)) {
    return { wrongState: true, error: 'This invitation has expired.' }
  }

  const payload = normalizePayload(rawPayload)
  const admin = createAdminClient()

  const patch = {
    recommendation: payload.recommendation,
    quality_score: payload.qualityScore,
    novelty_score: payload.noveltyScore,
    rigor_score: payload.rigorScore,
    data_score: payload.dataScore,
    clarity_score: payload.clarityScore,
    scope_score: payload.scopeScore,
    comments_to_author: payload.commentsToAuthor || null,
    comments_to_editor: payload.commentsToEditor || null,
    conflict_of_interest: formatConflictOfInterest(
      payload.conflictLevel,
      payload.conflictDetails
    ),
    is_draft: true,
  }

  const existing = await loadExistingReviewForInvitation(invitation.id)

  if (existing) {
    // Don't reopen a submitted review via the draft path.
    if (!existing.is_draft) {
      return {
        wrongState: true,
        error: 'This review has already been submitted.',
      }
    }
    const { error } = await (admin.from('reviews') as any)
      .update(patch)
      .eq('id', existing.id)
    if (error) return { error: error.message }
    return { success: true, reviewId: existing.id }
  }

  const insertPayload = {
    review_invitation_id: invitation.id,
    manuscript_id: invitation.manuscript_id,
    reviewer_id: invitation.reviewer_id,
    review_invitation_id_snapshot_email: invitation.reviewer_email,
    ...patch,
  }

  const { data: inserted, error: insertErr } = await (
    admin.from('reviews') as any
  )
    .insert(insertPayload)
    .select('id')
    .single()

  if (insertErr || !inserted) {
    return {
      error: `Failed to save draft: ${insertErr?.message || 'unknown error'}`,
    }
  }
  return { success: true, reviewId: (inserted as { id: string }).id }
}

export async function submitReview(
  token: string,
  rawPayload: ReviewSubmissionPayload
): Promise<SubmitReviewResult> {
  const invitation = await loadInvitationByToken(token)
  if (!invitation) return { notFound: true, error: 'Invitation not found.' }
  if (invitation.status === 'submitted') {
    return {
      alreadySubmitted: true,
      error: 'This review has already been submitted.',
    }
  }
  if (invitation.status !== 'accepted') {
    return {
      wrongState: true,
      error: 'This invitation is not in a state that accepts review submissions.',
    }
  }
  if (isInvitationExpired(invitation.invited_date)) {
    return { wrongState: true, error: 'This invitation has expired.' }
  }

  const payload = normalizePayload(rawPayload)

  // ---- Server-side validation (mirror client) ----
  if (
    payload.qualityScore === null ||
    payload.noveltyScore === null ||
    payload.rigorScore === null ||
    payload.dataScore === null ||
    payload.clarityScore === null ||
    payload.scopeScore === null
  ) {
    return {
      validation: 'All six rating scales are required.',
      error: 'All six rating scales are required.',
    }
  }
  if (!payload.recommendation) {
    return {
      validation: 'A final recommendation is required.',
      error: 'A final recommendation is required.',
    }
  }
  if (!payload.commentsToEditor.trim()) {
    return {
      validation: 'Please paste your feedback and review regarding the manuscript.',
      error: 'Please paste your feedback and review regarding the manuscript.',
    }
  }
  if (!payload.conflictLevel) {
    return {
      validation: 'A conflict-of-interest disclosure is required.',
      error: 'A conflict-of-interest disclosure is required.',
    }
  }
  if (
    (payload.conflictLevel === 'minor' || payload.conflictLevel === 'major') &&
    !payload.conflictDetails.trim()
  ) {
    return {
      validation:
        'Please describe the conflict of interest (required for minor or major disclosures).',
      error:
        'Please describe the conflict of interest (required for minor or major disclosures).',
    }
  }

  const admin = createAdminClient()
  const nowIso = new Date().toISOString()

  const conflictOfInterest = formatConflictOfInterest(
    payload.conflictLevel,
    payload.conflictDetails
  )

  const patch = {
    recommendation: payload.recommendation,
    quality_score: payload.qualityScore,
    novelty_score: payload.noveltyScore,
    rigor_score: payload.rigorScore,
    data_score: payload.dataScore,
    clarity_score: payload.clarityScore,
    scope_score: payload.scopeScore,
    comments_to_author: payload.commentsToAuthor,
    comments_to_editor: payload.commentsToEditor,
    conflict_of_interest: conflictOfInterest,
    is_draft: false,
    submitted_date: nowIso,
  }

  // ---- UPSERT the reviews row ----
  const existing = await loadExistingReviewForInvitation(invitation.id)
  let reviewId: string

  if (existing) {
    if (!existing.is_draft) {
      return {
        alreadySubmitted: true,
        error: 'This review has already been submitted.',
      }
    }
    const { error } = await (admin.from('reviews') as any)
      .update(patch)
      .eq('id', existing.id)
    if (error) return { error: error.message }
    reviewId = existing.id
  } else {
    const insertPayload = {
      review_invitation_id: invitation.id,
      manuscript_id: invitation.manuscript_id,
      reviewer_id: invitation.reviewer_id,
      review_invitation_id_snapshot_email: invitation.reviewer_email,
      ...patch,
    }
    const { data: inserted, error: insertErr } = await (
      admin.from('reviews') as any
    )
      .insert(insertPayload)
      .select('id')
      .single()
    if (insertErr || !inserted) {
      return {
        error: `Failed to submit review: ${
          insertErr?.message || 'unknown error'
        }`,
      }
    }
    reviewId = (inserted as { id: string }).id
  }

  // ---- Flip invitation status to 'submitted' ----
  // We do NOT roll back the review if this UPDATE fails -- better to
  // keep the reviewer's work than lose it. Log the anomaly.
  const { error: invUpdateErr } = await (
    admin.from('review_invitations') as any
  )
    .update({ status: 'submitted', response_date: nowIso })
    .eq('id', invitation.id)

  if (invUpdateErr) {
    try {
      await (admin.from('audit_logs') as any).insert({
        action: 'review_invitation_status_update_failed',
        resource_type: 'review_invitation',
        resource_id: invitation.id,
        details: {
          invitation_id: invitation.id,
          review_id: reviewId,
          error: invUpdateErr.message,
        },
      })
    } catch {
      // swallow
    }
  }

  // ---- Audit log ----
  try {
    await (admin.from('audit_logs') as any).insert({
      action: 'review_submitted',
      resource_type: 'review',
      resource_id: reviewId,
      details: {
        invitation_id: invitation.id,
        manuscript_id: invitation.manuscript_id,
        recommendation: payload.recommendation,
        reviewer_email: invitation.reviewer_email,
      },
    })
  } catch {
    // swallow
  }

  // ---- Load manuscript for email context ----
  const { data: mData } = await admin
    .from('manuscripts')
    .select('*')
    .eq('id', invitation.manuscript_id)
    .single()
  const manuscript = (mData as ManuscriptRow | null) || null

  // ---- Fire emails (fire-and-forget) ----
  const firstName = invitation.reviewer_first_name || 'Reviewer'
  const reviewerName =
    [invitation.reviewer_first_name, invitation.reviewer_last_name]
      .filter(Boolean)
      .join(' ')
      .trim() || 'Reviewer'
  const reviewerEmail = invitation.reviewer_email || ''
  const manuscriptTitle = manuscript?.title || '(untitled manuscript)'
  const submissionId = manuscript?.submission_id || manuscript?.id || '—'
  const adminManuscriptUrl = `${siteUrl()}/dashboard/admin/manuscripts/${invitation.manuscript_id}`

  if (reviewerEmail) {
    try {
      const { html, text } = renderReviewSubmittedConfirmation({
        firstName,
        manuscriptTitle,
      })
      await sendEmail({
        to: reviewerEmail,
        subject: getReviewSubmittedConfirmationSubject(manuscriptTitle),
        html,
        text,
        emailType: 'review_submitted_confirmation',
        manuscriptId: invitation.manuscript_id,
      })
    } catch {
      // swallow
    }
  }

  try {
    const { html, text } = renderReviewSubmittedEditorNotification({
      submissionId,
      manuscriptId: invitation.manuscript_id,
      manuscriptTitle,
      reviewerName,
      reviewerEmail,
      recommendation: payload.recommendation,
      qualityScore: payload.qualityScore,
      noveltyScore: payload.noveltyScore,
      rigorScore: payload.rigorScore,
      dataScore: payload.dataScore,
      clarityScore: payload.clarityScore,
      scopeScore: payload.scopeScore,
      adminManuscriptUrl,
    })
    await sendEmail({
      to: INTERNAL_EDITORIAL_EMAIL,
      subject: getReviewSubmittedEditorNotificationSubject(submissionId),
      html,
      text,
      emailType: 'review_submitted_editor',
      manuscriptId: invitation.manuscript_id,
    })
  } catch {
    // swallow
  }

  // ---- Phase 2 all-reviews-received gate (Session 11) ----
  // Fire-and-forget. Never block the reviewer's UI on the editor email.
  triggerAllReviewsReceivedIfReady(invitation.manuscript_id).catch(
    (err: unknown) => {
      // Best-effort only. Observability comes from email_logs + audit.
      console.error(
        '[submitReview] triggerAllReviewsReceivedIfReady failed',
        err
      )
    }
  )

  revalidatePath(`/review/${token}`)
  revalidatePath(`/review/${token}/form`)
  revalidatePath('/dashboard/reviewer')
  return { success: true, reviewId }
}


// ============================================================
// All-reviews-received helper (Session 11)
// ============================================================
// Called from inside submitReview after the flag-flip + invitation
// status update + reviewer-side email fires. Fires exactly once per
// manuscript when the count of non-draft reviews crosses ≥2,
// gated by manuscript_metadata.all_reviews_notified_at IS NULL.

async function triggerAllReviewsReceivedIfReady(
  manuscriptId: string
): Promise<void> {
  const admin = createAdminClient()

  // Idempotency gate first — cheap column read + short-circuit.
  const { data: metaRow } = await admin
    .from('manuscript_metadata')
    .select('id, all_reviews_notified_at')
    .eq('manuscript_id', manuscriptId)
    .maybeSingle()

  if (!metaRow) return
  const meta = metaRow as {
    id: string
    all_reviews_notified_at: string | null
  }
  if (meta.all_reviews_notified_at) return

  // Count submitted reviews.
  const { count, error: countErr } = await admin
    .from('reviews')
    .select('id', { count: 'exact', head: true })
    .eq('manuscript_id', manuscriptId)
    .eq('is_draft', false)
  if (countErr) return
  const reviewCount = count || 0
  if (reviewCount < 2) return

  // Load reviews for the recommendation summary.
  const { data: reviewsData } = await admin
    .from('reviews')
    .select('recommendation')
    .eq('manuscript_id', manuscriptId)
    .eq('is_draft', false)
  const recCounts: Partial<Record<ReviewRecommendation, number>> = {}
  for (const r of (reviewsData as
    | { recommendation: ReviewRecommendation | null }[]
    | null) || []) {
    if (!r.recommendation) continue
    recCounts[r.recommendation] = (recCounts[r.recommendation] || 0) + 1
  }

  // Load manuscript header.
  const { data: mData } = await admin
    .from('manuscripts')
    .select('*')
    .eq('id', manuscriptId)
    .single()
  const manuscript = (mData as ManuscriptRow | null) || null
  const manuscriptTitle = manuscript?.title || '(untitled manuscript)'
  const submissionId = manuscript?.submission_id || manuscriptId
  const adminManuscriptUrl = `${siteUrl()}/dashboard/admin/manuscripts/${manuscriptId}`

  const { html, text } = renderAllReviewsReceivedEditorNotification({
    submissionId,
    manuscriptTitle,
    reviewCount,
    recommendationCounts: recCounts,
    adminManuscriptUrl,
  })

  const { error: sendErr } = await sendEmail({
    to: INTERNAL_EDITORIAL_EMAIL,
    subject: getAllReviewsReceivedEditorNotificationSubject(submissionId),
    html,
    text,
    emailType: 'all_reviews_received_editor',
    manuscriptId,
  })

  if (sendErr) {
    // Do NOT set the idempotency timestamp — lets the next review
    // submission retry the notification.
    return
  }

  await (admin.from('manuscript_metadata') as any)
    .update({ all_reviews_notified_at: new Date().toISOString() })
    .eq('id', meta.id)

  try {
    await (admin.from('audit_logs') as any).insert({
      action: 'all_reviews_received_email_sent',
      resource_type: 'manuscript',
      resource_id: manuscriptId,
      details: {
        manuscript_id: manuscriptId,
        review_count: reviewCount,
      },
    })
  } catch {
    // swallow
  }
}


// ============================================================
// Reviewer file download signed URL (Session 10)
// ============================================================
// Token-gated. Validates the invitation is accepted or submitted,
// confirms the requested file belongs to the invitation's
// manuscript, confirms the file_type is in the blinded-safe
// allowlist, then returns a 30-minute Supabase Storage signed URL.

const REVIEWER_SAFE_FILE_TYPES = [
  'blinded_manuscript',
  'tables',
  'figure',
  'supplement',
] as const

const SIGNED_URL_TTL_SECONDS = 30 * 60

export interface GetReviewerFileSignedUrlResult {
  signedUrl?: string
  fileName?: string
  error?: string
  notFound?: true
  forbidden?: true
}

export async function getReviewerFileSignedUrl(
  token: string,
  fileId: string
): Promise<GetReviewerFileSignedUrlResult> {
  if (!token || typeof token !== 'string') {
    return { notFound: true, error: 'Invitation token is required.' }
  }
  if (!fileId || typeof fileId !== 'string') {
    return { notFound: true, error: 'File id is required.' }
  }

  const invitation = await loadInvitationByToken(token)
  if (!invitation) return { notFound: true, error: 'Invitation not found.' }
  if (
    invitation.status !== 'accepted' &&
    invitation.status !== 'submitted'
  ) {
    return {
      forbidden: true,
      error: 'This invitation is not in a state that allows file downloads.',
    }
  }

  const admin = createAdminClient()
  const { data: fData, error: fErr } = await admin
    .from('manuscript_files')
    .select('*')
    .eq('id', fileId)
    .maybeSingle()

  if (fErr || !fData) return { notFound: true, error: 'File not found.' }
  const file = fData as ManuscriptFileRow

  if (file.manuscript_id !== invitation.manuscript_id) {
    return { forbidden: true, error: 'File does not belong to this review.' }
  }
  if (
    !(REVIEWER_SAFE_FILE_TYPES as readonly string[]).includes(file.file_type)
  ) {
    return {
      forbidden: true,
      error: 'This file type is not available to reviewers.',
    }
  }

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

  // Audit log — useful for future fraud detection / access review.
  try {
    await (admin.from('audit_logs') as any).insert({
      action: 'reviewer_file_downloaded',
      resource_type: 'manuscript_file',
      resource_id: file.id,
      details: {
        invitation_id: invitation.id,
        manuscript_id: invitation.manuscript_id,
        file_type: file.file_type,
        reviewer_email: invitation.reviewer_email,
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
// Unified reviewer roster (Session 32 — Sushant)
// ============================================================
// Powers /dashboard/admin/reviewer-applications when it pivots
// from "applicant triage" to a unified reviewer directory. One
// row per reviewer (deduplicated by lower-case email), with
// aggregated counts across all manuscripts they've been invited
// to review.
//
// Bucket precedence (highest tier wins):
//   withdrawn  — editor marked them as withdrawn from reviewing
//   active     — accepted ≥1 invitation AND submitted ≥1 review
//   approved   — accepted ≥1 invitation, no review submitted yet
//   pending    — has ≥1 'invited' invitation, no accepts yet
//   declined   — has invitations, all declined or cancelled
//   applicant  — has a reviewer_applications row but has NEVER
//                been invited (separate "Applicants" tab)
// ============================================================

export type ReviewerRosterBucket =
  | 'applicant'
  | 'pending'
  | 'approved'
  | 'active'
  | 'declined'
  | 'withdrawn'

export interface ReviewerRosterEntry {
  email: string
  firstName: string
  lastName: string
  affiliation: string | null
  country: string | null
  orcidId: string | null
  applicationId: string | null
  applicationStatus: ReviewerApplicationStatus | null
  bucket: ReviewerRosterBucket
  invitationsSent: number
  invitationsAccepted: number
  invitationsDeclined: number
  reviewsSubmitted: number
  latestInvitationDate: string | null
  resendableInvitationId: string | null
  withdrawnReason: string | null
  withdrawnAt: string | null
}

export interface BuildReviewerRosterResult {
  roster?: ReviewerRosterEntry[]
  error?: string
}

export async function buildReviewerRoster(): Promise<BuildReviewerRosterResult> {
  const gate = await requireEditorOrAdmin()
  if ('error' in gate) return { error: gate.error }

  const admin = createAdminClient()

  // ---- Bulk fetch every input collection in parallel ---------
  const [
    invitationsResp,
    applicationsResp,
    reviewsResp,
    withdrawalsResp,
  ] = await Promise.all([
    admin
      .from('review_invitations')
      .select('*')
      .order('invited_date', { ascending: false }),
    admin
      .from('reviewer_applications')
      .select('*')
      .order('created_at', { ascending: false }),
    admin
      .from('reviews')
      .select('id, review_invitation_id, is_draft, submitted_date'),
    admin.from('reviewer_withdrawals').select('*'),
  ])

  if (invitationsResp.error) return { error: invitationsResp.error.message }
  if (applicationsResp.error) return { error: applicationsResp.error.message }
  if (reviewsResp.error) return { error: reviewsResp.error.message }
  // reviewer_withdrawals may not exist yet (migration 018 not run);
  // treat that as an empty list instead of failing the whole page.
  const withdrawalRows: Array<{
    email: string
    reason: string | null
    withdrawn_at: string
  }> = withdrawalsResp.error
    ? []
    : ((withdrawalsResp.data || []) as Array<{
        email: string
        reason: string | null
        withdrawn_at: string
      }>)

  const invitations = (invitationsResp.data || []) as ReviewInvitationRow[]
  const applications = (applicationsResp.data || []) as ReviewerApplicationRow[]
  const reviewRows = (reviewsResp.data || []) as Array<{
    id: string
    review_invitation_id: string | null
    is_draft: boolean
    submitted_date: string | null
  }>

  // Set of invitation IDs that have at least one non-draft review.
  // Used to count reviewsSubmitted and to gate the "active" bucket.
  const submittedInvitationIds = new Set<string>()
  for (const r of reviewRows) {
    if (r.review_invitation_id && r.is_draft === false) {
      submittedInvitationIds.add(r.review_invitation_id)
    }
  }

  // Pre-index applications by lower-case email for O(1) lookup.
  const applicationByEmail = new Map<string, ReviewerApplicationRow>()
  for (const app of applications) {
    const key = (app.email || '').toLowerCase()
    if (!key) continue
    // First-write wins (oldest application kept). Same email
    // re-applying is rare; if it happens we keep the oldest row
    // so its created_at is preserved.
    if (!applicationByEmail.has(key)) applicationByEmail.set(key, app)
  }

  // Pre-index withdrawals by email.
  const withdrawalByEmail = new Map<
    string,
    { reason: string | null; withdrawn_at: string }
  >()
  for (const w of withdrawalRows) {
    const key = (w.email || '').toLowerCase()
    if (!key) continue
    withdrawalByEmail.set(key, {
      reason: w.reason,
      withdrawn_at: w.withdrawn_at,
    })
  }

  // ---- Build a per-email entry as we walk invitations --------
  interface Acc {
    email: string
    firstName: string
    lastName: string
    invitationsSent: number
    invitationsAccepted: number // accepted OR submitted
    invitationsDeclined: number // declined OR cancelled
    invitationsPending: number // invited
    reviewsSubmitted: number
    latestInvitationDate: string | null
    resendableInvitationId: string | null
    resendableInvitedDate: string | null // most recent invited_date among resendable
    applicationId: string | null
    applicationStatus: ReviewerApplicationStatus | null
    affiliation: string | null
    country: string | null
    orcidId: string | null
    firstNameSource: 'application' | 'invitation' | null
  }

  const byEmail = new Map<string, Acc>()

  function ensure(email: string): Acc {
    let acc = byEmail.get(email)
    if (acc) return acc
    const app = applicationByEmail.get(email) || null
    acc = {
      email,
      firstName: app?.first_name || '',
      lastName: app?.last_name || '',
      invitationsSent: 0,
      invitationsAccepted: 0,
      invitationsDeclined: 0,
      invitationsPending: 0,
      reviewsSubmitted: 0,
      latestInvitationDate: null,
      resendableInvitationId: null,
      resendableInvitedDate: null,
      applicationId: app?.id || null,
      applicationStatus: app?.status || null,
      affiliation: app?.affiliation || null,
      country: app?.country || null,
      orcidId: app?.orcid_id || null,
      firstNameSource: app ? 'application' : null,
    }
    byEmail.set(email, acc)
    return acc
  }

  for (const inv of invitations) {
    const email = (inv.reviewer_email || '').toLowerCase()
    if (!email) continue
    const acc = ensure(email)

    // Names: prefer application-side names, otherwise take from
    // the invitation snapshot (covers direct-email invitees who
    // have no application row).
    if (acc.firstNameSource !== 'application') {
      if (!acc.firstName && inv.reviewer_first_name) {
        acc.firstName = inv.reviewer_first_name
        acc.firstNameSource = 'invitation'
      }
      if (!acc.lastName && inv.reviewer_last_name) {
        acc.lastName = inv.reviewer_last_name
      }
    }

    acc.invitationsSent += 1

    if (inv.status === 'invited') {
      acc.invitationsPending += 1
      // Track most-recent resendable invitation by invited_date.
      if (
        !acc.resendableInvitedDate ||
        inv.invited_date > acc.resendableInvitedDate
      ) {
        acc.resendableInvitedDate = inv.invited_date
        acc.resendableInvitationId = inv.id
      }
    } else if (inv.status === 'accepted' || inv.status === 'submitted') {
      acc.invitationsAccepted += 1
      if (submittedInvitationIds.has(inv.id)) {
        acc.reviewsSubmitted += 1
      }
    } else if (inv.status === 'declined' || inv.status === 'cancelled') {
      acc.invitationsDeclined += 1
    }

    if (
      !acc.latestInvitationDate ||
      inv.invited_date > acc.latestInvitationDate
    ) {
      acc.latestInvitationDate = inv.invited_date
    }
  }

  // Add applicants who have NEVER been invited — they show up in
  // the "Applicants" tab so editor triage stays.
  for (const [email, app] of Array.from(applicationByEmail.entries())) {
    if (byEmail.has(email)) continue
    byEmail.set(email, {
      email,
      firstName: app.first_name,
      lastName: app.last_name,
      invitationsSent: 0,
      invitationsAccepted: 0,
      invitationsDeclined: 0,
      invitationsPending: 0,
      reviewsSubmitted: 0,
      latestInvitationDate: null,
      resendableInvitationId: null,
      resendableInvitedDate: null,
      applicationId: app.id,
      applicationStatus: app.status,
      affiliation: app.affiliation,
      country: app.country,
      orcidId: app.orcid_id,
      firstNameSource: 'application',
    })
  }

  // ---- Compute final bucket per row --------------------------
  const roster: ReviewerRosterEntry[] = []
  for (const [email, acc] of Array.from(byEmail.entries())) {
    const withdrawal = withdrawalByEmail.get(email) || null

    let bucket: ReviewerRosterBucket
    if (withdrawal) {
      bucket = 'withdrawn'
    } else if (acc.reviewsSubmitted > 0) {
      bucket = 'active'
    } else if (acc.invitationsAccepted > 0) {
      bucket = 'approved'
    } else if (acc.invitationsPending > 0) {
      bucket = 'pending'
    } else if (acc.invitationsSent > 0) {
      bucket = 'declined'
    } else {
      bucket = 'applicant'
    }

    roster.push({
      email: acc.email,
      firstName: acc.firstName,
      lastName: acc.lastName,
      affiliation: acc.affiliation,
      country: acc.country,
      orcidId: acc.orcidId,
      applicationId: acc.applicationId,
      applicationStatus: acc.applicationStatus,
      bucket,
      invitationsSent: acc.invitationsSent,
      invitationsAccepted: acc.invitationsAccepted,
      invitationsDeclined: acc.invitationsDeclined,
      reviewsSubmitted: acc.reviewsSubmitted,
      latestInvitationDate: acc.latestInvitationDate,
      resendableInvitationId: acc.resendableInvitationId,
      withdrawnReason: withdrawal?.reason || null,
      withdrawnAt: withdrawal?.withdrawn_at || null,
    })
  }

  // Sort: most-recently-touched-first, ties broken by email asc.
  roster.sort((a, b) => {
    const aDate = a.latestInvitationDate || ''
    const bDate = b.latestInvitationDate || ''
    if (aDate !== bDate) return bDate.localeCompare(aDate)
    return a.email.localeCompare(b.email)
  })

  return { roster }
}

// ---- Resend latest pending invitation --------------------------
//
// Per Kanwar: re-fire the reviewerInvitation email for the most
// recent invitation in 'invited' status for this email. Token +
// deadline + reviewer_application_id + manuscript stay the same.
// Audit-logs `reviewer_invitation_resent`.
//
// If no resendable invitation exists, returns `noResendable: true`.

export interface ResendInvitationResult {
  success?: true
  invitationId?: string
  noResendable?: true
  error?: string
}

export async function resendLatestPendingInvitation(
  invitationId: string
): Promise<ResendInvitationResult> {
  const gate = await requireEditorOrAdmin()
  if ('error' in gate) return { error: gate.error }

  if (!invitationId || typeof invitationId !== 'string') {
    return { error: 'Invitation id is required.' }
  }

  const admin = createAdminClient()

  // Load invitation + manuscript in parallel.
  const { data: invData, error: invErr } = await admin
    .from('review_invitations')
    .select('*')
    .eq('id', invitationId)
    .single()

  if (invErr || !invData) return { error: 'Invitation not found.' }
  const invitation = invData as ReviewInvitationRow

  if (invitation.status !== 'invited') {
    return {
      noResendable: true,
      error: `Cannot resend an invitation in status "${invitation.status}". Only 'invited' invitations are resendable.`,
    }
  }

  const { data: mData, error: mErr } = await admin
    .from('manuscripts')
    .select('*')
    .eq('id', invitation.manuscript_id)
    .single()

  if (mErr || !mData) return { error: 'Manuscript not found.' }
  const manuscript = mData as ManuscriptRow

  const reviewerEmail = invitation.reviewer_email || ''
  const firstName = invitation.reviewer_first_name || ''
  if (!reviewerEmail) {
    return { error: 'Invitation has no reviewer email on file.' }
  }

  const base = siteUrl()
  const acceptUrl = `${base}/review/${invitation.review_token}?action=accept`
  const declineUrl = `${base}/review/${invitation.review_token}?action=decline`

  // Best-effort send; swallow Resend errors so the action still
  // succeeds and the audit log records the attempt. The
  // sendEmail() wrapper logs every send to email_logs regardless
  // of outcome.
  try {
    const { html, text } = renderReviewerInvitation({
      firstName,
      manuscriptTitle: manuscript.title || '(untitled manuscript)',
      manuscriptType:
        MANUSCRIPT_TYPE_LABELS[manuscript.manuscript_type || ''] ||
        manuscript.manuscript_type ||
        'Not specified',
      subspecialty: manuscript.subspecialty || 'Not specified',
      abstractTeaser: teaseAbstract(manuscript.abstract),
      deadlineLabel: formatDeadline(invitation.deadline),
      editorNote:
        'A reminder of your earlier review invitation. The Accept and Decline links below are unchanged.',
      acceptUrl,
      declineUrl,
    })
    await sendEmail({
      to: reviewerEmail,
      subject: getReviewerInvitationSubject(
        manuscript.title || '(untitled manuscript)'
      ),
      html,
      text,
      emailType: 'reviewer_invitation',
      manuscriptId: invitation.manuscript_id,
    })
  } catch {
    // fire-and-forget
  }

  try {
    await (admin.from('audit_logs') as any).insert({
      user_id: gate.userId,
      action: 'reviewer_invitation_resent',
      resource_type: 'review_invitation',
      resource_id: invitation.id,
      details: {
        invitation_id: invitation.id,
        manuscript_id: invitation.manuscript_id,
        reviewer_email: reviewerEmail,
      },
    })
  } catch {
    // swallow
  }

  revalidatePath('/dashboard/admin/reviewer-applications')
  return { success: true, invitationId: invitation.id }
}

// ---- Mark / un-mark a reviewer as withdrawn --------------------
//
// Adds (or removes) a row in reviewer_withdrawals keyed by
// lower-case email. Editor-only. Audit-logged. The roster
// aggregator picks up the row on next load and surfaces the
// reviewer in the "Declined" tab with a "Withdrawn" pill.

export interface MarkWithdrawnArgs {
  email: string
  reason?: string | null
  unmark?: boolean
}

export interface MarkWithdrawnResult {
  success?: true
  error?: string
}

export async function markReviewerWithdrawn(
  args: MarkWithdrawnArgs
): Promise<MarkWithdrawnResult> {
  const gate = await requireEditorOrAdmin()
  if ('error' in gate) return { error: gate.error }

  const email = (args.email || '').trim().toLowerCase()
  if (!email || !isValidEmail(email)) {
    return { error: 'A valid email is required.' }
  }

  const admin = createAdminClient()

  if (args.unmark) {
    const { error } = await (admin.from('reviewer_withdrawals') as any)
      .delete()
      .eq('email', email)
    if (error) return { error: error.message }

    try {
      await (admin.from('audit_logs') as any).insert({
        user_id: gate.userId,
        action: 'reviewer_withdrawal_cleared',
        resource_type: 'reviewer_withdrawal',
        resource_id: email,
        details: { email },
      })
    } catch {
      // swallow
    }

    revalidatePath('/dashboard/admin/reviewer-applications')
    return { success: true }
  }

  const reason = normalizeString(args.reason ?? '', 1000) || null

  // Upsert. If a withdrawal already exists for this email, update
  // the reason + timestamp (preserves PK; audit log captures the
  // re-mark). If it doesn't, insert fresh.
  const { error: upsertErr } = await (admin.from('reviewer_withdrawals') as any)
    .upsert(
      {
        email,
        reason,
        withdrawn_at: new Date().toISOString(),
        withdrawn_by: gate.userId,
      },
      { onConflict: 'email' }
    )

  if (upsertErr) return { error: upsertErr.message }

  try {
    await (admin.from('audit_logs') as any).insert({
      user_id: gate.userId,
      action: 'reviewer_marked_withdrawn',
      resource_type: 'reviewer_withdrawal',
      resource_id: email,
      details: { email, reason },
    })
  } catch {
    // swallow
  }

  revalidatePath('/dashboard/admin/reviewer-applications')
  return { success: true }
}
