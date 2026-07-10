// Reference parsing (Sushant, Session 87 scaffold → Session B).
// DeepSeek: free-text reference strings → CSL-JSON, batched (≤20 refs/call),
// JSON mode, temperature 0, using the versioned REFERENCE_PARSE prompt. Every
// output is zod-validated; on failure retry once then flag-and-degrade. This is
// UNDERSTANDING only — it never invents bibliographic data (verify.ts confirms
// against Crossref/PubMed).

import type { CslReference } from '../types'

export function parseReferences(raw: string[]): Promise<CslReference[]> {
  // TODO(Session B): batch raw strings; call DeepSeek with REFERENCE_PARSE;
  // validate each result against a zod CSL schema; degrade gracefully.
  void raw
  throw new Error('parseReferences not implemented — Session B')
}
