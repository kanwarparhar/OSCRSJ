// ============================================================
// Submission Studio -- allowance constants (CLIENT-SAFE)
// ============================================================
// Split out of lib/studio/quota.ts on purpose, and the reason is not style.
//
// quota.ts imports createAdminClient from @/lib/supabase/server, which reaches
// SUPABASE_SERVICE_ROLE_KEY and pulls next/headers. Two things go wrong if a
// client component imports the numbers from there:
//
//   1. The service-role client ends up in the browser bundle's import graph.
//      Next.js will usually error on this rather than ship the key, but
//      "usually" is not the standard you want between a service-role key and
//      the public internet.
//   2. A server component that only wants to render "3 free runs" gets
//      next/headers pulled in and silently opts out of static rendering.
//
// So: every value here is a plain constant or a pure function with no imports.
// This module must NEVER import anything that touches the database, the
// filesystem, or next/headers. quota.ts re-exports all of it, so server code
// can keep importing from quota.ts and nothing had to be renamed.
// ============================================================

/** Completed Studio runs included in the free allowance, per email, per window. */
export const STUDIO_FREE_RUNS = 3

/**
 * The journal whose runs are free, matching `identity.slug` in
 * lib/formatting/journals/oscrsj.json.
 *
 * A literal rather than an import from the rule file, because this module must
 * stay import-free to remain client-safe. tests/studio-quota-oscrsj.test.ts
 * reads the rule file and asserts the two still agree, so the duplication cannot
 * drift into an exemption that silently stops applying.
 */
export const OSCRSJ_SLUG = 'oscrsj'

/**
 * True when a run targets OSCRSJ and is therefore free.
 *
 * OSCRSJ submissions are free by directive (2026-07-26) -- they never touch the
 * allowance, before or after the paid transition. We are the journal; charging
 * an author a run for preparing a manuscript to submit to us would be charging
 * them for our own intake, which is both mean and self-defeating.
 *
 * It lives in this module, not in quota.ts, because the journal picker makes the
 * same judgement in the browser and quota.ts reaches the service-role client.
 *
 * NOTE ON THE FINDER. A Finder assessment cannot be exempt, because it has no
 * target journal to be exempt for -- app/api/finder/assess/route.ts writes the
 * documented sentinel 'finder_assess' into journal_id precisely because a ladder
 * across 75 journals has no target. So this is a formatter-run exemption in
 * practice. That is honest rather than incomplete: there is no such thing as a
 * Finder run "targeting OSCRSJ", and inventing one would mean fabricating a
 * target the author never chose.
 */
export function isFreeJournalRun(slug: string | null | undefined): boolean {
  return slug === OSCRSJ_SLUG
}

/**
 * The allowance window, in days (Kanwar directive, 2026-07-26).
 *
 * This is a ROLLING window, not a calendar week. Runs age out individually
 * seven days after they happened, rather than everyone's allowance refilling
 * at midnight on a Monday.
 *
 * Rolling was the right call for two reasons. A calendar reset creates a
 * thundering herd at the boundary, which for us means a spike of concurrent
 * DeepSeek calls at exactly the same minute every week. And it is unfair in a
 * way users notice: someone who first finds the Studio on a Sunday gets a few
 * hours of allowance before it resets, while someone who arrives Monday gets a
 * full week. Rolling gives everyone the same deal whenever they show up.
 */
export const STUDIO_QUOTA_WINDOW_DAYS = 7

/** Human-facing name for the window. Keep in step with the constant above. */
export const STUDIO_QUOTA_WINDOW_LABEL = 'week'

/** How many times an allowance can be bought back with feedback. Hard cap. */
export const STUDIO_MAX_RESETS = 1

/**
 * How long an unfinished job holds a slot before it stops counting.
 * The slowest observed honest run is a large manuscript with figures at a few
 * minutes; 90 minutes is ~20x that. Sized for "generous to the confused user",
 * not for "tight against the adversary".
 */
export const IN_FLIGHT_GRACE_MINUTES = 90

