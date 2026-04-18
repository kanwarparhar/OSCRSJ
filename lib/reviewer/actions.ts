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
import type {
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
