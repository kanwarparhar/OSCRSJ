// ============================================================
// New submission received — editorial office notification
// ============================================================
// Sent to the editorial inbox the moment an author completes the
// submission wizard. Deep-links to the admin manuscript detail view.
//
// Added 2026-08-10 (pre-announcement audit). Until then submitManuscript
// emailed only the corresponding author and co-authors: EDITORIAL_NOTIFY_EMAIL
// was wired for withdrawals and revisions but NOT for new submissions, so the
// only editorial signal was the 13:00 UTC daily digest and a manuscript
// arriving at 13:05 was invisible for ~24 hours.
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

export interface SubmissionReceivedEditorParams {
  correspondingAuthorName: string
  correspondingAuthorEmail: string
  submissionId: string
  title: string
  manuscriptType: string
  subspecialty: string | null
  authorCount: number
  adminUrl: string
  noteToEditor: string | null
}

export function renderSubmissionReceivedEditor(
  params: SubmissionReceivedEditorParams
): RenderedEmail {
  const {
    correspondingAuthorName,
    correspondingAuthorEmail,
    submissionId,
    title,
    manuscriptType,
    subspecialty,
    authorCount,
    adminUrl,
    noteToEditor,
  } = params

  const rows: [string, string][] = [
    ['Submission ID', submissionId],
    ['Title', title],
    ['Type', manuscriptType],
  ]
  if (subspecialty) rows.push(['Subspecialty', subspecialty])
  rows.push(
    ['Authors', String(authorCount)],
    ['Corresponding author', correspondingAuthorName],
    ['Author email', correspondingAuthorEmail]
  )

  const bodyHtml = [
    paragraph(
      `A new manuscript has been submitted and is awaiting editorial triage.`
    ),
    detailsList(rows),
    noteToEditor
      ? paragraph(
          `<strong>Note from the author:</strong> ${escapeHtml(noteToEditor)}`
        )
      : '',
    cta(adminUrl, 'Open manuscript'),
  ]
    .filter(Boolean)
    .join('\n')

  const html = renderEmailShell({
    previewText: `New submission ${submissionId} awaiting triage.`,
    heading: 'New submission received',
    bodyHtml,
  })

  const text =
    `A new manuscript has been submitted and is awaiting editorial triage.\n\n` +
    rows.map(([k, v]) => `${k}: ${v}`).join('\n') +
    `\n\n` +
    (noteToEditor ? `Note from the author: ${noteToEditor}\n\n` : '') +
    `Open manuscript: ${adminUrl}\n` +
    plainTextFooter()

  return { html, text }
}

export function getSubmissionReceivedEditorSubject(
  submissionId: string
): string {
  return `[OSCRSJ] New submission received: ${submissionId}`
}
