// ============================================================
// Submission Studio -- free-run allowance (single source of truth)
// ============================================================
// Kanwar directive, 2026-07-26 (revised same day from lifetime to weekly).
// During the free period every email address gets THREE completed runs per
// ROLLING WEEK, shared across the formatter and the Finder assessment. When
// they are gone the address waits for the oldest run to age out, OR completes
// the feedback survey, which refills the allowance immediately, once ever.
//
// The rules that make this defensible, in the order they get argued about:
//
//   1. WE CHARGE FOR COMPLETED RUNS, NOT ATTEMPTS. If our pipeline drops a job,
//      that job is free. Charging users for our own defects is both unfair and
//      self-defeating: the whole point of the free period is to collect failure
//      data, and a user who lost a third of their allowance to a crash does not
//      file a bug report, they close the tab.
//
//   2. IN-FLIGHT WORK HOLDS A SLOT, BUT ONLY BRIEFLY. Rule 1 read literally
//      says "start a hundred jobs, finish none, pay nothing" -- so a job that is
//      neither complete nor failed occupies a slot for IN_FLIGHT_GRACE_MINUTES
//      and then stops counting.
//
//   3. USAGE IS DERIVED AT CHECK TIME, NEVER STORED. There is no counter to
//      drift out of sync with reality. A "reset" does not zero a number and does
//      not delete anyone's job history; it advances the timestamp the count runs
//      from. Old jobs stay on the record for metrics and for the marketing list.
//
//   4. THE WINDOW IS ROLLING, NOT CALENDAR. See STUDIO_QUOTA_WINDOW_DAYS in
//      ./quotaConstants for why. The practical consequence here is that the
//      count is always "completed runs since max(reset epoch, now - 7 days)",
//      and the natural unlock is a timestamp we can tell the user about rather
//      than a wall with no visible end.
//
//   5. ADMIN ADDRESSES BYPASS EVERYTHING. Not a large limit, an actual bypass:
//      no counting, no survey gate, no lock. Kanwar needs to be able to test
//      the tool repeatedly without spending a reset or polluting the metrics
//      that decide what we build.
//
// Deliberately NOT implemented: any attempt to collapse plus-addressing or
// gmail dot-aliases into one identity. Kanwar directive: a user who wants
// another allowance is welcome to open another address, because a second
// address is a second contact. The per-IP cap in lib/formatting/pipeline/jobs.ts
// exists only as a runaway-cost circuit breaker, not to police that.
// ============================================================

import { createAdminClient } from '@/lib/supabase/server'
import {
  STUDIO_FREE_RUNS,
  STUDIO_MAX_RESETS,
  STUDIO_QUOTA_WINDOW_DAYS,
  STUDIO_QUOTA_WINDOW_LABEL,
  IN_FLIGHT_GRACE_MINUTES,
  STUDIO_FREE_UNTIL_LABEL,
  normalizeEmail,
  isAdminEmail,
  isFreeJournalRun,
} from './quotaConstants'

// The numbers themselves live in ./quotaConstants (client-safe, zero imports)
// because this module reaches the service-role Supabase client and must never
// end up in a browser bundle. Re-exported here so server-side callers can keep
// importing everything from one place.
export * from './quotaConstants'

type Admin = ReturnType<typeof createAdminClient>

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const jobsTable = (a: Admin) => a.from('formatting_jobs') as any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const quotaTable = (a: Admin) => a.from('studio_email_quota') as any

/** Statuses that mean the pipeline finished the job successfully. */
const CHARGED_STATUS = 'complete'
/** Statuses that mean the job is over and we are NOT charging for it. */
const FREE_TERMINAL_STATUSES = new Set(['failed'])

// OSCRSJ_SLUG and isFreeJournalRun live in ./quotaConstants and arrive here via
// the `export * from './quotaConstants'` above, so server callers keep importing
// everything from this one module. They are defined THERE rather than here
// because the journal picker has to make the same judgement in the browser, and
// a client component that imported it from this file would drag the service-role
// Supabase client into the bundle graph -- the hazard this split exists for.

