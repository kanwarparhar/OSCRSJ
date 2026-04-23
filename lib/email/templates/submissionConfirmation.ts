// ============================================================
// Submission confirmation email
// ============================================================
// Sent to the corresponding author immediately after a manuscript is
// submitted. Confirms receipt, restates the submission ID and title,
// and links to the dashboard where the author can track status.
// ============================================================

import type { ManuscriptType } from '@/lib/types/database'
import {
  renderEmailShell,
  paragraph,
  cta,
  detailsList,
  plainTextFooter,
  escapeHtml,
  type RenderedEmail,
} from './shared'

const MANUSCRIPT_TYPE_LABELS: Record<ManuscriptType, string> = {
  case_report: 'Case Report',
  case_series: 'Case Series',
  surgical_technique: 'Surgical Technique',
  images_in_orthopedics: 'Images in Orthopedics',
  letter_to_editor: 'Letter to the Editor',
  review_article: 'Review Article',
}

export interface SubmissionConfirmationParams {
  authorName: string
  submissionId: string
  title: string
  manuscriptType: ManuscriptType
  dashboardUrl: string
}

export function renderSubmissionConfirmation(
  params: SubmissionConfirmationParams
): RenderedEmail {
  const { authorName, submissionId, title, manuscriptType, dashboardUrl } =
    params
  const typeLabel = MANUSCRIPT_TYPE_LABELS[manuscriptType] || 'Manuscript'
  const subject = `Submission received — ${submissionId}`

  const bodyHtml = [
    paragraph(`Dear ${escapeHtml(authorName)},`),
    paragraph(
      `Thank you for submitting your manuscript to OSCRSJ. We have received your submission and it is now in our editorial queue.`
    ),
    detailsList([
      ['Submission ID', submissionId],
      ['Title', title],
      ['Type', typeLabel],
    ]),
    paragraph(
      `You can track the status of your manuscript in the author dashboard. We will write again as soon as the editors have assigned reviewers.`
    ),
    cta(dashboardUrl, 'View in Dashboard'),
    paragraph(
      `If you listed co-authors on the submission, they will each receive a notification allowing them to confirm or object to being listed.`
    ),
    paragraph(
      `If anything looks incorrect, reply to this message and a member of the editorial office will respond.`
    ),
    paragraph(`With appreciation,<br />The OSCRSJ Editorial Office`),
  ].join('\n')

  const html = renderEmailShell({
    previewText: `Your manuscript has been received. Submission ID: ${submissionId}.`,
    heading: 'We have received your submission',
    bodyHtml,
    footerNote: `Submission ID: ${submissionId}`,
  })

  const text =
    `Dear ${authorName},\n\n` +
    `Thank you for submitting your manuscript to OSCRSJ. We have received your submission and it is now in our editorial queue.\n\n` +
    `Submission ID: ${submissionId}\n` +
    `Title: ${title}\n` +
    `Type: ${typeLabel}\n\n` +
    `You can track the status of your manuscript at ${dashboardUrl}\n\n` +
    `If you listed co-authors on the submission, they will each receive a notification allowing them to confirm or object to being listed.\n\n` +
    `If anything looks incorrect, reply to this message and a member of the editorial office will respond.\n\n` +
    `With appreciation,\nThe OSCRSJ Editorial Office` +
    plainTextFooter()

  return { html, text }
}

export function getSubmissionConfirmationSubject(submissionId: string): string {
  return `Submission received — ${submissionId}`
}
