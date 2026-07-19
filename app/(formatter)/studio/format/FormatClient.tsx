'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ARTICLE_TYPE_LABELS, type JournalSummary } from '@/lib/formatting/registry-meta'
import JournalCombobox from '@/components/JournalCombobox'
import {
  MAX_MANUSCRIPT_BYTES,
  MAX_FIGURE_BYTES,
  MAX_FIGURES,
  type CreateJobRequest,
  type CreateJobResponse,
  type JobStatusResponse,
  type JobOutputs,
} from '@/lib/formatting/pipeline/api'
import type { ReportModel, Severity, ReferenceVerificationStatus } from '@/lib/formatting/types'
import { layoutNotPrescribedLine } from '@/lib/formatting/reportCopy'
import type { ArticleType } from '@/lib/formatting/rulesSchema'
import { publishFormatHandoff, subscribeJournalRequest } from '@/lib/finder/handoff'

/* ------------------------------------------------------------------ */
/*  Constants + helpers                                                 */
/* ------------------------------------------------------------------ */

const ACCEPTED_FIGURE_EXTS = ['jpg', 'jpeg', 'png', 'tif', 'tiff'] as const

type Phase = 'form' | 'running' | 'complete' | 'error'

function formatBytes(n: number): string {
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

function fileExt(name: string): string {
  return name.split('.').pop()?.toLowerCase() ?? ''
}

function friendlyDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const SEVERITY_STYLES: Record<Severity, { label: string; chip: string }> = {
  fixed: { label: 'Fixed', chip: 'bg-[#E8F5EE] text-fmt-ok border-transparent' },
  'action-required': { label: 'Action required', chip: 'bg-[#FBF3E4] text-fmt-warn border-transparent' },
  suggestion: { label: 'Suggestion', chip: 'bg-fmt-surface text-fmt-ink-2 border-fmt-hairline' },
  info: { label: 'Info', chip: 'bg-fmt-paper text-fmt-ink-2 border-fmt-hairline' },
}

const REF_STATUS: Record<
  ReferenceVerificationStatus,
  { icon: string; label: string; text: string }
> = {
  verified: { icon: '✅', label: 'Verified', text: 'text-fmt-ok' },
  corrected: { icon: '🔧', label: 'Corrected', text: 'text-fmt-ink' },
  unverified: { icon: '⚠️', label: 'Unverified', text: 'text-fmt-warn' },
  'possibly-retracted': { icon: '🚩', label: 'Possibly retracted', text: 'text-fmt-bad' },
}

const CHECK_STATUS: Record<'met' | 'fixed' | 'action-needed', { icon: string; label: string; text: string }> = {
  met: { icon: '✓', label: 'Met', text: 'text-fmt-ok' },
  fixed: { icon: '✓', label: 'Fixed for you', text: 'text-fmt-ok' },
  'action-needed': { icon: '!', label: 'Action needed', text: 'text-fmt-warn' },
}

const DOWNLOAD_LABELS: { key: keyof JobOutputs; label: string; primary?: boolean }[] = [
  { key: 'manuscript', label: 'Formatted manuscript (.docx)', primary: true },
  { key: 'reportDocx', label: 'Analysis report (.docx)' },
  { key: 'zip', label: 'Download everything (.zip)' },
]

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

async function readErrorMessage(res: Response): Promise<string | null> {
  try {
    const data = (await res.json()) as { error?: { message?: string } | string; message?: string }
    if (typeof data.error === 'string') return data.error
    return data.error?.message ?? data.message ?? null
  } catch {
    return null
  }
}

/* ------------------------------------------------------------------ */
/*  Report view                                                         */
/* ------------------------------------------------------------------ */

function SeverityChip({ severity }: { severity: Severity }) {
  const s = SEVERITY_STYLES[severity]
  return (
    <span className={`inline-block rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${s.chip}`}>
      {s.label}
    </span>
  )
}

function ReportView({ report }: { report: ReportModel }) {
  const v = report.summaryVerdict
  const clean = v.itemsNeedingAttention === 0

  return (
    <div className="space-y-8">
      {/* Summary verdict banner */}
      <div className="rounded-xl border border-fmt-hairline bg-fmt-surface p-5 sm:p-6">
        <p className="kicker mb-2">Analysis &amp; Suggestions Report</p>
        <h3 className="mb-2 font-fmt-display text-2xl text-fmt-ink">Formatted for {v.journal}</h3>
        <p className="text-sm leading-relaxed text-fmt-ink">
          <strong className="text-fmt-ink">{v.changesApplied}</strong>{' '}
          {v.changesApplied === 1 ? 'change was' : 'changes were'} applied automatically ·{' '}
          <strong className="text-fmt-ink">{v.itemsNeedingAttention}</strong>{' '}
          {v.itemsNeedingAttention === 1 ? 'item needs' : 'items need'} your attention
          {clean ? '. Nothing is blocking your submission.' : '.'}
        </p>
        {report.layoutNotPrescribed && (
          <p className="mt-3 text-sm leading-relaxed text-fmt-ink-2">
            {layoutNotPrescribedLine(v.journal)}
          </p>
        )}
        <p className="mt-3 text-xs text-fmt-ink-2">
          Rules verified {friendlyDate(v.verifiedDate)} ·{' '}
          <a
            href={v.guidelinesUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-fmt-accent-deep"
          >
            Journal Guide for Authors
          </a>
        </p>
      </div>

      {/* Changes applied */}
      {report.changesApplied.length > 0 && (
        <section>
          <h4 className="mb-1 font-fmt-display text-lg text-fmt-ink">Changes applied</h4>
          <p className="mb-3 text-xs text-fmt-ink-2">
            Formatting we adjusted for you. Your body text was not changed.
          </p>
          <div className="overflow-x-auto rounded-xl border border-fmt-hairline">
            <table className="w-full min-w-[560px] border-collapse text-sm">
              <thead>
                <tr className="bg-fmt-surface text-left font-fmt-mono text-xs uppercase tracking-wide text-fmt-ink-2">
                  <th className="px-4 py-2.5 font-semibold">Element</th>
                  <th className="px-4 py-2.5 font-semibold">Before</th>
                  <th className="px-4 py-2.5 font-semibold">After</th>
                  <th className="px-4 py-2.5 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {report.changesApplied.map((c, i) => (
                  <tr key={i} className="border-t border-fmt-hairline align-top">
                    <td className="px-4 py-2.5 font-medium text-fmt-ink">{c.element}</td>
                    <td className="px-4 py-2.5 text-fmt-ink-2">{c.before || '—'}</td>
                    <td className="px-4 py-2.5 text-fmt-ink">{c.after || '—'}</td>
                    <td className="px-4 py-2.5">
                      <SeverityChip severity={c.severity} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Suggested changes */}
      {report.suggestedChanges.length > 0 && (
        <section>
          <h4 className="mb-1 font-fmt-display text-lg text-fmt-ink">Suggested changes (author action required)</h4>
          <p className="mb-3 text-xs text-fmt-ink-2">
            Items only you can resolve. We never edit your content. Any wording below is offered for you to adopt.
          </p>
          <ul className="space-y-3">
            {report.suggestedChanges.map((s, i) => (
              <li key={i} className="rounded-xl border border-fmt-hairline bg-white p-4">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <SeverityChip severity={s.severity} />
                  <span className="font-medium text-fmt-ink">{s.title}</span>
                </div>
                {s.location && <p className="mb-1 text-xs text-fmt-ink-2">Location: {s.location}</p>}
                <p className="text-sm leading-relaxed text-fmt-ink">{s.detail}</p>
                {s.suggestedWording && (
                  <div className="mt-3 rounded-lg border border-fmt-hairline bg-fmt-surface p-3">
                    <p className="kicker mb-1">Suggested wording (you may adopt)</p>
                    <p className="text-sm italic text-fmt-ink">{s.suggestedWording}</p>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Reference audit */}
      {report.referenceAudit.length > 0 && (
        <section>
          <h4 className="mb-1 font-fmt-display text-lg text-fmt-ink">Reference audit</h4>
          <p className="mb-3 text-xs text-fmt-ink-2">
            Every reference checked against Crossref and PubMed. ✅ verified · 🔧 corrected · ⚠️ unverified · 🚩 possibly
            retracted.
          </p>
          <div className="overflow-x-auto rounded-xl border border-fmt-hairline">
            <table className="w-full min-w-[560px] border-collapse text-sm">
              <thead>
                <tr className="bg-fmt-surface text-left font-fmt-mono text-xs uppercase tracking-wide text-fmt-ink-2">
                  <th className="px-4 py-2.5 font-semibold">#</th>
                  <th className="px-4 py-2.5 font-semibold">Status</th>
                  <th className="px-4 py-2.5 font-semibold">What changed</th>
                  <th className="px-4 py-2.5 font-semibold">DOI / PMID</th>
                </tr>
              </thead>
              <tbody>
                {report.referenceAudit.map((r) => {
                  const meta = REF_STATUS[r.status]
                  return (
                    <tr key={r.index} className="border-t border-fmt-hairline align-top">
                      <td className="px-4 py-2.5 font-medium text-fmt-ink">{r.index}</td>
                      <td className={`whitespace-nowrap px-4 py-2.5 font-medium ${meta.text}`}>
                        <span aria-hidden="true">{meta.icon}</span> {meta.label}
                      </td>
                      <td className="px-4 py-2.5 text-fmt-ink">{r.changed || '—'}</td>
                      <td className="px-4 py-2.5 text-fmt-ink-2">
                        {r.doi ? (
                          <a
                            href={`https://doi.org/${r.doi}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="underline hover:text-fmt-accent-deep"
                          >
                            {r.doi}
                          </a>
                        ) : r.pmid ? (
                          <a
                            href={`https://pubmed.ncbi.nlm.nih.gov/${r.pmid}/`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="underline hover:text-fmt-accent-deep"
                          >
                            PMID {r.pmid}
                          </a>
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Journal-styled reference list — the thing the author came for.
          Placed between the audit and the checklist, matching the .docx. */}
      {report.formattedReferences && report.formattedReferences.length > 0 && (
        <section>
          <h4 className="mb-1 font-fmt-display text-lg text-fmt-ink">
            Your reference list, formatted for {v.journal}
          </h4>
          <p className="mb-3 text-xs text-fmt-ink-2">
            Paste this over your bibliography, then regenerate any citation-manager fields. We never edit your
            manuscript directly, so your uploaded reference text is unchanged.
          </p>
          {report.styleCaveat && (
            <p className="mb-3 rounded-lg border border-fmt-hairline bg-fmt-surface px-3 py-2 text-xs text-fmt-ink-2">
              This journal uses its own citation variant, so we rendered the closest standard (Vancouver). Check
              punctuation against the guide.
            </p>
          )}
          <ol className="space-y-2 rounded-xl border border-fmt-hairline bg-fmt-surface p-4">
            {report.formattedReferences.map((r) => (
              <li key={r.index} className="flex gap-2 font-fmt-mono text-xs leading-relaxed text-fmt-ink">
                <span className="flex-shrink-0 text-fmt-ink-3">{r.index}.</span>
                <span>
                  {r.text}
                  {r.unparsed && (
                    <span className="text-fmt-warn"> (could not parse, original text kept)</span>
                  )}
                  {!r.unparsed && r.status === 'possibly-retracted' && (
                    <span className="text-fmt-bad"> (possibly retracted, verify before citing)</span>
                  )}
                  {!r.unparsed && r.status === 'unverified' && (
                    <span className="text-fmt-warn"> (unverified)</span>
                  )}
                </span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* Submission checklist */}
      {report.submissionChecklist.length > 0 && (
        <section>
          <h4 className="mb-1 font-fmt-display text-lg text-fmt-ink">Submission checklist</h4>
          <p className="mb-3 text-xs text-fmt-ink-2">Where your manuscript stands against the journal&apos;s requirements.</p>
          <ul className="divide-y divide-fmt-hairline overflow-hidden rounded-xl border border-fmt-hairline">
            {report.submissionChecklist.map((c, i) => {
              const meta = CHECK_STATUS[c.status]
              return (
                <li key={i} className="flex items-start gap-3 bg-white px-4 py-3">
                  <span
                    aria-hidden="true"
                    className={`mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                      c.status === 'action-needed' ? 'bg-[#FBF3E4] text-fmt-warn' : 'bg-[#E8F5EE] text-fmt-ok'
                    }`}
                  >
                    {meta.icon}
                  </span>
                  <div className="flex-1">
                    <p className="text-sm text-fmt-ink">{c.requirement}</p>
                    <p className={`text-xs font-medium ${meta.text}`}>{meta.label}</p>
                  </div>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      {/* Disclaimer footer */}
      <p className="border-t border-fmt-hairline pt-4 text-xs italic leading-relaxed text-fmt-ink-2">
        {report.disclaimer}
        <span className="not-italic"> · Rules version {report.rulesVersion}</span>
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Main client component                                               */
/* ------------------------------------------------------------------ */

export default function FormatClient({ journals }: { journals: JournalSummary[] }) {
  // Inputs
  const [manuscript, setManuscript] = useState<File | null>(null)
  const [manuscriptError, setManuscriptError] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const [figures, setFigures] = useState<File[]>([])
  const [figureError, setFigureError] = useState<string | null>(null)
  const [journalId, setJournalId] = useState('')
  const [articleType, setArticleType] = useState('')
  const [email, setEmail] = useState('')

  // Run state
  const [phase, setPhase] = useState<Phase>('form')
  const [submitting, setSubmitting] = useState(false)
  const [progress, setProgress] = useState(0)
  // What the bar actually shows: creeps smoothly toward (but never past) the
  // next milestone while the server works, and snaps up when the server
  // reports real progress — so it never sits frozen on one number.
  const [displayProgress, setDisplayProgress] = useState(0)
  const [stageLabel, setStageLabel] = useState('')
  const [report, setReport] = useState<ReportModel | null>(null)
  const [downloads, setDownloads] = useState<JobOutputs>({})
  const [runError, setRunError] = useState<string | null>(null)

  const manuscriptInputRef = useRef<HTMLInputElement>(null)
  const figureInputRef = useRef<HTMLInputElement>(null)

  const selectedJournal = useMemo(
    () => journals.find((j) => j.slug === journalId) ?? null,
    [journalId],
  )

  // "Format for this journal →" from the Journal Finder pre-selects here.
  useEffect(() => {
    return subscribeJournalRequest((req) => {
      setJournalId(req.slug)
      setArticleType(req.articleType)
      setPhase('form')
    })
  }, [])

  // Smooth progress animation: every 250ms, ease the displayed value toward a
  // ceiling a little ahead of the last server-reported progress. Asymptotic,
  // so it visibly moves during long stages but can't overtake reality by much.
  useEffect(() => {
    if (phase !== 'running') return
    const id = setInterval(() => {
      setDisplayProgress((p) => {
        if (progress >= 1) return 1
        const base = Math.max(p, progress)
        const ceiling = Math.min(progress + 0.18, 0.98)
        if (base >= ceiling) return base
        return Math.min(base + Math.max((ceiling - base) * 0.04, 0.0006), ceiling)
      })
    }, 250)
    return () => clearInterval(id)
  }, [phase, progress])

  const emailValid = EMAIL_RE.test(email)
  const canSubmit =
    !!manuscript && !!journalId && !!articleType && emailValid && !submitting

  /* ---- File handling ---- */

  const acceptManuscript = useCallback((file: File) => {
    if (fileExt(file.name) !== 'docx') {
      setManuscriptError('Please upload a Microsoft Word .docx file. PDFs and legacy .doc files are not supported.')
      return
    }
    if (file.size > MAX_MANUSCRIPT_BYTES) {
      setManuscriptError(
        `That file is ${formatBytes(file.size)}. The maximum manuscript size is ${formatBytes(MAX_MANUSCRIPT_BYTES)}.`,
      )
      return
    }
    setManuscriptError(null)
    setManuscript(file)
  }, [])

  const addFigures = useCallback(
    (incoming: FileList | File[]) => {
      const next = [...figures]
      let err: string | null = null
      for (const f of Array.from(incoming)) {
        if (next.length >= MAX_FIGURES) {
          err = `You can attach at most ${MAX_FIGURES} figures.`
          break
        }
        if (!ACCEPTED_FIGURE_EXTS.includes(fileExt(f.name) as (typeof ACCEPTED_FIGURE_EXTS)[number])) {
          err = `${f.name}: unsupported image type. Allowed formats are JPG, PNG, and TIFF.`
          continue
        }
        if (f.size > MAX_FIGURE_BYTES) {
          err = `${f.name} is ${formatBytes(f.size)}, over the ${formatBytes(MAX_FIGURE_BYTES)} per-figure limit.`
          continue
        }
        if (next.some((existing) => existing.name === f.name && existing.size === f.size)) continue
        next.push(f)
      }
      setFigures(next)
      setFigureError(err)
    },
    [figures],
  )

  const removeFigure = useCallback((index: number) => {
    setFigures((current) => current.filter((_, i) => i !== index))
    setFigureError(null)
  }, [])

  function handleJournalChange(slug: string) {
    setJournalId(slug)
    const j = journals.find((x) => x.slug === slug)
    setArticleType(j && j.articleTypes.length === 1 ? j.articleTypes[0] : '')
  }

  /* ---- Submit + poll ---- */

  async function putFile(url: string, file: File) {
    const res = await fetch(url, {
      method: 'PUT',
      body: file,
      headers: { 'content-type': file.type || 'application/octet-stream' },
    })
    if (!res.ok) {
      throw new Error('A file upload failed. Please check your connection and try again.')
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit || !manuscript) return
    setSubmitting(true)
    setRunError(null)

    try {
      const body: CreateJobRequest = {
        email,
        journalId,
        articleType,
        figureCount: figures.length,
        figureFilenames: figures.map((f) => f.name),
        manuscriptFilename: manuscript.name,
      }
      const createRes = await fetch('/api/format/jobs', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!createRes.ok) {
        const msg = await readErrorMessage(createRes)
        throw new Error(msg || 'We could not start your job. Please check your details and try again.')
      }
      const job = (await createRes.json()) as CreateJobResponse

      // Upload manuscript, then figures.
      await putFile(job.manuscriptUpload.url, manuscript)
      for (let i = 0; i < job.figureUploads.length && i < figures.length; i++) {
        await putFile(job.figureUploads[i].url, figures[i])
      }

      setPhase('running')
      setProgress(0.05)
      setDisplayProgress(0.05)
      setStageLabel('Uploaded, starting…')

      // Advance the pipeline one stage at a time, polling status after each nudge.
      for (let iteration = 0; iteration < 150; iteration++) {
        await fetch(`/api/format/jobs/${job.jobId}/advance`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ email }),
        }).catch(() => undefined)

        const statusRes = await fetch(
          `/api/format/jobs/${job.jobId}?email=${encodeURIComponent(email)}`,
        )
        if (!statusRes.ok) {
          await sleep(1500)
          continue
        }
        const status = (await statusRes.json()) as JobStatusResponse
        setProgress(status.progress)
        setStageLabel(status.stageLabel)

        if (status.status === 'complete') {
          setReport(status.report)
          setDownloads(status.downloads)
          setPhase('complete')
          // Hand the numbers we already know to the Journal Finder below, so the
          // author can find fitting journals without retyping (in-memory only).
          publishFormatHandoff({
            filename: manuscript?.name ?? null,
            articleType: (articleType || null) as ArticleType | null,
            journalSlug: journalId || null,
            figureCount: figures.length,
            referenceCount: status.report?.referenceAudit?.length ?? null,
          })
          return
        }
        if (status.status === 'failed') {
          setRunError(
            status.error?.message ??
              'Formatting could not be completed. Please review your manuscript and try again.',
          )
          setPhase('error')
          return
        }
        await sleep(1200)
      }

      setRunError(
        'This is taking longer than expected. Your job may still be processing, so please keep this page open and try again in a few minutes.',
      )
      setPhase('error')
    } catch (err) {
      setRunError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
      setPhase('error')
    } finally {
      setSubmitting(false)
    }
  }

  function backToForm() {
    setPhase('form')
    setRunError(null)
  }

  function startOver() {
    setManuscript(null)
    setManuscriptError(null)
    setFigures([])
    setFigureError(null)
    setJournalId('')
    setArticleType('')
    setEmail('')
    setReport(null)
    setDownloads({})
    setProgress(0)
    setDisplayProgress(0)
    setStageLabel('')
    setRunError(null)
    setPhase('form')
  }

  /* ---- Render: running ---- */

  if (phase === 'running') {
    const pct = Math.round(Math.min(Math.max(displayProgress, 0), 1) * 100)
    return (
      <div className="rounded-xl border border-fmt-hairline bg-white p-8">
        <h3 className="mb-2 font-fmt-display text-2xl text-fmt-ink">Formatting your manuscript</h3>
        <p className="mb-6 font-fmt-mono text-sm text-fmt-ink-2" aria-live="polite">
          {stageLabel || 'Working…'}
        </p>
        <div
          className="pbar w-full"
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Formatting progress"
        >
          <i style={{ width: `${Math.max(pct, 4)}%` }} />
        </div>
        <p className="plabel">{pct}% complete</p>
        <p className="mt-6 max-w-md text-xs leading-relaxed text-fmt-ink-2">
          This usually takes a couple of minutes. Please keep this tab open. Reference verification against Crossref and
          PubMed is the slowest step.
        </p>
      </div>
    )
  }

  /* ---- Render: complete ---- */

  if (phase === 'complete') {
    const availableDownloads = DOWNLOAD_LABELS.filter((d) => downloads[d.key])
    return (
      <div className="space-y-8">
        <div className="rounded-xl border border-[#CDE9D8] bg-[#E8F5EE] p-6">
          <div className="flex items-start gap-3">
            <span
              aria-hidden="true"
              className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-white text-sm font-bold text-fmt-ok"
            >
              ✓
            </span>
            <div>
              <h3 className="font-fmt-display text-xl text-fmt-ink">Your formatted manuscript is ready</h3>
              <p className="mt-1 text-sm text-fmt-ink">
                Download your files below and review the report before you submit. Files are only available on this
                page, so save them now.
              </p>
            </div>
          </div>
        </div>

        {availableDownloads.length > 0 && (
          <div className="rounded-xl border border-fmt-hairline bg-white p-6">
            <p className="kicker mb-3">Downloads</p>
            <div className="flex flex-wrap gap-3">
              {availableDownloads.map((d) => (
                <a
                  key={d.key}
                  href={downloads[d.key]}
                  download
                  className={d.primary ? 'btn btn-primary' : 'btn btn-secondary'}
                >
                  {d.label}
                </a>
              ))}
            </div>
            <p className="mt-3 font-fmt-mono text-xs text-fmt-ink-3">Download links expire after about an hour.</p>
          </div>
        )}

        {report && <ReportView report={report} />}

        <div className="flex flex-wrap gap-3 border-t border-fmt-hairline pt-6">
          <button type="button" onClick={startOver} className="btn btn-primary">
            Format another manuscript
          </button>
        </div>
      </div>
    )
  }

  /* ---- Render: form (also shown behind an error banner) ---- */

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {phase === 'error' && runError && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-xl border border-[#F0C7C4] bg-[#FBEAE9] px-4 py-3 text-sm text-fmt-bad"
        >
          <span aria-hidden="true" className="mt-0.5 font-bold">
            !
          </span>
          <div>
            <p className="font-medium">We could not finish formatting your manuscript.</p>
            <p className="mt-0.5">{runError}</p>
          </div>
        </div>
      )}

      {/* Step 1 — Upload */}
      <div className="rounded-xl border border-fmt-hairline bg-white p-6">
        <h3 className="mb-1 font-fmt-display text-xl text-fmt-ink">1. Upload your manuscript</h3>
        <p className="mb-4 text-sm text-fmt-ink-2">
          A blinded Word .docx, up to {formatBytes(MAX_MANUSCRIPT_BYTES)}. Figures are optional.
        </p>

        {/* Manuscript drop zone */}
        <div
          role="button"
          tabIndex={0}
          aria-label="Upload manuscript file"
          onClick={() => manuscriptInputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              manuscriptInputRef.current?.click()
            }
          }}
          onDragOver={(e) => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragging(false)
            if (e.dataTransfer.files?.[0]) acceptManuscript(e.dataTransfer.files[0])
          }}
          className={`drop cursor-pointer${dragging ? ' dragging' : ''}`}
        >
          <input
            ref={manuscriptInputRef}
            type="file"
            accept=".docx"
            className="sr-only"
            onChange={(e) => {
              if (e.target.files?.[0]) acceptManuscript(e.target.files[0])
              e.target.value = ''
            }}
          />
          {manuscript ? (
            <div className="flex flex-col items-center gap-1">
              <p className="font-medium text-fmt-ink">Drop your manuscript here</p>
              <p className="mono" style={{ color: 'var(--fmt-ok)' }}>
                {manuscript.name} · {formatBytes(manuscript.size)} ✓
              </p>
              <p className="mono">click to replace</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-1">
              <p className="font-medium text-fmt-ink">Drag your .docx here, or click to browse</p>
              <p className="mono">Microsoft Word only · max {formatBytes(MAX_MANUSCRIPT_BYTES)} · figures optional</p>
            </div>
          )}
        </div>
        {manuscriptError && (
          <p role="alert" className="mt-2 text-sm text-fmt-bad">
            {manuscriptError}
          </p>
        )}

        {/* Figures */}
        <div className="mt-6">
          <div className="mb-2 flex items-center justify-between">
            <label htmlFor="figures" className="text-sm font-medium text-fmt-ink">
              Figures <span className="font-normal text-fmt-ink-2">(optional)</span>
            </label>
            <span className="font-fmt-mono text-xs text-fmt-ink-3">
              {figures.length}/{MAX_FIGURES} · JPG, PNG, TIFF · max {formatBytes(MAX_FIGURE_BYTES)} each
            </span>
          </div>
          <input
            id="figures"
            ref={figureInputRef}
            type="file"
            multiple
            accept=".jpg,.jpeg,.png,.tif,.tiff"
            className="sr-only"
            onChange={(e) => {
              if (e.target.files) addFigures(e.target.files)
              e.target.value = ''
            }}
          />
          <button
            type="button"
            onClick={() => figureInputRef.current?.click()}
            disabled={figures.length >= MAX_FIGURES}
            className="btn btn-secondary disabled:cursor-not-allowed disabled:opacity-50"
          >
            Add figures
          </button>
          {figures.length > 0 && (
            <ul className="mt-3 space-y-2">
              {figures.map((f, i) => (
                <li
                  key={`${f.name}-${i}`}
                  className="flex items-center justify-between rounded-lg border border-fmt-hairline bg-fmt-surface px-3 py-2 text-sm"
                >
                  <span className="truncate font-fmt-mono text-fmt-ink">
                    {f.name} <span className="text-xs text-fmt-ink-3">({formatBytes(f.size)})</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => removeFigure(i)}
                    aria-label={`Remove ${f.name}`}
                    className="ml-3 flex-shrink-0 text-xs font-medium text-fmt-ink-2 hover:text-fmt-accent-deep hover:underline"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
          {figureError && (
            <p role="alert" className="mt-2 text-sm text-fmt-bad">
              {figureError}
            </p>
          )}
        </div>
      </div>

      {/* Step 2 — Journal + article type */}
      <div className="rounded-xl border border-fmt-hairline bg-white p-6">
        <h3 className="mb-1 font-fmt-display text-xl text-fmt-ink">2. Choose your target journal</h3>
        <p className="mb-4 text-sm text-fmt-ink-2">We will format to this journal&apos;s current requirements.</p>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="journal" className="mb-1 block text-sm font-medium text-fmt-ink">
              Journal <span className="font-normal text-fmt-ink-2">({journals.length} supported)</span>
            </label>
            <JournalCombobox
              journals={journals}
              value={journalId}
              onChange={handleJournalChange}
            />
          </div>

          <div>
            <label htmlFor="articleType" className="mb-1 block text-sm font-medium text-fmt-ink">
              Article type
            </label>
            <select
              id="articleType"
              value={articleType}
              onChange={(e) => setArticleType(e.target.value)}
              disabled={!selectedJournal}
              className="w-full rounded-lg border border-fmt-hairline bg-white px-4 py-2.5 text-sm text-fmt-ink transition-colors focus:border-fmt-accent focus:outline-none focus:ring-2 focus:ring-fmt-accent/40 disabled:cursor-not-allowed disabled:bg-fmt-surface disabled:text-fmt-ink-3"
            >
              <option value="">{selectedJournal ? 'Select an article type…' : 'Choose a journal first'}</option>
              {selectedJournal?.articleTypes.map((t) => (
                <option key={t} value={t}>
                  {ARTICLE_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </div>
        </div>

        {selectedJournal && (
          <p className="mt-3 text-xs text-fmt-ink-2">
            Rules verified {friendlyDate(selectedJournal.verifiedDate)} ·{' '}
            <a
              href={selectedJournal.guidelinesUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-fmt-accent-deep"
            >
              {selectedJournal.name} Guide for Authors
            </a>
          </p>
        )}
      </div>

      {/* Step 3 — Email + verification */}
      <div className="rounded-xl border border-fmt-hairline bg-white p-6">
        <h3 className="mb-1 font-fmt-display text-xl text-fmt-ink">3. Your email</h3>
        <p className="mb-4 text-sm text-fmt-ink-2">
          Your results appear right here on this page and nothing is emailed. We ask for your email only to prevent
          abuse of a free tool, and we do not share your address.
        </p>

        <div className="max-w-md">
          <label htmlFor="email" className="mb-1 block text-sm font-medium text-fmt-ink">
            Email address
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            placeholder="you@institution.edu"
            className="w-full rounded-lg border border-fmt-hairline bg-white px-4 py-2.5 text-sm text-fmt-ink placeholder:text-fmt-ink-3 transition-colors focus:border-fmt-accent focus:outline-none focus:ring-2 focus:ring-fmt-accent/40"
          />
          {email.length > 0 && !emailValid && (
            <p className="mt-1 text-xs text-fmt-bad">Please enter a valid email address.</p>
          )}
        </div>

      </div>

      {/* Submit */}
      <div className="flex flex-col items-center gap-3">
        <button
          type="submit"
          disabled={!canSubmit}
          className="btn btn-primary inline-flex w-full items-center justify-center gap-2 sm:w-auto sm:min-w-[240px] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? (
            <>
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Starting…
            </>
          ) : (
            'Format my manuscript'
          )}
        </button>
        {phase === 'error' && (
          <button type="button" onClick={backToForm} className="text-sm text-fmt-ink-2 hover:underline">
            Reset the form
          </button>
        )}
        <p className="max-w-md text-center text-xs text-fmt-ink-2">
          Free to use. By continuing you confirm you have the right to upload this manuscript. Always verify the output
          against the journal&apos;s current Guide for Authors before submitting.
        </p>
      </div>
    </form>
  )
}
