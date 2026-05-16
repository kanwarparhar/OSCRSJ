import { createAdminClient } from '@/lib/supabase/server'
import { synthesizeRendererPayload } from '@/lib/publish/synthesize'
import type {
  ManuscriptRow,
  ManuscriptAuthorRow,
  ManuscriptMetadataRow,
  PatientConsentVariant,
} from '@/lib/types/database'

// Pre-Render Metadata Editor — server-component shell (Phase 1.A, Sushant
// Session 57, 2026-05-15). Companion to [[Pre-Render Metadata Editor &
// PDF Preview]] + Janine's compliance spec [[Pre-Render Editor Compliance
// Spec]] + Franklin's UX pass [[Article PDF Design System]] §"Pre-Render
// Metadata Editor — UX Design Pass".
//
// Phase 1.A scope (this commit):
//   - Renders all 6 sections in read-only display form.
//   - Runs the synthesizer dry-run server-side and surfaces the current
//     errors/warnings in §5 Validation Summary so editors see the
//     blocker list immediately.
//   - Mounts below RevisionsPanel + above PublishPipelinePanel on
//     `/dashboard/admin/manuscripts/[id]`.
//   - Status-gated: only renders when status ∈ {accepted, published}.
//
// Phase 1.B replaces this with the interactive form
// (MetadataEditorForm.tsx client island + dnd-kit + ORCID resolve +
// CRediT chip-picker + live 500ms-debounced validation + transactional
// save). All field labels + section ordering + display contracts
// preserved across phases.

const CONSENT_LABELS: Record<PatientConsentVariant, string> = {
  adult_living: 'Competent adult patient',
  pediatric_minor: 'Pediatric / minor patient',
  deceased_next_of_kin: 'Deceased — next of kin consent',
  deceased_irb_waiver: 'Deceased — IRB waiver',
  incapacitated_irb_waiver: 'Incapacitated — IRB waiver',
  deidentified_no_consent_required: 'De-identified — consent not required',
  not_applicable: 'Not applicable',
}

const ARTICLE_TYPE_LABELS: Record<string, string> = {
  case_report: 'Case Report',
  case_series: 'Case Series',
  surgical_technique: 'Surgical Technique',
  images_in_orthopedics: 'Images in Orthopedics',
  letter_to_editor: 'Letter to the Editor',
  review_article: 'Systematic Review & Meta-Analysis',
}

