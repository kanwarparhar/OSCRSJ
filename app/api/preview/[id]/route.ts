// Preview render proxy (Sushant Session 57, Phase 1.C — 2026-05-15).
//
// The Pre-Render Metadata Editor's "Open preview ↗" button hits THIS
// route on the OSCRSJ main app. We do four things:
//
//   1. Gate on requireAdminOnly (editor must be authenticated +
//      admin role).
//   2. Synthesize the payload via synthesizeRendererPayload(id).
//   3. Forward POST → renderer's /api/preview/[id] with bearer
//      auth + the payload in the body. The renderer is the only
//      place that can run the chain (Pandoc + WeasyPrint + verapdf
//      + JATS — all native binaries on Kanwar's Mac).
//   4. Stream the renderer's NDJSON response back unchanged so the
//      client island shows the chain stages live.
//
// The reason we proxy rather than letting the editor's browser hit
// the renderer directly: the editor's browser can't carry the
// RENDERER_SHARED_SECRET. The Vercel deployment can.
//
// 60-second Vercel timeout per Franklin Risk #4: a typical preview
// render is 30–45s. We're operating near the cliff but inside it.
// Since this route is just a streaming pass-through (no chain
// execution in-process), Vercel's serverless function reaches the
// end-of-stream quickly once the renderer finishes. If timeouts
// surface in practice, the chain runs on the renderer anyway — the
// next "Try again" call picks up where the stream cut off.

import { synthesizeRendererPayload } from '@/lib/publish/synthesize'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

interface RouteContext {
  params: Promise<{ id: string }>
}

async function requireAdmin(): Promise<{ userId: string } | { error: string; status: number }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.', status: 401 }
  const { data, error } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()
  if (error || !data) return { error: 'Profile not found.', status: 403 }
  const role = (data as { role: string }).role
  if (role !== 'admin') return { error: 'Admin role required.', status: 403 }
  return { userId: user.id }
}

export async function POST(_req: Request, context: RouteContext) {
  const { id } = await context.params

  const gate = await requireAdmin()
  if ('error' in gate) {
    return new Response(JSON.stringify({ error: gate.error }), {
      status: gate.status,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const expectedSecret = process.env.RENDERER_SHARED_SECRET
  if (!expectedSecret) {
    return new Response(
      JSON.stringify({
        error:
          'RENDERER_SHARED_SECRET is not configured on this deployment. Set it on Vercel (must match the renderer .env.local value).',
      }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    )
  }

  const rendererBase =
    process.env.NEXT_PUBLIC_RENDERER_URL ||
    process.env.RENDERER_URL ||
    'http://localhost:3001'
  const rendererUrl = `${rendererBase.replace(/\/+$/, '')}/api/preview/${id}`

  // Synthesize the payload server-side. The renderer needs it to
  // build the JATS XML + drive Pandoc's HTML pass against the
  // template. Synth result short-circuits the request if the
  // editor has unresolved errors (saves a wasted chain run).
  const synthResult = await synthesizeRendererPayload(id)
  if (!synthResult.ok || !synthResult.payload) {
    return new Response(
      JSON.stringify({
        error:
          'Cannot render preview — synthesizer returned errors. Resolve them in the editor and retry.',
        synthErrors: synthResult.errors,
        synthWarnings: synthResult.warnings,
      }),
      { status: 422, headers: { 'Content-Type': 'application/json' } }
    )
  }

  // Audit log row for the preview-render kick. Janine §9 — the
  // audit-log row persists 90 days even though the artifact itself
  // is reaped after 7. Best-effort write.
  try {
    const { createAdminClient } = await import('@/lib/supabase/server')
    const admin = createAdminClient()
    await (admin.from('audit_logs') as any).insert({
      user_id: gate.userId,
      action: 'preview_render_invoked',
      resource_type: 'manuscript',
      resource_id: id,
      details: {
        manuscript_id: id,
        warnings_at_preview_time: synthResult.warnings,
      },
    })
  } catch {
    // swallow
  }

  // Forward to renderer with bearer auth + payload.
  const rendererResp = await fetch(rendererUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${expectedSecret}`,
    },
    body: JSON.stringify({
      cleanedHtml: '',
      rawHtml: '',
      cleanupDurationSeconds: 0,
      cleanupDiffSummary: { linesAdded: 0, linesRemoved: 0, charactersChanged: 0 },
      splitReferencesCount: 0,
      payload: synthResult.payload,
    }),
    cache: 'no-store',
  }).catch((err) => {
    return new Response(
      JSON.stringify({
        error: `Could not reach renderer at ${rendererUrl}: ${err instanceof Error ? err.message : String(err)}. Is the local renderer dev server running on Kanwar's Mac?`,
      }),
      { status: 502, headers: { 'Content-Type': 'application/json' } }
    )
  })

  if (rendererResp instanceof Response && rendererResp.status === 502) {
    return rendererResp
  }
  const upstream = rendererResp as Response
  if (!upstream.ok) {
    let body = '(no body)'
    try {
      body = await upstream.text()
    } catch {}
    return new Response(
      JSON.stringify({
        error: `Renderer returned ${upstream.status}: ${body}`,
      }),
      { status: upstream.status, headers: { 'Content-Type': 'application/json' } }
    )
  }

  // Stream the NDJSON body straight through to the client. The
  // renderer's body is a ReadableStream; we wrap it in a new
  // Response with the same headers so Next.js Vercel doesn't
  // buffer it.
  return new Response(upstream.body, {
    status: 200,
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-store, no-transform',
    },
  })
}
