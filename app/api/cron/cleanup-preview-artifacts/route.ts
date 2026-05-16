// ============================================================
// GET /api/cron/cleanup-preview-artifacts
// ============================================================
// Daily Vercel Cron (15:00 UTC). Reaps preview PDFs older than 7
// days from the submissions/previews/ directory in Supabase Storage.
// Per Janine §9 retention split: artifacts 7 days; audit_logs rows
// 90 days. This cron only touches Storage objects; audit_logs entries
// are untouched.
//
// Gated by Bearer ${CRON_SECRET} header (same convention as the
// other crons). Without the header returns 401.
//
// Idempotent — re-running on a cron tick that has nothing to reap
// is a no-op. Audit log row preview_artifacts_reaped written each
// run with the deleted-count.
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

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

  try {
    await (admin.from('audit_logs') as any).insert({
      action: 'preview_artifacts_reaped',
      resource_type: 'manuscript',
      resource_id: null,
      details: {
        deleted_count: deletedCount,
        retention_days: RETENTION_DAYS,
        cutoff_iso: new Date(cutoffMs).toISOString(),
      },
    })
  } catch {
    // swallow
  }

  return NextResponse.json({
    ok: true,
    deleted_count: deletedCount,
    retention_days: RETENTION_DAYS,
  })
}
