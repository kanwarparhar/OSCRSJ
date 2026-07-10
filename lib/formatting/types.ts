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
