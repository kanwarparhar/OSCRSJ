// ============================================================
// Cohort application — internal editorial notification
// ============================================================
// Sent to the editorial office (INTERNAL_EDITORIAL_EMAIL — currently
// oscrsjournal@gmail.com until Google Workspace editorial@oscrsj.com is
// provisioned) whenever a new OSCRSJ Research Scholars application is
// submitted. Contains the full applicant record inline so triage can
// happen from the inbox without opening the Supabase dashboard.
// ============================================================

import {
  renderEmailShell,
  paragraph,
  detailsList,
  cta,
  plainTextFooter,
  type RenderedEmail,
} from './shared'

export interface CohortApplicationInternalParams {
  firstName: string
  lastName: string
  email: string
  countryOfResidence: string
  school: string
  yearInSchool: string
  preferredTrackLabel: string
  preferredTierLabel: string
  personalStatement: string
  researchExperience: string
  cvFilename: string | null
  participantAgreementAck: boolean
  applicationId: string
  adminReviewUrl: string
}

function truncate(value: string, max = 280): string {
  if (value.length <= max) return value
  return `${value.slice(0, max).trimEnd()}…`
}

export function renderCohortApplicationInternalNotification(
  params: CohortApplicationInternalParams
): RenderedEmail {
  const {
    firstName,
    lastName,
    email,
    countryOfResidence,
    school,
    yearInSchool,
    preferredTrackLabel,
    preferredTierLabel,
    personalStatement,
    researchExperience,
    cvFilename,
    participantAgreementAck,
    applicationId,
    adminReviewUrl,
  } = params

  const details: Array<[string, string]> = [
    ['Name', `${firstName} ${lastName}`],
    ['Email', email],
    ['Country', countryOfResidence],
    ['School', school],
    ['Year', yearInSchool],
    ['Track', preferredTrackLabel],
    ['Tier', preferredTierLabel],
    ['CV', cvFilename || '— not uploaded —'],
    [
      'Participant agreement acknowledged',
      participantAgreementAck ? 'Yes' : 'No',
    ],
    ['Application ID', applicationId],
  ]

  const bodyHtml = [
    paragraph(
      `A new Research Scholars application has just been submitted through <code>/scholars/apply</code>.`
    ),
    detailsList(details),
    paragraph(`<strong>Why this program (excerpt):</strong>`),
    paragraph(`<em>${truncate(personalStatement)}</em>`),
    paragraph(`<strong>Research experience (excerpt):</strong>`),
    paragraph(`<em>${truncate(researchExperience)}</em>`),
    cta(adminReviewUrl, 'Review in admin'),
    paragraph(
      `Full applicant record is stored in <code>cohort_applications</code> (status: <strong>submitted</strong>). Reply to this message to reach the applicant directly.`
    ),
  ].join('\n')

  const html = renderEmailShell({
    previewText: `New Research Scholars application: ${firstName} ${lastName} (${preferredTrackLabel}).`,
    heading: 'New Research Scholars application',
    bodyHtml,
    footerNote: `Application ID: ${applicationId}`,
  })

  const textLines = [
    `A new Research Scholars application has just been submitted through /scholars/apply.`,
    '',
    `Name: ${firstName} ${lastName}`,
    `Email: ${email}`,
    `Country: ${countryOfResidence}`,
    `School: ${school}`,
    `Year: ${yearInSchool}`,
    `Track: ${preferredTrackLabel}`,
    `Tier: ${preferredTierLabel}`,
    `CV: ${cvFilename || '— not uploaded —'}`,
    `Participant agreement acknowledged: ${participantAgreementAck ? 'Yes' : 'No'}`,
    `Application ID: ${applicationId}`,
  ]
  textLines.push('')
  textLines.push(`Why this program (excerpt):`)
  textLines.push(truncate(personalStatement))
  textLines.push('')
  textLines.push(`Research experience (excerpt):`)
  textLines.push(truncate(researchExperience))
  textLines.push('')
  textLines.push(`Review in admin: ${adminReviewUrl}`)
  textLines.push('')
  textLines.push(
    `Full applicant record is stored in cohort_applications (status: submitted). Reply to this message to reach the applicant directly.`
  )

  const text = textLines.join('\n') + plainTextFooter()

  return { html, text }
}

export function getCohortApplicationInternalSubject(
  firstName: string,
  lastName: string,
  trackLabel: string
): string {
  return `New Research Scholars application — ${firstName} ${lastName} (${trackLabel})`
}
