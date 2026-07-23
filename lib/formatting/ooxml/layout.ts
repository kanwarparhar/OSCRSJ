// OOXML layout transforms (Sushant, Session B). In-place edits driven ENTIRELY
// by ctx.rules.layout — no hardcoded per-journal behaviour. Every edit is on
// section properties (sectPr), style defaults (styles.xml docDefaults), or the
// header/footer parts. Body <w:t> runs are never touched here, so the
// content-immutability gate passes unconditionally after a layout pass.

import type { ContentModel, FormattingContext, ReportChange } from '../types'
import {
  Docx,
  PART,
  getSectPr,
  replaceSectPr,
  upsertChild,
  removeChild,
  mmToTwips,
  ptToHalfPt,
  lineSpacingTwips,
  escapeXmlAttr,
} from './docx'

export interface LayoutResult {
  changes: ReportChange[]
}

const change = (
  changes: ReportChange[],
  element: string,
  before: string,
  after: string,
): void => {
  if (before !== after) changes.push({ element, before, after, severity: 'fixed' })
}

/** Replace or append a single attribute on a self-closing element tag string. */
function setAttr(tag: string, name: string, value: string | number): string {
  const re = new RegExp(`(\\s${name}=")[^"]*(")`)
  if (re.test(tag)) return tag.replace(re, `$1${value}$2`)
  return tag.replace(/\s*\/>$/, ` ${name}="${value}"/>`)
}

function getAttr(xml: string, tag: string, name: string): string | null {
  const el = xml.match(new RegExp(`<${tag}\\b[^>]*>`))
  if (!el) return null
  const m = el[0].match(new RegExp(`\\s${name}="([^"]*)"`))
  return m ? m[1] : null
}

// ---------------------------------------------------------------------------
// sectPr edits
// ---------------------------------------------------------------------------

function setMargins(
  sect: string,
  m: { top_mm: number; bottom_mm: number; left_mm: number; right_mm: number },
): string {
  const existing = sect.match(/<w:pgMar\b[^>]*\/>/)
  const base = existing ? existing[0] : '<w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/>'
  let tag = base
  tag = setAttr(tag, 'w:top', mmToTwips(m.top_mm))
  tag = setAttr(tag, 'w:bottom', mmToTwips(m.bottom_mm))
  tag = setAttr(tag, 'w:left', mmToTwips(m.left_mm))
  tag = setAttr(tag, 'w:right', mmToTwips(m.right_mm))
  return upsertChild(sect, 'w:pgMar', tag)
}

function setPageSize(sect: string, size: 'letter' | 'a4'): string {
  const dims = size === 'a4' ? { w: 11906, h: 16838 } : { w: 12240, h: 15840 }
  return upsertChild(sect, 'w:pgSz', `<w:pgSz w:w="${dims.w}" w:h="${dims.h}"/>`)
}

function setLineNumbers(sect: string, mode: 'none' | 'continuous' | 'per_page'): string {
  if (mode === 'none') return removeChild(sect, 'w:lnNumType')
  const restart = mode === 'per_page' ? 'newPage' : 'continuous'
  return upsertChild(
    sect,
    'w:lnNumType',
    `<w:lnNumType w:countBy="1" w:start="1" w:restart="${restart}" w:distance="360"/>`,
  )
}

// ---------------------------------------------------------------------------
// Page numbers (footer part with a PAGE field)
// ---------------------------------------------------------------------------

const R_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'

function computeNextRid(relsXml: string): string {
  let max = 0
  for (const m of Array.from(relsXml.matchAll(/Id="rId(\d+)"/g))) max = Math.max(max, Number(m[1]))
  return `rId${max + 1}`
}

