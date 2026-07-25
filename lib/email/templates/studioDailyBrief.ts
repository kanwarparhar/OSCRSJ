// ============================================================
// Submission Studio -- daily morning brief
// ============================================================
// One email per morning with yesterday's Studio numbers, sent from the
// daily-digest cron tick. Unlike the editorial digest, this sends on EMPTY
// days too: a zero-jobs day is itself the signal Kanwar needs to see, and a
// silently-skipped email is indistinguishable from a broken cron.
// ============================================================

import {
  renderEmailShell,
  paragraph,
  detailsList,
  plainTextFooter,
  type RenderedEmail,
} from './shared'
import type { StudioDailyMetrics } from '@/lib/studio/metrics'

const money = (n: number | null | undefined, dp = 2): string =>
  n === null || n === undefined ? 'n/a' : `$${n.toFixed(dp)}`

const pct = (n: number | null): string => (n === null ? 'n/a' : `${n.toFixed(1)}%`)

const duration = (secs: number | null): string => {
  if (secs === null) return 'n/a'
  if (secs < 90) return `${secs}s`
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return `${m}m ${s.toString().padStart(2, '0')}s`
}

export function getStudioDailyBriefSubject(m: StudioDailyMetrics): string {
  if (m.jobsStarted === 0 && m.finderQueries === 0) {
    return `[OSCRSJ Studio] ${m.day} · no activity`
  }
  const bits = [`${m.jobsStarted} job${m.jobsStarted === 1 ? '' : 's'}`]
  if (m.newEmails > 0) bits.push(`${m.newEmails} new signup${m.newEmails === 1 ? '' : 's'}`)
  if (m.finderQueries > 0) bits.push(`${m.finderQueries} finder`)
  bits.push(money(m.deepseekCostUsdEst, 3))
  return `[OSCRSJ Studio] ${m.day} · ${bits.join(' · ')}`
}

/** Things worth putting at the top of the email rather than in the table. */
export function studioFlags(m: StudioDailyMetrics): string[] {
  const flags: string[] = []

  if (m.jobsStarted >= 3 && m.completionRatePct !== null && m.completionRatePct < 85) {
    flags.push(
      `Completion rate was ${pct(m.completionRatePct)} on ${m.jobsStarted} jobs. Anything under 85% usually means a systematic breakage, not user error.`,
    )
  }
  if (m.topFailureReason) {
    flags.push(`Most common failure: ${m.topFailureReason}`)
  }
  if (m.balanceUsd !== null && m.balanceUsd < 5) {
    flags.push(
      `DeepSeek balance is down to ${money(m.balanceUsd)}. Top up before it hits zero, or every job starts failing at the parse stage.`,
    )
  }
  if (m.balanceError) {
    flags.push(
      `Could not read the DeepSeek balance (${m.balanceError}). Estimated cost below is still valid; the actual-spend figure is not available today.`,
    )
  }
  if (
    m.balanceDeltaUsd !== null &&
    m.deepseekCostUsdEst > 0 &&
    m.balanceDeltaUsd > m.deepseekCostUsdEst * 2 &&
    m.balanceDeltaUsd - m.deepseekCostUsdEst > 0.05
  ) {
    flags.push(
      `Actual DeepSeek spend (${money(m.balanceDeltaUsd, 3)}) was well above what the Studio accounted for (${money(m.deepseekCostUsdEst, 3)}). Either something outside the Studio is using the key, or the per-token rates in references/parse.ts have drifted.`,
    )
  }
  if (m.returningEmails > 0) {
    flags.push(
      `${m.returningEmails} returning user${m.returningEmails === 1 ? '' : 's'} came back for another manuscript.`,
    )
  }
  return flags
}

