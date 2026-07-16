// Journal Finder ⇄ Formatter in-page handoff (Sushant, Session 2).
//
// The Formatter and the Finder are two sections on the same /format page, each
// its own client island. This tiny module-level pub/sub lets them pass data in
// memory (NOT via the URL — the build brief §8.4 is explicit) without lifting a
// giant shared parent. Two independent channels:
//
//   • format → finder  (`FormatHandoff`): when a format job completes, the
//     numbers it already knows (article type, journal, figure & reference count)
//     pre-fill the Finder so the author doesn't retype them. Word/abstract/table
//     counts are NOT auto-filled — the formatter doesn't surface them to the
//     client, and we never fabricate a number.
//
//   • finder → format  (`JournalRequest`): the "Format for this journal →"
//     button pre-selects a journal in the Formatter form — the loop that makes
//     the two tools one product.
//
// Client-only module (module-scoped mutable state). Safe: each page load starts
// fresh; nothing persists across navigations.

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

function channel<T>() {
  let last: T | null = null
  const listeners = new Set<Listener<T>>()
  return {
    publish(value: T) {
      last = value
      listeners.forEach((fn) => fn(value))
    },
    /** Subscribe; immediately replays the last value if one was already published. */
    subscribe(fn: Listener<T>): () => void {
      listeners.add(fn)
      if (last !== null) fn(last)
      return () => listeners.delete(fn)
    },
  }
}

const formatChannel = channel<FormatHandoff>()
const journalChannel = channel<JournalRequest>()

export const publishFormatHandoff = formatChannel.publish
export const subscribeFormatHandoff = formatChannel.subscribe

export const requestFormatJournal = journalChannel.publish
export const subscribeJournalRequest = journalChannel.subscribe
