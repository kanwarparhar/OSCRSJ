// Journal Finder v1 — client⇄server request contract (Sushant, Session 2).
// Kept client-safe (types only) so FinderClient and the route agree on shape.

import type { FinderResult, ManuscriptStats, SortKey } from './types'

export interface FinderMatchRequest {
  stats: ManuscriptStats
  sortBy: SortKey
}

export type FinderMatchResponse = FinderResult