/**
 * Addresses that bypass the allowance entirely: unlimited runs, nothing
 * counted, no survey gate, no terms gate.
 *
 * Hardcoded rather than env-only, and deliberately so: this list needs to be
 * readable by the CLIENT so the form can say "admin address, no limit" instead
 * of silently behaving differently from what the UI promises. That is safe
 * because knowing an address is an admin grants nothing. The bypass is applied
 * server-side in lib/studio/quota.ts, which is the only place it is load
 * bearing; the client copy is cosmetic.
 *
 * STUDIO_ADMIN_EMAILS (comma-separated) extends this at runtime, server-side
 * only, so a new admin does not need a deploy.
 */
export const STUDIO_ADMIN_EMAILS: readonly string[] = ['kanwarpartap@live.com']

/**
 * The Studio is free until this instant, after which it becomes paid.
 * Stored as an explicit UTC instant rather than a bare date so that "September
 * 1st" means one unambiguous moment: 2026-09-01T00:00:00 America/Los_Angeles,
 * which is 07:00Z (PDT, UTC-7). A bare 'YYYY-MM-DD' compared against a
 * timestamptz silently means UTC midnight and would cut the free period seven
 * hours short for the people most likely to be using it late at night.
 */
export const STUDIO_FREE_UNTIL_ISO = '2026-09-01T07:00:00.000Z'

/** Human-facing rendering of the same instant. Keep these two in step. */
export const STUDIO_FREE_UNTIL_LABEL = 'September 1, 2026'

export function studioIsFree(now: Date = new Date()): boolean {
  return now.getTime() < Date.parse(STUDIO_FREE_UNTIL_ISO)
}

/** Whole days from `now` until the free period ends. Negative once it has. */
export function daysUntilPaid(now: Date = new Date()): number {
  const ms = Date.parse(STUDIO_FREE_UNTIL_ISO) - now.getTime()
  return Math.ceil(ms / (24 * 60 * 60 * 1000))
}

/**
 * Canonical email normalisation. Every quota read and write goes through this,
 * so it lives beside the constants rather than in the server module: the client
 * needs the same function to key its local "runs remaining" cache, and two
 * implementations of "lowercase and trim" is exactly the kind of thing that
 * drifts into a user seeing 2 runs left and the server saying 0.
 *
 * Note what this deliberately does NOT do: it does not strip plus-addressing
 * or dots, and it does not canonicalise gmail-style aliases. Kanwar directive,
 * 2026-07-26: a user who wants another allowance is welcome to use another
 * address, because a second address is a second contact and that is a trade we
 * are happy to make. Do not "fix" this into alias collapsing.
 */
export function normalizeEmail(email: string): string {
  return email.toLowerCase().trim()
}

export function isAdminEmail(email: string, extra: readonly string[] = []): boolean {
  const e = normalizeEmail(email)
  return (
    STUDIO_ADMIN_EMAILS.some((a) => normalizeEmail(a) === e) ||
    extra.some((a) => normalizeEmail(a) === e)
  )
}

/** Shape returned by GET /api/studio/quota. Shared by the route and the UI. */
export interface QuotaStatusPayload {
  email: string
  used: number
  limit: number
  remaining: number
  locked: boolean
  canUnlockWithSurvey: boolean
  /**
   * Locked only because jobs are still inside the in-flight grace window.
   * Nothing has been spent. The UI must NOT show the survey unlock here: doing
   * so would spend the user's one reset to clear a condition that clears
   * itself, and because a reset advances the counting epoch it would even look
   * like it had worked.
   */
  lockedByInFlightOnly: boolean
  /** True when this address bypasses the allowance entirely. */
  isAdmin: boolean
  /**
   * When the next slot frees up on its own, ISO, or null when nothing is
   * pending. This is what makes a weekly allowance humane: "you are out" is a
   * wall, "one run frees up on Thursday" is a schedule.
   */
  nextRunAvailableAt: string | null
  windowDays: number
  resetCount: number
  surveyCompletedAt: string | null
  completedRuns: number
  inFlightRuns: number
}
