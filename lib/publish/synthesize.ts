'use server'

// Renderer payload synthesizer — Session 53 (2026-05-15) + Session 57
// (2026-05-15) Pre-Render Metadata Editor extension.
//
// Joins the manuscripts row + manuscript_authors + manuscript_affiliations +
// manuscript_metadata + the corresponding author's `users` row + the
// latest editorial_decisions row (for handling-editor) into the Franklin
// v1.0 payload shape consumed by the OSCRSJ Renderer chain.
//
// Session 57 deltas (Janine compliance spec sign-off):
//   - Reads 6 new metadata columns from migration 022:
//       patient_consent_variant (7-variant CHECK constraint)
//       patient_consent_statement
//       patient_consent_irb_institution
//       patient_consent_irb_protocol
//       acknowledgments
//       equal_contribution_statement
//   - Reads is_equal_contribution per manuscript_author (migration 022).
//   - Derives equal_contribution.present = (≥2 authors flagged AND
//     statement non-null).
//   - Resolves handling_editor from editorial_decisions.editor_id →
//     users join. Renders as JATS <contrib contrib-type="editor">.
//   - Emits xmpRights_WebStatement in xmp_metadata block per Janine
//     §7.2.g (carryforward from ^handoff-pdf-template-license-fix).
//     Renderer xmp.ts emits the actual XMP packet field; this just
//     ships the data.
//   - Removes the adult_living hardcode for patient_consent.
//
// Scope decision (Kanwar, 2026-05-15):
//   - body: []    — body content comes from the renderer's cleanedHtml
//                   (Pandoc-on-.docx + editor cleanup), not from DB.
//   - references: [] — no manuscript_references table exists yet; ship
//                   migration 021 next session. PMC indexing blocked until
//                   refs land, but PDF/A-1b ships fine without them.
//
// Tracks Manvir handoff ^handoff-renderer-payload-synthesizer-2026-05-15
// + Sushant build brief 02 - OSCRSJ/Projects/Pre-Render Metadata Editor —
// Sushant Build Brief.md.

import { createAdminClient } from '@/lib/supabase/server'
import type {
  ManuscriptRow,
  ManuscriptAuthorRow,
  ManuscriptAffiliationRow,
  ManuscriptType,
  PatientConsentVariant,
  UserRow,
} from '@/lib/types/database'

// ============================================================
// Type — mirrors the renderer's ArticlePayload (sanityTests.ts).
// Kept structurally compatible; renderer's sanity pass is the
// canonical contract.
// ============================================================

export interface RendererPayload {
  $schema: string
  article: {
    id: string
    type: string
    article_type_slug: string
    title: string
    running_title: string
    doi: string
    doi_url: string
    license: {
      code: string
      url: string
    }
  }
  issue: {
    journal_short: string
    journal_full: string
    issn_electronic: string
    year: number
    volume: number
    issue_number: number
    month_short: string
    issue_slug: string
    issue_cover_date: string
  }
  dates: {
    received: string
    accepted: string
    published: string
  }
  authors: Array<{
    ordinal: number
    given_name: string
    middle_initial: string | null
    family_name: string
    degrees: string
    display_name: string
    orcid: string | null
    orcid_url: string | null
    affiliation_refs: number[]
    is_corresponding: boolean
    is_equal_contribution: boolean
    credit_roles: string[]
  }>
  affiliations: Array<{
    number: number
    text: string
  }>
  corresponding_author: {
    display_name: string
    affiliation_address: string
    email: string
    orcid_url: string | null
  }
  equal_contribution: {
    present: boolean
    statement: string | null
  }
  // Session 57 — handling-editor JOIN. Surfaced in the Pre-Render
  // Metadata Editor §3 Authors display block and emitted by the
  // renderer as JATS <contrib contrib-type="editor">. Null when no
  // editorial_decisions row exists (e.g., desk-accepted manuscripts
  // — rare).
  handling_editor: {
    display_name: string
    affiliation: string | null
  } | null
  abstract: {
    format: 'structured' | 'unstructured'
    sections?: Array<{ label: string; text: string }>
    text?: string
  }
  keywords: string[]
  body: never[]
  declarations: {
    funding: string
    conflicts_of_interest: string
    coi_short: string
    patient_consent: { variant: string; statement: string }
    irb_ethics: { branch: string; statement: string }
    data_availability: string
    credit_author_contributions: string
    ai_disclosure: {
      used: boolean
      statement: string
    }
    acknowledgments: string | null
  }
  references: never[]
  suggested_citation_html: string
  xmp_metadata: Record<string, unknown>
}

export interface SynthesizeResult {
  ok: boolean
  payload: RendererPayload | null
  warnings: string[]
  errors: string[]
}

// ============================================================
// Constants — renderer-side contract shape.
// ============================================================

const SCHEMA_URL = 'https://oscrsj.com/schema/article-payload/v1.0.json'
const LICENSE_CODE = 'CC BY 4.0'
const LICENSE_URL = 'https://creativecommons.org/licenses/by/4.0/'
const JOURNAL_SHORT = 'OSCRSJ'
const JOURNAL_FULL = 'Orthopedic Surgery Case Reports & Series Journal'
const ISSN_PLACEHOLDER = 'XXXX-XXXX'

// ---- DOI identity ----
// Implementation lives in ./doi (dependency-free so client components can
// import it too). It is deliberately NOT re-exported from here: this file
// carries 'use server', and Next only permits async function exports from a
// 'use server' module — re-exporting the constants and sync helpers is what
// broke `next build` on 9f07faa. tsc --noEmit passes either way, so nothing
// short of a real build catches it. Import DOI identity straight from
// '@/lib/publish/doi'.
import { validateRenderIdentity } from './doi'

const RUNNING_TITLE_MAX = 45

// ManuscriptType → display string (matches sample-payload.json `type` values).
const TYPE_DISPLAY: Record<ManuscriptType, string> = {
  case_report: 'Case Report',
  case_series: 'Case Series',
  surgical_technique: 'Surgical Technique',
  images_in_orthopedics: 'Images in Orthopedics',
  letter_to_editor: 'Letter to the Editor',
  // DB enum kept as 'review_article' per Session 50 architecture
  // decision (changing it would require migration + data migration);
  // display label is the canonical SR/MA wording.
  review_article: 'Review Article',
  narrative_review: 'Narrative Review',
}

