// ============================================================
// Resend client + sendEmail helper
// ============================================================
// Centralised wrapper around the Resend SDK. Every application-level
// transactional email goes through sendEmail() so that:
//   1. Every send gets logged to email_logs with the Resend message ID
//      (so the webhook handler can update delivery_status later)
//   2. Callers never have to handle a thrown exception — a failed
//      email returns an error object and the caller decides whether to
//      surface it. This matters for submitManuscript: a Resend
//      outage must not roll back a submission that already landed in
//      the database.
//
// Log writes use the admin (service role) client so they succeed even
// when the caller is running under an authenticated user whose RLS
// scope doesn't grant write access to email_logs.
// ============================================================

import { Resend } from 'resend'
import { createAdminClient } from '@/lib/supabase/server'

let resendSingleton: Resend | null = null

function getResend(): Resend {
  if (resendSingleton) return resendSingleton
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    throw new Error('RESEND_API_KEY is not set')
  }
  resendSingleton = new Resend(apiKey)
  return resendSingleton
}

const DEFAULT_FROM =
  process.env.EMAIL_FROM || 'OSCRSJ Editorial Office <noreply@oscrsj.com>'

// Reply-To lets recipients hit Reply and reach a real inbox even
// though outbound mail is sent from the no-reply sending address.
// Override via EMAIL_REPLY_TO; falls back to Kanwar's Gmail until a
// dedicated editorial inbox (Google Workspace) is provisioned.
const DEFAULT_REPLY_TO =
  process.env.EMAIL_REPLY_TO || 'kanwarparhar@gmail.com'

export interface SendEmailParams {
  to: string
  subject: string
  html: string
  text?: string
  emailType: string
  manuscriptId?: string | null
  // Optional override for the Reply-To header. When omitted, defaults to
  // DEFAULT_REPLY_TO (the editorial Reply-To inbox). Set to the original
  // sender's address on internal-notification emails so editorial replies
  // route directly back to the visitor / author / inquirer.
  replyTo?: string
}

export interface SendEmailResult {
  messageId: string | null
  error: string | null
}

export async function sendEmail(
  params: SendEmailParams
): Promise<SendEmailResult> {
  const { to, subject, html, text, emailType, manuscriptId, replyTo } = params

  let messageId: string | null = null
  let sendError: string | null = null

  try {
    const resend = getResend()
    const { data, error } = await resend.emails.send({
      from: DEFAULT_FROM,
      to,
      subject,
      html,
      replyTo: replyTo || DEFAULT_REPLY_TO,
      ...(text ? { text } : {}),
    })

    if (error) {
      sendError = error.message || 'Resend returned an error'
    } else {
      messageId = data?.id || null
    }
  } catch (err) {
    sendError =
      err instanceof Error ? err.message : 'Unknown error calling Resend'
  }

  // Log regardless of success/failure so we can audit attempts.
  try {
    const admin = createAdminClient()
    await (admin.from('email_logs') as any).insert({
      sender: DEFAULT_FROM,
      recipient: to,
      subject,
      email_type: emailType,
      manuscript_id: manuscriptId || null,
      delivery_status: sendError ? 'failed' : 'sent',
      resend_message_id: messageId,
      bounce_reason: sendError,
    })
  } catch {
    // Logging must never throw into the caller.
  }

  return { messageId, error: sendError }
}
