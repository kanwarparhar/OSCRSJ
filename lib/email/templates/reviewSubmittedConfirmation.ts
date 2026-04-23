// ============================================================
// Review submitted confirmation (to reviewer)
// ============================================================
// Sent to the reviewer after they press "Submit review" on
// /review/[token]/form. Short thank-you + timeline expectation.
// Deliberately does NOT echo back the review content -- the
// reviewer already has the form in front of them; a full echo
// would also land the confidential comments-to-editor in their
// inbox, which is undesirable on principle.
// ============================================================

import {
  renderEmailShell,
  paragraph,
  plainTextFooter,
  escapeHtml,
  type RenderedEmail,
} from './shared'

export interface ReviewSubmittedConfirmationParams {
  firstName: string
  manuscriptTitle: string
}

export function renderReviewSubmittedConfirmation(
  params: ReviewSubmittedConfirmationParams
): RenderedEmail {
  const { firstName, manuscriptTitle } = params

  const bodyHtml = [
    paragraph(`Dear ${escapeHtml(firstName)},`),
    paragraph(
      `Thank you for submitting your review of "${escapeHtml(manuscriptTitle)}". Your assessment has been received by the editorial office.`
    ),
    paragraph(
      `The editor will consider your feedback alongside the other reviewers' submissions. You will typically hear back within about two weeks as the decision is finalised; if the editor needs clarification on any point, they will reach out directly.`
    ),
    paragraph(
      `Reviewing is voluntary labour that keeps peer review alive. We are grateful for the time and expertise you contributed.`
    ),
    paragraph(`With appreciation,<br />The OSCRSJ Editorial Office`),
  ].join('\n')

  const html = renderEmailShell({
    previewText: 'Your review has been received.',
    heading: 'Review received — thank you',
    bodyHtml,
  })

  const text =
    `Dear ${firstName},\n\n` +
    `Thank you for submitting your review of "${manuscriptTitle}". Your assessment has been received by the editorial office.\n\n` +
    `The editor will consider your feedback alongside the other reviewers' submissions. You will typically hear back within about two weeks as the decision is finalised; if the editor needs clarification on any point, they will reach out directly.\n\n` +
    `Reviewing is voluntary labour that keeps peer review alive. We are grateful for the time and expertise you contributed.\n\n` +
    `With appreciation,\nThe OSCRSJ Editorial Office` +
    plainTextFooter()

  return { html, text }
}

export function getReviewSubmittedConfirmationSubject(
  manuscriptTitle: string
): string {
  const safe = manuscriptTitle.length > 80
    ? `${manuscriptTitle.slice(0, 77)}…`
    : manuscriptTitle
  return `Review received for "${safe}" — OSCRSJ`
}
