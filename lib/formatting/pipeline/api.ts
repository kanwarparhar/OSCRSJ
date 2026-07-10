// /format API contract + storage layout (Sushant, Session C). Shared by the
// route handlers and the client page so both sides agree on the wire shape.

import type { JobStatus } from './stages'
import type { ReportModel } from '../types'

export const FORMATTING_BUCKET = 'formatting'

/** Per-file input limits (bytes). Enforced in the create route + client. */
export const MAX_MANUSCRIPT_BYTES = 15 * 1024 * 1024
export const MAX_FIGURE_BYTES = 10 * 1024 * 1024
export const MAX_FIGURES = 10

/** Rate limits (checked in the create route). */
export const RATE_LIMIT_PER_EMAIL_PER_DAY = 3
export const RATE_LIMIT_PER_IP_PER_DAY = 10

/** Signed-URL TTLs. */
export const UPLOAD_URL_TTL_SECONDS = 60 * 30 // 30 min to finish uploading
export const DOWNLOAD_URL_TTL_SECONDS = 60 * 60 // 1 h on the results page

// ---------------------------------------------------------------------------
// Storage paths — everything for a job lives under formatting/<jobId>/
// ---------------------------------------------------------------------------

export const storagePaths = {
  input: (jobId: string) => `${jobId}/input/manuscript.docx`,
  figure: (jobId: string, i: number, ext: string) => `${jobId}/input/figure-${i}.${ext}`,
  outputManuscript: (jobId: string) => `${jobId}/output/manuscript-formatted.docx`,
  outputTitlePage: (jobId: string) => `${jobId}/output/title-page.docx`,
  outputReportDocx: (jobId: string) => `${jobId}/output/analysis-report.docx`,
  outputZip: (jobId: string) => `${jobId}/output/formatted-package.zip`,
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
  titlePage?: string
  reportDocx?: string
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

const STAGE_META: Record<JobStatus, { progress: number; label: string }> = {
  uploaded: { progress: 0.1, label: 'Uploaded — starting…' },
  parsed: { progress: 0.3, label: 'Reading your manuscript…' },
  extracted: { progress: 0.5, label: 'Extracting metadata + references…' },
  verified: { progress: 0.7, label: 'Verifying references against Crossref/PubMed…' },
  rendered: { progress: 0.9, label: 'Formatting + building your report…' },
  complete: { progress: 1, label: 'Done' },
  failed: { progress: 1, label: 'Failed' },
}

export const progressFor = (status: JobStatus) => STAGE_META[status]