/** Add a footer (or header) part with a centered/aligned PAGE field and wire it up. */
function addPageNumberFooter(
  docx: Docx,
  sect: string,
  position: string,
  changes: ReportChange[],
): string {
  const jc =
    position.includes('left') ? 'left' : position.includes('right') ? 'right' : 'center'
  const atTop = position.startsWith('top')
  const type = atTop ? 'header' : 'footer'
  const tag = atTop ? 'w:hdr' : 'w:ftr'
  const refTag = atTop ? 'w:headerReference' : 'w:footerReference'
  const ct = atTop
    ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml'
    : 'application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml'
  const relType = atTop ? `${R_NS}/header` : `${R_NS}/footer`

  // pick a non-clashing part name
  let n = 1
  while (docx.hasPart(`word/${type}${n}.xml`)) n++
  const partName = `${type}${n}.xml`

  const partXml =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
    `<${tag} xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">` +
    `<w:p><w:pPr><w:jc w:val="${jc}"/></w:pPr>` +
    `<w:fldSimple w:instr=" PAGE "><w:r><w:t>1</w:t></w:r></w:fldSimple>` +
    `</w:p></${tag}>`
  docx.addPart(`word/${partName}`, partXml)

  // rels
  const relsXml =
    docx.part(PART.documentRels) ??
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>`
  const rid = computeNextRid(relsXml)
  docx.setPart(
    PART.documentRels,
    relsXml.replace(
      '</Relationships>',
      `<Relationship Id="${rid}" Type="${relType}" Target="${partName}"/></Relationships>`,
    ),
  )

  // content types
  const ctXml = docx.part(PART.contentTypes)
  if (ctXml && !ctXml.includes(`/word/${partName}`)) {
    docx.setPart(
      PART.contentTypes,
      ctXml.replace(
        '</Types>',
        `<Override PartName="/word/${partName}" ContentType="${ct}"/></Types>`,
      ),
    )
  }

  // reference in sectPr (header/footer refs precede pgSz in the schema)
  const ref = `<${refTag} w:type="default" r:id="${rid}"/>`
  let out: string
  if (/<w:pgSz\b/.test(sect)) out = sect.replace(/(<w:pgSz\b)/, `${ref}$1`)
  else out = sect.replace(/^(<w:sectPr\b[^>]*>)/, `$1${ref}`)
  out = upsertChild(out, 'w:pgNumType', '<w:pgNumType w:start="1"/>')
  change(changes, 'Page numbers', 'none', `${position}`)
  return out
}

// ---------------------------------------------------------------------------
// styles.xml docDefaults (font, size, line spacing, alignment)
// ---------------------------------------------------------------------------

function setDocDefaults(styles: string, ctx: FormattingContext, changes: ReportChange[]): string {
  const L = ctx.rules.layout
  let out = styles

  // rPrDefault: font family + size
  const rprMatch = out.match(/<w:rPrDefault>[\s\S]*?<\/w:rPrDefault>/)
  if (rprMatch) {
    let rpr = rprMatch[0]
    if (L.font.family) {
      const fam = escapeXmlAttr(L.font.family)
      rpr = upsertChild(
        rpr,
        'w:rFonts',
        `<w:rFonts w:ascii="${fam}" w:hAnsi="${fam}" w:cs="${fam}"/>`,
      )
      change(changes, 'Body font', 'document default', L.font.family)
    }
    if (L.font.size_pt != null) {
      const half = ptToHalfPt(L.font.size_pt)
      rpr = upsertChild(rpr, 'w:sz', `<w:sz w:val="${half}"/>`)
      rpr = upsertChild(rpr, 'w:szCs', `<w:szCs w:val="${half}"/>`)
      change(changes, 'Font size', 'document default', `${L.font.size_pt} pt`)
    }
    out = out.replace(rprMatch[0], rpr)
  }

  // pPrDefault: line spacing + alignment
  const pprMatch = out.match(/<w:pPrDefault>[\s\S]*?<\/w:pPrDefault>/)
  let ppr = pprMatch ? pprMatch[0] : '<w:pPrDefault><w:pPr></w:pPr></w:pPrDefault>'
  let inner = ppr.match(/<w:pPr>[\s\S]*?<\/w:pPr>|<w:pPr\/>/)?.[0] ?? '<w:pPr></w:pPr>'
  let innerOpen = inner === '<w:pPr/>' ? '<w:pPr></w:pPr>' : inner
  if (L.line_spacing) {
    const line = lineSpacingTwips(L.line_spacing)
    const after = getAttr(innerOpen, 'w:spacing', 'w:after') ?? '0'
    innerOpen = upsertChild(
      innerOpen,
      'w:spacing',
      `<w:spacing w:after="${after}" w:line="${line}" w:lineRule="auto"/>`,
    )
    change(changes, 'Line spacing', 'document default', L.line_spacing)
  }
  if (L.alignment) {
    const jc = L.alignment === 'justified' ? 'both' : 'left'
    innerOpen = upsertChild(innerOpen, 'w:jc', `<w:jc w:val="${jc}"/>`)
    change(changes, 'Alignment', 'document default', L.alignment)
  }
  ppr = ppr.replace(inner, innerOpen)
  if (pprMatch) out = out.replace(pprMatch[0], ppr)
  else out = out.replace(/<\/w:docDefaults>/, `${ppr}</w:docDefaults>`)

  return out
}

// ---------------------------------------------------------------------------
// Running head (header part)
// ---------------------------------------------------------------------------

function applyRunningHead(
  docx: Docx,
  running: FormattingContext['rules']['layout']['running_head'],
  runningTitle: string | undefined,
  changes: ReportChange[],
): void {
  if (!running.show) return
  // Find an existing default header part referenced by the doc.
  const headerPart = docx.listParts().find((p) => /^word\/header\d+\.xml$/.test(p))
  const jc = running.position?.includes('right')
    ? 'right'
    : running.position?.includes('center')
      ? 'center'
      : 'left'
  if (headerPart) {
    let h = docx.part(headerPart)!
    // set alignment on the first paragraph's pPr
    h = h.replace(
      /<w:p\b([^>]*)>(?:<w:pPr>([\s\S]*?)<\/w:pPr>)?/,
      (_full, attrs, pprInner) => {
        const inner = upsertChild(`<w:pPr>${pprInner ?? ''}</w:pPr>`, 'w:jc', `<w:jc w:val="${jc}"/>`)
        return `<w:p${attrs}>${inner}`
      },
    )
    docx.setPart(headerPart, h)
    change(changes, 'Running head', 'present', `aligned ${jc}`)
  }
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export function applyLayout(
  docx: Docx,
  _model: ContentModel,
  ctx: FormattingContext,
  opts?: { runningTitle?: string },
): LayoutResult {
  const changes: ReportChange[] = []
  const L = ctx.rules.layout

  let docXml = docx.part(PART.document)
  if (docXml) {
    let sect = getSectPr(docXml)
    if (sect) {
      const before = sect
      if (L.page_size) sect = setPageSize(sect, L.page_size)
      // Report a change only when the sectPr actually changed (2026-07-22,
      // Part F): a manuscript already at the journal's margins previously got
      // an unconditional "Margins: document default → Xmm" row, padding the
      // change list beyond what the diff justifies.
      if (L.margins_mm) {
        const beforeMargins = sect
        sect = setMargins(sect, L.margins_mm)
        if (sect !== beforeMargins) {
          change(changes, 'Margins', 'document default', `${L.margins_mm.top_mm}mm all sides`)
        }
      }
      // null = the guide is silent on line numbering, so we leave the author's
      // setting alone. Only an explicit "no line numbers" statement in the
      // guide ('none') licenses stripping line numbering the author added.
      // Same actually-changed rule (closes the §11 no-op "Line numbering:
      // present → continuous" item): a manuscript that ALREADY carries the
      // required numbering reports nothing.
      if (L.line_numbers !== null) {
        const beforeLnSect = sect
        const beforeLn = /<w:lnNumType/.test(sect)
        sect = setLineNumbers(sect, L.line_numbers)
        if (sect !== beforeLnSect) {
          change(changes, 'Line numbering', beforeLn ? 'present' : 'none', L.line_numbers)
        }
      }
      if (L.page_numbers.show && !/<w:pgNumType/.test(before) && L.page_numbers.position) {
        sect = addPageNumberFooter(docx, sect, L.page_numbers.position, changes)
      }
      docXml = replaceSectPr(docXml, sect)
      docx.setPart(PART.document, docXml)
    }
  }

  const styles = docx.part(PART.styles)
  if (styles) docx.setPart(PART.styles, setDocDefaults(styles, ctx, changes))

  applyRunningHead(docx, L.running_head, opts?.runningTitle, changes)

  return { changes }
}
