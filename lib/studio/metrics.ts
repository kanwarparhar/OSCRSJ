// ============================================================
// Submission Studio -- daily usage metrics
// ============================================================
// Computes one snapshot per LOCAL day (America/Los_Angeles, so "yesterday"
// means what Kanwar means by yesterday, not a UTC calendar day) from
// formatting_jobs + finder_queries + studio_email_quota +
// studio_survey_responses, and builds the deduplicated marketing list.
// Read-only against the DB apart from the snapshot upsert, which the caller
// performs.
//
// WHAT IS TRACKED AND WHY (the answer to "I'm not sure what to measure"):
//
//   Volume        jobsStarted / Completed / Failed / Unfinished.
//                 Started is the demand signal. Completed over Started is the
//                 only number that tells you whether the product WORKS: a
//                 completion rate sliding under ~85% means people are hitting
//                 something, and it moves before anyone bothers to complain.
//   Audience      uniqueEmails, and the newEmails / returningEmails split.
//                 Returning users are the single most important number here.
//                 One-and-done traffic is a demo; anyone formatting a second
//                 manuscript is telling you the tool is genuinely useful, and
//                 that is also the population that will pay.
//   Demand shape  topJournal / distinctJournals / topArticleType. This is what
//                 tells you which journals to encode next and which per-journal
//                 landing pages to build first, sourced from real demand rather
//                 than a keyword tool.
//   Finder        finderQueries. Half the Studio. Previously uncountable
//                 because the Finder persisted nothing (migration 029).
//   Speed         medianCompletionSeconds. A slow run reads as a broken run.
//   Failure       topFailureReason, so a systematic breakage is visible on the
//                 morning it starts rather than in a support email.
//   Cost          Estimated from our own token accounting AND actual, from the
//                 DeepSeek balance delta. See lib/studio/deepseekBalance.ts for
//                 why both are reported.
//   Allowance     emailsExhaustedApprox / cumulativeEmailsExhausted. From
//                 2026-07-26 an address gets three lifetime free runs shared
//                 across both tools (lib/studio/quota.ts), so "how many people
//                 hit the wall" is now a first-class number: it is at once the
//                 ceiling on usage and the mouth of the feedback funnel.
//   Feedback      surveysCompleted / meanUsefulness / topSurveyProblem, and
//                 above all surveyConversionPct. The wall only earns its keep
//                 if the people it stops answer the survey. A lot of exhausted
//                 addresses with a low conversion rate means the gate is not
//                 buying feedback, it is just switching the tool off, and that
//                 is worth knowing the morning it starts rather than in
//                 September when the collection window has already shut.
//
// TWO KINDS OF JOB SHARE formatting_jobs. Since migration 030 a Finder
// assessment is a row in the same table carrying kind='finder_assess' and the
// documented journal_id sentinel 'finder_assess'. The volume, cost, audience
// and allowance figures deliberately span BOTH kinds: they are both Studio
// runs, they both cost DeepSeek money, and the free allowance is explicitly
// shared between them. The DEMAND figures deliberately do not, because a
// sentinel is not a journal and reporting it as one is how 'FINDER_ASSESS'
// ended up in the "top journal" line of the morning brief.
//
// Deliberately NOT tracked: anything from the manuscript itself. The metrics
// touch job envelope data only (journal, type, counts, timings). Nothing in
// this file reads the author's text, and it should stay that way.
// ============================================================

import { journalAbbrev } from '@/lib/formatting/registry-meta'
import { STUDIO_FREE_RUNS, STUDIO_MAX_RESETS } from './quotaConstants'
import type { DeepSeekBalance } from './deepseekBalance'

export const STUDIO_TZ = 'America/Los_Angeles'

/**
 * formatting_jobs.kind for a Finder assessment, and the journal_id sentinel
 * those same rows carry (app/api/finder/assess/route.ts writes both, because
 * journal_id is NOT NULL and an assessment has no target journal).
 *
 * Both literals are duplicated from FINDER_ASSESS_KIND in lib/finder/assessJob
 * rather than imported, and that is deliberate: assessJob pulls in the OOXML
 * ingest stack, the full validated rule registry and the Sheets client at load
 * time, while this module is imported by tests/studio-metrics.test.ts, which
 * has to stay a pure unit test. Two string literals is the cheaper trade. The
 * value is fixed by a CHECK constraint in migration 030, so it cannot drift
 * quietly; if it ever does change, grep for 'finder_assess'.
 */
const FINDER_ASSESS_KIND = 'finder_assess'
const FINDER_ASSESS_JOURNAL_SENTINEL = 'finder_assess'

/**
 * Runaway guard on the all-time fetches. Matches the inline 20000 the
 * new-vs-returning lookup below has always used. These are bounded scans, not
 * counts: past this many rows the derived numbers stop being exact and the
 * right fix is a SQL view, not a bigger number here.
 */
