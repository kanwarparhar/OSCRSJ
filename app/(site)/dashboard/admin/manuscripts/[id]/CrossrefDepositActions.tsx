'use client'

import { useState, useTransition } from 'react'
import { depositToCrossref } from '@/lib/admin/actions'
import type { ManuscriptStatus } from '@/lib/types/database'

interface Props {
  manuscriptId: string
  status: ManuscriptStatus
  doi: string | null
  configured: boolean
  hasDeposit: boolean
  depositStatus: string | null
}

export default function CrossrefDepositActions({
  manuscriptId,
  status,
  doi,
  configured,
  hasDeposit,
  depositStatus,
}: Props) {
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [confirmRedeposit, setConfirmRedeposit] = useState(false)
  const [isPending, startTransition] = useTransition()

  const canDeposit = status === 'published' && Boolean(doi) && configured
  const succeeded = depositStatus === 'success'

  function run(force: boolean) {
    setError(null)
    setInfo(null)
    startTransition(async () => {
      const res = await depositToCrossref(manuscriptId, { force })
      if (res.error) {
        setError(res.error)
        return
      }
      const s = res.summary
      setInfo(
        s
          ? `Sweep complete — ${s.submitted} submitted, ${s.confirmed} confirmed, ${s.failed} failed, ${s.stillPending} awaiting Crossref.` +
              (s.errors.length ? ` Details: ${s.errors.join(' | ')}` : '')
          : 'Deposit queued.'
      )
      setConfirmRedeposit(false)
    })
  }

  return (
    <div className="space-y-3">
      {status === 'accepted' && (
        <p className="text-sm text-brown leading-relaxed">
          This article is not public yet. Its DOI is already minted and final,
          but Crossref registration happens at go-live — a registered DOI has
          to resolve to a live page.
        </p>
      )}

      <div className="flex flex-wrap gap-3">
        {canDeposit && !succeeded && (
          <button
            type="button"
            onClick={() => run(false)}
            disabled={isPending}
            className="bg-brown-dark text-peach font-semibold text-sm px-4 py-2.5 rounded-lg hover:bg-ink transition-colors disabled:opacity-50"
          >
            {isPending ? 'Working…' : hasDeposit ? 'Retry deposit' : 'Deposit to Crossref'}
          </button>
        )}

        {canDeposit && succeeded && !confirmRedeposit && (
          <button
            type="button"
            onClick={() => setConfirmRedeposit(true)}
            disabled={isPending}
            className="border border-border text-brown-dark font-semibold text-sm px-4 py-2.5 rounded-lg hover:bg-cream-alt transition-colors disabled:opacity-50"
          >
            Re-deposit (metadata correction)
          </button>
        )}
      </div>

      {confirmRedeposit && (
        <div className="border border-peach/40 bg-peach/10 rounded-lg p-3 space-y-2">
          <p className="text-sm text-brown-dark leading-relaxed">
            A re-deposit <strong>overwrites</strong> this DOI&apos;s registered
            metadata. Crossref nulls any field the new record does not supply,
            so the complete record is always rebuilt from the database — check
            the manuscript metadata is correct <em>first</em>. The DOI itself
            cannot be changed or withdrawn.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => run(true)}
              disabled={isPending}
              className="bg-brown-dark text-peach font-semibold text-sm px-4 py-2 rounded-lg hover:bg-ink transition-colors disabled:opacity-50"
            >
              {isPending ? 'Working…' : 'Confirm re-deposit'}
            </button>
            <button
              type="button"
              onClick={() => setConfirmRedeposit(false)}
              disabled={isPending}
              className="text-sm text-brown px-3 py-2 hover:text-brown-dark"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {error && (
        <p className="text-sm text-red-800 bg-red-50 border border-red-200 rounded-lg p-3">
          {error}
        </p>
      )}
      {info && (
        <p className="text-sm text-green-900 bg-green-50 border border-green-200 rounded-lg p-3">
          {info}
        </p>
      )}
    </div>
  )
}
