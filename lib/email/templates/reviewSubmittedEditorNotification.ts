// ============================================================
// Review submitted editor notification
// ============================================================
// Fires to the editorial inbox when a reviewer presses "Submit
// review" on /review/[token]/form. Carries the recommendation
// and a link to the admin manuscript detail view so the editor
// can see the full review content.
//
// Session 35 (2026-04-26): the 6 Likert score rows (Quality /
// Novelty / Rigor / Data / Clarity / Scope fit) were removed
// per Kanwar's directive — scores are no longer collected on
// the reviewer form. The recommendation + freeform feedback
// (visible on the admin review detail page) now carry the
// entire review.
// ============================================================

import {
  renderEmailShell,
  paragraph,
  detailsList,
  cta,
  plainTextFooter,
  escapeHtml,
  type RenderedEmail,
} from './shared'
import type { ReviewRecommendation } from '@/lib/types/database'

const RECOMMENDATION_LABELS: Record<ReviewRecommendation, string> = {
  accept: 'Accept',
  minor_revisions: 'Minor Revisions',
  major_revisions: 'Major Revisions',
  reject: 'Reject',
}

export interface ReviewSubmittedEditorNotificationParams {
  submissionId: string
  manuscriptId: string
  manuscriptTitle: string
  reviewerName: string
  reviewerEmail: string
  recommendation: ReviewRecommendation
  adminManuscriptUrl: string
}

export function renderReviewSubmittedEditorNotification(
  params: ReviewSubmittedEditorNotificationParams
): RenderedEmail {
  const {
    submissionId,
    manuscriptTitle,
    reviewerName,
    reviewerEmail,
    recommendation,
    adminManuscriptUrl,
  } = params

  const recommendationLabel = RECOMMENDATION_LABELS[recommendation]

  const bodyHtml = [
    paragraph(
      `<strong>${escapeHtml(reviewerName)}</strong> has submitted a review for <strong>${escapeHtml(submissionId)}</strong>.`
    ),
    detailsList([
      ['Manuscript', manuscriptTitle],
      ['Submission ID', submissionId],
      ['Reviewer', reviewerName],
      ['Reviewer email', reviewerEmail],
      ['Recommendation', recommendationLabel],
    ]),
    paragraph(
      `The reviewer's feedback and conflict-of-interest disclosure are visible on the admin manuscript page.`
    ),
    cta(adminManuscriptUrl, 'View manuscript in admin'),
  ].join('\n')

  const html = renderEmailShell({
    previewText: `${reviewerName} submitted a review: ${recommendationLabel}`,
    heading: 'Review submitted',
    bodyHtml,
  })

  const text =
    `Review submitted\n\n` +
    `Manuscript: ${manuscriptTitle}\n` +
    `Submission ID: ${submissionId}\n` +
    `Reviewer: ${reviewerName} <${reviewerEmail}>\n` +
    `Recommendation: ${recommendationLabel}\n\n` +
    `The reviewer's feedback and conflict-of-interest disclosure are visible on the admin manuscript page:\n${adminManuscriptUrl}` +
    plainTextFooter()

  return { html, text }
}

export function getReviewSubmittedEditorNotificationSubject(
  submissionId: string
): string {
  return `Review submitted: ${submissionId} — OSCRSJ`
}
