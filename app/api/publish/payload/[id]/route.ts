// GET /api/publish/payload/[id] — Session 53 (2026-05-15).
//
// Returns the synthesized Franklin v1.0 payload JSON for a given
// manuscript. The OSCRSJ Renderer (separate Next.js app at
// localhost:3001) fetches this endpoint during its /render/[id]
// cleanup workflow so the publish chain has a real payload to feed
// into Jinja2 + JATS generation alongside the editor-cleaned HTML.
//
// Auth: Bearer-token via the `RENDERER_SHARED_SECRET` env var. The
// renderer must send `Authorization: Bearer ${RENDERER_SHARED_SECRET}`.
// The secret is shared between the two apps' .env.local files;
// there's no user-session involved (renderer is a local-only
// service, no browser hits this endpoint directly).
//
// Tracks Manvir handoff ^handoff-renderer-payload-synthesizer-2026-05-15.

import { NextResponse } from 'next/server'
import { synthesizeRendererPayload } from '@/lib/publish/synthesize'
import { createAdminClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function GET(req: Request, context: RouteContext) {
  // Shared-secret auth.
  const expected = process.env.RENDERER_SHARED_SECRET
  if (!expected) {
    return NextResponse.json(
      { error: 'RENDERER_SHARED_SECRET not configured on this deployment.' },
      { status: 503 }
    )
  }

  const authHeader = req.headers.get('authorization') || ''
  const bearer = authHeader.match(/^Bearer\s+(.+)$/i)?.[1] || ''
  if (bearer !== expected) {
    return NextResponse.json(
      { error: 'Unauthorized.' },
      { status: 401 }
    )
  }

  const { id } = await context.params
  const uuidRe =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!uuidRe.test(id)) {
    return NextResponse.json(
      { error: `Manuscript id is not a valid UUID: ${id}` },
      { status: 400 }
    )
  }

  const result = await synthesizeRendererPayload(id)

  if (!result.ok || !result.payload) {
    return NextResponse.json(
      {
        ok: false,
        errors: result.errors,
        warnings: result.warnings,
      },
      { status: 422 }
    )
  }

  // Phase 2 HTML body editor (Sushant Session 64) — surface the editor-
  // curated cleaned HTML if one is saved. The renderer's cleanup pane
  // at `/render/[id]` reads this field to seed its textarea so admins
  // who curated body HTML in the OSCRSJ admin BodyEditor don't have to
  // re-paste on the renderer side. Null when nothing is saved → the
  // cleanup pane behaves as today (Session 62 extractBody seeds, admin
  // can paste/edit before publish).
  let bodyCleanedHtml: string | null = null
  try {
    const admin = createAdminClient()
    const { data } = await admin
      .from('manuscripts')
      .select('manuscript_body_cleaned_html')
      .eq('id', id)
      .maybeSingle()
    bodyCleanedHtml =
      ((data as { manuscript_body_cleaned_html: string | null } | null)
        ?.manuscript_body_cleaned_html) ?? null
  } catch {
    // swallow — non-fatal; falls through to null
  }

  return NextResponse.json({
    ok: true,
    payload: result.payload,
    warnings: result.warnings,
    errors: [],
    // Sushant Session 64 — additive field. Renderer cleanup pane MAY
    // read this to seed its textarea. Field is backward-compatible:
    // older renderers that ignore it produce the same output as
    // pre-Session-64 behaviour.
    manuscriptBodyCleanedHtml: bodyCleanedHtml,
  })
}