const ALL_TIME_ROW_LIMIT = 20000

/**
 * The survey's "no problems" option, and the id of the question it belongs to
 * (lib/studio/survey.ts). Excluded from topSurveyProblem because on a healthy
 * day it is the most-ticked option by a distance, and reporting "Nothing went
 * wrong" as the top PROBLEM is worse than reporting nothing at all.
 *
 * Retyped rather than imported so this file stays free of the survey module.
 * The coupling is safe by process, not by types: SURVEY_VERSION must be bumped
 * on any change to an option's wording, so a rename is already a reviewed
 * event rather than a silent one.
 */
const SURVEY_PROBLEMS_QUESTION_ID = 'problems'
const SURVEY_NO_PROBLEM_OPTION = 'Nothing went wrong'

/** Marketing-list provenance. One label per tool, joined when both apply. */
const SOURCE_FORMATTER = 'Submission Studio (Formatter)'
const SOURCE_FINDER = 'Submission Studio (Journal Finder)'

/* ------------------------------------------------------------------ */
/*  Local-day arithmetic                                               */
/* ------------------------------------------------------------------ */

/** Offset of `date` in `timeZone`, in ms (positive east of UTC). */
function tzOffsetMs(date: Date, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
  const parts: Record<string, string> = {}
  for (const p of dtf.formatToParts(date)) parts[p.type] = p.value
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour) % 24,
    Number(parts.minute),
    Number(parts.second),
  )
  return asUtc - date.getTime()
}

/** The YYYY-MM-DD local date `date` falls on. */
export function localDay(date: Date, timeZone: string = STUDIO_TZ): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

/** UTC instants bounding a local calendar day. DST-safe (two-pass offset). */
export function localDayRange(
  dayIso: string,
  timeZone: string = STUDIO_TZ,
): { startIso: string; endIso: string } {
  const [y, m, d] = dayIso.split('-').map(Number)
  const naiveStart = Date.UTC(y, m - 1, d, 0, 0, 0)
  // Two passes: the offset itself depends on the instant, and a DST boundary
  // inside the day would make a single-pass guess an hour wrong.
  let start = naiveStart - tzOffsetMs(new Date(naiveStart), timeZone)
  start = naiveStart - tzOffsetMs(new Date(start), timeZone)

  const naiveEnd = Date.UTC(y, m - 1, d + 1, 0, 0, 0)
  let end = naiveEnd - tzOffsetMs(new Date(naiveEnd), timeZone)
  end = naiveEnd - tzOffsetMs(new Date(end), timeZone)

  return { startIso: new Date(start).toISOString(), endIso: new Date(end).toISOString() }
}

/** The local day before `dayIso`. */
export function previousLocalDay(dayIso: string): string {
  const [y, m, d] = dayIso.split('-').map(Number)
  const prev = new Date(Date.UTC(y, m - 1, d - 1))
  return prev.toISOString().slice(0, 10)
}

/** The local day that "yesterday" means when the job runs at `now`. */
export function yesterdayLocal(now: Date = new Date(), timeZone: string = STUDIO_TZ): string {
  return previousLocalDay(localDay(now, timeZone))
}

/* ------------------------------------------------------------------ */
/*  Shapes                                                             */
/* ------------------------------------------------------------------ */

export interface StudioDailyMetrics {
  day: string
  timezone: string
  windowStartIso: string
  windowEndIso: string

  // The five counters below span BOTH job kinds, which is what they have always
  // meant and what every row already sitting in studio_daily_metrics contains.
  // Narrowing them to "formatter only" now would silently restate the history:
  // the snapshots are stored as JSON and nothing re-derives them, so yesterday's
  // jobsStarted would keep its old value while tomorrow's meant something else,
  // and nobody reading the series six weeks from now would be able to tell where
  // the definition moved. They stay as they are; finderAssessJobs is published
  // beside them so the split is available without rewriting anything.
  jobsStarted: number
  jobsCompleted: number
  jobsFailed: number
  jobsUnfinished: number
  completionRatePct: number | null
  /**
   * How many of jobsStarted were Finder assessments. Formatter jobs are
   * jobsStarted - finderAssessJobs.
   *
   * ABSENT (not zero) from snapshots written before 2026-07-26. A consumer
   * reading the stored series must treat undefined as "unknown", because on
   * those days the assessment jobs were counted and simply not labelled.
   */
  finderAssessJobs: number

  uniqueEmails: number
  newEmails: number
  returningEmails: number
  consentingJobs: number

