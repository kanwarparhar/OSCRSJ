// ============================================================
// Revision-deadline reminder email (Session 13)
// ============================================================
// One-shot reminder fired by /api/cron/revision-reminders when:
//   - manuscripts.status = 'revision_requested'
//   - the latest non-rescinded editorial_decisions.revision_deadline
//     is within 10 days of now
//   - manuscript_metadata.revision_reminder_sent_at IS NULL
//
// One reminder per manuscript revision cycle — no second tier.
// Authors already see the amber banner on /dashboard every login;
// the email is the breakthrough nudge for inactive authors.
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

export interface RevisionDeadlineReminderParams {
  authorName: string
  submissionId: string
  manuscriptTitle: string
  deadlineLabel: string
  daysRemaining: number
  revisingUrl: string
}

export function renderRevisionDeadlineReminder(
  params: RevisionDeadlineReminderParams
): RenderedEmail {
  const {
    authorName,
    submissionId,
    manuscriptTitle,
    deadlineLabel,
    daysRemaining,
    revisingUrl,
  } = params

  const days = Math.max(daysRemaining, 0)
  const daysLine = `${days} day${days === 1 ? '' : 's'} remaining`

  const intro = `This is a reminder that your revised manuscript is due in approximately ${days} day${days === 1 ? '' : 's'}. If you need additional time, reply to this email — the editorial office can extend the deadline on request.`

  const bodyHtml = [
    paragraph(`Dear ${escapeHtml(authorName)},`),
    paragraph(escapeHtml(intro)),
    detailsList([
      ['Submission ID', submissionId],
      ['Manuscript', manuscriptTitle],
      ['Revision deadline', deadlineLabel],
      ['Time remaining', daysLine],
    ]),
    cta(revisingUrl, 'Open revision wizard'),
    paragraph(
      `If you have already started but not yet submitted, your draft is auto-saved on every step — pick up where you left off.`
    ),
    paragraph(`With thanks,<br />The OSCRSJ Editorial Office`),
  ].join('\n')

  const html = renderEmailShell({
    previewText: `Revision deadline in ${days} days — submission ${submissionId}`,
    heading: `Your revision is due in ${days} day${days === 1 ? '' : 's'}`,
    bodyHtml,
  })

  const text =
    `Dear ${authorName},\n\n` +
    `${intro}\n\n` +
    `Submission ID: ${submissionId}\n` +
    `Manuscript: ${manuscriptTitle}\n` +
    `Revision deadline: ${deadlineLabel}\n` +
    `Time remaining: ${daysLine}\n\n` +
    `Open revision wizard: ${revisingUrl}\n\n` +
    `If you have already started but not yet submitted, your draft is auto-saved on every step — pick up where you left off.\n\n` +
    `With thanks,\nThe OSCRSJ Editorial Office` +
    plainTextFooter()

  return { html, text }
}

export function getRevisionDeadlineReminderSubject(
  submissionId: string,
  daysRemaining: number
): string {
  const days = Math.max(daysRemaining, 0)
  return `[OSCRSJ] Revision deadline in ${days} day${days === 1 ? '' : 's'} — submission ${submissionId}`
}
