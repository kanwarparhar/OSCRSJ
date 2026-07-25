// Submission Studio metrics — the parts that are pure and therefore worth
// pinning: local-day arithmetic (which decides what "yesterday" means and is
// the one place a DST boundary can silently shift a whole day's numbers) and
// the morning brief's flag logic.

import { test } from 'node:test'
import assert from 'node:assert'
import {
  localDay,
  localDayRange,
  previousLocalDay,
  yesterdayLocal,
  STUDIO_TZ,
  type StudioDailyMetrics,
} from '../lib/studio/metrics'
import {
  getStudioDailyBriefSubject,
  studioFlags,
} from '../lib/email/templates/studioDailyBrief'
import { CONSENT_VERSION, CONSENT_SCOPE, currentConsentRecord } from '../lib/studio/consent'

/* ---------------- local-day arithmetic ---------------- */

test('localDayRange spans a full PDT day in UTC', () => {
  const { startIso, endIso } = localDayRange('2026-07-24', STUDIO_TZ)
  // PDT is UTC-7, so the local day starts at 07:00Z and ends at 07:00Z next day.
  assert.equal(startIso, '2026-07-24T07:00:00.000Z')
  assert.equal(endIso, '2026-07-25T07:00:00.000Z')
  assert.equal(Date.parse(endIso) - Date.parse(startIso), 24 * 60 * 60 * 1000)
})

test('localDayRange spans a full PST day in UTC', () => {
  const { startIso, endIso } = localDayRange('2026-01-15', STUDIO_TZ)
  // PST is UTC-8.
  assert.equal(startIso, '2026-01-15T08:00:00.000Z')
  assert.equal(endIso, '2026-01-16T08:00:00.000Z')
})

test('localDayRange handles the spring-forward day (23 hours long)', () => {
  // 2026-03-08 is the US DST transition: the local day is 23 hours.
  const { startIso, endIso } = localDayRange('2026-03-08', STUDIO_TZ)
  assert.equal(startIso, '2026-03-08T08:00:00.000Z')
  assert.equal(endIso, '2026-03-09T07:00:00.000Z')
  assert.equal(Date.parse(endIso) - Date.parse(startIso), 23 * 60 * 60 * 1000)
})

test('localDayRange handles the fall-back day (25 hours long)', () => {
  const { startIso, endIso } = localDayRange('2026-11-01', STUDIO_TZ)
  assert.equal(Date.parse(endIso) - Date.parse(startIso), 25 * 60 * 60 * 1000)
})

test('localDay maps a UTC instant onto the right local date', () => {
  // 06:30Z on the 25th is still 23:30 on the 24th in Los Angeles. Getting this
  // wrong would file a late-night job under the wrong day.
  assert.equal(localDay(new Date('2026-07-25T06:30:00Z'), STUDIO_TZ), '2026-07-24')
  assert.equal(localDay(new Date('2026-07-25T07:30:00Z'), STUDIO_TZ), '2026-07-25')
})

test('previousLocalDay crosses month and year boundaries', () => {
  assert.equal(previousLocalDay('2026-07-01'), '2026-06-30')
  assert.equal(previousLocalDay('2026-01-01'), '2025-12-31')
  assert.equal(previousLocalDay('2026-03-01'), '2026-02-28')
})

test('yesterdayLocal at the 13:00 UTC cron tick returns the completed local day', () => {
  // The cron fires 13:00 UTC = 06:00 PDT, so "yesterday" must be the day that
  // just finished, not the one two days back.
  assert.equal(yesterdayLocal(new Date('2026-07-25T13:00:00Z'), STUDIO_TZ), '2026-07-24')
})

/* ---------------- consent record ---------------- */

