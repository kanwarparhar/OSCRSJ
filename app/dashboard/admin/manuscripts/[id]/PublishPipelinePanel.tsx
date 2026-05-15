import { createAdminClient } from '@/lib/supabase/server'
import type { ManuscriptRow } from '@/lib/types/database'
import { getRendererLaunchUrl } from '@/lib/admin/actions'
import PublishPipelineActions from './PublishPipelineActions'

// Phase 4 — Publish pipeline action panel (Session 53, 2026-05-15).
// Tracks Manvir handoff ^handoff-renderer-payload-synthesizer-2026-05-15.
//
// Three lifecycle states, each surfacing a different action:
//
//   accepted, no artifacts            → "Render published PDF"  → opens
//                                       the local renderer's /render/[id]
//                                       page in a new tab. Editor cleans
//                                       HTML there and clicks Publish; the
//                                       renderer writes storage paths
//                                       back to this manuscript but does
//                                       NOT flip status.
//
//   accepted, artifacts present       → "Re-render" (rebuild artifacts)
//                                       + "Publish (go live)" (flip
//                                       status to 'published').
//
//   published                         → "Unpublish (emergency)" with
//                                       extra-friction confirm.
//
// The panel only renders when status is in the publish-pipeline range.

interface Props {
  manuscriptId: string
}

export default async function PublishPipelinePanel({ manuscriptId }: Props) {
  const admin = createAdminClient()

  const { data: mData } = await admin
    .from('manuscripts')
    .select(
      'id, status, published_pdf_storage_path, jats_xml_storage_path, render_report_storage_path, published_date, submission_id, title'
    )
    .eq('id', manuscriptId)
    .maybeSingle()

  const manuscript = mData as
    | Pick<
        ManuscriptRow,
        | 'id'
        | 'status'
        | 'published_pdf_storage_path'
        | 'jats_xml_storage_path'
        | 'render_report_storage_path'
        | 'published_date'
        | 'submission_id'
        | 'title'
      >
    | null

  if (!manuscript) return null

  const inPipeline =
    manuscript.status === 'accepted' || manuscript.status === 'published'
  if (!inPipeline) return null

  const hasArtifacts = Boolean(manuscript.published_pdf_storage_path)

  const launch = await getRendererLaunchUrl(manuscriptId)
  const rendererUrl = launch.url || ''

  const cardClass =
    'bg-white border border-border rounded-xl p-6 space-y-4'

  return (
    <section className={cardClass}>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="font-serif text-lg text-brown-dark">Publish pipeline</h2>
        <span className="text-[11px] uppercase tracking-widest text-brown bg-cream-alt px-2.5 py-1 rounded-full border border-border">
          {manuscript.status.replace(/_/g, ' ')}
        </span>
      </div>

      {manuscript.status === 'accepted' && !hasArtifacts && (
        <p className="text-sm text-ink leading-relaxed">
          The manuscript is accepted but no published artifacts have been
          rendered yet. Click <strong>Render published PDF</strong> below to
          open the local OSCRSJ Renderer in a new tab. Clean up the
          Pandoc-converted HTML in the renderer&apos;s cleanup pane, then click
          <em> Publish manuscript… </em> inside the renderer to write the
          PDF + render-report.json + JATS XML into Supabase Storage. Status
          will stay at <code className="text-xs bg-cream-alt px-1 py-0.5 rounded">accepted</code>
          until you return here and click <strong>Publish (go live)</strong>.
        </p>
      )}

      {manuscript.status === 'accepted' && hasArtifacts && (
        <p className="text-sm text-ink leading-relaxed">
          Rendered artifacts are present on this manuscript but the article
          is not yet public. Review the PDF in the panel below; once
          author proof is signed off, click <strong>Publish (go live)</strong>
          to flip the article visible on{' '}
          <code className="text-xs bg-cream-alt px-1 py-0.5 rounded">/articles</code>.
          You can re-render to overwrite the artifacts if a typo fix is
          needed before go-live.
        </p>
      )}

      {manuscript.status === 'published' && (
        <p className="text-sm text-ink leading-relaxed">
          This article is live at{' '}
          <code className="text-xs bg-cream-alt px-1 py-0.5 rounded">/articles</code>.
          Emergency retraction is available below — use only when a
          retraction notice is being prepared. The storage artifacts
          remain intact; only public visibility is flipped.
        </p>
      )}

      <PublishPipelineActions
        manuscriptId={manuscriptId}
        status={manuscript.status}
        hasArtifacts={hasArtifacts}
        rendererUrl={rendererUrl}
        submissionId={manuscript.submission_id}
      />
    </section>
  )
}
