// Deterministic manuscript analysis (Sushant, Session C). Compares the parsed
// ContentModel against the journal rules to produce the report's "Suggested
// changes (author action required)" list + the submission checklist. These are
// FLAG items — the engine never auto-edits prose to satisfy them. No LLM.

import type { ContentModel, ReportSuggestion, ChecklistRow } from '../types'
import type { JournalRules, ArticleType } from '../rulesSchema'

const NON_MANUSCRIPT = new Set(['abstract', 'keywords', 'references', 'figure_legends'])

const norm = (s: string): string =>
  s.toLowerCase().replace(/^[0-9]+[.):]\s*/, '').replace(/[:.]$/, '').replace(/\s+/g, ' ').trim()

/** Body word count excluding abstract / keywords / references / figure legends. */
export function manuscriptWordCount(model: ContentModel): number {
  return model.detectedSections
    .filter((s) => !NON_MANUSCRIPT.has(s.normalized))
    .reduce((n, s) => n + s.wordCount, 0)
}

export function analyze(input: {
  model: ContentModel
  rules: JournalRules
  articleType: ArticleType
  keywordCount: number | null
}): { suggestions: ReportSuggestion[]; checklist: ChecklistRow[] } {
  const { model, rules, articleType, keywordCount } = input
  const suggestions: ReportSuggestion[] = []
  const checklist: ChecklistRow[] = []
  const limits = rules.word_limits[articleType]
  const detected = new Set(model.detectedSections.map((s) => s.normalized))

  // --- word limit ---
  const words = manuscriptWordCount(model)
  if (limits?.manuscript_max_words != null) {
    const cap = limits.manuscript_max_words
    if (words > cap) {
      suggestions.push({
        title: `Over the ${cap}-word limit`,
        location: `Manuscript body is ~${words} words`,
        detail: `Trim ~${words - cap} words. The ${cap}-word cap excludes the abstract, references, figure legends, and tables.`,
        suggestedWording: null,
        severity: 'action-required',
      })
      checklist.push({ requirement: `Within ${cap}-word limit`, status: 'action-needed' })
    } else {
      checklist.push({ requirement: `Within ${cap}-word limit`, status: 'met' })
    }
  }

  // --- required sections present + in order ---
  const required = (rules.sections[articleType] ?? []).map(norm)
  const missing = required.filter((r) => !Array.from(detected).some((d) => d === r || d.includes(r) || r.includes(d)))
  for (const m of missing) {
    suggestions.push({
      title: `Missing required section: “${m}”`,
      location: null,
      detail: `${rules.identity.name} requires a “${m}” section for this article type. Add it in the journal's specified order.`,
      suggestedWording: null,
      severity: 'action-required',
    })
  }
  if (required.length) {
    checklist.push({
      requirement: 'Required sections present',
      status: missing.length === 0 ? 'met' : 'action-needed',
    })
  }

  // --- reference count range ---
  const refCount = model.rawReferences.length
  if (limits?.references_max != null && refCount > limits.references_max) {
    suggestions.push({
      title: `Too many references (${refCount} / max ${limits.references_max})`,
      location: null,
      detail: `Reduce to at most ${limits.references_max} references for this article type.`,
      suggestedWording: null,
      severity: 'action-required',
    })
  }
  if (limits?.references_min != null && refCount > 0 && refCount < limits.references_min) {
    suggestions.push({
      title: `Few references (${refCount} / min ${limits.references_min})`,
      location: null,
      detail: `${rules.identity.name} expects at least ${limits.references_min} references for this article type.`,
      suggestedWording: null,
      severity: 'suggestion',
    })
  }
  if (limits?.references_max != null) {
    const okRefs =
      (limits.references_min == null || refCount >= limits.references_min) &&
      refCount <= limits.references_max
    checklist.push({ requirement: 'Reference count in range', status: okRefs ? 'met' : 'action-needed' })
  }

  // --- keywords ---
  const kw = rules.abstract.keywords
  if (kw.required && keywordCount != null) {
    const under = kw.min != null && keywordCount < kw.min
    const over = kw.max != null && keywordCount > kw.max
    if (under || over) {
      suggestions.push({
        title: `Keyword count (${keywordCount})`,
        location: null,
        detail: `Provide ${kw.min ?? '?'}–${kw.max ?? '?'} keywords (MeSH terms where possible).`,
        suggestedWording: null,
        severity: 'action-required',
      })
    }
    checklist.push({ requirement: 'Keyword count in range', status: under || over ? 'action-needed' : 'met' })
  }

  // --- blinding / separate title page ---
  if (rules.blinding.separate_title_page) {
    checklist.push({
      requirement: 'Separate anonymized title page',
      status: 'fixed',
    })
  }

  // --- structured abstract (info-level: hard to verify deterministically) ---
  if (rules.abstract.structured && rules.abstract.sections?.length) {
    suggestions.push({
      title: 'Structured abstract required',
      location: null,
      detail: `Ensure the abstract uses the journal's labeled sections: ${rules.abstract.sections.join(', ')}${rules.abstract.max_words ? ` (≤${rules.abstract.max_words} words)` : ''}.`,
      suggestedWording: null,
      severity: 'info',
    })
  }

  return { suggestions, checklist }
}
