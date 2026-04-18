// ============================================================
// Review submitted editor notification
// ============================================================
// Fires to the editorial inbox when a reviewer presses "Submit
// review" on /review/[token]/form. Carries the 6 Likert scores,
// the recommendation, and a link to the admin manuscript detail
// view so the editor can see the full review content (Phase 3
// editor dashboard will add a dedicated /reviews/[reviewId] page;
// for Session 10 the detail page is the interim landing).
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
  qualityScore: number | null
  noveltyScore: number | null
  rigorScore: number | null
  dataScore: number | null
  clarityScore: number | null
  scopeScore: number | null
  adminManuscriptUrl: string
}

function fmtScore(score: number | null, max: number): string {
  if (score === null || score === undefined) return '—'
  return `${score} / ${max}`
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
    qualityScore,
    noveltyScore,
    rigorScore,
    dataScore,
    clarityScore,
    scopeScore,
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
    paragraph(`<strong>Likert scores</strong>`),
    detailsList([
      ['Manuscript Quality', fmtScore(qualityScore, 5)],
      ['Novelty & Significance', fmtScore(noveltyScore, 5)],
      ['Scientific Rigor', fmtScore(rigorScore, 5)],
      ['Data Quality', fmtScore(dataScore, 5)],
      ['Clarity & Presentation', fmtScore(clarityScore, 5)],
      ['Journal Scope Fit', fmtScore(scopeScore, 4)],
    ]),
    paragraph(
      `Comments to author, comments to editor, and conflict-of-interest disclosure are visible on the admin manuscript page.`
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
    `Likert scores:\n` +
    `  Manuscript Quality: ${fmtScore(qualityScore, 5)}\n` +
    `  Novelty & Significance: ${fmtScore(noveltyScore, 5)}\n` +
    `  Scientific Rigor: ${fmtScore(rigorScore, 5)}\n` +
    `  Data Quality: ${fmtScore(dataScore, 5)}\n` +
    `  Clarity & Presentation: ${fmtScore(clarityScore, 5)}\n` +
    `  Journal Scope Fit: ${fmtScore(scopeScore, 4)}\n\n` +
    `Comments to author, comments to editor, and conflict-of-interest disclosure are visible on the admin manuscript page:\n${adminManuscriptUrl}` +
    plainTextFooter()

  return { html, text }
}

export function getReviewSubmittedEditorNotificationSubject(
  submissionId: string
): string {
  return `Review submitted: ${submissionId} — OSCRSJ`
}
