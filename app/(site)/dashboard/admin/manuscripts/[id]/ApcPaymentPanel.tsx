import { createAdminClient } from '@/lib/supabase/server'
import { APC_STANDARD_CENTS, APC_CURRENCY } from '@/lib/payments/constants'
import { isWithinFreeWindow, formatCents } from '@/lib/payments/apc'
import { isStripeConfigured, stripeMode, stripeInvoiceDashboardUrl } from '@/lib/payments/stripe'
import type { ApcPaymentRow } from '@/lib/payments/types'
import ApcPaymentActions from './ApcPaymentActions'

// ============================================================
// APC payment panel — admin manuscript page.
//
// Phase-aware, following the Session 85 precedent: when the
// manuscript is not in a billable phase this renders NOTHING. Not a
// disabled card, not an empty state — nothing. A payment surface on a
// manuscript still in review is exactly what a predatory journal
// looks like, and /apc publicly promises authors are never charged
// before acceptance.
//
// Design tokens: this lives under app/(site), so Neutral Elegance
// only — text-ink for body, text-brown-dark for headings,
// bg-cream-alt for chips. Never text-tan (fails WCAG AA on cream),
// never fmt-* (those are Studio-only and the two design worlds must
// not leak).
// ============================================================

interface Props {
  manuscriptId: string
}

