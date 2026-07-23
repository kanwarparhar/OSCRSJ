// OOXML ingest (Sushant, Session B). Unzip the .docx, parse word/document.xml
// with @xmldom/xmldom, and build a ContentModel: body text (the immutability
// baseline), heading-bounded sections (detected from paragraph styles OR bold
// headings — authors format both ways), the raw reference list, and
// graceful-rejection hazards. The full zip is returned as a Docx so downstream
// transforms edit parts in place and emit re-zips everything untouched.

import { DOMParser } from '@xmldom/xmldom'
import type { ContentModel, DetectedSection, IngestHazard } from '../types'
import type { ArticleType } from '../rulesSchema'
import { Docx, PART, extractBodyText } from './docx'

export interface IngestResult {
  docx: Docx
  model: ContentModel
}

/** Thrown when the file cannot be opened at all (caller → job 'failed'). */
export class IngestError extends Error {
  constructor(
    public code: 'not_docx' | 'password_protected' | 'empty' | 'too_large',
    message: string,
  ) {
    super(message)
    this.name = 'IngestError'
  }
}

/**
 * Inflation ceiling for word/document.xml (2026-07-22, Part G3). A
 * high-ratio deflate stream inside an under-limit upload could otherwise
 * inflate to gigabytes and OOM the function. 100 MB of document XML is far
 * beyond any real manuscript. Checked against the zip header's declared size
 * BEFORE inflating, and re-checked against the actual string after (headers
 * can lie; the post-check fails the job even though the memory was briefly
 * spent).
 */
export const MAX_DOCUMENT_XML_BYTES = 100 * 1024 * 1024

// Normalised heading → canonical section key, for structure + type detection.
const HEADING_ALIASES: Record<string, string> = {
  abstract: 'abstract',
  keywords: 'keywords',
  'key words': 'keywords',
  introduction: 'introduction',
  background: 'introduction',
  'case presentation': 'case_presentation',
  'case report': 'case_presentation',
  'case description': 'case_presentation',
  'presentation of case': 'case_presentation',
  methods: 'methods',
  'materials and methods': 'methods',
  'patients and methods': 'methods',
  results: 'results',
  discussion: 'discussion',
  conclusion: 'conclusion',
  conclusions: 'conclusion',
  'surgical technique': 'surgical_technique',
  technique: 'surgical_technique',
  references: 'references',
  'figure legends': 'figure_legends',
  'figure legend': 'figure_legends',
  acknowledgments: 'acknowledgments',
  acknowledgements: 'acknowledgments',
}

const normalizeHeading = (s: string): string =>
  s
    .trim()
    .toLowerCase()
    .replace(/^[0-9]+[.):]\s*/, '') // strip leading numbering "1. "
    .replace(/[:.]$/, '')
    .replace(/\s+/g, ' ')
    .trim()

function countWords(s: string): number {
  const t = s.trim()
  return t ? t.split(/\s+/).length : 0
}

interface Para {
  index: number
  text: string
  bold: boolean
  hasPStyleHeading: boolean
}

function readParagraphs(docXml: string): Para[] {
  const dom = new DOMParser({ onError: () => {} }).parseFromString(docXml, 'text/xml')
  const bodies = dom.getElementsByTagName('w:body')
  const body = bodies.length ? bodies[0] : dom.documentElement
  const out: Para[] = []
  let i = 0
  const kids = body?.childNodes
  if (!kids) return out
  for (let k = 0; k < kids.length; k++) {
    const node = kids[k] as unknown as {
      nodeName?: string
      getElementsByTagName?: (n: string) => { length: number; [j: number]: unknown }
    }
    if (node.nodeName !== 'w:p') continue
    const el = node as unknown as Element
    // text
    const ts = el.getElementsByTagName('w:t')
    let text = ''
    for (let t = 0; t < ts.length; t++) text += ts[t].textContent ?? ''
    // bold: any real <w:b> run
    let bold = false
    const bs = el.getElementsByTagName('w:b')
    for (let b = 0; b < bs.length; b++) {
      const v = bs[b].getAttribute('w:val')
      if (v === null || v === 'true' || v === '1' || v === 'on') {
        bold = true
        break
      }
    }
    // pStyle heading
    let hasPStyleHeading = false
    const ps = el.getElementsByTagName('w:pStyle')
    for (let p = 0; p < ps.length; p++) {
      const v = ps[p].getAttribute('w:val') ?? ''
      if (/heading|title/i.test(v)) {
        hasPStyleHeading = true
        break
      }
    }
    out.push({ index: i++, text, bold, hasPStyleHeading })
  }
  return out
}

