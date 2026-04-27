import { NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import type { SuggestedReviewer } from '@/lib/types/database'

// Editor/admin-only export of every suggested reviewer captured at
// submission Step 3, across all manuscripts. One row per
// (manuscript, suggested reviewer) pair so a manuscript with three
// suggestions produces three rows. Generated on demand from
// manuscript_metadata.suggested_reviewers (jsonb, migration 016).
//
// Behaviour notes:
// - Excludes manuscripts in 'draft' status — drafts are still being
//   filled in and dirty draft data is noisy. Once a manuscript is
//   submitted (any non-draft status) its suggested-reviewer rows
//   appear in the export.
// - Cache: no-store. Filename includes today's UTC date.
// - Falls through to a 0-row workbook (with the header row) when
//   nothing matches, so the editor still gets a valid file rather
//   than a 404.

export const runtime = 'nodejs'

interface ManuscriptLite {
  id: string
  submission_id: string
  title: string | null
  status: string
  manuscript_type: string | null
  subspecialty: string | null
  submission_date: string | null
  corresponding_author_id: string
}

interface MetadataLite {
  manuscript_id: string
  suggested_reviewers: SuggestedReviewer[] | null
}

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  const role = (profile as { role?: string } | null)?.role
  if (role !== 'editor' && role !== 'admin') {
    return NextResponse.json(
      { error: 'Editor or admin role required.' },
      { status: 403 }
    )
  }

  const admin = createAdminClient()

  // Two-step fetch (manuscripts → metadata) — cleaner than relying on
  // PostgREST embed shape, which can return the related table as either
  // an object (1:1) or array depending on FK introspection.
  const { data: manuscriptsData, error: msErr } = await (admin
    .from('manuscripts') as any)
    .select(
      'id, submission_id, title, status, manuscript_type, subspecialty, submission_date, corresponding_author_id'
    )
    .neq('status', 'draft')
    .order('submission_date', { ascending: false })

  if (msErr) {
    return NextResponse.json(
      { error: `Failed to load manuscripts: ${msErr.message}` },
      { status: 500 }
    )
  }

  const manuscripts = (manuscriptsData as ManuscriptLite[] | null) || []
  const manuscriptIds = manuscripts.map(m => m.id)

  // Pull metadata for all those manuscripts in one query.
  let metadataById = new Map<string, SuggestedReviewer[]>()
  if (manuscriptIds.length > 0) {
    const { data: metaData } = await (admin
      .from('manuscript_metadata') as any)
      .select('manuscript_id, suggested_reviewers')
      .in('manuscript_id', manuscriptIds)
    const metaRows = (metaData as MetadataLite[] | null) || []
    metadataById = new Map(
      metaRows.map(r => [r.manuscript_id, r.suggested_reviewers || []])
    )
  }

  // Collect unique corresponding-author IDs to fetch user details
  // for the export. Avoids an N+1 select.
  const authorIds = Array.from(
    new Set(manuscripts.map(m => m.corresponding_author_id))
  )

  let authorById = new Map<string, { full_name: string; email: string; affiliation: string | null }>()
  if (authorIds.length > 0) {
    const { data: usersData } = await (admin.from('users') as any)
      .select('id, full_name, email, affiliation')
      .in('id', authorIds)
    const users = (usersData as Array<{
      id: string
      full_name: string
      email: string
      affiliation: string | null
    }> | null) || []
    authorById = new Map(users.map(u => [u.id, u]))
  }

  // Flatten to one row per (manuscript, suggested reviewer) pair.
  type Row = Record<string, string | number>
  const rows: Row[] = []
  for (const m of manuscripts) {
    const suggestions = metadataById.get(m.id) || []
    if (suggestions.length === 0) continue
    const author = authorById.get(m.corresponding_author_id)
    for (const sr of suggestions) {
      // Drop fully-empty rows defensively. The wizard already filters
      // these but pre-migration drafts could carry junk.
      if (!sr.name?.trim() && !sr.email?.trim() && !sr.expertise?.trim()) continue
      rows.push({
        'Submission ID': m.submission_id || '',
        'Manuscript Title': m.title || '(untitled)',
        'Status': m.status,
        'Manuscript Type': m.manuscript_type || '',
        'Subspecialty': m.subspecialty || '',
        'Submitted Date': m.submission_date
          ? m.submission_date.slice(0, 10)
          : '',
        'Corresponding Author': author?.full_name || '',
        'Corresponding Author Email': author?.email || '',
        'Corresponding Author Affiliation': author?.affiliation || '',
        'Suggested Reviewer Name': sr.name?.trim() || '',
        'Suggested Reviewer Email': sr.email?.trim() || '',
        'Suggested Reviewer Expertise': sr.expertise?.trim() || '',
      })
    }
  }

  // Build the workbook. If there are zero rows, emit a header-only
  // sheet so the editor knows the export ran (vs. a download failure).
  const headerRow: Record<string, string> = {
    'Submission ID': '',
    'Manuscript Title': '',
    'Status': '',
    'Manuscript Type': '',
    'Subspecialty': '',
    'Submitted Date': '',
    'Corresponding Author': '',
    'Corresponding Author Email': '',
    'Corresponding Author Affiliation': '',
    'Suggested Reviewer Name': '',
    'Suggested Reviewer Email': '',
    'Suggested Reviewer Expertise': '',
  }
  const sheet = XLSX.utils.json_to_sheet(rows.length > 0 ? rows : [headerRow], {
    header: Object.keys(headerRow),
  })

  // Sensible default column widths so the file opens readably in
  // Excel/Numbers without manual resizing.
  ;(sheet as { ['!cols']?: Array<{ wch: number }> })['!cols'] = [
    { wch: 18 }, // Submission ID
    { wch: 48 }, // Title
    { wch: 16 }, // Status
    { wch: 18 }, // Type
    { wch: 22 }, // Subspecialty
    { wch: 14 }, // Submitted Date
    { wch: 24 }, // Corresponding Author
    { wch: 28 }, // Corresponding Author Email
    { wch: 32 }, // Corresponding Author Affiliation
    { wch: 24 }, // Reviewer Name
    { wch: 28 }, // Reviewer Email
    { wch: 36 }, // Reviewer Expertise
  ]

  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, sheet, 'Suggested Reviewers')

  const buffer = XLSX.write(workbook, {
    type: 'buffer',
    bookType: 'xlsx',
  }) as Buffer

  // Best-effort audit log. Failure must not block the download.
  try {
    await (admin.from('audit_logs') as any).insert({
      user_id: user.id,
      action: 'admin_suggested_reviewers_exported',
      resource_type: 'export',
      resource_id: null,
      details: {
        manuscript_count: manuscripts.length,
        row_count: rows.length,
      },
    })
  } catch {
    // swallow
  }

  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const filename = `oscrsj-suggested-reviewers-${stamp}.xlsx`

  return new NextResponse(buffer as unknown as BodyInit, {
    status: 200,
    headers: {
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}
