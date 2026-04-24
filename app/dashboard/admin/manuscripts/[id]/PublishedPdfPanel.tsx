import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/server'
import type { ManuscriptRow, RenderReport } from '@/lib/types/database'
import PublishedAssetDownloadButton from './PublishedAssetDownloadButton'

// Phase 4 — Published PDF status panel (Submission Portal
// Architecture Plan §6.9.1). Read-only sibling card next to
// RevisionsPanel on /dashboard/admin/manuscripts/[id].
//
// States:
//   1. Awaiting render       — no published_pdf_storage_path yet
//   2. Published ✅          — pdf present, render-report says pass
//   3. Rendered with warnings — pdf present, non-empty warnings
//
// Visibility:
//   - Always rendered by the parent page. Gates itself to a
//     minimal footer in pre-publication states so the card is
//     discoverable from every manuscript's detail view without
//     cluttering early-lifecycle manuscripts.
//   - Download buttons + report viewer link only appear when a
//     PDF is attached.
//
// Auth:
//   The server actions used by the download button
//   (getPublishedAssetSignedUrl) are requireAdminOnly, so a
//   non-admin accidentally invoking them gets a 'forbidden' response
//   surfaced by the client button. The panel itself is rendered
//   on an editor/admin-gated page so editor hits are rare; but
//   defense-in-depth lives in the action, not the UI.

interface Props {
  manuscriptId: string
}

export default async function PublishedPdfPanel({ manuscriptId }: Props) {
  const admin = createAdminClient()

  const { data: mData } = await admin
    .from('manuscripts')
    .select(
      'id, submission_id, status, published_pdf_storage_path, render_report_storage_path, published_date, elocation_id, doi'
    )
    .eq('id', manuscriptId)
    .maybeSingle()

  const manuscript = mData as
    | (Pick<
        ManuscriptRow,
        | 'id'
        | 'submission_id'
        | 'status'
        | 'published_pdf_storage_path'
        | 'render_report_storage_path'
        | 'published_date'
        | 'elocation_id'
        | 'doi'
      >)
    | null

  if (!manuscript) return null

  const hasPdf = Boolean(manuscript.published_pdf_storage_path)
  const hasReport = Boolean(manuscript.render_report_storage_path)

  // Peek into render-report.json (if any) just to classify pass / warnings /
  // fail. Panel stays fast because the full report JSON is loaded lazily
  // by the /render-report viewer route.
  let verdict: 'pass' | 'warn' | 'fail' | 'unknown' = 'unknown'
  if (hasReport && manuscript.render_report_storage_path) {
    try {
      const { data: blob } = await admin.storage
        .from('submissions')
        .download(manuscript.render_report_storage_path)
      if (blob) {
        const text = await blob.text()
        const parsed = JSON.parse(text) as Partial<RenderReport>
        const warnings = parsed?.verapdf?.warnings ?? []
        const failures = parsed?.verapdf?.failures ?? []
        const result = parsed?.verapdf?.result
        if (result === 'fail' || failures.length > 0) verdict = 'fail'
        else if (warnings.length > 0 || result === 'warn') verdict = 'warn'
        else if (result === 'pass') verdict = 'pass'
      }
    } catch {
      // Keep verdict = 'unknown' — the viewer route surfaces parse errors.
    }
  }

  const headlineClass = 'font-serif text-lg text-brown-dark'
  const cardClass =
    'bg-white border border-border rounded-xl p-6 space-y-3'

  // Pre-publication state: render a minimal "awaiting render" footer.
  if (!hasPdf) {
    return (
      <section className={cardClass}>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h2 className={headlineClass}>Published PDF</h2>
          <span className="text-[11px] uppercase tracking-widest text-brown bg-cream-alt px-2.5 py-1 rounded-full border border-border">
            Awaiting render
          </span>
        </div>
        <p className="text-sm text-ink leading-relaxed">
          No published PDF is attached to this manuscript yet. Once Kanwar
          renders the accepted .docx through the local OSCRSJ Renderer app,
          the compliant PDF and its{' '}
          <code className="text-xs bg-cream-alt px-1 py-0.5 rounded">
            render-report.json
          </code>{' '}
          receipt will appear here.
        </p>
      </section>
    )
  }

  const verdictPill =
    verdict === 'pass'
      ? {
          label: '✅ verapdf: pass',
          className:
            'bg-emerald-100 text-emerald-800 border-emerald-200',
        }
      : verdict === 'warn'
        ? {
            label: '⚠️ rendered with warnings',
            className: 'bg-amber-100 text-amber-800 border-amber-200',
          }
          : verdict === 'fail'
            ? {
                label: '❌ verapdf: fail',
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
        <h2 className={headlineClass}>Published PDF</h2>
        <span
          className={`text-[11px] uppercase tracking-widest font-semibold px-2.5 py-1 rounded-full border ${verdictPill.className}`}
        >
          {verdictPill.label}
        </span>
      </div>

      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-[11px] uppercase tracking-widest text-brown">
            Published
          </dt>
          <dd className="text-ink">
            {manuscript.published_date
              ? new Date(manuscript.published_date).toLocaleString()
              : '—'}
          </dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-widest text-brown">
            eLocation ID
          </dt>
          <dd className="text-ink">{manuscript.elocation_id || '—'}</dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-widest text-brown">
            DOI
          </dt>
          <dd className="text-ink">
            {manuscript.doi ? (
              <code className="text-xs">{manuscript.doi}</code>
            ) : (
              '— (pending Crossref)'
            )}
          </dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-widest text-brown">
            Status
          </dt>
          <dd className="text-ink">{manuscript.status.replace(/_/g, ' ')}</dd>
        </div>
      </dl>

      <div className="flex flex-wrap gap-4 items-center pt-2 border-t border-border">
        <PublishedAssetDownloadButton
          manuscriptId={manuscript.id}
          which="pdf"
          label="Download published PDF"
        />
        {hasReport && (
          <>
            <PublishedAssetDownloadButton
              manuscriptId={manuscript.id}
              which="report"
              label="Download render-report.json"
            />
            <Link
              href={`/dashboard/admin/manuscripts/${manuscript.id}/render-report`}
              className="text-xs text-brown hover:text-ink underline underline-offset-2"
            >
              View render report →
            </Link>
          </>
        )}
      </div>
    </section>
  )
}
