// ============================================================
// Withdrawal confirmation email
// ============================================================
// Fired when a corresponding author withdraws a manuscript from
// `/dashboard` while the manuscript is still pre-decision. Three
// recipient variants share one template:
//   - 'author'   : confirmation to the corresponding author
//   - 'editor'   : alert to the editorial office (currently Kanwar's
//                  Gmail until a proper editorial inbox exists)
//   - 'reviewer' : notice to any reviewer who had an active invitation
//                  so they can stop work; their invitation is also
//                  cancelled in the database
// ============================================================

import {
  renderEmailShell,
  paragraph,
  detailsList,
  plainTextFooter,
  escapeHtml,
  type RenderedEmail,
} from './shared'

export type WithdrawalRecipientRole = 'author' | 'editor' | 'reviewer'

export interface WithdrawalConfirmationParams {
  recipientName: string
  recipientRole: WithdrawalRecipientRole
  correspondingAuthorName: string
  submissionId: string
  title: string
  withdrawnAt: string // ISO timestamp
  reason?: string | null
}

export function renderWithdrawalConfirmation(
  params: WithdrawalConfirmationParams
): RenderedEmail {
  const {
    recipientName,
    recipientRole,
    correspondingAuthorName,
    submissionId,
    title,
    withdrawnAt,
    reason,
  } = params

  const heading =
    recipientRole === 'author'
      ? 'Your submission has been withdrawn'
      : recipientRole === 'reviewer'
        ? 'A manuscript you were reviewing has been withdrawn'
        : 'Manuscript withdrawn by author'

  const opening =
    recipientRole === 'author'
      ? paragraph(
          `This email confirms that you have withdrawn your submission from OSCRSJ. The manuscript has been removed from our editorial queue and no further review will take place.`
        )
      : recipientRole === 'reviewer'
        ? paragraph(
            `The corresponding author has withdrawn the submission below. Your review invitation has been cancelled and no further work is needed. Thank you for your willingness to serve as a reviewer for OSCRSJ.`
          )
        : paragraph(
            `The corresponding author has withdrawn the submission below from OSCRSJ. The manuscript status has been set to withdrawn and any active reviewer invitations have been cancelled.`
          )

  const detailRows: Array<[string, string]> = [
    ['Submission ID', submissionId],
    ['Title', title],
    ['Corresponding author', correspondingAuthorName],
    ['Withdrawn at', formatTimestamp(withdrawnAt)],
  ]
  if (reason && reason.trim()) {
    detailRows.push(['Reason', reason.trim()])
  }

  const closing =
    recipientRole === 'author'
      ? paragraph(
          `You are welcome to submit a revised version of this work in the future. If the withdrawal was unintended, please reply to this email and we will do our best to help.`
        )
      : recipientRole === 'reviewer'
        ? paragraph(
            `There is nothing further for you to do. We will be in touch with future review opportunities.`
          )
        : paragraph(
            `No action is required. This notice is for your records.`
          )

  const bodyHtml = [
    paragraph(`Dear ${escapeHtml(recipientName)},`),
    opening,
    detailsList(detailRows),
    closing,
    paragraph(`With appreciation,<br />The OSCRSJ Editorial Office`),
  ].join('\n')

  const previewText =
    recipientRole === 'author'
      ? `Your submission ${submissionId} has been withdrawn from OSCRSJ.`
      : `Submission ${submissionId} has been withdrawn by the author.`

  const html = renderEmailShell({
    previewText,
    heading,
    bodyHtml,
    footerNote: `Submission ID: ${submissionId}`,
  })

  const reasonLine =
    reason && reason.trim() ? `Reason: ${reason.trim()}\n` : ''

  const text =
    `Dear ${recipientName},\n\n` +
    (recipientRole === 'author'
      ? `This email confirms that you have withdrawn your submission from OSCRSJ. The manuscript has been removed from our editorial queue and no further review will take place.\n\n`
      : recipientRole === 'reviewer'
        ? `The corresponding author has withdrawn the submission below. Your review invitation has been cancelled and no further work is needed. Thank you for your willingness to serve as a reviewer for OSCRSJ.\n\n`
        : `The corresponding author has withdrawn the submission below from OSCRSJ. The manuscript status has been set to withdrawn and any active reviewer invitations have been cancelled.\n\n`) +
    `Submission ID: ${submissionId}\n` +
    `Title: ${title}\n` +
    `Corresponding author: ${correspondingAuthorName}\n` +
    `Withdrawn at: ${formatTimestamp(withdrawnAt)}\n` +
    reasonLine +
    `\n` +
    (recipientRole === 'author'
      ? `You are welcome to submit a revised version of this work in the future. If the withdrawal was unintended, please reply to this email and we will do our best to help.\n\n`
      : recipientRole === 'reviewer'
        ? `There is nothing further for you to do. We will be in touch with future review opportunities.\n\n`
        : `No action is required. This notice is for your records.\n\n`) +
    `With appreciation,\nThe OSCRSJ Editorial Office` +
    plainTextFooter()

  return { html, text }
}

export function getWithdrawalSubject(
  submissionId: string,
  role: WithdrawalRecipientRole
): string {
  if (role === 'author') {
    return `Withdrawal confirmed — ${submissionId}`
  }
  if (role === 'reviewer') {
    return `Review cancelled: manuscript withdrawn — ${submissionId}`
  }
  return `Manuscript withdrawn by author — ${submissionId}`
}

function formatTimestamp(iso: string): string {
  try {
    return new Date(iso).toUTCString()
  } catch {
    return iso
  }
}
