// ============================================================
// Co-author dispute handler
// ============================================================
// GET /api/submissions/[id]/co-author-dispute?token=<jwt>
//
// A co-author who did not consent to authorship clicks the link in
// their notification email. We:
//   1. Verify the JWT and ensure the manuscriptId in the URL matches
//      the one inside the token (defends against URL tampering)
//   2. Append the dispute to manuscript_metadata.co_author_disputes
//   3. Insert an audit_logs row with the disputing email in details
//   4. Notify the corresponding author and the editorial office
//   5. Render a confirmation HTML page (or an error page if invalid)
//
// Until an editor role exists, dispute notifications are sent to a
// hardcoded `admin@oscrsj.com` address. This will be replaced with the
// assigned editor in Phase 3.
// ============================================================

import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { verifyDisputeToken } from '@/lib/email/disputeTokens'
import { sendEmail } from '@/lib/email/resend'
import {
  renderCoAuthorDisputeNotification,
  getCoAuthorDisputeSubject,
} from '@/lib/email/templates/coAuthorDisputeNotification'
import type {
  ManuscriptRow,
  ManuscriptMetadataRow,
  CoAuthorDispute,
  ManuscriptAuthorRow,
} from '@/lib/types/database'

const ADMIN_NOTIFY_EMAIL = 'kanwarparhar@gmail.com'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const url = new URL(request.url)
  const token = url.searchParams.get('token')
  const manuscriptId = params.id

  if (!token) {
    return errorResponse(
      'Missing dispute token',
      'This link is incomplete. Please use the original link from your email.'
    )
  }

  const payload = await verifyDisputeToken(token)
  if (!payload) {
    return errorResponse(
      'Link expired or invalid',
      'This dispute link is no longer valid. If you believe this is an error, contact the editorial office.'
    )
  }

  if (payload.manuscriptId !== manuscriptId) {
    return errorResponse(
      'Link does not match this submission',
      'This link does not match the submission it points to. Please use the original link from your email.'
    )
  }

  const admin = createAdminClient()

  // Load manuscript + metadata + corresponding author
  const { data: manuscriptData } = await admin
    .from('manuscripts')
    .select('*')
    .eq('id', manuscriptId)
    .single()

  const manuscript = manuscriptData as ManuscriptRow | null
  if (!manuscript) {
    return errorResponse(
      'Submission not found',
      'We could not locate this submission. Contact the editorial office for help.'
    )
  }

  const { data: metaData } = await admin
    .from('manuscript_metadata')
    .select('*')
    .eq('manuscript_id', manuscriptId)
    .single()

  const metadata = metaData as ManuscriptMetadataRow | null

  const { data: authorData } = await admin
    .from('manuscript_authors')
    .select('*')
    .eq('manuscript_id', manuscriptId)
    .order('author_order', { ascending: true })

  const authors = (authorData as ManuscriptAuthorRow[] | null) || []
  const correspondingAuthor =
    authors.find((a) => a.is_corresponding) || authors[0] || null

  // Append dispute to manuscript_metadata.co_author_disputes
  const disputedAt = new Date().toISOString()
  const newDispute: CoAuthorDispute = {
    email: payload.email,
    disputed_at: disputedAt,
  }

  const existingDisputes: CoAuthorDispute[] = Array.isArray(
    metadata?.co_author_disputes
  )
    ? (metadata!.co_author_disputes as CoAuthorDispute[])
    : []

  // Idempotency: don't double-append if the same email has already disputed
  const alreadyDisputed = existingDisputes.some(
    (d) => d.email?.toLowerCase() === payload.email.toLowerCase()
  )
  const updatedDisputes = alreadyDisputed
    ? existingDisputes
    : [...existingDisputes, newDispute]

  if (!alreadyDisputed) {
    if (metadata) {
      await (admin.from('manuscript_metadata') as any)
        .update({ co_author_disputes: updatedDisputes })
        .eq('manuscript_id', manuscriptId)
    } else {
      await (admin.from('manuscript_metadata') as any).insert({
        manuscript_id: manuscriptId,
        co_author_disputes: updatedDisputes,
      })
    }

    // Audit log
    await (admin.from('audit_logs') as any).insert({
      action: 'co_author_dispute',
      resource_type: 'manuscript',
      resource_id: manuscriptId,
      details: {
        co_author_email: payload.email,
        submission_id: manuscript.submission_id,
        disputed_at: disputedAt,
      },
    })

    // Send notification emails (fire-and-forget; don't fail the page if these error)
    const correspondingName =
      correspondingAuthor?.full_name || 'Corresponding Author'
    const submissionId = manuscript.submission_id
    const title = manuscript.title || '(untitled submission)'

    if (correspondingAuthor?.email) {
      const { html, text } = renderCoAuthorDisputeNotification({
        recipientName: correspondingName,
        correspondingAuthorName: correspondingName,
        coAuthorEmail: payload.email,
        submissionId,
        title,
        disputedAt,
        forEditor: false,
      })
      await sendEmail({
        to: correspondingAuthor.email,
        subject: getCoAuthorDisputeSubject(submissionId),
        html,
        text,
        emailType: 'co_author_dispute_to_corresponding',
        manuscriptId,
      })
    }

    {
      const { html, text } = renderCoAuthorDisputeNotification({
        recipientName: 'Editorial Office',
        correspondingAuthorName: correspondingName,
        coAuthorEmail: payload.email,
        submissionId,
        title,
        disputedAt,
        forEditor: true,
      })
      await sendEmail({
        to: ADMIN_NOTIFY_EMAIL,
        subject: getCoAuthorDisputeSubject(submissionId),
        html,
        text,
        emailType: 'co_author_dispute_to_editor',
        manuscriptId,
      })
    }
  }

  return confirmationResponse(manuscript.submission_id)
}

