// ============================================================
// Co-author authorship confirmation / dispute handler
// ============================================================
// A co-author who was listed on a submission clicks the link in their
// notification email. The link carries a signed JWT bound to a single
// (manuscriptId, coAuthorEmail) pair.
//
//   GET  /api/submissions/[id]/co-author-dispute?token=<jwt>
//        Renders a READ-ONLY landing page that shows the submission and
//        offers two explicit choices: confirm authorship, or object.
//        GET performs NO database mutation. This is deliberate:
//          - A bare GET that mutates state means any email security
//            scanner / link-preview bot (Outlook SafeLinks, Mimecast,
//            Gmail, antivirus) that auto-prefetches the URL would file a
//            phantom objection with no human action. (Root cause of the
//            repeated false "co-author objected" reports.)
//          - A single objection-only button also led co-authors who
//            wanted to CONFIRM to accidentally object by clicking the
//            only link in the email.
//
//   POST /api/submissions/[id]/co-author-dispute
//        Body (form-encoded): token=<jwt>&action=confirm|object
//        Performs the actual state change. Because it requires a real
//        form submission (a button click), scanners and prefetchers
//        cannot trigger it.
//          - action=object  → append to manuscript_metadata.co_author_disputes,
//            audit-log, and notify the corresponding author + editorial office.
//          - action=confirm → audit-log an affirmative consent record.
//
// Until an editor role exists, dispute notifications are sent to the
// journal's primary Gmail.
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

// Routed to the journal's primary Gmail (`oscrsjournal@gmail.com`)
// until a Google Workspace editorial mailbox is provisioned.
const ADMIN_NOTIFY_EMAIL = 'oscrsjournal@gmail.com'

interface ManuscriptContext {
  manuscript: ManuscriptRow
  metadata: ManuscriptMetadataRow | null
  authors: ManuscriptAuthorRow[]
  correspondingAuthor: ManuscriptAuthorRow | null
}

// ============================================================
// GET — render the safe, read-only landing page (no mutation)
// ============================================================
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const url = new URL(request.url)
  const token = url.searchParams.get('token')
  const manuscriptId = params.id

  const validation = await validateToken(token, manuscriptId)
  if ('error' in validation) {
    return validation.error
  }
  const { email } = validation.payload

  const admin = createAdminClient()
  const ctx = await loadContext(admin, manuscriptId)
  if (!ctx) {
    return errorResponse(
      'Submission not found',
      'We could not locate this submission. Contact the editorial office for help.'
    )
  }

  // If this co-author has already objected, show that state instead of
  // offering the choice again.
  const alreadyDisputed = getDisputes(ctx.metadata).some(
    (d) => d.email?.toLowerCase() === email.toLowerCase()
  )
  if (alreadyDisputed) {
    return objectionRecordedResponse(ctx.manuscript.submission_id)
  }

  return landingResponse({
    manuscriptId,
    token: token as string,
    submissionId: ctx.manuscript.submission_id,
    title: ctx.manuscript.title || '(untitled submission)',
    correspondingAuthorName:
      ctx.correspondingAuthor?.full_name || 'the corresponding author',
  })
}

// ============================================================
// POST — perform the mutation (requires a real button click)
// ============================================================
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const manuscriptId = params.id

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return errorResponse(
      'Could not process your response',
      'Please return to your email and use the original link.'
    )
  }

  const token = (form.get('token') as string | null) || null
  const action = (form.get('action') as string | null) || null

  const validation = await validateToken(token, manuscriptId)
  if ('error' in validation) {
    return validation.error
  }
  const { email } = validation.payload

  if (action !== 'confirm' && action !== 'object') {
    return errorResponse(
      'No choice was recorded',
      'Please return to the page and select either "I agreed to be a co-author" or "I did not agree."'
    )
  }

  const admin = createAdminClient()
  const ctx = await loadContext(admin, manuscriptId)
  if (!ctx) {
    return errorResponse(
      'Submission not found',
      'We could not locate this submission. Contact the editorial office for help.'
    )
  }

  if (action === 'confirm') {
    await recordConfirmation(admin, ctx, email)
    return confirmationRecordedResponse(ctx.manuscript.submission_id)
  }

  // action === 'object'
  await recordObjection(admin, ctx, email)
  return objectionRecordedResponse(ctx.manuscript.submission_id)
}

// ============================================================
// Shared helpers
// ============================================================

async function validateToken(
  token: string | null,
  manuscriptId: string
): Promise<
  | { payload: { manuscriptId: string; email: string } }
  | { error: Response }
> {
  if (!token) {
    return {
      error: errorResponse(
        'Missing link token',
        'This link is incomplete. Please use the original link from your email.'
      ),
    }
  }

  const payload = await verifyDisputeToken(token)
  if (!payload) {
    return {
      error: errorResponse(
        'Link expired or invalid',
        'This link is no longer valid. If you believe this is an error, contact the editorial office.'
      ),
    }
  }

  if (payload.manuscriptId !== manuscriptId) {
    return {
      error: errorResponse(
        'Link does not match this submission',
        'This link does not match the submission it points to. Please use the original link from your email.'
      ),
    }
  }

  return { payload }
}

async function loadContext(
  admin: ReturnType<typeof createAdminClient>,
  manuscriptId: string
): Promise<ManuscriptContext | null> {
  const { data: manuscriptData } = await admin
    .from('manuscripts')
    .select('*')
    .eq('id', manuscriptId)
    .single()

  const manuscript = manuscriptData as ManuscriptRow | null
  if (!manuscript) return null

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

  return { manuscript, metadata, authors, correspondingAuthor }
}

function getDisputes(metadata: ManuscriptMetadataRow | null): CoAuthorDispute[] {
  return Array.isArray(metadata?.co_author_disputes)
    ? (metadata!.co_author_disputes as CoAuthorDispute[])
    : []
}

