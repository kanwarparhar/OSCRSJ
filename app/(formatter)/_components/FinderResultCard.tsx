'use client'

// Finder v2 — the v1 eligibility scorecard, LIFTED VERBATIM out of FinderClient.
//
// This is Session 97's honest-chip work (a green "Fits" requires that something
// was actually checked; a journal that publishes no relevant limit gets a
// neutral chip instead) and Session 100's flex-1 layout fix. v2 keeps it exactly
// as-is behind the "all eligible journals" expander: the ladder answers "where
// should this go", this answers "what would I have to change". Lifted rather
// than rewritten so neither behaviour drifts from what those sessions verified.

import { describeCheck } from '@/lib/finder/match'
import type { Bucket, ConstraintCheck, JournalScore } from '@/lib/finder/types'

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

export default ResultCard