  finderQueries: number
  /**
   * topJournal / distinctJournals count FORMATTER jobs only. Until 2026-07-26
   * they did not, which was a plain bug rather than a definition: an assessment
   * row carries journal_id = 'finder_assess', so on any day with assessment
   * traffic the sentinel competed for the top slot and, when it won, was handed
   * to journalAbbrev() and rendered in the brief as a journal nobody publishes
   * in. Fixed in place rather than behind a new field name because the old
   * behaviour never produced a meaningful value to preserve. Snapshots written
   * before the fix are left alone and may still contain the leaked sentinel.
   */
  topJournal: string | null
  topJournalCount: number
  distinctJournals: number
  topArticleType: string | null
  figuresUploaded: number

  medianCompletionSeconds: number | null
  topFailureReason: string | null

  deepseekTokens: number
  deepseekCostUsdEst: number
  costPerCompletedJobUsd: number | null

  balanceUsd: number | null
  balanceCny: number | null
  balanceDeltaUsd: number | null
  balanceError: string | null

  // ---- Free allowance + feedback survey (from 2026-07-26) -----------------
  // Migration 031 / lib/studio/quota.ts. Three lifetime free runs per address,
  // shared across both tools, buyable back exactly once with a survey response.

  /** Survey responses submitted inside the window. */
  surveysCompleted: number
  /** Allowances restored inside the window (studio_email_quota.quota_reset_at). */
  resetsGranted: number
  /**
   * Distinct addresses whose THIRD completed run was created inside the window,
   * i.e. who hit the wall on this day.
   *
   * APPROXIMATE, and named so on purpose. Three reasons, in descending order of
   * how much they can bite:
   *
   *   1. It counts each address's CURRENT quota epoch. A reset granted after
   *      `day` moves that epoch forward, so re-computing an old day now can
   *      hide an exhaustion that genuinely happened then. The live snapshot is
   *      written the morning after and is barely affected; a BACKFILL of old
   *      days will undercount, sometimes badly.
   *   2. It counts completed runs only. quota.ts also charges in-flight jobs
   *      against the allowance for IN_FLIGHT_GRACE_MINUTES, so an address can
   *      be locked for an hour and a half by a job that then fails and costs it
   *      nothing. Those transient locks are deliberately excluded: reporting a
   *      wall that un-built itself before breakfast is noise.
   *   3. Runs are ordered by created_at, the same as quota.ts orders them, so a
   *      run started before midnight and finished after it is attributed to the
   *      day it STARTED.
   *
   * The exact answer would need every address's full completed-run history
   * replayed against its epoch history, and we do not store epoch history --
   * a reset overwrites quota_reset_at in place (migration 031 section 2). That
   * is the right storage trade; this is the price of it.
   */
  emailsExhaustedApprox: number
  /** Mean usefulness (1-5) across surveys submitted this day. Null when none. */
  meanUsefulness: number | null

  cumulativeJobs: number
  cumulativeCompleted: number
  cumulativeCostUsdEst: number
  cumulativeMarketingContacts: number

  /** Survey responses ever recorded. */
  cumulativeSurveys: number
  /** Addresses that have ever bought their allowance back. Capped at one each. */
  cumulativeResetsGranted: number
  /**
   * Distinct addresses that have hit the wall at least once: at or over the
   * limit right now, OR already out of resets.
   *
   * The second half of that test is not redundant. An address that spent three
   * runs, answered the survey and is two runs into its second allowance is back
   * under the limit while having very much hit the wall -- reset_count is the
   * only surviving evidence, and a reset is only ever granted to a locked
   * address (lib/studio/quota.ts grantSurveyReset), so it is sufficient
   * evidence. Leaving it out would shrink the denominator of
   * surveyConversionPct by exactly the people who converted, which would report
   * the gate as working worst at the moment it started working.
   */
  cumulativeEmailsExhausted: number
  /** Mean usefulness (1-5) across every survey ever recorded. Null when none. */
  cumulativeMeanUsefulness: number | null
  /**
   * Of the addresses that have ever exhausted their allowance, the percentage
   * that completed the survey. THE number for this whole mechanic: the wall
   * costs real usage, and it is only worth paying if the people it stops turn
   * into feedback. Null, never 0, when nobody has hit the wall yet -- "no data"
   * and "nobody converted" are opposite readings and must not share a value.
   */
  surveyConversionPct: number | null
  /**
   * Most-selected option of the survey's `problems` question, all-time,
   * excluding "Nothing went wrong". Null when there are no responses, or when
   * every response so far reported no problems.
   */
  topSurveyProblem: string | null
  topSurveyProblemCount: number
}

export interface MarketingContact {
  email: string
  firstSeenIso: string
  lastSeenIso: string
  jobs: number
  journals: string
  lastArticleType: string
  consentVersion: string
  consentScope: string
  /** Which Studio tool(s) this address used: formatter, Finder, or both. */
  source: string
}

/* eslint-disable @typescript-eslint/no-explicit-any */
type Admin = any