/** Heading heuristic: pStyle heading, OR a short all-bold line without terminal prose punctuation. */
function isHeading(p: Para): boolean {
  const t = p.text.trim()
  if (!t) return false
  if (p.hasPStyleHeading) return true
  if (!p.bold) return false
  if (countWords(t) > 8) return false
  if (/[.?!,;]$/.test(t) && !/[.):]$/.test(normalizeHeading(t) + '.')) return false
  return true
}

function detectHazards(docx: Docx, docXml: string, sectionCount: number): IngestHazard[] {
  const h: IngestHazard[] = []
  if (/<w:ins\b/.test(docXml) || /<w:del\b/.test(docXml)) {
    h.push({
      kind: 'tracked_changes',
      fatal: true,
      message: 'The manuscript contains tracked changes. Accept all changes in Word and re-upload.',
    })
  }
  if (docx.hasPart('word/comments.xml') || /<w:commentReference\b/.test(docXml)) {
    h.push({
      kind: 'comments',
      fatal: true,
      message: 'The manuscript contains comments. Remove all comments in Word and re-upload.',
    })
  }
  const eq = (docXml.match(/<m:oMath\b/g) ?? []).length
  if (eq > 0) {
    h.push({
      kind: 'embedded_equations',
      fatal: false,
      message: `${eq} embedded equation(s) detected — formatting proceeds, but verify equation rendering in the output.`,
    })
  }
  if (sectionCount < 2) {
    h.push({
      kind: 'no_detectable_sections',
      fatal: true,
      message: 'No manuscript sections were detected. Ensure the file is a manuscript with headings.',
    })
  }
  return h
}

function guessArticleType(keys: Set<string>): ArticleType | null {
  if (keys.has('case_presentation')) return keys.has('methods') ? 'case_series' : 'case_report'
  if (keys.has('surgical_technique')) return 'technical_note'
  if (keys.has('methods') && keys.has('results')) return 'original_research'
  if (keys.has('discussion') && keys.has('introduction')) return 'original_research'
  return null
}

export function ingestDocx(bytes: Uint8Array): Promise<IngestResult> {
  let docx: Docx
  try {
    docx = new Docx(bytes)
  } catch (e) {
    return Promise.reject(
      new IngestError('not_docx', 'File is not a valid .docx (could not open as a Word package).'),
    )
  }
  const declared = docx.declaredPartSize(PART.document)
  if (declared !== null && declared > MAX_DOCUMENT_XML_BYTES) {
    return Promise.reject(
      new IngestError('too_large', 'The document is too large to process. Please simplify the file and re-upload.'),
    )
  }
  const docXml = docx.part(PART.document)
  if (!docXml) {
    return Promise.reject(new IngestError('not_docx', 'Missing word/document.xml — not a Word manuscript.'))
  }
  if (docXml.length > MAX_DOCUMENT_XML_BYTES) {
    return Promise.reject(
      new IngestError('too_large', 'The document is too large to process. Please simplify the file and re-upload.'),
    )
  }

  const paras = readParagraphs(docXml)

  // Sections: each heading opens a section that runs until the next heading.
  const sections: DetectedSection[] = []
  const sectionKeys = new Set<string>()
  let current: { heading: string; normalized: string; start: number } | null = null
  const flush = (end: number, para: Para[]) => {
    if (!current) return
    const words = para
      .slice(current.start + 1, end)
      .reduce((n, p) => n + countWords(p.text), 0)
    sections.push({
      heading: current.heading,
      normalized: current.normalized,
      range: [current.start, end],
      wordCount: words,
    })
  }
  for (const p of paras) {
    if (isHeading(p)) {
      flush(p.index, paras)
      const norm = normalizeHeading(p.text)
      const key = HEADING_ALIASES[norm] ?? norm
      current = { heading: p.text.trim(), normalized: key, start: p.index }
      sectionKeys.add(key)
    }
  }
  flush(paras.length, paras)

  // Raw references: paragraphs inside the "references" section (numbering stripped).
  const refSection = sections.find((s) => s.normalized === 'references')
  const rawReferences: string[] = []
  if (refSection) {
    for (let i = refSection.range[0] + 1; i < refSection.range[1]; i++) {
      const t = paras[i]?.text?.trim()
      if (t) rawReferences.push(t.replace(/^[0-9]+[.):]\s*/, ''))
    }
  }

  const hazards = detectHazards(docx, docXml, sections.length)

  const model: ContentModel = {
    documentXml: docXml,
    stylesXml: docx.part(PART.styles),
    bodyText: extractBodyText(docXml),
    detectedSections: sections,
    rawReferences,
    hazards,
    articleTypeGuess: guessArticleType(sectionKeys),
  }

  return Promise.resolve({ docx, model })
}
