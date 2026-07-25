'use client'

// Journal Finder v1 UI (Sushant, Session 2). Manual 7-field form (primary path)
// OR an auto-fill banner when arriving from a just-completed format job, then a
// bucketed scorecard: per-journal fit chip, exact constraint deltas, metadata
// line, guidelines link, and a "Format for this journal →" button that pre-loads
// the journal in the Formatter above — the loop that makes the two tools one.
//
// Scoring happens server-side (deterministic, stateless) at /api/finder/match.
// Re-sorting reuses the pure client-safe sortScores() so changing the secondary
// sort never re-hits the endpoint (and never burns a rate-limit slot).

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ARTICLE_TYPE_LABELS } from '@/lib/formatting/registry-meta'
import type { ArticleType } from '@/lib/formatting/rulesSchema'
import { describeCheck, sortScores } from '@/lib/finder/match'
import {
  SCOPE_TAGS,
  SCOPE_TAG_LABELS,
  type Bucket,
  type ConstraintCheck,
  type FinderResult,
  type JournalScore,
  type ManuscriptStats,
  type ScopeTag,
  type SortKey,
} from '@/lib/finder/types'
import type { FinderMatchRequest } from '@/lib/finder/api'
import { subscribeFormatHandoff, requestFormatJournal } from '@/lib/finder/handoff'

/* ------------------------------------------------------------------ */
/*  Static bits                                                         */
/* ------------------------------------------------------------------ */

const ARTICLE_TYPE_OPTIONS = Object.entries(ARTICLE_TYPE_LABELS) as [ArticleType, string][]

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'fit', label: 'Best fit' },
  { value: 'indexing', label: 'Indexing' },
  { value: 'review_speed', label: 'Review speed' },
  { value: 'apc_asc', label: 'APC (low → high)' },
]

const BUCKET_META: Record<Exclude<Bucket, 'not_eligible'>, { label: string; blurb: string; chip: string }> = {
  fits: {
    label: 'Fits',
    blurb: 'Every stated limit is satisfied.',
    chip: 'bg-[#E8F5EE] text-fmt-ok border-transparent',
  },
  near_fit: {
    label: 'Near fit',
    blurb: 'Within 10% on one or two limits. A light trim gets you there.',
    chip: 'bg-[#FBF3E4] text-fmt-warn border-transparent',
  },
  needs_work: {
    label: 'Needs work',
    blurb: 'Over one or more limits. See the exact deltas.',
    chip: 'bg-[#FBEAE9] text-fmt-bad border-transparent',
  },
}

const CHECK_COLOR: Record<ConstraintCheck['status'], string> = {
  fit: 'text-fmt-ok',
  near: 'text-fmt-warn',
  over: 'text-fmt-bad',
}

/** Neutral chip: eligible, but no stated limit was actually verified. */
const NEUTRAL_CHIP = 'border-fmt-hairline bg-fmt-surface text-fmt-ink-2'

/**
 * A green "Fits" chip must mean at least one real constraint was verified.
 * A journal that publishes no limits for the numbers the author gave lands in
 * the 'fits' bucket by default (nothing there to fail) — that is eligibility,
 * not fit, and it gets a neutral chip instead.
 */
function bucketChip(score: JournalScore): { label: string; chip: string } | null {
  if (score.bucket === 'not_eligible') return null
  if (score.bucket === 'fits' && score.checkedCount === 0) {
    return { label: 'Eligible, limits not stated', chip: NEUTRAL_CHIP }
  }
  const bm = BUCKET_META[score.bucket]
  return { label: bm.label, chip: bm.chip }
}

/** How much of this journal's verdict is evidence rather than silence. */
function checkLine(score: JournalScore): string {
  if (score.suppliedCount === 0) {
    return 'You did not give any numbers, so nothing was checked against this journal.'
  }
  if (score.checkedCount === 0) {
    return 'This journal does not publish limits for the numbers you gave. Check its Guide for Authors.'
  }
  return `Checked ${score.checkedCount} of ${score.suppliedCount} of your numbers.`
}

/* ------------------------------------------------------------------ */
/*  Form field helpers                                                  */
/* ------------------------------------------------------------------ */

interface FormState {
  articleType: ArticleType | ''
  wordCount: string
  abstractWordCount: string
  figureCount: string
  tableCount: string
  referenceCount: string
  subspecialty: ScopeTag | null
}

const EMPTY_FORM: FormState = {
  articleType: '',
  wordCount: '',
  abstractWordCount: '',
  figureCount: '',
  tableCount: '',
  referenceCount: '',
  subspecialty: null,
}

function numOrNull(v: string): number | null {
  const t = v.trim()
  if (t === '') return null
  const n = Number(t)
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : null
}

