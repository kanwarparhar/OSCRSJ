// /format API contract + storage layout (Sushant, Session C). Shared by the
// route handlers and the client page so both sides agree on the wire shape.

import type { JobStatus, StageCursor } from './stages'
import type { ReportModel } from '../types'
import { journalAbbrev } from '../registry-meta'

export const FORMATTING_BUCKET = 'formatting'

/**
 * Per-file input limits (bytes). Enforced client-side and re-checked
 * server-side on the first advance call (run.ts 'uploaded' stage), which is
 * the first place the server actually sees the bytes — the create route only
 * mints signed upload URLs and never sees the file. (Comment corrected
 * 2026-07-22, Part G2: it previously claimed the create route enforced this.)
 */
export const MAX_MANUSCRIPT_BYTES = 15 * 1024 * 1024
export const MAX_FIGURE_BYTES = 10 * 1024 * 1024
export const MAX_FIGURES = 10

/** Rate limits (checked in the create route). */
export const RATE_LIMIT_PER_EMAIL_PER_DAY = 3
export const RATE_LIMIT_PER_IP_PER_DAY = 10

/**
 * Cap on raw references entering the parse stage (2026-07-22, Part D). A
 * 300-reference systematic review (or a deliberate abuse loop) otherwise
 * drives unbounded DeepSeek spend through the batched parser. Over the cap,
 * the first MAX_RAW_REFERENCES are processed and the report says so — no
 * silent truncation (repo convention: no silent caps).
 */
export const MAX_RAW_REFERENCES = 150

/** Apply the reference cap. Returns the (possibly trimmed) list plus the
 *  user-facing note when trimming happened, null otherwise. */
export function capReferences(raw: string[]): { refs: string[]; note: string | null } {
  if (raw.length <= MAX_RAW_REFERENCES) return { refs: raw, note: null }
  return {
    refs: raw.slice(0, MAX_RAW_REFERENCES),
    note: `Reference list exceeds ${MAX_RAW_REFERENCES} entries (${raw.length} found); the first ${MAX_RAW_REFERENCES} were processed. The rest were not parsed or verified.`,
  }
}

/** Signed-URL TTLs. */
export const UPLOAD_URL_TTL_SECONDS = 60 * 30 // 30 min to finish uploading
export const DOWNLOAD_URL_TTL_SECONDS = 60 * 60 // 1 h on the results page

// ---------------------------------------------------------------------------
// Storage paths — everything for a job lives under formatting/<jobId>/
// ---------------------------------------------------------------------------

export const storagePaths = {
  input: (jobId: string) => `${jobId}/input/manuscript.docx`,
  figure: (jobId: string, i: number, ext: string) => `${jobId}/input/figure-${i}.${ext}`,
  meta: (jobId: string) => `${jobId}/meta.json`,
  outputManuscript: (jobId: string) => `${jobId}/output/manuscript-formatted.docx`,
  outputReportDocx: (jobId: string) => `${jobId}/output/analysis-report.docx`,
  outputTitlePage: (jobId: string) => `${jobId}/output/title-page.docx`,
  outputZip: (jobId: string) => `${jobId}/output/formatted-package.zip`,
}

// ---------------------------------------------------------------------------
// Output naming — original filename + _<journal abbreviation>
// ---------------------------------------------------------------------------

/**
 * Base name for every user-facing output file: the uploaded manuscript's
 * original name (extension stripped, filesystem-hostile characters removed)
 * suffixed with the target journal's abbreviation, e.g.
 * "My Case Report" + jbjs → "My Case Report_JBJS".
 */
export function outputBaseName(originalFilename: string | null | undefined, journalSlug: string): string {
  const stripped = (originalFilename ?? '')
    .replace(/\.docx$/i, '')
    .replace(/[^A-Za-z0-9 ._()\[\]-]+/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120)
  const base = stripped || 'manuscript'
  return `${base}_${journalAbbrev(journalSlug)}`
}

// ---------------------------------------------------------------------------
// Wire types
// ---------------------------------------------------------------------------

export interface CreateJobRequest {
  email: string
  journalId: string
  articleType: string
  turnstileToken?: string
  figureCount?: number
  /** Author's figure filenames, in attach order — drives the format check. */
  figureFilenames?: string[]
  /** Original filename of the uploaded manuscript (used to name outputs). */
  manuscriptFilename?: string
  /** Required (2026-07-25). The submitter ticked the consent box; the API
   *  rejects the job without it. The consent VERSION is stamped server-side
   *  from lib/studio/consent.ts, never accepted from the client. */
  marketingConsent?: boolean
}

export interface SignedUpload {
  path: string
  /** Signed URL to PUT the file bytes to (Supabase signed upload URL). */
  url: string
  token: string
}

export interface CreateJobResponse {
  jobId: string
  manuscriptUpload: SignedUpload
  figureUploads: SignedUpload[]
}

export interface JobOutputs {
  manuscript?: string
  reportDocx?: string
  /** Separate title-page draft, when the journal requires one. */
  titlePage?: string
  zip?: string
}

export interface JobStatusResponse {
  jobId: string
  status: JobStatus
  /** 0..1 progress for the UI. */
  progress: number
  stageLabel: string
  report: ReportModel | null
  /** Signed download URLs (present once status = complete). */
  downloads: JobOutputs
  error: { stage: string; message: string } | null
}

// ---------------------------------------------------------------------------
// Progress mapping for the client poller
// ---------------------------------------------------------------------------

// Progress values mark the START of the work that runs while the job sits at
// that status; labels describe the work in flight. The reference-verify stage
// (status 'extracted') is the long one, so it gets the widest band and is made
// granular via the stage cursor.
const STAGE_META: Record<JobStatus, { progress: number; label: string }> = {
  uploaded: { progress: 0.08, label: 'Reading your manuscript…' },
  parsed: { progress: 0.25, label: 'Extracting metadata and references…' },
  extracted: { progress: 0.4, label: 'Verifying references against Crossref and PubMed…' },
  verified: { progress: 0.78, label: 'Applying the journal’s formatting and building your report…' },
  rendered: { progress: 0.94, label: 'Finalizing…' },
  complete: { progress: 1, label: 'Done' },
  failed: { progress: 1, label: 'Failed' },
}

/**
 * Progress + label for a status. When the job is mid reference-verification,
 * the stage cursor interpolates smoothly across the 0.4 → 0.78 band and the
 * label carries a "12 of 20" count.
 */
export const progressFor = (status: JobStatus, cursor?: StageCursor | null) => {
  const meta = STAGE_META[status]
  if (
    status === 'parsed' &&
    cursor &&
    typeof cursor.references_parsed === 'number' &&
    typeof cursor.parse_total === 'number' &&
    cursor.parse_total > 0
  ) {
    // Parse-stage resume (2026-07-22, Part D): interpolate the 0.25 → 0.4 band.
    const frac = Math.min(cursor.references_parsed / cursor.parse_total, 1)
    return {
      progress: 0.25 + 0.15 * frac,
      label: `Extracting metadata and references (${Math.min(cursor.references_parsed, cursor.parse_total)} of ${cursor.parse_total})…`,
    }
  }
  if (
    status === 'extracted' &&
    cursor &&
    typeof cursor.references_verified === 'number' &&
    typeof cursor.references_total === 'number' &&
    cursor.references_total > 0
  ) {
    const frac = Math.min(cursor.references_verified / cursor.references_total, 1)
    return {
      progress: 0.4 + 0.38 * frac,
      label: `Verifying references against Crossref and PubMed (${Math.min(cursor.references_verified, cursor.references_total)} of ${cursor.references_total})…`,
    }
  }
  return meta
}
