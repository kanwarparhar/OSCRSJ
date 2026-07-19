// Core data types for the Manuscript Formatting Service engine (Sushant,
// Session 87 scaffold). These are the contracts every pipeline stage reads and
// writes. Implementations land in Sessions B (engine + references) and C
// (product). Nothing here imports a not-yet-installed dependency.

import type { ArticleType, JournalRules } from './rulesSchema'

// ---------------------------------------------------------------------------
// Ingest / content model
// ---------------------------------------------------------------------------

/** A hazard detected at parse time that forces graceful rejection or a flag. */
export interface IngestHazard {
  kind:
    | 'tracked_changes'
    | 'comments'
    | 'not_docx'
    | 'password_protected'
    | 'too_large'
    | 'embedded_equations'
    | 'no_detectable_sections'
    | 'table_as_image'
  /** true = fail the job; false = proceed but flag in the report. */
  fatal: boolean
  message: string
}

/** A heading-bounded section detected in the manuscript body. */
export interface DetectedSection {
  heading: string
  /** Normalised heading used for matching against the journal's required set. */
  normalized: string
  /** Paragraph indices [start, end) in the body content model. */
  range: [number, number]
  wordCount: number
}

/**
 * A parsed .docx reduced to what the engine reasons about. The raw OOXML parts
 * are retained so `emit.ts` can edit sectPr / headers / styles in place rather
 * than rebuilding the document (which would risk content mutation).
 */
export interface ContentModel {
  /** Raw `word/document.xml`. */
  documentXml: string
  /** Raw `word/styles.xml`, if present. */
  stylesXml: string | null
  /** All body `<w:t>` text, concatenated — the immutability-gate baseline. */
  bodyText: string
  detectedSections: DetectedSection[]
  /** Reference-list entries as raw strings, before DeepSeek structuring. */
  rawReferences: string[]
  hazards: IngestHazard[]
  /** Best-effort article-type guess; confirmed by the user's journal + type pick. */
  articleTypeGuess: ArticleType | null
}

// ---------------------------------------------------------------------------
// Metadata extraction (DeepSeek understanding output — always zod-validated)
// ---------------------------------------------------------------------------

export interface ExtractedAuthor {
  name: string
  degrees: string | null
  affiliationRefs: number[]
  isCorresponding: boolean
  orcid: string | null
}

export interface ExtractedTitlePageData {
  title: string | null
  runningTitle: string | null
  authors: ExtractedAuthor[]
  affiliations: string[]
  correspondingAuthor: {
    name: string | null
    email: string | null
    address: string | null
    phone: string | null
  } | null
  keywords: string[]
}

// ---------------------------------------------------------------------------
// References
// ---------------------------------------------------------------------------

/** Minimal CSL-JSON reference shape (extended as renderers demand it). */
export interface CslReference {
  id: string
  type: string
  title: string | null
  authors: { family: string; given: string }[]
  containerTitle: string | null
  volume: string | null
  issue: string | null
  page: string | null
  year: string | null
  doi: string | null
  pmid: string | null
}

export type ReferenceVerificationStatus =
  | 'verified'
  | 'corrected'
  | 'unverified'
  | 'possibly-retracted'

export interface VerifiedReference {
  reference: CslReference
  status: ReferenceVerificationStatus
  /** 0..1 title-similarity to the matched Crossref/PubMed record. */
  matchConfidence: number
  source: 'crossref' | 'pubmed' | 'none'
}

/** old in-text marker index → new marker index, the ONLY permitted body delta. */
export type CitationMarkerMap = Record<number, number>

// ---------------------------------------------------------------------------
// Analysis & Suggestions Report (the trust product)
// ---------------------------------------------------------------------------

export type Severity = 'fixed' | 'action-required' | 'suggestion' | 'info'

export interface ReportChange {
  element: string
  before: string
  after: string
  severity: Severity
}

export interface ReportSuggestion {
  title: string
  location: string | null
  detail: string
  /** Journal-accepted wording the author MAY adopt — never auto-inserted. */
  suggestedWording: string | null
  severity: Severity
}

export interface ReferenceAuditRow {
  index: number
  status: ReferenceVerificationStatus
  changed: string
  doi: string | null
  pmid: string | null
}

export interface ChecklistRow {
  requirement: string
  status: 'met' | 'fixed' | 'action-needed'
}

/**
 * One entry of the journal-styled reference list the report hands back to the
 * author (Session 97, Part A). This is an ADDITIVE report artifact — the
 * author's manuscript body is never touched, so the rendered list is offered
 * for them to paste over their own bibliography.
 */
export interface FormattedReference {
  /** 1-based position, preserving the author's original order (we never renumber). */
  index: number
  /** The rendered citation, or the author's raw text verbatim when `unparsed`. */
  text: string
  status: ReferenceVerificationStatus
  /**
   * true when the reference never structured (parse.ts `fallbackRef` shape:
   * no authors AND no year). Rendering such a ref would emit a mangled string,
   * so the original text is preserved verbatim and flagged instead.
   */
  unparsed: boolean
}

export interface ReportModel {
  summaryVerdict: {
    journal: string
    changesApplied: number
    itemsNeedingAttention: number
    verifiedDate: string
    guidelinesUrl: string
  }
  changesApplied: ReportChange[]
  suggestedChanges: ReportSuggestion[]
  referenceAudit: ReferenceAuditRow[]
  /**
   * The journal-styled reference list (Session 97, Part A). null when the
   * manuscript carried no references at all. Additive field — the `report`
   * JSONB column stores whatever buildReport returns, so no migration.
   */
  formattedReferences: FormattedReference[] | null
  /**
   * true when the journal's citation style is 'custom' (29/75 rule files):
   * we rendered the closest standard (Vancouver) and say so in the section
   * header rather than silently implying an exact match.
   */
  styleCaveat: boolean
  /**
   * true when the journal prescribes NO manuscript layout at all (page size,
   * font family, font size, margins and line spacing are all null) — 26 of 75
   * journals. The layout transform is then a deliberate no-op, and the author
   * is told so rather than left wondering why "formatting" changed nothing.
   */
  layoutNotPrescribed: boolean
  submissionChecklist: ChecklistRow[]
  rulesVersion: string
  disclaimer: string
  /** Internal-only unit economics; never rendered to the author. */
  cost?: { deepseekTokens: number; usd: number }
}

// ---------------------------------------------------------------------------
// Shared context handed to engine transforms
// ---------------------------------------------------------------------------

export interface FormattingContext {
  rules: JournalRules
  articleType: ArticleType
}