test('consent record stamps the current version and scope', () => {
  const r = currentConsentRecord(new Date('2026-07-25T10:00:00Z'))
  assert.equal(r.marketing_consent, true)
  assert.equal(r.consent_version, CONSENT_VERSION)
  assert.equal(r.consent_scope, CONSENT_SCOPE)
  assert.equal(r.consent_at, '2026-07-25T10:00:00.000Z')
})

/* ---------------- brief ---------------- */

const base = (over: Partial<StudioDailyMetrics> = {}): StudioDailyMetrics => ({
  day: '2026-07-24',
  timezone: STUDIO_TZ,
  windowStartIso: '2026-07-24T07:00:00.000Z',
  windowEndIso: '2026-07-25T07:00:00.000Z',
  jobsStarted: 0,
  jobsCompleted: 0,
  jobsFailed: 0,
  jobsUnfinished: 0,
  completionRatePct: null,
  uniqueEmails: 0,
  newEmails: 0,
  returningEmails: 0,
  consentingJobs: 0,
  finderQueries: 0,
  topJournal: null,
  topJournalCount: 0,
  distinctJournals: 0,
  topArticleType: null,
  figuresUploaded: 0,
  medianCompletionSeconds: null,
  topFailureReason: null,
  deepseekTokens: 0,
  deepseekCostUsdEst: 0,
  costPerCompletedJobUsd: null,
  balanceUsd: null,
  balanceCny: null,
  balanceDeltaUsd: null,
  balanceError: null,
  cumulativeJobs: 0,
  cumulativeCompleted: 0,
  cumulativeCostUsdEst: 0,
  cumulativeMarketingContacts: 0,
  ...over,
})

test('a quiet day still produces a subject, and says so', () => {
  const s = getStudioDailyBriefSubject(base())
  assert.match(s, /no activity/)
})

test('subject summarises jobs, signups and finder use', () => {
  const s = getStudioDailyBriefSubject(
    base({ jobsStarted: 4, newEmails: 2, finderQueries: 6, deepseekCostUsdEst: 0.012 }),
  )
  assert.match(s, /4 jobs/)
  assert.match(s, /2 new signups/)
  assert.match(s, /6 finder/)
})

test('low completion rate is flagged, but not on a tiny sample', () => {
  const noisy = studioFlags(base({ jobsStarted: 6, jobsCompleted: 3, completionRatePct: 50 }))
  assert.ok(noisy.some((f) => /Completion rate/.test(f)))

  // One failure out of two is not evidence of a systematic problem.
  const quiet = studioFlags(base({ jobsStarted: 2, jobsCompleted: 1, completionRatePct: 50 }))
  assert.ok(!quiet.some((f) => /Completion rate/.test(f)))
})

test('a low DeepSeek balance is flagged before it hits zero', () => {
  assert.ok(studioFlags(base({ balanceUsd: 3.2 })).some((f) => /balance is down/.test(f)))
  assert.ok(!studioFlags(base({ balanceUsd: 40 })).some((f) => /balance is down/.test(f)))
})

test('actual spend far above accounted spend is flagged as rate drift or outside use', () => {
  const flags = studioFlags(base({ deepseekCostUsdEst: 0.05, balanceDeltaUsd: 0.9 }))
  assert.ok(flags.some((f) => /well above what the Studio accounted for/.test(f)))
})

test('small absolute divergence is not flagged as drift', () => {
  // 3x on fractions of a cent is rounding, not a signal worth an alert.
  const flags = studioFlags(base({ deepseekCostUsdEst: 0.004, balanceDeltaUsd: 0.02 }))
  assert.ok(!flags.some((f) => /well above/.test(f)))
})

test('returning users are surfaced, because they are the number that matters', () => {
  assert.ok(studioFlags(base({ returningEmails: 2 })).some((f) => /returning user/.test(f)))
})

test('an unreadable balance is disclosed rather than silently reported as zero', () => {
  const flags = studioFlags(base({ balanceError: 'status_401' }))
  assert.ok(flags.some((f) => /Could not read the DeepSeek balance/.test(f)))
})
