// Low-level .docx (OOXML) access + XML string helpers (Sushant, Session B).
//
// Zip layer is pizzip — already a repo dependency and the proven docx-surgery
// tool (see lib/reviewer-package/build.ts). We deliberately do NOT re-serialize
// the whole document through a DOM: edits are targeted string replacements on
// the raw part XML so body <w:t> runs stay byte-for-byte identical (the
// content-immutability requirement) and Word opens the output without a repair
// prompt. Structure *reading* (ingest.ts) uses @xmldom/xmldom.

import PizZip from 'pizzip'

/** The Open Packaging Conventions paths this engine touches. */
export const PART = {
  document: 'word/document.xml',
  styles: 'word/styles.xml',
  settings: 'word/settings.xml',
  coreProps: 'docProps/core.xml',
  appProps: 'docProps/app.xml',
  contentTypes: '[Content_Types].xml',
  documentRels: 'word/_rels/document.xml.rels',
} as const

/** A thin mutable wrapper over a .docx zip. */
export class Docx {
  private zip: PizZip

  constructor(bytes?: Uint8Array | Buffer | ArrayBuffer) {
    this.zip = bytes ? new PizZip(bytes as Buffer) : new PizZip()
  }

  part(path: string): string | null {
    const f = this.zip.file(path)
    return f ? f.asText() : null
  }

  /**
   * The entry's DECLARED uncompressed size from the zip headers, before any
   * inflation happens (2026-07-22, Part G3). Lets ingest reject a
   * high-ratio deflate stream ("zip bomb") without first inflating it into
   * memory. pizzip keeps the CompressedObject on `_data` until first access.
   * Returns null when unavailable (already-inflated string parts, absent
   * entries) — callers must then fall back to a post-inflate length check.
   */
  declaredPartSize(path: string): number | null {
    const f = this.zip.file(path) as unknown as {
      _data?: { uncompressedSize?: number }
    } | null
    const size = f?._data?.uncompressedSize
    return typeof size === 'number' && Number.isFinite(size) ? size : null
  }

  setPart(path: string, text: string): void {
    this.zip.file(path, text)
  }

  addPart(path: string, text: string): void {
    this.zip.file(path, text)
  }

  hasPart(path: string): boolean {
    return !!this.zip.file(path)
  }

  listParts(): string[] {
    return Object.keys((this.zip as unknown as { files: Record<string, unknown> }).files)
  }

  toBuffer(): Buffer {
    return this.zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' })
  }

  toUint8Array(): Uint8Array {
    return this.zip.generate({ type: 'uint8array', compression: 'DEFLATE' })
  }
}

// ---------------------------------------------------------------------------
// Units
// ---------------------------------------------------------------------------

/** millimetres → twips (1 inch = 1440 twips = 25.4 mm). */
export const mmToTwips = (mm: number): number => Math.round((mm / 25.4) * 1440)

/** points → half-points (OOXML w:sz unit). */
export const ptToHalfPt = (pt: number): number => Math.round(pt * 2)

/** OOXML w:line value for a line-spacing rule (lineRule="auto": 240 = single). */
export const lineSpacingTwips = (spacing: 'single' | '1.5' | 'double'): number =>
  spacing === 'double' ? 480 : spacing === '1.5' ? 360 : 240

// ---------------------------------------------------------------------------
// XML text helpers
// ---------------------------------------------------------------------------

export function decodeXmlText(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&amp;/g, '&')
}

export function escapeXmlText(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

export function escapeXmlAttr(s: string): string {
  return escapeXmlText(s).replace(/"/g, '&quot;')
}

// ---------------------------------------------------------------------------
// Body / paragraph / run string surgery
// ---------------------------------------------------------------------------

/** All `<w:p>…</w:p>` blocks in a document part, in order. */
export function paragraphs(docXml: string): string[] {
  return docXml.match(/<w:p\b[^>]*>[\s\S]*?<\/w:p>|<w:p\b[^>]*\/>/g) ?? []
}

/** Concatenated visible text of a paragraph (decoded), runs in document order. */
export function paragraphText(pXml: string): string {
  const runs = pXml.match(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g) ?? []
  return runs
    .map((r) => decodeXmlText(r.replace(/^<w:t\b[^>]*>/, '').replace(/<\/w:t>$/, '')))
    .join('')
}

/** True if the paragraph carries a real bold run (heading heuristic). */
export function paragraphIsBold(pXml: string): boolean {
  // <w:b/> or <w:b w:val="true|1|on"/>; excludes <w:b w:val="false|0"/>.
  return /<w:b(\s+w:val="(?:true|1|on)")?\s*\/>/.test(pXml)
}

/**
 * Body text = every `<w:t>` inside `<w:body>` (headers/footers excluded because
 * they are separate parts). This is the immutability-gate baseline.
 */
export function extractBodyText(docXml: string): string {
  const body = docXml.match(/<w:body\b[^>]*>([\s\S]*)<\/w:body>/)
  const scope = body ? body[1] : docXml
  const runs = scope.match(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g) ?? []
  return runs
    .map((r) => decodeXmlText(r.replace(/^<w:t\b[^>]*>/, '').replace(/<\/w:t>$/, '')))
    .join('')
}

// ---------------------------------------------------------------------------
// sectPr helpers (last sectPr = the body-level section properties)
// ---------------------------------------------------------------------------

export function getSectPr(docXml: string): string | null {
  const all = docXml.match(/<w:sectPr\b[^>]*>[\s\S]*?<\/w:sectPr>/g)
  return all ? all[all.length - 1] : null
}

export function replaceSectPr(docXml: string, newSectPr: string): string {
  const sect = getSectPr(docXml)
  if (!sect) return docXml
  const idx = docXml.lastIndexOf(sect)
  return docXml.slice(0, idx) + newSectPr + docXml.slice(idx + sect.length)
}

/**
 * Insert or replace a single self-closing child element inside a parent element
 * string. `tag` is the local name (e.g. "w:pgMar"). If a matching child exists
 * (self-closing or with a body) it is replaced; otherwise the new element is
 * inserted immediately after the parent's opening tag (or at `beforeTag` if the
 * ordering-sensitive schema requires it — sectPr children are order-tolerant in
 * practice for the elements we touch, but we keep pgSz→pgMar→cols ordering by
 * inserting before `cols` when present).
 */
export function upsertChild(parentXml: string, tag: string, elementXml: string): string {
  const selfClose = new RegExp(`<${tag}\\b[^>]*/>`)
  const withBody = new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?</${tag}>`)
  if (selfClose.test(parentXml)) return parentXml.replace(selfClose, elementXml)
  if (withBody.test(parentXml)) return parentXml.replace(withBody, elementXml)
  // insert after the opening tag of the parent
  const open = parentXml.match(/^<[^>]+>/)
  if (!open) return parentXml
  return open[0] + elementXml + parentXml.slice(open[0].length)
}

export function removeChild(parentXml: string, tag: string): string {
  return parentXml
    .replace(new RegExp(`<${tag}\\b[^>]*/>`), '')
    .replace(new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?</${tag}>`), '')
}

