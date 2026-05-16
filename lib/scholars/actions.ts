'use server'

import { revalidatePath } from 'next/cache'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { sendEmail } from '@/lib/email/resend'
import {
  renderCohortApplicationConfirmation,
  getCohortApplicationConfirmationSubject,
} from '@/lib/email/templates/cohortApplicationConfirmation'
import {
  renderCohortApplicationInternalNotification,
  getCohortApplicationInternalSubject,
} from '@/lib/email/templates/cohortApplicationInternalNotification'

// ---------------------------------------------------------------
// Constants
// ---------------------------------------------------------------

// Editorial triage inbox — same routing as reviewer applications.
// Routed to oscrsjournal@gmail.com until a dedicated Google Workspace
// mailbox is provisioned (CLAUDE.md follow-up — Manvir territory).
const INTERNAL_EDITORIAL_EMAIL = 'oscrsjournal@gmail.com'

// CV upload bucket + folder. Stored alongside other application
// artifacts in the existing 'submissions' Storage bucket.
const STORAGE_BUCKET = 'submissions'
const CV_FOLDER = 'cohort-applications'

// 10 MB cap on CV uploads. Resend caps total payload at ~40 MB but we
// don't email the CV; we just store it. 10 MB covers every CV a med
// student could legitimately submit while preventing accidental
// large-file uploads.
const CV_MAX_BYTES = 10 * 1024 * 1024

const ALLOWED_CV_MIME_TYPES = new Set<string>([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
])

const ORCID_REGEX = /^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/

// ---------------------------------------------------------------
// Track + tier label tables (used by emails + admin UI)
// ---------------------------------------------------------------

export type CohortTrack = 'pre_med' | 'med_student' | 'img'
export type CohortTier =
  | 'pre_med_tier_1'
  | 'pre_med_tier_2'
  | 'med_student_tier_1'
  | 'med_student_tier_2'
  | 'img'

export const TRACK_LABELS: Record<CohortTrack, string> = {
  pre_med: 'Pre-Med Scholar',
  med_student: 'Med Student Scholar',
  img: 'IMG Scholar',
}

export const TIER_LABELS: Record<CohortTier, string> = {
  pre_med_tier_1: 'Tier 1 — 6-month program ($499)',
  pre_med_tier_2: 'Tier 2 — 1-year program ($999)',
  med_student_tier_1: 'Tier 1 — 6-month program ($499)',
  med_student_tier_2: 'Tier 2 — 1-year program ($999)',
  img: '6-month program ($299)',
}

// Tier-to-track mapping for validation
const TIER_TO_TRACK: Record<CohortTier, CohortTrack> = {
  pre_med_tier_1: 'pre_med',
  pre_med_tier_2: 'pre_med',
  med_student_tier_1: 'med_student',
  med_student_tier_2: 'med_student',
  img: 'img',
}

// ---------------------------------------------------------------
// Types
// ---------------------------------------------------------------

export interface CohortApplicationReference {
  name: string
  email: string
  relationship: string
  institution: string
}

export interface SubmitCohortApplicationResult {
  success?: true
  applicationId?: string
  error?: string
}

export type CohortApplicationStatus =
  | 'submitted'
  | 'under_review'
  | 'accepted'
  | 'waitlisted'
  | 'rejected'
  | 'withdrawn'

export interface CohortApplicationRow {
  id: string
  created_at: string
  first_name: string
  last_name: string
  email: string
  orcid_id: string | null
  country_of_residence: string
  school: string
  year_in_school: string
  preferred_track: CohortTrack
  preferred_tier: CohortTier
  personal_statement: string
  research_experience: string
  why_oscrsj: string
  references_json: CohortApplicationReference[]
  cv_storage_path: string | null
  ai_disclosure_ack: boolean
  participant_agreement_ack: boolean
  status: CohortApplicationStatus
  reviewed_by: string | null
  reviewed_at: string | null
  admin_notes: string | null
}

// ---------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------

function normalizeString(value: unknown, max = 2000): string {
  if (typeof value !== 'string') return ''
  return value.trim().slice(0, max)
}

