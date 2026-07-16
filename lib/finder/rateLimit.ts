// Journal Finder v1 — stateless-request rate limiter (Sushant, Session 2).
//
// The Finder persists nothing (build brief §8.1: "stateless; log a row to
// Sheets"), so unlike the formatter — whose limiter counts rows in the
// formatting_jobs table — there is no DB to count against. A per-IP sliding
// window in process memory is the honest v1: it curbs casual abuse of a free
// beta endpoint without adding a table or a Redis dependency.
//
// CAVEAT (intentional, documented): serverless instances don't share memory, so
// the effective cap is per-warm-instance, not strictly global. That is an
// acceptable abuse-prevention floor for a free beta; tighten to a shared store
// only if abuse actually materialises.

/** Requests allowed per IP per rolling 24h. */
export const FINDER_RATE_LIMIT_PER_IP_PER_DAY = 20

const WINDOW_MS = 24 * 60 * 60 * 1000

/** ip → recent request timestamps (ms). */
const hits = new Map<string, number[]>()

export interface RateLimitResult {
  ok: boolean
  remaining: number
  reason?: string
}

/**
 * Record a request from `ip` and report whether it's within the daily cap.
 * `now` is injectable for tests (defaults to Date.now at call time). A null IP
 * (proxy stripped the header) is allowed through — we can't bucket it, and
 * blocking every headerless request would be worse than the abuse it prevents.
 */
export function checkFinderRateLimit(ip: string | null, now: number = Date.now()): RateLimitResult {
  if (!ip) return { ok: true, remaining: FINDER_RATE_LIMIT_PER_IP_PER_DAY }

  const cutoff = now - WINDOW_MS
  const recent = (hits.get(ip) ?? []).filter((t) => t > cutoff)

  if (recent.length >= FINDER_RATE_LIMIT_PER_IP_PER_DAY) {
    hits.set(ip, recent)
    return {
      ok: false,
      remaining: 0,
      reason: `You've reached the free-beta limit of ${FINDER_RATE_LIMIT_PER_IP_PER_DAY} Journal Finder checks per day. Please try again tomorrow.`,
    }
  }

  recent.push(now)
  hits.set(ip, recent)
  return { ok: true, remaining: FINDER_RATE_LIMIT_PER_IP_PER_DAY - recent.length }
}

/** Test-only: clear the in-memory window. */
export function _resetFinderRateLimit(): void {
  hits.clear()
}
