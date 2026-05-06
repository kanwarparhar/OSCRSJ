// ============================================================
// Daily editorial-ops digest — internal notification
// ============================================================
// One email per day, fired by /api/cron/daily-digest, summarising
// the last 24h of activity across the submission portal:
//   - New user registrations
//   - New manuscript submissions (status flip draft → submitted)
//   - Revisions received (manuscript_revisions inserts)
//   - Reviewer applications (reviewer_applications inserts)
//   - Reviews submitted (reviews.is_draft = false flips)
//
// Why a digest instead of per-event emails: as volume picks up,
// per-event emails compound annoyingly and overflow the editorial
// inbox. The digest gives Kanwar a single predictable email per day
// (Gmail filter to label "OSCRSJ ops" — never overflows). Empty days
// skip the send entirely so no zero-noise emails ever land.
//
// The admin dashboard at /dashboard/admin/manuscripts stays the real
// source of truth — this email is just a nudge to check it.
// ============================================================

import {
  renderEmailShell,
  paragraph,
  plainTextFooter,
  escapeHtml,
  type RenderedEmail,
} from './shared'

const SITE_URL = 'https://www.oscrsj.com'

// Color tokens — kept in sync with shared.ts. Duplicated locally
// because shared.ts doesn't re-export them and pulling them in via
// import would be circular-ish (they're internal to that module).
const COLOR = {
  brownDark: '#3d2a18',
  brown: '#664930',
  ink: '#1c0f05',
  detailsBg: '#F7F6F4',
  cardBorder: 'rgba(153,126,103,0.18)',
} as const

const FONT_BODY = `-apple-system, BlinkMacSystemFont, 'Helvetica Neue', Helvetica, Arial, sans-serif`

// ---- Public types ----

export interface DigestRegistration {
  fullName: string
  email: string
  affiliation: string | null
  country: string | null
  role: string
  orcidId: string | null
  createdAt: string
}

export interface DigestSubmission {
  submissionId: string
  title: string | null
  manuscriptType: string | null
  correspondingAuthor: string | null
  submissionDate: string | null
  manuscriptId: string
}

export interface DigestRevision {
  submissionId: string
  title: string | null
  revisionNumber: number
  submittedDate: string
  manuscriptId: string
}

export interface DigestReviewerApplication {
  fullName: string
  email: string
  affiliation: string
  country: string
  careerStage: string
  applicationId: string
  createdAt: string
}

export interface DigestReviewSubmitted {
  submissionId: string
  manuscriptTitle: string | null
  reviewerName: string | null
  recommendation: string | null
  submittedDate: string
  reviewId: string
  manuscriptId: string
}

export interface DailyDigestParams {
  windowStartIso: string // ISO timestamp 24h ago (inclusive)
  windowEndIso: string // ISO timestamp now (exclusive)
  registrations: DigestRegistration[]
  submissions: DigestSubmission[]
  revisions: DigestRevision[]
  reviewerApplications: DigestReviewerApplication[]
  reviewsSubmitted: DigestReviewSubmitted[]
}

// ---- Rendering helpers ----

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZone: 'America/New_York',
      timeZoneName: 'short',
    })
  } catch {
    return iso
  }
}

function formatDateRange(startIso: string, endIso: string): string {
  try {
    const start = new Date(startIso)
    const end = new Date(endIso)
    return `${start.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York', timeZoneName: 'short' })} — ${end.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York', timeZoneName: 'short' })}`
  } catch {
    return `${startIso} — ${endIso}`
  }
}

function sectionHeading(label: string, count: number): string {
  return `
    <h2 style="margin: 28px 0 10px 0; font-family: ${FONT_BODY}; font-size: 13px; line-height: 18px; color: ${COLOR.brown}; text-transform: uppercase; letter-spacing: 0.14em; font-weight: 700;">
      ${escapeHtml(label)} <span style="color: ${COLOR.brownDark};">(${count})</span>
    </h2>
  `
}