const WINDOW_MS = STUDIO_QUOTA_WINDOW_DAYS * 24 * 60 * 60 * 1000

/** Extra admin addresses from the environment, server-side only. */
function envAdmins(): string[] {
  return (process.env.STUDIO_ADMIN_EMAILS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

export function isStudioAdmin(email: string): boolean {
  return isAdminEmail(email, envAdmins())
}

export interface QuotaStatus {
  email: string
  /** Slots consumed inside the window: completed runs plus anything in flight. */
  used: number
  /** Always STUDIO_FREE_RUNS today; returned so the UI never hardcodes 3. */
  limit: number
  remaining: number
  /** True when the next run must be refused. */
  locked: boolean
  /**
   * True when completing the survey would refill the allowance now.
   *
   * Keyed on COMPLETED runs, not on `used`. The difference matters: a user
   * whose upload keeps failing can accumulate three in-flight rows and be
   * `locked` with zero completed work. Offering them the survey there would
   * spend their one reset on nothing, and because a reset advances the epoch
   * the stale rows would stop counting and it would look like it had worked.
   */
  canUnlockWithSurvey: boolean
  /** Locked purely by in-flight jobs. Nothing spent; they just need to wait. */
  lockedByInFlightOnly: boolean
  /** Admin bypass in effect: no counting, no gate. */
  isAdmin: boolean
  /** When the oldest counted run ages out, ISO. Null when nothing is counted. */
  nextRunAvailableAt: string | null
  windowDays: number
  resetCount: number
  surveyCompletedAt: string | null
  quotaResetAt: string | null
  completedRuns: number
  inFlightRuns: number
}

interface QuotaRow {
  email: string
  quota_reset_at: string | null
  reset_count: number
  survey_completed_at: string | null
  reset_survey_id: string | null
}

/**
 * Read the sparse quota row, distinguishing "no row" from "could not read".
 *
 * This distinction is the whole point of the function and an earlier version
 * got it wrong by collapsing both into null. If studio_email_quota is
 * unreadable (most likely of all on the deploy where the code ships before the
 * migration runs), a null read means `quota_reset_at` looks null so a user who
 * legitimately holds a reset gets counted from the wrong point, and
 * `reset_count` looks like 0 so the UI invites them to a survey that then
 * refuses to grant anything.
 *
 * So: an error THROWS, and callers turn that into a 503 that says "our
 * problem, try again". A genuinely absent row returns null, which is the
 * normal and meaningful case.
 */
async function readQuotaRow(a: Admin, email: string): Promise<QuotaRow | null> {
  const { data, error } = await quotaTable(a)
    .select('email, quota_reset_at, reset_count, survey_completed_at, reset_survey_id')
    .eq('email', email)
    .maybeSingle()
  if (error) throw new Error('quota_read_failed')
  return (data as QuotaRow) ?? null
}

const LOOKBACK_LIMIT = 500

interface Usage {
  completed: number
  inFlight: number
  /** created_at of every charged run inside the window, oldest first. */
  chargedAt: number[]
}

/**
 * Count slots consumed by this address inside its current window.
 *
 * The window start is the LATER of the reset epoch and (now - 7 days). Taking
 * the later of the two is what makes a reset mean "start fresh now" rather than
 * "look further back than a week", which would be the opposite of the point.
 */
async function countUsage(
  a: Admin,
  email: string,
  epochIso: string | null,
  now: Date,
): Promise<Usage> {
  const rollingStart = now.getTime() - WINDOW_MS
  const epoch = epochIso ? Date.parse(epochIso) : Number.NEGATIVE_INFINITY
  const windowStart = Math.max(rollingStart, epoch)

  const { data, error } = await jobsTable(a)
    .select('status, created_at, journal_id')
    .eq('email', email)
    .gte('created_at', new Date(windowStart).toISOString())
    .order('created_at', { ascending: false })
    .limit(LOOKBACK_LIMIT)
  if (error || !Array.isArray(data)) {
    // Fail CLOSED on a database error rather than handing out free runs: an
    // unreadable quota is not the same as an empty one. The caller surfaces
    // this as a transient error, not as a lockout.
    throw new Error('quota_read_failed')
  }

  const graceCutoff = now.getTime() - IN_FLIGHT_GRACE_MINUTES * 60 * 1000
  let completed = 0
  let inFlight = 0
  const chargedAt: number[] = []
  for (const row of data as Array<{ status: string; created_at: string; journal_id: string | null }>) {
    const t = Date.parse(row.created_at)
    // OSCRSJ runs are invisible to the allowance, in BOTH directions: never
    // charged when they complete, and never holding an in-flight slot while they
    // run. Skipping the row entirely -- the same way a failed job is skipped --
    // is what makes that true without a second code path. Doing it here rather
    // than at the gate means an exemption cannot be half-applied: a run that
    // bypassed the gate would otherwise still be sitting in this count,
    // consuming the allowance it was exempt from.
    if (isFreeJournalRun(row.journal_id)) continue
    if (row.status === CHARGED_STATUS) {
      completed++
      chargedAt.push(t)
      continue
    }
    if (FREE_TERMINAL_STATUSES.has(row.status)) continue
    if (t > graceCutoff) inFlight++
  }
  chargedAt.sort((x, y) => x - y)
  return { completed, inFlight, chargedAt }
}

function adminStatus(email: string): QuotaStatus {
  return {
    email,
    used: 0,
    limit: STUDIO_FREE_RUNS,
    remaining: STUDIO_FREE_RUNS,
    locked: false,
    canUnlockWithSurvey: false,
    lockedByInFlightOnly: false,
    isAdmin: true,
    nextRunAvailableAt: null,
    windowDays: STUDIO_QUOTA_WINDOW_DAYS,
    resetCount: 0,
    surveyCompletedAt: null,
    quotaResetAt: null,
    completedRuns: 0,
    inFlightRuns: 0,
  }
}

export async function getQuotaStatus(
  emailRaw: string,
  now: Date = new Date(),
  adminClient?: Admin,
): Promise<QuotaStatus> {
  const email = normalizeEmail(emailRaw)
  // Short-circuit BEFORE touching the database. An admin run should cost
  // nothing, including a round trip, and should never appear in the counts.
  if (isStudioAdmin(email)) return adminStatus(email)

  const a = adminClient ?? createAdminClient()
  const row = await readQuotaRow(a, email)
  const { completed, inFlight, chargedAt } = await countUsage(
    a,
    email,
    row?.quota_reset_at ?? null,
    now,
  )
  const used = completed + inFlight
  const resetCount = row?.reset_count ?? 0
  const remaining = Math.max(0, STUDIO_FREE_RUNS - used)
  const locked = remaining <= 0
  const spent = completed >= STUDIO_FREE_RUNS

  // The oldest charged run ages out one window after it happened. That is the
  // moment a slot frees itself, and it is worth telling the user: "you are out"
  // is a wall, "one run frees up Thursday morning" is a schedule.
  const nextRunAvailableAt =
    locked && chargedAt.length > 0 ? new Date(chargedAt[0] + WINDOW_MS).toISOString() : null

  return {
    email,
    used,
    limit: STUDIO_FREE_RUNS,
    remaining,
    locked,
    canUnlockWithSurvey: locked && spent && resetCount < STUDIO_MAX_RESETS,
    lockedByInFlightOnly: locked && !spent,
    isAdmin: false,
    nextRunAvailableAt,
    windowDays: STUDIO_QUOTA_WINDOW_DAYS,
    resetCount,
    surveyCompletedAt: row?.survey_completed_at ?? null,
    quotaResetAt: row?.quota_reset_at ?? null,
    completedRuns: completed,
    inFlightRuns: inFlight,
  }
}

// ---------------------------------------------------------------------------
// The gate
// ---------------------------------------------------------------------------

export interface QuotaGateResult {
  ok: boolean
  status?: QuotaStatus
  /** Machine-readable so the client can branch without string matching. */
  code?: 'quota_exhausted' | 'quota_exhausted_final' | 'quota_in_flight' | 'quota_unavailable'
  reason?: string
}

/** "Thursday at 9:14 AM" in Pacific, which is the only timezone we speak in. */
function whenFree(iso: string | null): string {
  if (!iso) return ''
  try {
    const f = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Los_Angeles',
      weekday: 'long',
      hour: 'numeric',
      minute: '2-digit',
    })
    return ` Your next run frees up ${f.format(new Date(iso))} Pacific.`
  } catch {
    return ''
  }
}

