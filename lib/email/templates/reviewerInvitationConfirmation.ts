// ============================================================
// Reviewer invitation confirmation (to invitee)
// ============================================================
// Sent to the invitee after they confirm their Accept or Decline
// choice on /review/[token]. Acts as a receipt so they have a
// thread to reply into if anything needs to change.
// ============================================================

import {
  renderEmailShell,
  paragraph,
  plainTextFooter,
  escapeHtml,
  type RenderedEmail,
} from './shared'

export interface ReviewerInvitationConfirmationParams {
  firstName: string
  manuscriptTitle: string
  accepted: boolean
  declinedReason: string | null
}

export function renderReviewerInvitationConfirmation(
  params: ReviewerInvitationConfirmationParams
): RenderedEmail {
  const { firstName, manuscriptTitle, accepted, declinedReason } = params

  const headline = accepted
    ? 'Thank you for accepting'
    : 'Thank you for responding'

  const intro = accepted
    ? `Thank you for agreeing to review "${escapeHtml(manuscriptTitle)}" for OSCRSJ. A member of the editorial office will be in touch shortly with the full manuscript, the structured review form, and the review deadline.`
    : `Thank you for letting us know you are unable to review "${escapeHtml(manuscriptTitle)}" at this time. We appreciate the prompt response and will invite another reviewer.`

  const bodyHtml = [
    paragraph(`Dear ${escapeHtml(firstName)},`),
    paragraph(intro),
    !accepted && declinedReason
      ? paragraph(
          `<strong>Your note:</strong> ${escapeHtml(declinedReason)}`
        )
      : '',
    paragraph(
      `If any of the details above are incorrect, simply reply to this message and the editorial office will update the record.`
    ),
    paragraph(`With appreciation,<br />The OSCRSJ Editorial Office`),
  ]
    .filter(Boolean)
    .join('\n')

  const html = renderEmailShell({
    previewText: accepted
      ? 'Your acceptance has been recorded.'
      : 'Your decline has been recorded.',
    heading: headline,
    bodyHtml,
  })

  const text =
    `Dear ${firstName},\n\n` +
    (accepted
      ? `Thank you for agreeing to review "${manuscriptTitle}" for OSCRSJ. A member of the editorial office will be in touch shortly with the full manuscript, the structured review form, and the review deadline.\n\n`
      : `Thank you for letting us know you are unable to review "${manuscriptTitle}" at this time. We appreciate the prompt response and will invite another reviewer.\n\n`) +
    (!accepted && declinedReason ? `Your note: ${declinedReason}\n\n` : '') +
    `If any of the details above are incorrect, simply reply to this message and the editorial office will update the record.\n\n` +
    `With appreciation,\nThe OSCRSJ Editorial Office` +
    plainTextFooter()

  return { html, text }
}

export function getReviewerInvitationConfirmationSubject(
  accepted: boolean
): string {
  return accepted
    ? 'Your review acceptance has been recorded — OSCRSJ'
    : 'Your review decline has been recorded — OSCRSJ'
}