export function renderStudioDailyBrief(m: StudioDailyMetrics): RenderedEmail {
  const flags = studioFlags(m)

  const quiet = m.jobsStarted === 0 && m.finderQueries === 0

  const intro = quiet
    ? paragraph(
        `No Submission Studio activity on ${m.day}. Everything below is the running total.`,
      )
    : paragraph(`Submission Studio, ${m.day} (${m.timezone}).`)

  const flagsHtml = flags.length
    ? paragraph(
        `<strong>Worth a look</strong><br />` +
          flags.map((f) => `&bull; ${f}`).join('<br />'),
      )
    : ''

  const usage = detailsList([
    ['Jobs started', String(m.jobsStarted)],
    ['Completed', String(m.jobsCompleted)],
    ['Failed', String(m.jobsFailed)],
    ['Still running', String(m.jobsUnfinished)],
    ['Completion rate', pct(m.completionRatePct)],
    ['Median run time', duration(m.medianCompletionSeconds)],
    ['Finder queries', String(m.finderQueries)],
  ])

  const audience = detailsList([
    ['Unique users', String(m.uniqueEmails)],
    ['New', String(m.newEmails)],
    ['Returning', String(m.returningEmails)],
    ['Marketing list size', String(m.cumulativeMarketingContacts)],
  ])

  const demand = detailsList([
    ['Top journal', m.topJournal ? `${m.topJournal} (${m.topJournalCount})` : 'n/a'],
    ['Distinct journals', String(m.distinctJournals)],
    ['Top article type', m.topArticleType ?? 'n/a'],
    ['Figures uploaded', String(m.figuresUploaded)],
  ])

  const cost = detailsList([
    ['Estimated spend', money(m.deepseekCostUsdEst, 3)],
    ['Actual spend (balance delta)', m.balanceDeltaUsd === null ? 'n/a' : money(m.balanceDeltaUsd, 3)],
    ['Tokens', m.deepseekTokens.toLocaleString('en-US')],
    ['Cost per completed job', m.costPerCompletedJobUsd === null ? 'n/a' : money(m.costPerCompletedJobUsd, 4)],
    ['DeepSeek balance', m.balanceUsd === null ? 'n/a' : money(m.balanceUsd)],
    ['Estimated spend to date', money(m.cumulativeCostUsdEst, 2)],
  ])

  const totals = detailsList([
    ['Jobs to date', String(m.cumulativeJobs)],
    ['Completed to date', String(m.cumulativeCompleted)],
  ])

  const bodyHtml = [
    intro,
    flagsHtml,
    paragraph('<strong>Usage</strong>'),
    usage,
    paragraph('<strong>Audience</strong>'),
    audience,
    paragraph('<strong>Demand</strong>'),
    demand,
    paragraph('<strong>Cost</strong>'),
    cost,
    paragraph('<strong>Running totals</strong>'),
    totals,
  ]
    .filter(Boolean)
    .join('')

  const html = renderEmailShell({
    previewText: getStudioDailyBriefSubject(m),
    heading: 'Submission Studio daily brief',
    bodyHtml,
    footerNote:
      'Generated from formatting_jobs and finder_queries. The same numbers are appended to the Studio Daily Metrics tab of the OSCRSJ Form Submissions sheet.',
  })

  const text = [
    `SUBMISSION STUDIO DAILY BRIEF`,
    `${m.day} (${m.timezone})`,
    '',
    ...(flags.length ? ['WORTH A LOOK', ...flags.map((f) => `- ${f}`), ''] : []),
    'USAGE',
    `  Jobs started ............ ${m.jobsStarted}`,
    `  Completed ............... ${m.jobsCompleted}`,
    `  Failed .................. ${m.jobsFailed}`,
    `  Still running ........... ${m.jobsUnfinished}`,
    `  Completion rate ......... ${pct(m.completionRatePct)}`,
    `  Median run time ......... ${duration(m.medianCompletionSeconds)}`,
    `  Finder queries .......... ${m.finderQueries}`,
    '',
    'AUDIENCE',
    `  Unique users ............ ${m.uniqueEmails}`,
    `  New ..................... ${m.newEmails}`,
    `  Returning ............... ${m.returningEmails}`,
    `  Marketing list size ..... ${m.cumulativeMarketingContacts}`,
    '',
    'DEMAND',
    `  Top journal ............. ${m.topJournal ? `${m.topJournal} (${m.topJournalCount})` : 'n/a'}`,
    `  Distinct journals ....... ${m.distinctJournals}`,
    `  Top article type ........ ${m.topArticleType ?? 'n/a'}`,
    `  Figures uploaded ........ ${m.figuresUploaded}`,
    '',
    'COST',
    `  Estimated spend ......... ${money(m.deepseekCostUsdEst, 3)}`,
    `  Actual (balance delta) .. ${m.balanceDeltaUsd === null ? 'n/a' : money(m.balanceDeltaUsd, 3)}`,
    `  Tokens .................. ${m.deepseekTokens}`,
    `  Per completed job ....... ${m.costPerCompletedJobUsd === null ? 'n/a' : money(m.costPerCompletedJobUsd, 4)}`,
    `  DeepSeek balance ........ ${m.balanceUsd === null ? 'n/a' : money(m.balanceUsd)}`,
    `  Spend to date (est) ..... ${money(m.cumulativeCostUsdEst, 2)}`,
    '',
    'RUNNING TOTALS',
    `  Jobs to date ............ ${m.cumulativeJobs}`,
    `  Completed to date ....... ${m.cumulativeCompleted}`,
    plainTextFooter(),
  ].join('\n')

  return { html, text }
}
