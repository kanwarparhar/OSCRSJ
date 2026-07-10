// OOXML ingest (Sushant, Session 87 scaffold → Session B).
// Unzip the .docx, parse word/document.xml + styles.xml + sectPr, and build a
// ContentModel. Detect graceful-rejection hazards (tracked changes, comments,
// password protection, embedded equations, no detectable sections) here so the
// pipeline never emits a mangled file.
//
// Session B deps (to be installed then): jszip (unzip) + @xmldom/xmldom (parse).
// Deliberately NOT imported yet so the Session A scaffold stays tsc-clean.

import type { ContentModel } from '../types'

export function ingestDocx(bytes: Uint8Array): Promise<ContentModel> {
  // TODO(Session B): unzip; read document.xml/styles.xml; extract body <w:t>;
  // detect sections + raw reference block; collect hazards.
  void bytes
  throw new Error('ingestDocx not implemented — Session B')
}
