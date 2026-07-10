// OOXML emit (Sushant, Session 87 scaffold → Session B).
// Re-zip the modified parts into a Word-compatible .docx (no repair prompt on
// open — an acceptance criterion). Optionally scrub core-properties metadata.
//
// HARD INVARIANT: emit NEVER touches body <w:t> runs except to apply the
// citation-marker mapping. There is NO LLM client imported anywhere in this
// file or its call graph (grep-provable acceptance criterion). It takes
// structured inputs only.

import type { ContentModel } from '../types'

export interface EmitOptions {
  /** Strip author-name core-properties for blinded submissions. */
  scrubMetadata: boolean
}

/** @returns the output .docx bytes. */
export function emitDocx(model: ContentModel, opts: EmitOptions): Uint8Array {
  // TODO(Session B): serialise edited document.xml/styles.xml/headers back into
  // the zip; apply core-properties scrub when opts.scrubMetadata.
  void model
  void opts
  throw new Error('emitDocx not implemented — Session B')
}
