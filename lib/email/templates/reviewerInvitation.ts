// ============================================================
// Reviewer invitation
// ============================================================
// Sent when an editor invites an active reviewer applicant to
// review a specific manuscript. The invitee clicks one of the two
// CTAs (Accept / Decline) which land on `/review/[token]?action=...`
// -- we intentionally do NOT auto-accept on the first page load; the
// page requires a second confirmation click so an email client's
// link preview-fetch cannot silently accept on the invitee's behalf.
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

export interface ReviewerInvitationParams {
  firstName: string
  manuscriptTitle: string
  manuscriptType: string
  subspecialty: string
  abstractTeaser: string
  deadlineLabel: string
  editorNote: string | null
  acceptUrl: string
  declineUrl: string
}

export function renderReviewerInvitation(
  params: ReviewerInvitationParams
): RenderedEmail {
  const {
    firstName,
    manuscriptTitle,
    manuscriptType,
    subspecialty,
    abstractTeaser,
    deadlineLabel,
    editorNote,
    acceptUrl,
    declineUrl,
  } = params

  const bodyHtml = [
    paragraph(`Dear ${escapeHtml(firstName)},`),
    paragraph(
      `On behalf of the OSCRSJ editorial office, we would like to invite you to review a manuscript submitted to the Orthopedic Surgery Case Reports &amp; Series Journal. Your subspecialty background is a strong match for this submission.`
    ),
    detailsList([
      ['Manuscript', manuscriptTitle],
      ['Type', manuscriptType],
      ['Subspecialty', subspecialty],
      ['Response deadline', deadlineLabel],
    ]),
    paragraph(`<strong>Abstract teaser</strong>`),
    paragraph(escapeHtml(abstractTeaser)),
    editorNote
      ? paragraph(
          `<strong>Note from the editor:</strong> ${escapeHtml(editorNote)}`
        )
      : '',
    paragraph(
      `Please confirm whether you are able to review. You do not need an OSCRSJ account to accept or decline &mdash; the two links below are personal to you.`
    ),
    cta(acceptUrl, 'Accept invitation'),
    paragraph(
      `If you are unable to review, please decline so we can invite another reviewer promptly:`
    ),
    cta(declineUrl, 'Decline invitation'),
    paragraph(
      `Full manuscript access, reviewer guidelines, and the structured review form will be shared once you accept. If you have any questions, simply reply to this email.`
    ),
    paragraph(`With thanks,<br />The OSCRSJ Editorial Office`),
  ]
    .filter(Boolean)
    .join('\n')

  const html = renderEmailShell({
    previewText: `You have been invited to review "${manuscriptTitle}" for OSCRSJ.`,
    heading: 'Invitation to review a manuscript',
    bodyHtml,
  })

  const text =
    `Dear ${firstName},\n\n` +
    `On behalf of the OSCRSJ editorial office, we would like to invite you to review a manuscript submitted to the Orthopedic Surgery Case Reports & Series Journal. Your subspecialty background is a strong match for this submission.\n\n` +
    `Manuscript: ${manuscriptTitle}\n` +
    `Type: ${manuscriptType}\n` +
    `Subspecialty: ${subspecialty}\n` +
    `Response deadline: ${deadlineLabel}\n\n` +
    `Abstract teaser:\n${abstractTeaser}\n\n` +
    (editorNote ? `Note from the editor: ${editorNote}\n\n` : '') +
    `Accept: ${acceptUrl}\n` +
    `Decline: ${declineUrl}\n\n` +
    `Full manuscript access, reviewer guidelines, and the structured review form will be shared once you accept. If you have any questions, simply reply to this email.\n\n` +
    `With thanks,\nThe OSCRSJ Editorial Office` +
    plainTextFooter()

  return { html, text }
}

export function getReviewerInvitationSubject(manuscriptTitle: string): string {
  const t = manuscriptTitle.trim() || 'a manuscript'
  return `Invitation to review: ${t} — OSCRSJ`
}
