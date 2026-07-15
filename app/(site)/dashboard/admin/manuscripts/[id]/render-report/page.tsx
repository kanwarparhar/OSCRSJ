import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/server'
import { fetchRenderReport } from '@/lib/admin/actions'
import type { ManuscriptRow, RenderReport } from '@/lib/types/database'

// Phase 4 — render-report viewer (Submission Portal Architecture
// Plan §6.9.2). Admin-only page (enforced in fetchRenderReport via
// requireAdminOnly; editors hit the layout's editor/admin gate and
// then bounce off the action with a "forbidden" surface). Used by
// Janine when compiling the PMC / ISSN / Crossref / DOAJ evidence
// packets — each section is inline and collapsible so she can pull
// the verapdf XML / XMP packet / font-embed table in isolation.

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Render Report',
  robots: { index: false, follow: false },
}

interface PageProps {
  params: { id: string }
}

export default async function RenderReportPage({ params }: PageProps) {
  const admin = createAdminClient()

  const { data: mData } = await admin
    .from('manuscripts')
    .select('id, submission_id, title, status, render_report_storage_path')
    .eq('id', params.id)
    .maybeSingle()

  const manuscript = mData as
    | Pick<
        ManuscriptRow,
        'id' | 'submission_id' | 'title' | 'status' | 'render_report_storage_path'
      >
    | null

  if (!manuscript) notFound()

  const result = await fetchRenderReport(params.id)

  const backHref = `/dashboard/admin/manuscripts/${params.id}`

  if (result.forbidden) {
    return (
      <div className="space-y-4 max-w-2xl">
        <Link
          href={backHref}
          className="text-xs text-brown hover:text-ink underline underline-offset-2"
        >
          ← Back to manuscript
        </Link>
        <div className="bg-white border border-red-200 rounded-xl p-6">
          <h1 className="font-serif text-2xl text-brown-dark mb-2">
            Admin-only page
          </h1>
          <p className="text-sm text-ink leading-relaxed">
            The render-report viewer is restricted to admin accounts. Editors
            can see the pass/fail summary in the Published PDF panel on the
            manuscript detail view.
          </p>
        </div>
      </div>
    )
  }

  if (result.notFound || !result.report) {
    return (
      <div className="space-y-4 max-w-2xl">
        <Link
          href={backHref}
          className="text-xs text-brown hover:text-ink underline underline-offset-2"
        >
          ← Back to manuscript
        </Link>
        <div className="bg-white border border-border rounded-xl p-6">
          <p className="font-mono text-xs text-brown mb-1">
            {manuscript.submission_id}
          </p>
          <h1 className="font-serif text-2xl text-brown-dark mb-2">
            Render report unavailable
          </h1>
          <p className="text-sm text-ink leading-relaxed">
            {result.error ||
              'No render report is attached to this manuscript yet.'}
          </p>
        </div>
      </div>
    )
  }

  if (result.error) {
    return (
      <div className="space-y-4 max-w-2xl">
        <Link
          href={backHref}
          className="text-xs text-brown hover:text-ink underline underline-offset-2"
        >
          ← Back to manuscript
        </Link>
        <div className="bg-white border border-amber-200 rounded-xl p-6">
          <h1 className="font-serif text-2xl text-brown-dark mb-2">
            Could not read render report
          </h1>
          <p className="text-sm text-ink">{result.error}</p>
        </div>
      </div>
    )
  }

  // Treat the result loosely — callers might land on legacy shapes
  // or schemaVersion upgrades. Cast to RenderReport but access
  // every field defensively below.
  const report = result.report as Partial<RenderReport>

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={backHref}
          className="text-xs text-brown hover:text-ink underline underline-offset-2"
        >
          ← Back to manuscript
        </Link>
      </div>

      <div className="bg-white border border-border rounded-xl p-6 space-y-3">
        <p className="font-mono text-xs text-brown">{manuscript.submission_id}</p>
        <h1 className="font-serif text-2xl text-brown-dark leading-snug">
          {manuscript.title || '(untitled manuscript)'}
        </h1>
        <p className="text-sm text-ink">
          Render report{' '}
          {report.renderedAt && (
            <>· rendered {new Date(report.renderedAt).toLocaleString()}</>
          )}
          {report.schemaVersion && <> · schema v{report.schemaVersion}</>}
          {report.pipelineVersion && (
            <> · pipeline v{report.pipelineVersion}</>
          )}
        </p>
      </div>

      <ReportSection title="verapdf">
        {report.verapdf ? (
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <KV label="Conformance">{report.verapdf.conformance || '—'}</KV>
            <KV label="Result">
              <ResultPill value={report.verapdf.result} />
            </KV>
            <KV label="Warnings">
              {report.verapdf.warnings && report.verapdf.warnings.length > 0
                ? `${report.verapdf.warnings.length}`
                : 'None'}
            </KV>
            <KV label="Failures">
              {report.verapdf.failures && report.verapdf.failures.length > 0
                ? `${report.verapdf.failures.length}`
                : 'None'}
            </KV>
            {report.verapdf.warnings && report.verapdf.warnings.length > 0 && (
              <div className="sm:col-span-2">
                <p className="text-[11px] uppercase tracking-widest text-brown mb-1">
                  Warning detail
                </p>
                <ul className="text-sm text-ink list-disc list-inside space-y-1">
                  {report.verapdf.warnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </div>
            )}
            {report.verapdf.failures && report.verapdf.failures.length > 0 && (
              <div className="sm:col-span-2">
                <p className="text-[11px] uppercase tracking-widest text-red-800 mb-1">
                  Failure detail
                </p>
                <ul className="text-sm text-red-800 list-disc list-inside space-y-1">
                  {report.verapdf.failures.map((f, i) => (
                    <li key={i}>{f}</li>
                  ))}
                </ul>
              </div>
            )}
            {report.verapdf.rawOutput && (
              <CollapsibleRaw
                label="Full verapdf output"
                content={report.verapdf.rawOutput}
              />
            )}
          </dl>
        ) : (
          <p className="text-sm text-ink">No verapdf section recorded.</p>
        )}
      </ReportSection>

      <ReportSection title="Fonts">
        {report.fontEmbedCheck ? (
          <div className="space-y-3 text-sm">
            <KV label="All fonts embedded">
              {report.fontEmbedCheck.allFontsEmbedded ? 'Yes' : 'No'}
            </KV>
            {report.fontEmbedCheck.fonts &&
              report.fontEmbedCheck.fonts.length > 0 && (
                <div>
                  <p className="text-[11px] uppercase tracking-widest text-brown mb-1">
                    Font table
                  </p>
                  <ul className="text-sm text-ink space-y-1">
                    {report.fontEmbedCheck.fonts.map((f, i) => (
                      <li key={i} className="border-b border-border pb-1">
                        <span className="font-medium">{f.family}</span>
                        {typeof f.subset !== 'undefined' &&
                          ` · subset: ${f.subset ? 'yes' : 'no'}`}
                        {typeof f.embedded !== 'undefined' &&
                          ` · embedded: ${f.embedded ? 'yes' : 'no'}`}
                        {f.rasterized && ' · rasterized'}
                        {f.note && (
                          <span className="text-brown"> · {f.note}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
          </div>
        ) : (
          <p className="text-sm text-ink">No font-embed section recorded.</p>
        )}
      </ReportSection>

      <ReportSection title="Sanity tests">
        {report.sanityTests ? (
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
            {Object.entries(report.sanityTests).map(([key, value]) => (
              <KV key={key} label={humanizeKey(key)}>
                {renderSanityValue(value)}
              </KV>
            ))}
          </dl>
        ) : (
          <p className="text-sm text-ink">No sanity-test section recorded.</p>
        )}
      </ReportSection>

      <ReportSection title="Tool versions">
        {report.toolVersions ? (
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
            {Object.entries(report.toolVersions).map(([k, v]) => (
              <KV key={k} label={k}>
                {String(v)}
              </KV>
            ))}
          </dl>
        ) : (
          <p className="text-sm text-ink">No tool-version data recorded.</p>
        )}
      </ReportSection>

      <ReportSection title="Input + output">
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
          {report.input && (
            <>
              <KV label="Source .docx SHA-256">
                <code className="text-xs break-all">
                  {report.input.sourceDocxSha256}
                </code>
              </KV>
              <KV label="Source .docx size">
                {formatBytes(report.input.sourceDocxBytes)}
              </KV>
              <KV label="References extracted">
                {report.input.splitReferencesCount}
              </KV>
            </>
          )}
          {report.output && (
            <>
              <KV label="PDF SHA-256">
                <code className="text-xs break-all">
                  {report.output.pdfSha256}
                </code>
              </KV>
              <KV label="PDF size">{formatBytes(report.output.pdfBytes)}</KV>
              <KV label="PDF storage path">
                <code className="text-xs break-all">
                  {report.output.pdfStoragePath}
                </code>
              </KV>
            </>
          )}
          {typeof report.wallclockSeconds === 'number' && (
            <KV label="Wallclock">{report.wallclockSeconds}s</KV>
          )}
        </dl>
      </ReportSection>

      <ReportSection title="Cleanup pass diff">
        {report.cleanupPass ? (
          <div className="space-y-3 text-sm">
            <dl className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <KV label="Duration">{report.cleanupPass.durationSeconds}s</KV>
              {report.cleanupPass.diffSummary && (
                <>
                  <KV label="Lines added">
                    +{report.cleanupPass.diffSummary.linesAdded}
                  </KV>
                  <KV label="Lines removed">
                    −{report.cleanupPass.diffSummary.linesRemoved}
                  </KV>
                  <KV label="Characters changed">
                    {report.cleanupPass.diffSummary.charactersChanged}
                  </KV>
                </>
              )}
            </dl>
            {report.cleanupPass.diffPatch && (
              <CollapsibleRaw
                label="Full diff patch"
                content={report.cleanupPass.diffPatch}
              />
            )}
          </div>
        ) : (
          <p className="text-sm text-ink">No cleanup-pass section recorded.</p>
        )}
      </ReportSection>

      {report.xmpPacket && (
        <ReportSection title="XMP packet">
          <CollapsibleRaw label="XMP XML" content={report.xmpPacket} />
        </ReportSection>
      )}
    </div>
  )
}

// ----------------------------------------------------------------
// Small presentational helpers — server-component-safe (no hooks).
// ----------------------------------------------------------------

function ReportSection({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="bg-white border border-border rounded-xl p-6 space-y-3">
      <h2 className="font-serif text-lg text-brown-dark">{title}</h2>
      {children}
    </section>
  )
}

function KV({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-widest text-brown">
        {label}
      </dt>
      <dd className="text-ink">{children}</dd>
    </div>
  )
}

function ResultPill({ value }: { value?: string }) {
  if (!value) return <>—</>
  const map: Record<string, string> = {
    pass: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    fail: 'bg-red-100 text-red-700 border-red-200',
    warn: 'bg-amber-100 text-amber-800 border-amber-200',
  }
  const cls = map[value] || 'bg-neutral-100 text-neutral-700 border-neutral-200'
  return (
    <span
      className={`text-[11px] uppercase tracking-widest font-semibold px-2 py-0.5 rounded-full border ${cls}`}
    >
      {value}
    </span>
  )
}

// Collapsible raw block via native <details>. No client state needed.
function CollapsibleRaw({
  label,
  content,
}: {
  label: string
  content: string
}) {
  return (
    <details className="sm:col-span-2 border border-border rounded-lg p-3 bg-cream-alt/40">
      <summary className="text-xs text-brown cursor-pointer select-none">
        {label} (click to expand)
      </summary>
      <pre className="text-[11px] text-ink mt-2 whitespace-pre-wrap break-all font-mono leading-snug max-h-[360px] overflow-auto">
        {content}
      </pre>
    </details>
  )
}

function renderSanityValue(value: boolean | number | string): string {
  if (typeof value === 'boolean') return value ? '✅' : '❌'
  return String(value)
}

function humanizeKey(key: string): string {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
    .replace(/^\w/, (c) => c.toUpperCase())
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes)) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}
