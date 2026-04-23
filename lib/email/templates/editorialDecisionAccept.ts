// ============================================================
// Editorial decision — Accept
// ============================================================
// Sent to the corresponding author when an editor issues an
// `accept` decision. Maps manuscripts.status → 'accepted'. Does
// not advance to awaiting_payment — APC invoicing is a downstream
// (future) admin action once Brad's Stripe integration lands.
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

export interface EditorialDecisionAcceptParams {
  authorName: string
  submissionId: string
  title: string
  decisionLetter: string
  dashboardUrl: string
}

function renderLetterHtml(letter: string): string {
  // Plain-text letter rendered inside a monospace, cream-tinted
  // <pre> block. Escape first so markdown/HTML in the letter cannot
  // leak into rendered email output.
  const safe = escapeHtml(letter)
  return `
    <div style="margin: 0 0 24px 0; padding: 16px; background-color: #FFF5EB; border: 1px solid rgba(153,126,103,0.18); border-radius: 4px;">
      <pre style="margin: 0; font-family: 'Courier New', Courier, monospace; font-size: 14px; line-height: 22px; color: #3d2a18; white-space: pre-wrap; word-break: break-word;">${safe}</pre>
    </div>
  `
}

export function renderEditorialDecisionAccept(
  params: EditorialDecisionAcceptParams
): RenderedEmail {
  const { authorName, submissionId, title, decisionLetter, dashboardUrl } =
    params

  const bodyHtml = [
    paragraph(`Dear ${escapeHtml(authorName)},`),
    paragraph(
      `We are pleased to inform you that your submission has been <strong>accepted</strong> for publication in the Orthopedic Surgery Case Reports &amp; Series Journal.`
    ),
    detailsList([
      ['Submission ID', submissionId],
      ['Title', title],
      ['Decision', 'Accepted'],
    ]),
    paragraph(`<strong>Editor's letter</strong>`),
    renderLetterHtml(decisionLetter),
    paragraph(
      `Next steps: our editorial team will contact you regarding copyediting, proof review, and APC invoicing (if applicable in your fee window). You do not need to take action today.`
    ),
    cta(dashboardUrl, 'View submission'),
    paragraph(`Congratulations, and thank you for choosing OSCRSJ.`),
    paragraph(`With thanks,<br />The OSCRSJ Editorial Office`),
  ].join('\n')

  const html = renderEmailShell({
    previewText: `Your OSCRSJ submission ${submissionId} has been accepted.`,
    heading: 'Decision: Accepted',
    bodyHtml,
  })

  const text =
    `Dear ${authorName},\n\n` +
    `We are pleased to inform you that your submission has been ACCEPTED for publication in OSCRSJ.\n\n` +
    `Submission ID: ${submissionId}\n` +
    `Title: ${title}\n` +
    `Decision: Accepted\n\n` +
    `Editor's letter:\n\n${decisionLetter}\n\n` +
    `Next steps: our editorial team will contact you regarding copyediting, proof review, and APC invoicing.\n\n` +
    `View submission: ${dashboardUrl}\n\n` +
    `Congratulations, and thank you for choosing OSCRSJ.\n\n` +
    `With thanks,\nThe OSCRSJ Editorial Office` +
    plainTextFooter()

  return { html, text }
}

export function getEditorialDecisionAcceptSubject(
  submissionId: string
): string {
  return `[OSCRSJ] Decision on your submission ${submissionId}: Accepted`
}
