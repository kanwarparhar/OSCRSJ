'use client'

import { useCallback, useMemo, useRef, useState } from 'react'
import Turnstile from '@/components/Turnstile'
import { JOURNAL_SUMMARIES, ARTICLE_TYPE_LABELS } from '@/lib/formatting/journalList'
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
  fixed: { label: 'Fixed', chip: 'bg-green-50 text-green-700 border-green-200' },
  'action-required': { label: 'Action required', chip: 'bg-amber-50 text-amber-800 border-amber-200' },
  suggestion: { label: 'Suggestion', chip: 'bg-cream-alt text-brown border-border' },
  info: { label: 'Info', chip: 'bg-white text-brown border-taupe/60' },
}

const REF_STATUS: Record<
  ReferenceVerificationStatus,
  { icon: string; label: string; text: string }
> = {
  verified: { icon: '✅', label: 'Verified', text: 'text-green-700' },
  corrected: { icon: '🔧', label: 'Corrected', text: 'text-brown-dark' },
  unverified: { icon: '⚠️', label: 'Unverified', text: 'text-amber-800' },
  'possibly-retracted': { icon: '🚩', label: 'Possibly retracted', text: 'text-red-700' },
}

const CHECK_STATUS: Record<'met' | 'fixed' | 'action-needed', { icon: string; label: string; text: string }> = {
  met: { icon: '✓', label: 'Met', text: 'text-green-700' },
  fixed: { icon: '✓', label: 'Fixed for you', text: 'text-green-700' },
  'action-needed': { icon: '!', label: 'Action needed', text: 'text-amber-800' },
}