function normalizeOptional(value: unknown, max = 2000): string | null {
  const trimmed = normalizeString(value, max)
  return trimmed.length > 0 ? trimmed : null
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254
}

function parseReferences(raw: unknown): CohortApplicationReference[] {
  if (!Array.isArray(raw)) return []
  const out: CohortApplicationReference[] = []
  for (const entry of raw.slice(0, 3)) {
    if (!entry || typeof entry !== 'object') continue
    const row = entry as Record<string, unknown>
    const name = normalizeString(row.name, 200)
    const email = normalizeString(row.email, 254).toLowerCase()
    const relationship = normalizeString(row.relationship, 200)
    const institution = normalizeString(row.institution, 200)
    if (!name && !email && !relationship && !institution) continue
    out.push({ name, email, relationship, institution })
  }
  return out
}

function getCvExtension(filename: string): string {
  const dot = filename.lastIndexOf('.')
  if (dot === -1 || dot === filename.length - 1) return 'pdf'
  const ext = filename.slice(dot + 1).toLowerCase()
  if (ext === 'pdf' || ext === 'doc' || ext === 'docx') return ext
  return 'pdf'
}

// ---------------------------------------------------------------
// Public submit action
// ---------------------------------------------------------------

export async function submitCohortApplication(
  formData: FormData
): Promise<SubmitCohortApplicationResult> {
  // ---- Pull + normalize fields ----
  const firstName = normalizeString(formData.get('firstName'), 120)
  const lastName = normalizeString(formData.get('lastName'), 120)
  const email = normalizeString(formData.get('email'), 254).toLowerCase()
  const orcidId = normalizeOptional(formData.get('orcidId'), 40)
  const countryOfResidence = normalizeString(
    formData.get('countryOfResidence'),
    120
  )
  const school = normalizeString(formData.get('school'), 250)
  const yearInSchool = normalizeString(formData.get('yearInSchool'), 120)
  const preferredTrack = normalizeString(formData.get('preferredTrack'), 40) as
    | CohortTrack
    | ''
  const preferredTier = normalizeString(formData.get('preferredTier'), 60) as
    | CohortTier
    | ''
  const personalStatement = normalizeString(
    formData.get('personalStatement'),
    5000
  )
  const researchExperience = normalizeString(
    formData.get('researchExperience'),
    5000
  )
  const whyOscrsj = normalizeString(formData.get('whyOscrsj'), 5000)
  const aiDisclosureAck = formData.get('aiDisclosureAck') === 'true'
  const participantAgreementAck =
    formData.get('participantAgreementAck') === 'true'

  let references: CohortApplicationReference[] = []
  const rawReferences = formData.get('referencesJson')
  if (typeof rawReferences === 'string' && rawReferences.length > 0) {
    try {
      references = parseReferences(JSON.parse(rawReferences))
    } catch {
      // fall through with empty array
    }
  }

  // ---- Validate ----
  if (!firstName) return { error: 'First name is required.' }
  if (!lastName) return { error: 'Last name is required.' }
  if (!email || !isValidEmail(email))
    return { error: 'A valid email address is required.' }
  if (orcidId && !ORCID_REGEX.test(orcidId))
    return { error: 'ORCID iD must match the format 0000-0000-0000-0000.' }
  if (!countryOfResidence) return { error: 'Country is required.' }
  if (!school) return { error: 'School / institution is required.' }
  if (!yearInSchool) return { error: 'Current year in school is required.' }
  if (
    preferredTrack !== 'pre_med' &&
    preferredTrack !== 'med_student' &&
    preferredTrack !== 'img'
  )
    return { error: 'Please select a track.' }
  if (!(preferredTier in TIER_LABELS))
    return { error: 'Please select a tier.' }
  if (TIER_TO_TRACK[preferredTier as CohortTier] !== preferredTrack)
    return {
      error: 'Selected tier does not match the selected track.',
    }
  if (!personalStatement || personalStatement.length < 100)
    return {
      error: 'Personal statement must be at least 100 characters.',
    }
  if (!researchExperience || researchExperience.length < 50)
    return {
      error: 'Please describe your research experience (≥50 characters).',
    }
  if (!whyOscrsj || whyOscrsj.length < 50)
    return {
      error:
        'Please tell us why you want to join OSCRSJ specifically (≥50 characters).',
    }
  if (!aiDisclosureAck)
    return {
      error: 'Please acknowledge the AI-use policy before submitting.',
    }
  if (!participantAgreementAck)
    return {
      error:
        'Please acknowledge the participant agreement before submitting.',
    }

  // ---- Optional CV upload ----
  const cvFileRaw = formData.get('cv')
  const cvFile = cvFileRaw instanceof File && cvFileRaw.size > 0 ? cvFileRaw : null
  let cvOriginalFilename: string | null = null
  if (cvFile) {
    if (cvFile.size > CV_MAX_BYTES) {
      return {
        error: `CV exceeds the 10 MB upload limit (your file is ${(
          cvFile.size /
          (1024 * 1024)
        ).toFixed(1)} MB).`,
      }
    }
    if (cvFile.type && !ALLOWED_CV_MIME_TYPES.has(cvFile.type)) {
      return {
        error:
          'CV must be a PDF or Word document (.pdf, .doc, .docx).',
      }
    }
    cvOriginalFilename = cvFile.name
  }

  const admin = createAdminClient()

  // ---- Insert the application row first so we have an id for the CV
  //      storage path. CV upload happens after, and if it fails we
  //      surface the error to the applicant but leave the row in
  //      place — they can email us a CV separately. ----
  const { data: inserted, error: insertErr } = await (
    admin.from('cohort_applications') as any
  )
    .insert({
      first_name: firstName,
      last_name: lastName,
      email,
      orcid_id: orcidId,
      country_of_residence: countryOfResidence,
      school,
      year_in_school: yearInSchool,
      preferred_track: preferredTrack,
      preferred_tier: preferredTier,
      personal_statement: personalStatement,
      research_experience: researchExperience,
      why_oscrsj: whyOscrsj,
      references_json: references,
      ai_disclosure_ack: aiDisclosureAck,
      participant_agreement_ack: participantAgreementAck,
    })
    .select('id')
    .single()

  if (insertErr || !inserted) {
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

  // ---- CV upload (best-effort) ----
  let cvStoragePath: string | null = null
  if (cvFile) {
    const ext = getCvExtension(cvFile.name)
    const storagePath = `${CV_FOLDER}/${applicationId}/cv.${ext}`
    try {
      const arrayBuffer = await cvFile.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)
      const { error: uploadErr } = await admin.storage
        .from(STORAGE_BUCKET)
        .upload(storagePath, buffer, {
          contentType: cvFile.type || 'application/pdf',
          upsert: true,
        })
      if (!uploadErr) {
        cvStoragePath = storagePath
        await (admin.from('cohort_applications') as any)
          .update({ cv_storage_path: storagePath })
          .eq('id', applicationId)
      } else {
        console.error('[submitCohortApplication] CV upload failed:', uploadErr)
      }
    } catch (uploadErr) {
      console.error(
        '[submitCohortApplication] CV upload threw:',
        uploadErr
      )
    }
  }

  // ---- Emails (fire-and-forget) ----
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    'https://www.oscrsj.com'
  const cleanSiteUrl = siteUrl.replace(/\/$/, '')
  const scholarsUrl = `${cleanSiteUrl}/scholars`
  const adminReviewUrl = `${cleanSiteUrl}/dashboard/admin/scholars/applications`

  const trackLabel = TRACK_LABELS[preferredTrack as CohortTrack]
  const tierLabel = TIER_LABELS[preferredTier as CohortTier]

  try {
    const applicant = renderCohortApplicationConfirmation({
      applicantName: `${firstName} ${lastName}`,
      preferredTrackLabel: trackLabel,
      preferredTierLabel: tierLabel,
      scholarsUrl,
    })
    await sendEmail({
      to: email,
      subject: getCohortApplicationConfirmationSubject(),
      html: applicant.html,
      text: applicant.text,
      emailType: 'cohort_application_confirmation',
    })
  } catch {
    // Logged inside sendEmail; don't fail the flow.
  }

  try {
    const internal = renderCohortApplicationInternalNotification({
      firstName,
      lastName,
      email,
      orcidId,
      countryOfResidence,
      school,
      yearInSchool,
      preferredTrackLabel: trackLabel,
      preferredTierLabel: tierLabel,
      personalStatement,
      researchExperience,
      whyOscrsj,
      referencesCount: references.length,
      cvFilename: cvOriginalFilename,
      aiDisclosureAck,
      participantAgreementAck,
      applicationId,
      adminReviewUrl,
    })
    await sendEmail({
      to: INTERNAL_EDITORIAL_EMAIL,
      subject: getCohortApplicationInternalSubject(
        firstName,
        lastName,
        trackLabel
      ),
      html: internal.html,
      text: internal.text,
      emailType: 'cohort_application_internal',
      replyTo: email,
    })
  } catch {
    // Same — internal notification is convenience, not correctness.
  }

  void cvStoragePath // keep for future analytics / lint silencing

  return { success: true, applicationId }
}

