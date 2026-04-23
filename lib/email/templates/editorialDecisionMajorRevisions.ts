// ============================================================
// Editorial decision — Major Revisions
// ============================================================
// Manuscripts.status flips to 'revision_requested'. Framing is
// stronger than Minor Revisions: the manuscript is not
// conditionally accepted; the editor is asking for substantive
// work before a decision can be made.
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

export interface EditorialDecisionMajorRevisionsParams {
  authorName: string
  submissionId: string
  title: string
  decisionLetter: string
  deadlineLabel: string
  revisingUrl: string
}

function renderLetterHtml(letter: string): string {
  const safe = escapeHtml(letter)
  return `
    <div style="margin: 0 0 24px 0; padding: 16px; background-color: #FFF5EB; border: 1px solid rgba(153,126,103,0.18); border-radius: 4px;">
      <pre style="margin: 0; font-family: 'Courier New', Courier, monospace; font-size: 14px; line-height: 22px; color: #3d2a18; white-space: pre-wrap; word-break: break-word;">${safe}</pre>
    </div>
  `
}

export function renderEditorialDecisionMajorRevisions(
  params: EditorialDecisionMajorRevisionsParams
): RenderedEmail {
  const {
    authorName,
    submissionId,
    title,
    decisionLetter,
    deadlineLabel,
    revisingUrl,
  } = params

  const bodyHtml = [
    paragraph(`Dear ${escapeHtml(authorName)},`),
    paragraph(
      `Thank you for your submission to the Orthopedic Surgery Case Reports &amp; Series Journal. The reviewers and editors have identified substantive issues that must be addressed before a publication decision can be reached. We are returning the manuscript for <strong>major revisions</strong>.`
    ),
    detailsList([
      ['Submission ID', submissionId],
      ['Title', title],
      ['Decision', 'Major Revisions'],
      ['Revision deadline', deadlineLabel],
    ]),
    paragraph(`<strong>Editor's letter</strong>`),
    renderLetterHtml(decisionLetter),
    paragraph(
      `Please address each reviewer comment point-by-point in a response-to-reviewers letter, upload a revised manuscript plus a tracked-changes file, and submit your revision through the link below. The revised manuscript will likely be returned to the original reviewers for a second round of review.`
    ),
    cta(revisingUrl, 'Submit revised manuscript'),
    paragraph(
      `We recognise that major revisions involve significant work. If you need an extension or wish to discuss scope with the handling editor, simply reply to this email.`
    ),
    paragraph(`With thanks,<br />The OSCRSJ Editorial Office`),
  ].join('\n')

  const html = renderEmailShell({
    previewText: `OSCRSJ submission ${submissionId}: major revisions requested.`,
    heading: 'Decision: Major Revisions Requested',
    bodyHtml,
  })

  const text =
    `Dear ${authorName},\n\n` +
    `Thank you for your submission to OSCRSJ. The reviewers and editors have identified substantive issues that must be addressed before a publication decision can be reached. We are returning the manuscript for MAJOR REVISIONS.\n\n` +
    `Submission ID: ${submissionId}\n` +
    `Title: ${title}\n` +
    `Decision: Major Revisions\n` +
    `Revision deadline: ${deadlineLabel}\n\n` +
    `Editor's letter:\n\n${decisionLetter}\n\n` +
    `Please address each reviewer comment point-by-point in a response-to-reviewers letter, upload a revised manuscript plus a tracked-changes file, and submit your revision:\n${revisingUrl}\n\n` +
    `The revised manuscript will likely be returned to the original reviewers for a second round of review.\n\n` +
    `With thanks,\nThe OSCRSJ Editorial Office` +
    plainTextFooter()

  return { html, text }
}

export function getEditorialDecisionMajorRevisionsSubject(
  submissionId: string
): string {
  return `[OSCRSJ] Decision on your submission ${submissionId}: Major Revisions`
}
