// Methodological quality grading — content-hash cache (2026-07-26).
//
// WHY THIS EXISTS. `temperature: 0` is not a reproducibility guarantee. The same
// manuscript can come back graded slightly differently on two runs, and the
// ladder is anchored partly on that grade — so without this, an author who
// reloaded the page could watch their recommended journals move for no reason
// they did anything to cause. That is the kind of thing that destroys trust in a
// tool whose entire pitch is "we show you our evidence".
//
// So the grade is memoized on a hash of the exact text that was sent plus the
// instrument applied. Same manuscript, same instrument, same score, same ladder
// — by construction rather than by hope. Change a word of the manuscript and the
// hash changes and it is graded afresh, which is also correct.
//
// THE CACHE IS BEST-EFFORT AND MUST NEVER THROW. A read failure falls through to
// a live call; a write failure is swallowed. A caching layer that can fail a
// user's run is worse than no caching layer, and grading is already the most
// failure-tolerant thing in the product.
//
// THE STORE IS INJECTED, NOT IMPORTED. lib/quality/ cannot reach Supabase or
// next/headers without forfeiting the portability that is the whole point of the
// library (see types.ts), so the caller supplies a store. The Studio hands in a
// service-role-backed one; OSCRSJ's future intake will hand in its own; tests
// hand in a Map.

import { createHash } from 'node:crypto'
import type { InstrumentId, MethodologyScore } from './types'

/**
 * Key for a graded result: the exact text sent to the model, plus the instrument
 * applied.
 *
 * The instrument is part of the key because the same manuscript graded as a case
 * series and as a comparative study are different questions with different item
 * sets — an author who corrects their study design must get a fresh grade, not
 * the previous instrument's answer under a new name.
 *
 * The separator is an escaped NUL rather than a space because a NUL cannot occur
 * in either an instrument id or manuscript text, so no pair of inputs can be
 * concatenated into the same string two different ways. It is written in the
 * source as a unicode ESCAPE SEQUENCE, never as a raw byte: a literal NUL in a
 * .ts file makes git classify it as binary, which silently costs you diffs,
 * blame and code review on the file.
 */
export function contentHash(sentText: string, instrumentId: InstrumentId): string {
  return createHash('sha256').update(`${instrumentId}\u0000${sentText}`, 'utf8').digest('hex')
}

export interface QualityCacheStore {
  get(hash: string): Promise<MethodologyScore | null>
  set(hash: string, instrumentId: InstrumentId, score: MethodologyScore): Promise<void>
}

/**
 * Return the cached grade for this content, or compute and store one.
 *
 * A grade that FAILED is never cached. Caching a `gradingError` would pin a
 * transient network blip to a manuscript's content hash permanently, so the
 * author would keep seeing "we could not grade this" on every retry with no way
 * to clear it.
 */
export async function withQualityCache(
  store: QualityCacheStore | null,
  hash: string,
  instrumentId: InstrumentId,
  compute: () => Promise<MethodologyScore>,
): Promise<{ score: MethodologyScore; cacheHit: boolean }> {
  if (store) {
    try {
      const hit = await store.get(hash)
      if (hit) return { score: hit, cacheHit: true }
    } catch {
      // Unreadable cache is not an error the user should ever meet.
    }
  }

  const score = await compute()

  if (store && score.gradingError === null) {
    try {
      await store.set(hash, instrumentId, score)
    } catch {
      // An unwritable cache costs reproducibility, not correctness.
    }
  }

  return { score, cacheHit: false }
}

/** In-memory store. Used by tests, and a reasonable default for a single process. */
export function createMemoryCacheStore(): QualityCacheStore & { size: () => number } {
  const map = new Map<string, MethodologyScore>()
  return {
    async get(hash) {
      return map.get(hash) ?? null
    },
    async set(hash, _instrumentId, score) {
      map.set(hash, score)
    },
    size: () => map.size,
  }
}
