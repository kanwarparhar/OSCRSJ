import { createAdminClient } from '@/lib/supabase/server'
import {
  synthesizeRendererPayload,
  validateMetadataForRender,
} from '@/lib/publish/synthesize'
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

  const [authorsRes, metadataRes, synthResult, launch, affCountRes] =
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
    ])

  const authors = (authorsRes.data as ManuscriptAuthorRow[] | null) ?? []
  const metadata = (metadataRes.data as ManuscriptMetadataRow | null) ?? null
  const affCount = affCountRes.count ?? 0

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
          elocation_id: manuscript.elocation_id || 'e0001',
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
        }}
        rendererUrl={launch.url || ''}
      />
    </section>
  )
}
