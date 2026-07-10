// OOXML emit (Sushant, Session B). All transforms have already edited the parts
// held inside the Docx; emit just re-zips into Word-compatible bytes. There is
// NO body-run rewriting here and NO LLM client imported anywhere in this file or
// its call graph (grep-provable acceptance criterion).

import type { Docx } from './docx'

/** Serialise the (already-transformed) document to .docx bytes. */
export function emitDocx(docx: Docx): Uint8Array {
  return docx.toUint8Array()
}

/** Node Buffer variant (email attachments, Storage uploads). */
export function emitDocxBuffer(docx: Docx): Buffer {
  return docx.toBuffer()
}
