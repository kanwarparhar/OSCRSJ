// Reference verification (Sushant, Session 87 scaffold → Session B).
// Look each parsed reference up in Crossref (then PubMed as fallback), enrich
// DOI/PMID, and check Crossref retraction data. Accept enrichment only on
// ≥0.85 title similarity; below that, mark 'unverified' (flagged, never
// dropped). Batched + resumable via StageCursor to respect the ~50s Vercel
// budget. Crossref calls include a `mailto` (etiquette); NCBI stays under
// 3 req/s. No LLM here — external-fact verification is deterministic HTTP.

import type { CslReference, VerifiedReference } from '../types'

export interface VerifyBatchResult {
  verified: VerifiedReference[]
  /** Index of the next reference to process, or null when the list is done. */
  nextCursor: number | null
}

export function verifyReferences(
  refs: CslReference[],
  startCursor: number,
): Promise<VerifyBatchResult> {
  // TODO(Session B): Crossref query.bibliographic → PubMed fallback; title
  // similarity gate; retraction flag; batch from startCursor within budget.
  void refs
  void startCursor
  throw new Error('verifyReferences not implemented — Session B')
}
