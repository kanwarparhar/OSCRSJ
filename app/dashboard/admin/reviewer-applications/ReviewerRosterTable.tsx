'use client'

import { useState, useTransition } from 'react'
import {
  resendLatestPendingInvitation,
  markReviewerWithdrawn,
  type ReviewerRosterEntry,
  type ReviewerRosterBucket,
} from '@/lib/reviewer/actions'

interface Props {
  roster: ReviewerRosterEntry[]
  activeTab: RosterTab
  emptyMessage: string
}

export type RosterTab =
  | 'all'
  | 'applicants'
  | 'pending'
  | 'approved'
  | 'active'
  | 'declined'

const BUCKET_PILL_STYLES: Record<ReviewerRosterBucket, string> = {
  applicant: 'bg-amber-100 text-amber-800 border-amber-200',
  pending: 'bg-amber-100 text-amber-800 border-amber-200',
  approved: 'bg-blue-100 text-blue-800 border-blue-200',
  active: 'bg-green-100 text-green-800 border-green-200',
  declined: 'bg-gray-200 text-gray-700 border-gray-300',
  withdrawn: 'bg-neutral-100 text-neutral-700 border-neutral-300',
}

const BUCKET_LABELS: Record<ReviewerRosterBucket, string> = {
  applicant: 'Applicant',
  pending: 'Pending',
  approved: 'Approved',
  active: 'Active',
  declined: 'Declined',
  withdrawn: 'Withdrawn',
}