// ManuscriptType → URL fragment matching /guide-for-authors anchors.
const TYPE_SLUG: Record<ManuscriptType, string> = {
  case_report: 'case-report',
  case_series: 'case-series',
  surgical_technique: 'surgical-technique',
  images_in_orthopedics: 'images-in-orthopedics',
  letter_to_editor: 'letter-to-the-editor',
  review_article: 'systematic-review-meta-analysis',
  narrative_review: 'narrative-review',
}

// Expected abstract section count by article type. Matches
// renderer's STRUCTURED_ABSTRACT_SECTION_COUNT (sanityTests.ts).
const STRUCTURED_ABSTRACT_COUNT: Partial<Record<ManuscriptType, number>> = {
  case_report: 4,
  case_series: 5,
  review_article: 4,
  // Session 78 — Narrative Review: Background / Scope / Findings / Conclusion
  narrative_review: 4,
}

// Per-type example label hint surfaced in the abstract-structure validation
// message so editors see the labels that actually parse for THIS article type
// (the recognized-anchor set includes Scope/Findings for narrative reviews).
const ABSTRACT_LABEL_HINT: Partial<Record<ManuscriptType, string>> = {
  case_report: 'Introduction:/Case Presentation:/Discussion:/Conclusion:',
  case_series: 'Introduction:/Methods:/Results:/Discussion:/Conclusion:',
  review_article: 'Introduction:/Methods:/Results:/Conclusion:',
  narrative_review: 'Background:/Scope:/Findings:/Conclusion:',
}
const UNSTRUCTURED_TYPES = new Set<ManuscriptType>(['surgical_technique'])
const NO_ABSTRACT_TYPES = new Set<ManuscriptType>([
  'letter_to_editor',
  'images_in_orthopedics',
])

// Body-structural limits per article type (Session 80, 2026-06-10).
// Source of truth: /guide-for-authors Article Types Comparison table
// (`comparisonRows` in app/guide-for-authors/page.tsx). If the guide
// changes, these must change in lockstep — grep 'comparisonRows'.
const BODY_WORD_LIMITS: Record<ManuscriptType, number> = {
  case_report: 2000,
  case_series: 3000,
  review_article: 3500,
  narrative_review: 4000,
  surgical_technique: 1500,
  images_in_orthopedics: 500,
  letter_to_editor: 600,
}
const FIGURE_LIMITS: Record<ManuscriptType, number> = {
  case_report: 8,
  case_series: 10,
  review_article: 6,
  narrative_review: 4,
  surgical_technique: 10,
  images_in_orthopedics: 4,
  letter_to_editor: 1,
}
const TABLE_LIMITS: Record<ManuscriptType, number> = {
  case_report: 3,
  case_series: 5,
  review_article: 4,
  narrative_review: 3,
  surgical_technique: 2,
  images_in_orthopedics: 0,
  letter_to_editor: 1,
}

const MONTH_SHORT = [
  'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN',
  'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC',
]

// ============================================================
// Draft overlay shape for live editor validation (Session 57,
// Phase 1.B). Allows previewMetadataValidation to overlay
// in-progress editor state onto DB rows BEFORE running the
// synthesizer; gives Franklin §5 the 500ms-debounced live
// validation without writing to DB on every keystroke.
// ============================================================

export interface ManuscriptDraftOverlay {
  // Article Identity
  title?: string | null
  running_title?: string | null
  keywords?: string[] | null
  doi?: string | null
  // Abstract
  abstract?: string | null
  // Authors (full author array overlay; ordered as displayed in editor)
  authors?: Array<{
    id?: string | null
    full_name?: string
    degrees?: string | null
    email?: string
    affiliation?: string | null
    orcid_id?: string | null
    contribution?: string | null
    is_corresponding?: boolean
    is_equal_contribution?: boolean
    author_order?: number
  }>
  // Declarations
  conflict_of_interest?: string | null
  funding_sources?: string[] | null
  data_availability_statement?: string | null
  ethics_approval_number?: string | null
  ai_tools_used?: boolean | null
  ai_tools_details?: string | null
  patient_consent_variant?: PatientConsentVariant | null
  patient_consent_statement?: string | null
  patient_consent_irb_institution?: string | null
  patient_consent_irb_protocol?: string | null
  acknowledgments?: string | null
  equal_contribution_statement?: string | null
}

// ============================================================
// Janine §8 + baseline validation rules — runs on whatever
// shape the editor has on screen. Surfaces as the §5
// Validation Summary three-tier red/amber/green.
// ============================================================

export interface ValidationRow {
  severity: 'error' | 'warning'
  rule: string
  message: string
  // CSS selector or anchor token the §5 "Jump to fix" link
  // scrolls to. Optional — some checks (e.g., affiliations
  // table empty) have no editable target in Phase 1.
  targetField?: string
}

