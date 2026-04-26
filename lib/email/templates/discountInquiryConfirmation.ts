// ============================================================
// Discount inquiry — confirmation to inquirer
// ============================================================
// Sent to a prospective author immediately after they submit the
// `/apc` discount inquiry form. Confirms receipt and sets the
// 2-business-day response expectation.
// ============================================================

import {
  renderEmailShell,
  paragraph,
  plainTextFooter,
  escapeHtml,
  type RenderedEmail,
} from './shared'

export interface DiscountInquiryConfirmationParams {
  inquirerName: string
}

export function renderDiscountInquiryConfirmation(
  params: DiscountInquiryConfirmationParams
): RenderedEmail {
  const { inquirerName } = params

  const bodyHtml = [
    paragraph(`Dear ${escapeHtml(inquirerName)},`),
    paragraph(
      `Thank you for reaching out about an APC discount. We have received your inquiry and a member of the editorial office will respond within 2 business days.`
    ),
    paragraph(
      `OSCRSJ is committed to supporting authors who would otherwise face a financial barrier to publication &mdash; particularly medical students and authors from lower-income settings. We review every request individually.`
    ),
    paragraph(
      `If anything about your inquiry needs correcting or you would like to add supporting context, simply reply to this message.`
    ),
    paragraph(`With appreciation,<br />The OSCRSJ Editorial Office`),
  ].join('\n')

  const html = renderEmailShell({
    previewText:
      'Your APC discount inquiry has been received. We will respond within 2 business days.',
    heading: 'Your discount inquiry was received',
    bodyHtml,
  })

  const text =
    `Dear ${inquirerName},\n\n` +
    `Thank you for reaching out about an APC discount. We have received your inquiry and a member of the editorial office will respond within 2 business days.\n\n` +
    `OSCRSJ is committed to supporting authors who would otherwise face a financial barrier to publication — particularly medical students and authors from lower-income settings. We review every request individually.\n\n` +
    `If anything about your inquiry needs correcting or you would like to add supporting context, simply reply to this message.\n\n` +
    `With appreciation,\nThe OSCRSJ Editorial Office` +
    plainTextFooter()

  return { html, text }
}

export function getDiscountInquiryConfirmationSubject(): string {
  return 'Your discount inquiry was received — OSCRSJ'
}
