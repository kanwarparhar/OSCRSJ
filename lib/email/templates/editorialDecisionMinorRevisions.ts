// ============================================================
// Editorial decision — Minor Revisions
// ============================================================
// Sent when an editor returns the manuscript for minor revisions.
// Manuscripts.status flips to 'revision_requested'. CTA deep-links
// to the revising variant of the submission wizard.
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

export interface EditorialDecisionMinorRevisionsParams {
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

export function renderEditorialDecisionMinorRevisions(
  params: EditorialDecisionMinorRevisionsParams
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
      `Thank you for your submission to the Orthopedic Surgery Case Reports &amp; Series Journal. After careful review, we are pleased to offer conditional acceptance pending <strong>minor revisions</strong>.`
    ),
    detailsList([
      ['Submission ID', submissionId],
      ['Title', title],
      ['Decision', 'Minor Revisions'],
      ['Revision deadline', deadlineLabel],
    ]),
    paragraph(`<strong>Editor's letter</strong>`),
    renderLetterHtml(decisionLetter),
    paragraph(
      `Please address each reviewer comment point-by-point in a response-to-reviewers letter, upload a revised manuscript plus a tracked-changes file, and submit your revision through the link below.`
    ),
    cta(revisingUrl, 'Submit revised manuscript'),
    paragraph(
      `If you need an extension, simply reply to this email. Questions about specific reviewer comments are welcome.`
    ),
    paragraph(`With thanks,<br />The OSCRSJ Editorial Office`),
  ].join('\n')

  const html = renderEmailShell({
    previewText: `OSCRSJ submission ${submissionId}: minor revisions requested.`,
    heading: 'Decision: Minor Revisions Requested',
    bodyHtml,
  })

  const text =
    `Dear ${authorName},\n\n` +
    `Thank you for your submission to OSCRSJ. After careful review, we are pleased to offer conditional acceptance pending MINOR REVISIONS.\n\n` +
    `Submission ID: ${submissionId}\n` +
    `Title: ${title}\n` +
    `Decision: Minor Revisions\n` +
    `Revision deadline: ${deadlineLabel}\n\n` +
    `Editor's letter:\n\n${decisionLetter}\n\n` +
    `Please address each reviewer comment point-by-point in a response-to-reviewers letter, upload a revised manuscript plus a tracked-changes file, and submit your revision:\n${revisingUrl}\n\n` +
    `If you need an extension, reply to this email.\n\n` +
    `With thanks,\nThe OSCRSJ Editorial Office` +
    plainTextFooter()

  return { html, text }
}

export function getEditorialDecisionMinorRevisionsSubject(
  submissionId: string
): string {
  return `[OSCRSJ] Decision on your submission ${submissionId}: Minor Revisions`
}
