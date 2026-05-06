import { createAdminClient } from '@/lib/supabase/server'
import type { ManuscriptRow, RenderReport } from '@/lib/types/database'
import PublishedAssetDownloadButton from './PublishedAssetDownloadButton'

// Sushant Session 19 (2026-05-06) — Published JATS XML status panel.
// Sibling of PublishedPdfPanel.tsx. Mounts on
// /dashboard/admin/manuscripts/[id] beneath the published PDF panel
// when migration 020's jats_xml_storage_path is populated.
//
// States:
//   1. Awaiting render        — no jats_xml_storage_path yet
//   2. Published ✅           — JATS present, validation passed cleanly
//   3. Rendered with warnings — JATS present, validator returned non-empty warnings
//   4. Validation failed      — JATS present but validator gate would have failed
//                              (this state is unreachable if the publish chain
//                              short-circuited correctly; surfaced as a defensive
//                              read of render-report.json)
//   5. Report unavailable     — Storage path set but render-report missing
//
// The panel reads jats_xml_storage_path off the manuscripts row,
// then peeks the render-report.json's `jatsXml` block (Session 19
// extension) to classify the verdict pill. Auth is identical to the
// PDF panel — gates self by depending on the page's
// editor/admin-only layout, with hard requireAdminOnly() on the
// download action server-side.

interface Props {
  manuscriptId: string
}

export default async function PublishedJatsPanel({ manuscriptId }: Props) {
  const admin = createAdminClient()

  const { data: mData } = await admin
    .from('manuscripts')
    .select(
      'id, submission_id, status, jats_xml_storage_path, render_report_storage_path, published_date'
    )
    .eq('id', manuscriptId)
    .maybeSingle()

  const manuscript = mData as
    | (Pick<
        ManuscriptRow,
        | 'id'
        | 'submission_id'
        | 'status'
        | 'jats_xml_storage_path'
        | 'render_report_storage_path'
        | 'published_date'
      >)
    | null

  if (!manuscript) return null

  const hasJats = Boolean(manuscript.jats_xml_storage_path)
  const hasReport = Boolean(manuscript.render_report_storage_path)

  // Peek the render-report.json's jatsXml block to classify the
  // verdict pill. Same fast-path pattern as the PDF panel — the full
  // report stays lazily loaded by the /render-report viewer route.
  let verdict: 'pass' | 'warn' | 'fail' | 'unknown' = 'unknown'
  let schemaVersion = ''
  let sizeBytes: number | null = null
  let warningCount = 0
  let errorCount = 0
  if (hasJats && hasReport && manuscript.render_report_storage_path) {
    try {
      const { data: blob } = await admin.storage
        .from('submissions')
        .download(manuscript.render_report_storage_path)
      if (blob) {
        const text = await blob.text()
        const parsed = JSON.parse(text) as Partial<RenderReport>
        const j = parsed?.jatsXml
        if (j) {
          schemaVersion = j.schemaVersion || ''
          sizeBytes = typeof j.sizeBytes === 'number' ? j.sizeBytes : null
          warningCount = (j.validationWarnings ?? []).length
          errorCount = (j.validationErrors ?? []).length
          if (!j.passed || errorCount > 0) verdict = 'fail'
          else if (warningCount > 0) verdict = 'warn'
          else verdict = 'pass'
        }
      }
    } catch {
      // verdict stays 'unknown' — the /render-report viewer surfaces parse errors.
    }
  }

  const headlineClass = 'font-serif text-lg text-brown-dark'
  const cardClass =
    'bg-white border border-border rounded-xl p-6 space-y-3'

  // Pre-publication state.
  if (!hasJats) {
    return (
      <section className={cardClass}>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h2 className={headlineClass}>Published JATS XML</h2>
          <span className="text-[11px] uppercase tracking-widest text-brown bg-cream-alt px-2.5 py-1 rounded-full border border-border">
            Awaiting render
          </span>
        </div>
        <p className="text-sm text-ink leading-relaxed">
          No JATS XML artifact is attached to this manuscript yet. The OSCRSJ
          Renderer publish chain emits JATS Publishing 1.3 XML alongside the
          PDF/A-1b artifact whenever a manuscript reaches{' '}
          <code className="text-xs bg-cream-alt px-1 py-0.5 rounded">
            status = published
          </code>
          . The JATS file is what feeds Crossref, DOAJ, and (eventually) the
          PMC application.
        </p>
      </section>
    )
  }

  const verdictPill =
    verdict === 'pass'
      ? {
          label: '✅ JATS: valid',
          className: 'bg-emerald-100 text-emerald-800 border-emerald-200',
        }
      : verdict === 'warn'
        ? {
            label: `⚠️ ${warningCount} warning${warningCount === 1 ? '' : 's'}`,
            className: 'bg-amber-100 text-amber-800 border-amber-200',
          }
          : verdict === 'fail'
            ? {
                label: `❌ JATS: invalid (${errorCount})`,
                className: 'bg-red-100 text-red-700 border-red-200',
              }
            : {
                label: 'render report unavailable',
                className:
                  'bg-neutral-100 text-neutral-700 border-neutral-200',
              }

  return (
    <section className={cardClass}>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className={headlineClass}>Published JATS XML</h2>
        <span
          className={`text-[11px] uppercase tracking-widest font-semibold px-2.5 py-1 rounded-full border ${verdictPill.className}`}
        >
          {verdictPill.label}
        </span>
      </div>

      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-[11px] uppercase tracking-widest text-brown">
            Schema
          </dt>
          <dd className="text-ink">
            {schemaVersion || 'JATS Journal Publishing 1.3'}
          </dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-widest text-brown">
            File size
          </dt>
          <dd className="text-ink">
            {sizeBytes !== null
              ? `${(sizeBytes / 1024).toFixed(1)} KB`
              : '—'}
          </dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-widest text-brown">
            Storage path
          </dt>
          <dd className="text-ink">
            <code className="text-xs">
              {manuscript.jats_xml_storage_path}
            </code>
          </dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-widest text-brown">
            DTD validation
          </dt>
          <dd className="text-ink">
            {verdict === 'pass'
              ? 'xmllint passed'
              : verdict === 'warn'
                ? `${warningCount} warning${warningCount === 1 ? '' : 's'}`
                : verdict === 'fail'
                  ? `${errorCount} error${errorCount === 1 ? '' : 's'}`
                  : '—'}
          </dd>
        </div>
      </dl>

      <div className="flex flex-wrap gap-4 items-center pt-2 border-t border-border">
        <PublishedAssetDownloadButton
          manuscriptId={manuscript.id}
          which="jats"
          label="Download JATS XML"
        />
      </div>
    </section>
  )
}