function itemCard(rows: Array<[string, string]>, deepLink?: { label: string; href: string }): string {
  const rowsHtml = rows
    .map(
      ([label, value]) => `
      <tr>
        <td style="padding: 4px 14px 4px 0; font-family: ${FONT_BODY}; font-size: 11px; line-height: 16px; color: ${COLOR.brown}; text-transform: uppercase; letter-spacing: 0.1em; vertical-align: top; white-space: nowrap; font-weight: 700;">
          ${escapeHtml(label)}
        </td>
        <td style="padding: 4px 0; font-family: ${FONT_BODY}; font-size: 14px; line-height: 20px; color: ${COLOR.ink}; vertical-align: top;">
          ${escapeHtml(value)}
        </td>
      </tr>
    `
    )
    .join('')

  const linkHtml = deepLink
    ? `<p style="margin: 8px 0 0 0; font-family: ${FONT_BODY}; font-size: 12px; line-height: 18px;"><a href="${deepLink.href}" target="_blank" rel="noopener" style="color: ${COLOR.brownDark}; text-decoration: underline; font-weight: 600;">${escapeHtml(deepLink.label)} →</a></p>`
    : ''

  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin: 0 0 12px 0; padding: 12px 16px; background-color: ${COLOR.detailsBg}; border-left: 3px solid ${COLOR.brownDark}; width: 100%;">
      ${rowsHtml}
    </table>
    ${linkHtml ? `<div style="margin: -8px 0 16px 0;">${linkHtml}</div>` : ''}
  `
}

// ---- Section renderers ----

function renderRegistrations(rows: DigestRegistration[]): string {
  if (rows.length === 0) return ''
  const cards = rows
    .map((r) => {
      const items: Array<[string, string]> = [
        ['Name', r.fullName],
        ['Email', r.email],
        ['Role', r.role],
      ]
      if (r.affiliation) items.push(['Affiliation', r.affiliation])
      if (r.country) items.push(['Country', r.country])
      if (r.orcidId) items.push(['ORCID', r.orcidId])
      items.push(['Registered', formatDate(r.createdAt)])
      return itemCard(items)
    })
    .join('')
  return sectionHeading('New registrations', rows.length) + cards
}

function renderSubmissions(rows: DigestSubmission[]): string {
  if (rows.length === 0) return ''
  const cards = rows
    .map((r) => {
      const items: Array<[string, string]> = [
        ['Submission', r.submissionId],
        ['Title', r.title || '(untitled)'],
      ]
      if (r.manuscriptType) items.push(['Type', r.manuscriptType])
      if (r.correspondingAuthor) items.push(['Corresponding author', r.correspondingAuthor])
      items.push(['Submitted', formatDate(r.submissionDate)])
      return itemCard(items, {
        label: 'Open in admin',
        href: `${SITE_URL}/dashboard/admin/manuscripts/${r.manuscriptId}`,
      })
    })
    .join('')
  return sectionHeading('New manuscript submissions', rows.length) + cards
}

function renderRevisions(rows: DigestRevision[]): string {
  if (rows.length === 0) return ''
  const cards = rows
    .map((r) => {
      const items: Array<[string, string]> = [
        ['Submission', r.submissionId],
        ['Title', r.title || '(untitled)'],
        ['Revision #', String(r.revisionNumber)],
        ['Received', formatDate(r.submittedDate)],
      ]
      return itemCard(items, {
        label: 'Open in admin',
        href: `${SITE_URL}/dashboard/admin/manuscripts/${r.manuscriptId}`,
      })
    })
    .join('')
  return sectionHeading('Revisions received', rows.length) + cards
}

function renderReviewerApplications(rows: DigestReviewerApplication[]): string {
  if (rows.length === 0) return ''
  const cards = rows
    .map((r) => {
      const items: Array<[string, string]> = [
        ['Name', r.fullName],
        ['Email', r.email],
        ['Affiliation', r.affiliation],
        ['Country', r.country],
        ['Career stage', r.careerStage],
        ['Submitted', formatDate(r.createdAt)],
      ]
      return itemCard(items, {
        label: 'Triage applicants',
        href: `${SITE_URL}/dashboard/admin/reviewer-applications?tab=pending`,
      })
    })
    .join('')
  return sectionHeading('New reviewer applications', rows.length) + cards
}

function renderReviewsSubmitted(rows: DigestReviewSubmitted[]): string {
  if (rows.length === 0) return ''
  const cards = rows
    .map((r) => {
      const items: Array<[string, string]> = [
        ['Submission', r.submissionId],
        ['Manuscript', r.manuscriptTitle || '(untitled)'],
      ]
      if (r.reviewerName) items.push(['Reviewer', r.reviewerName])
      if (r.recommendation) items.push(['Recommendation', r.recommendation])
      items.push(['Submitted', formatDate(r.submittedDate)])
      return itemCard(items, {
        label: 'Open in admin',
        href: `${SITE_URL}/dashboard/admin/manuscripts/${r.manuscriptId}/reviews/${r.reviewId}`,
      })
    })
    .join('')
  return sectionHeading('Reviews submitted', rows.length) + cards
}

// ---- Public entry point ----

export function renderDailyDigest(params: DailyDigestParams): RenderedEmail {
  const {
    windowStartIso,
    windowEndIso,
    registrations,
    submissions,
    revisions,
    reviewerApplications,
    reviewsSubmitted,
  } = params

  const totalCount =
    registrations.length +
    submissions.length +
    revisions.length +
    reviewerApplications.length +
    reviewsSubmitted.length

  const dateRange = formatDateRange(windowStartIso, windowEndIso)

  const headerParagraph = paragraph(
    `Editorial activity for the last 24 hours (${escapeHtml(dateRange)}). Deep links open the relevant admin page on oscrsj.com — the dashboard remains the source of truth for full record review.`
  )

  const allSections = [
    renderRegistrations(registrations),
    renderSubmissions(submissions),
    renderRevisions(revisions),
    renderReviewerApplications(reviewerApplications),
    renderReviewsSubmitted(reviewsSubmitted),
  ]
    .filter(Boolean)
    .join('\n')

  const closingParagraph = paragraph(
    `Full activity record: <a href="${SITE_URL}/dashboard/admin/manuscripts" target="_blank" rel="noopener" style="color: ${COLOR.brownDark}; text-decoration: underline; font-weight: 600;">/dashboard/admin/manuscripts</a> · <a href="${SITE_URL}/dashboard/admin/reviewer-applications" target="_blank" rel="noopener" style="color: ${COLOR.brownDark}; text-decoration: underline; font-weight: 600;">/dashboard/admin/reviewer-applications</a>`
  )

  const bodyHtml = [headerParagraph, allSections, closingParagraph].join('\n')

  const html = renderEmailShell({
    previewText: `${totalCount} editorial event${totalCount === 1 ? '' : 's'} in the last 24 hours.`,
    heading: 'Editorial daily digest',
    bodyHtml,
    footerNote: `Daily digest · ${dateRange}`,
  })

  // Plain-text body — same data, flat list per section.
  const textLines: string[] = []
  textLines.push(`OSCRSJ Editorial Daily Digest`)
  textLines.push(dateRange)
  textLines.push('')

  if (registrations.length > 0) {
    textLines.push(`NEW REGISTRATIONS (${registrations.length})`)
    for (const r of registrations) {
      textLines.push(`- ${r.fullName} <${r.email}> · ${r.role}${r.affiliation ? ` · ${r.affiliation}` : ''}${r.country ? ` · ${r.country}` : ''}`)
    }
    textLines.push('')
  }

  if (submissions.length > 0) {
    textLines.push(`NEW MANUSCRIPT SUBMISSIONS (${submissions.length})`)
    for (const r of submissions) {
      textLines.push(
        `- ${r.submissionId} · ${r.title || '(untitled)'}${r.manuscriptType ? ` · ${r.manuscriptType}` : ''}${r.correspondingAuthor ? ` · ${r.correspondingAuthor}` : ''}`
      )
      textLines.push(`  ${SITE_URL}/dashboard/admin/manuscripts/${r.manuscriptId}`)
    }
    textLines.push('')
  }

  if (revisions.length > 0) {
    textLines.push(`REVISIONS RECEIVED (${revisions.length})`)
    for (const r of revisions) {
      textLines.push(`- ${r.submissionId} · revision #${r.revisionNumber} · ${r.title || '(untitled)'}`)
      textLines.push(`  ${SITE_URL}/dashboard/admin/manuscripts/${r.manuscriptId}`)
    }
    textLines.push('')
  }

  if (reviewerApplications.length > 0) {
    textLines.push(`NEW REVIEWER APPLICATIONS (${reviewerApplications.length})`)
    for (const r of reviewerApplications) {
      textLines.push(`- ${r.fullName} <${r.email}> · ${r.careerStage} · ${r.affiliation} · ${r.country}`)
    }
    textLines.push(`  ${SITE_URL}/dashboard/admin/reviewer-applications?tab=pending`)
    textLines.push('')
  }

  if (reviewsSubmitted.length > 0) {
    textLines.push(`REVIEWS SUBMITTED (${reviewsSubmitted.length})`)
    for (const r of reviewsSubmitted) {
      textLines.push(
        `- ${r.submissionId}${r.reviewerName ? ` · ${r.reviewerName}` : ''}${r.recommendation ? ` · ${r.recommendation}` : ''}`
      )
      textLines.push(`  ${SITE_URL}/dashboard/admin/manuscripts/${r.manuscriptId}/reviews/${r.reviewId}`)
    }
    textLines.push('')
  }

  textLines.push(
    `Full record: ${SITE_URL}/dashboard/admin/manuscripts and ${SITE_URL}/dashboard/admin/reviewer-applications`
  )

  const text = textLines.join('\n') + plainTextFooter()

  return { html, text }
}

export function getDailyDigestSubject(params: {
  registrationCount: number
  submissionCount: number
  revisionCount: number
  reviewerApplicationCount: number
  reviewSubmittedCount: number
}): string {
  const parts: string[] = []
  if (params.registrationCount > 0) {
    parts.push(`${params.registrationCount} registration${params.registrationCount === 1 ? '' : 's'}`)
  }
  if (params.submissionCount > 0) {
    parts.push(`${params.submissionCount} submission${params.submissionCount === 1 ? '' : 's'}`)
  }
  if (params.revisionCount > 0) {
    parts.push(`${params.revisionCount} revision${params.revisionCount === 1 ? '' : 's'}`)
  }
  if (params.reviewerApplicationCount > 0) {
    parts.push(
      `${params.reviewerApplicationCount} reviewer app${params.reviewerApplicationCount === 1 ? '' : 's'}`
    )
  }
  if (params.reviewSubmittedCount > 0) {
    parts.push(
      `${params.reviewSubmittedCount} review${params.reviewSubmittedCount === 1 ? '' : 's'}`
    )
  }
  const summary = parts.length > 0 ? parts.join(' · ') : 'no activity'
  return `[OSCRSJ Daily] ${summary}`
}
