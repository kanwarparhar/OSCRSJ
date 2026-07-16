// Journal Finder ⇄ Formatter handoff (Sushant, Session 2; re-backed Session 95).
//
// ORIGINALLY: the Formatter and the Finder were two sections of one /format page,
// so a module-level pub/sub passed data between them in memory. Session 95 split
// the Studio into four routes (/studio, /studio/format, /studio/find,
// /studio/journals). A client-side route change keeps the module alive, but a full
// reload or a direct visit to /studio/find does not — the in-memory channel would
// silently drop the handoff and the author would retype numbers we already had.
//
// So each channel is now backed by sessionStorage, keeping the same publish/
// subscribe API. Two independent channels:
//
//   • format → finder  (`FormatHandoff`): when a format job completes, the numbers
//     it already knows (article type, journal, figure & reference count) pre-fill
//     the Finder so the author doesn't retype them. Word/abstract/table counts are
//     NOT auto-filled — the formatter doesn't surface them to the client, and we
//     never fabricate a number.
//
//   • finder → format  (`JournalRequest`): the "Format for this journal →" button
//     pre-selects a journal in the Formatter form — the loop that makes the two
//     tools one product.
//
// Still NOT the URL (build brief §8.4 is explicit) and still client-only.
// sessionStorage scope is deliberate: per-tab, cleared when the tab closes, never
// sent to a server. Nothing stored here is manuscript content — only the numbers
// the author already typed or the job already reported back to them.

import type { ArticleType } from '@/lib/formatting/rulesSchema'

export interface FormatHandoff {
  /** Original manuscript filename, e.g. "My Case Report.docx" — for the banner. */
  filename: string | null
  articleType: ArticleType | null
  journalSlug: string | null
  figureCount: number | null
  referenceCount: number | null
}

export interface JournalRequest {
  slug: string
  articleType: ArticleType
}

type Listener<T> = (value: T) => void

/**
 * A pub/sub channel whose last value survives a route change.
 *
 * In-memory `last` is the fast path; sessionStorage is the durable one. Hydration
 * is lazy so this module stays import-safe under SSR (no `window` at module
 * scope). Every storage access is try/caught: Safari private mode throws on
 * setItem, and a dropped handoff must degrade to "the author retypes it", never
 * to a crash.
 */
function channel<T>(storageKey: string) {
  let last: T | null = null
  let hydrated = false
  const listeners = new Set<Listener<T>>()

  function hydrate(): T | null {
    if (hydrated) return last
    hydrated = true
    if (typeof window === 'undefined') return null
    try {
      const raw = window.sessionStorage.getItem(storageKey)
      if (raw) last = JSON.parse(raw) as T
    } catch {
      last = null
    }
    return last
  }

  return {
    publish(value: T) {
      last = value
      hydrated = true
      try {
        window.sessionStorage.setItem(storageKey, JSON.stringify(value))
      } catch {
        /* private mode / quota — in-memory delivery still works on this page */
      }
      listeners.forEach((fn) => fn(value))
    },
    /** Subscribe; immediately replays the last value if one was already published. */
    subscribe(fn: Listener<T>): () => void {
      listeners.add(fn)
      const value = hydrate()
      if (value !== null) fn(value)
      return () => listeners.delete(fn)
    },
    /** Drop the stored value once consumed, so a later visit starts clean. */
    clear() {
      last = null
      hydrated = true
      if (typeof window === 'undefined') return
      try {
        window.sessionStorage.removeItem(storageKey)
      } catch {
        /* nothing to do */
      }
    },
  }
}

const formatChannel = channel<FormatHandoff>('oscrsj-studio-format-handoff')
const journalChannel = channel<JournalRequest>('oscrsj-studio-journal-request')

export const publishFormatHandoff = formatChannel.publish
export const subscribeFormatHandoff = formatChannel.subscribe
export const clearFormatHandoff = formatChannel.clear

export const requestFormatJournal = journalChannel.publish
export const subscribeJournalRequest = journalChannel.subscribe
export const clearJournalRequest = journalChannel.clear
