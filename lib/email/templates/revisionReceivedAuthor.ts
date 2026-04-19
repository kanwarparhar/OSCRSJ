// ============================================================
// Revision received — author confirmation
// ============================================================
// Sent to the corresponding author after they submit a revised
// manuscript through /dashboard/submit?revising={id}.
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

export interface RevisionReceivedAuthorParams {
  authorName: string
  submissionId: string
  title: string
  revisionNumber: number
  dashboardUrl: string
}

export function renderRevisionReceivedAuthor(
  params: RevisionReceivedAuthorParams
): RenderedEmail {
  const { authorName, submissionId, title, revisionNumber, dashboardUrl } =
    params

  const bodyHtml = [
    paragraph(`Dear ${escapeHtml(authorName)},`),
    paragraph(
      `We've received your revised manuscript. Thank you for the careful work in addressing the reviewer and editor comments.`
    ),
    detailsList([
      ['Submission ID', submissionId],
      ['Title', title],
      ['Revision', `v${revisionNumber}`],
    ]),
    paragraph(
      `The editorial office will review your response and either confirm acceptance, return the manuscript to the original reviewers for a second round of review, or reach out with follow-up questions. You should expect to hear back within 30 days.`
    ),
    cta(dashboardUrl, 'View submission'),
    paragraph(`With thanks,<br />The OSCRSJ Editorial Office`),
  ].join('\n')

  const html = renderEmailShell({
    previewText: `Revision v${revisionNumber} received for OSCRSJ submission ${submissionId}.`,
    heading: 'Revision received',
    bodyHtml,
  })

  const text =
    `Dear ${authorName},\n\n` +
    `We've received your revised manuscript. Thank you for the careful work in addressing the reviewer and editor comments.\n\n` +
    `Submission ID: ${submissionId}\n` +
    `Title: ${title}\n` +
    `Revision: v${revisionNumber}\n\n` +
    `The editorial office will review your response. You should expect to hear back within 30 days.\n\n` +
    `View submission: ${dashboardUrl}\n\n` +
    `With thanks,\nThe OSCRSJ Editorial Office` +
    plainTextFooter()

  return { html, text }
}

export function getRevisionReceivedAuthorSubject(
  submissionId: string,
  revisionNumber: number
): string {
  return `[OSCRSJ] Revision v${revisionNumber} received for ${submissionId}`
}
