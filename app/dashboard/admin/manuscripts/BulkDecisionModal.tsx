'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  logBulkDecisionInitiated,
  submitEditorialDecision,
} from '@/lib/admin/actions'
import type {
  EditorialDecisionType,
  ManuscriptStatus,
} from '@/lib/types/database'

// Bulk decision composer. Scoped to a set of manuscriptIds passed in
// by the parent list. Reuses the single-manuscript composer's shape
// (4 radios + letter + conditional deadline) with three simplifications:
//   1. No merge tokens except {{submission_id}} — resolved per-row at
//      submit time. Letter is otherwise sent verbatim.
//   2. No rescind affordance. Each individual decision row is still
//      rescindable for 15 min from the single-manuscript composer.
//   3. No Major-Revisions re-invite checkbox. Too high a risk of
//      mass-reviewer spam; editor does those per-manuscript.

export interface BulkSelectable {
  id: string
  submissionId: string
  title: string
  status: ManuscriptStatus
  correspondingAuthorName: string | null
}

interface Props {
  open: boolean
  selected: BulkSelectable[]
  onClose: () => void
  onFilterToEligible: (eligibleIds: string[]) => void
}

type ComposerDecision =
  | 'accept'
  | 'minor_revisions'
  | 'major_revisions'
  | 'post_review_reject'

const DECIDABLE_STATUSES: ManuscriptStatus[] = [
  'submitted',
  'under_review',
  'revision_received',
]

const DECISION_LABELS: Record<ComposerDecision, string> = {
  accept: 'Accept',
  minor_revisions: 'Minor Revisions',
  major_revisions: 'Major Revisions',
  post_review_reject: 'Reject (post-review)',
}

const DECISION_TARGET_STATUS: Record<ComposerDecision, string> = {
  accept: 'accepted',
  minor_revisions: 'revision_requested',
  major_revisions: 'revision_requested',
  post_review_reject: 'rejected',
}

const MIN_LETTER_LENGTH = 120

function defaultDeadline(): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + 60)
  return d.toISOString().slice(0, 10)
}

function tomorrowIso(): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString().slice(0, 10)
}

function maxDeadlineIso(): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + 180)
  return d.toISOString().slice(0, 10)
}

type RowProgress =
  | { state: 'pending' }
  | { state: 'sending' }
  | { state: 'ok' }
  | { state: 'error'; message: string }

