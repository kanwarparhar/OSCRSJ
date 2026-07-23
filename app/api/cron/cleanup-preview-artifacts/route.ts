// ============================================================
// GET /api/cron/cleanup-preview-artifacts
// ============================================================
// Daily Vercel Cron (15:00 UTC). Two phases:
//
// Phase 1 — reaps preview PDFs older than 7 days from the
// submissions/previews/ directory in Supabase Storage. Per Janine §9
// retention split: artifacts 7 days; audit_logs rows 90 days. Only
// Storage objects are touched; audit_logs entries are untouched.
//
// Phase 2 (2026-07-22, Part E) — formatting-bucket retention.
// Nothing previously deleted anything under formatting/<jobId>/
// (uploaded manuscripts, figures, state.json with author
// names/emails, outputs), contradicting the Studio's own
// confidentiality positioning. Terminal jobs older than 7 days get
// their storage purged (row kept as audit trail, path columns
// nulled); non-terminal jobs idle >24h are marked failed with an
// honest message and purged on the same 7-day clock. Decision logic
// is pure + unit-tested in lib/formatting/pipeline/retention.ts.
// Extends this cron rather than adding a sixth (vercel.json already
// declares 5; the plan's cron allowance is unverified).
//
// Gated by Bearer ${CRON_SECRET} header (same convention as the
// other crons). Without the header returns 401.
//
// Idempotent — re-running on a cron tick that has nothing to reap
// is a no-op. Audit log row preview_artifacts_reaped written each
// run with the deleted-counts.
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import {
  retentionActionFor,
  EXPIRED_JOB_MESSAGE,
  FORMATTING_RETENTION_DAYS,
  STALE_JOB_HOURS,
  type RetentionJobView,
} from '@/lib/formatting/pipeline/retention'
import { FORMATTING_BUCKET } from '@/lib/formatting/pipeline/api'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const RETENTION_DAYS = 7
const PREVIEW_PREFIX = 'previews'
const STORAGE_BUCKET = 'submissions'