async function recordConfirmation(
  admin: ReturnType<typeof createAdminClient>,
  ctx: ManuscriptContext,
  email: string
): Promise<void> {
  // Affirmative consent is recorded to the audit trail only (no metadata
  // column required). Idempotent enough: a duplicate confirmation simply
  // logs a second audit row, which is harmless.
  await (admin.from('audit_logs') as any).insert({
    action: 'co_author_confirmed',
    resource_type: 'manuscript',
    resource_id: ctx.manuscript.id,
    details: {
      co_author_email: email,
      submission_id: ctx.manuscript.submission_id,
      confirmed_at: new Date().toISOString(),
    },
  })
}

async function recordObjection(
  admin: ReturnType<typeof createAdminClient>,
  ctx: ManuscriptContext,
  email: string
): Promise<void> {
  const { manuscript, metadata, correspondingAuthor } = ctx
  const manuscriptId = manuscript.id

  const disputedAt = new Date().toISOString()
  const existingDisputes = getDisputes(metadata)

  // Idempotency: don't double-append if the same email has already disputed
  const alreadyDisputed = existingDisputes.some(
    (d) => d.email?.toLowerCase() === email.toLowerCase()
  )
  if (alreadyDisputed) return

  const newDispute: CoAuthorDispute = { email, disputed_at: disputedAt }
  const updatedDisputes = [...existingDisputes, newDispute]

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
      co_author_email: email,
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
      coAuthorEmail: email,
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
      coAuthorEmail: email,
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

// ============================================================
// HTML response helpers
// ============================================================

function pageShell(title: string, bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="robots" content="noindex,nofollow" />
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
    .details {
      margin: 4px 0 28px 0;
      padding: 16px 20px;
      background-color: #F7F6F4;
      border-left: 3px solid #3d2a18;
      font-size: 14px;
      line-height: 22px;
    }
    .details strong { color: #1c0f05; }
    .choices {
      margin-top: 8px;
    }
    .choice-form { margin: 0 0 14px 0; }
    button {
      font-family: -apple-system, BlinkMacSystemFont, 'Helvetica Neue', Helvetica, Arial, sans-serif;
      font-size: 14px;
      font-weight: 700;
      letter-spacing: 0.02em;
      padding: 14px 22px;
      width: 100%;
      border-radius: 3px;
      border: 1px solid transparent;
      cursor: pointer;
      text-align: left;
    }
    .btn-confirm {
      background-color: #3d2a18;
      color: #FFDBBB;
    }
    .btn-object {
      background-color: #FFFFFF;
      color: #664930;
      border: 1px solid rgba(153,126,103,0.45);
    }
    .btn-sub {
      display: block;
      margin-top: 4px;
      font-size: 12px;
      font-weight: 400;
      opacity: 0.85;
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

interface LandingParams {
  manuscriptId: string
  token: string
  submissionId: string
  title: string
  correspondingAuthorName: string
}

function landingResponse(p: LandingParams): Response {
  const actionUrl = `/api/submissions/${encodeURIComponent(
    p.manuscriptId
  )}/co-author-dispute`
  const hidden = `<input type="hidden" name="token" value="${escapeHtml(
    p.token
  )}" />`

  const body = `
    <h1>Confirm your authorship</h1>
    <p>${escapeHtml(
      p.correspondingAuthorName
    )} has submitted a manuscript to OSCRSJ and listed you as a co-author. Please let us know whether you agreed to be included.</p>
    <div class="details">
      <div><strong>Submission ID:</strong> ${escapeHtml(p.submissionId)}</div>
      <div><strong>Title:</strong> ${escapeHtml(p.title)}</div>
      <div><strong>Corresponding author:</strong> ${escapeHtml(
        p.correspondingAuthorName
      )}</div>
    </div>
    <div class="choices">
      <form class="choice-form" method="post" action="${actionUrl}">
        ${hidden}
        <input type="hidden" name="action" value="confirm" />
        <button type="submit" class="btn-confirm">
          Yes — I agreed to be a co-author
          <span class="btn-sub">Confirm my authorship and let the submission proceed.</span>
        </button>
      </form>
      <form class="choice-form" method="post" action="${actionUrl}">
        ${hidden}
        <input type="hidden" name="action" value="object" />
        <button type="submit" class="btn-object">
          No — I did not agree to be listed
          <span class="btn-sub">File an objection. The submission will be held pending editorial review.</span>
        </button>
      </form>
    </div>
    <p style="font-size:13px;color:#997E67;">If neither applies, or you have questions, reply to the original notification email and a member of the editorial office will respond.</p>
  `
  return new Response(pageShell('Confirm your authorship', body), {
    status: 200,
    headers: { 'content-type': 'text/html; charset=utf-8' },
  })
}

function confirmationRecordedResponse(submissionId: string): Response {
  const body = `
    <h1>Thank you. Your authorship is confirmed.</h1>
    <p>We have recorded that you agreed to be listed as a co-author on submission <strong>${escapeHtml(
      submissionId
    )}</strong>. No further action is needed from you.</p>
    <p>You may close this window.</p>
  `
  return new Response(pageShell('Authorship confirmed', body), {
    status: 200,
    headers: { 'content-type': 'text/html; charset=utf-8' },
  })
}

function objectionRecordedResponse(submissionId: string): Response {
  const body = `
    <h1>Your objection has been recorded.</h1>
    <p>We have logged your objection to being listed as a co-author on submission <strong>${escapeHtml(
      submissionId
    )}</strong> and notified the editorial office. The manuscript is held pending review.</p>
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
    <p>You can reach the editorial office at <a href="mailto:oscrsjournal@gmail.com">oscrsjournal@gmail.com</a>.</p>
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
