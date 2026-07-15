'use client'

import { useState, useTransition } from 'react'
import {
  getPublishedAssetSignedUrl,
  type PublishedAssetKind,
} from '@/lib/admin/actions'

interface Props {
  manuscriptId: string
  which: PublishedAssetKind
  label?: string
}

export default function PublishedAssetDownloadButton({
  manuscriptId,
  which,
  label,
}: Props) {
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const fallbackLabel = which === 'pdf' ? 'Download PDF' : 'Download report'

  function handleClick() {
    setError(null)
    startTransition(async () => {
      const result = await getPublishedAssetSignedUrl(manuscriptId, which)
      if (result.error || !result.signedUrl) {
        setError(result.error || 'Failed to generate download link.')
        return
      }
      window.location.href = result.signedUrl
    })
  }

  return (
    <div className="flex flex-col items-start">
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className="text-xs text-brown hover:text-ink underline underline-offset-2 disabled:opacity-50"
      >
        {isPending ? 'Preparing…' : label || fallbackLabel}
      </button>
      {error && (
        <p className="text-[11px] text-red-700 max-w-[220px] mt-0.5">{error}</p>
      )}
    </div>
  )
}