interface JobRow {
  id: string
  email: string | null
  /** 'format' | 'finder_assess'. NOT NULL since migration 030; treated as
   *  'format' when absent so a pre-030 read degrades to the old behaviour. */
  kind: string | null
  journal_id: string | null
  article_type: string | null
  status: string | null
  report: any
  error: any
  figure_paths: any
  marketing_consent: boolean | null
  consent_version: string | null
  consent_scope: string | null
  created_at: string
  updated_at: string | null
}

/* ------------------------------------------------------------------ */
/*  Small helpers                                                      */
/* ------------------------------------------------------------------ */

const round = (n: number, dp = 2): number => Math.round(n * 10 ** dp) / 10 ** dp

function topOf(values: Array<string | null | undefined>): { key: string | null; count: number } {
  const tally = new Map<string, number>()
  for (const v of values) {
    if (!v) continue
    tally.set(v, (tally.get(v) ?? 0) + 1)
  }
  let key: string | null = null
  let count = 0
  tally.forEach((c, k) => {
    if (c > count) {
      key = k
      count = c
    }
  })
  return { key, count }
}

/**
 * Is this row a Finder assessment?
 *
 * Either marker is sufficient, deliberately. `kind` is set by a second UPDATE
 * immediately after the insert (lib/finder/assessJob.ts markJobKind), so for a
 * few milliseconds a genuine assessment row exists still reading 'format'; and
 * on a database where migration 030 has not run there is no kind column at all
 * and the select hands back undefined. The journal_id sentinel is written in
 * the same statement as the insert and covers both gaps.
 */
function isFinderAssess(row: { kind?: string | null; journal_id?: string | null }): boolean {
  return row.kind === FINDER_ASSESS_KIND || row.journal_id === FINDER_ASSESS_JOURNAL_SENTINEL
}

function mean(values: number[], dp = 2): number | null {
  if (values.length === 0) return null
  return round(values.reduce((sum, n) => sum + n, 0) / values.length, dp)
}

/**
 * Numeric usefulness scores out of a survey row set.
 * Written the long way because Number(null) is 0, and a null usefulness folded
 * in as a zero would drag the mean below the bottom of a scale that starts at 1.
 */
function usefulnessScores(rows: Array<{ usefulness?: unknown }>): number[] {
  const out: number[] = []
  for (const r of rows) {
    if (r.usefulness === null || r.usefulness === undefined) continue
    const n = Number(r.usefulness)
    if (Number.isFinite(n)) out.push(n)
  }
  return out
}

/**
 * The `problems` multi-select out of one survey row.
 * PostgREST returns a `responses->problems` projection as JSON, but be liberal:
 * depending on the arrow operator and client version it can arrive as an array
 * or as the raw JSON text. A malformed value contributes nothing rather than
 * throwing and taking the whole morning brief with it.
 */
function problemsOf(row: { problems?: unknown }): string[] {
  const raw = row.problems
  const asArray = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []
  if (Array.isArray(raw)) return asArray(raw)
  if (typeof raw === 'string') {
    try {
      return asArray(JSON.parse(raw))
    } catch {
      return []
    }
  }
  return []
}

function median(values: number[]): number | null {
  if (values.length === 0) return null
  const s = [...values].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 === 1 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2)
}

/** report.cost is written by the pipeline; it is internal-only and never sent
 *  to the client (the status route strips it). Shape: { deepseekTokens, usd }. */
function costOf(report: any): { tokens: number; usd: number } {
  const c = report && typeof report === 'object' ? report.cost : null
  if (!c || typeof c !== 'object') return { tokens: 0, usd: 0 }
  const tokens = Number(c.deepseekTokens)
  const usd = Number(c.usd)
  return {
    tokens: Number.isFinite(tokens) ? tokens : 0,
    usd: Number.isFinite(usd) ? usd : 0,
  }
}

function failureReasonOf(row: JobRow): string | null {
  const e = row.error
  if (!e) return null
  if (typeof e === 'string') return e.slice(0, 120)
  if (typeof e === 'object') {
    const msg = (e as any).message ?? (e as any).error ?? (e as any).stage
    if (typeof msg === 'string') return msg.slice(0, 120)
  }
  return 'unspecified'
}

/* ------------------------------------------------------------------ */
/*  Main computation                                                   */
/* ------------------------------------------------------------------ */

