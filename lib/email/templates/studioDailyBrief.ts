// ============================================================
// Submission Studio -- daily morning brief
// ============================================================
// One email per morning with yesterday's Studio numbers, sent from the
// daily-digest cron tick. Unlike the editorial digest, this sends on EMPTY
// days too: a zero-jobs day is itself the signal Kanwar needs to see, and a
// silently-skipped email is indistinguishable from a broken cron.
//
// HOUSE RULE, same as app/(formatter)/_copy.ts: no em-dashes in anything a
// human reads. This email is read by a human.
//
// EVERY NEW METRIC IS READ DEFENSIVELY (`?? 0`, explicit undefined checks).
// The brief can be re-rendered from a stored studio_daily_metrics snapshot, and
// snapshots written before a field existed simply do not have the key. A
// morning brief that throws is a morning brief nobody gets.
// ============================================================

import {
  renderEmailShell,
  paragraph,
  detailsList,
  plainTextFooter,
  type RenderedEmail,
} from './shared'
import type { StudioDailyMetrics } from '@/lib/studio/metrics'
import { STUDIO_FREE_UNTIL_ISO, STUDIO_FREE_UNTIL_LABEL } from '@/lib/studio/quotaConstants'

const money = (n: number | null | undefined, dp = 2): string =>
  n === null || n === undefined ? 'n/a' : `$${n.toFixed(dp)}`

// Accepts undefined as well as null so a field missing from an older snapshot
// renders as 'n/a' rather than crashing the send.
const pct = (n: number | null | undefined): string =>
  n === null || n === undefined ? 'n/a' : `${n.toFixed(1)}%`

/** Survey scores are a 1-5 scale; carrying the scale stops "3.4" reading as %. */
const score = (n: number | null | undefined): string =>
  n === null || n === undefined ? 'n/a' : `${n.toFixed(1)} / 5`

const count = (n: number | null | undefined): string => String(n ?? 0)

/**
 * How many whole days of the free period are left after the reported day.
 *
 * Measured from the END of the day's window rather than from Date.now(), for
 * two reasons: a brief re-rendered from a stored snapshot then says what it
 * said that morning instead of quietly changing its mind, and the value is
 * pinnable in a test. Negative once the Studio has gone paid, which the caller
 * uses to stop counting down.
 */
function freeDaysLeft(m: StudioDailyMetrics): number | null {
  const end = Date.parse(m.windowEndIso)
  const paidAt = Date.parse(STUDIO_FREE_UNTIL_ISO)
  if (!Number.isFinite(end) || !Number.isFinite(paidAt)) return null
  return Math.floor((paidAt - end) / 86_400_000)
}

/**
 * Start warning two weeks out. That is roughly the shortest notice on which
 * anything can still be DONE about it: a last push for survey responses, a
 * pricing page, or a decision to move the date. A three-day warning is just an
 * announcement.
 */
const FREE_PERIOD_WARNING_DAYS = 14

/** A day counts as quiet only if nothing at all happened, feedback included. */
const isQuietDay = (m: StudioDailyMetrics): boolean =>
  m.jobsStarted === 0 && m.finderQueries === 0 && (m.surveysCompleted ?? 0) === 0

const duration = (secs: number | null): string => {
  if (secs === null) return 'n/a'
  if (secs < 90) return `${secs}s`
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return `${m}m ${s.toString().padStart(2, '0')}s`
}