export async function GET(req: NextRequest) {
  const expected = process.env.CRON_SECRET
  if (!expected) {
    return NextResponse.json(
      { error: 'CRON_SECRET not configured on this deployment.' },
      { status: 503 }
    )
  }
  const auth = req.headers.get('authorization') || ''
  const got = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  if (got !== expected) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  const admin = createAdminClient()
  const cutoffMs = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000

  // Storage list is shallow — we have one level of {manuscriptId}/
  // subdirectories under previews/, each containing N timestamped
  // PDFs. Walk both levels.
  const { data: manuscriptDirs, error: listDirsErr } = await admin.storage
    .from(STORAGE_BUCKET)
    .list(PREVIEW_PREFIX, { limit: 1000 })

  if (listDirsErr) {
    return NextResponse.json(
      { error: `Storage list failed: ${listDirsErr.message}` },
      { status: 502 }
    )
  }

  const toDelete: string[] = []
  for (const entry of manuscriptDirs ?? []) {
    // Entries with no id are directories
    if (!entry.name) continue

    const dirPath = `${PREVIEW_PREFIX}/${entry.name}`
    const { data: pdfs, error: pdfErr } = await admin.storage
      .from(STORAGE_BUCKET)
      .list(dirPath, { limit: 1000 })
    if (pdfErr) continue

    for (const pdf of pdfs ?? []) {
      // Use the file's created_at if available; fall back to filename
      // (we name them with ISO timestamp).
      const createdRaw = (pdf as { created_at?: string }).created_at
      let createdMs = createdRaw ? Date.parse(createdRaw) : NaN
      if (!Number.isFinite(createdMs)) {
        // Parse from filename — we encode "YYYY-MM-DDTHH-MM-SS-..."
        const m = pdf.name.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2})-(\d{2})-(\d{2})/)
        if (m) {
          const isoLike = `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}Z`
          createdMs = Date.parse(isoLike)
        }
      }
      if (!Number.isFinite(createdMs)) continue
      if (createdMs < cutoffMs) {
        toDelete.push(`${dirPath}/${pdf.name}`)
      }
    }
  }

  let deletedCount = 0
  if (toDelete.length > 0) {
    const { error: delErr } = await admin.storage
      .from(STORAGE_BUCKET)
      .remove(toDelete)
    if (delErr) {
      return NextResponse.json(
        { error: `Storage remove failed: ${delErr.message}`, deleted_count: 0 },
        { status: 502 }
      )
    }
    deletedCount = toDelete.length
  }

  // ---------------------------------------------------------
  // Phase 2 — formatting bucket retention (2026-07-22, Part E)
  // ---------------------------------------------------------
  const nowMs = Date.now()
  let expiredJobs = 0
  let purgedJobs = 0
  let formattingObjectsDeleted = 0
  let formattingFailures = 0

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const jobsTable = admin.from('formatting_jobs') as any
  // One query: anything idle past the 24h stale bound covers both rules (the
  // 7-day purge set is a subset). Rows drive the loop — never list the bucket.
  const staleCutoffIso = new Date(nowMs - STALE_JOB_HOURS * 60 * 60 * 1000).toISOString()
  const { data: candidates, error: jobsErr } = await jobsTable
    .select('id,status,updated_at,input_path,output_paths,figure_paths')
    .lt('updated_at', staleCutoffIso)
    .limit(500)

  if (jobsErr) {
    formattingFailures++
  } else {
    for (const row of (candidates ?? []) as (RetentionJobView & { id: string })[]) {
      const action = retentionActionFor(row, nowMs)
      if (action === 'expire') {
        const { error } = await jobsTable
          .update({
            status: 'failed',
            error: { stage: row.status, code: 'expired', message: EXPIRED_JOB_MESSAGE },
            updated_at: new Date().toISOString(),
          })
          .eq('id', row.id)
          .eq('status', row.status) // never race a live advance
        if (error) formattingFailures++
        else expiredJobs++
        continue
      }
      if (action !== 'purge') continue

      // Everything for a job lives under formatting/<jobId>/ at two levels:
      // root sidecars (meta.json, state.json) + input/ + output/. Supabase
      // storage listing is shallow, so walk the known layout.
      const paths: string[] = []
      let listFailed = false
      for (const prefix of [row.id, `${row.id}/input`, `${row.id}/output`]) {
        const { data: entries, error } = await admin.storage
          .from(FORMATTING_BUCKET)
          .list(prefix, { limit: 1000 })
        if (error) {
          listFailed = true
          continue
        }
        for (const entry of entries ?? []) {
          // Folders come back with a null id — files carry one.
          if ((entry as { id?: string | null }).id) paths.push(`${prefix}/${entry.name}`)
        }
      }
      if (listFailed) {
        formattingFailures++
        continue // retry the whole job on the next tick
      }
      if (paths.length > 0) {
        const { error: delErr } = await admin.storage.from(FORMATTING_BUCKET).remove(paths)
        if (delErr) {
          formattingFailures++
          continue
        }
        formattingObjectsDeleted += paths.length
      }
      // Bytes are gone — null the path columns so the row never re-purges.
      // error/report stay untouched: the row is the audit trail.
      const { error: nullErr } = await jobsTable
        .update({
          input_path: null,
          output_paths: null,
          figure_paths: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', row.id)
      if (nullErr) formattingFailures++
      else purgedJobs++
    }
  }

  try {
    await (admin.from('audit_logs') as any).insert({
      action: 'preview_artifacts_reaped',
      resource_type: 'manuscript',
      resource_id: null,
      details: {
        deleted_count: deletedCount,
        retention_days: RETENTION_DAYS,
        cutoff_iso: new Date(cutoffMs).toISOString(),
        formatting_jobs_expired: expiredJobs,
        formatting_jobs_purged: purgedJobs,
        formatting_objects_deleted: formattingObjectsDeleted,
        formatting_failures: formattingFailures,
      },
    })
  } catch {
    // swallow
  }

  return NextResponse.json({
    ok: true,
    deleted_count: deletedCount,
    retention_days: RETENTION_DAYS,
    formatting: {
      jobs_expired: expiredJobs,
      jobs_purged: purgedJobs,
      objects_deleted: formattingObjectsDeleted,
      failures: formattingFailures,
      retention_days: FORMATTING_RETENTION_DAYS,
      stale_job_hours: STALE_JOB_HOURS,
    },
  })
}