export async function computeStudioDailyMetrics(opts: {
  admin: Admin
  day: string
  balance: DeepSeekBalance
  timeZone?: string
}): Promise<StudioDailyMetrics> {
  const { admin, day, balance } = opts
  const timeZone = opts.timeZone ?? STUDIO_TZ
  const { startIso, endIso } = localDayRange(day, timeZone)

  // ---- Jobs created inside the window -------------------------------------
  const { data: jobsRaw } = await admin
    .from('formatting_jobs')
    .select(
      'id,email,kind,journal_id,article_type,status,report,error,figure_paths,marketing_consent,consent_version,consent_scope,created_at,updated_at',
    )
    .gte('created_at', startIso)
    .lt('created_at', endIso)
    .order('created_at', { ascending: true })
  const jobs: JobRow[] = Array.isArray(jobsRaw) ? jobsRaw : []

  // ---- Emails seen before the window (new vs returning) --------------------
  // Fetches the historical email column, not whole rows. Fine at current
  // volume (low hundreds). If the Studio ever passes ~10k jobs, replace with a
  // SQL `select distinct email ... where created_at < $1` view rather than
  // raising the limit.
  const { data: priorRaw } = await admin
    .from('formatting_jobs')
    .select('email')
    .lt('created_at', startIso)
    .limit(20000)
  const priorEmails = new Set<string>(
    (Array.isArray(priorRaw) ? priorRaw : [])
      .map((r: { email: string | null }) => (r.email ?? '').toLowerCase().trim())
      .filter(Boolean),
  )

  const emailsToday = new Set(
    jobs.map((j) => (j.email ?? '').toLowerCase().trim()).filter(Boolean),
  )
  let newEmails = 0
  emailsToday.forEach((e) => {
    if (!priorEmails.has(e)) newEmails++
  })

  // ---- Finder ---------------------------------------------------------------
  const { count: finderCount } = await admin
    .from('finder_queries')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', startIso)
    .lt('created_at', endIso)

  // ---- All-time counters ----------------------------------------------------
  const { count: cumulativeJobs } = await admin
    .from('formatting_jobs')
    .select('id', { count: 'exact', head: true })
  const { count: cumulativeCompleted } = await admin
    .from('formatting_jobs')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'complete')

  const marketingContacts = await countMarketingContacts(admin)

  // ---- Survey responses inside the window -----------------------------------
  // A bounded fetch of the values rather than a head:true count, because the
  // mean needs the scores anyway and one query beats a count plus an average.
  // A single local day of survey traffic is tens of rows at the very most.
  const { data: surveysTodayRaw } = await admin
    .from('studio_survey_responses')
    .select('usefulness')
    .gte('created_at', startIso)
    .lt('created_at', endIso)
    .limit(ALL_TIME_ROW_LIMIT)
  const surveysToday: Array<{ usefulness: number | null }> = Array.isArray(surveysTodayRaw)
    ? surveysTodayRaw
    : []

  // ---- Allowances restored inside the window --------------------------------
  // head:true, because nothing here needs the rows. Counted off quota_reset_at
  // rather than off studio_survey_responses.granted_reset: advancing that
  // timestamp is physically what a reset IS (migration 031 section 2), it is
  // capped at one per address, and it cannot double-count a retried survey
  // submission the way a response row can.
  const { count: resetsGrantedCount } = await admin
    .from('studio_email_quota')
    .select('email', { count: 'exact', head: true })
    .gte('quota_reset_at', startIso)
    .lt('quota_reset_at', endIso)

  // ---- Survey totals --------------------------------------------------------
  // head:true for the count so the total stays honest even if the value fetch
  // below ever clips against its limit -- the same split the job counters use.
  const { count: cumulativeSurveysCount } = await admin
    .from('studio_survey_responses')
    .select('id', { count: 'exact', head: true })
  const { count: cumulativeResetsCount } = await admin
    .from('studio_email_quota')
    .select('email', { count: 'exact', head: true })
    .gt('reset_count', 0)

  // The two answers we aggregate over the whole corpus. Projecting the one
  // jsonb key we need instead of selecting `responses` wholesale keeps the free
  // text out of this process entirely: the brief has no business carrying it,
  // and the standing rule at the top of this file is easier to keep when the
  // data never arrives in the first place.
  const { data: allSurveysRaw } = await admin
    .from('studio_survey_responses')
    .select(`usefulness,problems:responses->${SURVEY_PROBLEMS_QUESTION_ID}`)
    .limit(ALL_TIME_ROW_LIMIT)
  const allSurveys: Array<{ usefulness: number | null; problems: unknown }> = Array.isArray(
    allSurveysRaw,
  )
    ? allSurveysRaw
    : []

  // ---- Allowance state ------------------------------------------------------
  // studio_email_quota is SPARSE by design (migration 031 section 2): a row
  // exists only once something non-default has happened to an address. So this
  // is bounded by "people who reset or surveyed", not by "people who used the
  // Studio", and stays small for the whole free period.
  const { data: quotaRowsRaw } = await admin
    .from('studio_email_quota')
    .select('email,quota_reset_at,reset_count,survey_completed_at')
    .limit(ALL_TIME_ROW_LIMIT)

  // Every completed run ever, two columns, counted in JS. Same shape and the
  // same reasoning as the priorEmails fetch above, and the same escape hatch if
  // the Studio ever outgrows it: a SQL view, not a bigger limit.
  //
  // NOT filtered by kind, on purpose. The allowance is explicitly shared across
  // the formatter and the Finder assessment (lib/studio/quota.ts), so counting
  // it per-tool would answer a question nobody is asking.
  const { data: completedEverRaw } = await admin
    .from('formatting_jobs')
    .select('email,created_at')
    .eq('status', 'complete')
    .order('created_at', { ascending: true })
    .limit(ALL_TIME_ROW_LIMIT)

  const allowance = summariseAllowance({
    completedEver: Array.isArray(completedEverRaw) ? completedEverRaw : [],
    quotaRows: Array.isArray(quotaRowsRaw) ? quotaRowsRaw : [],
    windowStartMs: Date.parse(startIso),
    windowEndMs: Date.parse(endIso),
  })

  // ---- Prior snapshot (for the balance delta + cumulative cost carry) -------
  const { data: prevSnap } = await admin
    .from('studio_daily_metrics')
    .select('day,metrics,deepseek_balance_usd')
    .lt('day', day)
    .order('day', { ascending: false })
    .limit(1)
    .maybeSingle()

  // ---- Roll up the window ---------------------------------------------------
  // Formatter and assessment rows are split here and only the DEMAND figures
  // use the split. Everything else stays whole-Studio; see the header note.
  const finderAssessRows = jobs.filter(isFinderAssess)
  const formatterRows = jobs.filter((j) => !isFinderAssess(j))

  const completed = jobs.filter((j) => j.status === 'complete')
  const failed = jobs.filter((j) => j.status === 'failed')
  const unfinished = jobs.filter((j) => j.status !== 'complete' && j.status !== 'failed')

  let tokens = 0
  let usd = 0
  for (const j of jobs) {
    const c = costOf(j.report)
    tokens += c.tokens
    usd += c.usd
  }

  const durations = completed
    .map((j) => {
      if (!j.updated_at) return null
      const secs = (Date.parse(j.updated_at) - Date.parse(j.created_at)) / 1000
      return Number.isFinite(secs) && secs >= 0 ? Math.round(secs) : null
    })
    .filter((n): n is number => n !== null)

  const figures = jobs.reduce(
    (sum, j) => sum + (Array.isArray(j.figure_paths) ? j.figure_paths.length : 0),
    0,
  )

  // Formatter rows only: an assessment's journal_id is the documented sentinel,
  // not a target journal, and journalAbbrev() has no idea that is what it is.
  const journalTop = topOf(formatterRows.map((j) => j.journal_id))
  // Article type IS real on an assessment row (the author picks one), so this
  // one legitimately spans both kinds.
  const typeTop = topOf(jobs.map((j) => j.article_type))
  const problemTop = topOf(
    allSurveys.flatMap((r) => problemsOf(r)).filter((o) => o !== SURVEY_NO_PROBLEM_OPTION),
  )
  const failTop = topOf(failed.map(failureReasonOf))

  const prevMetrics = (prevSnap?.metrics ?? null) as StudioDailyMetrics | null
  const prevBalance =
    typeof prevSnap?.deepseek_balance_usd === 'number'
      ? prevSnap.deepseek_balance_usd
      : prevSnap?.deepseek_balance_usd != null
        ? Number(prevSnap.deepseek_balance_usd)
        : null

  const cumulativeCostUsdEst = round(
    (prevMetrics?.cumulativeCostUsdEst ?? 0) + usd,
    4,
  )

  return {
    day,
    timezone: timeZone,
    windowStartIso: startIso,
    windowEndIso: endIso,

    jobsStarted: jobs.length,
    jobsCompleted: completed.length,
    jobsFailed: failed.length,
    jobsUnfinished: unfinished.length,
    completionRatePct: jobs.length ? round((completed.length / jobs.length) * 100, 1) : null,
    finderAssessJobs: finderAssessRows.length,

    uniqueEmails: emailsToday.size,
    newEmails,
    returningEmails: emailsToday.size - newEmails,
    consentingJobs: jobs.filter((j) => j.marketing_consent === true).length,

    finderQueries: typeof finderCount === 'number' ? finderCount : 0,
    topJournal: journalTop.key ? journalAbbrev(journalTop.key) : null,
    topJournalCount: journalTop.count,
    distinctJournals: new Set(formatterRows.map((j) => j.journal_id).filter(Boolean)).size,
    topArticleType: typeTop.key,
    figuresUploaded: figures,

    medianCompletionSeconds: median(durations),
    topFailureReason: failTop.key,

    deepseekTokens: tokens,
    deepseekCostUsdEst: round(usd, 4),
    costPerCompletedJobUsd: completed.length ? round(usd / completed.length, 4) : null,

    balanceUsd: balance.usd,
    balanceCny: balance.cny,
    // Balance FELL by this much since the last snapshot -> actual spend. A
    // top-up makes this negative, which is correct and self-explaining.
    balanceDeltaUsd:
      balance.usd !== null && prevBalance !== null ? round(prevBalance - balance.usd, 4) : null,
    balanceError: balance.ok ? null : (balance.error ?? 'unknown'),

    surveysCompleted: surveysToday.length,
    resetsGranted: typeof resetsGrantedCount === 'number' ? resetsGrantedCount : 0,
    emailsExhaustedApprox: allowance.exhaustedInWindow,
    meanUsefulness: mean(usefulnessScores(surveysToday), 2),

    cumulativeJobs: typeof cumulativeJobs === 'number' ? cumulativeJobs : jobs.length,
    cumulativeCompleted: typeof cumulativeCompleted === 'number' ? cumulativeCompleted : 0,
    cumulativeCostUsdEst,
    cumulativeMarketingContacts: marketingContacts,

    cumulativeSurveys:
      typeof cumulativeSurveysCount === 'number' ? cumulativeSurveysCount : allSurveys.length,
    cumulativeResetsGranted: typeof cumulativeResetsCount === 'number' ? cumulativeResetsCount : 0,
    cumulativeEmailsExhausted: allowance.exhaustedEver,
    cumulativeMeanUsefulness: mean(usefulnessScores(allSurveys), 2),
    surveyConversionPct: allowance.exhaustedEver
      ? round((allowance.exhaustedEverSurveyed / allowance.exhaustedEver) * 100, 1)
      : null,
    topSurveyProblem: problemTop.key,
    topSurveyProblemCount: problemTop.count,
  }
}

