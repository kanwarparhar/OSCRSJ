// ============================================================
// APC payment receipt — corresponding author
// ============================================================
// Fired by the Stripe webhook on invoice.paid. Confirms receipt and
// says plainly what happens next, so the author is never left
// wondering whether the payment landed.
//
// Deliberately short. A receipt that over-explains reads as anxious.
// ============================================================

import {
  renderEmailShell,
  paragraph,
  cta,
  detailsList,
  plainTextFooter,
  escapeHtml,
  type RenderedEmail,
} from './shared'

export interface ApcPaymentReceiptParams {
  authorName: string
  submissionId: string
  title: string
  amountDisplay: string
  paidDateDisplay: string
  invoicePdfUrl: string | null
  dashboardUrl: string
}

export function renderApcPaymentReceipt(
  params: ApcPaymentReceiptParams
): RenderedEmail {
  const {
    authorName,
    submissionId,
    title,
    amountDisplay,
    paidDateDisplay,
    invoicePdfUrl,
    dashboardUrl,
  } = params

  const bodyHtml = [
    paragraph(`Dear ${escapeHtml(authorName)},`),
    paragraph(
      `We have received payment of the article processing charge for your accepted manuscript. Thank you.`
    ),
    detailsList([
      ['Submission ID', submissionId],
      ['Title', title],
      ['Amount paid', amountDisplay],
      ['Received', paidDateDisplay],
    ]),
    paragraph(
      `Your article now moves into production. You will hear from the editorial office about proofs before publication, and nothing further is required from you in the meantime.`
    ),
    invoicePdfUrl
      ? paragraph(
          `A paid invoice for your records or for institutional reimbursement is available here: <a href="${escapeHtml(
            invoicePdfUrl
          )}" style="color:#664930;">download the invoice PDF</a>.`
        )
      : '',
    cta(dashboardUrl, 'View submission'),
    paragraph(`With thanks,<br />The OSCRSJ Editorial Office`),
  ]
    .filter(Boolean)
    .join('\n')

  const html = renderEmailShell({
    previewText: `Payment received for ${submissionId}. Your article moves into production.`,
    heading: 'Payment received',
    bodyHtml,
  })

  const text =
    `Dear ${authorName},\n\n` +
    `We have received payment of the article processing charge for your accepted manuscript. Thank you.\n\n` +
    `Submission ID: ${submissionId}\n` +
    `Title: ${title}\n` +
    `Amount paid: ${amountDisplay}\n` +
    `Received: ${paidDateDisplay}\n\n` +
    `Your article now moves into production. You will hear from the editorial office about proofs before publication.\n\n` +
    (invoicePdfUrl ? `Paid invoice PDF: ${invoicePdfUrl}\n\n` : '') +
    `View submission: ${dashboardUrl}\n\n` +
    `With thanks,\nThe OSCRSJ Editorial Office` +
    plainTextFooter()

  return { html, text }
}

export function getApcPaymentReceiptSubject(submissionId: string): string {
  return `[OSCRSJ] Payment received — ${submissionId}`
}
