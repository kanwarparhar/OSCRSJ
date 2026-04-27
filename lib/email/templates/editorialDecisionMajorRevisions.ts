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
  // v2 inset block: faint warm gray surface + brown-dark left accent.
  const safe = escapeHtml(letter)
  return `
    <div style="margin: 0 0 24px 0; padding: 18px 22px; background-color: #F7F6F4; border-left: 3px solid #3d2a18;">
      <pre style="margin: 0; font-family: 'Courier New', Courier, monospace; font-size: 14px; line-height: 22px; color: #1c0f05; white-space: pre-wrap; word-break: break-word;">${safe}</pre>
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
    paragraph(`<strong>How to submit your revision</strong>`),
    paragraph(
      `Your revision package must include <strong>two new documents</strong> in addition to your clean revised manuscript and clean revised blinded manuscript:`
    ),
    `<ol style="margin: 0 0 16px 0; padding-left: 22px; color: #1c0f05; font-size: 15px; line-height: 24px;">
      <li style="margin-bottom: 10px;"><strong>Response to Reviewers (.docx).</strong> A point-by-point response. For every reviewer comment, quote the comment verbatim, write your response, describe the specific change you made to the manuscript, and cite the line numbers in the revised manuscript where the change appears. <a href="https://www.oscrsj.com/downloads/oscrsj-revision-response-template.docx" style="color: #3d2a18; text-decoration: underline;">Download the OSCRSJ Revision Response Template</a> — it includes a worked example and pre-formatted response tables.</li>
      <li style="margin-bottom: 10px;"><strong>Tracked-Changes Manuscript (.docx or .pdf).</strong> A copy of the revised manuscript with every change visually marked: new or changed text in <strong style="color: #C0392B;">RED font</strong> and <strong style="background-color: #FFF59D;">HIGHLIGHTED YELLOW</strong>. The editor should be able to see at a glance which lines were modified.</li>
    </ol>`,
    paragraph(
      `Both documents are required upload slots in Step 2 of the revision wizard. The revised manuscript will likely be returned to the original reviewers for a second round of review, so a thorough, well-documented response strengthens your chances of acceptance.`
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
    `HOW TO SUBMIT YOUR REVISION\n\n` +
    `Your revision package must include TWO new documents in addition to your clean revised manuscript and clean revised blinded manuscript:\n\n` +
    `1. RESPONSE TO REVIEWERS (.docx)\n` +
    `   A point-by-point response. For every reviewer comment, quote the comment verbatim, write your response, describe the specific change you made to the manuscript, and cite the line numbers in the revised manuscript where the change appears.\n` +
    `   Download the OSCRSJ Revision Response Template (with a worked example and pre-formatted response tables):\n` +
    `   https://www.oscrsj.com/downloads/oscrsj-revision-response-template.docx\n\n` +
    `2. TRACKED-CHANGES MANUSCRIPT (.docx or .pdf)\n` +
    `   A copy of the revised manuscript with every change visually marked: new or changed text in RED FONT and HIGHLIGHTED YELLOW. The editor should be able to see at a glance which lines were modified.\n\n` +
    `Both documents are required upload slots in Step 2 of the revision wizard. The revised manuscript will likely be returned to the original reviewers for a second round of review, so a thorough, well-documented response strengthens your chances of acceptance.\n\n` +
    `Submit your revision here:\n${revisingUrl}\n\n` +
    `If you need an extension or wish to discuss scope, reply to this email.\n\n` +
    `With thanks,\nThe OSCRSJ Editorial Office` +
    plainTextFooter()

  return { html, text }
}

export function getEditorialDecisionMajorRevisionsSubject(
  submissionId: string
): string {
  return `[OSCRSJ] Decision on your submission ${submissionId}: Major Revisions`
}
