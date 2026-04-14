// ============================================================
// Co-author notification email
// ============================================================
// Sent to each non-corresponding author on a submission. Per COPE,
// every co-author must be informed when they are listed, and must
// have a mechanism to object if they did not consent to authorship.
//
// The "I did not agree" link carries a signed JWT so the dispute
// handler can verify the objection and record it against the correct
// manuscript + co-author.
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

export interface CoAuthorNotificationParams {
  coAuthorName: string
  correspondingAuthorName: string
  submissionId: string
  title: string
  disputeUrl: string
}

export function renderCoAuthorNotification(
  params: CoAuthorNotificationParams
): RenderedEmail {
  const {
    coAuthorName,
    correspondingAuthorName,
    submissionId,
    title,
    disputeUrl,
  } = params
  const subject = `You have been listed as a co-author — ${submissionId}`

  const bodyHtml = [
    paragraph(`Dear ${escapeHtml(coAuthorName)},`),
    paragraph(
      `${escapeHtml(correspondingAuthorName)} has submitted a manuscript to OSCRSJ and has listed you as a co-author. The corresponding author has certified, on behalf of all listed authors, that you have agreed to be included.`
    ),
    detailsList([
      ['Submission ID', submissionId],
      ['Title', title],
      ['Corresponding author', correspondingAuthorName],
    ]),
    paragraph(
      `We follow COPE guidance, which requires that every listed co-author be given the opportunity to confirm or dispute authorship. If you consented to being listed, no action is needed; you will receive a further email if your input is requested during review.`
    ),
    paragraph(
      `If you did not agree to be listed as a co-author, please let us know using the link below. The submission will be held pending review by the editorial office.`
    ),
    cta(disputeUrl, 'I did not agree to be listed'),
    paragraph(
      `The link above is unique to you and expires in 30 days. If you have any other questions, reply to this message and a member of the editorial office will respond.`
    ),
    paragraph(`With appreciation,<br />The OSCRSJ Editorial Office`),
  ].join('\n')

  const html = renderEmailShell({
    previewText: `You were listed as a co-author on submission ${submissionId}. Confirm or dispute within this email.`,
    heading: 'You have been listed as a co-author',
    bodyHtml,
    footerNote: `Submission ID: ${submissionId}`,
  })

  const text =
    `Dear ${coAuthorName},\n\n` +
    `${correspondingAuthorName} has submitted a manuscript to OSCRSJ and has listed you as a co-author. The corresponding author has certified, on behalf of all listed authors, that you have agreed to be included.\n\n` +
    `Submission ID: ${submissionId}\n` +
    `Title: ${title}\n` +
    `Corresponding author: ${correspondingAuthorName}\n\n` +
    `We follow COPE guidance, which requires that every listed co-author be given the opportunity to confirm or dispute authorship. If you consented to being listed, no action is needed.\n\n` +
    `If you did not agree to be listed as a co-author, please open the link below. The submission will be held pending review by the editorial office.\n\n` +
    `Dispute link: ${disputeUrl}\n\n` +
    `The link above is unique to you and expires in 30 days.\n\n` +
    `With appreciation,\nThe OSCRSJ Editorial Office` +
    plainTextFooter()

  return { html, text }
}

export function getCoAuthorNotificationSubject(submissionId: string): string {
  return `You have been listed as a co-author — ${submissionId}`
}
