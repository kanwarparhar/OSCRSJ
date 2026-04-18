'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { withdrawManuscript } from '@/lib/submission/actions'

interface WithdrawButtonProps {
  manuscriptId: string
  submissionId: string | null
  title: string | null
}

export default function WithdrawButton({
  manuscriptId,
  submissionId,
  title,
}: WithdrawButtonProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function close() {
    if (pending) return
    setOpen(false)
    setReason('')
    setError(null)
    setSuccess(null)
  }

  function submit() {
    setError(null)
    setSuccess(null)
    startTransition(async () => {
      const result = await withdrawManuscript({
        manuscriptId,
        reason: reason.trim() || null,
      })
      if ('error' in result && result.error) {
        setError(result.error)
        return
      }
      setSuccess(
        'Withdrawal confirmed. A confirmation email is on its way.'
      )
      router.refresh()
      setTimeout(() => {
        setOpen(false)
        setReason('')
        setSuccess(null)
      }, 1800)
    })
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-red-700 hover:underline text-xs font-medium"
      >
        Withdraw
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="withdraw-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-dark/50 backdrop-blur-sm p-4"
          onClick={close}
        >
          <div
            className="bg-white rounded-xl shadow-xl max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h2
              id="withdraw-title"
              className="font-serif text-xl text-brown-dark mb-2"
            >
              Withdraw submission?
            </h2>
            <p className="text-sm text-tan mb-4">
              You are about to withdraw{' '}
              <span className="font-medium text-brown-dark">
                {submissionId || 'this manuscript'}
              </span>
              {title ? <> &mdash; &ldquo;{title}&rdquo;</> : null}. This
              cannot be undone. Any active reviewer invitations will be
              cancelled automatically.
            </p>

            <label className="block text-sm text-brown-dark mb-1">
              Reason (optional)
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={500}
              rows={3}
              disabled={pending}
              placeholder="A short note to the editorial office. Not shown publicly."
              className="w-full border border-border rounded-md px-3 py-2 text-sm text-brown-dark placeholder-tan/70 focus:outline-none focus:ring-2 focus:ring-peach-dark mb-1"
            />
            <p className="text-xs text-tan mb-4">{reason.length}/500</p>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-800 text-sm rounded-md px-3 py-2 mb-4">
                {error}
              </div>
            )}
            {success && (
              <div className="bg-green-50 border border-green-200 text-green-800 text-sm rounded-md px-3 py-2 mb-4">
                {success}
              </div>
            )}

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={close}
                disabled={pending}
                className="btn-ghost text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={pending || !!success}
                className="inline-flex items-center px-4 py-2 rounded-md bg-red-700 text-white text-sm font-medium hover:bg-red-800 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {pending ? 'Withdrawing…' : 'Confirm withdrawal'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