export default function BulkDecisionModal({
  open,
  selected,
  onClose,
  onFilterToEligible,
}: Props) {
  const router = useRouter()
  const [decision, setDecision] = useState<ComposerDecision>('post_review_reject')
  const [letter, setLetter] = useState('')
  const [deadline, setDeadline] = useState(defaultDeadline())
  const [confirmed, setConfirmed] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [progress, setProgress] = useState<Record<string, RowProgress>>({})
  const [runComplete, setRunComplete] = useState(false)

  const eligible = useMemo(
    () => selected.filter((m) => DECIDABLE_STATUSES.includes(m.status)),
    [selected]
  )
  const ineligible = useMemo(
    () => selected.filter((m) => !DECIDABLE_STATUSES.includes(m.status)),
    [selected]
  )

  const hasIneligible = ineligible.length > 0
  const letterLength = letter.trim().length
  const letterValid = letterLength >= MIN_LETTER_LENGTH
  const requiresDeadline =
    decision === 'minor_revisions' || decision === 'major_revisions'
  const canSubmit =
    !hasIneligible &&
    eligible.length > 0 &&
    letterValid &&
    confirmed &&
    (!requiresDeadline || !!deadline) &&
    !isPending &&
    !runComplete

  if (!open) return null

  async function runBatch() {
    if (!canSubmit) return
    const deadlineIso = requiresDeadline
      ? new Date(`${deadline}T23:59:59Z`).toISOString()
      : null

    const initialProgress: Record<string, RowProgress> = {}
    for (const m of eligible) initialProgress[m.id] = { state: 'pending' }
    setProgress(initialProgress)

    startTransition(async () => {
      // Record that the editor initiated a batch BEFORE the per-row
      // loop runs, so the audit trail captures the intent even if
      // the editor navigates away mid-batch. Per-row audit rows are
      // still written by submitEditorialDecision.
      await logBulkDecisionInitiated({
        manuscriptIds: eligible.map((m) => m.id),
        decision,
        letterLength: letterLength,
      })

      // Sequential per-manuscript decision. Avoids Resend rate-limits
      // + avoids any race if two selected manuscripts share a
      // corresponding author.
      const nextProgress: Record<string, RowProgress> = { ...initialProgress }
      for (const m of eligible) {
        nextProgress[m.id] = { state: 'sending' }
        setProgress({ ...nextProgress })
        const resolvedLetter = letter.replace(
          /\{\{submission_id\}\}/g,
          m.submissionId
        )
        try {
          const result = await submitEditorialDecision({
            manuscriptId: m.id,
            decision: decision as EditorialDecisionType,
            decisionLetter: resolvedLetter,
            revisionDeadline: deadlineIso,
          })
          if (result.ok) {
            nextProgress[m.id] = { state: 'ok' }
          } else {
            nextProgress[m.id] = {
              state: 'error',
              message: result.error || 'Unknown error.',
            }
          }
        } catch (err) {
          nextProgress[m.id] = {
            state: 'error',
            message: err instanceof Error ? err.message : 'Unexpected error.',
          }
        }
        setProgress({ ...nextProgress })
      }
      setRunComplete(true)
      router.refresh()
    })
  }

  function handleClose() {
    if (isPending) return
    onClose()
    // Reset internal state for next open.
    setTimeout(() => {
      setDecision('post_review_reject')
      setLetter('')
      setDeadline(defaultDeadline())
      setConfirmed(false)
      setProgress({})
      setRunComplete(false)
    }, 200)
  }

  const successCount = Object.values(progress).filter(
    (p) => p.state === 'ok'
  ).length
  const errorCount = Object.values(progress).filter(
    (p) => p.state === 'error'
  ).length

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-start justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-xl border border-border shadow-lg max-w-3xl w-full my-8 flex flex-col max-h-[calc(100vh-4rem)]">
        <div className="flex items-start justify-between gap-3 p-5 border-b border-border">
          <div>
            <h2 className="font-serif text-xl text-brown-dark">
              Bulk editorial decision
            </h2>
            <p className="text-xs text-brown mt-1">
              {selected.length} manuscript{selected.length === 1 ? '' : 's'}{' '}
              selected. Same decision type + letter sent to each.
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={isPending}
            className="text-brown hover:text-ink text-xl leading-none disabled:opacity-50"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="overflow-y-auto p-5 space-y-5 flex-1">
          {hasIneligible && !runComplete && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm space-y-2">
              <p className="text-red-800">
                <strong>Mixed-status selection.</strong>{' '}
                {ineligible.length} of {selected.length} selected manuscript
                {selected.length === 1 ? '' : 's'} cannot receive a new
                editorial decision in their current status:
              </p>
              <ul className="text-xs text-red-700 list-disc pl-5 space-y-0.5">
                {ineligible.slice(0, 5).map((m) => (
                  <li key={m.id}>
                    {m.submissionId} &mdash;{' '}
                    <code className="font-mono">
                      {m.status.replace(/_/g, ' ')}
                    </code>
                  </li>
                ))}
                {ineligible.length > 5 && (
                  <li className="italic">
                    &hellip; and {ineligible.length - 5} more
                  </li>
                )}
              </ul>
              <button
                type="button"
                onClick={() => onFilterToEligible(eligible.map((m) => m.id))}
                disabled={eligible.length === 0}
                className="text-xs border border-red-300 bg-white text-red-800 px-2 py-1 rounded hover:bg-red-100 disabled:opacity-50"
              >
                Filter selection to the {eligible.length} eligible row
                {eligible.length === 1 ? '' : 's'}
              </button>
            </div>
          )}

          {!runComplete && (
            <fieldset
              disabled={isPending || hasIneligible}
              className="space-y-2"
            >
              <legend className="block text-[11px] uppercase tracking-widest text-brown mb-1">
                Decision type
              </legend>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {(
                  [
                    'accept',
                    'minor_revisions',
                    'major_revisions',
                    'post_review_reject',
                  ] as ComposerDecision[]
                ).map((d) => (
                  <label
                    key={d}
                    className={`flex items-start gap-2 border rounded-lg p-3 cursor-pointer transition-colors ${
                      decision === d
                        ? 'border-brown bg-cream-alt/60'
                        : 'border-border hover:border-tan'
                    }`}
                  >
                    <input
                      type="radio"
                      name="bulk-decision"
                      value={d}
                      checked={decision === d}
                      onChange={() => {
                        setDecision(d)
                        setConfirmed(false)
                      }}
                      className="mt-0.5"
                    />
                    <div>
                      <p className="text-sm text-ink font-medium">
                        {DECISION_LABELS[d]}
                      </p>
                      <p className="text-[11px] text-brown">
                        Status → {DECISION_TARGET_STATUS[d].replace(/_/g, ' ')}
                      </p>
                    </div>
                  </label>
                ))}
              </div>
              <p className="text-[11px] text-brown italic">
                Desk reject is not available in bulk mode &mdash; desk-reject
                sweeps still go through the per-manuscript composer so each
                manuscript&rsquo;s specific reason can be recorded.
              </p>
            </fieldset>
          )}

          {!runComplete && requiresDeadline && (
            <div>
              <label className="block text-[11px] uppercase tracking-widest text-brown mb-1">
                Revision deadline (applies to every manuscript)
              </label>
              <input
                type="date"
                value={deadline}
                min={tomorrowIso()}
                max={maxDeadlineIso()}
                onChange={(e) => setDeadline(e.target.value)}
                disabled={isPending || hasIneligible}
                className="border border-border rounded-lg px-3 py-1.5 text-sm text-ink bg-white focus:outline-none focus:ring-2 focus:ring-peach-dark/50 focus:border-peach-dark disabled:opacity-50"
              />
            </div>
          )}

          {!runComplete && (
            <div>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-900 mb-2">
                <strong>Letter is sent verbatim to every manuscript.</strong>{' '}
                If you want each author to see their own submission ID, use{' '}
                <code className="font-mono">{'{{submission_id}}'}</code>{' '}
                anywhere in the letter &mdash; it is the only merge token
                supported in bulk mode and is resolved per-manuscript at send
                time.
              </div>
              <label className="block text-[11px] uppercase tracking-widest text-brown mb-1">
                Decision letter (markdown / plain text)
              </label>
              <textarea
                value={letter}
                onChange={(e) => {
                  setLetter(e.target.value)
                  setConfirmed(false)
                }}
                disabled={isPending || hasIneligible}
                rows={12}
                className="w-full border border-border rounded-lg px-3 py-2 font-mono text-sm text-ink bg-white focus:outline-none focus:ring-2 focus:ring-peach-dark/50 focus:border-peach-dark disabled:opacity-50"
              />
              <p
                className={`text-[11px] mt-1 ${
                  letterValid ? 'text-brown' : 'text-amber-700'
                }`}
              >
                {letterLength} characters &middot; minimum {MIN_LETTER_LENGTH}
              </p>
            </div>
          )}

          {!runComplete && !hasIneligible && (
            <label className="flex items-start gap-2 text-sm text-ink">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
                disabled={isPending || !letterValid}
                className="mt-0.5"
              />
              <span>
                I have reviewed this letter. Submitting will issue a separate
                decision + email for each of the {eligible.length} eligible
                manuscript{eligible.length === 1 ? '' : 's'}. Successful
                decisions cannot be undone as a batch &mdash; each can be
                rescinded individually within 15 minutes from its manuscript
                detail page.
              </span>
            </label>
          )}

          {(isPending || runComplete) && (
            <div className="border border-border rounded-lg bg-cream-alt/40">
              <div className="px-3 py-2 border-b border-border flex items-center justify-between text-xs text-brown">
                <span className="uppercase tracking-widest">
                  Per-manuscript progress
                </span>
                <span>
                  {successCount} succeeded &middot; {errorCount} failed
                  {runComplete ? '' : ' \u2026'}
                </span>
              </div>
              <ul className="divide-y divide-border">
                {eligible.map((m) => {
                  const p = progress[m.id] || { state: 'pending' }
                  return (
                    <li
                      key={m.id}
                      className="flex items-start justify-between gap-3 px-3 py-2 text-sm"
                    >
                      <div className="min-w-0">
                        <p className="text-ink">
                          <span className="font-mono text-xs text-brown mr-2">
                            {m.submissionId}
                          </span>
                          <span className="truncate">
                            {m.title || '(untitled)'}
                          </span>
                        </p>
                        {p.state === 'error' && (
                          <p className="text-xs text-red-700 mt-0.5">
                            {p.message}
                          </p>
                        )}
                      </div>
                      <span className="text-xs whitespace-nowrap">
                        {p.state === 'pending' && (
                          <span className="text-brown">Waiting&hellip;</span>
                        )}
                        {p.state === 'sending' && (
                          <span className="text-amber-700">Sending&hellip;</span>
                        )}
                        {p.state === 'ok' && (
                          <span className="text-green-700">✓ Sent</span>
                        )}
                        {p.state === 'error' && (
                          <span className="text-red-700">✗ Failed</span>
                        )}
                      </span>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 p-5 border-t border-border">
          {!runComplete ? (
            <>
              <button
                type="button"
                onClick={handleClose}
                disabled={isPending}
                className="text-sm px-3 py-1.5 rounded-lg border border-border text-brown hover:bg-cream-alt disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={runBatch}
                disabled={!canSubmit}
                className="text-sm px-4 py-2 rounded-lg border border-brown bg-peach-dark text-ink hover:bg-peach disabled:opacity-40 disabled:cursor-not-allowed font-medium"
              >
                {isPending
                  ? 'Sending\u2026'
                  : `Issue ${eligible.length} decision${
                      eligible.length === 1 ? '' : 's'
                    }`}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={handleClose}
              className="text-sm px-4 py-2 rounded-lg border border-brown bg-peach-dark text-ink hover:bg-peach font-medium"
            >
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
