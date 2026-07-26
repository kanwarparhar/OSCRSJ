// GET /api/studio/quota?email=... — how many free runs this address has left.
//
// Read-only, unauthenticated, and deliberately so: the formatter and Finder
// forms are unauthenticated too, and the UI needs to say "1 run left" BEFORE
// the user uploads a manuscript rather than after. Making someone upload a
// 12 MB docx to discover they are locked out is a bad experience and it burns
// our bandwidth on a request we were always going to refuse.
//
// ---------------------------------------------------------------------------
// WHY THIS IS SAFE TO EXPOSE, since an unauthenticated endpoint keyed by email
// deserves the scrutiny:
//
//   * It reveals only a small integer for an address the caller already typed.
//     There is no name, no manuscript, no journal, no history. The most an
//     enumerator learns is "this address has used the Studio", which is close
//     to worthless and is not a secret we ever promised to keep.
//   * It cannot be used to CHANGE anything. Every mutation still runs the same
//     server-side check; this route is advisory to the UI and authoritative
//     over nothing.
//   * It is rate-limited per IP anyway (below), so it cannot be used as a fast
//     oracle to sweep a list of addresses.
//
// The alternative -- emailing a magic link to see your own quota -- costs a
// round trip and an email send to protect a number the user can discover by
// clicking Submit. That is security theatre with a real usability bill.
// ---------------------------------------------------------------------------

import { NextRequest, NextResponse } from 'next/server'
import { getQuotaStatus } from '@/lib/studio/quota'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

/**
 * Per-IP throttle on the lookup itself, in memory.
 *
 * Same trade-off as lib/finder/rateLimit.ts and the same caveat: serverless
 * instances do not share memory, so the effective cap is per warm instance
 * rather than strictly global. That is fine here. This exists to stop a casual
 * script from sweeping an address list at speed, not to defeat a determined
 * distributed attacker, and the thing being protected is a boolean-ish integer.
 * A Redis dependency for this would cost more than it protects.
 */
const LOOKUP_WINDOW_MS = 60 * 1000
const LOOKUP_MAX_PER_WINDOW = 30
const lookups = new Map<string, number[]>()

function throttled(ip: string | null): boolean {
  if (!ip) return false
  const now = Date.now()
  const cutoff = now - LOOKUP_WINDOW_MS
  const hits = (lookups.get(ip) ?? []).filter((t) => t > cutoff)
  if (hits.length >= LOOKUP_MAX_PER_WINDOW) {
    lookups.set(ip, hits)
    return true
  }
  hits.push(now)
  lookups.set(ip, hits)
  // Opportunistic sweep so the map cannot grow without bound on a long-lived
  // instance. Cheap because it only runs on the allowed path.
  if (lookups.size > 5000) {
    // Array.from rather than iterating the Map directly: this tsconfig targets
    // below es2015 for downlevel iteration. It also snapshots the keys, so
    // deleting while walking is safe.
    for (const k of Array.from(lookups.keys())) {
      const v = lookups.get(k)
      if (v && v.every((t: number) => t <= cutoff)) lookups.delete(k)
    }
  }
  return false
}

function clientIp(req: NextRequest): string | null {
  const xff = req.headers.get('x-forwarded-for')
  return xff ? xff.split(',')[0].trim() : req.headers.get('x-real-ip')
}

export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get('email')
  if (!email || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: 'A valid email is required.' }, { status: 400 })
  }
  if (throttled(clientIp(req))) {
    return NextResponse.json({ error: 'Too many lookups. Slow down.' }, { status: 429 })
  }

  try {
    const status = await getQuotaStatus(email)
    return NextResponse.json(
      {
        email: status.email,
        used: status.used,
        limit: status.limit,
        remaining: status.remaining,
        locked: status.locked,
        canUnlockWithSurvey: status.canUnlockWithSurvey,
        lockedByInFlightOnly: status.lockedByInFlightOnly,
        resetCount: status.resetCount,
        surveyCompletedAt: status.surveyCompletedAt,
        completedRuns: status.completedRuns,
        inFlightRuns: status.inFlightRuns,
      },
      // No caching. A stale "2 runs left" read from a CDN after the user has
      // spent them produces a form that looks available and then refuses on
      // submit, which reads as a bug rather than as a limit.
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch {
    // Deliberately NOT a lockout. If we cannot read the quota we say so and let
    // the user try; the create route runs the same check and is the authority.
    return NextResponse.json(
      { error: 'Could not read your remaining runs just now.' },
      { status: 503 },
    )
  }
}
