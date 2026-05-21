// Public figure proxy — /api/articles/[id]/figure (Session 67, 2026-05-21)
//
// Serves the first (file_order ASC) figure image for a published manuscript.
// Used by the homepage article cards and the article detail page to display
// a real radiograph/figure instead of the gradient placeholder.
//
// Security gate: manuscript must be status='published'. The 'submissions'
// bucket is private so we proxy through the admin client; the status check
// is the public-access fence — non-published figures are never served.
//
// Returns the image bytes with the original Content-Type (image/jpeg,
// image/png, etc.) inferred from the filename extension. Cached 1 hour
// at CDN edges since published figures don't change.

import { createAdminClient } from '@/lib/supabase/server'
import type { ManuscriptFileRow } from '@/lib/types/database'

export const dynamic = 'force-dynamic'

const EXT_TO_MIME: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  tiff: 'image/tiff',
  tif: 'image/tiff',
  svg: 'image/svg+xml',
}

function mimeFromPath(storagePath: string): string {
  const ext = storagePath.split('.').pop()?.toLowerCase() ?? ''
  return EXT_TO_MIME[ext] ?? 'application/octet-stream'
}

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const { id } = params
  if (!id) return new Response('Missing manuscript ID', { status: 400 })

  const admin = createAdminClient()

  // Verify the manuscript is published.
  const { data: m } = await admin
    .from('manuscripts')
    .select('id, status')
    .eq('id', id)
    .eq('status', 'published')
    .single()

  if (!m) return new Response('Not found', { status: 404 })

  // Fetch the first figure file (lowest file_order).
  const { data: files } = await admin
    .from('manuscript_files')
    .select('*')
    .eq('manuscript_id', id)
    .eq('file_type', 'figure')
    .order('file_order', { ascending: true })
    .limit(1)

  const figure = ((files as ManuscriptFileRow[] | null) || [])[0]
  if (!figure) return new Response('No figure available', { status: 404 })

  // Download from Supabase Storage.
  const { data: blob, error } = await admin.storage
    .from('submissions')
    .download(figure.storage_path)

  if (error || !blob) {
    console.error('[figure-proxy] Storage download failed:', error)
    return new Response('Figure could not be retrieved', { status: 502 })
  }

  const arrayBuffer = await blob.arrayBuffer()
  const contentType = mimeFromPath(figure.storage_path)

  return new Response(arrayBuffer, {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
    },
  })
}