function exhaustedMessage(status: QuotaStatus): string {
  if (status.lockedByInFlightOnly) {
    // Nothing is spent here. Saying "you are out of runs" would be false, and
    // pointing them at the survey would cost them their one reset for nothing.
    const n = status.inFlightRuns
    return `You have ${n} job${n === 1 ? '' : 's'} still running on this address. Wait for ${n === 1 ? 'it' : 'them'} to finish and the slot frees up. A job that fails does not count against your runs, and an abandoned one releases on its own within ${IN_FLIGHT_GRACE_MINUTES} minutes.`
  }
  if (status.canUnlockWithSurvey) {
    return `You have used all ${status.limit} of your free Submission Studio runs for this ${STUDIO_QUOTA_WINDOW_LABEL}.${whenFree(status.nextRunAvailableAt)} If you would rather not wait, answer a short feedback survey and your ${status.limit} runs come back now. That works once.`
  }
  return `You have used all ${status.limit} of your free Submission Studio runs for this ${STUDIO_QUOTA_WINDOW_LABEL}, including the refill your survey earned.${whenFree(status.nextRunAvailableAt)} The Studio is free through ${STUDIO_FREE_UNTIL_LABEL} while we finish building it. Thank you for the feedback, it is shaping what we fix next.`
}

function exhaustedCode(
  status: QuotaStatus,
): 'quota_exhausted' | 'quota_exhausted_final' | 'quota_in_flight' {
  if (status.lockedByInFlightOnly) return 'quota_in_flight'
  return status.canUnlockWithSurvey ? 'quota_exhausted' : 'quota_exhausted_final'
}