const ABSTRACT_LABEL_SETS: Record<string, string[]> = {
  case_report: ['Introduction', 'Case Presentation', 'Discussion', 'Conclusion'],
  case_series: ['Background', 'Methods', 'Results', 'Discussion', 'Conclusion'],
  review_article: ['Background', 'Methods', 'Results', 'Conclusion'],
}

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

  // Status gate: only surface for accepted | published. Pre-acceptance
  // editing of metadata happens in the submission wizard.
  if (manuscript.status !== 'accepted' && manuscript.status !== 'published') {
    return null
  }

  const [authorsRes, metadataRes, synthResult] = await Promise.all([
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
  ])

  const authors = (authorsRes.data as ManuscriptAuthorRow[] | null) ?? []
  const metadata = (metadataRes.data as ManuscriptMetadataRow | null) ?? null

  const articleTypeLabel = manuscript.manuscript_type
    ? ARTICLE_TYPE_LABELS[manuscript.manuscript_type] || manuscript.manuscript_type
    : '—'

  const abstractLabels = manuscript.manuscript_type
    ? ABSTRACT_LABEL_SETS[manuscript.manuscript_type] || null
    : null

  const equalAuthorCount = authors.filter((a) => a.is_equal_contribution).length
  const handlingEditor = synthResult.payload?.handling_editor || null

  return (
    <section className="bg-white border border-border rounded-xl p-6 space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="font-serif text-lg text-brown-dark">
            Pre-render metadata editor
          </h2>
          <p className="text-xs text-brown mt-1 max-w-2xl leading-relaxed">
            Read-only preview of every field the renderer&apos;s payload
            synthesizer consumes. Phase 1.B replaces this with an editable
            form (drag-reorder authors, ORCID auto-resolve, CRediT
            chip-picker, live validation, transactional save).
          </p>
        </div>
        <span className="text-[11px] uppercase tracking-widest text-brown bg-cream-alt px-2.5 py-1 rounded-full border border-border whitespace-nowrap">
          Phase 1.A · read-only
        </span>
      </div>

      {/* §1 Article Identity */}
      <ReadOnlySection label="§1 — Article Identity">
        <ReadOnlyField label="Title" value={manuscript.title} />
        <ReadOnlyField
          label="Running title"
          value={manuscript.running_title}
          hint={
            manuscript.running_title
              ? `${manuscript.running_title.length} / 45 chars · used in @top-center running header`
              : 'Empty — synthesizer falls back to truncated title.'
          }
        />
        <ReadOnlyField label="Article type" value={articleTypeLabel} />
        <ReadOnlyField label="Subspecialty" value={manuscript.subspecialty} />
        <ReadOnlyField
          label="Keywords"
          value={
            manuscript.keywords && manuscript.keywords.length > 0
              ? manuscript.keywords.join(' · ')
              : null
          }
          hint={`${(manuscript.keywords || []).length} of 3–5 required`}
        />
        <ReadOnlyField
          label="DOI"
          value={manuscript.doi || '10.XXXXX/oscrsj.<year>.<elocation> (auto-generated until Crossref membership lands)'}
        />
        <ReadOnlyField
          label="Elocation ID"
          value={manuscript.elocation_id || 'e0001 (auto-generated)'}
        />
      </ReadOnlySection>

      {/* §2 Abstract */}
      <ReadOnlySection label="§2 — Abstract">
        {abstractLabels ? (
          <p className="text-xs text-brown italic mb-2">
            Article-type-aware labels: {abstractLabels.join(' · ')}. Phase 1.B
            adds a &quot;Paste raw abstract → Parse&quot; assist.
          </p>
        ) : (
          <p className="text-xs text-brown italic mb-2">
            Unstructured / no abstract for this article type.
          </p>
        )}
        <div className="rounded-lg border border-border bg-cream-alt/30 p-3 text-sm text-ink whitespace-pre-wrap leading-relaxed max-h-72 overflow-y-auto">
          {manuscript.abstract || '(no abstract)'}
        </div>
      </ReadOnlySection>

      {/* §3 Authors */}
      <ReadOnlySection
        label={`§3 — Authors (${authors.length})`}
        subtitle="Drag-reorder + ORCID auto-resolve + CRediT chip-picker land in Phase 1.B. Equal-contribution flags are read from migration 022."
      >
        {authors.length === 0 ? (
          <p className="text-sm text-brown italic">No authors recorded.</p>
        ) : (
          <ul className="space-y-3 text-sm">
            {authors.map((a, idx) => (
              <li
                key={a.id}
                className="rounded-lg border border-border p-3 bg-white"
              >
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <p className="font-medium text-ink">
                    {idx + 1}. {a.full_name}
                    {a.degrees ? `, ${a.degrees}` : ''}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {a.is_corresponding && (
                      <span className="text-[10px] uppercase tracking-widest bg-peach-dark/30 text-brown-dark px-1.5 py-0.5 rounded">
                        Corresponding
                      </span>
                    )}
                    {a.is_equal_contribution && (
                      <span className="text-[10px] uppercase tracking-widest bg-amber-100 text-amber-900 border border-amber-200 px-1.5 py-0.5 rounded">
                        Equal contribution
                      </span>
                    )}
                  </div>
                </div>
                <p className="text-xs text-brown mt-1">
                  {a.email}
                  {a.orcid_id ? ` · ORCID ${a.orcid_id}` : ' · no ORCID'}
                </p>
                <p className="text-xs text-brown">{a.affiliation || '(no affiliation)'}</p>
                {a.contribution && (
                  <p className="text-xs text-brown mt-1">
                    <span className="text-brown-dark font-medium">CRediT:</span>{' '}
                    {a.contribution}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}

        {equalAuthorCount >= 2 && metadata?.equal_contribution_statement && (
          <div className="mt-4 pt-4 border-t border-border">
            <p className="text-[11px] uppercase tracking-widest text-brown mb-1">
              Equal contribution statement
            </p>
            <p className="text-sm text-ink italic">
              {metadata.equal_contribution_statement}
            </p>
          </div>
        )}

        <div className="mt-4 rounded-lg border border-border bg-cream-alt/40 p-3 text-sm">
          <p className="text-[11px] uppercase tracking-widest text-brown mb-1">
            Handling editor
          </p>
          {handlingEditor ? (
            <p className="text-ink">
              <span className="font-medium">{handlingEditor.display_name}</span>
              {handlingEditor.affiliation ? ` · ${handlingEditor.affiliation}` : ''}
            </p>
          ) : (
            <p className="text-brown italic">
              Not resolved — no editorial_decisions row found for this manuscript.
            </p>
          )}
          <p className="text-xs text-brown italic mt-1">
            Derived from latest non-rescinded editorial_decisions.editor_id →
            users join. Renders as JATS{' '}
            <code className="text-xs bg-white px-1 py-0.5 rounded border border-border">
              &lt;contrib contrib-type=&quot;editor&quot;&gt;
            </code>{' '}
            per Janine §7.2.f. Override available in Phase 1.B.
          </p>
        </div>
      </ReadOnlySection>

      {/* §4 Declarations */}
      <ReadOnlySection
        label="§4 — Declarations"
        subtitle="ICMJE-required disclosures. Edit affordances + conditional reveals + 7-variant patient consent dropdown land in Phase 1.B."
      >
        <ReadOnlyField
          label="Funding"
          value={
            metadata?.funding_sources && metadata.funding_sources.length > 0
              ? metadata.funding_sources.join(' · ')
              : 'No external funding was received for this work.'
          }
        />
        <ReadOnlyField
          label="Conflicts of interest"
          value={metadata?.conflict_of_interest}
        />
        <ReadOnlyField
          label="IRB / Ethics"
          value={metadata?.ethics_approval_number || '(not approved / exempt / not required — branch derived by synthesizer)'}
        />
        <ReadOnlyField
          label="Data availability"
          value={metadata?.data_availability_statement}
        />
        <ReadOnlyField
          label="AI disclosure"
          value={
            metadata?.ai_tools_used === null || metadata?.ai_tools_used === undefined
              ? '⚠️ Not yet specified (ICMJE 2024 requires explicit negative attestation)'
              : metadata.ai_tools_used
                ? `Used: ${metadata.ai_tools_details || '(no detail)'}`
                : 'No AI/LLM tools used.'
          }
        />
        <ReadOnlyField
          label="Patient consent variant"
          value={
            metadata?.patient_consent_variant
              ? CONSENT_LABELS[metadata.patient_consent_variant]
              : null
          }
          hint={metadata?.patient_consent_variant || '⚠️ Not set'}
        />
        <ReadOnlyField
          label="Patient consent statement"
          value={metadata?.patient_consent_statement}
        />
        {(metadata?.patient_consent_variant === 'deceased_irb_waiver' ||
          metadata?.patient_consent_variant === 'incapacitated_irb_waiver') && (
          <>
            <ReadOnlyField
              label="IRB institution"
              value={metadata?.patient_consent_irb_institution}
            />
            <ReadOnlyField
              label="IRB protocol"
              value={metadata?.patient_consent_irb_protocol}
            />
          </>
        )}
        <ReadOnlyField
          label="Acknowledgments"
          value={metadata?.acknowledgments}
        />
      </ReadOnlySection>

      {/* §5 Validation Summary */}
      <ReadOnlySection
        label="§5 — Pre-Render Validation Summary"
        subtitle="Live synthesizer dry-run. Phase 1.B adds 500ms debounce on every keystroke + Jump-to-fix links per row."
      >
        {synthResult.errors.length === 0 && synthResult.warnings.length === 0 ? (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-900">
            <p className="font-medium">✅ All validators clear.</p>
            <p className="text-xs mt-1">
              Synthesizer dry-run returned zero errors and zero warnings. The
              manuscript is ready to preview + render.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {synthResult.errors.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-900">
                <p className="font-medium mb-2">
                  🚨 Errors ({synthResult.errors.length}) — must fix before render
                </p>
                <ul className="space-y-1.5 text-xs">
                  {synthResult.errors.map((e, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-red-700">•</span>
                      <span className="flex-1">{e}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {synthResult.warnings.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-900">
                <p className="font-medium mb-2">
                  ⚠️ Warnings ({synthResult.warnings.length}) — render proceeds
                </p>
                <ul className="space-y-1.5 text-xs">
                  {synthResult.warnings.map((w, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-amber-700">•</span>
                      <span className="flex-1">{w}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </ReadOnlySection>

      {/* §6 Preview pane (Phase 1.C placeholder) */}
      <ReadOnlySection
        label="§6 — Preview Render"
        subtitle="Phase 1.C wires the &quot;Open preview ↗&quot; button (proxies to renderer's /api/preview/[id], returns 24h signed URL, no publish-side effects)."
      >
        <div className="rounded-lg border border-dashed border-border bg-cream-alt/30 p-4 text-center">
          <p className="text-sm text-brown italic">
            Preview render lands in Phase 1.C. For now, use the existing{' '}
            <strong>Render published PDF →</strong> button in the Publish
            pipeline panel below to drive the chain via the renderer.
          </p>
        </div>
      </ReadOnlySection>
    </section>
  )
}

// ============================================================
// Helper components — kept colocated to avoid file proliferation
// in Phase 1.A. Phase 1.B's MetadataEditorForm.tsx will own its
// own form-input variants in a separate client island.
// ============================================================

function ReadOnlySection({
  label,
  subtitle,
  children,
}: {
  label: string
  subtitle?: string
  children: React.ReactNode
}) {
  return (
    <div className="border-t border-border pt-4">
      <p className="text-[11px] uppercase tracking-widest text-brown mb-1 font-medium">
        {label}
      </p>
      {subtitle && (
        <p className="text-xs text-brown italic mb-3 max-w-2xl">{subtitle}</p>
      )}
      <div className="space-y-3">{children}</div>
    </div>
  )
}

function ReadOnlyField({
  label,
  value,
  hint,
}: {
  label: string
  value: string | null | undefined
  hint?: string
}) {
  const display = value && String(value).trim().length > 0 ? value : '—'
  const missing = display === '—'
  return (
    <div className="grid grid-cols-1 sm:grid-cols-[180px_1fr] gap-2 sm:gap-4 items-start">
      <p className="text-xs text-brown sm:text-right sm:mt-0.5">{label}</p>
      <div className="min-w-0">
        <p
          className={`text-sm ${missing ? 'text-brown italic' : 'text-ink'} whitespace-pre-wrap`}
        >
          {display}
        </p>
        {hint && <p className="text-xs text-brown italic mt-0.5">{hint}</p>}
      </div>
    </div>
  )
}
