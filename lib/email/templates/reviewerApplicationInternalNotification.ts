// ============================================================
// Reviewer application — internal editorial notification
// ============================================================
// Sent to the editorial office (`INTERNAL_EDITORIAL_EMAIL` — currently
// `kanwarparhar@gmail.com` until Google Workspace `editorial@oscrsj.com`
// is provisioned) whenever a new reviewer application is submitted.
// Contains the full applicant record inline so triage can happen from
// the inbox without opening the Supabase dashboard.
// ============================================================

import {
  renderEmailShell,
  paragraph,
  detailsList,
  plainTextFooter,
  type RenderedEmail,
} from './shared'

const CAREER_STAGE_LABELS: Record<string, string> = {
  med_student: 'Medical Student',
  resident: 'Resident',
  fellow: 'Fellow',
  attending: 'Attending',
  other: 'Other',
}

export interface ReviewerApplicationInternalParams {
  firstName: string
  lastName: string
  email: string
  orcidId: string | null
  affiliation: string
  country: string
  careerStage: string
  subspecialtyInterests: string[]
  writingSampleUrl: string | null
  heardAbout: string | null
  applicationId: string
}

export function renderReviewerApplicationInternalNotification(
  params: ReviewerApplicationInternalParams
): RenderedEmail {
  const {
    firstName,
    lastName,
    email,
    orcidId,
    affiliation,
    country,
    careerStage,
    subspecialtyInterests,
    writingSampleUrl,
    heardAbout,
    applicationId,
  } = params

  const careerLabel = CAREER_STAGE_LABELS[careerStage] || careerStage
  const subspecialties =
    subspecialtyInterests.length > 0 ? subspecialtyInterests.join(', ') : '—'

  const details: Array<[string, string]> = [
    ['Name', `${firstName} ${lastName}`],
    ['Email', email],
    ['Affiliation', affiliation],
    ['Country', country],
    ['Career stage', careerLabel],
    ['Subspecialties', subspecialties],
  ]
  if (orcidId) details.push(['ORCID', orcidId])
  if (writingSampleUrl) details.push(['Writing sample', writingSampleUrl])
  if (heardAbout) details.push(['Heard about us via', heardAbout])
  details.push(['Application ID', applicationId])

  const bodyHtml = [
    paragraph(
      `A new reviewer application has just been submitted through <code>/for-reviewers/apply</code>.`
    ),
    detailsList(details),
    paragraph(
      `Full applicant record is stored in <code>reviewer_applications</code> (status: <strong>pending</strong>). Triage target: respond within 14 days.`
    ),
    paragraph(
      `Next step: verify the applicant's ORCID/affiliation and either approve, decline, or request more information by replying directly to this message.`
    ),
  ].join('\n')

  const html = renderEmailShell({
    previewText: `New reviewer application: ${firstName} ${lastName} (${careerLabel}).`,
    heading: 'New reviewer application received',
    bodyHtml,
    footerNote: `Application ID: ${applicationId}`,
  })

  const textLines = [
    `A new reviewer application has just been submitted through /for-reviewers/apply.`,
    '',
    `Name: ${firstName} ${lastName}`,
    `Email: ${email}`,
    `Affiliation: ${affiliation}`,
    `Country: ${country}`,
    `Career stage: ${careerLabel}`,
    `Subspecialties: ${subspecialties}`,
  ]
  if (orcidId) textLines.push(`ORCID: ${orcidId}`)
  if (writingSampleUrl) textLines.push(`Writing sample: ${writingSampleUrl}`)
  if (heardAbout) textLines.push(`Heard about us via: ${heardAbout}`)
  textLines.push(`Application ID: ${applicationId}`)
  textLines.push('')
  textLines.push(
    `Full applicant record is stored in reviewer_applications (status: pending). Triage target: respond within 14 days.`
  )

  const text = textLines.join('\n') + plainTextFooter()

  return { html, text }
}

export function getReviewerApplicationInternalSubject(
  firstName: string,
  lastName: string
): string {
  return `New reviewer application — ${firstName} ${lastName}`
}

