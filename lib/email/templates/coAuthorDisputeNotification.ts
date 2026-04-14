// ============================================================
// Co-author dispute notification
// ============================================================
// Fired when a co-author clicks the "I did not agree" link in their
// notification email. Sent both to the corresponding author (so they
// know the submission is on hold) and to the editorial office (so a
// human can review the objection).
// ============================================================

import {
  renderEmailShell,
  paragraph,
  detailsList,
  plainTextFooter,
  escapeHtml,
  type RenderedEmail,
} from './shared'

export interface CoAuthorDisputeNotificationParams {
  recipientName: string
  correspondingAuthorName: string
  coAuthorEmail: string
  submissionId: string
  title: string
  disputedAt: string // ISO timestamp
  forEditor?: boolean // slight wording tweak when sent to editorial office
}

export function renderCoAuthorDisputeNotification(
  params: CoAuthorDisputeNotificationParams
): RenderedEmail {
  const {
    recipientName,
    correspondingAuthorName,
    coAuthorEmail,
    submissionId,
    title,
    disputedAt,
    forEditor,
  } = params
  const subject = `Co-author dispute filed — ${submissionId}`

  const openingHtml = forEditor
    ? paragraph(
        `A listed co-author has objected to being included on the following submission. The manuscript is held pending editorial review.`
      )
    : paragraph(
        `We are writing to let you know that a listed co-author has objected to being included on your submission. The manuscript is held pending review by the editorial office and will not advance to peer review until the objection is resolved.`
      )

  const nextStepsHtml = forEditor
    ? paragraph(
        `Please review the authorship documentation and contact the corresponding author to resolve the dispute.`
      )
    : paragraph(
        `A member of the editorial office will contact you shortly. If this is unexpected, please gather any authorship documentation you have (prior correspondence, signed consent, etc.) so we can resolve the issue quickly.`
      )

  const bodyHtml = [
    paragraph(`Dear ${escapeHtml(recipientName)},`),
    openingHtml,
    detailsList([
      ['Submission ID', submissionId],
      ['Title', title],
      ['Corresponding author', correspondingAuthorName],
      ['Disputing co-author', coAuthorEmail],
      ['Filed at', formatTimestamp(disputedAt)],
    ]),
    nextStepsHtml,
    paragraph(`With appreciation,<br />The OSCRSJ Editorial Office`),
  ].join('\n')

  const html = renderEmailShell({
    previewText: `A co-author has disputed authorship on ${submissionId}. The submission is on hold.`,
    heading: 'Co-author dispute filed',
    bodyHtml,
    footerNote: `Submission ID: ${submissionId}`,
  })

  const text =
    `Dear ${recipientName},\n\n` +
    (forEditor
      ? `A listed co-author has objected to being included on the following submission. The manuscript is held pending editorial review.\n\n`
      : `We are writing to let you know that a listed co-author has objected to being included on your submission. The manuscript is held pending review by the editorial office and will not advance to peer review until the objection is resolved.\n\n`) +
    `Submission ID: ${submissionId}\n` +
    `Title: ${title}\n` +
    `Corresponding author: ${correspondingAuthorName}\n` +
    `Disputing co-author: ${coAuthorEmail}\n` +
    `Filed at: ${formatTimestamp(disputedAt)}\n\n` +
    (forEditor
      ? `Please review the authorship documentation and contact the corresponding author to resolve the dispute.\n\n`
      : `A member of the editorial office will contact you shortly. If this is unexpected, please gather any authorship documentation you have so we can resolve the issue quickly.\n\n`) +
    `With appreciation,\nThe OSCRSJ Editorial Office` +
    plainTextFooter()

  return { html, text }
}

export function getCoAuthorDisputeSubject(submissionId: string): string {
  return `Co-author dispute filed — ${submissionId}`
}

function formatTimestamp(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toUTCString()
  } catch {
    return iso
  }
}
