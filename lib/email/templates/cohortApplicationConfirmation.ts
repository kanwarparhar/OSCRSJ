// ============================================================
// Cohort application confirmation
// ============================================================
// Sent to a prospective OSCRSJ Research Scholar immediately after
// they submit the `/scholars/apply` form. Confirms receipt and sets
// the response expectation.
// ============================================================

import {
  renderEmailShell,
  paragraph,
  cta,
  plainTextFooter,
  escapeHtml,
  type RenderedEmail,
} from './shared'

export interface CohortApplicationConfirmationParams {
  applicantName: string
  preferredTrackLabel: string
  preferredTierLabel: string
  scholarsUrl: string
}

export function renderCohortApplicationConfirmation(
  params: CohortApplicationConfirmationParams
): RenderedEmail {
  const { applicantName, preferredTrackLabel, preferredTierLabel, scholarsUrl } =
    params

  const bodyHtml = [
    paragraph(`Dear ${escapeHtml(applicantName)},`),
    paragraph(
      `Thank you for applying to the OSCRSJ Research Scholars program. We have received your application for the <strong>${escapeHtml(
        preferredTrackLabel
      )}</strong> track (${escapeHtml(preferredTierLabel)}).`
    ),
    paragraph(
      `Our team will review your application and reach out within 2-3 weeks with next steps. If we need additional information, we'll reply directly to this email thread.`
    ),
    paragraph(
      `Publication of any work produced in the program is conditional on independent peer review through OSCRSJ's standard editorial pipeline. The program provides structured training, mentorship, and project opportunities — not a guarantee of publication.`
    ),
    cta(scholarsUrl, 'Program Overview'),
    paragraph(
      `If anything about your application needs correcting, reply to this message and we will update your record.`
    ),
    paragraph(`With appreciation,<br />The OSCRSJ Research Scholars Team`),
  ].join('\n')

  const html = renderEmailShell({
    previewText:
      'Your application to the OSCRSJ Research Scholars program has been received.',
    heading: 'Your application was received',
    bodyHtml,
  })

  const text =
    `Dear ${applicantName},\n\n` +
    `Thank you for applying to the OSCRSJ Research Scholars program. We have received your application for the ${preferredTrackLabel} track (${preferredTierLabel}).\n\n` +
    `Our team will review your application and reach out within 2-3 weeks with next steps. If we need additional information, we'll reply directly to this email thread.\n\n` +
    `Publication of any work produced in the program is conditional on independent peer review through OSCRSJ's standard editorial pipeline. The program provides structured training, mentorship, and project opportunities — not a guarantee of publication.\n\n` +
    `Program overview: ${scholarsUrl}\n\n` +
    `If anything about your application needs correcting, reply to this message and we will update your record.\n\n` +
    `With appreciation,\nThe OSCRSJ Research Scholars Team` +
    plainTextFooter()

  return { html, text }
}

export function getCohortApplicationConfirmationSubject(): string {
  return 'Your OSCRSJ Research Scholars application was received'
}
