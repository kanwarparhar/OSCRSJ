// ============================================================
// Revision received — editorial office notification
// ============================================================
// Sent to the editorial inbox when an author submits a revision.
// Deep-links to the admin manuscript detail view.
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

export interface RevisionReceivedEditorParams {
  correspondingAuthorName: string
  correspondingAuthorEmail: string
  submissionId: string
  title: string
  revisionNumber: number
  adminUrl: string
  noteToEditor: string | null
}

export function renderRevisionReceivedEditor(
  params: RevisionReceivedEditorParams
): RenderedEmail {
  const {
    correspondingAuthorName,
    correspondingAuthorEmail,
    submissionId,
    title,
    revisionNumber,
    adminUrl,
    noteToEditor,
  } = params

  const bodyHtml = [
    paragraph(
      `A revised manuscript has been submitted and is awaiting editorial review.`
    ),
    detailsList([
      ['Submission ID', submissionId],
      ['Title', title],
      ['Revision', `v${revisionNumber}`],
      ['Corresponding author', correspondingAuthorName],
      ['Author email', correspondingAuthorEmail],
    ]),
    noteToEditor
      ? paragraph(
          `<strong>Note from the author:</strong> ${escapeHtml(noteToEditor)}`
        )
      : '',
    paragraph(
      `The response-to-reviewers letter, tracked-changes file, and revised manuscript are attached to the submission under the v${revisionNumber} folder.`
    ),
    cta(adminUrl, 'Open manuscript'),
  ]
    .filter(Boolean)
    .join('\n')

  const html = renderEmailShell({
    previewText: `Revision v${revisionNumber} received for ${submissionId}.`,
    heading: `Revision v${revisionNumber} received`,
    bodyHtml,
  })

  const text =
    `A revised manuscript has been submitted and is awaiting editorial review.\n\n` +
    `Submission ID: ${submissionId}\n` +
    `Title: ${title}\n` +
    `Revision: v${revisionNumber}\n` +
    `Corresponding author: ${correspondingAuthorName}\n` +
    `Author email: ${correspondingAuthorEmail}\n\n` +
    (noteToEditor ? `Note from the author: ${noteToEditor}\n\n` : '') +
    `Open manuscript: ${adminUrl}\n` +
    plainTextFooter()

  return { html, text }
}

export function getRevisionReceivedEditorSubject(
  submissionId: string,
  revisionNumber: number
): string {
  return `[OSCRSJ] Revision v${revisionNumber} received: ${submissionId}`
}
