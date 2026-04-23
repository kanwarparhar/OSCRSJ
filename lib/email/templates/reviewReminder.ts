// ============================================================
// Reviewer reminder email
// ============================================================
// Parameterised by kind: 'ten_day' | 'five_day' | 'overdue'. Fired
// by the daily Vercel Cron job at /api/cron/review-reminders when
// a review_invitations row is:
//   - status = 'accepted'
//   - inside the window for the given kind
//   - and has not yet had that kind's reminder_*_sent_at set
//
// Subject + intro copy diverge per kind; the body shell
// (details list + CTA to the review form) is shared.
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

export type ReviewReminderKind = 'ten_day' | 'five_day' | 'overdue'

export interface ReviewReminderParams {
  kind: ReviewReminderKind
  firstName: string
  manuscriptTitle: string
  deadlineLabel: string
  daysRemaining: number // negative if overdue
  reviewFormUrl: string
}

function introCopy(kind: ReviewReminderKind, daysRemaining: number): string {
  if (kind === 'ten_day') {
    return `This is a friendly reminder that your review is due in approximately ten days. We truly appreciate the time you are giving to this manuscript.`
  }
  if (kind === 'five_day') {
    return `This is a reminder that your review is due in approximately five days. If anything is blocking you, reply to this email and the editorial office will help — we can extend the deadline if you need more time.`
  }
  return `Our records show your review is now past the agreed deadline. If you are still able to submit the review, please do so at your earliest convenience, or reply to this email if you need a new deadline or would like to step away from this invitation.`
}

function deadlineLineLabel(
  kind: ReviewReminderKind,
  daysRemaining: number
): string {
  if (kind === 'overdue') {
    const overdueBy = Math.abs(Math.min(daysRemaining, 0))
    if (overdueBy === 0) return 'Due today'
    return `${overdueBy} day${overdueBy === 1 ? '' : 's'} overdue`
  }
  const days = Math.max(daysRemaining, 0)
  return `${days} day${days === 1 ? '' : 's'} remaining`
}

export function renderReviewReminder(
  params: ReviewReminderParams
): RenderedEmail {
  const {
    kind,
    firstName,
    manuscriptTitle,
    deadlineLabel,
    daysRemaining,
    reviewFormUrl,
  } = params

  const intro = introCopy(kind, daysRemaining)
  const dueLine = deadlineLineLabel(kind, daysRemaining)

  const bodyHtml = [
    paragraph(`Dear ${escapeHtml(firstName)},`),
    paragraph(escapeHtml(intro)),
    detailsList([
      ['Manuscript', manuscriptTitle],
      ['Deadline', deadlineLabel],
      [kind === 'overdue' ? 'Status' : 'Time remaining', dueLine],
    ]),
    cta(reviewFormUrl, 'Open review form'),
    paragraph(
      `If this invitation is no longer a good fit, reply and let us know — we can re-route the manuscript to another reviewer without delay.`
    ),
    paragraph(`With thanks,<br />The OSCRSJ Editorial Office`),
  ].join('\n')

  const heading =
    kind === 'overdue'
      ? 'Your review is overdue'
      : kind === 'five_day'
        ? 'Your review is due in 5 days'
        : 'Your review is due in 10 days'

  const html = renderEmailShell({
    previewText: `Reminder: your OSCRSJ review — "${manuscriptTitle}"`,
    heading,
    bodyHtml,
  })

  const text =
    `Dear ${firstName},\n\n` +
    `${intro}\n\n` +
    `Manuscript: ${manuscriptTitle}\n` +
    `Deadline: ${deadlineLabel}\n` +
    `${kind === 'overdue' ? 'Status' : 'Time remaining'}: ${dueLine}\n\n` +
    `Open review form: ${reviewFormUrl}\n\n` +
    `If this invitation is no longer a good fit, reply and let us know — we can re-route the manuscript to another reviewer without delay.\n\n` +
    `With thanks,\nThe OSCRSJ Editorial Office` +
    plainTextFooter()

  return { html, text }
}

export function getReviewReminderSubject(
  kind: ReviewReminderKind,
  manuscriptTitle: string
): string {
  const t = manuscriptTitle.trim() || 'a manuscript'
  if (kind === 'ten_day') {
    return `Reviewer reminder: 10 days until your review is due — ${t}`
  }
  if (kind === 'five_day') {
    return `Reviewer reminder: 5 days until your review is due — ${t}`
  }
  return `Reviewer reminder: your review is now overdue — ${t}`
}
