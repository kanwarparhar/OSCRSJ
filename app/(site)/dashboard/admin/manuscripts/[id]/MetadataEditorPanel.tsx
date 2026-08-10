import { headers } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/server'
import {
  synthesizeRendererPayload,
  validateMetadataForRender,
} from '@/lib/publish/synthesize'
import type { ExtractResponse, ExtractedFields } from '@/lib/publish/extractedMetadata'
import { getRendererLaunchUrl } from '@/lib/admin/actions'
import type {
  ManuscriptRow,
  ManuscriptAuthorRow,
  ManuscriptMetadataRow,
} from '@/lib/types/database'
import MetadataEditorForm from './MetadataEditorForm'
import type { AuthorState } from './AuthorCard'

// Pre-Render Metadata Editor — server shell (Sushant Session 57,
// Phase 1.B). Loads all editable data + runs the initial synthesizer
// dry-run server-side so the form mounts with §5 Validation Summary
// already populated (no client-side validation flash). Hands off to
// MetadataEditorForm.tsx (client island) for the actual editing UX.
//
// Mounted between RevisionsPanel and PublishPipelinePanel on
// `/dashboard/admin/manuscripts/[id]`. Status-gated: only renders
// when status ∈ {accepted, published}.

interface Props {
  manuscriptId: string
}

