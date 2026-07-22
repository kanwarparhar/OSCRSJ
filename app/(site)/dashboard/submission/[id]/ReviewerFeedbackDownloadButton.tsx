'use client'

import { useState, useTransition } from 'react'
import { getReviewerFeedbackSignedUrl } from '@/lib/submission/actions'

interface Props {
  decisionId: string
  fileName?: string | null
}

export default function ReviewerFeedbackDownloadButton({ decisionId }: Props) {
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleClick() {
    setError(null)
    startTransition(async () => {
      const result = await getReviewerFeedbackSignedUrl(decisionId)
      if (result.error || !result.signedUrl) {
        setError(result.error || 'Failed to generate download link.')
        return
      }
      window.location.href = result.signedUrl
    })
  }

  return (
    <div className="flex flex-col items-end shrink-0">
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className="inline-flex items-center gap-1.5 rounded-lg border border-brown bg-peach-dark px-3.5 py-2 text-xs font-medium text-ink hover:bg-peach disabled:opacity-50"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" />
        </svg>
        {isPending ? 'Preparing…' : 'Download feedback'}
      </button>
      {error && (
        <p className="text-[11px] text-red-700 max-w-[200px] text-right mt-0.5">
          {error}
        </p>
      )}
    </div>
  )
}
