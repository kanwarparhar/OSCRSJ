// ============================================================
// Reviewer manuscript-package delivery email
// ============================================================
// Sent automatically by acceptReviewInvitation after a reviewer
// accepts an invitation. Delivers a single combined Word
// document built from the blinded manuscript + tables + figures.
//
// Two delivery modes (decided in the build pipeline based on
// the .docx size — Resend's per-message cap is 40 MB, base64
// encoding inflates by ~33%, so anything over ~22 MB falls to
// link mode):
//
//   - attached: the .docx rides along as an attachment. Reviewer
//     opens it directly from their inbox.
//   - link:     the email carries a 14-day signed Storage URL.
//     Reviewer clicks through to download.
//
// The shell is the same dark-brown editorial header used across
// the family. Subject is "[OSCRSJ] Manuscript package for review
// — {submission_id}" so it threads cleanly with the prior
// invitation + acceptance receipt for the reviewer.
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

export interface ReviewerManuscriptPackageParams {
  firstName: string
  manuscriptTitle: string
  submissionId: string
  manuscriptType: string
  subspecialty: string
  // 'attached' = the package rides as an email attachment.
  // 'link'     = a 14-day signed download URL is in the body.
  deliveryMode: 'attached' | 'link'
  downloadUrl: string | null // required when deliveryMode === 'link'
  reviewFormUrl: string
  deadlineLabel: string // e.g. "May 17, 2026"
  packageSizeLabel: string // e.g. "8.4 MB"
  figureCount: number
  hasTables: boolean
}

export function renderReviewerManuscriptPackage(
  params: ReviewerManuscriptPackageParams
): RenderedEmail {
  const {
    firstName,
    manuscriptTitle,
    submissionId,
    manuscriptType,
    subspecialty,
    deliveryMode,
    downloadUrl,
    reviewFormUrl,
    deadlineLabel,
    packageSizeLabel,
    figureCount,
    hasTables,
  } = params

  const componentParts: string[] = ['the blinded manuscript']
  if (hasTables) componentParts.push('the tables document')
  if (figureCount > 0) {
    componentParts.push(
      figureCount === 1
        ? '1 figure (one per page at the end)'
        : `${figureCount} figures (one per page at the end)`
    )
  }
  const componentSentence =
    componentParts.length === 1
      ? componentParts[0]
      : componentParts.length === 2
        ? `${componentParts[0]} and ${componentParts[1]}`
        : `${componentParts.slice(0, -1).join(', ')}, and ${componentParts[componentParts.length - 1]}`

  const detailsBlock = detailsList([
    ['Submission', submissionId],
    ['Type', manuscriptType],
    ['Subspecialty', subspecialty],
    ['Package size', packageSizeLabel],
    ['Review deadline', deadlineLabel],
  ])

  const intro = paragraph(
    `Thank you again for agreeing to review for OSCRSJ. The combined manuscript package for &ldquo;${escapeHtml(manuscriptTitle)}&rdquo; is ready for you. It contains ${componentSentence}, all merged into a single Word document so you can read it end-to-end without juggling separate files.`
  )

  const deliveryCopy =
    deliveryMode === 'attached'
      ? paragraph(
          `The package is attached to this email as a single .docx file. Save it locally and read at your convenience.`
        )
      : paragraph(
          `The package is too large to attach directly, so we&rsquo;ve placed it on our secure file server. Use the button below to download it &mdash; the link is valid for 14 days.`
        )

  const downloadCta =
    deliveryMode === 'link' && downloadUrl ? cta(downloadUrl, 'Download package') : ''

  const submitCta = cta(reviewFormUrl, 'Open the review form')

  const reminders = paragraph(
    `When you&rsquo;re ready, the structured review form is linked above. Reviews are due by <strong>${escapeHtml(deadlineLabel)}</strong>. If anything is missing from the package or you need an extension, simply reply to this email &mdash; the editorial office reads every reply.`
  )

  const closing = paragraph(
    `With appreciation,<br />The OSCRSJ Editorial Office`
  )

  const bodyHtml = [
    paragraph(`Dear ${escapeHtml(firstName)},`),
    intro,
    detailsBlock,
    deliveryCopy,
    downloadCta,
    paragraph(
      `Author identities, affiliations, and acknowledgments have been removed per OSCRSJ&rsquo;s double-blind review policy. If you recognize the work or its authors, please decline this assignment by replying to this email.`
    ),
    submitCta,
    reminders,
    closing,
  ]
    .filter(Boolean)
    .join('\n')

  const html = renderEmailShell({
    previewText: `Combined manuscript package for ${submissionId} (${packageSizeLabel}) — review due ${deadlineLabel}.`,
    heading: 'Your manuscript package is ready',
    bodyHtml,
  })

  // ---- Plain-text fallback ----
  const linkLine =
    deliveryMode === 'attached'
      ? `The package is attached to this email as a single .docx file.`
      : `The package is on our secure file server (link valid 14 days):\n${downloadUrl || ''}`

  const text =
    `Dear ${firstName},\n\n` +
    `Thank you again for agreeing to review for OSCRSJ. The combined manuscript package for "${manuscriptTitle}" is ready for you. It contains ${componentSentence}, all merged into a single Word document.\n\n` +
    `Submission: ${submissionId}\n` +
    `Type: ${manuscriptType}\n` +
    `Subspecialty: ${subspecialty}\n` +
    `Package size: ${packageSizeLabel}\n` +
    `Review deadline: ${deadlineLabel}\n\n` +
    `${linkLine}\n\n` +
    `Author identities, affiliations, and acknowledgments have been removed per OSCRSJ's double-blind review policy. If you recognize the work or its authors, please decline this assignment by replying to this email.\n\n` +
    `When you're ready, open the structured review form:\n${reviewFormUrl}\n\n` +
    `Reviews are due by ${deadlineLabel}. If anything is missing from the package or you need an extension, simply reply to this email — the editorial office reads every reply.\n\n` +
    `With appreciation,\nThe OSCRSJ Editorial Office` +
    plainTextFooter()

  return { html, text }
}

export function getReviewerManuscriptPackageSubject(
  submissionId: string
): string {
  return `Manuscript package for review — ${submissionId} — OSCRSJ`
}
