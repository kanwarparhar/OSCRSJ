// Public PDF download proxy (Session 67 — 2026-05-21).
//
// Serves the published PDF for any manuscript with status='published'.
// No authentication required — published articles are open-access (CC BY 4.0).
//
// Flow:
//   1. Look up manuscript by ID, verify status='published' + pdf path exists.
//   2. Download the PDF blob from Supabase Storage using the admin client.
//   3. Stream back with Content-Type: application/pdf and a descriptive
//      Content-Disposition filename derived from the elocation_id.
//
// The 'submissions' bucket is private, so we use the admin client to bypass
// RLS. The public-access gate is the status='published' check here — any
// non-published manuscript returns 404 regardless of the requester.

import { createAdminClient } from '@/lib/supabase/server'
import type { ManuscriptRow } from '@/lib/types/database'

export const dynamic = 'force-dynamic'

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const { id } = params
  if (!id) {
    return new Response('Missing manuscript ID', { status: 400 })
  }

  const admin = createAdminClient()

  // Fetch only the fields we need.
  const { data, error } = await admin
    .from('manuscripts')
    .select('id, status, published_pdf_storage_path, elocation_id, title')
    .eq('id', id)
    .single()

  if (error || !data) {
    return new Response('Manuscript not found', { status: 404 })
  }

  const manuscript = data as Pick<
    ManuscriptRow,
    'id' | 'status' | 'published_pdf_storage_path' | 'elocation_id' | 'title'
  >

  // Only published manuscripts are publicly accessible.
  if (manuscript.status !== 'published') {
    return new Response('Not found', { status: 404 })
  }

  if (!manuscript.published_pdf_storage_path) {
    return new Response('PDF not yet available', { status: 404 })
  }

  // Download the PDF blob from Supabase Storage.
  const { data: blob, error: storageError } = await admin.storage
    .from('submissions')
    .download(manuscript.published_pdf_storage_path)

  if (storageError || !blob) {
    console.error('[pdf-proxy] Storage download failed:', storageError)
    return new Response('PDF could not be retrieved', { status: 502 })
  }

  // Build a descriptive filename: oscrsj-e0001.pdf (or fall back to the id).
  const fileSlug = manuscript.elocation_id
    ? `oscrsj-${manuscript.elocation_id}`
    : `oscrsj-manuscript-${id.slice(0, 8)}`
  const fileName = `${fileSlug}.pdf`

  const arrayBuffer = await blob.arrayBuffer()

  return new Response(arrayBuffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${fileName}"`,
      'Content-Length': String(arrayBuffer.byteLength),
      // Cache for 1 hour on CDN edges — published PDFs don't change.
      'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
    },
  })
}
