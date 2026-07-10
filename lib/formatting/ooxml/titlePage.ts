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

  const push = (el: TitlePageElement, xml: string | string[]) => {
    order.push(el)
    if (Array.isArray(xml)) paras.push(...xml)
    else paras.push(xml)
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
        break
      case 'running_title':
        if (data.runningTitle) push(el, paraXml(`Running title: ${data.runningTitle}`))
        break
      case 'authors':
        if (data.authors.length)
          push(el, paraXml(formatAuthorLine(data.authors, ctx.rules.title_page.authors_degrees), {
            align: 'center',
          }))
        break
      case 'affiliations':
        if (data.affiliations.length)
          push(
            el,
            data.affiliations.map((a, i) => paraXml(`${i + 1}. ${a}`, { italic: true })),
          )
        break
      case 'corresponding_author': {
        const c = data.correspondingAuthor
        if (c) {
          const lines = [paraXml('Corresponding author:', { bold: true })]
          if (c.name) lines.push(paraXml(c.name))
          if (c.address) lines.push(paraXml(c.address))
          if (c.email) lines.push(paraXml(c.email))
          if (c.phone) lines.push(paraXml(c.phone))
          push(el, lines)
        }
        break
      }
      case 'keywords':
        if (data.keywords.length) push(el, paraXml(`Keywords: ${data.keywords.join(seps)}`))
        break
      case 'orcid': {
        const withOrcid = data.authors.filter((a) => a.orcid)
        if (withOrcid.length)
          push(el, withOrcid.map((a) => paraXml(`${a.name} — ORCID: ${a.orcid}`)))
        break
      }
      default:
        // word_count_*, figure/table counts, funding, disclosures, acknowledgments,
        // ethics_statement, data_availability, highlights, date, article_type, abstract
        // are populated by the pipeline once those values are computed (Session C).
        break
    }
  }

  const font = ctx.rules.layout.font.family ?? 'Times New Roman'
  const size = ctx.rules.layout.font.size_pt ?? 12
  return { bytes: createDocx(paras, font, size).toUint8Array(), order }
}
