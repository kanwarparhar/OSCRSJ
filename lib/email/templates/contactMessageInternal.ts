// ============================================================
// Contact message — internal editorial notification
// ============================================================
// Routed to the appropriate departmental inbox based on the subject
// the visitor selected on `/contact`. Contains the full message body
// inline so triage can happen from the inbox.
// ============================================================

import {
  renderEmailShell,
  paragraph,
  detailsList,
  plainTextFooter,
  escapeHtml,
  type RenderedEmail,
} from './shared'

export interface ContactMessageInternalParams {
  firstName: string
  lastName: string
  email: string
  subjectLabel: string
  message: string
  contactId: string
}

export function renderContactMessageInternal(
  params: ContactMessageInternalParams
): RenderedEmail {
  const { firstName, lastName, email, subjectLabel, message, contactId } =
    params

  const details: Array<[string, string]> = [
    ['Name', `${firstName} ${lastName}`],
    ['Email', email],
    ['Subject', subjectLabel],
    ['Contact ID', contactId],
  ]

  const messageBlock = `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin: 4px 0 24px 0; padding: 18px 22px; background-color: #F7F6F4; border-left: 3px solid #3d2a18; width: 100%;">
      <tr>
        <td style="font-family: -apple-system, BlinkMacSystemFont, 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 14px; line-height: 22px; color: #1c0f05; white-space: pre-wrap;">${escapeHtml(
          message
        )}</td>
      </tr>
    </table>
  `

  const bodyHtml = [
    paragraph(
      `A new contact message has just been submitted through <code>/contact</code>.`
    ),
    detailsList(details),
    paragraph(`<strong>Sender&rsquo;s message:</strong>`),
    messageBlock,
    paragraph(
      `Reply directly to this email to respond &mdash; the Reply-To header is set to the sender&rsquo;s address.`
    ),
  ].join('\n')

  const html = renderEmailShell({
    previewText: `New contact message: ${firstName} ${lastName} — ${subjectLabel}.`,
    heading: 'New contact message received',
    bodyHtml,
    footerNote: `Contact ID: ${contactId}`,
  })

  const textLines = [
    `A new contact message has just been submitted through /contact.`,
    '',
    `Name: ${firstName} ${lastName}`,
    `Email: ${email}`,
    `Subject: ${subjectLabel}`,
    `Contact ID: ${contactId}`,
    '',
    `Sender's message:`,
    message,
    '',
    `Reply directly to this email to respond — the Reply-To header is set to the sender's address.`,
  ]

  const text = textLines.join('\n') + plainTextFooter()

  return { html, text }
}

export function getContactMessageInternalSubject(
  subjectLabel: string,
  firstName: string,
  lastName: string
): string {
  return `[${subjectLabel}] ${firstName} ${lastName}`
}