const DOWNLOAD_LABELS: { key: keyof JobOutputs; label: string; primary?: boolean }[] = [
  { key: 'manuscript', label: 'Formatted manuscript (.docx)', primary: true },
  { key: 'titlePage', label: 'Title page (.docx)' },
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
      <div className="rounded-xl border border-peach/40 bg-cream-alt p-5 sm:p-6">
        <p className="section-label mb-1">Analysis &amp; Suggestions Report</p>
        <h3 className="mb-2 font-serif text-2xl text-brown-dark">Formatted for {v.journal}</h3>
        <p className="text-sm leading-relaxed text-ink">
          <strong className="text-brown-dark">{v.changesApplied}</strong>{' '}
          {v.changesApplied === 1 ? 'change was' : 'changes were'} applied automatically ·{' '}
          <strong className="text-brown-dark">{v.itemsNeedingAttention}</strong>{' '}
          {v.itemsNeedingAttention === 1 ? 'item needs' : 'items need'} your attention
          {clean ? ' — nothing is blocking your submission.' : '.'}
        </p>
        <p className="mt-3 text-xs text-brown">
          Rules verified {friendlyDate(v.verifiedDate)} ·{' '}
          <a
            href={v.guidelinesUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-brown-dark"
          >
            Journal Guide for Authors
          </a>
        </p>
      </div>

      {/* Changes applied */}
      {report.changesApplied.length > 0 && (
        <section>
          <h4 className="mb-1 font-serif text-lg text-brown-dark">Changes applied</h4>
          <p className="mb-3 text-xs text-brown">
            Formatting we adjusted for you. Your body text was not changed.
          </p>
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full min-w-[560px] border-collapse text-sm">
              <thead>
                <tr className="bg-cream-alt text-left text-xs uppercase tracking-wide text-brown">
                  <th className="px-4 py-2.5 font-semibold">Element</th>
                  <th className="px-4 py-2.5 font-semibold">Before</th>
                  <th className="px-4 py-2.5 font-semibold">After</th>
                  <th className="px-4 py-2.5 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {report.changesApplied.map((c, i) => (
                  <tr key={i} className="border-t border-border align-top">
                    <td className="px-4 py-2.5 font-medium text-ink">{c.element}</td>
                    <td className="px-4 py-2.5 text-brown">{c.before || '—'}</td>
                    <td className="px-4 py-2.5 text-ink">{c.after || '—'}</td>
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
          <h4 className="mb-1 font-serif text-lg text-brown-dark">Suggested changes (author action required)</h4>
          <p className="mb-3 text-xs text-brown">
            Items only you can resolve. We never edit your content — any wording below is offered for you to adopt.
          </p>
          <ul className="space-y-3">
            {report.suggestedChanges.map((s, i) => (
              <li key={i} className="rounded-xl border border-border bg-white p-4">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <SeverityChip severity={s.severity} />
                  <span className="font-medium text-ink">{s.title}</span>
                </div>
                {s.location && <p className="mb-1 text-xs text-brown">Location: {s.location}</p>}
                <p className="text-sm leading-relaxed text-ink">{s.detail}</p>
                {s.suggestedWording && (
                  <div className="mt-3 rounded-lg border border-border bg-cream-alt/60 p-3">
                    <p className="mb-1 text-[11px] font-semibold uppercase tracking-widest text-brown">
                      Suggested wording (you may adopt)
                    </p>
                    <p className="text-sm italic text-ink">{s.suggestedWording}</p>
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
          <h4 className="mb-1 font-serif text-lg text-brown-dark">Reference audit</h4>
          <p className="mb-3 text-xs text-brown">
            Every reference checked against Crossref and PubMed. ✅ verified · 🔧 corrected · ⚠️ unverified · 🚩 possibly
            retracted.
          </p>
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full min-w-[560px] border-collapse text-sm">
              <thead>
                <tr className="bg-cream-alt text-left text-xs uppercase tracking-wide text-brown">
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
                    <tr key={r.index} className="border-t border-border align-top">
                      <td className="px-4 py-2.5 font-medium text-ink">{r.index}</td>
                      <td className={`whitespace-nowrap px-4 py-2.5 font-medium ${meta.text}`}>
                        <span aria-hidden="true">{meta.icon}</span> {meta.label}
                      </td>
                      <td className="px-4 py-2.5 text-ink">{r.changed || '—'}</td>
                      <td className="px-4 py-2.5 text-brown">
                        {r.doi ? (
                          <a
                            href={`https://doi.org/${r.doi}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="underline hover:text-brown-dark"
                          >
                            {r.doi}
                          </a>
                        ) : r.pmid ? (
                          <a
                            href={`https://pubmed.ncbi.nlm.nih.gov/${r.pmid}/`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="underline hover:text-brown-dark"
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

      {/* Submission checklist */}
      {report.submissionChecklist.length > 0 && (
        <section>
          <h4 className="mb-1 font-serif text-lg text-brown-dark">Submission checklist</h4>
          <p className="mb-3 text-xs text-brown">Where your manuscript stands against the journal&apos;s requirements.</p>
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
            {report.submissionChecklist.map((c, i) => {
              const meta = CHECK_STATUS[c.status]
              return (
                <li key={i} className="flex items-start gap-3 bg-white px-4 py-3">
                  <span
                    aria-hidden="true"
                    className={`mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                      c.status === 'action-needed' ? 'bg-amber-50 text-amber-800' : 'bg-green-50 text-green-700'
                    }`}
                  >
                    {meta.icon}
                  </span>
                  <div className="flex-1">
                    <p className="text-sm text-ink">{c.requirement}</p>
                    <p className={`text-xs font-medium ${meta.text}`}>{meta.label}</p>
                  </div>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      {/* Disclaimer footer */}
      <p className="border-t border-border pt-4 text-xs italic leading-relaxed text-brown">
        {report.disclaimer}
        <span className="not-italic"> · Rules version {report.rulesVersion}</span>
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Main client component                                               */
/* ------------------------------------------------------------------ */

export default function FormatClient() {
  // Inputs
  const [manuscript, setManuscript] = useState<File | null>(null)
  const [manuscriptError, setManuscriptError] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const [figures, setFigures] = useState<File[]>([])
  const [figureError, setFigureError] = useState<string | null>(null)
  const [journalId, setJournalId] = useState('')
  const [articleType, setArticleType] = useState('')
  const [email, setEmail] = useState('')
  const [turnstileToken, setTurnstileToken] = useState('')
  const [turnstileKey, setTurnstileKey] = useState(0)

  // Run state
  const [phase, setPhase] = useState<Phase>('form')
  const [submitting, setSubmitting] = useState(false)
  const [progress, setProgress] = useState(0)
  const [stageLabel, setStageLabel] = useState('')
  const [report, setReport] = useState<ReportModel | null>(null)
  const [downloads, setDownloads] = useState<JobOutputs>({})
  const [runError, setRunError] = useState<string | null>(null)

  const manuscriptInputRef = useRef<HTMLInputElement>(null)
  const figureInputRef = useRef<HTMLInputElement>(null)

  const selectedJournal = useMemo(
    () => JOURNAL_SUMMARIES.find((j) => j.slug === journalId) ?? null,
    [journalId],
  )

  const emailValid = EMAIL_RE.test(email)
  const canSubmit =
    !!manuscript && !!journalId && !!articleType && emailValid && !!turnstileToken && !submitting

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
          err = `${f.name} is ${formatBytes(f.size)} — over the ${formatBytes(MAX_FIGURE_BYTES)} per-figure limit.`
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
    const j = JOURNAL_SUMMARIES.find((x) => x.slug === slug)
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
        turnstileToken,
        figureCount: figures.length,
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
      setProgress(0.08)
      setStageLabel('Uploaded — starting…')

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
        'This is taking longer than expected. Your job may still be processing — we will email you a link when it is ready.',
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
    setTurnstileToken('')
    setTurnstileKey((k) => k + 1)
  }

  function startOver() {
    setManuscript(null)
    setManuscriptError(null)
    setFigures([])
    setFigureError(null)
    setJournalId('')
    setArticleType('')
    setEmail('')
    setTurnstileToken('')
    setTurnstileKey((k) => k + 1)
    setReport(null)
    setDownloads({})
    setProgress(0)
    setStageLabel('')
    setRunError(null)
    setPhase('form')
  }

  /* ---- Render: running ---- */

  if (phase === 'running') {
    const pct = Math.round(Math.min(Math.max(progress, 0), 1) * 100)
    return (
      <div className="rounded-xl border border-border bg-white p-8 text-center">
        <h3 className="mb-2 font-serif text-2xl text-brown-dark">Formatting your manuscript</h3>
        <p className="mb-6 text-sm text-brown" aria-live="polite">
          {stageLabel || 'Working…'}
        </p>
        <div
          className="mx-auto h-2.5 w-full max-w-md overflow-hidden rounded-full bg-cream-alt"
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Formatting progress"
        >
          <div
            className="h-full rounded-full bg-peach-dark transition-all duration-500 ease-out"
            style={{ width: `${Math.max(pct, 4)}%` }}
          />
        </div>
        <p className="mt-3 text-xs text-brown">{pct}% complete</p>
        <p className="mx-auto mt-6 max-w-md text-xs leading-relaxed text-brown">
          This usually takes a couple of minutes. Please keep this tab open — reference verification against Crossref and
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
        <div className="rounded-xl border border-green-200 bg-green-50 p-6">
          <div className="flex items-start gap-3">
            <span
              aria-hidden="true"
              className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-green-100 text-sm font-bold text-green-700"
            >
              ✓
            </span>
            <div>
              <h3 className="font-serif text-xl text-brown-dark">Your formatted manuscript is ready</h3>
              <p className="mt-1 text-sm text-ink">
                Download your files below and review the report before you submit.
              </p>
            </div>
          </div>
        </div>

        {availableDownloads.length > 0 && (
          <div className="rounded-xl border border-border bg-white p-6">
            <p className="section-label mb-3">Downloads</p>
            <div className="flex flex-wrap gap-3">
              {availableDownloads.map((d) => (
                <a
                  key={d.key}
                  href={downloads[d.key]}
                  download
                  className={d.primary ? 'btn-primary-light' : 'btn-outline !text-brown !border-brown/40 hover:!bg-brown hover:!text-white'}
                >
                  {d.label}
                </a>
              ))}
            </div>
            <p className="mt-3 text-xs text-brown">Download links expire after about an hour.</p>
          </div>
        )}

        {report && <ReportView report={report} />}

        <div className="flex flex-wrap gap-3 border-t border-border pt-6">
          <button type="button" onClick={startOver} className="btn-primary-light">
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
          className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
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
      <div className="rounded-xl border border-border bg-white p-6">
        <h3 className="mb-1 font-serif text-xl text-brown-dark">1. Upload your manuscript</h3>
        <p className="mb-4 text-sm text-brown">
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
          className={`cursor-pointer rounded-xl border-2 border-dashed p-6 text-center transition-colors ${
            dragging ? 'border-peach-dark bg-cream-alt' : 'border-border bg-cream-alt/40 hover:border-tan'
          }`}
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
              <p className="font-medium text-ink">{manuscript.name}</p>
              <p className="text-xs text-brown">{formatBytes(manuscript.size)} · click to replace</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-1">
              <p className="font-medium text-ink">Drag your .docx here, or click to browse</p>
              <p className="text-xs text-brown">Microsoft Word only · max {formatBytes(MAX_MANUSCRIPT_BYTES)}</p>
            </div>
          )}
        </div>
        {manuscriptError && (
          <p role="alert" className="mt-2 text-sm text-red-700">
            {manuscriptError}
          </p>
        )}

        {/* Figures */}
        <div className="mt-6">
          <div className="mb-2 flex items-center justify-between">
            <label htmlFor="figures" className="text-sm font-medium text-ink">
              Figures <span className="font-normal text-brown">(optional)</span>
            </label>
            <span className="text-xs text-brown">
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
            className="rounded-lg border border-border bg-white px-4 py-2 text-sm text-ink transition-colors hover:border-tan disabled:cursor-not-allowed disabled:opacity-50"
          >
            Add figures
          </button>
          {figures.length > 0 && (
            <ul className="mt-3 space-y-2">
              {figures.map((f, i) => (
                <li
                  key={`${f.name}-${i}`}
                  className="flex items-center justify-between rounded-lg border border-border bg-cream-alt/40 px-3 py-2 text-sm"
                >
                  <span className="truncate text-ink">
                    {f.name} <span className="text-xs text-brown">({formatBytes(f.size)})</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => removeFigure(i)}
                    aria-label={`Remove ${f.name}`}
                    className="ml-3 flex-shrink-0 text-xs font-medium text-brown hover:text-brown-dark hover:underline"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
          {figureError && (
            <p role="alert" className="mt-2 text-sm text-red-700">
              {figureError}
            </p>
          )}
        </div>
      </div>

      {/* Step 2 — Journal + article type */}
      <div className="rounded-xl border border-border bg-white p-6">
        <h3 className="mb-1 font-serif text-xl text-brown-dark">2. Choose your target journal</h3>
        <p className="mb-4 text-sm text-brown">We will format to this journal&apos;s current requirements.</p>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="journal" className="mb-1 block text-sm font-medium text-ink">
              Journal
            </label>
            <select
              id="journal"
              value={journalId}
              onChange={(e) => handleJournalChange(e.target.value)}
              className="w-full rounded-lg border border-border bg-white px-4 py-2.5 text-sm text-ink transition-colors focus:border-peach-dark focus:outline-none focus:ring-2 focus:ring-peach-dark/50"
            >
              <option value="">Select a journal…</option>
              {JOURNAL_SUMMARIES.map((j) => (
                <option key={j.slug} value={j.slug}>
                  {j.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="articleType" className="mb-1 block text-sm font-medium text-ink">
              Article type
            </label>
            <select
              id="articleType"
              value={articleType}
              onChange={(e) => setArticleType(e.target.value)}
              disabled={!selectedJournal}
              className="w-full rounded-lg border border-border bg-white px-4 py-2.5 text-sm text-ink transition-colors focus:border-peach-dark focus:outline-none focus:ring-2 focus:ring-peach-dark/50 disabled:cursor-not-allowed disabled:bg-cream-alt/40 disabled:text-brown"
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
          <p className="mt-3 text-xs text-brown">
            Rules verified {friendlyDate(selectedJournal.verifiedDate)} ·{' '}
            <a
              href={selectedJournal.guidelinesUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-brown-dark"
            >
              {selectedJournal.name} Guide for Authors
            </a>
          </p>
        )}
      </div>

      {/* Step 3 — Email + verification */}
      <div className="rounded-xl border border-border bg-white p-6">
        <h3 className="mb-1 font-serif text-xl text-brown-dark">3. Where should we send your results?</h3>
        <p className="mb-4 text-sm text-brown">
          We will email you a link to your formatted files. We do not share your address.
        </p>

        <div className="max-w-md">
          <label htmlFor="email" className="mb-1 block text-sm font-medium text-ink">
            Email address
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            placeholder="you@institution.edu"
            className="w-full rounded-lg border border-border bg-white px-4 py-2.5 text-sm text-ink placeholder:text-brown/70 transition-colors focus:border-peach-dark focus:outline-none focus:ring-2 focus:ring-peach-dark/50"
          />
          {email.length > 0 && !emailValid && (
            <p className="mt-1 text-xs text-red-700">Please enter a valid email address.</p>
          )}
        </div>

        <div className="mt-5">
          {process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ? (
            <Turnstile key={turnstileKey} onVerify={setTurnstileToken} onExpire={() => setTurnstileToken('')} />
          ) : (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Human verification is not configured for this environment, so submissions are temporarily unavailable.
            </p>
          )}
        </div>
      </div>

      {/* Submit */}
      <div className="flex flex-col items-center gap-3">
        <button
          type="submit"
          disabled={!canSubmit}
          className="btn-primary-light w-full justify-center sm:w-auto sm:min-w-[240px] disabled:cursor-not-allowed disabled:opacity-50"
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
          <button type="button" onClick={backToForm} className="text-sm text-brown hover:underline">
            Reset the form
          </button>
        )}
        <p className="max-w-md text-center text-xs text-brown">
          Free during beta. By continuing you confirm you have the right to upload this manuscript. Always verify the
          output against the journal&apos;s current Guide for Authors before submitting.
        </p>
      </div>
    </form>
  )
}
