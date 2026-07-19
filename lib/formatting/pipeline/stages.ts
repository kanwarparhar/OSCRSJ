// Pipeline state machine for a formatting job (Sushant, Session 87 scaffold).
// This file defines the STATES, the legal transitions, the persisted job shape
// (mirrors migration 027 `formatting_jobs`), and the stage-runner contract.
// Stage bodies are implemented in Session B/C; the machine itself is real so
// the API `advance` route (Session C) can enforce transitions + stage locks.

import type { JournalRules } from '../rulesSchema'
import type { ReportModel } from '../types'

// ---------------------------------------------------------------------------
// States + transitions
// ---------------------------------------------------------------------------

export const JOB_STATUSES = [
  'uploaded',
  'parsed',
  'extracted',
  'verified',
  'rendered',
  'complete',
  'failed',
] as const
export type JobStatus = (typeof JOB_STATUSES)[number]

export const TERMINAL_STATUSES: readonly JobStatus[] = ['complete', 'failed']

/** Legal forward transitions. `failed` is reachable from any non-terminal state. */
export const STAGE_TRANSITIONS: Record<JobStatus, JobStatus[]> = {
  uploaded: ['parsed', 'failed'],
  parsed: ['extracted', 'failed'],
  extracted: ['verified', 'failed'],
  verified: ['rendered', 'failed'],
  rendered: ['complete', 'failed'],
  complete: [],
  failed: [],
}

/** The happy-path successor of a status, or null if terminal. */
export const NEXT_STATUS: Record<JobStatus, JobStatus | null> = {
  uploaded: 'parsed',
  parsed: 'extracted',
  extracted: 'verified',
  verified: 'rendered',
  rendered: 'complete',
  complete: null,
  failed: null,
}

export function isTerminal(status: JobStatus): boolean {
  return TERMINAL_STATUSES.includes(status)
}

export function canTransition(from: JobStatus, to: JobStatus): boolean {
  return STAGE_TRANSITIONS[from].includes(to)
}

// ---------------------------------------------------------------------------
// Persisted job (mirrors supabase `formatting_jobs`, migration 027 — Session C)
// ---------------------------------------------------------------------------

export interface JobOutputPaths {
  manuscript?: string
  report_docx?: string
  /** Separate title-page draft, when the journal requires one. */
  title_page?: string
  figures?: string[]
  zip?: string
}

export interface JobError {
  stage: JobStatus
  code: string
  message: string
  detail?: string
}

/** Resumable position within a stage (e.g. reference-verify batch offset). */
export interface StageCursor {
  references_verified?: number
  references_total?: number
}

export interface FormattingJob {
  id: string
  email: string
  journal_id: string
  article_type: string | null
  status: JobStatus
  input_path: string | null
  figure_paths: string[] | null
  output_paths: JobOutputPaths | null
  report: ReportModel | null
  error: JobError | null
  stage_cursor: StageCursor | null
  rules_version: string | null
  ip: string | null
  created_at: string
  updated_at: string
}

// ---------------------------------------------------------------------------
// Stage runner contract
// ---------------------------------------------------------------------------

export interface StageContext {
  job: FormattingJob
  rules: JournalRules
}

export interface StageResult {
  /** Status to persist after this stage (its `NEXT_STATUS`, or 'failed'). */
  status: JobStatus
  /** Partial column update to persist alongside the new status. */
  patch: Partial<FormattingJob>
}

/**
 * One pipeline stage. Must be idempotent (safe to re-run after a client retry)
 * and complete within the Vercel Hobby ~50s wall-time budget — stages that
 * cannot (reference verification) advance `stage_cursor` and stay on the same
 * status until the batch is exhausted. Implemented in Session B/C.
 */
export type StageRunner = (ctx: StageContext) => Promise<StageResult>

/** Wired up in Session C once each stage is implemented. */
export type StageRegistry = Partial<Record<JobStatus, StageRunner>>
