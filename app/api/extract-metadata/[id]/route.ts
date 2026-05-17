// Metadata-extract proxy (Sushant Session 58, Phase 1.5 — 2026-05-16).
//
// The Pre-Render Metadata Editor calls THIS route on first page-load
// (server-side, from MetadataEditorPanel.tsx) to pre-fill abstract
// sections + CoI + funding + IRB + patient consent + acknowledgments
// from the accepted manuscript's .docx via the renderer's Pandoc
// extraction pipeline.
//
// Why a proxy: the renderer endpoint requires Bearer
// ${RENDERER_SHARED_SECRET} which lives in Vercel envs (not safe to
// expose to the editor's browser). The OSCRSJ Vercel deployment is
// the only place that can attach the bearer header.
//
// Architecture mirrors /api/preview/[id] (the preview proxy from
// Session 57 Phase 1.C). The only differences:
//   • Returns JSON (not NDJSON streaming) — extraction is fast and
//     fits in one response.
//   • Best-effort audit-log row "metadata_extracted_from_docx" so
//     the editorial trail records what the editor saw on page-load.
//   • Status 200 on graceful "no .docx available" — we don't want
//     to break the editor page if the manuscript predates the file-
//     upload pattern; the editor simply renders without pre-fills.
//
// Author authorization: requireAdminOnly (matches /api/preview).
// Sushant's Session 57 self-handoff specified this is fine because
// the editor is admin-only anyway.

import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 120

interface RouteContext {
  params: Promise<{ id: string }>
}

async function requireAdmin(): Promise<
  { userId: string } | { error: string; status: number }
> {
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
        ok: false,
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
  const rendererUrl = `${rendererBase.replace(/\/+$/, '')}/api/extract-metadata/${id}`

  let rendererResp: Response
  try {
    rendererResp = await fetch(rendererUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${expectedSecret}`,
      },
      cache: 'no-store',
    })
  } catch (err) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: `Could not reach renderer at ${rendererUrl}: ${err instanceof Error ? err.message : String(err)}. Is the local renderer dev server running on Kanwar's Mac?`,
      }),
      { status: 502, headers: { 'Content-Type': 'application/json' } }
    )
  }

  let body: unknown
  try {
    body = await rendererResp.json()
  } catch {
    return new Response(
      JSON.stringify({
        ok: false,
        error: `Renderer returned non-JSON (status ${rendererResp.status}).`,
      }),
      { status: 502, headers: { 'Content-Type': 'application/json' } }
    )
  }

  // Best-effort audit-log row. Janine §9 retention rules don't apply
  // here (extraction is not a published-artifact event); we log to
  // give editorial a paper trail of "editor saw pre-fills at <time>"
  // for future "why did this manuscript publish with X" questions.
  try {
    const { createAdminClient } = await import('@/lib/supabase/server')
    const admin = createAdminClient()
    const summary =
      rendererResp.ok && body && typeof body === 'object' && 'fields' in body
        ? extractionSummary((body as { fields: unknown }).fields)
        : { ok: false }
    await (admin.from('audit_logs') as any).insert({
      user_id: gate.userId,
      action: 'metadata_extracted_from_docx',
      resource_type: 'manuscript',
      resource_id: id,
      details: {
        manuscript_id: id,
        renderer_status: rendererResp.status,
        ...summary,
      },
    })
  } catch {
    // swallow — audit-log failure must not break the editor page
  }

  return new Response(JSON.stringify(body), {
    status: rendererResp.ok ? 200 : rendererResp.status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  })
}

// Shallow summary of what was extracted — enough for the audit-log
// row to be useful in a "why did the editor accept these pre-fills"
// review. Avoids dumping the full extracted text (some statements
// may carry IRB protocol numbers or other low-PII identifiers).
function extractionSummary(fields: unknown): {
  ok: boolean
  abstract_sections_count?: number
  coi_confidence?: string
  funding_confidence?: string
  irb_confidence?: string
  consent_confidence?: string
  consent_variant_guess?: string | null
  ack_confidence?: string
} {
  if (!fields || typeof fields !== 'object') return { ok: false }
  const f = fields as Record<string, any>
  return {
    ok: true,
    abstract_sections_count: Array.isArray(f.abstract_sections)
      ? f.abstract_sections.length
      : 0,
    coi_confidence: f.conflict_of_interest?.confidence ?? 'none',
    funding_confidence: f.funding?.confidence ?? 'none',
    irb_confidence: f.irb?.statement?.confidence ?? 'none',
    consent_confidence: f.patient_consent?.confidence ?? 'none',
    consent_variant_guess: f.patient_consent?.variant_guess ?? null,
    ack_confidence: f.acknowledgments?.confidence ?? 'none',
  }
}
