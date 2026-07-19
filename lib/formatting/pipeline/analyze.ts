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

/**
 * Report-only figure checks (Session 97, Part C). Figure uploads were accepted,
 * stored, and then read by nothing — a silent no-op.
 *
 * CHECKS ONLY. Nothing here decodes, converts, resizes or renames an image; the
 * author's files are passed through untouched. DPI / resolution checking is
 * deliberately DEFERRED: it requires image decoding (sharp), which is not in
 * this brief. Do not add it here without that dependency and a size budget.
 *
 * Null doctrine applies: a journal that states no figure cap and no accepted
 * formats produces no figure flags at all, rather than a guessed default.
 */
export function analyzeFigures(input: {
  rules: JournalRules
  articleType: ArticleType
  /** How many figures the author attached (0 when none). */
  figureCount: number
  /** The author's figure filenames, when known. */
  figureFilenames: string[]
}): ReportSuggestion[] {
  const { rules, articleType, figureCount, figureFilenames } = input
  const out: ReportSuggestion[] = []
  // Same accessor the Finder scores figure limits through, so the two tools
  // cannot drift on what a journal's figure cap is.
  const cap = rules.word_limits[articleType]?.figures_max ?? null

  if (cap != null && figureCount > cap) {
    out.push({
      title: `Too many figures (${figureCount} / max ${cap})`,
      location: null,
      detail: `${rules.identity.name} allows at most ${cap} figure${cap === 1 ? '' : 's'} for this article type. Remove ${figureCount - cap}, or combine panels into a single composite figure.`,
      suggestedWording: null,
      severity: 'action-required',
    })
  }

  // Format check. rules.figures.formats is a closed enum list; an empty list
  // means the journal states nothing, so nothing is checked.
  const accepted = rules.figures.formats
  if (accepted.length > 0 && figureFilenames.length > 0) {
    const acceptedSet = new Set<string>(accepted)
    // tif/tiff and jpg/jpeg are the same format under two spellings; a journal
    // naming one accepts the other.
    if (acceptedSet.has('tif') || acceptedSet.has('tiff')) {
      acceptedSet.add('tif')
      acceptedSet.add('tiff')
    }
    if (acceptedSet.has('jpg') || acceptedSet.has('jpeg')) {
      acceptedSet.add('jpg')
      acceptedSet.add('jpeg')
    }
    const bad = figureFilenames.filter((n) => {
      const ext = n.toLowerCase().split('.').pop()
      // No extension at all tells us nothing — do not flag on a guess.
      return ext && ext !== n.toLowerCase() && !acceptedSet.has(ext)
    })
    if (bad.length > 0) {
      out.push({
        title: `Figure format not accepted (${bad.length} file${bad.length === 1 ? '' : 's'})`,
        location: bad.join(', '),
        detail: `${rules.identity.name} accepts ${accepted.join(', ').toUpperCase()} figure files. Re-export the listed file${bad.length === 1 ? '' : 's'} in an accepted format before submitting.`,
        suggestedWording: null,
        severity: 'action-required',
      })
    }
  }

  if (figureCount > 0 && figureFilenames.length === 0) {
    out.push({
      title: 'Attach your figures as separate files',
      location: null,
      detail: `Your manuscript refers to ${figureCount} figure${figureCount === 1 ? '' : 's'}, but none were attached here. Most journals, ${rules.identity.name} included, require figures as separate high-resolution files rather than embedded in the Word document.`,
      suggestedWording: null,
      severity: 'info',
    })
  }

  if (figureCount > 0 && cap != null && figureCount <= cap) {
    out.push({
      title: `Figure count within the limit (${figureCount} / max ${cap})`,
      location: null,
      detail: `${rules.identity.name} allows up to ${cap} figure${cap === 1 ? '' : 's'} for this article type. Resolution and file-format requirements still apply; we check formats but not DPI.`,
      suggestedWording: null,
      severity: 'info',
    })
  }

  return out
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
  // A draft title page IS generated again (reinstated 2026-07-18), but it is a
  // starting draft with bracketed prompts for anything we could not extract, so
  // uploading a verified title page remains the author's action item.
  if (rules.blinding.separate_title_page) {
    checklist.push({
      requirement: 'Separate title page uploaded as its own file',
      status: 'action-needed',
    })
  }

  // --- references: some journals require ALL authors (no "et al.") ---
  // et_al_threshold === null encodes "list every author". The engine never
  // rewrites the author's reference list (content immutability), so a
  // truncated list is flagged for the author instead. JBJS is the canonical
  // case: "journal citations must include all authors (not et al.)".
  if (rules.references.et_al_threshold === null && model.rawReferences.some((r) => /\bet al\b/i.test(r))) {
    suggestions.push({
      title: 'References must list all authors — no “et al.”',
      location: 'References',
      detail: `${rules.identity.name} requires every author to be named in each reference. Some of your references truncate the author list with “et al.” — expand each one to list all authors (update your citation-manager style, e.g. switch Zotero/EndNote to the journal's own style, then regenerate the bibliography).`,
      suggestedWording: null,
      severity: 'action-required',
    })
    checklist.push({ requirement: 'References list all authors (no “et al.”)', status: 'action-needed' })
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