export default async function MetadataEditorPanel({ manuscriptId }: Props) {
  const admin = createAdminClient()

  const { data: mData } = await admin
    .from('manuscripts')
    .select('*')
    .eq('id', manuscriptId)
    .maybeSingle()
  const manuscript = mData as ManuscriptRow | null
  if (!manuscript) return null

  if (manuscript.status !== 'accepted' && manuscript.status !== 'published') {
    return null
  }

  const [authorsRes, metadataRes, synthResult, launch, affCountRes, extractResult] =
    await Promise.all([
      admin
        .from('manuscript_authors')
        .select('*')
        .eq('manuscript_id', manuscriptId)
        .order('author_order', { ascending: true }),
      admin
        .from('manuscript_metadata')
        .select('*')
        .eq('manuscript_id', manuscriptId)
        .maybeSingle(),
      synthesizeRendererPayload(manuscriptId),
      getRendererLaunchUrl(manuscriptId),
      admin
        .from('manuscript_affiliations')
        .select('id', { count: 'exact', head: true })
        .eq('manuscript_id', manuscriptId),
      fetchExtractedMetadata(manuscriptId),
    ])

  // Session 80 — figure count for the §5 body-structural checks
  // (kept out of the Promise.all above to avoid re-numbering its
  // destructure; one extra head-count round-trip is negligible here).
  const figCountRes = await admin
    .from('manuscript_files')
    .select('id', { count: 'exact', head: true })
    .eq('manuscript_id', manuscriptId)
    .eq('file_type', 'figure')

  const authors = (authorsRes.data as ManuscriptAuthorRow[] | null) ?? []
  const metadata = (metadataRes.data as ManuscriptMetadataRow | null) ?? null
  const affCount = affCountRes.count ?? 0
  const extracted: ExtractedFields | null = extractResult.fields ?? null
  const extractError: string | null = extractResult.error

  const authorStates: AuthorState[] = authors.map((a) => ({
    id: a.id,
    full_name: a.full_name,
    degrees: a.degrees,
    email: a.email,
    affiliation: a.affiliation,
    orcid_id: a.orcid_id,
    contribution: a.contribution,
    is_corresponding: a.is_corresponding,
    is_equal_contribution: !!a.is_equal_contribution,
  }))

  // Run initial validator against current DB state (no draft overlay)
  // so the form mounts with §5 pre-populated.
  const initialValidation = await validateMetadataForRender({
    manuscript_type: manuscript.manuscript_type,
    title: manuscript.title || '',
    running_title: manuscript.running_title || '',
    doi: manuscript.doi || '',
    keywords: manuscript.keywords || [],
    abstract: manuscript.abstract || '',
    submission_date: manuscript.submission_date,
    authors: authors.map((a) => ({
      full_name: a.full_name,
      email: a.email,
      affiliation: a.affiliation || '',
      orcid_id: a.orcid_id || '',
      contribution: a.contribution || '',
      is_corresponding: a.is_corresponding,
      is_equal_contribution: !!a.is_equal_contribution,
    })),
    conflict_of_interest: metadata?.conflict_of_interest || '',
    funding_sources: metadata?.funding_sources || [],
    data_availability_statement: metadata?.data_availability_statement || '',
    ai_tools_used: metadata?.ai_tools_used ?? null,
    ai_tools_details: metadata?.ai_tools_details || '',
    patient_consent_variant: metadata?.patient_consent_variant ?? null,
    patient_consent_statement: metadata?.patient_consent_statement || '',
    patient_consent_irb_institution: metadata?.patient_consent_irb_institution || '',
    patient_consent_irb_protocol: metadata?.patient_consent_irb_protocol || '',
    equal_contribution_statement: metadata?.equal_contribution_statement || '',
    has_affiliations_table_data: affCount > 0,
    // Session 80 — body-structural inputs for mount-time §5 parity with
    // previewMetadataValidation.
    body_html: manuscript.manuscript_body_cleaned_html ?? null,
    figure_count: figCountRes.count ?? 0,
  })

  const handlingEditor = synthResult.payload?.handling_editor || null

  return (
    <section className="bg-white border border-border rounded-xl p-6 space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="font-serif text-lg text-brown-dark">
            Pre-render metadata editor
          </h2>
          <p className="text-xs text-brown mt-1 max-w-2xl leading-relaxed">
            Edit every field the renderer&apos;s payload synthesizer consumes.
            Live validation re-runs 500ms after each keystroke. Save persists
            transactionally across <code className="text-xs bg-cream-alt px-1 py-0.5 rounded">manuscripts</code>,{' '}
            <code className="text-xs bg-cream-alt px-1 py-0.5 rounded">manuscript_authors</code>, and{' '}
            <code className="text-xs bg-cream-alt px-1 py-0.5 rounded">manuscript_metadata</code>.
          </p>
        </div>
        <span className="text-[11px] uppercase tracking-widest text-brown bg-cream-alt px-2.5 py-1 rounded-full border border-border whitespace-nowrap">
          Phase 1.B · editable
        </span>
      </div>

      <MetadataEditorForm
        initial={{
          manuscript_id: manuscript.id,
          status: manuscript.status,
          manuscript_type: manuscript.manuscript_type,
          title: manuscript.title || '',
          running_title: manuscript.running_title || '',
          doi: manuscript.doi || '',
          // No 'e0001' default. An unassigned elocation must LOOK unassigned:
          // showing e0001 told the editor this manuscript already had the
          // identity of article one. Identity is minted at acceptance.
          elocation_id: manuscript.elocation_id || '',
          subspecialty: manuscript.subspecialty || '',
          keywords: manuscript.keywords || [],
          abstract: manuscript.abstract || '',
          authors: authorStates,
          conflict_of_interest: metadata?.conflict_of_interest || '',
          funding_sources: metadata?.funding_sources || [],
          data_availability_statement: metadata?.data_availability_statement || '',
          ethics_approval_number: metadata?.ethics_approval_number || '',
          ai_tools_used: metadata?.ai_tools_used ?? null,
          ai_tools_details: metadata?.ai_tools_details || '',
          patient_consent_variant: metadata?.patient_consent_variant ?? null,
          patient_consent_statement: metadata?.patient_consent_statement || '',
          patient_consent_irb_institution: metadata?.patient_consent_irb_institution || '',
          patient_consent_irb_protocol: metadata?.patient_consent_irb_protocol || '',
          acknowledgments: metadata?.acknowledgments || '',
          equal_contribution_statement: metadata?.equal_contribution_statement || '',
          handling_editor: handlingEditor,
          initial_errors: initialValidation.errors,
          initial_warnings: initialValidation.warnings,
          extracted,
          extract_error: extractError,
          extracted_source_file_type: extractResult.source_file_type ?? null,
        }}
        rendererUrl={launch.url || ''}
      />
    </section>
  )
}

