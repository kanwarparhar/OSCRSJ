// Public PDF download — /articles/{elocation}/pdf
//
// MOVED HERE FROM /api/articles/[id]/pdf (Crossref DOI integration, Phase 2).
// Two independent reasons, both of which were silently costing us indexing:
//
//   1. Google Scholar requires citation_pdf_url to sit in the SAME directory
//      as the landing page it belongs to. `/api/articles/{id}/pdf` is not in
//      the same subdirectory as `/articles/{eloc}`, so Scholar would not
//      associate the full text with the article record.
//   2. robots.txt disallowed `/api/` wholesale for the wildcard agent, which
//      blocked Semantic Scholar, Bing and Turnitin/iThenticate from ever
//      fetching the PDF. The Crossref similarity-check crawler URL in every
//      deposit points at this path, so it MUST be crawlable.
//
// The old /api path is retained as a permanent redirect (it is baked into
// already-published PDFs, emails and external links).
//
// Accepts BOTH the elocation form and a legacy UUID so the redirect from the
// old route can hand off either one.

import { createAdminClient } from '@/lib/supabase/server'
import { classifyArticleParam, normalizeElocationParam } from '@/lib/publish/journal'
import type { ManuscriptRow } from '@/lib/types/database'

export const dynamic = 'force-dynamic'
// force-no-store on the Supabase reads too. Without it, Next's Data Cache can
// pin a stale `published_pdf_storage_path` after a re-publish/re-path, so the
// proxy downloads the OLD object even on a Vercel cache MISS — the 2026-07-03
// "incomplete published PDF" incident. The path lookup must always be live.
export const fetchCache = 'force-no-store'

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const { id } = params
  const kind = classifyArticleParam(id)
  if (kind === 'invalid') {
    return new Response('Not found', { status: 404 })
  }

  const admin = createAdminClient()

  const base = admin
    .from('manuscripts')
    .select('id, status, published_pdf_storage_path, elocation_id, title')
  const { data, error } =
    kind === 'elocation'
      ? await base.eq('elocation_id', normalizeElocationParam(id)).single()
      : await base.eq('id', id).single()

  if (error || !data) {
    return new Response('Manuscript not found', { status: 404 })
  }

  const manuscript = data as Pick<
    ManuscriptRow,
    'id' | 'status' | 'published_pdf_storage_path' | 'elocation_id' | 'title'
  >

  // The public-access gate. The 'submissions' bucket is private and we read it
  // with the admin client, so this check is the ONLY thing standing between an
  // unpublished manuscript and the open internet.
  if (manuscript.status !== 'published') {
    return new Response('Not found', { status: 404 })
  }

  if (!manuscript.published_pdf_storage_path) {
    return new Response('PDF not yet available', { status: 404 })
  }

  const { data: blob, error: storageError } = await admin.storage
    .from('submissions')
    .download(manuscript.published_pdf_storage_path)

  if (storageError || !blob) {
    console.error('[pdf-proxy] Storage download failed:', storageError)
    return new Response('PDF could not be retrieved', { status: 502 })
  }

  const fileSlug = manuscript.elocation_id
    ? `oscrsj-${manuscript.elocation_id}`
    : `oscrsj-manuscript-${manuscript.id.slice(0, 8)}`
  const fileName = `${fileSlug}.pdf`

  const arrayBuffer = await blob.arrayBuffer()

  return new Response(arrayBuffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${fileName}"`,
      'Content-Length': String(arrayBuffer.byteLength),
      // Short edge cache so a correction re-render surfaces within minutes
      // instead of up to an hour (2026-07-03 incident).
      'Cache-Control': 'public, max-age=300, stale-while-revalidate=600',
    },
  })
}
