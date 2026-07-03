import { createAdminClient } from '@/lib/supabase/server'
import type { ManuscriptRow } from '@/lib/types/database'
import PublishPipelineActions from './PublishPipelineActions'

// Phase 4 — Publish pipeline action panel (Session 53, 2026-05-15;
// slimmed Session 85). Tracks Manvir handoff
// ^handoff-renderer-payload-synthesizer-2026-05-15.
//
// Two lifecycle states, each surfacing a different action:
//
//   accepted, artifacts present       → "Publish (go live)" (flip
//                                       status to 'published').
//
//   published                         → "Unpublish (emergency)" with
//                                       extra-friction confirm.
//
// accepted-without-artifacts renders NOTHING (Session 85): the render
// entry point lives solely in the metadata editor's §5 Validation
// Summary, which gates rendering on saved state + zero errors +
// acknowledged warnings. This panel appears once the renderer has
// written artifacts back.

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

  // Session 85 — the render entry point now lives solely in the metadata
  // editor's §5 Validation Summary (which gates rendering on saved state +
  // zero errors + acknowledged warnings). Before artifacts exist this panel
  // had nothing but a duplicate "Render published PDF" button, so it stays
  // hidden until the renderer has written artifacts back.
  if (manuscript.status === 'accepted' && !hasArtifacts) return null

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

      {manuscript.status === 'accepted' && hasArtifacts && (
        <p className="text-sm text-ink leading-relaxed">
          Rendered artifacts are present on this manuscript but the article
          is not yet public. Review the PDF in the panel below; once
          author proof is signed off, click <strong>Publish (go live)</strong>
          to flip the article visible on{' '}
          <code className="text-xs bg-cream-alt px-1 py-0.5 rounded">/articles</code>.
          Need a typo fix first? Re-render from the metadata editor&apos;s
          Validation &amp; Preview section above — the new artifacts overwrite
          these before go-live.
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
        submissionId={manuscript.submission_id}
      />
    </section>
  )
}