export function getStudioDailyBriefSubject(m: StudioDailyMetrics): string {
  if (isQuietDay(m)) {
    return `[OSCRSJ Studio] ${m.day} · no activity`
  }
  const surveys = m.surveysCompleted ?? 0
  const bits = [`${m.jobsStarted} job${m.jobsStarted === 1 ? '' : 's'}`]
  if (m.newEmails > 0) bits.push(`${m.newEmails} new signup${m.newEmails === 1 ? '' : 's'}`)
  if (m.finderQueries > 0) bits.push(`${m.finderQueries} finder`)
  // Surveys are the scarce thing during the free period, so they earn a slot in
  // the subject line whenever there are any. Omitted entirely on a zero day
  // rather than shown as "0 surveys", same as the other optional bits.
  if (surveys > 0) bits.push(`${surveys} survey${surveys === 1 ? '' : 's'}`)
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

  // ---- The free allowance and the survey gate -------------------------------
  // Everything below exists to answer one question on the morning it needs
  // answering: is the three-run wall buying feedback, or just switching the
  // tool off for people? Each flag is written so that reading it tells you what
  // to go and do, because a flag you cannot act on is a flag you learn to skip.

  // The free period IS the data collection window. Once the Studio is paid, the
  // survey stops being worth three runs to anybody and the sample is whatever
  // it is. Counting down first, above the diagnostics, because it changes how
  // urgently the rest of them read.
  const daysLeft = freeDaysLeft(m)
  if (daysLeft !== null && daysLeft >= 0 && daysLeft <= FREE_PERIOD_WARNING_DAYS) {
    flags.push(
      daysLeft === 0
        ? `Last day of the free Submission Studio period. It goes paid on ${STUDIO_FREE_UNTIL_LABEL}, and the survey stops earning anyone free runs at the same moment.`
        : `${daysLeft} day${daysLeft === 1 ? '' : 's'} of the free Submission Studio period left (it ends ${STUDIO_FREE_UNTIL_LABEL}). Anything you still want out of the feedback survey has to be asked for before then.`,
    )
  }

  // Conversion is only meaningful once a few people have actually hit the wall;
  // one person who ignored the survey is not a finding. Five is the point where
  // "nobody is converting" stops being explainable by chance.
  const exhaustedEver = m.cumulativeEmailsExhausted ?? 0
  if (
    m.surveyConversionPct !== null &&
    m.surveyConversionPct !== undefined &&
    exhaustedEver >= 5 &&
    m.surveyConversionPct < 40
  ) {
    flags.push(
      `Only ${pct(m.surveyConversionPct)} of the ${exhaustedEver} addresses that ran out of free runs have completed the survey. The wall is turning away more people than it is learning from, which is the opposite of the trade it is supposed to be. Worth re-reading /studio/unlock as a stranger would.`,
    )
  }

  // Three responses is not a sample, but a mean under 3 on even three answers
  // is worth reading the free text over before another week goes by.
  const surveysEver = m.cumulativeSurveys ?? 0
  if (
    m.cumulativeMeanUsefulness !== null &&
    m.cumulativeMeanUsefulness !== undefined &&
    surveysEver >= 3 &&
    m.cumulativeMeanUsefulness < 3
  ) {
    const problem = m.topSurveyProblem
      ? ` The most reported problem is "${m.topSurveyProblem}" (${m.topSurveyProblemCount ?? 0}).`
      : ''
    flags.push(
      `Mean usefulness is ${score(m.cumulativeMeanUsefulness)} across ${surveysEver} response${surveysEver === 1 ? '' : 's'}. Under 3 out of 5 means the tool is not landing for the people using it.${problem}`,
    )
  }

  // A day where the wall went up and nothing came back through it. This is the
  // gate failing in the small, one day at a time, before the all-time
  // conversion rate has moved far enough to trip the flag above.
  const exhaustedToday = m.emailsExhaustedApprox ?? 0
  if (exhaustedToday > 0 && (m.surveysCompleted ?? 0) === 0) {
    flags.push(
      `${exhaustedToday} address${exhaustedToday === 1 ? '' : 'es'} ran out of free runs on ${m.day} and not one of them completed the survey. That is a day of demand spent with nothing collected in return.`,
    )
  }

  return flags
}

export function renderStudioDailyBrief(m: StudioDailyMetrics): RenderedEmail {
  const flags = studioFlags(m)

  const quiet = isQuietDay(m)

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

  const feedback = detailsList([
    ['Surveys completed', count(m.surveysCompleted)],
    ['Resets granted', count(m.resetsGranted)],
    ['Mean usefulness', score(m.meanUsefulness)],
    ['Surveys to date', count(m.cumulativeSurveys)],
    // Reads 'n/a' rather than '0.0%' until somebody has actually hit the wall.
    // Nobody has run out of runs yet and nobody is converting are opposite
    // pieces of news and must not look the same in the table.
    ['Survey conversion', pct(m.surveyConversionPct)],
    [
      'Top reported problem',
      m.topSurveyProblem ? `${m.topSurveyProblem} (${m.topSurveyProblemCount ?? 0})` : 'n/a',
    ],
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
    paragraph('<strong>Feedback</strong>'),
    feedback,
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
      'Generated from formatting_jobs, finder_queries, studio_email_quota and studio_survey_responses. The same numbers are appended to the Studio Daily Metrics tab of the OSCRSJ Form Submissions sheet.',
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
    'FEEDBACK',
    `  Surveys completed ....... ${count(m.surveysCompleted)}`,
    `  Resets granted .......... ${count(m.resetsGranted)}`,
    `  Mean usefulness ......... ${score(m.meanUsefulness)}`,
    `  Surveys to date ......... ${count(m.cumulativeSurveys)}`,
    `  Survey conversion ....... ${pct(m.surveyConversionPct)}`,
    `  Top reported problem .... ${m.topSurveyProblem ? `${m.topSurveyProblem} (${m.topSurveyProblemCount ?? 0})` : 'n/a'}`,
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
