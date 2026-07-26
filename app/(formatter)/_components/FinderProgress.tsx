'use client'

// Finder v2 — the waiting screen.
//
// WHY THIS IS NOT A PERCENTAGE. The assessment is four steps of very different
// and unpredictable lengths (the DeepSeek read dominates and varies with
// manuscript size), so a single "68%" would be a number we made up. Instead the
// bar fills to the START of whatever step the SERVER says is running, and then
// creeps across that step's own span on a decaying curve that never reaches the
// next step's boundary. Every completed segment behind the marker is a fact the
// server reported; the creep inside the current segment is explicitly a
// time-elapsed animation, not a claim about remaining work.
//
// Job status → step comes from the status column the API already returns:
//   uploaded → parsed → extracted → verified → complete
// A failed stage write (they are best-effort, see assessJob.setStage) only means
// the bar sits at the previous step's boundary and keeps creeping. It never
// stalls the UI and it never goes backwards.

import { useEffect, useRef, useState } from 'react'
import { FINDER_STAGES, FINDER_V2, type FinderStageKey } from '../_copy'

/** Where each step's segment starts, as a fraction of the bar. */
const SEGMENT_START: Record<FinderStageKey, number> = {
  uploaded: 0,
  parsed: 0.12,
  extracted: 0.3,
  verified: 0.86,
}
const SEGMENT_END: Record<FinderStageKey, number> = {
  uploaded: 0.12,
  parsed: 0.3,
  extracted: 0.86,
  verified: 0.98,
}

/** Seconds after which we stop implying this is normal and say so. */
const SLOW_AFTER_SECONDS = 90

/**
 * Asymptotic fill inside the current segment: fast at first, never arriving.
 * `halfLife` is how many seconds it takes to cover half the remaining span, so
 * the bar always moves and never lies about being nearly done.
 */
function creep(secondsInStage: number, halfLife: number): number {
  return 1 - Math.pow(0.5, secondsInStage / halfLife)
}

const HALF_LIFE_SECONDS: Record<FinderStageKey, number> = {
  uploaded: 4,
  parsed: 5,
  extracted: 22,
  verified: 4,
}

function StepRow({
  label,
  detail,
  state,
}: {
  label: string
  detail: string
  state: 'done' | 'active' | 'pending'
}) {
  return (
    <li className="flex items-start gap-3">
      <span
        aria-hidden="true"
        className={`mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border text-[10px] font-bold ${
          state === 'done'
            ? 'border-transparent bg-fmt-ok text-white'
            : state === 'active'
              ? 'border-fmt-accent bg-fmt-accent-wash text-fmt-accent-deep'
              : 'border-fmt-hairline bg-fmt-surface text-fmt-ink-3'
        }`}
      >
        {state === 'done' ? (
          '✓'
        ) : state === 'active' ? (
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-fmt-accent-deep" />
        ) : (
          ''
        )}
      </span>
      <span className="min-w-0">
        <span
          className={`block text-sm ${
            state === 'pending' ? 'text-fmt-ink-3' : state === 'active' ? 'font-medium text-fmt-ink' : 'text-fmt-ink-2'
          }`}
        >
          {label}
        </span>
        {state === 'active' && <span className="mt-0.5 block text-xs leading-relaxed text-fmt-ink-3">{detail}</span>}
      </span>
    </li>
  )
}

export default function FinderProgress({ status }: { status: FinderStageKey | string }) {
  // Highest step reached. Monotonic on purpose: a stale poll must never walk the
  // bar backwards, which reads as failure even when nothing went wrong.
  const [stepIndex, setStepIndex] = useState(0)
  const [seconds, setSeconds] = useState(0)
  const stageStartedAt = useRef(0)

  useEffect(() => {
    const i = FINDER_STAGES.findIndex((s) => s.key === status)
    if (i > -1) {
      setStepIndex((prev) => {
        if (i > prev) stageStartedAt.current = Date.now()
        return Math.max(prev, i)
      })
    }
  }, [status])

  useEffect(() => {
    if (stageStartedAt.current === 0) stageStartedAt.current = Date.now()
    const started = Date.now()
    const t = setInterval(() => setSeconds(Math.round((Date.now() - started) / 1000)), 1000)
    return () => clearInterval(t)
  }, [])

  const stage = FINDER_STAGES[stepIndex]
  const inStage = (Date.now() - (stageStartedAt.current || Date.now())) / 1000
  const start = SEGMENT_START[stage.key]
  const end = SEGMENT_END[stage.key]
  const pct = Math.round((start + (end - start) * creep(inStage, HALF_LIFE_SECONDS[stage.key])) * 100)

  return (
    <div className="rounded-xl border border-fmt-hairline bg-white p-6 sm:p-8" aria-busy="true">
      <h3 className="font-fmt-display text-xl text-fmt-ink">{FINDER_V2.waitTitle}</h3>

      {/* Live region announces the step, not the meaningless percentage. */}
      <p role="status" className="sr-only">
        {stage.label}
      </p>

      <div
        className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-fmt-surface"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        aria-label={stage.label}
      >
        <div
          className="h-full rounded-full bg-fmt-accent transition-[width] duration-1000 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="mt-2 flex items-baseline justify-between">
        <p className="font-fmt-mono text-[11px] text-fmt-ink-3">
          Step {stepIndex + 1} of {FINDER_STAGES.length}
        </p>
        <p className="font-fmt-mono text-[11px] tabular-nums text-fmt-ink-3">
          {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')} elapsed
        </p>
      </div>

      <ul className="mt-5 space-y-3">
        {FINDER_STAGES.map((s, i) => (
          <StepRow
            key={s.key}
            label={s.label}
            detail={s.detail}
            state={i < stepIndex ? 'done' : i === stepIndex ? 'active' : 'pending'}
          />
        ))}
      </ul>

      <p className="mt-5 border-t border-fmt-hairline pt-4 text-xs leading-relaxed text-fmt-ink-3">
        {FINDER_V2.waitSub}
      </p>
      {seconds > SLOW_AFTER_SECONDS && (
        <p className="mt-2 rounded-lg border border-[#F0DFC0] bg-[#FBF3E4] px-3 py-2 text-xs text-fmt-ink">
          {FINDER_V2.waitSlowNote}
        </p>
      )}
    </div>
  )
}
