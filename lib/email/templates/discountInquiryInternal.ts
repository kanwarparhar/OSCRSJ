// ============================================================
// Discount inquiry — internal editorial notification
// ============================================================
// Sent to the waivers inbox (`waivers@oscrsj.com`, currently routed to
// the editorial Reply-To inbox until the dedicated mailbox is provisioned)
// whenever a new APC discount inquiry is submitted via `/apc`.
// Contains the full inquirer record inline so triage can happen from
// the inbox without opening the database.
// ============================================================

import {
  renderEmailShell,
  paragraph,
  detailsList,
  plainTextFooter,
  escapeHtml,
  type RenderedEmail,
} from './shared'

export interface DiscountInquiryInternalParams {
  firstName: string
  lastName: string
  email: string
  country: string
  careerStage: string
  affiliation: string | null
  submissionId: string | null
  message: string
  inquiryId: string
}

export function renderDiscountInquiryInternal(
  params: DiscountInquiryInternalParams
): RenderedEmail {
  const {
    firstName,
    lastName,
    email,
    country,
    careerStage,
    affiliation,
    submissionId,
    message,
    inquiryId,
  } = params

  const details: Array<[string, string]> = [
    ['Name', `${firstName} ${lastName}`],
    ['Email', email],
    ['Country', country],
    ['Career stage', careerStage],
  ]
  if (affiliation) details.push(['Affiliation', affiliation])
  if (submissionId) details.push(['Submission ID', submissionId])
  details.push(['Inquiry ID', inquiryId])

  const messageBlock = `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin: 4px 0 24px 0; padding: 18px 22px; background-color: #F7F6F4; border-left: 3px solid #3d2a18; width: 100%;">
      <tr>
        <td style="font-family: -apple-system, BlinkMacSystemFont, 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 14px; line-height: 22px; color: #1c0f05; white-space: pre-wrap;">${escapeHtml(
          message
        )}</td>
      </tr>
    </table>
  `

  const bodyHtml = [
    paragraph(
      `A new APC discount inquiry has just been submitted through <code>/apc</code>.`
    ),
    detailsList(details),
    paragraph(`<strong>Inquirer&rsquo;s message:</strong>`),
    messageBlock,
    paragraph(
      `Reply directly to this message to respond &mdash; the Reply-To header is set to the inquirer&rsquo;s address.`
    ),
  ].join('\n')

  const html = renderEmailShell({
    previewText: `New discount inquiry: ${firstName} ${lastName} (${careerStage}, ${country}).`,
    heading: 'New discount inquiry received',
    bodyHtml,
    footerNote: `Inquiry ID: ${inquiryId}`,
  })

  const textLines = [
    `A new APC discount inquiry has just been submitted through /apc.`,
    '',
    `Name: ${firstName} ${lastName}`,
    `Email: ${email}`,
    `Country: ${country}`,
    `Career stage: ${careerStage}`,
  ]
  if (affiliation) textLines.push(`Affiliation: ${affiliation}`)
  if (submissionId) textLines.push(`Submission ID: ${submissionId}`)
  textLines.push(`Inquiry ID: ${inquiryId}`)
  textLines.push('')
  textLines.push(`Inquirer's message:`)
  textLines.push(message)
  textLines.push('')
  textLines.push(
    `Reply directly to this message to respond — the Reply-To header is set to the inquirer's address.`
  )

  const text = textLines.join('\n') + plainTextFooter()

  return { html, text }
}

export function getDiscountInquiryInternalSubject(
  firstName: string,
  lastName: string
): string {
  return `New discount inquiry — ${firstName} ${lastName}`
}
