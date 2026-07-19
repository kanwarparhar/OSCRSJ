// Title-page builder (Sushant, Session B). Rebuild a standalone title-page
// .docx from extracted structured metadata in the exact element order the
// journal specifies (rules.title_page.elements). This is a from-scratch build,
// not an edit of the manuscript body — it carries only the structured title-page
// fields, so a rebuild is content-safe.

import type { ExtractedTitlePageData, FormattingContext } from '../types'
import type { TitlePageElement } from '../rulesSchema'
import { createDocx, paraXml } from './docx'

export interface TitlePageResult {
  bytes: Uint8Array
  /** Elements actually rendered, in order — asserted by the golden test. */
  order: TitlePageElement[]
  /** Elements emitted as a placeholder because no value was extracted. */
  placeholders: TitlePageElement[]
}

/**
 * Prompt text for an element the journal requires but we could not extract.
 * The file is a STARTING DRAFT: a bracketed prompt tells the author exactly
 * what to supply. A value is NEVER invented, and an element the journal asked
 * for is never silently dropped — a missing heading is far easier to miss than
 * a bracket. Everything here is a question to the author, not an answer.
 */
const PLACEHOLDER_PROMPT: Record<TitlePageElement, string> = {
  article_title: 'Add: article title',
  running_title: 'Add: running title',
  article_type: 'Add: article type',
  authors: 'Add: author names, in submission order',
  affiliations: 'Add: author affiliations, numbered',
  corresponding_author: 'Add: corresponding author name, address, email, phone',
  orcid: 'Add: ORCID iD for each author',
  abstract: 'Add: abstract',
  keywords: 'Add: keywords',
  word_count_abstract: 'Add: abstract word count',
  word_count_manuscript: 'Add: manuscript word count',
  figure_count: 'Add: number of figures',
  table_count: 'Add: number of tables',
  funding: 'Add: funding statement, or state that no funding was received',
  disclosures: 'Add: conflict-of-interest disclosures for every author',
  acknowledgments: 'Add: acknowledgments, if any',
  ethics_statement: 'Add: ethics approval / IRB statement',
  data_availability: 'Add: data availability statement',
  highlights: 'Add: highlights',
  date: 'Add: submission date',
}

function applyTitleCase(s: string, mode: 'title' | 'sentence' | null): string {
  if (mode === 'title') {
    return s.replace(/\b\w/g, (c) => c.toUpperCase())
  }
  if (mode === 'sentence') {
    const lower = s.toLowerCase()
    return lower.charAt(0).toUpperCase() + lower.slice(1)
  }
  return s
}

function formatAuthorLine(
  authors: ExtractedTitlePageData['authors'],
  degrees: 'include' | 'strip' | null,
): string {
  return authors
    .map((a) => {
      const name =
        degrees !== 'strip' && a.degrees ? `${a.name}, ${a.degrees}` : a.name
      const sup = a.affiliationRefs.length ? a.affiliationRefs.join(',') : ''
      return sup ? `${name}${sup}` : name
    })
    .join(', ')
}

export function buildTitlePage(
  data: ExtractedTitlePageData,
  ctx: FormattingContext,
): TitlePageResult {
  const paras: string[] = []
  const order: TitlePageElement[] = []
  const seps = ctx.rules.abstract.keywords.separator === 'semicolon' ? '; ' : ', '

  const placeholders: TitlePageElement[] = []

  const push = (el: TitlePageElement, xml: string | string[]) => {
    order.push(el)
    if (Array.isArray(xml)) paras.push(...xml)
    else paras.push(xml)
  }

  /** Emit a bracketed prompt for a required element we have no value for. */
  const placeholder = (el: TitlePageElement) => {
    placeholders.push(el)
    push(el, paraXml(`[${PLACEHOLDER_PROMPT[el]}]`, { italic: true }))
  }

  for (const el of ctx.rules.title_page.elements) {
    switch (el) {
      case 'article_title':
        if (data.title)
          push(el, paraXml(applyTitleCase(data.title, ctx.rules.misc.title_case), {
            align: 'center',
            bold: true,
            sizePt: 14,
          }))
        else placeholder(el)
        break
      case 'running_title':
        if (data.runningTitle) push(el, paraXml(`Running title: ${data.runningTitle}`))
        else placeholder(el)
        break
      case 'authors':
        if (data.authors.length)
          push(el, paraXml(formatAuthorLine(data.authors, ctx.rules.title_page.authors_degrees), {
            align: 'center',
          }))
        else placeholder(el)
        break
      case 'affiliations':
        if (data.affiliations.length)
          push(
            el,
            data.affiliations.map((a, i) => paraXml(`${i + 1}. ${a}`, { italic: true })),
          )
        else placeholder(el)
        break
      case 'corresponding_author': {
        const c = data.correspondingAuthor
        if (c && (c.name || c.address || c.email || c.phone)) {
          const lines = [paraXml('Corresponding author:', { bold: true })]
          // Each sub-field gets its own prompt: a title page missing only the
          // email is the single most common reject-on-submission cause.
          lines.push(paraXml(c.name ?? '[Add: corresponding author name]', c.name ? {} : { italic: true }))
          lines.push(paraXml(c.address ?? '[Add: corresponding author address]', c.address ? {} : { italic: true }))
          lines.push(paraXml(c.email ?? '[Add: corresponding author email]', c.email ? {} : { italic: true }))
          if (c.phone) lines.push(paraXml(c.phone))
          if (!c.name || !c.address || !c.email) placeholders.push(el)
          order.push(el)
          paras.push(...lines)
        } else placeholder(el)
        break
      }
      case 'keywords':
        if (data.keywords.length) push(el, paraXml(`Keywords: ${data.keywords.join(seps)}`))
        else placeholder(el)
        break
      case 'orcid': {
        const withOrcid = data.authors.filter((a) => a.orcid)
        if (withOrcid.length)
          push(el, withOrcid.map((a) => paraXml(`${a.name} — ORCID: ${a.orcid}`)))
        else placeholder(el)
        break
      }
      default:
        // word_count_*, figure/table counts, funding, disclosures, acknowledgments,
        // ethics_statement, data_availability, highlights, date, article_type and
        // abstract are not extracted. They are journal-REQUIRED elements, so they
        // are prompted for rather than silently omitted — a missing heading is
        // much easier for an author to overlook than a bracketed prompt.
        placeholder(el)
        break
    }
  }

  const font = ctx.rules.layout.font.family ?? 'Times New Roman'
  const size = ctx.rules.layout.font.size_pt ?? 12
  return { bytes: createDocx(paras, font, size).toUint8Array(), order, placeholders }
}
