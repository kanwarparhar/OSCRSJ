'use client'

import { useState, useTransition } from 'react'
import {
  createApcInvoice,
  recordWaivedApc,
  voidApcInvoice,
  markApcPaidManually,
} from '@/lib/payments/actions'

// ============================================================
// Client half of the APC panel.
//
// Every action that touches money sits behind a confirmation modal,
// mirroring the desk-reject pattern: these send real mail about real
// money to a real person, and an accidental click is not recoverable
// by an undo button.
// ============================================================

type Mode = 'issue' | 'free-window' | 'pending'

interface Props {
  manuscriptId: string
  mode: Mode
  standardCents: number
  currency: string
  disabled?: boolean
}

type Pending = null | 'issue' | 'waive' | 'void' | 'manual'

const BTN =
  'inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
const BTN_PRIMARY = `${BTN} bg-brown-dark text-peach hover:bg-brown`
const BTN_OUTLINE = `${BTN} border border-border text-brown-dark hover:border-tan`

function money(cents: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(cents / 100)
}

export default function ApcPaymentActions({
  manuscriptId,
  mode,
  standardCents,
  currency,
  disabled = false,
}: Props) {
  const [open, setOpen] = useState<Pending>(null)
  const [confirmed, setConfirmed] = useState(false)
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function close() {
    setOpen(null)
    setConfirmed(false)
    setReason('')
    setError(null)
  }

  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null)
    startTransition(async () => {
      const res = await fn()
      if (!res.ok) setError(res.error || 'Something went wrong.')
      else close()
    })
  }

  const amountLabel = money(standardCents, currency)

  const modal = (() => {
    if (!open) return null

    const copy: Record<
      Exclude<Pending, null>,
      { title: string; body: string; cta: string; needsReason: boolean; danger?: boolean }
    > = {
      issue: {
        title: `Send an invoice for ${amountLabel}?`,
        body: `Stripe will email the corresponding author a real invoice, and this manuscript moves to "awaiting payment" until it clears. It cannot be published in the meantime. This is not a draft — the author receives it immediately.`,
        cta: 'Send invoice',
        needsReason: false,
      },
      waive: {
        title: 'Record this APC as waived?',
        body: `This writes a zero-amount payment record so the ledger is complete. No email is sent to the author, and nothing about the manuscript's status changes.`,
        cta: 'Record as waived',
        needsReason: false,
      },
      void: {
        title: 'Void this invoice?',
        body: `The Stripe invoice is voided and the payment record cleared, returning the manuscript to "accepted". The author may already have seen the invoice, so tell them separately if it was sent in error.`,
        cta: 'Void invoice',
        needsReason: true,
        danger: true,
      },
      manual: {
        title: 'Mark this APC paid by hand?',
        body: `Use this only when payment arrived outside Stripe — a wire or an institutional transfer. Stripe will still show the invoice as open, so note how the money actually arrived.`,
        cta: 'Mark as paid',
        needsReason: true,
      },
    }

    const c = copy[open]

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
        <div className="bg-white rounded-xl border border-border max-w-lg w-full p-6 space-y-4">
          <h3 className="font-serif text-lg text-brown-dark">{c.title}</h3>
          <p className="text-sm text-ink">{c.body}</p>

          {c.needsReason && (
            <div>
              <label className="block text-xs uppercase tracking-widest text-brown font-semibold mb-1">
                {open === 'manual' ? 'How the payment arrived' : 'Reason'}
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                className="w-full rounded-lg border border-border p-2 text-sm text-ink"
                placeholder={
                  open === 'manual'
                    ? 'e.g. Wire received 2026-09-14, ref MSK-4471, institutional account'
                    : 'e.g. Issued against the wrong manuscript'
                }
              />
            </div>
          )}

          <label className="flex items-start gap-2 text-sm text-ink">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              className="mt-1"
            />
            <span>I understand this action takes effect immediately.</span>
          </label>

          {error && (
            <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-3 pt-1">
            <button type="button" onClick={close} className={BTN_OUTLINE} disabled={isPending}>
              Cancel
            </button>
            <button
              type="button"
              disabled={
                isPending || !confirmed || (c.needsReason && reason.trim().length === 0)
              }
              className={
                c.danger ? `${BTN} bg-red-700 text-white hover:bg-red-800` : BTN_PRIMARY
              }
              onClick={() => {
                if (open === 'issue') run(() => createApcInvoice({ manuscriptId }))
                if (open === 'waive') run(() => recordWaivedApc({ manuscriptId }))
                if (open === 'void')
                  run(() => voidApcInvoice({ manuscriptId, reason: reason.trim() }))
                if (open === 'manual')
                  run(() => markApcPaidManually({ manuscriptId, note: reason.trim() }))
              }}
            >
              {isPending ? 'Working…' : c.cta}
            </button>
          </div>
        </div>
      </div>
    )
  })()

  return (
    <>
      <div className="flex flex-wrap gap-3">
        {mode === 'issue' && (
          <button
            type="button"
            className={BTN_PRIMARY}
            disabled={disabled}
            onClick={() => setOpen('issue')}
          >
            Send APC invoice ({amountLabel})
          </button>
        )}
        {mode === 'free-window' && (
          <button type="button" className={BTN_OUTLINE} onClick={() => setOpen('waive')}>
            Record as waived
          </button>
        )}
        {mode === 'pending' && (
          <>
            <button type="button" className={BTN_OUTLINE} onClick={() => setOpen('manual')}>
              Mark paid manually
            </button>
            <button type="button" className={BTN_OUTLINE} onClick={() => setOpen('void')}>
              Void invoice
            </button>
          </>
        )}
      </div>

      {error && !open && (
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3 mt-3">
          {error}
        </p>
      )}

      {modal}
    </>
  )
}