// ---- HTML response helpers ----

function pageShell(title: string, bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)} — OSCRSJ</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #FFFFFF;
      font-family: Georgia, 'Times New Roman', serif;
      color: #3d2a18;
    }
    .wrap {
      max-width: 560px;
      margin: 80px auto;
      padding: 40px;
      background-color: #FDFBF8;
      border: 1px solid rgba(153,126,103,0.18);
      border-radius: 6px;
    }
    h1 {
      margin: 0 0 16px 0;
      font-size: 28px;
      line-height: 34px;
      font-weight: 400;
      color: #1c0f05;
    }
    p {
      margin: 0 0 16px 0;
      font-size: 15px;
      line-height: 24px;
    }
    .meta {
      font-size: 13px;
      color: #997E67;
      letter-spacing: 1px;
      text-transform: uppercase;
      margin-bottom: 8px;
    }
    a {
      color: #664930;
    }
  </style>
</head>
<body>
  <div class="wrap">
    <p class="meta">OSCRSJ Editorial Office</p>
    ${bodyHtml}
  </div>
</body>
</html>`
}

function confirmationResponse(submissionId: string): Response {
  const body = `
    <h1>Thank you. Your objection has been recorded.</h1>
    <p>We have logged your objection to being listed as a co-author on submission <strong>${escapeHtml(submissionId)}</strong> and notified the editorial office. The manuscript is held pending review.</p>
    <p>A member of the editorial office will be in touch shortly. If you have additional context to share, simply reply to the original notification email.</p>
    <p>You may close this window.</p>
  `
  return new Response(pageShell('Objection recorded', body), {
    status: 200,
    headers: { 'content-type': 'text/html; charset=utf-8' },
  })
}

function errorResponse(title: string, message: string): Response {
  const body = `
    <h1>${escapeHtml(title)}</h1>
    <p>${escapeHtml(message)}</p>
    <p>You can reach the editorial office at <a href="mailto:editorial@oscrsj.com">editorial@oscrsj.com</a>.</p>
  `
  return new Response(pageShell(title, body), {
    status: 400,
    headers: { 'content-type': 'text/html; charset=utf-8' },
  })
}

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