/**
 * The single choke point for both the formatter and the Finder assessment.
 * Callers translate `code` into a status code: quota_unavailable is a 503
 * (our problem, retryable), the others are 429 (their allowance).
 */
export async function checkStudioQuota(
  emailRaw: string,
  now: Date = new Date(),
  adminClient?: Admin,
): Promise<QuotaGateResult> {
  let status: QuotaStatus
  try {
    status = await getQuotaStatus(emailRaw, now, adminClient)
  } catch {
    return {
      ok: false,
      code: 'quota_unavailable',
      reason: 'We could not check your remaining free runs just now. Please try again in a moment.',
    }
  }
  if (!status.locked) return { ok: true, status }
  return { ok: false, status, code: exhaustedCode(status), reason: exhaustedMessage(status) }
}

// ---------------------------------------------------------------------------
// Granting the reset
// ---------------------------------------------------------------------------

export interface ResetResult {
  granted: boolean
  reason?: string
  status?: QuotaStatus
}

/**
 * Re-read the status without letting a read failure undo work already done.
 *
 * The grant is the thing that matters and it has already committed by the time
 * we want a fresh reading. Letting getQuotaStatus throw here would surface a
 * 500 to a user whose reset DID land, and they would retry and be told their
 * answers were merely "recorded". Losing the echoed balance is cosmetic;
 * losing the grant is not.
 */
async function statusOrUndefined(
  email: string,
  now: Date,
  a: Admin,
): Promise<QuotaStatus | undefined> {
  try {
    return await getQuotaStatus(email, now, a)
  } catch {
    return undefined
  }
}

