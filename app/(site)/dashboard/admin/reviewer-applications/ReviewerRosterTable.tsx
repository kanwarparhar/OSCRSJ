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

function counterPair(entry: ReviewerRosterEntry): {
  primary: string
  secondary: string
} {
  if (entry.bucket === 'applicant') {
    return { primary: '—', secondary: 'never invited' }
  }
  if (entry.bucket === 'active') {
    return {
      primary: `${entry.reviewsSubmitted}/${entry.invitationsAccepted} reviews`,
      secondary: `${entry.invitationsSent} invited`,
    }
  }
  if (entry.bucket === 'approved') {
    return {
      primary: `0/${entry.invitationsAccepted} reviews`,
      secondary: `${entry.invitationsSent} invited`,
    }
  }
  if (entry.bucket === 'pending') {
    return {
      primary: `${entry.invitationsSent} invited`,
      secondary: 'awaiting reply',
    }
  }
  if (entry.bucket === 'declined') {
    return {
      primary: `${entry.invitationsDeclined} declined`,
      secondary: `${entry.invitationsSent} invited`,
    }
  }
  if (entry.bucket === 'withdrawn') {
    return {
      primary: 'withdrawn',
      secondary: `${entry.invitationsSent} invited`,
    }
  }
  return {
    primary: `${entry.invitationsSent} invited`,
    secondary: '',
  }
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
    <div className="bg-white border border-border rounded-xl overflow-hidden">
      {/* Column header — only at md+ since the row layout collapses on mobile */}
      <div className="hidden md:grid grid-cols-[7rem_minmax(0,1fr)_11rem_7rem_auto] gap-3 px-4 py-2 border-b border-border bg-cream-alt/50 text-[10px] uppercase tracking-widest text-brown">
        <div>Bucket</div>
        <div>Reviewer</div>
        <div>Stats</div>
        <div>Last invited</div>
        <div className="text-right pr-1">Actions</div>
      </div>
      <ul className="divide-y divide-border">
        {roster.map((r) => (
          <li key={r.email}>
            <RosterRow entry={r} activeTab={activeTab} />
          </li>
        ))}
      </ul>
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
  const counters = counterPair(entry)

  // Show buttons only when relevant. Applicants tab rows have no
  // resend / withdraw affordances (handled by the application
  // triage component).
  const canResend =
    !!entry.resendableInvitationId && activeTab !== 'applicants'
  const canMarkWithdrawn =
    entry.bucket !== 'withdrawn' && entry.bucket !== 'applicant'
  const canUnmark = entry.bucket === 'withdrawn'

  return (
    <div className="px-4 py-3 hover:bg-cream-alt/30 transition-colors">
      <div className="md:grid md:grid-cols-[7rem_minmax(0,1fr)_11rem_7rem_auto] md:gap-3 md:items-center flex flex-col gap-2">
        {/* Bucket */}
        <div>
          <span
            className={`inline-block text-[10px] uppercase tracking-widest font-semibold px-2 py-0.5 rounded-full border ${BUCKET_PILL_STYLES[entry.bucket]}`}
          >
            {BUCKET_LABELS[entry.bucket]}
          </span>
        </div>

        {/* Name + email */}
        <div className="min-w-0">
          <p className="text-sm font-medium text-brown-dark truncate">
            {fullName}
          </p>
          <p className="text-xs text-brown truncate">{entry.email}</p>
        </div>

        {/* Stats */}
        <div className="text-xs">
          <p className="text-ink">{counters.primary}</p>
          {counters.secondary && (
            <p className="text-brown">{counters.secondary}</p>
          )}
        </div>

        {/* Last invited */}
        <div className="text-xs text-brown">
          {formatRelative(entry.latestInvitationDate)}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5 md:justify-end flex-wrap">
          {canResend && (
            <button
              type="button"
              onClick={onResend}
              disabled={isPending}
              title="Resend invitation email for the most recent pending invitation"
              className="text-[11px] px-2 py-1 border border-border rounded-md text-ink bg-white hover:border-tan disabled:opacity-50 whitespace-nowrap"
            >
              Resend
            </button>
          )}
          {canMarkWithdrawn && (
            <button
              type="button"
              onClick={() => setShowWithdrawBox((v) => !v)}
              disabled={isPending}
              title="Mark this reviewer withdrawn from the pool"
              className="text-[11px] px-2 py-1 border border-amber-200 rounded-md text-amber-900 bg-amber-50 hover:bg-amber-100 disabled:opacity-50 whitespace-nowrap"
            >
              {showWithdrawBox ? 'Cancel' : 'Withdraw'}
            </button>
          )}
          {canUnmark && (
            <button
              type="button"
              onClick={onUnmarkWithdrawn}
              disabled={isPending}
              className="text-[11px] px-2 py-1 border border-border rounded-md text-ink bg-white hover:border-tan disabled:opacity-50 whitespace-nowrap"
            >
              Clear withdrawal
            </button>
          )}
        </div>
      </div>

      {entry.bucket === 'withdrawn' && entry.withdrawnReason && (
        <p className="text-[11px] text-brown italic mt-1.5 md:ml-[7.75rem]">
          Reason: {entry.withdrawnReason}
        </p>
      )}

      {showWithdrawBox && (
        <div className="mt-3 border-t border-border pt-3 space-y-2 md:ml-[7.75rem]">
          <label className="block text-[10px] uppercase tracking-widest text-brown">
            Reason (optional, internal-only)
          </label>
          <textarea
            value={withdrawReason}
            onChange={(e) => setWithdrawReason(e.target.value)}
            rows={2}
            maxLength={1000}
            placeholder="e.g. Reviewer emailed asking to be removed from the pool"
            className="w-full border border-border rounded-md px-2 py-1.5 text-xs text-ink bg-white focus:outline-none focus:ring-2 focus:ring-peach-dark/50 focus:border-peach-dark"
          />
          <button
            type="button"
            onClick={onMarkWithdrawn}
            disabled={isPending}
            className="text-[11px] px-2 py-1 border border-amber-200 rounded-md text-amber-900 bg-amber-50 hover:bg-amber-100 disabled:opacity-50"
          >
            Confirm withdraw
          </button>
        </div>
      )}

      {message && (
        <p
          className={`text-[11px] mt-1.5 md:ml-[7.75rem] ${isError ? 'text-red-700' : 'text-green-700'}`}
        >
          {message}
        </p>
      )}
    </div>
  )
}
