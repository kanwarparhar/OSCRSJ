// ============================================================
// APC invoice — corresponding author
// ============================================================
// Sent when an editor issues the article processing charge on an
// accepted manuscript.
//
// TONE IS LOAD-BEARING. This is the single email most likely to make
// OSCRSJ read as predatory, because it arrives shortly after an
// acceptance and asks for money. Three things must be unmistakable:
//   1. Acceptance is already secured and is NOT contingent on payment.
//   2. Nobody involved in the editorial decision sees payment status.
//   3. The invoice is administrative, with a real due date and a PDF
//      the author's institution can reimburse against.
// Administrative register throughout. Never collections language,
// never urgency, never a countdown.
//
// Stripe sends its own invoice email carrying the payment UX. This one
// goes FIRST and is the contextual heads-up — "here is what is coming
// and why". Do not duplicate Stripe's content; do not make this one
// look like a second invoice.
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

export interface ApcInvoiceAuthorParams {
  authorName: string
  submissionId: string
  title: string
  amountDisplay: string // e.g. "$399.00"
  dueDateDisplay: string // e.g. "September 1, 2026"
  hostedInvoiceUrl: string
  invoicePdfUrl: string | null
  dashboardUrl: string
}

export function renderApcInvoiceAuthor(
  params: ApcInvoiceAuthorParams
): RenderedEmail {
  const {
    authorName,
    submissionId,
    title,
    amountDisplay,
    dueDateDisplay,
    hostedInvoiceUrl,
    invoicePdfUrl,
    dashboardUrl,
  } = params

  const bodyHtml = [
    paragraph(`Dear ${escapeHtml(authorName)},`),
    paragraph(
      `Your manuscript has been accepted for publication in the Orthopedic Surgery Case Reports &amp; Series Journal. <strong>That decision is final and is not affected by this invoice.</strong>`
    ),
    paragraph(
      `The article processing charge for the manuscript is now due. It is a one-time charge, applied once per accepted manuscript regardless of the number of authors, revisions, or figures.`
    ),
    detailsList([
      ['Submission ID', submissionId],
      ['Title', title],
      ['Amount', amountDisplay],
      ['Due', dueDateDisplay],
    ]),
    cta(hostedInvoiceUrl, 'View and pay invoice'),
    paragraph(
      `The invoice can be paid by card or by bank transfer (ACH). If your institution or department is paying, bank transfer is usually the simpler route and the invoice page supports it directly.`
    ),
    invoicePdfUrl
      ? paragraph(
          `A PDF copy is available for institutional reimbursement or purchase-order processing: <a href="${escapeHtml(
            invoicePdfUrl
          )}" style="color:#664930;">download the invoice PDF</a>.`
        )
      : '',
    paragraph(
      `Payment status is never disclosed to reviewers or to the handling editor, and plays no part in any editorial process. Production continues once payment is recorded.`
    ),
    paragraph(
      `If anything about this invoice looks wrong — the amount, the recipient, or the manuscript it refers to — reply to this email and we will correct it before it goes any further.`
    ),
    cta(dashboardUrl, 'View submission'),
    paragraph(`With thanks,<br />The OSCRSJ Editorial Office`),
  ]
    .filter(Boolean)
    .join('\n')

  const html = renderEmailShell({
    previewText: `Article processing charge for ${submissionId} — ${amountDisplay}, due ${dueDateDisplay}.`,
    heading: 'Article processing charge',
    bodyHtml,
  })

  const text =
    `Dear ${authorName},\n\n` +
    `Your manuscript has been accepted for publication in OSCRSJ. That decision is final and is not affected by this invoice.\n\n` +
    `The article processing charge is now due. It is a one-time charge, applied once per accepted manuscript regardless of the number of authors, revisions, or figures.\n\n` +
    `Submission ID: ${submissionId}\n` +
    `Title: ${title}\n` +
    `Amount: ${amountDisplay}\n` +
    `Due: ${dueDateDisplay}\n\n` +
    `View and pay the invoice: ${hostedInvoiceUrl}\n\n` +
    `The invoice can be paid by card or by bank transfer (ACH). If your institution is paying, bank transfer is usually simpler.\n\n` +
    (invoicePdfUrl ? `Invoice PDF (for institutional reimbursement): ${invoicePdfUrl}\n\n` : '') +
    `Payment status is never disclosed to reviewers or to the handling editor, and plays no part in any editorial process.\n\n` +
    `If anything about this invoice looks wrong, reply to this email and we will correct it.\n\n` +
    `View submission: ${dashboardUrl}\n\n` +
    `With thanks,\nThe OSCRSJ Editorial Office` +
    plainTextFooter()

  return { html, text }
}

export function getApcInvoiceAuthorSubject(
  submissionId: string,
  amountDisplay: string
): string {
  return `[OSCRSJ] Article processing charge for ${submissionId} — ${amountDisplay}`
}
