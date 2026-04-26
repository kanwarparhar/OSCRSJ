'use server'

// ============================================================
// Public-form server actions — `/apc` discount inquiry + `/contact`
// ============================================================
// Both are unauthenticated, public-facing forms. Each action:
//   1. Validates and normalises the payload server-side (the client
//      validation is convenience — it can be bypassed).
//   2. Generates a stable inquiry/contact UUID so the email body and
//      the audit-log row share the same identifier.
//   3. Fires two Resend emails fire-and-forget:
//      a. an internal notification to the appropriate departmental
//         inbox (Reply-To = inquirer's email so editorial replies
//         route back directly), and
//      b. a confirmation email to the inquirer with the editorial
//         Reply-To.
//      Each call to sendEmail() inserts a row into email_logs.
//   4. Writes one audit_logs row per submission for observability.
//
// Email failures do NOT roll back the audit log row — the inquirer's
// submission is the source of truth and we want it recorded even if
// Resend is having a bad day.
// ============================================================

import { createAdminClient } from '@/lib/supabase/server'
import { sendEmail } from '@/lib/email/resend'
import {
  renderDiscountInquiryConfirmation,
  getDiscountInquiryConfirmationSubject,
} from '@/lib/email/templates/discountInquiryConfirmation'
import {
  renderDiscountInquiryInternal,
  getDiscountInquiryInternalSubject,
} from '@/lib/email/templates/discountInquiryInternal'
import {
  renderContactMessageConfirmation,
  getContactMessageConfirmationSubject,
} from '@/lib/email/templates/contactMessageConfirmation'
import {
  renderContactMessageInternal,
  getContactMessageInternalSubject,
} from '@/lib/email/templates/contactMessageInternal'

// ---- Helpers ----

function normalizeString(value: unknown, max = 500): string {
  if (typeof value !== 'string') return ''
  return value.trim().slice(0, max)
}

function normalizeOptional(value: unknown, max = 500): string | null {
  const trimmed = normalizeString(value, max)
  return trimmed.length > 0 ? trimmed : null
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254
}

// crypto.randomUUID is available in the Node 20+ runtime Vercel uses.
// Fall back to a timestamp-derived id if for any reason it's unavailable
// (the audit row is still useful, just less unique-looking).
function newId(): string {
  try {
    return crypto.randomUUID()
  } catch {
    return `id_${Date.now().toString(36)}_${Math.random()
      .toString(36)
      .slice(2, 10)}`
  }
}

// ============================================================
// Discount inquiry — `/apc`
// ============================================================

const DISCOUNT_INQUIRY_INBOX = 'waivers@oscrsj.com'

const DISCOUNT_CAREER_STAGES = [
  'Medical student',
  'Resident',
  'Fellow',
  'Attending / consultant',
  'Researcher',
  'Other',
] as const

export type DiscountCareerStage = (typeof DISCOUNT_CAREER_STAGES)[number]

export interface DiscountInquiryPayload {
  firstName: string
  lastName: string
  email: string
  country: string
  careerStage: string
  affiliation: string | null
  submissionId: string | null
  message: string
}

export interface DiscountInquiryResult {
  success?: true
  inquiryId?: string
  error?: string
}

export async function submitDiscountInquiry(
  payload: DiscountInquiryPayload
): Promise<DiscountInquiryResult> {
  // ---- Validate ----
  const firstName = normalizeString(payload.firstName, 120)
  const lastName = normalizeString(payload.lastName, 120)
  const email = normalizeString(payload.email, 254).toLowerCase()
  const country = normalizeString(payload.country, 120)
  const careerStage = normalizeString(payload.careerStage, 60)
  const affiliation = normalizeOptional(payload.affiliation, 250)
  const submissionId = normalizeOptional(payload.submissionId, 60)
  const message = normalizeString(payload.message, 4000)

  if (!firstName) return { error: 'First name is required.' }
  if (!lastName) return { error: 'Last name is required.' }
  if (!email || !isValidEmail(email))
    return { error: 'A valid email address is required.' }
  if (!country) return { error: 'Country is required.' }
  if (!(DISCOUNT_CAREER_STAGES as readonly string[]).includes(careerStage))
    return { error: 'Please select a career stage from the list.' }
  if (!message || message.length < 20)
    return {
      error:
        'Please share a brief description of your situation (at least 20 characters).',
    }

  const inquiryId = newId()
  const fullName = `${firstName} ${lastName}`

  // ---- Audit log (best-effort) ----
  try {
    const admin = createAdminClient()
    await (admin.from('audit_logs') as any).insert({
      action: 'discount_inquiry_submitted',
      resource_type: 'discount_inquiry',
      resource_id: inquiryId,
      details: {
        first_name: firstName,
        last_name: lastName,
        email,
        country,
        career_stage: careerStage,
        affiliation,
        submission_id: submissionId,
        message_length: message.length,
      },
    })
  } catch {
    // Logging must never block the inquirer's submission.
  }

  // ---- Internal notification (Reply-To = inquirer) ----
  try {
    const internal = renderDiscountInquiryInternal({
      firstName,
      lastName,
      email,
      country,
      careerStage,
      affiliation,
      submissionId,
      message,
      inquiryId,
    })
    await sendEmail({
      to: DISCOUNT_INQUIRY_INBOX,
      subject: getDiscountInquiryInternalSubject(firstName, lastName),
      html: internal.html,
      text: internal.text,
      emailType: 'discount_inquiry_internal',
      replyTo: email,
    })
  } catch {
    // Logged inside sendEmail; don't fail the flow.
  }

  // ---- Confirmation to inquirer ----
  try {
    const confirmation = renderDiscountInquiryConfirmation({
      inquirerName: fullName,
    })
    await sendEmail({
      to: email,
      subject: getDiscountInquiryConfirmationSubject(),
      html: confirmation.html,
      text: confirmation.text,
      emailType: 'discount_inquiry_confirmation',
    })
  } catch {
    // Same — confirmation is convenience, not correctness.
  }

  return { success: true, inquiryId }
}