/* ------------------------------------------------------------------ */
/*  Allowance derivation                                               */
/* ------------------------------------------------------------------ */

interface QuotaRowLite {
  email: string | null
  quota_reset_at: string | null
  reset_count: number | null
  survey_completed_at: string | null
}

interface AllowanceSummary {
  /** Addresses whose Nth completed run (N = STUDIO_FREE_RUNS) landed in the day. */
  exhaustedInWindow: number
  /** Addresses that have hit the wall at least once, ever. */
  exhaustedEver: number
  /** Of those, how many completed the survey. Numerator of the conversion rate. */
  exhaustedEverSurveyed: number
}

/**
 * Fold the two all-time fetches into the allowance numbers, in one pass.
 *
 * Pulled out of computeStudioDailyMetrics as a pure function on purpose: it is
 * the only genuinely non-obvious arithmetic in this file, and it is the piece
 * most likely to need a test the day someone disputes a number in the brief.
 *
 * The counting mirrors lib/studio/quota.ts countUsage rather than reimplementing
 * it: consumption is COMPLETED runs since the address's epoch, where a null
 * epoch means the beginning of time. The one thing it does not mirror is the
 * in-flight grace window, which is a live-lockout concern and not a historical
 * fact -- see the note on emailsExhaustedApprox.
 */