function apcLabel(apc: number | null, oa: string | null): string {
  if (apc === 0) return 'No APC'
  if (apc === null) return oa === 'subscription' ? 'Subscription' : '—'
  return `APC $${apc.toLocaleString('en-US')}`
}

/* ------------------------------------------------------------------ */
/*  Result card                                                         */
/* ------------------------------------------------------------------ */

function ResultCard({ score, onFormat }: { score: JournalScore; onFormat: (s: JournalScore) => void }) {
  const bm = bucketChip(score)
  const m = score.meta
  const metaBits = [
    m.indexing.length ? m.indexing.join(' · ') : '—',
    m.oa_model === 'oa' ? 'Open access' : m.oa_model === 'hybrid' ? 'Hybrid' : m.oa_model === 'subscription' ? 'Subscription' : '—',
    apcLabel(m.apc_usd, m.oa_model),
    m.review_speed ?? '—',
  ]

  return (
    <div className="rounded-xl border border-fmt-hairline bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        {/* flex-1 so a long journal name shrinks this column instead of forcing
            the action button to wrap, where justify-between left-aligns it and
            it no longer lines up with the other cards. Franklin, 2026-07-25. */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="font-fmt-display text-lg text-fmt-ink">{score.name}</h4>
            {bm && (
              <span className={`inline-block rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${bm.chip}`}>
                {bm.label}
              </span>
            )}
            {score.isSelf && (
              <span className="inline-block rounded-full border border-fmt-hairline bg-fmt-surface px-2.5 py-0.5 text-[11px] font-medium text-fmt-ink-2">
                Published by us
              </span>
            )}
            {score.scopeMatch && (
              <span className="inline-block rounded-full border border-fmt-hairline bg-fmt-surface px-2.5 py-0.5 text-[11px] font-medium text-fmt-ink-2">
                Scope match
              </span>
            )}
            {score.scopeMismatch && (
              <span className="inline-block rounded-full border border-transparent bg-[#FBF3E4] px-2.5 py-0.5 text-[11px] font-medium text-fmt-warn">
                Outside stated scope
              </span>
            )}
          </div>
          {score.publisher && <p className="mt-0.5 text-xs text-fmt-ink-3">{score.publisher}</p>}
        </div>
        {score.eligible && (
          <button
            type="button"
            onClick={() => onFormat(score)}
            className="btn btn-secondary flex-shrink-0 text-sm"
          >
            Format for this journal →
          </button>
        )}
      </div>

      {/* Constraint deltas */}
      {score.checks.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 font-fmt-mono text-xs">
          {score.checks.map((c) => (
            <span key={c.key} className={CHECK_COLOR[c.status]}>
              <span className="text-fmt-ink-3">{c.label}:</span> {describeCheck(c)}
            </span>
          ))}
        </div>
      )}

      {/* How much of the verdict above is actually evidence. */}
      {score.eligible && (
        <p className="mt-2 font-fmt-mono text-xs text-fmt-ink-3">{checkLine(score)}</p>
      )}

      {score.explanation && <p className="mt-3 text-sm italic text-fmt-ink-2">{score.explanation}</p>}

      {/* Metadata + guidelines */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-fmt-hairline pt-3">
        <p className="font-fmt-mono text-[11px] text-fmt-ink-3">{metaBits.join('  ·  ')}</p>
        <a
          href={score.guidelinesUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="font-fmt-mono text-[11px] text-fmt-ink-2 underline hover:text-fmt-accent-deep"
        >
          Guide for Authors ↗
        </a>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Main component                                                      */
/* ------------------------------------------------------------------ */

type Phase = 'form' | 'loading' | 'results' | 'error'

export default function FinderClient() {
  const router = useRouter()
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [sortBy, setSortBy] = useState<SortKey>('fit')
  const [phase, setPhase] = useState<Phase>('form')
  const [result, setResult] = useState<FinderResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [handoffFilename, setHandoffFilename] = useState<string | null>(null)

  // Auto-fill from a completed format job (in-memory handoff — never the URL).
  useEffect(() => {
    return subscribeFormatHandoff((h) => {
      setForm((prev) => ({
        ...prev,
        articleType: h.articleType ?? prev.articleType,
        figureCount: h.figureCount != null ? String(h.figureCount) : prev.figureCount,
        referenceCount: h.referenceCount != null ? String(h.referenceCount) : prev.referenceCount,
      }))
      setHandoffFilename(h.filename)
    })
  }, [])

  const set = useCallback(<K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }))
  }, [])

  const canSubmit = form.articleType !== '' && phase !== 'loading'

  async function runMatch(e?: React.FormEvent) {
    e?.preventDefault()
    if (form.articleType === '') return
    setPhase('loading')
    setError(null)

    const stats: ManuscriptStats = {
      articleType: form.articleType,
      wordCount: numOrNull(form.wordCount),
      abstractWordCount: numOrNull(form.abstractWordCount),
      figureCount: numOrNull(form.figureCount),
      tableCount: numOrNull(form.tableCount),
      referenceCount: numOrNull(form.referenceCount),
      subspecialty: form.subspecialty,
    }
    const payload: FinderMatchRequest = { stats, sortBy }

    try {
      const res = await fetch('/api/finder/match', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null
        throw new Error(data?.error || 'The Journal Finder is unavailable right now. Please try again.')
      }
      setResult((await res.json()) as FinderResult)
      setPhase('results')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
      setPhase('error')
    }
  }

  // Re-sorting is client-side over the already-scored list — no re-fetch.
  const sortedResults = useMemo(() => {
    if (!result) return null
    return { ...result, results: sortScores(result.results, sortBy) }
  }, [result, sortBy])

  function handleFormatFor(score: JournalScore) {
    if (form.articleType === '') return
    // Session 95: the Formatter is its own route now, so this publishes the
    // request (sessionStorage-backed, so it survives the navigation) and routes
    // there, instead of scrolling to a #app section that no longer exists on
    // this page.
    requestFormatJournal({ slug: score.slug, articleType: form.articleType })
    router.push('/studio/format')
  }

  /* ---- render: results ---- */
  if ((phase === 'results' || (phase === 'loading' && result)) && sortedResults) {
    const eligible = sortedResults.results.filter((r) => r.bucket !== 'not_eligible')
    const ineligible = sortedResults.results.filter((r) => r.bucket === 'not_eligible')
    const c = sortedResults.counts
    // A re-submit keeps the previous scorecard on screen while loading
    // (2026-07-22, Part F): dim it and say so, so old numbers never read as
    // the answer to the new query.
    const updating = phase === 'loading'

    return (
      <div
        aria-busy={updating}
        className={`space-y-6${updating ? ' pointer-events-none opacity-50 transition-opacity' : ''}`}
      >
        {updating && (
          <p
            role="status"
            className="rounded-xl border border-fmt-hairline bg-fmt-surface px-4 py-3 text-sm font-medium text-fmt-ink"
          >
            Updating results for your new numbers…
          </p>
        )}
        {/* Summary + controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-fmt-hairline bg-fmt-surface p-4">
          <p className="text-sm text-fmt-ink">
            <strong>{c.fits}</strong> fit · <strong>{c.near_fit}</strong> near fit ·{' '}
            <strong>{c.needs_work}</strong> need work · <strong>{c.not_eligible}</strong> not eligible
          </p>
          <div className="flex items-center gap-2">
            <label htmlFor="finder-sort" className="text-xs text-fmt-ink-2">
              Sort
            </label>
            <select
              id="finder-sort"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortKey)}
              className="rounded-lg border border-fmt-hairline bg-white px-3 py-1.5 text-sm text-fmt-ink focus:border-fmt-accent focus:outline-none focus:ring-2 focus:ring-fmt-accent/40"
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <button type="button" onClick={() => setPhase('form')} className="btn btn-secondary text-sm">
              Edit numbers
            </button>
          </div>
        </div>

        {/* Sparse input: numbers left blank that journals do publish limits for. */}
        {(sortedResults.uncheckedStats?.length ?? 0) > 0 && (
          <div className="rounded-xl border border-fmt-hairline bg-fmt-surface p-4">
            <p className="mb-1.5 text-sm font-medium text-fmt-ink">Some checks were skipped</p>
            <ul className="space-y-1 text-sm text-fmt-ink-2">
              {sortedResults.uncheckedStats?.map((u) => (
                <li key={u.stat}>
                  You left {u.label} blank.{' '}
                  {u.journalsWithLimit === 1
                    ? '1 eligible journal states a limit'
                    : `${u.journalsWithLimit} eligible journals state a limit`}{' '}
                  we could not check.
                </li>
              ))}
            </ul>
          </div>
        )}

        {eligible.length === 0 && (
          <p className="rounded-xl border border-fmt-hairline bg-white p-5 text-sm text-fmt-ink-2">
            No journal in the registry accepts this article type. Try a different type, or check the eligibility list
            below.
          </p>
        )}

        {eligible.map((s) => (
          <ResultCard key={s.slug} score={s} onFormat={handleFormatFor} />
        ))}

        {/* OSCRSJ disclosure */}
        <p className="text-xs italic leading-relaxed text-fmt-ink-3">
          OSCRSJ builds this tool and appears in results only when your manuscript genuinely fits our scope and limits.
          We are scored identically to every other journal, with no boost.
        </p>

        {/* Not eligible (collapsed) */}
        {ineligible.length > 0 && (
          <details className="rounded-xl border border-fmt-hairline bg-white">
            <summary className="cursor-pointer px-5 py-3 text-sm font-medium text-fmt-ink-2">
              Not eligible for this article type ({ineligible.length})
            </summary>
            <ul className="divide-y divide-fmt-hairline border-t border-fmt-hairline">
              {ineligible.map((s) => (
                <li key={s.slug} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm">
                  <span className="text-fmt-ink">{s.name}</span>
                  <span className="text-xs text-fmt-ink-3">{s.ineligibleReason}</span>
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>
    )
  }

  /* ---- render: form ---- */
  return (
    <form onSubmit={runMatch} className="space-y-6">
      {phase === 'error' && error && (
        <div role="alert" className="rounded-xl border border-[#F0C7C4] bg-[#FBEAE9] px-4 py-3 text-sm text-fmt-bad">
          {error}
        </div>
      )}

      {handoffFilename && (
        <div className="flex items-start gap-3 rounded-xl border border-[#CDE9D8] bg-[#E8F5EE] px-4 py-3 text-sm text-fmt-ink">
          <span aria-hidden="true" className="mt-0.5 font-bold text-fmt-ok">
            ↑
          </span>
          <p>
            Using the numbers from <strong>{handoffFilename}</strong>. Edit any of them below. Add your word, abstract,
            and table counts for the most accurate match.
          </p>
        </div>
      )}

      <div className="rounded-xl border border-fmt-hairline bg-white p-6">
        <h3 className="mb-1 font-fmt-display text-xl text-fmt-ink">Describe your manuscript</h3>
        <p className="mb-5 text-sm text-fmt-ink-2">
          Only the article type is required. The more numbers you add, the sharper the fit. Leave any you do not
          know blank and we will skip that check, and say so in the results.
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label htmlFor="f-type" className="mb-1 block text-sm font-medium text-fmt-ink">
              Article type <span className="text-fmt-bad">*</span>
            </label>
            <select
              id="f-type"
              value={form.articleType}
              onChange={(e) => set('articleType', e.target.value as ArticleType)}
              className="w-full rounded-lg border border-fmt-hairline bg-white px-4 py-2.5 text-sm text-fmt-ink focus:border-fmt-accent focus:outline-none focus:ring-2 focus:ring-fmt-accent/40"
            >
              <option value="">Select an article type…</option>
              {ARTICLE_TYPE_OPTIONS.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          {(
            [
              ['wordCount', 'Manuscript word count'],
              ['abstractWordCount', 'Abstract word count'],
              ['referenceCount', 'References'],
              ['figureCount', 'Figures'],
              ['tableCount', 'Tables'],
            ] as [keyof FormState, string][]
          ).map(([key, label]) => (
            <div key={key}>
              <label htmlFor={`f-${key}`} className="mb-1 block text-sm font-medium text-fmt-ink">
                {label} <span className="font-normal text-fmt-ink-3">(optional)</span>
              </label>
              <input
                id={`f-${key}`}
                type="number"
                min={0}
                inputMode="numeric"
                value={form[key] as string}
                onChange={(e) => set(key, e.target.value as FormState[typeof key])}
                placeholder="—"
                className="w-full rounded-lg border border-fmt-hairline bg-white px-4 py-2.5 text-sm text-fmt-ink placeholder:text-fmt-ink-3 focus:border-fmt-accent focus:outline-none focus:ring-2 focus:ring-fmt-accent/40"
              />
            </div>
          ))}
        </div>

        {/* Subspecialty chips */}
        <div className="mt-5">
          <p className="mb-2 text-sm font-medium text-fmt-ink">
            Subspecialty <span className="font-normal text-fmt-ink-3">(optional, sharpens ordering)</span>
          </p>
          <div className="flex flex-wrap gap-2">
            {SCOPE_TAGS.map((tag) => {
              const active = form.subspecialty === tag
              return (
                <button
                  key={tag}
                  type="button"
                  aria-pressed={active}
                  onClick={() => set('subspecialty', active ? null : tag)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                    active
                      ? 'border-fmt-accent bg-fmt-accent/10 text-fmt-accent-deep'
                      : 'border-fmt-hairline bg-white text-fmt-ink-2 hover:border-fmt-ink-3'
                  }`}
                >
                  {SCOPE_TAG_LABELS[tag]}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      <div className="flex flex-col items-center gap-3">
        <button
          type="submit"
          disabled={!canSubmit}
          className="btn btn-primary inline-flex w-full items-center justify-center gap-2 sm:w-auto sm:min-w-[240px] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {phase === 'loading' ? 'Finding journals…' : 'Find journals that fit'}
        </button>
        <p className="max-w-md text-center text-xs text-fmt-ink-2">
          The Finder checks your numbers against each journal&apos;s published limits. It never reads or stores your
          manuscript text. Always confirm against the journal&apos;s current Guide for Authors.
        </p>
      </div>
    </form>
  )
}
