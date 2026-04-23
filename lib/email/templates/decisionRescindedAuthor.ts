// ============================================================
// Decision rescinded — author notification (Session 13)
// ============================================================
// Fired when an editor undoes their own decision within the
// 15-minute rescind window. The corresponding author should
// disregard the prior decision letter — a corrected decision
// will follow.
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

export interface DecisionRescindedAuthorParams {
  authorName: string
  submissionId: string
  manuscriptTitle: string
  rescindedReason: string
  dashboardUrl: string
}

export function renderDecisionRescindedAuthor(
  params: DecisionRescindedAuthorParams
): RenderedEmail {
  const {
    authorName,
    submissionId,
    manuscriptTitle,
    rescindedReason,
    dashboardUrl,
  } = params

  const bodyHtml = [
    paragraph(`Dear ${escapeHtml(authorName)},`),
    paragraph(
      `We are writing to apologise: the editorial decision you received earlier today on your submission has been <strong>rescinded</strong> by the issuing editor. Please disregard the previous decision letter in its entirety.`
    ),
    detailsList([
      ['Submission ID', submissionId],
      ['Manuscript', manuscriptTitle],
      ['Reason for rescission', rescindedReason],
    ]),
    paragraph(
      `The manuscript is back in its prior editorial state. A corrected decision will follow once the editor has had a chance to re-review. There is nothing further for you to do at this point.`
    ),
    cta(dashboardUrl, 'Return to dashboard'),
    paragraph(
      `Thank you for your patience while we get this right.`
    ),
    paragraph(`Sincerely,<br />The OSCRSJ Editorial Office`),
  ].join('\n')

  const html = renderEmailShell({
    previewText: `Decision rescinded — submission ${submissionId}`,
    heading: 'Decision rescinded — please disregard the prior letter',
    bodyHtml,
  })

  const text =
    `Dear ${authorName},\n\n` +
    `We are writing to apologise: the editorial decision you received earlier today on your submission has been rescinded by the issuing editor. Please disregard the previous decision letter in its entirety.\n\n` +
    `Submission ID: ${submissionId}\n` +
    `Manuscript: ${manuscriptTitle}\n` +
    `Reason for rescission: ${rescindedReason}\n\n` +
    `The manuscript is back in its prior editorial state. A corrected decision will follow once the editor has had a chance to re-review. There is nothing further for you to do at this point.\n\n` +
    `Return to dashboard: ${dashboardUrl}\n\n` +
    `Thank you for your patience while we get this right.\n\n` +
    `Sincerely,\nThe OSCRSJ Editorial Office` +
    plainTextFooter()

  return { html, text }
}

export function getDecisionRescindedAuthorSubject(
  submissionId: string
): string {
  return `[OSCRSJ] Editorial decision rescinded — submission ${submissionId} (please disregard prior letter)`
}