export function summariseAllowance(input: {
  completedEver: Array<{ email: string | null; created_at: string }>
  quotaRows: QuotaRowLite[]
  windowStartMs: number
  windowEndMs: number
}): AllowanceSummary {
  const { completedEver, quotaRows, windowStartMs, windowEndMs } = input

  const norm = (e: string | null | undefined) => (e ?? '').toLowerCase().trim()

  // Completed-run timestamps per address. The query ordered ascending, so each
  // array is already in the order the runs were charged.
  const runsByEmail = new Map<string, number[]>()
  for (const r of completedEver) {
    const email = norm(r.email)
    if (!email) continue
    const t = Date.parse(r.created_at)
    if (!Number.isFinite(t)) continue
    const bucket = runsByEmail.get(email)
    if (bucket) bucket.push(t)
    else runsByEmail.set(email, [t])
  }

  const quotaByEmail = new Map<string, QuotaRowLite>()
  for (const q of quotaRows) {
    const email = norm(q.email)
    if (email) quotaByEmail.set(email, q)
  }

  let exhaustedInWindow = 0
  let exhaustedEver = 0
  let exhaustedEverSurveyed = 0

  // Union of both sides. A quota row can exist for an address with no completed
  // runs at all (someone who filled in the survey early), and that address still
  // has to be considered: reset_count is what proves it hit the wall.
  // Array.from rather than a spread of the key iterators: this repo sets no
  // `target` in tsconfig, so an iterator spread would be the one thing in it
  // needing --downlevelIteration.
  const emails = new Set<string>(Array.from(runsByEmail.keys()))
  quotaByEmail.forEach((_row, email) => emails.add(email))

  emails.forEach((email) => {
    const q = quotaByEmail.get(email)
    const epochParsed = q?.quota_reset_at ? Date.parse(q.quota_reset_at) : NaN
    // An unparseable epoch degrades to "count from the beginning of time",
    // which is the same thing a null means, and never to "count nothing".
    const epochMs = Number.isFinite(epochParsed) ? epochParsed : -Infinity

    const charged = (runsByEmail.get(email) ?? []).filter((t) => t >= epochMs)
    const resetCount = typeof q?.reset_count === 'number' ? q.reset_count : 0

    if (charged.length >= STUDIO_FREE_RUNS || resetCount >= STUDIO_MAX_RESETS) {
      exhaustedEver++
      if (q?.survey_completed_at) exhaustedEverSurveyed++
    }

    // The run that took them over is the STUDIO_FREE_RUNS-th one in the current
    // epoch. If it was created inside the window, the wall went up on this day.
    if (charged.length >= STUDIO_FREE_RUNS) {
      const wallMs = charged[STUDIO_FREE_RUNS - 1]
      if (wallMs >= windowStartMs && wallMs < windowEndMs) exhaustedInWindow++
    }
  })

  return { exhaustedInWindow, exhaustedEver, exhaustedEverSurveyed }
}

