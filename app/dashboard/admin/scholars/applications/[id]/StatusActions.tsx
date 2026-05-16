'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  updateCohortApplicationStatus,
  type CohortApplicationStatus,
} from '@/lib/scholars/actions'

const STATUS_OPTIONS: Array<{
  value: CohortApplicationStatus
  label: string
  buttonClass: string
}> = [
  {
    value: 'under_review',
    label: 'Mark under review',
    buttonClass: 'bg-blue-600 hover:bg-blue-700 text-white',
  },
  {
    value: 'accepted',
    label: 'Accept',
    buttonClass: 'bg-green-700 hover:bg-green-800 text-white',
  },
  {
    value: 'waitlisted',
    label: 'Waitlist',
    buttonClass: 'bg-purple-600 hover:bg-purple-700 text-white',
  },
  {
    value: 'rejected',
    label: 'Reject',
    buttonClass: 'bg-gray-700 hover:bg-gray-800 text-white',
  },
  {
    value: 'withdrawn',
    label: 'Withdraw',
    buttonClass: 'bg-neutral-500 hover:bg-neutral-600 text-white',
  },
]

const STATUS_LABEL: Record<CohortApplicationStatus, string> = {
  submitted: 'Submitted',
  under_review: 'Under review',
  accepted: 'Accepted',
  waitlisted: 'Waitlisted',
  rejected: 'Rejected',
  withdrawn: 'Withdrawn',
}

interface Props {
  applicationId: string
  currentStatus: CohortApplicationStatus
  currentNotes: string
}

export default function StatusActions({
  applicationId,
  currentStatus,
  currentNotes,
}: Props) {
  const [notes, setNotes] = useState(currentNotes)
  const [message, setMessage] = useState<string | null>(null)
  const [isError, setIsError] = useState(false)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function showMessage(text: string, err = false) {
    setMessage(text)
    setIsError(err)
    setTimeout(() => setMessage(null), 3500)
  }

  function onTransition(newStatus: CohortApplicationStatus) {
    if (newStatus === currentStatus) {
      // No-op transition — still save notes if changed
      const notesChanged = notes !== currentNotes
      if (!notesChanged) {
        showMessage(`Already ${STATUS_LABEL[newStatus]}.`, true)
        return
      }
    }

    startTransition(async () => {
      const result = await updateCohortApplicationStatus({
        applicationId,
        newStatus,
        adminNotes: notes !== currentNotes ? notes : undefined,
      })
      if (result.error) {
        showMessage(result.error, true)
      } else {
        showMessage(`Status → ${STATUS_LABEL[newStatus]}`)
        router.refresh()
      }
    })
  }

  function onSaveNotes() {
    if (notes === currentNotes) {
      showMessage('No changes to save.', true)
      return
    }
    startTransition(async () => {
      const result = await updateCohortApplicationStatus({
        applicationId,
        newStatus: currentStatus,
        adminNotes: notes,
      })
      if (result.error) {
        showMessage(result.error, true)
      } else {
        showMessage('Notes saved.')
        router.refresh()
      }
    })
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs uppercase tracking-wider text-brown font-medium mb-1">
          Current status
        </p>
        <p className="text-sm font-medium text-ink">
          {STATUS_LABEL[currentStatus]}
        </p>
      </div>

      <div className="space-y-2">
        {STATUS_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            disabled={isPending || opt.value === currentStatus}
            onClick={() => onTransition(opt.value)}
            className={`w-full text-sm font-medium px-3 py-2 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${opt.buttonClass}`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <div>
        <label
          htmlFor="adminNotes"
          className="block text-xs uppercase tracking-wider text-brown font-medium mb-1"
        >
          Admin notes
        </label>
        <textarea
          id="adminNotes"
          rows={4}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Internal notes — not visible to applicant."
          className="w-full border border-border rounded-lg px-3 py-2 text-sm text-ink bg-white placeholder:text-brown/70 focus:outline-none focus:ring-2 focus:ring-peach-dark/50 focus:border-peach-dark transition-colors"
        />
        <button
          type="button"
          disabled={isPending || notes === currentNotes}
          onClick={onSaveNotes}
          className="mt-2 w-full text-sm font-medium px-3 py-2 rounded-lg bg-brown-dark text-peach hover:bg-brown transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Save notes
        </button>
      </div>

      {message && (
        <div
          className={`text-xs px-3 py-2 rounded-lg ${
            isError
              ? 'bg-red-50 border border-red-200 text-red-700'
              : 'bg-green-50 border border-green-200 text-green-700'
          }`}
        >
          {message}
        </div>
      )}
    </div>
  )
}