// ---------------------------------------------------------------
// Admin — list + triage
// ---------------------------------------------------------------

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

export interface ListCohortApplicationsArgs {
  status?: CohortApplicationStatus | 'all'
  track?: CohortTrack | 'all'
}

export interface ListCohortApplicationsResult {
  applications?: CohortApplicationRow[]
  error?: string
}

export async function listCohortApplications(
  args: ListCohortApplicationsArgs = {}
): Promise<ListCohortApplicationsResult> {
  const gate = await requireEditorOrAdmin()
  if ('error' in gate) return { error: gate.error }

  const admin = createAdminClient()
  let query = (admin.from('cohort_applications') as any)
    .select('*')
    .order('created_at', { ascending: false })

  if (args.status && args.status !== 'all') {
    query = query.eq('status', args.status)
  }
  if (args.track && args.track !== 'all') {
    query = query.eq('preferred_track', args.track)
  }

  const { data, error } = await query
  if (error) return { error: error.message }
  return { applications: (data || []) as CohortApplicationRow[] }
}

export interface GetCohortApplicationResult {
  application?: CohortApplicationRow
  cvSignedUrl?: string | null
  error?: string
}

export async function getCohortApplication(
  applicationId: string
): Promise<GetCohortApplicationResult> {
  const gate = await requireEditorOrAdmin()
  if ('error' in gate) return { error: gate.error }

  const admin = createAdminClient()
  const { data, error } = await (admin.from('cohort_applications') as any)
    .select('*')
    .eq('id', applicationId)
    .single()

  if (error || !data) return { error: error?.message || 'Application not found.' }
  const application = data as CohortApplicationRow

  let cvSignedUrl: string | null = null
  if (application.cv_storage_path) {
    const { data: signed } = await admin.storage
      .from(STORAGE_BUCKET)
      .createSignedUrl(application.cv_storage_path, 60 * 30) // 30 minutes
    cvSignedUrl = signed?.signedUrl || null
  }

  return { application, cvSignedUrl }
}

export interface UpdateCohortApplicationStatusArgs {
  applicationId: string
  newStatus: CohortApplicationStatus
  adminNotes?: string | null
}

export interface UpdateCohortApplicationStatusResult {
  success?: true
  error?: string
}

export async function updateCohortApplicationStatus(
  args: UpdateCohortApplicationStatusArgs
): Promise<UpdateCohortApplicationStatusResult> {
  const gate = await requireEditorOrAdmin()
  if ('error' in gate) return { error: gate.error }

  const admin = createAdminClient()
  const update: Record<string, unknown> = {
    status: args.newStatus,
    reviewed_by: gate.userId,
    reviewed_at: new Date().toISOString(),
  }
  if (typeof args.adminNotes === 'string') {
    update.admin_notes = args.adminNotes.trim() || null
  }

  const { error } = await (admin.from('cohort_applications') as any)
    .update(update)
    .eq('id', args.applicationId)

  if (error) return { error: error.message }

  revalidatePath('/dashboard/admin/scholars/applications')
  revalidatePath(`/dashboard/admin/scholars/applications/${args.applicationId}`)
  return { success: true }
}
