// ============================================================
// "All reviews received" editor notification
// ============================================================
// Fires the first time a manuscript accumulates ≥2 submitted
// (non-draft) reviews. Idempotency is enforced by
// `manuscript_metadata.all_reviews_notified_at` — subsequent review
// submits short-circuit in `triggerAllReviewsReceivedIfReady` when
// that column is non-null.
//
// Payload gives the editor a ready-made summary (count by
// recommendation type) plus a CTA into the manuscript admin page
// where they will make the final editorial decision.
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
import type { ReviewRecommendation } from '@/lib/types/database'

export interface AllReviewsReceivedEditorNotificationParams {
  submissionId: string
  manuscriptTitle: string
  reviewCount: number
  recommendationCounts: Partial<Record<ReviewRecommendation, number>>
  adminManuscriptUrl: string
}

const RECOMMENDATION_LABELS: Record<ReviewRecommendation, string> = {
  accept: 'Accept',
  minor_revisions: 'Minor Revisions',
  major_revisions: 'Major Revisions',
  reject: 'Reject',
}

function buildRecommendationSummary(
  counts: Partial<Record<ReviewRecommendation, number>>
): string {
  const order: ReviewRecommendation[] = [
    'accept',
    'minor_revisions',
    'major_revisions',
    'reject',
  ]
  const parts: string[] = []
  for (const rec of order) {
    const n = counts[rec] || 0
    if (n > 0) parts.push(`${n} ${RECOMMENDATION_LABELS[rec]}`)
  }
  return parts.length > 0 ? parts.join(', ') : 'No recommendations recorded'
}

export function renderAllReviewsReceivedEditorNotification(
  params: AllReviewsReceivedEditorNotificationParams
): RenderedEmail {
  const {
    submissionId,
    manuscriptTitle,
    reviewCount,
    recommendationCounts,
    adminManuscriptUrl,
  } = params

  const summary = buildRecommendationSummary(recommendationCounts)

  const bodyHtml = [
    paragraph(
      `Two or more reviewers have now submitted reviews for <strong>${escapeHtml(
        submissionId
      )}</strong>. The manuscript is ready for an editorial decision.`
    ),
    detailsList([
      ['Submission ID', submissionId],
      ['Manuscript', manuscriptTitle],
      ['Reviews in', `${reviewCount}`],
      ['Recommendations', summary],
    ]),
    cta(adminManuscriptUrl, 'Open manuscript in admin'),
    paragraph(
      `Full reviewer identities and all comments are available on the admin manuscript detail page. This notification is sent once per manuscript — further reviews that arrive later will not re-trigger it.`
    ),
    paragraph(`— The OSCRSJ Editorial System`),
  ].join('\n')

  const html = renderEmailShell({
    previewText: `All reviews received for ${submissionId}.`,
    heading: 'All reviews received — ready for decision',
    bodyHtml,
  })

  const text =
    `All reviews received for ${submissionId}.\n\n` +
    `Manuscript: ${manuscriptTitle}\n` +
    `Reviews in: ${reviewCount}\n` +
    `Recommendations: ${summary}\n\n` +
    `Open manuscript in admin: ${adminManuscriptUrl}\n\n` +
    `Full reviewer identities and all comments are available on the admin manuscript detail page. This notification is sent once per manuscript.\n\n` +
    `— The OSCRSJ Editorial System` +
    plainTextFooter()

  return { html, text }
}

export function getAllReviewsReceivedEditorNotificationSubject(
  submissionId: string
): string {
  return `All reviews received for ${submissionId} — OSCRSJ`
}