/* ------------------------------------------------------------------ */
/*  Marketing list                                                     */
/* ------------------------------------------------------------------ */

/**
 * Every address that affirmatively consented, deduplicated, newest activity
 * last. Rows predating migration 029 have marketing_consent = false and are
 * excluded by construction: they were collected under the previous on-page
 * promise that the address would be used only to prevent abuse, and adding
 * them retroactively would be using an address against the terms it was given
 * under. That exclusion is deliberate. Do not "fix" it with a backfill.
 *
 * `source` is derived per contact rather than stamped as a constant. It used to
 * read "Submission Studio (Formatter)" for everybody, which mislabelled every
 * Journal Finder user in the list -- and the source column exists precisely so
 * that whoever writes the email knows what the person actually did. An address
 * that used both tools carries both labels.
 */
export async function buildMarketingList(admin: Admin): Promise<MarketingContact[]> {
  const { data } = await admin
    .from('formatting_jobs')
    .select('email,kind,journal_id,article_type,consent_version,consent_scope,created_at')
    .eq('marketing_consent', true)
    .order('created_at', { ascending: true })
    .limit(ALL_TIME_ROW_LIMIT)

  const rows: Array<{
    email: string | null
    kind: string | null
    journal_id: string | null
    article_type: string | null
    consent_version: string | null
    consent_scope: string | null
    created_at: string
  }> = Array.isArray(data) ? data : []

  // The sentinel is not a journal, so it must not land in the journals column
  // either: the same leak that put 'FINDER_ASSESS' in the brief's top-journal
  // line would otherwise put it in a mail merge, which is worse.
  const journalOf = (r: { kind: string | null; journal_id: string | null }): string | null =>
    !r.journal_id || isFinderAssess(r) ? null : journalAbbrev(r.journal_id)

  const sourceOf = (r: { kind: string | null; journal_id: string | null }): string =>
    isFinderAssess(r) ? SOURCE_FINDER : SOURCE_FORMATTER

  const byEmail = new Map<
    string,
    MarketingContact & { journalSet: Set<string>; sourceSet: Set<string> }
  >()
  for (const r of rows) {
    const email = (r.email ?? '').toLowerCase().trim()
    if (!email) continue
    const journal = journalOf(r)
    const existing = byEmail.get(email)
    if (existing) {
      existing.lastSeenIso = r.created_at
      existing.jobs += 1
      if (journal) existing.journalSet.add(journal)
      existing.sourceSet.add(sourceOf(r))
      if (r.article_type) existing.lastArticleType = r.article_type
      if (r.consent_version) existing.consentVersion = r.consent_version
      if (r.consent_scope) existing.consentScope = r.consent_scope
    } else {
      byEmail.set(email, {
        email,
        firstSeenIso: r.created_at,
        lastSeenIso: r.created_at,
        jobs: 1,
        journals: '',
        lastArticleType: r.article_type ?? '',
        consentVersion: r.consent_version ?? '',
        consentScope: r.consent_scope ?? '',
        source: '',
        journalSet: new Set(journal ? [journal] : []),
        sourceSet: new Set([sourceOf(r)]),
      })
    }
  }

  return Array.from(byEmail.values())
    .sort((a, b) => a.lastSeenIso.localeCompare(b.lastSeenIso))
    .map(({ journalSet, sourceSet, ...c }) => ({
      ...c,
      journals: Array.from(journalSet).join(', '),
      // Sorted so a both-tools contact reads the same way on every run; the
      // sheet is diffed by eye and a flapping cell reads as a data change.
      source: Array.from(sourceSet).sort().join(', '),
    }))
}

async function countMarketingContacts(admin: Admin): Promise<number> {
  const list = await buildMarketingList(admin)
  return list.length
}
