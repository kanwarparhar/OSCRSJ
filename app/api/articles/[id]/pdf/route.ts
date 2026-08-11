// LEGACY PDF path — /api/articles/{id}/pdf
//
// Superseded by /articles/{elocation}/pdf (Crossref DOI integration, Phase 2:
// Google Scholar's same-subdirectory rule + the robots.txt /api/ block). This
// URL is baked into the six already-published PDFs, past author emails and
// external links, so it stays forever as a permanent redirect.
//
// 308 (not 302) preserves the method and tells crawlers to transfer signal to
// the new location.

import { createAdminClient } from '@/lib/supabase/server'
import { classifyArticleParam, normalizeElocationParam } from '@/lib/publish/journal'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  const { id } = params
  const kind = classifyArticleParam(id)
  if (kind === 'invalid') {
    return new Response('Not found', { status: 404 })
  }

  // Resolve to the elocation so the redirect lands on the canonical form in
  // ONE hop. A redirect chain (uuid -> uuid -> eloc) dilutes crawl signal.
  const admin = createAdminClient()
  const base = admin.from('manuscripts').select('elocation_id, status')
  const { data } =
    kind === 'elocation'
      ? await base.eq('elocation_id', normalizeElocationParam(id)).single()
      : await base.eq('id', id).single()

  const row = data as { elocation_id: string | null; status: string } | null
  if (!row || row.status !== 'published' || !row.elocation_id) {
    return new Response('Not found', { status: 404 })
  }

  // Preserve any cache-busting query string the caller supplied.
  const search = new URL(req.url).search
  return Response.redirect(
    `https://www.oscrsj.com/articles/${row.elocation_id}/pdf${search}`,
    308
  )
}
