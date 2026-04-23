// ============================================================
// Reviewer application confirmation
// ============================================================
// Sent to a prospective reviewer immediately after they submit the
// `/for-reviewers/apply` form. Confirms receipt and sets the
// 14-day response expectation.
// ============================================================

import {
  renderEmailShell,
  paragraph,
  cta,
  plainTextFooter,
  escapeHtml,
  type RenderedEmail,
} from './shared'

export interface ReviewerApplicationConfirmationParams {
  applicantName: string
  forReviewersUrl: string
}

export function renderReviewerApplicationConfirmation(
  params: ReviewerApplicationConfirmationParams
): RenderedEmail {
  const { applicantName, forReviewersUrl } = params

  const bodyHtml = [
    paragraph(`Dear ${escapeHtml(applicantName)},`),
    paragraph(
      `Thank you for your interest in reviewing for OSCRSJ. We have received your application and a member of the editorial office will respond within 14 days.`
    ),
    paragraph(
      `Our reviewers are central to the journal's scholarly integrity. While you wait to hear back, you may wish to revisit our reviewer guidelines.`
    ),
    cta(forReviewersUrl, 'Reviewer Guidelines'),
    paragraph(
      `If anything about your application needs correcting, reply to this message and we will update your record.`
    ),
    paragraph(`With appreciation,<br />The OSCRSJ Editorial Office`),
  ].join('\n')

  const html = renderEmailShell({
    previewText:
      'Your reviewer application has been received. We will respond within 14 days.',
    heading: 'Your reviewer application was received',
    bodyHtml,
  })

  const text =
    `Dear ${applicantName},\n\n` +
    `Thank you for your interest in reviewing for OSCRSJ. We have received your application and a member of the editorial office will respond within 14 days.\n\n` +
    `Our reviewers are central to the journal's scholarly integrity. While you wait to hear back, you may wish to revisit our reviewer guidelines at ${forReviewersUrl}.\n\n` +
    `If anything about your application needs correcting, reply to this message and we will update your record.\n\n` +
    `With appreciation,\nThe OSCRSJ Editorial Office` +
    plainTextFooter()

  return { html, text }
}

export function getReviewerApplicationConfirmationSubject(): string {
  return 'Your reviewer application was received — OSCRSJ'
}