// ============================================================
// Contact message — `/contact`
// ============================================================
//
// Subject → routing inbox map. Mirrors the four contact cards on
// `/contact`. Update both surfaces in lock-step if the routing changes.

// Keys MUST match CONTACT_SUBJECT_LABELS in `lib/inquiry/constants.ts` —
// the dropdown on /contact is rendered from CONTACT_SUBJECT_LABELS, so any
// label that's not also a routing key here will fail validation below.
const CONTACT_INBOXES: Record<string, string> = {
  'General Inquiry': 'info@oscrsj.com',
  'Manuscript Submission': 'submit@oscrsj.com',
  'Editorial Board Interest': 'editorial@oscrsj.com',
  'APC Waiver Request': 'waivers@oscrsj.com',
  Other: 'info@oscrsj.com',
}

export interface ContactMessagePayload {
  firstName: string
  lastName: string
  email: string
  subjectLabel: string
  message: string
}

export interface ContactMessageResult {
  success?: true
  contactId?: string
  error?: string
}

export async function submitContactMessage(
  payload: ContactMessagePayload
): Promise<ContactMessageResult> {
  // ---- Validate ----
  const firstName = normalizeString(payload.firstName, 120)
  const lastName = normalizeString(payload.lastName, 120)
  const email = normalizeString(payload.email, 254).toLowerCase()
  const subjectLabel = normalizeString(payload.subjectLabel, 60)
  const message = normalizeString(payload.message, 4000)

  if (!firstName) return { error: 'First name is required.' }
  if (!lastName) return { error: 'Last name is required.' }
  if (!email || !isValidEmail(email))
    return { error: 'A valid email address is required.' }
  if (!CONTACT_INBOXES[subjectLabel])
    return { error: 'Please select a subject from the list.' }
  if (!message || message.length < 10)
    return {
      error:
        'Please share a brief message (at least 10 characters) so we can respond meaningfully.',
    }

  const contactId = newId()
  const fullName = `${firstName} ${lastName}`
  const inbox = CONTACT_INBOXES[subjectLabel]

  // ---- Audit log (best-effort) ----
  try {
    const admin = createAdminClient()
    await (admin.from('audit_logs') as any).insert({
      action: 'contact_message_submitted',
      resource_type: 'contact_message',
      resource_id: contactId,
      details: {
        first_name: firstName,
        last_name: lastName,
        email,
        subject_label: subjectLabel,
        routed_inbox: inbox,
        message_length: message.length,
      },
    })
  } catch {
    // swallow
  }

  // ---- Internal notification (Reply-To = sender) ----
  try {
    const internal = renderContactMessageInternal({
      firstName,
      lastName,
      email,
      subjectLabel,
      message,
      contactId,
    })
    await sendEmail({
      to: inbox,
      subject: getContactMessageInternalSubject(
        subjectLabel,
        firstName,
        lastName
      ),
      html: internal.html,
      text: internal.text,
      emailType: 'contact_message_internal',
      replyTo: email,
    })
  } catch {
    // swallow
  }

  // ---- Confirmation to sender ----
  try {
    const confirmation = renderContactMessageConfirmation({
      senderName: fullName,
      subjectLabel,
    })
    await sendEmail({
      to: email,
      subject: getContactMessageConfirmationSubject(),
      html: confirmation.html,
      text: confirmation.text,
      emailType: 'contact_message_confirmation',
    })
  } catch {
    // swallow
  }

  return { success: true, contactId }
}
