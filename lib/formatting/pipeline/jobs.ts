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
import type { FormattingJob, JobStatus } from './stages'

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

/**
 * Compare-and-set the status: flip `from` → `to` only if the row is still at
 * `from`. Returns true if this caller won the transition (the stage lock).
 */
export async function casStatus(id: string, from: JobStatus, to: JobStatus): Promise<boolean> {
  const { data, error } = await jobs(admin())
    .update({ status: to, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('status', from)
    .select('id')
  if (error) return false
  return Array.isArray(data) && data.length === 1
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
