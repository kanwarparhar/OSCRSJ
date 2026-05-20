import { createAdminClient } from '@/lib/supabase/server'
import type { ManuscriptRow } from '@/lib/types/database'
import BodyEditor from './BodyEditor'

// BodyEditorPanel — Phase 2 HTML body editor server shell (Sushant
// Session 64, 2026-05-19).
//
// Mounts in the admin manuscript page below MetadataEditorPanel and
// above PublishPipelinePanel. Status-gated to status ∈ {accepted,
// published}. Reads `manuscripts.manuscript_body_cleaned_html` and
// hands it to the BodyEditor client island.
//
// Coexistence with the renderer-side cleanup pane at
// `/render/[id]` is intentional (per Kanwar's 2026-05-19 AskUserQuestion
// answer): the cleanup pane stays functional, but the OSCRSJ admin
// editor is the new canonical place to curate body HTML. When this
// column is non-null, preview + publish endpoints pass it as
// `cleanedHtml` and the renderer skips its Session 62 extractBody
// auto-extract path.

interface Props {
  manuscriptId: string
}

export default async function BodyEditorPanel({ manuscriptId }: Props) {
  const admin = createAdminClient()

  const { data: mData } = await admin
    .from('manuscripts')
    .select('id, status, manuscript_body_cleaned_html')
    .eq('id', manuscriptId)
    .maybeSingle()
  const manuscript = mData as
    | (Pick<ManuscriptRow, 'id' | 'status' | 'manuscript_body_cleaned_html'>)
    | null

  if (!manuscript) return null
  if (manuscript.status !== 'accepted' && manuscript.status !== 'published') {
    return null
  }

  const initialHtml = manuscript.manuscript_body_cleaned_html || ''
  const isPublished = manuscript.status === 'published'

  return (
    <section className="bg-white border border-border rounded-xl p-6 space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="font-serif text-lg text-brown-dark">
            Body HTML editor
          </h2>
          <p className="text-xs text-brown mt-1 max-w-2xl leading-relaxed">
            Editor-curated body HTML for the render pipeline. When saved,
            preview &amp; publish pass this verbatim as <code className="text-xs bg-cream-alt px-1 py-0.5 rounded">cleanedHtml</code> and
            the renderer skips its auto-extraction from the accepted{' '}
            <code className="text-xs bg-cream-alt px-1 py-0.5 rounded">.docx</code>.
            Leave empty to keep auto-extraction (the Session 62 default).
          </p>
        </div>
        <span className="text-[11px] uppercase tracking-widest text-brown bg-cream-alt px-2.5 py-1 rounded-full border border-border whitespace-nowrap">
          Phase 2 · MVP
        </span>
      </div>

      {initialHtml === '' && (
        <div className="text-xs text-brown bg-cream-alt border border-border rounded-md px-3 py-2 leading-relaxed">
          <strong className="text-brown-dark">Auto-extraction is active.</strong>{' '}
          No saved HTML override. Preview &amp; publish will run the
          Session 62 extractBody pathway (Pandoc → structured body +
          figures from .docx zip + tier-3 Storage fetch). Start typing or
          paste body HTML to override the auto-extract output.
        </div>
      )}

      <BodyEditor
        manuscriptId={manuscript.id}
        initialHtml={initialHtml}
        isPublished={isPublished}
      />

      <details className="text-xs text-brown">
        <summary className="cursor-pointer hover:text-ink select-none">
          Coexistence notes
        </summary>
        <div className="mt-2 space-y-1 pl-3 leading-relaxed">
          <p>
            • This editor and the renderer-side cleanup pane at{' '}
            <code className="text-[11px] bg-cream-alt px-1 rounded">/render/[id]</code>{' '}
            both persist into the same payload field (<code className="text-[11px] bg-cream-alt px-1 rounded">cleanedHtml</code>).
          </p>
          <p>
            • Saving here writes to{' '}
            <code className="text-[11px] bg-cream-alt px-1 rounded">manuscripts.manuscript_body_cleaned_html</code>{' '}
            (migration 024). When the column is non-null, the preview +
            publish endpoints pass it verbatim.
          </p>
          <p>
            • Clearing the saved HTML reverts to the renderer&apos;s
            auto-extract path; the cleanup pane workflow is unchanged.
          </p>
          <p>
            • Phase 2 MVP defers drag-to-position figures and table cell
            editing. Use the toolbar to format text + insert images by
            URL for now.
          </p>
        </div>
      </details>
    </section>
  )
}
