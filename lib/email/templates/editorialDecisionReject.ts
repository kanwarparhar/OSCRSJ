// ============================================================
// Editorial decision — Reject (post-review or desk reject)
// ============================================================
// Session 13 split (migration 011) restored the COPE-aligned
// distinction:
//   - post_review_reject → manuscripts.status = 'rejected'
//   - desk_reject        → manuscripts.status = 'desk_rejected'
// Both share this template; the `isDeskReject` flag tweaks the
// lead paragraph + heading framing. Letter framing is respectful
// and evidence-grounded. No CTA to resubmit — rejections are
// terminal.
// ============================================================

import {
  renderEmailShell,
  paragraph,
  detailsList,
  plainTextFooter,
  escapeHtml,
  type RenderedEmail,
} from './shared'

export interface EditorialDecisionRejectParams {
  authorName: string
  submissionId: string
  title: string
  decisionLetter: string
  isDeskReject: boolean
}

function renderLetterHtml(letter: string): string {
  const safe = escapeHtml(letter)
  return `
    <div style="margin: 0 0 24px 0; padding: 16px; background-color: #FFF5EB; border: 1px solid rgba(153,126,103,0.18); border-radius: 4px;">
      <pre style="margin: 0; font-family: 'Courier New', Courier, monospace; font-size: 14px; line-height: 22px; color: #3d2a18; white-space: pre-wrap; word-break: break-word;">${safe}</pre>
    </div>
  `
}

export function renderEditorialDecisionReject(
  params: EditorialDecisionRejectParams
): RenderedEmail {
  const { authorName, submissionId, title, decisionLetter, isDeskReject } =
    params

  const decisionLabel = isDeskReject
    ? 'Rejected (without external review)'
    : 'Rejected'

  const leadParagraph = isDeskReject
    ? `Thank you for submitting your manuscript to the Orthopedic Surgery Case Reports &amp; Series Journal. After editorial review, we have decided that the manuscript is <strong>not a fit for OSCRSJ</strong> and will not proceed to external peer review. The editor's reasoning is provided below.`
    : `Thank you for submitting your manuscript to the Orthopedic Surgery Case Reports &amp; Series Journal. After careful consideration of the peer reviews and editorial assessment, we regret that we are <strong>unable to accept the manuscript for publication</strong>. The editor's reasoning is provided below.`

  const bodyHtml = [
    paragraph(`Dear ${escapeHtml(authorName)},`),
    paragraph(leadParagraph),
    detailsList([
      ['Submission ID', submissionId],
      ['Title', title],
      ['Decision', decisionLabel],
    ]),
    paragraph(`<strong>Editor's letter</strong>`),
    renderLetterHtml(decisionLetter),
    paragraph(
      `We recognise the effort that went into this manuscript and hope the feedback is useful as you refine the work for a different venue. Decisions are not taken lightly, and we thank you for considering OSCRSJ.`
    ),
    paragraph(`With thanks,<br />The OSCRSJ Editorial Office`),
  ].join('\n')

  const html = renderEmailShell({
    previewText: `Decision on OSCRSJ submission ${submissionId}.`,
    heading: isDeskReject
      ? 'Decision: Not Accepted (Editorial Review)'
      : 'Decision: Not Accepted',
    bodyHtml,
  })

  const text =
    `Dear ${authorName},\n\n` +
    (isDeskReject
      ? `Thank you for submitting your manuscript to OSCRSJ. After editorial review, we have decided that the manuscript is not a fit for OSCRSJ and will not proceed to external peer review.\n\n`
      : `Thank you for submitting your manuscript to OSCRSJ. After careful consideration of the peer reviews and editorial assessment, we regret that we are unable to accept the manuscript for publication.\n\n`) +
    `Submission ID: ${submissionId}\n` +
    `Title: ${title}\n` +
    `Decision: ${decisionLabel}\n\n` +
    `Editor's letter:\n\n${decisionLetter}\n\n` +
    `We recognise the effort that went into this manuscript and hope the feedback is useful as you refine the work for a different venue.\n\n` +
    `With thanks,\nThe OSCRSJ Editorial Office` +
    plainTextFooter()

  return { html, text }
}

export function getEditorialDecisionRejectSubject(
  submissionId: string,
  isDeskReject: boolean
): string {
  return `[OSCRSJ] Decision on your submission ${submissionId}: ${
    isDeskReject ? 'Not Accepted' : 'Rejected'
  }`
}