const CARD = 'bg-white border border-border rounded-xl p-6 space-y-4'

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export default async function ApcPaymentPanel({ manuscriptId }: Props) {
  const admin = createAdminClient()

  const { data: mData } = await admin
    .from('manuscripts')
    .select('id, submission_id, status, submission_date')
    .eq('id', manuscriptId)
    .maybeSingle()

  const manuscript = mData as {
    id: string
    submission_id: string
    status: string
    submission_date: string | null
  } | null

  if (!manuscript) return null

  // The whole panel is scoped to the billable phase.
  if (manuscript.status !== 'accepted' && manuscript.status !== 'awaiting_payment') {
    return null
  }

  const { data: pData } = await admin
    .from('payments')
    .select('*')
    .eq('manuscript_id', manuscriptId)
    .in('status', ['pending', 'paid', 'waived', 'overdue', 'refunded'])
    .maybeSingle()

  const payment = (pData as unknown as ApcPaymentRow | null) ?? null
  const inFreeWindow = isWithinFreeWindow(manuscript.submission_date)
  const mode = stripeMode()

  const header = (
    <div className="flex items-start justify-between gap-3 flex-wrap">
      <div>
        <h2 className="font-serif text-lg text-brown-dark">Article processing charge</h2>
        <p className="text-xs text-brown mt-1">
          Submitted {fmtDate(manuscript.submission_date)} · {manuscript.submission_id}
        </p>
      </div>
      {mode === 'test' && (
        <span className="text-[11px] uppercase tracking-widest font-semibold px-2.5 py-1 rounded-full bg-cream-alt text-brown border border-border">
          Stripe test mode
        </span>
      )}
    </div>
  )

  // ---- 1. Already paid ----
  if (payment && payment.status === 'paid') {
    return (
      <section className={CARD}>
        {header}
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-sm font-semibold text-emerald-900">
            Paid — {formatCents(payment.amount_cents, payment.currency)}
          </p>
          <p className="text-sm text-ink mt-1">
            Received {fmtDate(payment.payment_date)}. The publish pipeline is unblocked.
          </p>
          {payment.stripe_invoice_id && (
            <a
              href={stripeInvoiceDashboardUrl(payment.stripe_invoice_id)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-brown underline underline-offset-2 mt-2 inline-block"
            >
              View in Stripe ↗
            </a>
          )}
        </div>
      </section>
    )
  }

  // ---- 2. Recorded as waived ----
  if (payment && payment.status === 'waived') {
    return (
      <section className={CARD}>
        {header}
        <div className="rounded-lg border border-border bg-cream-alt p-4">
          <p className="text-sm font-semibold text-brown-dark">No charge — recorded as waived</p>
          {payment.discount_reason && (
            <p className="text-sm text-ink mt-1">{payment.discount_reason}</p>
          )}
        </div>
      </section>
    )
  }

  // ---- 3. Refunded / overdue — read-only states ----
  if (payment && (payment.status === 'refunded' || payment.status === 'overdue')) {
    return (
      <section className={CARD}>
        {header}
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-semibold text-amber-900">
            {payment.status === 'refunded' ? 'Refunded' : 'Marked uncollectible'} —{' '}
            {formatCents(payment.amount_cents, payment.currency)}
          </p>
          <p className="text-sm text-ink mt-1">
            Handle this in the Stripe dashboard; the record here follows Stripe.
          </p>
          {payment.stripe_invoice_id && (
            <a
              href={stripeInvoiceDashboardUrl(payment.stripe_invoice_id)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-brown underline underline-offset-2 mt-2 inline-block"
            >
              View in Stripe ↗
            </a>
          )}
        </div>
      </section>
    )
  }

  // ---- 4. Invoice open, awaiting payment ----
  if (payment && payment.status === 'pending') {
    return (
      <section className={CARD}>
        {header}
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 space-y-1">
          <p className="text-sm font-semibold text-amber-900">
            Invoice sent — {formatCents(payment.amount_cents, payment.currency)}
          </p>
          <p className="text-sm text-ink">
            Sent {fmtDate(payment.invoice_sent_date)} · due {fmtDate(payment.due_date)}
          </p>
          <div className="flex flex-wrap gap-4 pt-1">
            {payment.hosted_invoice_url && (
              <a
                href={payment.hosted_invoice_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-brown underline underline-offset-2"
              >
                Hosted invoice ↗
              </a>
            )}
            {payment.stripe_invoice_id && (
              <a
                href={stripeInvoiceDashboardUrl(payment.stripe_invoice_id)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-brown underline underline-offset-2"
              >
                View in Stripe ↗
              </a>
            )}
          </div>
        </div>
        <p className="text-xs text-brown">
          The manuscript is held at <em>awaiting payment</em> and cannot be published until this
          clears. Paying returns it to <em>accepted</em> automatically.
        </p>
        <ApcPaymentActions
          manuscriptId={manuscriptId}
          mode="pending"
          standardCents={APC_STANDARD_CENTS}
          currency={APC_CURRENCY}
        />
      </section>
    )
  }

  // ---- 5. Grandfathered — free window ----
  if (inFreeWindow) {
    return (
      <section className={CARD}>
        {header}
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-sm font-semibold text-emerald-900">
            No charge — submitted during the launch window
          </p>
          <p className="text-sm text-ink mt-1">
            This manuscript was submitted before August 1, 2026 and is honored under the terms in
            effect at the time of submission, whatever its decision date. Recording it keeps the
            ledger complete.
          </p>
        </div>
        <ApcPaymentActions
          manuscriptId={manuscriptId}
          mode="free-window"
          standardCents={APC_STANDARD_CENTS}
          currency={APC_CURRENCY}
        />
      </section>
    )
  }

  // ---- 6. Chargeable, nothing issued yet ----
  return (
    <section className={CARD}>
      {header}
      <div className="rounded-lg border border-border bg-cream-alt p-4">
        <p className="text-sm font-semibold text-brown-dark">
          Standard charge — {formatCents(APC_STANDARD_CENTS, APC_CURRENCY)}
        </p>
        <p className="text-sm text-ink mt-1">
          One flat rate, no waivers or discounts. Sending issues a real Stripe invoice and emails
          the corresponding author, and moves the manuscript to <em>awaiting payment</em>.
        </p>
      </div>
      {!isStripeConfigured() && (
        <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3">
          Stripe is not configured on this deployment. Set <code>STRIPE_SECRET_KEY</code> before
          issuing invoices.
        </p>
      )}
      <ApcPaymentActions
        manuscriptId={manuscriptId}
        mode="issue"
        standardCents={APC_STANDARD_CENTS}
        currency={APC_CURRENCY}
        disabled={!isStripeConfigured()}
      />
    </section>
  )
}
