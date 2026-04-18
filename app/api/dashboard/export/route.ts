import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

// GDPR Article 20 — right to data portability.
// Returns a JSON blob of every row the authenticated user owns or
// co-authored across the portal. File contents from Supabase
// Storage are NOT included (metadata only — file_name + storage_path
// + upload_date); a follow-up endpoint can stream signed URLs if
// Kanwar needs raw bytes in the export.
export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json(
      { error: 'Not authenticated.' },
      { status: 401 }
    )
  }

  const admin = createAdminClient()

  const [
    userRow,
    ownedManuscripts,
    coAuthoredLinks,
    reviewerApps,
  ] = await Promise.all([
    (admin.from('users') as any)
      .select('*')
      .eq('id', user.id)
      .maybeSingle(),
    (admin.from('manuscripts') as any)
      .select('*')
      .eq('corresponding_author_id', user.id),
    (admin.from('manuscript_authors') as any)
      .select('manuscript_id')
      .eq('author_id', user.id),
    (admin.from('reviewer_applications') as any)
      .select('*')
      .eq('email', (user.email || '').toLowerCase()),
  ])

  const ownedIds: string[] = (ownedManuscripts.data || []).map(
    (m: { id: string }) => m.id
  )
  const coAuthoredIds: string[] = Array.from(
    new Set(
      (coAuthoredLinks.data || [])
        .map((r: { manuscript_id: string }) => r.manuscript_id)
        .filter(Boolean)
    )
  )
  const allIds = Array.from(new Set([...ownedIds, ...coAuthoredIds]))

  let coAuthoredManuscripts: unknown[] = []
  let authors: unknown[] = []
  let metadata: unknown[] = []
  let files: unknown[] = []
  let payments: unknown[] = []

  if (allIds.length > 0) {
    const [
      coAuthoredRes,
      authorsRes,
      metadataRes,
      filesRes,
      paymentsRes,
    ] = await Promise.all([
      coAuthoredIds.length > 0
        ? (admin.from('manuscripts') as any)
            .select('*')
            .in('id', coAuthoredIds)
        : Promise.resolve({ data: [] }),
      (admin.from('manuscript_authors') as any)
        .select('*')
        .in('manuscript_id', allIds),
      (admin.from('manuscript_metadata') as any)
        .select('*')
        .in('manuscript_id', allIds),
      (admin.from('manuscript_files') as any)
        .select(
          'id, manuscript_id, original_filename, file_name, file_type, storage_path, file_size_bytes, file_order, version, upload_date'
        )
        .in('manuscript_id', allIds),
      (admin.from('payments') as any)
        .select('*')
        .in('manuscript_id', ownedIds.length > 0 ? ownedIds : ['00000000-0000-0000-0000-000000000000']),
    ])

    coAuthoredManuscripts = coAuthoredRes.data || []
    authors = authorsRes.data || []
    metadata = metadataRes.data || []
    files = filesRes.data || []
    payments = paymentsRes.data || []
  }

  const exportedAt = new Date().toISOString()
  const payload = {
    export_format_version: 1,
    exported_at: exportedAt,
    notice:
      'This file contains every record OSCRSJ stores for your account, per GDPR Article 20. File contents from Supabase Storage are not embedded — only the manuscript_files metadata (original_filename, storage_path, size, upload_date). Contact editorial@oscrsj.com for raw file exports.',
    user: userRow.data || null,
    manuscripts_as_corresponding_author: ownedManuscripts.data || [],
    manuscripts_as_co_author: coAuthoredManuscripts,
    manuscript_authors: authors,
    manuscript_metadata: metadata,
    manuscript_files: files,
    payments,
    reviewer_applications: reviewerApps.data || [],
  }

  // Best-effort audit log; a log failure must not block the export.
  try {
    await (admin.from('audit_logs') as any).insert({
      user_id: user.id,
      action: 'gdpr_export',
      resource_type: 'user',
      resource_id: user.id,
      details: {
        manuscript_count: allIds.length,
        owned_count: ownedIds.length,
        co_authored_count: coAuthoredIds.length,
      },
    })
  } catch {
    // swallow
  }

  const stamp = exportedAt.slice(0, 10).replace(/-/g, '')
  return new NextResponse(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="oscrsj-data-export-${user.id}-${stamp}.json"`,
      'Cache-Control': 'no-store',
    },
  })
}
