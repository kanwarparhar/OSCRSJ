'use client'

import { useState, useTransition } from 'react'
import { getAdminFileSignedUrl } from '@/lib/admin/actions'

interface Props {
  fileId: string
}

export default function AdminFileDownloadButton({ fileId }: Props) {
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleClick() {
    setError(null)
    startTransition(async () => {
      const result = await getAdminFileSignedUrl(fileId)
      if (result.error || !result.signedUrl) {
        setError(result.error || 'Failed to generate download link.')
        return
      }
      window.location.href = result.signedUrl
    })
  }

  return (
    <div className="flex flex-col items-end">
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className="text-xs text-brown hover:text-ink underline underline-offset-2 disabled:opacity-50"
      >
        {isPending ? 'Preparing…' : 'Download'}
      </button>
      {error && (
        <p className="text-[11px] text-red-700 max-w-[180px] text-right mt-0.5">
          {error}
        </p>
      )}
    </div>
  )
}
