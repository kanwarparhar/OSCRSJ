// ============================================================
// Contact message — confirmation to sender
// ============================================================
// Sent to a visitor immediately after they submit the `/contact`
// form. Confirms receipt and sets the 2-business-day response
// expectation.
// ============================================================

import {
  renderEmailShell,
  paragraph,
  plainTextFooter,
  escapeHtml,
  type RenderedEmail,
} from './shared'

export interface ContactMessageConfirmationParams {
  senderName: string
  subjectLabel: string
}

export function renderContactMessageConfirmation(
  params: ContactMessageConfirmationParams
): RenderedEmail {
  const { senderName, subjectLabel } = params

  const bodyHtml = [
    paragraph(`Dear ${escapeHtml(senderName)},`),
    paragraph(
      `Thank you for getting in touch. We have received your message about <strong>${escapeHtml(
        subjectLabel
      )}</strong> and a member of the editorial office will respond within 2 business days.`
    ),
    paragraph(
      `If anything in your message needs correcting or you would like to add supporting context, simply reply to this email.`
    ),
    paragraph(`With appreciation,<br />The OSCRSJ Editorial Office`),
  ].join('\n')

  const html = renderEmailShell({
    previewText:
      'Your message has been received. We will respond within 2 business days.',
    heading: 'Your message was received',
    bodyHtml,
  })

  const text =
    `Dear ${senderName},\n\n` +
    `Thank you for getting in touch. We have received your message about "${subjectLabel}" and a member of the editorial office will respond within 2 business days.\n\n` +
    `If anything in your message needs correcting or you would like to add supporting context, simply reply to this email.\n\n` +
    `With appreciation,\nThe OSCRSJ Editorial Office` +
    plainTextFooter()

  return { html, text }
}

export function getContactMessageConfirmationSubject(): string {
  return 'Your message was received — OSCRSJ'
}