function formatRelative(iso: string | null): string {
  if (!iso) return '—'
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return '—'
  const now = Date.now()
  const diffMs = now - then
  const mins = Math.floor(diffMs / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months}mo ago`
  return `${Math.floor(months / 12)}y ago`
}

export default function ReviewerRosterTable({
  roster,
  activeTab,
  emptyMessage,
}: Props) {
  if (roster.length === 0) {
    return (
      <div className="bg-white border border-border rounded-xl p-8 text-center text-sm text-brown">
        {emptyMessage}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {roster.map((r) => (
        <RosterRow key={r.email} entry={r} activeTab={activeTab} />
      ))}
    </div>
  )
}

function RosterRow({
  entry,
  activeTab,
}: {
  entry: ReviewerRosterEntry
  activeTab: RosterTab
}) {
  const [message, setMessage] = useState<string | null>(null)
  const [isError, setIsError] = useState(false)
  const [showWithdrawBox, setShowWithdrawBox] = useState(false)
  const [withdrawReason, setWithdrawReason] = useState('')
  const [isPending, startTransition] = useTransition()

  function flash(text: string, err = false) {
    setMessage(text)
    setIsError(err)
    setTimeout(() => setMessage(null), 4000)
  }

  function onResend() {
    if (!entry.resendableInvitationId) return
    startTransition(async () => {
      const result = await resendLatestPendingInvitation(
        entry.resendableInvitationId!
      )
      if (result.error) flash(result.error, true)
      else flash('Invitation email re-sent.')
    })
  }

  function onMarkWithdrawn() {
    startTransition(async () => {
      const result = await markReviewerWithdrawn({
        email: entry.email,
        reason: withdrawReason.trim() || null,
      })
      if (result.error) flash(result.error, true)
      else {
        flash('Marked withdrawn.')
        setShowWithdrawBox(false)
        setWithdrawReason('')
      }
    })
  }

  function onUnmarkWithdrawn() {
    startTransition(async () => {
      const result = await markReviewerWithdrawn({
        email: entry.email,
        unmark: true,
      })
      if (result.error) flash(result.error, true)
      else flash('Withdrawal cleared.')
    })
  }

  const fullName = `${entry.firstName} ${entry.lastName}`.trim() || entry.email
  const reviewedTotal = entry.reviewsSubmitted
  const acceptedTotal = entry.invitationsAccepted

  // Counters string varies by bucket so the metric is meaningful.
  let countersLine: string
  if (entry.bucket === 'applicant') {
    countersLine = 'Applied — never invited yet'
  } else if (entry.bucket === 'active') {
    countersLine = `${reviewedTotal}/${acceptedTotal} reviews completed · ${entry.invitationsSent} total invited`
  } else if (entry.bucket === 'approved') {
    countersLine = `${acceptedTotal} accepted · 0/${acceptedTotal} reviews completed · ${entry.invitationsSent} total invited`
  } else if (entry.bucket === 'pending') {
    countersLine = `${entry.invitationsSent} invited · awaiting response`
  } else if (entry.bucket === 'declined') {
    countersLine = `${entry.invitationsSent} invited · ${entry.invitationsDeclined} declined`
  } else if (entry.bucket === 'withdrawn') {
    countersLine = `${entry.invitationsSent} invited · withdrawn from reviewing`
  } else {
    countersLine = `${entry.invitationsSent} invited`
  }

  return (
    <div className="bg-white border border-border rounded-xl p-5 hover:border-tan transition-colors">
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`text-[11px] uppercase tracking-widest font-semibold px-2 py-0.5 rounded-full border ${BUCKET_PILL_STYLES[entry.bucket]}`}
            >
              {BUCKET_LABELS[entry.bucket]}
            </span>
            <span className="text-xs text-brown">
              Last invited: {formatRelative(entry.latestInvitationDate)}
            </span>
          </div>
          <p className="font-serif text-lg text-brown-dark truncate">
            {fullName}
          </p>
          <p className="text-xs text-brown break-all">
            {entry.email}
            {entry.affiliation ? ` · ${entry.affiliation}` : ''}
            {entry.country ? ` · ${entry.country}` : ''}
          </p>
          <p className="text-xs text-ink mt-1">{countersLine}</p>
          {entry.bucket === 'withdrawn' && entry.withdrawnReason && (
            <p className="text-xs text-brown italic mt-1">
              Reason: {entry.withdrawnReason}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2 sm:flex-row lg:flex-col lg:items-end flex-shrink-0">
          {entry.resendableInvitationId &&
          activeTab !== 'applicants' && (
            <button
              type="button"
              onClick={onResend}
              disabled={isPending}
              className="text-xs px-3 py-1.5 border border-border rounded-lg text-ink bg-white hover:border-tan disabled:opacity-50 whitespace-nowrap"
            >
              Resend invitation
            </button>
          )}
          {entry.bucket !== 'withdrawn' && entry.bucket !== 'applicant' && (
            <button
              type="button"
              onClick={() => setShowWithdrawBox((v) => !v)}
              disabled={isPending}
              className="text-xs px-3 py-1.5 border border-amber-200 rounded-lg text-amber-900 bg-amber-50 hover:bg-amber-100 disabled:opacity-50 whitespace-nowrap"
            >
              {showWithdrawBox ? 'Cancel' : 'Mark withdrawn'}
            </button>
          )}
          {entry.bucket === 'withdrawn' && (
            <button
              type="button"
              onClick={onUnmarkWithdrawn}
              disabled={isPending}
              className="text-xs px-3 py-1.5 border border-border rounded-lg text-ink bg-white hover:border-tan disabled:opacity-50 whitespace-nowrap"
            >
              Clear withdrawal
            </button>
          )}
        </div>
      </div>

      {showWithdrawBox && (
        <div className="mt-4 border-t border-border pt-4 space-y-2">
          <label className="block text-[11px] uppercase tracking-widest text-brown">
            Reason (optional, internal-only)
          </label>
          <textarea
            value={withdrawReason}
            onChange={(e) => setWithdrawReason(e.target.value)}
            rows={2}
            maxLength={1000}
            placeholder="e.g. Reviewer emailed asking to be removed from the pool"
            className="w-full border border-border rounded-lg px-3 py-2 text-sm text-ink bg-white focus:outline-none focus:ring-2 focus:ring-peach-dark/50 focus:border-peach-dark"
          />
          <button
            type="button"
            onClick={onMarkWithdrawn}
            disabled={isPending}
            className="text-xs px-3 py-1.5 border border-amber-200 rounded-lg text-amber-900 bg-amber-50 hover:bg-amber-100 disabled:opacity-50"
          >
            Confirm withdraw
          </button>
        </div>
      )}

      {message && (
        <p
          className={`text-xs mt-3 ${isError ? 'text-red-700' : 'text-green-700'}`}
        >
          {message}
        </p>
      )}
    </div>
  )
}
