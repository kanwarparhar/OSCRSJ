'use client'

import { useState, useTransition } from 'react'
import { getReviewerFileSignedUrl } from '@/lib/reviewer/actions'

interface Props {
  token: string
  fileId: string
}

export default function ReviewerFileDownloadButton({ token, fileId }: Props) {
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleClick() {
    setError(null)
    startTransition(async () => {
      const result = await getReviewerFileSignedUrl(token, fileId)
      if (result.error || !result.signedUrl) {
        setError(result.error || 'Failed to generate download link.')
        return
      }
      window.location.href = result.signedUrl
    })
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className="px-4 py-2 rounded-lg border border-brown bg-peach-dark text-ink text-sm font-medium hover:bg-peach disabled:opacity-50 transition-colors"
      >
        {isPending ? 'Preparing…' : 'Download'}
      </button>
      {error && (
        <p className="text-xs text-red-700 max-w-[200px] text-right">
          {error}
        </p>
      )}
    </div>
  )
}
