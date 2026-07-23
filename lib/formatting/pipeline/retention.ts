// Formatting-bucket retention policy (2026-07-22, Part E). Pure decision
// logic — no Supabase imports — so the age/status partition is unit-testable.
// The cron route (api/cron/cleanup-preview-artifacts, phase 2) applies it.
//
// Policy:
//  - Terminal jobs (complete | failed) older than FORMATTING_RETENTION_DAYS:
//    delete everything under formatting/<jobId>/ and null the path columns.
//    The row itself stays — it is the audit trail; the bytes are the
//    liability (uploaded manuscripts, figures, state.json with author
//    names/emails).
//  - Non-terminal jobs idle longer than STALE_JOB_HOURS: the browser session
//    driving them is gone (the pipeline is client-advanced), so mark them
//    failed with an honest message. Their storage is then reaped by the
//    terminal rule 7 days later.

import { isTerminal, type JobStatus } from './stages'

export const FORMATTING_RETENTION_DAYS = 7
export const STALE_JOB_HOURS = 24

export const EXPIRED_JOB_MESSAGE =
  'Job expired: the browser session that was driving it closed. Please submit again.'

export type RetentionAction = 'none' | 'expire' | 'purge'

export interface RetentionJobView {
  status: JobStatus
  updated_at: string
  input_path: string | null
  output_paths: unknown | null
  figure_paths: string[] | null
}

/** True when the row still points at storage bytes worth deleting. */
export function hasArtifacts(job: RetentionJobView): boolean {
  return (
    job.input_path !== null ||
    (job.output_paths !== null && job.output_paths !== undefined) ||
    (Array.isArray(job.figure_paths) && job.figure_paths.length > 0)
  )
}

/** The single decision the reaper acts on, per job row. */
export function retentionActionFor(job: RetentionJobView, nowMs: number): RetentionAction {
  const updatedMs = Date.parse(job.updated_at)
  if (!Number.isFinite(updatedMs)) return 'none' // never reap on unparseable data

  if (isTerminal(job.status)) {
    const cutoff = nowMs - FORMATTING_RETENTION_DAYS * 24 * 60 * 60 * 1000
    // Already-purged rows (all paths null) are done — never re-purge daily.
    return updatedMs < cutoff && hasArtifacts(job) ? 'purge' : 'none'
  }

  const staleCutoff = nowMs - STALE_JOB_HOURS * 60 * 60 * 1000
  return updatedMs < staleCutoff ? 'expire' : 'none'
}
