// formatting_jobs persistence + storage helpers (Sushant, Session C).
// formatting_jobs is not in the generated Database type, so table access is
// loosely typed via `as any` — the same pattern the repo uses for audit_logs.
// All access is service-role (createAdminClient) since /format is unauthenticated.

import { createAdminClient } from '@/lib/supabase/server'
import {
  FORMATTING_BUCKET,
  RATE_LIMIT_PER_EMAIL_PER_DAY,
  RATE_LIMIT_PER_IP_PER_DAY,
  UPLOAD_URL_TTL_SECONDS,
  DOWNLOAD_URL_TTL_SECONDS,
  storagePaths,
  type SignedUpload,
} from './api'
import { STAGE_LOCK_SECONDS, isLockActive } from './stages'
import type { FormattingJob } from './stages'

type Admin = ReturnType<typeof createAdminClient>

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const jobs = (admin: Admin) => admin.from('formatting_jobs') as any

export function admin(): Admin {
  return createAdminClient()
}

export async function createJob(fields: {
  email: string
  journalId: string
  articleType: string
  ip: string | null
  rulesVersion: string
  /** Recorded verbatim so we can prove which wording this address agreed to.
   *  Omitted only by callers predating migration 029 (none in the app). */
  consent?: { version: string; scope: string }
}): Promise<FormattingJob | null> {
  const a = admin()
  const { data, error } = await jobs(a)
    .insert({
      email: fields.email.toLowerCase().trim(),
      journal_id: fields.journalId,
      article_type: fields.articleType,
      status: 'uploaded',
      ip: fields.ip,
      rules_version: fields.rulesVersion,
      ...(fields.consent
        ? {
            marketing_consent: true,
            consent_version: fields.consent.version,
            consent_scope: fields.consent.scope,
            consent_at: new Date().toISOString(),
          }
        : {}),
    })
    .select('*')
    .single()
  if (error || !data) return null
  return data as FormattingJob
}

export async function getJob(id: string): Promise<FormattingJob | null> {
  const { data, error } = await jobs(admin()).select('*').eq('id', id).single()
  if (error || !data) return null
  return data as FormattingJob
}

export async function updateJob(id: string, patch: Partial<FormattingJob>): Promise<void> {
  await jobs(admin())
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
}

export interface ClaimResult {
  claimed: boolean
  /** The freshly-claimed row (carries the lock in stage_cursor) when claimed. */
  job?: FormattingJob
}

/**
 * The stage lock (2026-07-22, Part C — replaces the never-called casStatus).
 * Claim = compare-and-set on (id, status, updated_at): only the caller whose
 * read is still current wins; everyone else sees zero rows and reports
 * in-progress without running the stage. The claim stamps
 * stage_cursor.lock_until = now + STAGE_LOCK_SECONDS; a future lock_until
 * short-circuits before even attempting the CAS, and a PAST one is claimable
 * again (the escape for a function killed mid-stage). No migration: the lock
 * lives in the jsonb cursor, not in the CHECK-constrained status column.
 */
export async function claimStage(job: FormattingJob): Promise<ClaimResult> {
  if (isLockActive(job.stage_cursor?.lock_until, Date.now())) return { claimed: false }
  const now = new Date()
  const lockUntil = new Date(now.getTime() + STAGE_LOCK_SECONDS * 1000).toISOString()
  const { data, error } = await jobs(admin())
    .update({
      updated_at: now.toISOString(),
      stage_cursor: { ...(job.stage_cursor ?? {}), lock_until: lockUntil },
    })
    .eq('id', job.id)
    .eq('status', job.status)
    .eq('updated_at', job.updated_at)
    .select('*')
  if (error || !Array.isArray(data) || data.length !== 1) return { claimed: false }
  return { claimed: true, job: data[0] as FormattingJob }
}

/** Jobs created by this email / IP within the last 24h — for rate limiting. */
export async function recentJobCount(field: 'email' | 'ip', value: string): Promise<number> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { count } = await jobs(admin())
    .select('id', { count: 'exact', head: true })
    .eq(field, field === 'email' ? value.toLowerCase().trim() : value)
    .gte('created_at', since)
  return count ?? 0
}

export interface RateLimitResult {
  ok: boolean
  reason?: string
}

export async function checkRateLimit(email: string, ip: string | null): Promise<RateLimitResult> {
  if ((await recentJobCount('email', email)) >= RATE_LIMIT_PER_EMAIL_PER_DAY) {
    return { ok: false, reason: `Daily limit reached (${RATE_LIMIT_PER_EMAIL_PER_DAY} per email). Try again tomorrow.` }
  }
  if (ip && (await recentJobCount('ip', ip)) >= RATE_LIMIT_PER_IP_PER_DAY) {
    return { ok: false, reason: 'Daily limit reached for this network. Try again tomorrow.' }
  }
  return { ok: true }
}

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------

export async function createSignedUpload(path: string): Promise<SignedUpload | null> {
  const { data, error } = await admin().storage.from(FORMATTING_BUCKET).createSignedUploadUrl(path)
  if (error || !data) return null
  return { path: data.path, url: data.signedUrl, token: data.token }
}

export async function createSignedDownload(path: string, downloadName?: string): Promise<string | null> {
  const { data, error } = await admin()
    .storage.from(FORMATTING_BUCKET)
    .createSignedUrl(path, DOWNLOAD_URL_TTL_SECONDS, downloadName ? { download: downloadName } : undefined)
  if (error || !data) return null
  return data.signedUrl
}

export async function downloadObject(path: string): Promise<Buffer | null> {
  const { data, error } = await admin().storage.from(FORMATTING_BUCKET).download(path)
  if (error || !data) return null
  return Buffer.from(await data.arrayBuffer())
}

export async function uploadObject(
  path: string,
  bytes: Buffer | Uint8Array,
  contentType: string,
): Promise<boolean> {
  const { error } = await admin()
    .storage.from(FORMATTING_BUCKET)
    .upload(path, Buffer.from(bytes), { contentType, upsert: true })
  return !error
}

// ---------------------------------------------------------------------------
// Job meta — small JSON sidecar in Storage (no schema migration needed)
// ---------------------------------------------------------------------------

export interface JobMeta {
  /** Original filename of the uploaded manuscript, used to name outputs. */
  originalFilename: string | null
  /** How many figures the author attached. Absent on jobs created before 2026-07-18. */
  figureCount?: number
  /**
   * The author's own figure filenames, in attach order. Carried here rather
   * than derived from `figure_paths` because the storage path hardcodes a
   * `.img` extension, so it cannot tell us the real format. Used for the
   * report-only figure checks; never used to rename or touch the files.
   */
  figureFilenames?: string[]
}

export async function writeJobMeta(jobId: string, meta: JobMeta): Promise<void> {
  await uploadObject(storagePaths.meta(jobId), Buffer.from(JSON.stringify(meta)), 'application/json')
}

export async function readJobMeta(jobId: string): Promise<JobMeta | null> {
  const buf = await downloadObject(storagePaths.meta(jobId))
  if (!buf) return null
  try {
    return JSON.parse(buf.toString('utf8')) as JobMeta
  } catch {
    return null
  }
}

/** Signal that UPLOAD_URL_TTL applies to freshly-minted upload URLs. */
export const UPLOAD_TTL = UPLOAD_URL_TTL_SECONDS
