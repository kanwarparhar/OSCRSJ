'use client'

import { useState, useTransition } from 'react'
import {
  publishGoLive,
  unpublishManuscript,
} from '@/lib/admin/actions'
import type { ManuscriptStatus } from '@/lib/types/database'

interface Props {
  manuscriptId: string
  status: ManuscriptStatus
  hasArtifacts: boolean
  submissionId: string
}

// Client-side action surface for PublishPipelinePanel. Go-live +
// emergency-unpublish, gated by manuscript status + artifact presence.
// The render/re-render entry point lives in the metadata editor's §5
// Validation Summary (Session 85 consolidation) — this panel only
// handles the go-live gate once artifacts exist.

export default function PublishPipelineActions({
  manuscriptId,
  status,
  hasArtifacts,
  submissionId,
}: Props) {
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [confirmGoLive, setConfirmGoLive] = useState(false)
  const [showUnpublish, setShowUnpublish] = useState(false)
  const [unpublishReason, setUnpublishReason] = useState('')
  const [unpublishFilenameConfirm, setUnpublishFilenameConfirm] = useState('')
  const [isPending, startTransition] = useTransition()

  function handleGoLive() {
    setError(null)
    setInfo(null)
    startTransition(async () => {
      const result = await publishGoLive(manuscriptId)
      if (result.error || !result.ok) {
        setError(result.error || 'Publish failed.')
        return
      }
      setConfirmGoLive(false)
      setInfo('Article is now live on /articles.')
    })
  }

  function handleUnpublish() {
    setError(null)
    setInfo(null)
    if (unpublishFilenameConfirm.trim() !== submissionId) {
      setError(
        `Type the submission ID exactly to confirm: ${submissionId}`
      )
      return
    }
    startTransition(async () => {
      const result = await unpublishManuscript(manuscriptId, unpublishReason)
      if (result.error || !result.ok) {
        setError(result.error || 'Unpublish failed.')
        return
      }
      setShowUnpublish(false)
      setUnpublishReason('')
      setUnpublishFilenameConfirm('')
      setInfo('Article unpublished. Status reverted to accepted.')
    })
  }

  const isAccepted = status === 'accepted'
  const isPublished = status === 'published'

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3 items-center">
        {isAccepted && hasArtifacts && !confirmGoLive && (
          <button
            type="button"
            onClick={() => setConfirmGoLive(true)}
            disabled={isPending}
            className="rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-medium px-3 py-2 disabled:opacity-50"
          >
            Publish (go live) →
          </button>
        )}

        {isPublished && !showUnpublish && (
          <button
            type="button"
            onClick={() => setShowUnpublish(true)}
            disabled={isPending}
            className="rounded-lg border border-red-300 bg-white text-red-700 hover:bg-red-50 text-xs font-medium px-3 py-2 disabled:opacity-50"
          >
            Unpublish (emergency)
          </button>
        )}
      </div>

      {confirmGoLive && (
        <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-4 space-y-3">
          <p className="text-sm text-emerald-900">
            <strong>Confirm publish.</strong> The article will appear on{' '}
            <code>/articles</code> and{' '}
            <code>/articles/in-press</code>. Has the author signed off on
            the rendered PDF proof?
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleGoLive}
              disabled={isPending}
              className="rounded bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-medium px-3 py-2 disabled:opacity-50"
            >
              {isPending ? 'Publishing…' : 'Yes, publish now'}
            </button>
            <button
              type="button"
              onClick={() => setConfirmGoLive(false)}
              disabled={isPending}
              className="rounded border border-emerald-300 bg-white text-emerald-800 text-xs font-medium px-3 py-2"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {showUnpublish && (
        <div className="rounded-lg border border-red-300 bg-red-50 p-4 space-y-3">
          <p className="text-sm text-red-900">
            <strong>Emergency unpublish.</strong> Removes the article from{' '}
            <code>/articles</code>. Storage artifacts remain intact. Use only
            when a retraction notice is being prepared.
          </p>
          <div>
            <label className="block text-[11px] uppercase tracking-widest text-red-900 font-medium mb-1">
              Reason for retraction (logged in audit_logs, ≥10 chars)
            </label>
            <textarea
              value={unpublishReason}
              onChange={(e) => setUnpublishReason(e.target.value)}
              rows={3}
              className="w-full rounded border border-red-300 bg-white px-2 py-1 text-sm text-ink"
              placeholder="e.g., Author identified critical typo in patient consent footnote; retracting pending corrected resubmission."
            />
          </div>
          <div>
            <label className="block text-[11px] uppercase tracking-widest text-red-900 font-medium mb-1">
              Type the submission ID to confirm:{' '}
              <code className="font-mono">{submissionId}</code>
            </label>
            <input
              type="text"
              value={unpublishFilenameConfirm}
              onChange={(e) => setUnpublishFilenameConfirm(e.target.value)}
              className="w-full rounded border border-red-300 bg-white px-2 py-1 text-sm font-mono text-ink"
              placeholder={submissionId}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleUnpublish}
              disabled={isPending}
              className="rounded bg-red-700 hover:bg-red-800 text-white text-xs font-medium px-3 py-2 disabled:opacity-50"
            >
              {isPending ? 'Unpublishing…' : 'Confirm unpublish'}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowUnpublish(false)
                setUnpublishReason('')
                setUnpublishFilenameConfirm('')
              }}
              disabled={isPending}
              className="rounded border border-red-300 bg-white text-red-800 text-xs font-medium px-3 py-2"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {info && (
        <p className="text-xs text-emerald-700 leading-relaxed">{info}</p>
      )}
      {error && (
        <p className="text-xs text-red-700 leading-relaxed">{error}</p>
      )}
    </div>
  )
}