// ---------------------------------------------------------------------------
// Minimal builders (title page + report docx are rebuilt from scratch — they
// carry no author prose from the manuscript body, so a clean rebuild is
// content-safe).
// ---------------------------------------------------------------------------

export interface RunStyle {
  bold?: boolean
  italic?: boolean
  sizePt?: number
  superscript?: boolean
}

export function runXml(text: string, style: RunStyle = {}): string {
  const rpr: string[] = []
  if (style.bold) rpr.push('<w:b/>')
  if (style.italic) rpr.push('<w:i/>')
  if (style.sizePt != null) rpr.push(`<w:sz w:val="${ptToHalfPt(style.sizePt)}"/>`)
  if (style.superscript) rpr.push('<w:vertAlign w:val="superscript"/>')
  const rprXml = rpr.length ? `<w:rPr>${rpr.join('')}</w:rPr>` : ''
  return `<w:r>${rprXml}<w:t xml:space="preserve">${escapeXmlText(text)}</w:t></w:r>`
}

export interface ParaStyle {
  align?: 'left' | 'center' | 'right' | 'justified'
  bold?: boolean
  italic?: boolean
  sizePt?: number
}

export function paraXml(text: string, style: ParaStyle = {}): string {
  const ppr: string[] = []
  if (style.align) {
    const jc = style.align === 'justified' ? 'both' : style.align
    ppr.push(`<w:jc w:val="${jc}"/>`)
  }
  const pprXml = ppr.length ? `<w:pPr>${ppr.join('')}</w:pPr>` : ''
  const run = runXml(text, { bold: style.bold, italic: style.italic, sizePt: style.sizePt })
  return `<w:p>${pprXml}${run}</w:p>`
}

const CONTENT_TYPES =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
  `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
  `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
  `<Default Extension="xml" ContentType="application/xml"/>` +
  `<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>` +
  `<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>` +
  `<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>` +
  `</Types>`

const ROOT_RELS =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
  `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
  `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>` +
  `<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>` +
  `</Relationships>`

const EMPTY_CORE =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
  `<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" ` +
  `xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:creator></dc:creator></cp:coreProperties>`

/** Build a fresh, valid single-section .docx from body paragraph XML. */
export function createDocx(paragraphs: string[], font = 'Times New Roman', sizePt = 12): Docx {
  const document =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
    `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" ` +
    `xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
    `<w:body>${paragraphs.join('')}` +
    `<w:sectPr><w:pgSz w:w="12240" w:h="15840"/>` +
    `<w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/>` +
    `</w:sectPr></w:body></w:document>`
  const styles =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
    `<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">` +
    `<w:docDefaults><w:rPrDefault><w:rPr>` +
    `<w:rFonts w:ascii="${escapeXmlAttr(font)}" w:hAnsi="${escapeXmlAttr(font)}" w:cs="${escapeXmlAttr(font)}"/>` +
    `<w:sz w:val="${ptToHalfPt(sizePt)}"/><w:szCs w:val="${ptToHalfPt(sizePt)}"/>` +
    `</w:rPr></w:rPrDefault></w:docDefaults></w:styles>`

  const docx = new Docx()
  docx.setPart(PART.contentTypes, CONTENT_TYPES)
  docx.setPart('_rels/.rels', ROOT_RELS)
  docx.setPart(PART.document, document)
  docx.setPart(
    PART.documentRels,
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
      `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
      `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>` +
      `</Relationships>`,
  )
  docx.setPart(PART.styles, styles)
  docx.setPart(PART.coreProps, EMPTY_CORE)
  return docx
}
