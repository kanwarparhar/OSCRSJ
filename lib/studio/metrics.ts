// ============================================================
// Submission Studio -- daily usage metrics
// ============================================================
// Computes one snapshot per LOCAL day (America/Los_Angeles, so "yesterday"
// means what Kanwar means by yesterday, not a UTC calendar day) from
// formatting_jobs + finder_queries, and builds the deduplicated marketing
// list. Read-only against the DB apart from the snapshot upsert, which the
// caller performs.
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
//
// Deliberately NOT tracked: anything from the manuscript itself. The metrics
// touch job envelope data only (journal, type, counts, timings). Nothing in
// this file reads the author's text, and it should stay that way.
// ============================================================

import { journalAbbrev } from '@/lib/formatting/registry-meta'
import type { DeepSeekBalance } from './deepseekBalance'

export const STUDIO_TZ = 'America/Los_Angeles'

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

  jobsStarted: number
  jobsCompleted: number
  jobsFailed: number
  jobsUnfinished: number
  completionRatePct: number | null

  uniqueEmails: number
  newEmails: number
  returningEmails: number
  consentingJobs: number

  finderQueries: number
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

  cumulativeJobs: number
  cumulativeCompleted: number
  cumulativeCostUsdEst: number
  cumulativeMarketingContacts: number
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
  source: string
}

/* eslint-disable @typescript-eslint/no-explicit-any */
type Admin = any

interface JobRow {
  id: string
  email: string | null
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
      'id,email,journal_id,article_type,status,report,error,figure_paths,marketing_consent,consent_version,consent_scope,created_at,updated_at',
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

  // ---- Prior snapshot (for the balance delta + cumulative cost carry) -------
  const { data: prevSnap } = await admin
    .from('studio_daily_metrics')
    .select('day,metrics,deepseek_balance_usd')
    .lt('day', day)
    .order('day', { ascending: false })
    .limit(1)
    .maybeSingle()

  // ---- Roll up the window ---------------------------------------------------
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

  const journalTop = topOf(jobs.map((j) => j.journal_id))
  const typeTop = topOf(jobs.map((j) => j.article_type))
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

    uniqueEmails: emailsToday.size,
    newEmails,
    returningEmails: emailsToday.size - newEmails,
    consentingJobs: jobs.filter((j) => j.marketing_consent === true).length,

    finderQueries: typeof finderCount === 'number' ? finderCount : 0,
    topJournal: journalTop.key ? journalAbbrev(journalTop.key) : null,
    topJournalCount: journalTop.count,
    distinctJournals: new Set(jobs.map((j) => j.journal_id).filter(Boolean)).size,
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

    cumulativeJobs: typeof cumulativeJobs === 'number' ? cumulativeJobs : jobs.length,
    cumulativeCompleted: typeof cumulativeCompleted === 'number' ? cumulativeCompleted : 0,
    cumulativeCostUsdEst,
    cumulativeMarketingContacts: marketingContacts,
  }
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
 */
export async function buildMarketingList(admin: Admin): Promise<MarketingContact[]> {
  const { data } = await admin
    .from('formatting_jobs')
    .select('email,journal_id,article_type,consent_version,consent_scope,created_at')
    .eq('marketing_consent', true)
    .order('created_at', { ascending: true })
    .limit(20000)

  const rows: Array<{
    email: string | null
    journal_id: string | null
    article_type: string | null
    consent_version: string | null
    consent_scope: string | null
    created_at: string
  }> = Array.isArray(data) ? data : []

  const byEmail = new Map<string, MarketingContact & { journalSet: Set<string> }>()
  for (const r of rows) {
    const email = (r.email ?? '').toLowerCase().trim()
    if (!email) continue
    const existing = byEmail.get(email)
    if (existing) {
      existing.lastSeenIso = r.created_at
      existing.jobs += 1
      if (r.journal_id) existing.journalSet.add(journalAbbrev(r.journal_id))
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
        source: 'Submission Studio (Formatter)',
        journalSet: new Set(r.journal_id ? [journalAbbrev(r.journal_id)] : []),
      })
    }
  }

  return Array.from(byEmail.values())
    .sort((a, b) => a.lastSeenIso.localeCompare(b.lastSeenIso))
    .map(({ journalSet, ...c }) => ({ ...c, journals: Array.from(journalSet).join(', ') }))
}

async function countMarketingContacts(admin: Admin): Promise<number> {
  const list = await buildMarketingList(admin)
  return list.length
}