// Server-side fetch of the renderer's /api/extract-metadata endpoint.
// Phase 1.5 (Session 58): regex-first heuristic .docx extraction via
// Pandoc. The renderer-side runs Pandoc + parses canonical heading
// anchors and returns confidence-scored pre-fill values for the
// editor's six metadata regions (abstract sections / CoI / funding /
// IRB / patient consent / acknowledgments).
//
// We call the renderer DIRECTLY (not via our own proxy) on first
// page-load because:
//   1. We're already server-side here — bearer auth comes from env,
//      no CORS concerns.
//   2. The proxy exists at /api/extract-metadata for future client-
//      side re-extraction (e.g., an "Re-extract from latest .docx"
//      button) where the editor's browser can't carry the bearer.
//   3. Skipping the proxy saves one HTTP hop on every page-load.
//
// Audit-log written best-effort regardless of fetch outcome.
async function fetchExtractedMetadata(manuscriptId: string): Promise<{
  fields: ExtractedFields | null
  error: string | null
  source_file_type: 'manuscript' | 'blinded_manuscript' | null
}> {
  // Headers are read defensively (route hydration changes between
  // Next.js versions); we don't actually need anything from headers,
  // but the import keeps Next.js from treating this as a static page
  // and caching the result.
  try {
    headers()
  } catch {
    // ignore
  }

  const secret = process.env.RENDERER_SHARED_SECRET
  if (!secret) {
    return {
      fields: null,
      error:
        'RENDERER_SHARED_SECRET not configured. Set on Vercel + renderer .env.local (must match).',
      source_file_type: null,
    }
  }

  const rendererBase =
    process.env.NEXT_PUBLIC_RENDERER_URL ||
    process.env.RENDERER_URL ||
    'http://localhost:3001'
  const rendererUrl = `${rendererBase.replace(/\/+$/, '')}/api/extract-metadata/${manuscriptId}`

  let resp: Response
  try {
    resp = await fetch(rendererUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${secret}`,
      },
      cache: 'no-store',
      // Renderer extraction is local Pandoc; budget a bit higher than
      // the synthesizer's expected RTT to avoid premature timeouts on
      // larger .docx files (10-page case reports can take ~2s on
      // Pandoc 3.x with cold cache).
      signal: AbortSignal.timeout(90_000),
    })
  } catch (err) {
    return {
      fields: null,
      error: `Could not reach renderer at ${rendererUrl}: ${err instanceof Error ? err.message : String(err)}. Is the local renderer dev server running on Kanwar's Mac?`,
      source_file_type: null,
    }
  }

  let body: ExtractResponse
  try {
    body = (await resp.json()) as ExtractResponse
  } catch {
    return {
      fields: null,
      error: `Renderer returned non-JSON (status ${resp.status}).`,
      source_file_type: null,
    }
  }

  // Best-effort audit-log row — handoff acceptance criterion
  try {
    const adminClient = createAdminClient()
    const summary = body.fields
      ? {
          abstract_sections_count: body.fields.abstract_sections?.length ?? 0,
          coi_confidence: body.fields.conflict_of_interest?.confidence ?? 'none',
          funding_confidence: body.fields.funding?.confidence ?? 'none',
          irb_confidence: body.fields.irb?.statement?.confidence ?? 'none',
          consent_confidence: body.fields.patient_consent?.confidence ?? 'none',
          consent_variant_guess:
            body.fields.patient_consent?.variant_guess ?? null,
          ack_confidence: body.fields.acknowledgments?.confidence ?? 'none',
          source_file_type: body.source_file_type ?? null,
        }
      : { fetch_failed: true, renderer_status: resp.status }
    await (adminClient.from('audit_logs') as any).insert({
      action: 'metadata_extracted_from_docx',
      resource_type: 'manuscript',
      resource_id: manuscriptId,
      details: { manuscript_id: manuscriptId, ...summary },
    })
  } catch {
    // swallow — audit-log failure must not break editor page
  }

  if (!resp.ok || !body.ok || !body.fields) {
    return {
      fields: null,
      error: body.error ?? `Renderer returned ${resp.status}.`,
      source_file_type: null,
    }
  }

  return {
    fields: body.fields,
    error: null,
    source_file_type: body.source_file_type ?? null,
  }
}
