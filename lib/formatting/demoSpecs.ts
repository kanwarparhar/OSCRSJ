// Demo specs for the interactive Word mock on /studio/format (Session 97).
//
// SERVER / BUILD ONLY — imports ./journalList, which imports every rule JSON.
// A server component calls getDemoSpecs() and passes the result to the client
// <WordDemo> as a prop, same contract as JOURNAL_SUMMARIES.
//
// WHY THIS EXISTS INSTEAD OF A HAND-WRITTEN FIXTURE: the demo's whole claim is
// "this is what we actually do to your manuscript for this journal." If the demo
// were hand-authored it would drift from the rule files the moment a journal
// changed its guide, and the page would be lying about the product's core
// promise on the product's own landing page. Deriving it from JOURNALS_BY_SLUG
// means the demo is wrong only if the pipeline is also wrong.
//
// NULL DISCIPLINE: every field is nullable and null is passed through, never
// defaulted. Where a journal's guide is silent the demo must SAY it is silent
// ("not specified — your choice preserved"), because that is precisely the
// "Never invents a requirement" guarantee three sections further down the page.
// Do not "improve" this by filling gaps with sensible defaults.

import { JOURNALS_BY_SLUG } from './journalList'

export interface DemoSpec {
  slug: string
  name: string
  /** Short label for the chip row. */
  abbrev: string
  guidelinesUrl: string
  /** ISO date the rules were last verified against the live guide. */
  verifiedDate: string
  layout: {
    fontFamily: string | null
    fontSizePt: number | null
    lineSpacing: 'single' | '1.5' | 'double' | null
    /** null = the guide is silent, so the author's setting is preserved. */
    lineNumbers: 'none' | 'continuous' | 'per_page' | null
    /** Uniform margin in mm when all four sides match, else null. */
    marginMm: number | null
  }
  references: {
    style: string
    inText: 'superscript' | 'bracket' | 'paren'
    inTextPunctuation: 'before' | 'after' | null
    etAlThreshold: number | 'all' | null
    maxCount: number | null
  }
}

/**
 * The journals in the demo's chip row.
 *
 * Chosen so that clicking between them produces a genuinely different document —
 * that is the entire point of the control. Each one earns its slot:
 *   jbjs   — TNR 12pt, continuous line numbers, NLM superscript      → "described.¹"
 *   corr   — TNR 12pt, line numbers OFF, AMA bracket, punct before   → "described [1]."
 *   ajsm   — publishes NO font rule → we keep the author's and say so (the guarantee, live)
 *   acta-orthopaedica — Vancouver parenthetical, 25-reference cap    → "described (1)"
 *   european-spine-journal — Times Roman 10pt, spacing unspecified, line numbers off
 *
 * `spine` was in this list and was pulled: it is near-identical to `ajsm`
 * (unspecified font, double, continuous, AMA, superscript), so clicking between
 * the two changed almost nothing and made the demo look broken rather than
 * precise. If you re-order this list, re-check that adjacent entries actually
 * differ — a chip that changes nothing is worse than no chip.
 */
export const DEMO_SLUGS = ['jbjs', 'corr', 'ajsm', 'acta-orthopaedica', 'european-spine-journal'] as const

/** Chip labels. Kept here (not registry-meta's abbrevs) so the row stays short. */
const CHIP_LABEL: Record<string, string> = {
  jbjs: 'JBJS',
  corr: 'CORR',
  ajsm: 'AJSM',
  'acta-orthopaedica': 'Acta Orthop',
  'european-spine-journal': 'Eur Spine J',
}

function uniformMargin(m: unknown): number | null {
  if (!m || typeof m !== 'object') return null
  const { top_mm, bottom_mm, left_mm, right_mm } = m as Record<string, number | null>
  if ([top_mm, bottom_mm, left_mm, right_mm].some((v) => typeof v !== 'number')) return null
  return top_mm === bottom_mm && top_mm === left_mm && top_mm === right_mm ? (top_mm as number) : null
}

/**
 * Build the client-safe demo payload from the real encoded rules.
 * Unknown slugs are skipped rather than faked, so a journal being renamed or
 * dropped from the registry degrades to a shorter chip row, never to invented data.
 */
export function getDemoSpecs(slugs: readonly string[] = DEMO_SLUGS): DemoSpec[] {
  const out: DemoSpec[] = []
  for (const slug of slugs) {
    const j = JOURNALS_BY_SLUG[slug]
    if (!j) continue
    const font = j.layout.font ?? { family: null, size_pt: null }
    out.push({
      slug,
      name: j.identity.name,
      abbrev: CHIP_LABEL[slug] ?? slug.toUpperCase(),
      guidelinesUrl: j.identity.guidelines_url,
      verifiedDate: j.identity.verified_date,
      layout: {
        fontFamily: font.family ?? null,
        fontSizePt: font.size_pt ?? null,
        lineSpacing: j.layout.line_spacing ?? null,
        lineNumbers: j.layout.line_numbers,
        marginMm: uniformMargin(j.layout.margins_mm),
      },
      references: {
        style: j.references.style,
        inText: j.references.in_text,
        inTextPunctuation: j.references.in_text_punctuation ?? null,
        etAlThreshold: j.references.et_al_threshold ?? null,
        maxCount: j.references.max_count ?? null,
      },
    })
  }
  return out
}
