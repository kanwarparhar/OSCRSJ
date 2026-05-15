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

  return NextResponse.json({
    ok: true,
    payload: result.payload,
    warnings: result.warnings,
    errors: [],
  })
}