// Pure validator — accepts the fully-merged editor draft shape,
// returns the validator output. NO DB calls. Async because the
// enclosing module carries 'use server' (Next.js 14 server-function
// rule). Called both by the live previewMetadataValidation server
// action and by synthesizeRendererPayload (which feeds DB rows
// through the same validator after overlay).
export async function validateMetadataForRender(merged: {
  manuscript_type: ManuscriptType | null
  title: string
  running_title: string
  doi: string
  keywords: string[]
  abstract: string
  submission_date: string | null
  authors: Array<{
    full_name: string
    email: string
    affiliation: string
    orcid_id: string
    contribution: string
    is_corresponding: boolean
    is_equal_contribution: boolean
  }>
  conflict_of_interest: string
  funding_sources: string[]
  data_availability_statement: string
  ai_tools_used: boolean | null
  ai_tools_details: string
  patient_consent_variant: PatientConsentVariant | null
  patient_consent_statement: string
  patient_consent_irb_institution: string
  patient_consent_irb_protocol: string
  equal_contribution_statement: string
  has_affiliations_table_data: boolean
  // ---- Body-structural inputs (Session 80, 2026-06-10) — both optional
  // so existing callers compile unchanged. body_html is the admin-curated
  // manuscripts.manuscript_body_cleaned_html (migration 024); when the
  // editor hasn't saved one, the body lives only in the .docx and the
  // word/table checks are skipped (Pandoc extract is renderer-side).
  // figure_count is the count of manuscript_files rows with
  // file_type='figure' (the real upload channel per Session 62 tier-3).
  body_html?: string | null
  figure_count?: number | null
}): Promise<{ errors: ValidationRow[]; warnings: ValidationRow[] }> {
  const errors: ValidationRow[] = []
  const warnings: ValidationRow[] = []

  // ---- Baseline synthesizer rules (kept consistent with main path) ----

  if (!merged.manuscript_type) {
    errors.push({
      severity: 'error',
      rule: 'manuscript_type-required',
      message: 'Article type is missing. This is locked at submission; contact Sushant if it needs to change.',
      targetField: 'manuscript_type',
    })
  }

  if (!merged.title.trim()) {
    errors.push({
      severity: 'error',
      rule: 'title-required',
      message: 'Title is empty.',
      targetField: 'title',
    })
  }

  if (merged.authors.length === 0) {
    errors.push({
      severity: 'error',
      rule: 'authors-required',
      message: 'At least one author is required.',
      targetField: 'authors',
    })
  }

  const correspondingAuthors = merged.authors.filter((a) => a.is_corresponding)
  if (correspondingAuthors.length === 0) {
    errors.push({
      severity: 'error',
      rule: 'corresponding-author-required',
      message: 'Exactly one author must be flagged corresponding. Currently zero are flagged.',
      targetField: 'authors',
    })
  } else if (correspondingAuthors.length > 1) {
    errors.push({
      severity: 'error',
      rule: 'corresponding-author-unique',
      message: `Exactly one author must be flagged corresponding. Currently ${correspondingAuthors.length} are flagged.`,
      targetField: 'authors',
    })
  }

  // Per-author affiliation
  for (let i = 0; i < merged.authors.length; i++) {
    const a = merged.authors[i]
    if (!a.full_name.trim()) {
      errors.push({
        severity: 'error',
        rule: `author-${i}-name-required`,
        message: `Author ${i + 1} has no name.`,
        targetField: `author-${i}-name`,
      })
    }
    if (!a.email.trim()) {
      errors.push({
        severity: 'error',
        rule: `author-${i}-email-required`,
        message: `Author "${a.full_name || `#${i + 1}`}" has no email.`,
        targetField: `author-${i}-email`,
      })
    }
    if (!a.affiliation.trim()) {
      errors.push({
        severity: 'error',
        rule: `author-${i}-affiliation-required`,
        message: `Author "${a.full_name || `#${i + 1}`}" has no affiliation.`,
        targetField: `author-${i}-affiliation`,
      })
    }
    if (!a.contribution.trim()) {
      warnings.push({
        severity: 'warning',
        rule: `author-${i}-credit-empty`,
        message: `Author "${a.full_name || `#${i + 1}`}" has no CRediT roles. JATS sanity test will fail.`,
        targetField: `author-${i}-credit`,
      })
    }
  }

  // Keywords cardinality
  if (merged.keywords.length < 3 || merged.keywords.length > 5) {
    warnings.push({
      severity: 'warning',
      rule: 'keywords-cardinality',
      message: `Keywords cardinality is ${merged.keywords.length}; renderer sanity test requires 3–5.`,
      targetField: 'keywords',
    })
  }

  // Running title length
  if (merged.running_title.length > RUNNING_TITLE_MAX) {
    warnings.push({
      severity: 'warning',
      rule: 'running-title-length',
      message: `running_title is ${merged.running_title.length} chars (max ${RUNNING_TITLE_MAX} — will truncate in @top-center header).`,
      targetField: 'running_title',
    })
  }

  // Affiliations table empty
  if (!merged.has_affiliations_table_data) {
    warnings.push({
      severity: 'warning',
      rule: 'affiliations-table-empty',
      message: 'Affiliations table empty — synthesizing from author free-text strings. Multi-affiliation authors will collapse to single-affiliation.',
    })
  }

  // Abstract structure (per article type)
  if (merged.manuscript_type) {
    const expected = STRUCTURED_ABSTRACT_COUNT[merged.manuscript_type]
    if (expected) {
      const txt = merged.abstract || ''
      const ANCHORS = ['Introduction', 'Background', 'Case Presentation', 'Methods', 'Results', 'Scope', 'Findings', 'Discussion', 'Conclusion', 'Conclusions']
      const anchorRe = new RegExp(
        `(^|\\n|\\.\\s+|\\;\\s+|\\s)\\s*(${ANCHORS.join('|')})\\s*[:\\.]\\s*`,
        'gi'
      )
      const matches: string[] = []
      let m: RegExpExecArray | null
      while ((m = anchorRe.exec(txt)) !== null) matches.push(m[2])
      if (matches.length < expected) {
        errors.push({
          severity: 'error',
          rule: 'abstract-structure',
          message: `Abstract for ${TYPE_DISPLAY[merged.manuscript_type]} expects ${expected} labeled sections; found ${matches.length}. Add labels (${ABSTRACT_LABEL_HINT[merged.manuscript_type] ?? 'Introduction:/Methods:/Results:/Conclusion:'}) or use the Paste-and-Parse assist.`,
          targetField: 'abstract',
        })
      }
    } else if (UNSTRUCTURED_TYPES.has(merged.manuscript_type) && !merged.abstract.trim()) {
      errors.push({
        severity: 'error',
        rule: 'abstract-required',
        message: `${TYPE_DISPLAY[merged.manuscript_type]} requires an abstract.`,
        targetField: 'abstract',
      })
    }
  }

  // ---- Janine §8 hard-required rules (8.1–8.4) ----

  // §8.1 — corresponding author SHOULD have ORCID (amber warning per Kanwar CEO override 2026-05-17)
  // Originally: hard-error per Janine §8.1 / JATS 1.3 / DOAJ. Downgraded to warning so editor can publish
  // without blocking on ORCID chase; ORCID still strongly recommended for DOAJ + PMC indexing trail.
  // Companion: Janine spec amendment ^handoff-janine-orcid-compliance-spec-amendment-2026-05-17.
  const corr = correspondingAuthors[0]
  if (corr && !corr.orcid_id.trim()) {
    warnings.push({
      severity: 'warning',
      rule: 'janine-8.1-corresponding-orcid',
      message: 'Corresponding author has no ORCID iD — strongly recommended for DOAJ + PMC indexing. Ask author to register free at orcid.org (~2 min) and paste here. Render proceeds without it.',
      targetField: 'authors',
    })
  }

  // §8.2 — title trailing period
  if (merged.title.trim().endsWith('.')) {
    errors.push({
      severity: 'error',
      rule: 'janine-8.2-title-trailing-period',
      message: 'Title cannot end in a period (Janine §8.2 — NLM Vancouver style; PMC ingest warns on double-period).',
      targetField: 'title',
    })
  }

  // §8.3 — letter_to_editor requires related_article_doi
  // Phase 2 column; surfacing as informational warning for now per
  // Janine §7.2.e Phase 1 deferral.
  if (merged.manuscript_type === 'letter_to_editor') {
    warnings.push({
      severity: 'warning',
      rule: 'janine-8.3-letter-related-article-doi',
      message: 'Letter to the Editor requires <related-article> DOI (Janine §8.3). Column lands Phase 2 trigger — first letter to reach accepted.',
    })
  }

  // §8.4 — IRB waiver requires institution + protocol
  if (
    merged.patient_consent_variant === 'deceased_irb_waiver' ||
    merged.patient_consent_variant === 'incapacitated_irb_waiver'
  ) {
    if (!merged.patient_consent_irb_institution.trim() || !merged.patient_consent_irb_protocol.trim()) {
      warnings.push({
        severity: 'warning',
        rule: 'janine-8.4-irb-waiver-fields',
        message: `Patient consent variant "${merged.patient_consent_variant}" requires both IRB institution and protocol (Janine §8.4). Without them, the statement will ship with <institution>/<IRB-####> placeholders visible.`,
        targetField: 'patient_consent_irb',
      })
    }
  }

  // ---- §8.6 (cheap to ship — column already exists) ----
  // ICMJE 2024 negative-attestation date guard
  if (merged.ai_tools_used === null || merged.ai_tools_used === undefined) {
    const submittedDate = merged.submission_date ? new Date(merged.submission_date) : null
    const icmjeThreshold = new Date('2024-01-01')
    if (!submittedDate || submittedDate >= icmjeThreshold) {
      warnings.push({
        severity: 'warning',
        rule: 'janine-8.6-ai-disclosure-null',
        message: 'ICMJE 2024 update requires explicit AI-use disclosure (even when no AI was used — negative attestation). Click either radio in §4 Declarations.',
        targetField: 'ai_disclosure',
      })
    }
  }

  // ---- Patient consent (Janine §3) ----
  if (!merged.patient_consent_variant) {
    errors.push({
      severity: 'error',
      rule: 'patient-consent-variant-required',
      message: 'Patient consent variant must be selected (Janine §3 — 7 locked options).',
      targetField: 'patient_consent_variant',
    })
  } else if (
    merged.patient_consent_variant !== 'not_applicable' &&
    !merged.patient_consent_statement.trim()
  ) {
    errors.push({
      severity: 'error',
      rule: 'patient-consent-statement-required',
      message: `Patient consent statement is empty for variant "${merged.patient_consent_variant}". Pre-fill from the variant default or write a custom statement.`,
      targetField: 'patient_consent_statement',
    })
  }

  // ---- Equal contribution coherence ----
  const equalAuthors = merged.authors.filter((a) => a.is_equal_contribution).length
  if (equalAuthors === 1) {
    warnings.push({
      severity: 'warning',
      rule: 'equal-contribution-only-one',
      message: 'Only 1 author is flagged equal-contribution; shared-first-authorship needs ≥2. Either flag another author or uncheck this one.',
      targetField: 'authors',
    })
  } else if (equalAuthors >= 2 && !merged.equal_contribution_statement.trim()) {
    warnings.push({
      severity: 'warning',
      rule: 'equal-contribution-statement-empty',
      message: `${equalAuthors} authors flagged equal-contribution but the statement is empty. Add the verbatim default or write a custom statement.`,
      targetField: 'equal_contribution_statement',
    })
  }

  // ---- Body-structural checks (Session 80, 2026-06-10 — §11 follow-up) ----
  // Until migration 021 lands there is no manuscript_references table, so
  // the payload always ships references: [] and JATS has no <ref-list>.
  // Standing amber so every render acknowledges the PMC-indexing gap.
  warnings.push({
    severity: 'warning',
    rule: 'references-table-empty',
    message:
      'References table is empty — structured references are not collected yet (migration 021 pending), so the JATS XML ships without <ref-list>. PDF body citations are unaffected. Acknowledge to proceed.',
  })

  if (merged.manuscript_type) {
    const typeLabel = TYPE_DISPLAY[merged.manuscript_type]
    if (typeof merged.body_html === 'string' && merged.body_html.trim().length > 0) {
      const tableCount = (merged.body_html.match(/<table\b/gi) || []).length
      // Word limits exclude tables/figure legends per /guide-for-authors;
      // strip <table> blocks before counting, then strip remaining tags
      // and entities. Approximate by design — flagged only when over.
      const sansTables = merged.body_html.replace(/<table\b[\s\S]*?<\/table>/gi, ' ')
      const bodyText = sansTables.replace(/<[^>]+>/g, ' ').replace(/&[a-z#0-9]+;/gi, ' ')
      const wordCount = bodyText.split(/\s+/).filter(Boolean).length
      const wordLimit = BODY_WORD_LIMITS[merged.manuscript_type]
      if (wordCount > wordLimit) {
        warnings.push({
          severity: 'warning',
          rule: 'body-word-limit',
          message: `Body word count ≈ ${wordCount.toLocaleString()} exceeds the ${typeLabel} limit of ${wordLimit.toLocaleString()} (approximate count from the saved body HTML, tables excluded).`,
        })
      }
      const tableLimit = TABLE_LIMITS[merged.manuscript_type]
      if (tableCount > tableLimit) {
        warnings.push({
          severity: 'warning',
          rule: 'body-table-limit',
          message: `Body contains ${tableCount} tables; the ${typeLabel} limit is ${tableLimit}.`,
        })
      }
    }
    if (typeof merged.figure_count === 'number') {
      const figureLimit = FIGURE_LIMITS[merged.manuscript_type]
      if (merged.figure_count > figureLimit) {
        warnings.push({
          severity: 'warning',
          rule: 'figure-count-limit',
          message: `${merged.figure_count} figure files are uploaded; the ${typeLabel} limit is ${figureLimit}.`,
        })
      }
    }
  }

  return { errors, warnings }
}

// ============================================================
// Main entry point.
// ============================================================

export async function synthesizeRendererPayload(
  manuscriptId: string
): Promise<SynthesizeResult> {
  const warnings: string[] = []
  const errors: string[] = []
  const admin = createAdminClient()

  // ---- Fetch manuscripts row ----
  const { data: mData, error: mErr } = await admin
    .from('manuscripts')
    .select('*')
    .eq('id', manuscriptId)
    .maybeSingle()

  if (mErr) {
    return { ok: false, payload: null, warnings, errors: [`Manuscript fetch failed: ${mErr.message}`] }
  }
  if (!mData) {
    return { ok: false, payload: null, warnings, errors: ['Manuscript not found.'] }
  }
  const manuscript = mData as ManuscriptRow

  if (!manuscript.manuscript_type) {
    errors.push('Manuscript has no manuscript_type. Cannot synthesize payload.')
  }
  if (!manuscript.title || manuscript.title.trim().length === 0) {
    errors.push('Manuscript title is empty.')
  }

  // ---- Fetch authors ordered by author_order ----
  const { data: aData } = await admin
    .from('manuscript_authors')
    .select('*')
    .eq('manuscript_id', manuscriptId)
    .order('author_order', { ascending: true })

  const authors = (aData as ManuscriptAuthorRow[] | null) ?? []
  if (authors.length === 0) {
    errors.push('Manuscript has no authors.')
  }

  // ---- Fetch affiliations (often empty — table exists but submission
  //      wizard does not populate it yet). Synthesize from
  //      manuscript_authors.affiliation strings when empty.
  const { data: affData } = await admin
    .from('manuscript_affiliations')
    .select('*')
    .eq('manuscript_id', manuscriptId)
    .order('affiliation_order', { ascending: true })

  const dbAffiliations =
    (affData as ManuscriptAffiliationRow[] | null) ?? []

  // ---- Fetch metadata (CoI, funding, ethics, data availability,
  //      AI disclosure, consent flags).
  const { data: metaData } = await admin
    .from('manuscript_metadata')
    .select('*')
    .eq('manuscript_id', manuscriptId)
    .maybeSingle()

  const meta = (metaData as Record<string, unknown> | null) ?? {}

  // ---- Fetch corresponding author profile (email, ORCID).
  const { data: cuData } = await admin
    .from('users')
    .select('*')
    .eq('id', manuscript.corresponding_author_id)
    .maybeSingle()

  const correspondingUser = cuData as UserRow | null

  // ---- Fetch handling editor — latest non-rescinded editorial
  //      decision row → editor user. Per Janine §7.2.f + Franklin
  //      §3 wireframe. Rendered in the editor as a display-only block;
  //      synthesizer surfaces the data so the renderer can emit
  //      <contrib contrib-type="editor"> in JATS.
  const { data: latestDecisionData } = await admin
    .from('editorial_decisions')
    .select('editor_id')
    .eq('manuscript_id', manuscriptId)
    .is('rescinded_at', null)
    .order('decision_date', { ascending: false })
    .limit(1)
    .maybeSingle()

  let handlingEditor: RendererPayload['handling_editor'] = null
  const latestDecision = latestDecisionData as { editor_id: string } | null
  if (latestDecision?.editor_id) {
    const { data: editorData } = await admin
      .from('users')
      .select('full_name, degrees, affiliation')
      .eq('id', latestDecision.editor_id)
      .maybeSingle()
    const editorRow = editorData as
      | { full_name: string; degrees: string | null; affiliation: string | null }
      | null
    if (editorRow?.full_name) {
      const degs = (editorRow.degrees || '').trim()
      handlingEditor = {
        display_name: degs
          ? `${editorRow.full_name.trim()}, ${degs}`
          : editorRow.full_name.trim(),
        affiliation: editorRow.affiliation,
      }
    }
  }

  // ============================================================
  // Build the payload sections.
  // ============================================================

  const type = manuscript.manuscript_type
  const typeDisplay = type ? TYPE_DISPLAY[type] : ''
  const typeSlug = type ? TYPE_SLUG[type] : ''

  // ---- article ----
  // Identity is minted at acceptance (lib/admin/actions.ts) and is never
  // fabricated here. Any gap is a blocking error — see validateRenderIdentity.
  const elocationId = (manuscript.elocation_id || '').trim()
  const doi = (manuscript.doi || '').trim()
  errors.push(...validateRenderIdentity(elocationId, doi))
  const doiUrl = `https://doi.org/${doi}`

  let runningTitle = (manuscript.running_title || manuscript.title || '').trim()
  if (runningTitle.length === 0) {
    errors.push('Both running_title and title are empty.')
  } else if (runningTitle.length > RUNNING_TITLE_MAX) {
    warnings.push(
      `running_title is ${runningTitle.length} chars (max ${RUNNING_TITLE_MAX}). Editor must shorten before render.`
    )
    runningTitle = runningTitle.slice(0, RUNNING_TITLE_MAX)
  }

  const article = {
    id: elocationId,
    type: typeDisplay,
    article_type_slug: typeSlug,
    title: (manuscript.title || '').trim(),
    running_title: runningTitle,
    doi,
    doi_url: doiUrl,
    license: { code: LICENSE_CODE, url: LICENSE_URL },
  }

  // ---- issue + dates ----
  const acceptedAt = manuscript.accepted_date || manuscript.decision_date || new Date().toISOString()
  const submittedAt = manuscript.submission_date || acceptedAt
  const publishedAt = manuscript.published_date || acceptedAt
  const publishedDt = new Date(publishedAt)

  const issue = {
    journal_short: JOURNAL_SHORT,
    journal_full: JOURNAL_FULL,
    issn_electronic: ISSN_PLACEHOLDER,
    year: publishedDt.getUTCFullYear(),
    volume: 1,
    issue_number: 1,
    month_short: MONTH_SHORT[publishedDt.getUTCMonth()],
    issue_slug: '1-1',
    issue_cover_date: publishedDt.toISOString().slice(0, 10),
  }

  const dates = {
    received: submittedAt.slice(0, 10),
    accepted: acceptedAt.slice(0, 10),
    published: publishedAt.slice(0, 10),
  }

  // ---- affiliations + authors ----
  const affiliations: RendererPayload['affiliations'] = []
  const authorAffMap: Map<string, number[]> = new Map() // manuscript_author_id → affiliation numbers

  if (dbAffiliations.length > 0) {
    // Structured affiliations exist — use them.
    const idToNumber = new Map<string, number>()
    dbAffiliations.forEach((aff, idx) => {
      const number = idx + 1
      idToNumber.set(aff.id, number)
      const parts = [
        aff.department,
        aff.affiliation_name,
        aff.city,
        aff.country,
      ].filter((p): p is string => !!p && p.trim().length > 0)
      affiliations.push({ number, text: parts.join(', ') })
    })
    // Group by manuscript_author_id.
    for (const aff of dbAffiliations) {
      if (!aff.manuscript_author_id) continue
      const number = idToNumber.get(aff.id)
      if (!number) continue
      const list = authorAffMap.get(aff.manuscript_author_id) ?? []
      list.push(number)
      authorAffMap.set(aff.manuscript_author_id, list)
    }
  } else {
    // No structured affiliations — synthesize from each author's
    // free-text affiliation string. De-duplicate on exact match.
    warnings.push(
      'manuscript_affiliations table is empty; synthesizing affiliations from manuscript_authors.affiliation free-text strings. Multi-affiliation authors will appear as single-affiliation. Backfill manually if needed.'
    )
    const seen = new Map<string, number>()
    for (const a of authors) {
      const aff = (a.affiliation || '').trim()
      if (!aff) continue
      if (!seen.has(aff)) {
        const number = seen.size + 1
        seen.set(aff, number)
        affiliations.push({ number, text: aff })
      }
      authorAffMap.set(a.id, [seen.get(aff)!])
    }
  }

  if (affiliations.length === 0) {
    errors.push('No affiliations could be synthesized. At least one author needs an affiliation.')
  }

  // ---- authors ----
  const payloadAuthors: RendererPayload['authors'] = authors.map((a, idx) => {
    const nameParts = (a.full_name || '').trim().split(/\s+/)
    const givenName = nameParts[0] || ''
    const familyName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : ''
    const middle = nameParts.length > 2 ? nameParts.slice(1, -1).join(' ') : ''
    const middleInitial = middle
      ? middle.split(/\s+/).map((m) => m.charAt(0).toUpperCase() + '.').join(' ')
      : null

    const degrees = (a.degrees || '').trim()
    const displayName = degrees
      ? `${a.full_name.trim()}, ${degrees}`
      : a.full_name.trim()

    const orcid = (a.orcid_id || '').trim() || null
    const orcidUrl = orcid
      ? (orcid.startsWith('http') ? orcid : `https://orcid.org/${orcid}`)
      : null

    const credit = (a.contribution || '').trim()
    const creditRoles = credit
      ? credit.split(/[;,]/).map((s) => s.trim()).filter(Boolean)
      : []

    const affRefs = authorAffMap.get(a.id) ?? []
    if (affRefs.length === 0 && affiliations.length > 0) {
      warnings.push(
        `Author "${displayName}" has no resolvable affiliation — defaulting to affiliation #1.`
      )
      affRefs.push(1)
    }

    return {
      ordinal: idx + 1,
      given_name: givenName,
      middle_initial: middleInitial,
      family_name: familyName,
      degrees,
      display_name: displayName,
      orcid,
      orcid_url: orcidUrl,
      affiliation_refs: affRefs,
      is_corresponding: a.is_corresponding,
      // Session 57 — migration 022 added is_equal_contribution per author.
      // Defaults false on pre-migration rows.
      is_equal_contribution: !!a.is_equal_contribution,
      credit_roles: creditRoles,
    }
  })

  // ---- corresponding_author ----
  const correspondingDbAuthor = authors.find((a) => a.is_corresponding)
  if (!correspondingDbAuthor) {
    errors.push('No author flagged is_corresponding=true.')
  }
  const correspondingDisplayName = correspondingDbAuthor
    ? (() => {
        const degs = (correspondingDbAuthor.degrees || '').trim()
        return degs
          ? `${correspondingDbAuthor.full_name.trim()}, ${degs}`
          : correspondingDbAuthor.full_name.trim()
      })()
    : ''

  const correspondingAffText = correspondingDbAuthor
    ? (correspondingDbAuthor.affiliation || correspondingUser?.affiliation || '').trim()
    : ''

  const correspondingAuthor = {
    display_name: correspondingDisplayName,
    affiliation_address: correspondingAffText,
    email: correspondingDbAuthor?.email || correspondingUser?.email || '',
    orcid_url: correspondingDbAuthor
      ? (correspondingDbAuthor.orcid_id
          ? (correspondingDbAuthor.orcid_id.startsWith('http')
              ? correspondingDbAuthor.orcid_id
              : `https://orcid.org/${correspondingDbAuthor.orcid_id}`)
          : null)
      : null,
  }

  // ---- equal_contribution (Session 57 — Janine §7.2.b) ----
  // Derive .present from (≥2 flagged authors) AND (statement non-null).
  // Both gates must hold so a stray single checkbox doesn't surface a
  // shared-first-authorship footnote with no statement to back it.
  const equalAuthorCount = payloadAuthors.filter((a) => a.is_equal_contribution).length
  const equalStmtRaw = ((meta.equal_contribution_statement as string | null) || '').trim()
  const equalPresent = equalAuthorCount >= 2 && equalStmtRaw.length > 0
  if (equalAuthorCount >= 2 && equalStmtRaw.length === 0) {
    warnings.push(
      `${equalAuthorCount} authors are flagged equal-contribution but equal_contribution_statement is empty. Editor must add the statement before render.`
    )
  } else if (equalAuthorCount === 1) {
    warnings.push(
      'Only 1 author is flagged equal-contribution; shared-first-authorship needs at least 2. Either flag another author or uncheck this one.'
    )
  }
  const equalContribution = {
    present: equalPresent,
    statement: equalPresent ? equalStmtRaw : null,
  }

  // ---- abstract ----
  const abstract = parseAbstract(
    manuscript.abstract || '',
    type,
    warnings,
    errors
  )

  // ---- keywords ----
  const keywords = (manuscript.keywords || []).filter(
    (k) => typeof k === 'string' && k.trim().length > 0
  )
  if (keywords.length < 3 || keywords.length > 5) {
    warnings.push(
      `keywords cardinality is ${keywords.length} (renderer sanity test requires 3-5).`
    )
  }

  // ---- declarations ----
  const coi = ((meta.conflict_of_interest as string | null) || '').trim()
  const fundingArr =
    (meta.funding_sources as string[] | null) ?? []
  const funding = fundingArr.length === 0
    ? 'No external funding was received for this work.'
    : fundingArr.join('; ')

  const dataAvail = ((meta.data_availability_statement as string | null) || '').trim()
    || 'All data supporting the findings of this report are contained within the article.'

  const ethicsBranch = manuscript.manuscript_type === 'case_report' ? 'exempt' : 'not_required'
  const ethicsNum = ((meta.ethics_approval_number as string | null) || '').trim()
  const ethicsStatement = ethicsNum
    ? `Institutional Review Board approval: ${ethicsNum}.`
    : 'Institutional Review Board approval was not required for this report per institutional policy.'

  const aiUsed = (meta.ai_tools_used as boolean | null) || false
  const aiDetails = ((meta.ai_tools_details as string | null) || '').trim()
  const aiStatement = aiUsed
    ? (aiDetails || 'Generative AI was used in the preparation of this manuscript. The authors verified all content.')
    : 'The authors did not use generative AI tools in the conception, drafting, or revision of this manuscript.'

  // CoI short — first sentence of the longer statement, or fallback.
  const coiSentences = coi.split(/(?<=[.!?])\s+/).filter(Boolean)
  let coiShort = coiSentences[0] || 'The authors declare no conflicts of interest.'
  if (!coiShort.endsWith('.')) coiShort = coiShort + '.'
  const coiLong = coi || 'The authors declare no conflicts of interest. The full disclosure of potential conflicts of interest is provided with the online version of this article.'

  // CRediT contributions — join from authors.
  const creditLines = authors
    .filter((a) => (a.contribution || '').trim().length > 0)
    .map((a) => {
      const initials = a.full_name
        .trim()
        .split(/\s+/)
        .map((p) => p.charAt(0).toUpperCase())
        .join('.')
      return `${initials}. — ${(a.contribution || '').trim()}`
    })
    .join('; ')

  // ---- patient_consent — Session 57, Janine §3 7-variant taxonomy ----
  // Pull from migration 022 columns; fall back to red error when null
  // (the editor surfaces the same in §5 Validation Summary).
  const consentVariantRaw =
    (meta.patient_consent_variant as PatientConsentVariant | null) || null
  let consentStatement = ((meta.patient_consent_statement as string | null) || '').trim()
  const irbInstitution = ((meta.patient_consent_irb_institution as string | null) || '').trim()
  const irbProtocol = ((meta.patient_consent_irb_protocol as string | null) || '').trim()

  if (!consentVariantRaw) {
    errors.push(
      'patient_consent_variant is not set. Editor must select one of the 7 Janine §3 variants before render.'
    )
  } else if (consentVariantRaw !== 'not_applicable' && consentStatement.length === 0) {
    errors.push(
      `patient_consent_statement is empty for variant "${consentVariantRaw}". Editor must add (or accept the verbatim default) before render.`
    )
  }

  // For IRB-waiver branches, substitute the <institution> + <IRB-####>
  // placeholders the editor may have left in the statement default with
  // the structured columns. Janine §3 + §4. Missing IRB data surfaces
  // as Janine §8.4 conditional warning.
  const isWaiverVariant =
    consentVariantRaw === 'deceased_irb_waiver' ||
    consentVariantRaw === 'incapacitated_irb_waiver'
  if (isWaiverVariant) {
    if (!irbInstitution || !irbProtocol) {
      warnings.push(
        `patient_consent_variant is "${consentVariantRaw}" but IRB institution/protocol is incomplete (institution="${irbInstitution || '(empty)'}", protocol="${irbProtocol || '(empty)'}"). Editor must populate both before render or the statement will ship with <institution>/<IRB-####> placeholders visible.`
      )
    }
    if (irbInstitution) {
      consentStatement = consentStatement.replace(/<institution>/gi, irbInstitution)
    }
    if (irbProtocol) {
      consentStatement = consentStatement.replace(/<IRB-####>/gi, irbProtocol)
    }
  }

  const acknowledgmentsRaw = ((meta.acknowledgments as string | null) || '').trim()

  const declarations = {
    funding,
    conflicts_of_interest: coiLong,
    coi_short: coiShort,
    patient_consent: {
      variant: consentVariantRaw || 'adult_living',
      statement: consentStatement || 'Patient consent statement not provided.',
    },
    irb_ethics: {
      branch: ethicsBranch,
      statement: ethicsStatement,
    },
    data_availability: dataAvail,
    credit_author_contributions:
      creditLines || authors.map((a) => `${a.full_name.trim()} — contributed to the manuscript.`).join('; '),
    ai_disclosure: { used: aiUsed, statement: aiStatement },
    acknowledgments: acknowledgmentsRaw.length > 0 ? acknowledgmentsRaw : null,
  }

  // ---- suggested_citation_html ----
  const familyNames = authors.map((a) => {
    const parts = (a.full_name || '').trim().split(/\s+/)
    const family = parts.length > 1 ? parts[parts.length - 1] : parts[0]
    const initialsFromGivens = parts.length > 1
      ? parts.slice(0, -1).map((p) => p.charAt(0).toUpperCase()).join('')
      : ''
    return `${family}${initialsFromGivens ? ' ' + initialsFromGivens : ''}`
  })
  const authorCitation =
    familyNames.length <= 6
      ? familyNames.join(', ')
      : familyNames.slice(0, 6).join(', ') + ', et al'
  const titleCitation = (manuscript.title || '').replace(/\.+$/, '').trim().toLowerCase()
  const suggestedCitation = `${authorCitation}. ${titleCitation}. <em>${JOURNAL_SHORT}</em>. ${issue.year};${issue.volume}(${issue.issue_number}):${elocationId}. doi:${doi}`

  // ---- xmp_metadata ----
  // Session 57: xmpRights_WebStatement carryforward from Janine
  // ^handoff-pdf-template-license-fix-2026-05-11 deliverable #3. The
  // PDF Compliance Brief v3 §6.5 requires `xmpRights:WebStatement` in
  // the XMP packet pointing at the CC BY 4.0 URL — readers (and PMC
  // ingest) inspect it to confirm reuse rights. The renderer's
  // xmp.ts adds the namespace + element emit; this synthesizer ships
  // the data so the renderer has it on payload-load.
  const xmpMetadata = {
    dc_title: manuscript.title || '',
    dc_creator: authors.map((a) => a.full_name.trim()),
    dc_subject: keywords,
    dc_description: (manuscript.abstract || '').trim().slice(0, 500),
    dc_rights: `© ${issue.year} The Author(s). Licensed under ${LICENSE_CODE}.`,
    dc_identifier: `doi:${doi}`,
    prism_publicationName: JOURNAL_FULL,
    prism_issn: ISSN_PLACEHOLDER,
    prism_volume: String(issue.volume),
    prism_number: String(issue.issue_number),
    prism_doi: doi,
    xmp_CreatorTool: 'OSCRSJ Render Pipeline v1.0 (WeasyPrint 68.1)',
    xmpRights_WebStatement: LICENSE_URL,
    pdfaid_part: '1',
    pdfaid_conformance: 'B',
  }

  const payload: RendererPayload = {
    $schema: SCHEMA_URL,
    article,
    issue,
    dates,
    authors: payloadAuthors,
    affiliations,
    corresponding_author: correspondingAuthor,
    equal_contribution: equalContribution,
    handling_editor: handlingEditor,
    abstract,
    keywords,
    body: [],
    declarations,
    references: [],
    suggested_citation_html: suggestedCitation,
    xmp_metadata: xmpMetadata,
  }

  return {
    ok: errors.length === 0,
    payload,
    warnings,
    errors,
  }
}

// ============================================================
// Helpers.
// ============================================================

// Parse a single-TEXT abstract field into structured sections based
// on the article type's expected label set. Falls back to single-block
// unstructured form when no anchors detected; emits a warning so the
// editor knows to fix it before render.
function parseAbstract(
  abstractText: string,
  type: ManuscriptType | null,
  warnings: string[],
  errors: string[]
): RendererPayload['abstract'] {
  const text = (abstractText || '').trim()

  if (!type) {
    if (text) return { format: 'unstructured', text }
    return { format: 'unstructured', text: '' }
  }

  if (NO_ABSTRACT_TYPES.has(type)) {
    return { format: 'unstructured', text: text || '' }
  }

  if (UNSTRUCTURED_TYPES.has(type)) {
    if (!text) errors.push(`${TYPE_DISPLAY[type]} requires an abstract; field is empty.`)
    return { format: 'unstructured', text }
  }

  // Structured types — try to parse subheadings.
  const expectedCount = STRUCTURED_ABSTRACT_COUNT[type]
  if (!expectedCount) {
    return { format: 'unstructured', text }
  }

  if (!text) {
    errors.push(`${TYPE_DISPLAY[type]} requires a structured abstract; field is empty.`)
    return { format: 'structured', sections: [] }
  }

  // Anchor regex matches lines (or inline) like "Introduction:" "Case Presentation:"
  // "Discussion:" "Conclusion:" "Background:" "Methods:" "Results:". Case-insensitive.
  // We capture the label and split the text into segments after each match.
  const ANCHORS = [
    'Introduction', 'Background', 'Case Presentation', 'Methods', 'Results',
    'Scope', 'Findings', 'Discussion', 'Conclusion', 'Conclusions',
  ]
  const anchorRe = new RegExp(
    `(^|\\n|\\.\\s+|\\;\\s+|\\s)\\s*(${ANCHORS.join('|')})\\s*[:\\.]\\s*`,
    'gi'
  )

  const matches: Array<{ index: number; label: string }> = []
  let m: RegExpExecArray | null
  while ((m = anchorRe.exec(text)) !== null) {
    matches.push({
      index: m.index + (m[1]?.length ?? 0),
      label: m[2].replace(/conclusions/i, 'Conclusion'),
    })
  }

  if (matches.length < expectedCount) {
    warnings.push(
      `Abstract for ${TYPE_DISPLAY[type]} expects ${expectedCount} labeled sections; found ${matches.length} anchor(s) ("${matches.map((x) => x.label).join('", "')}"). Editor must add labels (${ABSTRACT_LABEL_HINT[type] ?? 'Introduction:/Methods:/Results:/Conclusion:'}) to the abstract text before render OR the sanity test will fail. Falling back to unstructured.`
    )
    return { format: 'unstructured', text }
  }

  // Slice text segments between matches.
  const sections: Array<{ label: string; text: string }> = []
  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].index
    const end = i + 1 < matches.length ? matches[i + 1].index : text.length
    const segment = text.slice(start, end)
    // Strip leading "Label:" + whitespace
    const sectionText = segment.replace(
      new RegExp(`^\\s*${matches[i].label}\\s*[:\\.]\\s*`, 'i'),
      ''
    ).trim()
    sections.push({
      label: matches[i].label.charAt(0).toUpperCase() + matches[i].label.slice(1),
      text: sectionText,
    })
  }

  if (sections.length !== expectedCount) {
    warnings.push(
      `Abstract parsed into ${sections.length} sections but ${TYPE_DISPLAY[type]} expects ${expectedCount}. Sanity test will fail unless editor cleans up before render.`
    )
  }

  return { format: 'structured', sections }
}
