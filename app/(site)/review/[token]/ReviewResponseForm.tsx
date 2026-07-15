'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  acceptReviewInvitation,
  declineReviewInvitation,
} from '@/lib/reviewer/actions'

interface Props {
  token: string
  prefilled: 'accept' | 'decline' | null
  reviewerName: string
}

export default function ReviewResponseForm({
  token,
  prefilled,
  reviewerName,
}: Props) {
  const router = useRouter()
  const [choice, setChoice] = useState<'accept' | 'decline' | null>(prefilled)
  const [reason, setReason] = useState('')
  const [altName, setAltName] = useState('')
  const [altEmail, setAltEmail] = useState('')
  const [altReason, setAltReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function onConfirm() {
    setError(null)
    if (choice === 'accept') {
      startTransition(async () => {
        const result = await acceptReviewInvitation(token)
        if (result.error) {
          setError(result.error)
          return
        }
        router.replace(`/review/${token}?status=accepted`)
      })
    } else if (choice === 'decline') {
      startTransition(async () => {
        const result = await declineReviewInvitation(
          token,
          reason || null,
          altName || altEmail || altReason
            ? {
                name: altName || null,
                email: altEmail || null,
                reason: altReason || null,
              }
            : null
        )
        if (result.error) {
          setError(result.error)
          return
        }
        router.replace(`/review/${token}?status=declined`)
      })
    }
  }

  if (!choice) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-ink">
          {reviewerName}, please confirm whether you are able to review this
          manuscript.
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            onClick={() => setChoice('accept')}
            className="px-4 py-2.5 rounded-lg border border-brown bg-peach-dark text-ink font-medium hover:bg-peach transition-colors"
          >
            Accept invitation
          </button>
          <button
            type="button"
            onClick={() => setChoice('decline')}
            className="px-4 py-2.5 rounded-lg border border-border bg-white text-ink hover:border-tan transition-colors"
          >
            Decline invitation
          </button>
        </div>
      </div>
    )
  }

  const isAccept = choice === 'accept'

  return (
    <div className="space-y-3 border border-border rounded-lg p-4 bg-cream-alt/30">
      <p className="text-sm text-ink">
        {isAccept
          ? `You are about to accept this invitation. The editorial office will be notified and will follow up with the full manuscript and the structured review form.`
          : `You are about to decline this invitation. The editorial office will be notified and will invite another reviewer.`}
      </p>

      {!isAccept && (
        <>
          <div>
            <label
              htmlFor="decline-reason"
              className="block text-[11px] uppercase tracking-widest text-brown mb-1"
            >
              Reason (optional)
            </label>
            <textarea
              id="decline-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              maxLength={500}
              placeholder="Let the editor know why, e.g. conflict of interest, outside your subspecialty, travel."
              className="w-full border border-border rounded-lg px-3 py-2 text-sm text-ink bg-white focus:outline-none focus:ring-2 focus:ring-peach-dark/50 focus:border-peach-dark"
            />
            <p className="text-[11px] text-brown mt-1">{reason.length}/500</p>
          </div>

          <div className="border-t border-border pt-3 space-y-3">
            <div>
              <p className="text-[11px] uppercase tracking-widest text-brown">
                Suggest an alternative reviewer (optional)
              </p>
              <p className="text-xs text-brown mt-1">
                Their email is shared only with the OSCRSJ editorial office,
                never with the manuscript authors. Suggestions are advisory —
                the editor decides whether to invite.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="alt-name"
                  className="block text-[11px] uppercase tracking-widest text-brown mb-1"
                >
                  Name
                </label>
                <input
                  id="alt-name"
                  type="text"
                  value={altName}
                  onChange={(e) => setAltName(e.target.value)}
                  maxLength={200}
                  placeholder="Dr. Jane Smith"
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm text-ink bg-white focus:outline-none focus:ring-2 focus:ring-peach-dark/50 focus:border-peach-dark"
                />
              </div>
              <div>
                <label
                  htmlFor="alt-email"
                  className="block text-[11px] uppercase tracking-widest text-brown mb-1"
                >
                  Email
                </label>
                <input
                  id="alt-email"
                  type="email"
                  value={altEmail}
                  onChange={(e) => setAltEmail(e.target.value)}
                  maxLength={254}
                  placeholder="jane.smith@institution.edu"
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm text-ink bg-white focus:outline-none focus:ring-2 focus:ring-peach-dark/50 focus:border-peach-dark"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="alt-reason"
                className="block text-[11px] uppercase tracking-widest text-brown mb-1"
              >
                Why this person (optional)
              </label>
              <textarea
                id="alt-reason"
                value={altReason}
                onChange={(e) => setAltReason(e.target.value)}
                rows={2}
                maxLength={500}
                placeholder="e.g. published a meta-analysis on this exact topic last year."
                className="w-full border border-border rounded-lg px-3 py-2 text-sm text-ink bg-white focus:outline-none focus:ring-2 focus:ring-peach-dark/50 focus:border-peach-dark"
              />
              <p className="text-[11px] text-brown mt-1">
                {altReason.length}/500
              </p>
            </div>
          </div>
        </>
      )}

      <div className="flex flex-col sm:flex-row gap-3">
        <button
          type="button"
          onClick={onConfirm}
          disabled={isPending}
          className="px-4 py-2.5 rounded-lg border border-brown bg-peach-dark text-ink font-medium hover:bg-peach disabled:opacity-50 transition-colors"
        >
          {isPending
            ? 'Submitting…'
            : isAccept
              ? 'Confirm acceptance'
              : 'Confirm decline'}
        </button>
        <button
          type="button"
          onClick={() => {
            setChoice(null)
            setReason('')
            setAltName('')
            setAltEmail('')
            setAltReason('')
            setError(null)
          }}
          disabled={isPending}
          className="px-4 py-2.5 rounded-lg border border-border bg-white text-ink hover:border-tan disabled:opacity-50 transition-colors"
        >
          Go back
        </button>
      </div>

      {error && <p className="text-sm text-red-700">{error}</p>}
    </div>
  )
}
