// ============================================================
// Reviewer invitation editor notification
// ============================================================
// Fires to the editorial inbox when an invitee accepts or declines
// an invitation. Keeps the editor in the loop without requiring
// them to poll the admin UI.
// ============================================================

import {
  renderEmailShell,
  paragraph,
  detailsList,
  plainTextFooter,
  escapeHtml,
  type RenderedEmail,
} from './shared'

export interface ReviewerInvitationEditorNotificationParams {
  invitationId: string
  manuscriptTitle: string
  submissionId: string
  reviewerName: string
  reviewerEmail: string
  accepted: boolean
  declinedReason: string | null
  respondedAt: string
}

export function renderReviewerInvitationEditorNotification(
  params: ReviewerInvitationEditorNotificationParams
): RenderedEmail {
  const {
    manuscriptTitle,
    submissionId,
    reviewerName,
    reviewerEmail,
    accepted,
    declinedReason,
    respondedAt,
  } = params

  const headline = accepted
    ? 'Reviewer accepted invitation'
    : 'Reviewer declined invitation'

  const bodyHtml = [
    paragraph(
      accepted
        ? `<strong>${escapeHtml(reviewerName)}</strong> has accepted the invitation to review <strong>${escapeHtml(submissionId)}</strong>.`
        : `<strong>${escapeHtml(reviewerName)}</strong> has declined the invitation to review <strong>${escapeHtml(submissionId)}</strong>.`
    ),
    detailsList([
      ['Manuscript', manuscriptTitle],
      ['Submission ID', submissionId],
      ['Reviewer', reviewerName],
      ['Email', reviewerEmail],
      ['Status', accepted ? 'Accepted' : 'Declined'],
      ['Responded at', respondedAt],
    ]),
    !accepted && declinedReason
      ? paragraph(`<strong>Reason given:</strong> ${escapeHtml(declinedReason)}`)
      : '',
    paragraph(
      accepted
        ? `Next step: send the full manuscript, reviewer guidelines, and structured review form to the reviewer, and set the review deadline.`
        : `Next step: invite another reviewer from the active pool in the admin UI.`
    ),
  ]
    .filter(Boolean)
    .join('\n')

  const html = renderEmailShell({
    previewText: accepted
      ? `${reviewerName} accepted the invitation for ${submissionId}.`
      : `${reviewerName} declined the invitation for ${submissionId}.`,
    heading: headline,
    bodyHtml,
  })

  const text =
    `${headline}\n\n` +
    `Manuscript: ${manuscriptTitle}\n` +
    `Submission ID: ${submissionId}\n` +
    `Reviewer: ${reviewerName}\n` +
    `Email: ${reviewerEmail}\n` +
    `Status: ${accepted ? 'Accepted' : 'Declined'}\n` +
    `Responded at: ${respondedAt}\n\n` +
    (!accepted && declinedReason ? `Reason given: ${declinedReason}\n\n` : '') +
    (accepted
      ? `Next step: send the full manuscript, reviewer guidelines, and structured review form to the reviewer, and set the review deadline.`
      : `Next step: invite another reviewer from the active pool in the admin UI.`) +
    plainTextFooter()

  return { html, text }
}

export function getReviewerInvitationEditorNotificationSubject(
  submissionId: string,
  accepted: boolean
): string {
  return accepted
    ? `Reviewer accepted: ${submissionId} — OSCRSJ`
    : `Reviewer declined: ${submissionId} — OSCRSJ`
}
