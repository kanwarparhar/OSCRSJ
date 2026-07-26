'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
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
import { publishFormatHandoff, subscribeJournalRequest, clearJournalRequest } from '@/lib/finder/handoff'
import {
  STUDIO_FREE_RUNS,
  STUDIO_FREE_UNTIL_LABEL,
  STUDIO_QUOTA_WINDOW_LABEL,
  isFreeJournalRun,
  normalizeEmail,
  type QuotaStatusPayload,
} from '@/lib/studio/quotaConstants'
import {
  STUDIO_TERMS_PATH,
  TERMS_CHECKBOX_BEFORE,
  TERMS_CHECKBOX_LINK,
  TERMS_CHECKBOX_AFTER,
  TERMS_CHECKBOX_DETAIL,
  MARKETING_CHECKBOX_LABEL,
  MARKETING_CHECKBOX_DETAIL,
} from '@/lib/studio/terms'

/* ------------------------------------------------------------------ */
/*  Constants + helpers                                                 */
/* ------------------------------------------------------------------ */

const ACCEPTED_FIGURE_EXTS = ['jpg', 'jpeg', 'png', 'tif', 'tiff'] as const

type Phase = 'form' | 'running' | 'complete' | 'error'

function formatBytes(n: number): string {
  // Sub-megabyte uploads rendered as "0.0 MB", which reads like an empty file
  // next to a green check. Franklin, 2026-07-25.
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} KB`
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

/**
 * The zone every quota time is quoted in.
 *
 * Fixed rather than the reader's own zone on purpose. The server decides the
 * instant a run frees up; if the page rendered it in whatever zone the browser
 * claims, two people comparing the same address would read two different
 * clocks and one of them would be wrong about when to come back. The copy
 * names the zone, so a reader elsewhere can do the arithmetic knowingly.
 */
const QUOTA_TIME_ZONE = 'America/Los_Angeles'

/**
 * "Thursday at 9:14 AM" for the instant the next run frees itself.
 *
 * Returns null for a missing or unparseable value, and every caller has copy
 * that does not name a time: `nextRunAvailableAt` is legitimately absent when
 * nothing is waiting to age out, and a banner reading "opens up Invalid Date"
 * is worse than one that just says runs come back after a week.
 */
function nextRunLabel(iso: string | null | undefined): string | null {
  if (!iso) return null
  const at = new Date(iso)
  if (Number.isNaN(at.getTime())) return null
  try {
    const day = new Intl.DateTimeFormat('en-US', {
      weekday: 'long',
      timeZone: QUOTA_TIME_ZONE,
    }).format(at)
    const time = new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      timeZone: QUOTA_TIME_ZONE,
    }).format(at)
    return `${day} at ${time}`
  } catch {
    return null
  }
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
  { key: 'titlePage', label: 'Title page draft (.docx)' },
  { key: 'zip', label: 'Download everything (.zip)' },
]

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

/** Structured fields off a failed response. The message alone is not enough
 *  any more: a 429 carries `code` and `quota`, and the difference between
 *  "a survey gets you three more" and "that was the last of them" is the
 *  difference between a call to action and a dead end. */
interface ApiErrorPayload {
  message: string | null
  code: string | null
  quota: {
    used: number
    limit: number
    remaining: number
    canUnlockWithSurvey: boolean
    nextRunAvailableAt?: string | null
  } | null
}

async function readErrorPayload(res: Response): Promise<ApiErrorPayload> {
  try {
    const data = (await res.json()) as {
      error?: { message?: string } | string
      message?: string
      code?: string
      quota?: ApiErrorPayload['quota']
    }
    const message =
      typeof data.error === 'string' ? data.error : data.error?.message ?? data.message ?? null
    return { message, code: data.code ?? null, quota: data.quota ?? null }
  } catch {
    return { message: null, code: null, quota: null }
  }
}

/* ------------------------------------------------------------------ */
/*  Free-run allowance (advisory)                                       */
/* ------------------------------------------------------------------ */

const QUOTA_DEBOUNCE_MS = 600

type QuotaBlock = {
  code: 'quota_exhausted' | 'quota_exhausted_final' | 'quota_in_flight'
  limit: number
  /** When the oldest run ages out, if the server told us. */
  nextRunAvailableAt: string | null
}

/**
 * Ask /api/studio/quota how many free runs this address has left.
 *
 * Three rules, all of them load-bearing:
 *   1. It is ADVISORY. The create route runs the same check and is the only
 *      authority. If this lookup is slow, throttled, or dead, the form shows
 *      nothing and stays exactly as usable as it was before this existed.
 *   2. It is debounced and abortable, so typing an address is one request at
 *      the end rather than one per keystroke, and an in-flight answer for a
 *      half-typed address never lands on a finished one.
 *   3. The reading is keyed to the address it was read for. The previous
 *      answer is still in state while a new address is being typed, and
 *      showing one address's count beside another's is worse than silence.
 *
 * Duplicated in app/(formatter)/_components/FinderClient.tsx on purpose: both
 * are client components, the two forms share the allowance, and there is no
 * shared client hook module yet. Change both together.
 */
function useStudioQuota(email: string) {
  const [quota, setQuota] = useState<QuotaStatusPayload | null>(null)
  const [quotaLoading, setQuotaLoading] = useState(false)
  const [refreshCount, setRefreshCount] = useState(0)
  const quotaAbortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    const address = email.trim()
    if (!EMAIL_RE.test(address)) {
      quotaAbortRef.current?.abort()
      quotaAbortRef.current = null
      setQuotaLoading(false)
      return
    }
    setQuotaLoading(true)
    const timer = setTimeout(() => {
      const controller = new AbortController()
      quotaAbortRef.current?.abort()
      quotaAbortRef.current = controller
      void (async () => {
        try {
          const res = await fetch(`/api/studio/quota?email=${encodeURIComponent(address)}`, {
            signal: controller.signal,
          })
          if (controller.signal.aborted) return
          // A 400, 429 or 503 here is not a lockout. We simply say nothing.
          setQuota(res.ok ? ((await res.json()) as QuotaStatusPayload) : null)
        } catch {
          if (controller.signal.aborted) return
          setQuota(null)
        } finally {
          if (!controller.signal.aborted) setQuotaLoading(false)
        }
      })()
    }, QUOTA_DEBOUNCE_MS)
    return () => {
      clearTimeout(timer)
      quotaAbortRef.current?.abort()
    }
  }, [email, refreshCount])

  // Unmount: stop the last request rather than resolving into a dead component.
  useEffect(() => () => quotaAbortRef.current?.abort(), [])

  const refreshQuota = useCallback(() => setRefreshCount((n) => n + 1), [])

  const quotaForEmail = quota && quota.email === normalizeEmail(email) ? quota : null

  return { quota: quotaForEmail, quotaLoading, refreshQuota }
}

/**
 * The runs-remaining line under the email field. Lives inside a reserved box
 * so the form does not jump when the answer arrives a beat after typing.
 *
 * Five states, in this order of precedence:
 *   admin        -- one quiet line, no count, no CTA, nothing to sell.
 *   runs left    -- the count, plus how the allowance refills itself.
 *   in flight    -- nothing spent, the slot releases on its own.
 *   locked, refill available -- BOTH ways out, wait or survey, stated evenly.
 *   locked, refill spent     -- when it comes back, and no ask.
 *
 * Duplicated verbatim in app/(formatter)/_components/FinderClient.tsx apart
 * from the sibling tool's name. Change both together.
 */
/**
 * The free-OSCRSJ badge. Factual, one sentence, no exclamation.
 *
 * Shown in two places on purpose: beside the journal picker, where the choice is
 * made, and in place of the runs-remaining line, where the cost would otherwise
 * be quoted. Leaving the count visible next to a run that costs nothing is the
 * failure mode worth avoiding -- a user reading "1 of 3 free runs left" above a
 * button that will not spend one has been told something false.
 */
function FreeForOscrsjBadge({ className = '' }: { className?: string }) {
  return (
    <p
      className={`rounded-lg border border-fmt-hairline bg-fmt-surface px-3 py-2 text-xs font-medium text-fmt-ink ${className}`}
    >
      Free — formatting and assessment for OSCRSJ never use a run.
    </p>
  )
}

function QuotaNotice({
  quota,
  loading,
  freeRun,
}: {
  quota: QuotaStatusPayload | null
  loading: boolean
  /** True when the selected journal is OSCRSJ, so no run will be spent. */
  freeRun: boolean
}) {
  const nextRun = nextRunLabel(quota?.nextRunAvailableAt)
  // Every state below is a statement about the allowance. None of them is true
  // of a run that does not touch it, so the whole block is replaced rather than
  // appended to.
  if (freeRun) {
    return (
      <div className="mt-3 min-h-[3rem]" aria-live="polite">
        <FreeForOscrsjBadge />
      </div>
    )
  }
  return (
    <div className="mt-3 min-h-[3rem]" aria-live="polite">
      {loading && !quota && (
        <p className="font-fmt-mono text-xs text-fmt-ink-3">Checking your free runs…</p>
      )}

      {/* Admin. No count, no survey, no limit to explain. Anything louder than
          one line is telling the operator about a rule that does not apply to
          them. */}
      {quota && quota.isAdmin && (
        <p className="font-fmt-mono text-xs text-fmt-ink-3">Admin address. No run limit.</p>
      )}

      {quota && !quota.isAdmin && quota.remaining > 0 && (
        <>
          <p className="text-xs font-medium text-fmt-ink">
            {quota.remaining} of {quota.limit} free runs left this {STUDIO_QUOTA_WINDOW_LABEL}.
          </p>
          <p className="mt-1 text-xs text-fmt-ink-2">
            Runs are shared with the Journal Finder. Each one comes back {quota.windowDays} days
            after you use it.
          </p>
        </>
      )}

      {quota && !quota.isAdmin && quota.remaining === 0 && quota.lockedByInFlightOnly && (
        <div className="rounded-lg border border-fmt-hairline bg-fmt-surface px-3 py-2.5">
          <p className="text-xs font-medium text-fmt-ink">
            {quota.inFlightRuns} job{quota.inFlightRuns === 1 ? '' : 's'} still running on this
            address.
          </p>
          <p className="mt-1 text-xs leading-relaxed text-fmt-ink-2">
            Nothing has been used up yet. A job that fails does not count against your runs, and one
            that is abandoned releases its slot on its own. Wait a moment and try again.
          </p>
        </div>
      )}

      {quota && !quota.isAdmin && quota.remaining === 0 && quota.canUnlockWithSurvey && (
        <div className="rounded-lg border border-fmt-hairline bg-[#FBF3E4] px-3 py-2.5">
          <p className="text-xs font-medium text-fmt-ink">
            You have used all {quota.limit} free runs this {STUDIO_QUOTA_WINDOW_LABEL}.
          </p>
          <p className="mt-1 text-xs leading-relaxed text-fmt-ink-2">
            {nextRun
              ? `Your next run comes back on its own ${nextRun} Pacific. `
              : `Each run comes back on its own ${quota.windowDays} days after you use it. `}
            If you would rather not wait, a short survey refills all {quota.limit} now. It works once
            per address, and your answers decide what we fix next.
          </p>
          <Link
            href="/studio/unlock"
            className="mt-2 inline-block text-xs font-medium text-fmt-accent underline hover:text-fmt-accent-deep"
          >
            Refill {quota.limit} runs now
          </Link>
        </div>
      )}

      {quota &&
        !quota.isAdmin &&
        quota.remaining === 0 &&
        !quota.canUnlockWithSurvey &&
        !quota.lockedByInFlightOnly && (
        <div className="rounded-lg border border-fmt-hairline bg-fmt-surface px-3 py-2.5">
          <p className="text-xs font-medium text-fmt-ink">
            {nextRun
              ? `Your next free run opens up ${nextRun} Pacific.`
              : `Your free runs come back ${quota.windowDays} days after you use them.`}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-fmt-ink-2">
            You have used all {quota.limit} runs this {STUDIO_QUOTA_WINDOW_LABEL} and the one survey
            refill this address gets, so waiting is the way back in. Thank you for putting the
            Studio through its paces. It stays free through {STUDIO_FREE_UNTIL_LABEL}, and paid
            plans follow.
          </p>
        </div>
      )}
    </div>
  )
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
                    <td className="px-4 py-2.5 text-fmt-ink-2">{c.before || 'None'}</td>
                    <td className="px-4 py-2.5 text-fmt-ink">{c.after || 'None'}</td>
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
                      <td className="px-4 py-2.5 text-fmt-ink">{r.changed || 'None'}</td>
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
                          'None'
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
                {/* min-w-0 + overflow-wrap:anywhere: long DOIs otherwise
                    overflow the card at 375px (2026-07-22, Part F). */}
                <span className="min-w-0 break-words [overflow-wrap:anywhere]">
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
  // Two boxes, and only the first one gates the run.
  //
  // termsAccepted is required. marketingConsent is optional, and nothing in
  // this component is allowed to make declining it cost anything: consent to
  // marketing has to be freely given and separate from accepting terms, so a
  // box that bundles the two is weaker consent than an unticked box beside it.
  // The reasoning in full is at the top of lib/studio/terms.ts.
  //
  // Neither starts ticked. A pre-ticked box is not a recorded affirmative act,
  // and the whole point of storing a version against the record is being able
  // to say what this person actually agreed to.
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [marketingConsent, setMarketingConsent] = useState(false)

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
  // A spent allowance is not a generic failure and must not read like one, so
  // it carries its own state rather than being flattened into runError.
  const [quotaBlock, setQuotaBlock] = useState<QuotaBlock | null>(null)

  const { quota, quotaLoading, refreshQuota } = useStudioQuota(email)

  const manuscriptInputRef = useRef<HTMLInputElement>(null)
  const figureInputRef = useRef<HTMLInputElement>(null)

  // Poll-loop lifecycle (2026-07-22, Part F): navigating away aborts the loop
  // instead of leaving it fetching against an unmounted component.
  const abortRef = useRef<AbortController | null>(null)
  useEffect(() => () => abortRef.current?.abort(), [])

  // The running-phase copy asks users to keep the tab open — enforce it
  // honestly with a native leave warning while a job is actually running.
  useEffect(() => {
    if (phase !== 'running') return
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [phase])

  const selectedJournal = useMemo(
    () => journals.find((j) => j.slug === journalId) ?? null,
    [journalId],
  )

  // "Format for this journal →" from the Journal Finder pre-selects here.
  // The request is cleared once consumed (2026-07-22, Part F): it is a
  // one-shot navigation payload, and leaving it in sessionStorage silently
  // preselected the OLD journal against a NEW manuscript on any later direct
  // visit. (The format→find handoff stays persistent by design — reload
  // survival on /studio/find is the point there.)
  useEffect(() => {
    return subscribeJournalRequest((req) => {
      setJournalId(req.slug)
      setArticleType(req.articleType)
      setPhase('form')
      clearJournalRequest()
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
  // Locked is only ever asserted from a reading that belongs to THIS address
  // (see useStudioQuota). A failed or missing lookup leaves the form open.
  const quotaLocked = quota?.locked === true
  const canSubmit =
    !!manuscript &&
    !!journalId &&
    !!articleType &&
    emailValid &&
    termsAccepted &&
    !submitting &&
    !quotaLocked

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
    setQuotaBlock(null)

    try {
      // Two independent booleans. The server records each against its own
      // versioned wording, so deriving one from the other would store a
      // marketing consent nobody gave.
      const body: CreateJobRequest & { termsAccepted: boolean } = {
        email,
        journalId,
        articleType,
        figureCount: figures.length,
        figureFilenames: figures.map((f) => f.name),
        manuscriptFilename: manuscript.name,
        termsAccepted,
        marketingConsent,
      }
      const createRes = await fetch('/api/format/jobs', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!createRes.ok) {
        const payload = await readErrorPayload(createRes)
        const code = payload.code
        // 429 + a quota code is a spent allowance, and gets the unlock path.
        // A 503 from the same route means we could not READ the allowance;
        // that is retryable and must never be dressed up as a lockout.
        if (
          createRes.status === 429 &&
          (code === 'quota_exhausted' ||
            code === 'quota_exhausted_final' ||
            code === 'quota_in_flight')
        ) {
          setQuotaBlock({
            code,
            limit: payload.quota?.limit ?? STUDIO_FREE_RUNS,
            nextRunAvailableAt: payload.quota?.nextRunAvailableAt ?? null,
          })
          refreshQuota()
        }
        if (createRes.status === 503) {
          throw new Error(
            payload.message ||
              'We could not check your remaining free runs just now. Please try again in a moment.',
          )
        }
        throw new Error(
          payload.message || 'We could not start your job. Please check your details and try again.',
        )
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

      const controller = new AbortController()
      abortRef.current?.abort()
      abortRef.current = controller

      // Advance the pipeline one stage at a time, polling status after each nudge.
      let statusFailures = 0
      for (let iteration = 0; iteration < 150; iteration++) {
        if (controller.signal.aborted) return
        // Read the advance outcome (2026-07-22, Part F — it was previously
        // discarded): a stage failure surfaces immediately instead of waiting
        // for a status poll to notice.
        const advRes = await fetch(`/api/format/jobs/${job.jobId}/advance`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ email }),
          signal: controller.signal,
        }).catch(() => null)
        if (advRes?.ok) {
          const adv = (await advRes.json().catch(() => null)) as {
            status?: string
            error?: string | null
          } | null
          if (adv?.status === 'failed') {
            setRunError(
              adv.error ||
                'Formatting could not be completed. Please review your manuscript and try again.',
            )
            setPhase('error')
            return
          }
        }

        // Email rides a header, not the query string (Part F — personal data
        // does not belong in URLs, which land in logs and proxies).
        const statusRes = await fetch(`/api/format/jobs/${job.jobId}`, {
          headers: { 'x-job-email': email },
          signal: controller.signal,
        }).catch(() => null)
        if (controller.signal.aborted) return
        if (!statusRes || !statusRes.ok) {
          // Failure honesty (Part F): five consecutive dead polls means the
          // author should not sit watching a frozen percentage for minutes.
          statusFailures++
          if (statusFailures >= 5) {
            setRunError(
              'We lost contact with the server while checking on your job. It may still be processing. Please wait a minute, then reload this page or submit again.',
            )
            setPhase('error')
            return
          }
          await sleep(1500)
          continue
        }
        statusFailures = 0
        const status = (await statusRes.json()) as JobStatusResponse
        setProgress(status.progress)
        setStageLabel(status.stageLabel)

        if (status.status === 'complete') {
          setReport(status.report)
          setDownloads(status.downloads)
          setPhase('complete')
          // The run they just finished is spent. Re-read so the complete screen
          // (and the form behind it) shows the real number rather than the one
          // we fetched before they submitted.
          refreshQuota()
          // Hand the numbers we already know to the Journal Finder, so the
          // author can find fitting journals without retyping. The channel is
          // sessionStorage-backed (per-tab, cleared on tab close) so it
          // survives the navigation to /studio/find.
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
      // An unmount-triggered abort is not an error the (gone) user needs.
      if (abortRef.current?.signal.aborted) return
      setRunError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
      setPhase('error')
    } finally {
      setSubmitting(false)
    }
  }

  function backToForm() {
    setPhase('form')
    setRunError(null)
    setQuotaBlock(null)
  }

  function startOver() {
    setManuscript(null)
    setManuscriptError(null)
    setFigures([])
    setFigureError(null)
    setJournalId('')
    setArticleType('')
    setEmail('')
    // Both cleared deliberately. startOver() also clears the email, so the
    // next run may be a different address and a different person; a box left
    // ticked from the last run is not an affirmative act for the new record,
    // and a stored acceptance is only worth anything if it is one. That goes
    // double for the marketing box, where a carried-over tick would mail
    // somebody who never agreed to be mailed.
    setTermsAccepted(false)
    setMarketingConsent(false)
    setReport(null)
    setDownloads({})
    setProgress(0)
    setDisplayProgress(0)
    setStageLabel('')
    setRunError(null)
    setQuotaBlock(null)
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
    const nextRun = nextRunLabel(quota?.nextRunAvailableAt)
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

        {/* They have their files and just spent their last run. This is the
            moment to ask, and it is an invitation rather than a wall: the run
            they came for already succeeded. */}
        {quota && !quota.isAdmin && quota.remaining === 0 && quota.canUnlockWithSurvey && (
          <div className="rounded-xl border border-fmt-hairline bg-fmt-surface p-6">
            <p className="kicker mb-2">
              That was your last free run this {STUDIO_QUOTA_WINDOW_LABEL}
            </p>
            <p className="text-sm leading-relaxed text-fmt-ink">
              {nextRun
                ? `Your next one comes back on its own ${nextRun} Pacific. `
                : `Runs come back on their own ${quota.windowDays} days after you use them. `}
              If you would rather not wait, tell us how the Studio did and we will refill all{' '}
              {quota.limit} right now. It takes a few minutes, it works once per address, and your
              answers are the only thing steering what we fix next.
            </p>
            <Link href="/studio/unlock" className="btn btn-secondary mt-4 inline-flex">
              Answer the survey and refill {quota.limit} runs
            </Link>
          </div>
        )}

        {quota &&
          !quota.isAdmin &&
          quota.remaining === 0 &&
          !quota.canUnlockWithSurvey &&
          !quota.lockedByInFlightOnly && (
          <div className="rounded-xl border border-fmt-hairline bg-fmt-surface p-6">
            <p className="text-sm leading-relaxed text-fmt-ink">
              That was your last free run this {STUDIO_QUOTA_WINDOW_LABEL}.{' '}
              {nextRun
                ? `The next one opens up ${nextRun} Pacific. `
                : `Each one comes back ${quota.windowDays} days after you use it. `}
              This address has already used its one survey refill, so waiting is the way back in.
              Thank you for putting the Studio through its paces. It stays free through{' '}
              {STUDIO_FREE_UNTIL_LABEL}, and paid plans follow.
            </p>
          </div>
        )}

        <div className="flex flex-wrap gap-3 border-t border-fmt-hairline pt-6">
          <button type="button" onClick={startOver} className="btn btn-primary">
            Format another manuscript
          </button>
        </div>
      </div>
    )
  }

  /* ---- Render: form (also shown behind an error banner) ---- */

  // Two different readings of "when does it come back": one from the refused
  // POST, one from the advisory lookup. They usually agree, and when they do
  // not the one attached to the refusal is the one that just happened.
  const blockNextRun = nextRunLabel(quotaBlock?.nextRunAvailableAt)
  const lockedNextRun = nextRunLabel(quota?.nextRunAvailableAt)

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* A spent allowance is not a failure, so it does not get the red
          failure banner. Everything else, including the retryable 503 from the
          quota read, still does. */}
      {phase === 'error' && quotaBlock && (
        <div role="alert" className="rounded-xl border border-fmt-hairline bg-[#FBF3E4] px-4 py-3">
          <p className="text-sm font-medium text-fmt-ink">
            {quotaBlock.code === 'quota_in_flight'
              ? 'A job on this address is still running.'
              : `You have used all ${quotaBlock.limit} free runs this ${STUDIO_QUOTA_WINDOW_LABEL}.`}
          </p>
          {quotaBlock.code === 'quota_in_flight' ? (
            <p className="mt-1 text-sm leading-relaxed text-fmt-ink-2">
              Nothing has been used up. A job that fails does not count against your runs, and one
              that is abandoned releases its slot on its own. Wait a moment and try again. Nothing
              was uploaded, so your manuscript never left your machine.
            </p>
          ) : quotaBlock.code === 'quota_exhausted' ? (
            <>
              <p className="mt-1 text-sm leading-relaxed text-fmt-ink-2">
                {blockNextRun
                  ? `The next one comes back on its own ${blockNextRun} Pacific. `
                  : `Each one comes back on its own a ${STUDIO_QUOTA_WINDOW_LABEL} after you use it. `}
                A short survey refills all {quotaBlock.limit} now instead. It works once per address.
                Nothing was uploaded, so your manuscript never left your machine.
              </p>
              <Link href="/studio/unlock" className="btn btn-secondary mt-3 inline-flex">
                Refill {quotaBlock.limit} runs now
              </Link>
            </>
          ) : (
            <p className="mt-1 text-sm leading-relaxed text-fmt-ink-2">
              {blockNextRun
                ? `The next one opens up ${blockNextRun} Pacific. `
                : `Each one comes back a ${STUDIO_QUOTA_WINDOW_LABEL} after you use it. `}
              This address has already used its one survey refill. Nothing was uploaded, so your
              manuscript never left your machine.
            </p>
          )}
        </div>
      )}

      {phase === 'error' && !quotaBlock && runError && (
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
            {isFreeJournalRun(journalId) && <FreeForOscrsjBadge className="mt-2" />}
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
          Your results appear right here on this page and your formatted files are not emailed to you. We ask for your
          address to prevent abuse of a free tool: your free runs are counted against it.
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
          <QuotaNotice quota={quota} loading={quotaLoading} freeRun={isFreeJournalRun(journalId)} />
        </div>

        {/* Two boxes. The first is required and gates the run, again
            server-side in /api/format/jobs so a hand-rolled POST cannot slip
            an address in without it. The second is optional and gates nothing.

            They are rendered identically: same weight, same colour, same
            detail treatment, no "recommended", no pre-tick, nothing that reads
            as a nudge. Marketing consent has to be freely given and separate
            from accepting terms, and a design that makes the unticked state
            look like a mistake is the UI version of bundling them.

            Each input is a SIBLING of its label rather than a child, tied by
            htmlFor. That keeps every word of the label a valid click target
            for the box while letting the Terms link inside it be a real link.
            HTML already says a label must not forward activation from an
            interactive descendant, so the anchor is safe by spec; the
            stopPropagation is belt and braces for anything that disagrees.
            target="_blank" is deliberate: the author has a file selected and a
            journal chosen, and a same-tab navigation would throw both away. */}
        <div className="mt-5 rounded-lg border border-fmt-hairline bg-fmt-surface p-4">
          <div className="flex items-start gap-3">
            <input
              id="studio-terms"
              type="checkbox"
              checked={termsAccepted}
              onChange={(e) => setTermsAccepted(e.target.checked)}
              className="mt-0.5 h-4 w-4 flex-shrink-0 cursor-pointer accent-fmt-accent"
            />
            <label
              htmlFor="studio-terms"
              className="cursor-pointer text-sm font-medium leading-snug text-fmt-ink"
            >
              {TERMS_CHECKBOX_BEFORE}
              <Link
                href={STUDIO_TERMS_PATH}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="underline hover:text-fmt-accent-deep"
              >
                {TERMS_CHECKBOX_LINK}
              </Link>
              {TERMS_CHECKBOX_AFTER}
            </label>
          </div>
          <p className="mt-2 pl-7 text-xs leading-relaxed text-fmt-ink-2">{TERMS_CHECKBOX_DETAIL}</p>

          <div className="mt-4 flex items-start gap-3 border-t border-fmt-hairline pt-4">
            <input
              id="studio-marketing"
              type="checkbox"
              checked={marketingConsent}
              onChange={(e) => setMarketingConsent(e.target.checked)}
              className="mt-0.5 h-4 w-4 flex-shrink-0 cursor-pointer accent-fmt-accent"
            />
            <label
              htmlFor="studio-marketing"
              className="cursor-pointer text-sm font-medium leading-snug text-fmt-ink"
            >
              {MARKETING_CHECKBOX_LABEL}
            </label>
          </div>
          <p className="mt-2 pl-7 text-xs leading-relaxed text-fmt-ink-2">
            {MARKETING_CHECKBOX_DETAIL}
          </p>

          <p className="mt-3 pl-7 text-xs text-fmt-ink-2">
            See our{' '}
            <a href="/privacy" className="underline hover:text-fmt-accent" target="_blank" rel="noopener">
              privacy policy
            </a>
            .
          </p>
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
        {quotaLocked && (
          <p className="max-w-md text-center text-xs text-fmt-ink-2">
            {quota?.lockedByInFlightOnly
              ? 'Waiting on a job that is still running. Nothing has been used up, and the slot frees itself once it finishes or fails.'
              : quota?.canUnlockWithSurvey
                ? `No free runs left this ${STUDIO_QUOTA_WINDOW_LABEL}. ${
                    lockedNextRun
                      ? `The next one opens up ${lockedNextRun} Pacific.`
                      : 'They come back on their own.'
                  } The survey linked beside your email address refills all ${quota.limit} now.`
                : lockedNextRun
                  ? `No free runs left this ${STUDIO_QUOTA_WINDOW_LABEL}. The next one opens up ${lockedNextRun} Pacific.`
                  : `No free runs left this ${STUDIO_QUOTA_WINDOW_LABEL}.`}
          </p>
        )}
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