/** Postgres unique-violation. Anything else is a real fault, not a race. */
function isUniqueViolation(error: unknown): boolean {
  return (error as { code?: string } | null)?.code === '23505'
}

/**
 * Move this address's epoch to now, once.
 *
 * The obvious race here is real: a user who double-submits the survey (double
 * click, retry after a slow response) must not get two resets. The update
 * carries `.lt('reset_count', STUDIO_MAX_RESETS)` so the second writer matches
 * zero rows and is told, truthfully, that the reset was already used.
 */
export async function grantSurveyReset(
  emailRaw: string,
  surveyId: string,
  now: Date = new Date(),
  adminClient?: Admin,
): Promise<ResetResult> {
  const a = adminClient ?? createAdminClient()
  const email = normalizeEmail(emailRaw)
  const nowIso = now.toISOString()

  const existing = await readQuotaRow(a, email)

  if (!existing) {
    const { error } = await quotaTable(a).insert({
      email,
      quota_reset_at: nowIso,
      reset_count: 1,
      survey_completed_at: nowIso,
      reset_survey_id: surveyId,
      first_seen_at: nowIso,
      updated_at: nowIso,
    })
    if (!error) {
      return { granted: true, status: await statusOrUndefined(email, now, a) }
    }
    // A unique violation means a concurrent writer beat us to the row, so the
    // conditional update below is the correct next move. ANY OTHER error is a
    // real fault, and falling through would match zero rows and tell a
    // first-time user they had "already used" a reset they never had.
    if (!isUniqueViolation(error)) {
      return {
        granted: false,
        reason:
          'We saved your answers but could not restore your runs just now. Please try again in a moment, and your allowance will be restored.',
        status: await statusOrUndefined(email, now, a),
      }
    }
  }

  if (existing && existing.reset_count >= STUDIO_MAX_RESETS) {
    return {
      granted: false,
      reason: 'This address has already used its one free-run refill.',
      status: await statusOrUndefined(email, now, a),
    }
  }

  const { data, error } = await quotaTable(a)
    .update({
      quota_reset_at: nowIso,
      reset_count: STUDIO_MAX_RESETS,
      survey_completed_at: nowIso,
      reset_survey_id: surveyId,
      updated_at: nowIso,
    })
    .eq('email', email)
    .lt('reset_count', STUDIO_MAX_RESETS)
    .select('email')

  if (error) {
    return {
      granted: false,
      reason:
        'We saved your answers but could not restore your runs just now. Please try again in a moment, and your allowance will be restored.',
      status: await statusOrUndefined(email, now, a),
    }
  }
  if (!Array.isArray(data) || data.length !== 1) {
    // Zero rows with no error is the honest "already used" case: the predicate
    // reset_count < MAX did not hold, which is the double-submit guard working.
    return {
      granted: false,
      reason: 'This address has already used its one free-run refill.',
      status: await statusOrUndefined(email, now, a),
    }
  }
  return { granted: true, status: await statusOrUndefined(email, now, a) }
}

/**
 * Record that a survey was completed WITHOUT granting a reset -- the path for
 * someone who fills it in while they still have runs left, or who submits a
 * second time. Their feedback is worth exactly as much as anyone else's and is
 * stored on the same terms; only the refill is scarce.
 */
export async function recordSurveyWithoutReset(
  emailRaw: string,
  now: Date = new Date(),
  adminClient?: Admin,
): Promise<void> {
  const a = adminClient ?? createAdminClient()
  const email = normalizeEmail(emailRaw)
  const nowIso = now.toISOString()
  const existing = await readQuotaRow(a, email)
  if (existing) {
    await quotaTable(a)
      .update({ survey_completed_at: existing.survey_completed_at ?? nowIso, updated_at: nowIso })
      .eq('email', email)
    return
  }
  await quotaTable(a).insert({
    email,
    reset_count: 0,
    survey_completed_at: nowIso,
    first_seen_at: nowIso,
    updated_at: nowIso,
  })
}
