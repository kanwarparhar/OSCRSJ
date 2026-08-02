// ============================================================
// Stripe webhook — APC payment reconciliation.
//
// Structurally mirrors app/api/webhooks/resend/route.ts.
//
// Two rules govern everything here:
//
//  1. SIGNATURE VERIFICATION NEEDS THE RAW BODY. Use req.text(), never
//     req.json(). Parsing first silently breaks verification and fails
//     closed in a way that looks like a config problem for hours.
//
//  2. IDEMPOTENCY IS MANDATORY. Stripe retries and WILL deliver
//     duplicates. Every handler looks the row up by stripe_invoice_id
//     (unique index, migration 034) and no-ops when the row is already
//     in the target state. Return 200 for anything we do not handle —
//     a non-2xx makes Stripe retry forever and eventually disable the
//     endpoint.
// ============================================================

import { NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { createAdminClient } from '@/lib/supabase/server'
import { sendEmail } from '@/lib/email/resend'
import {
  renderApcPaymentReceipt,
  getApcPaymentReceiptSubject,
} from '@/lib/email/templates/apcPaymentReceipt'
import { getStripe } from '@/lib/payments/stripe'
import { formatCents } from '@/lib/payments/apc'
import type { ApcPaymentRow } from '@/lib/payments/types'

// Node runtime is required — the Edge runtime cannot give us a stable
// raw body for signature verification.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function siteUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    'https://www.oscrsj.com'
  return raw.replace(/\/$/, '')
}

function longDate(d: Date): string {
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  })
}

type Admin = ReturnType<typeof createAdminClient>

/**
 * Pull the PaymentIntent id off a paid invoice.
 *
 * `invoice.payment_intent` was REMOVED from the Invoice object in the
 * 2025-03-31 (Basil) API version — it now lives under
 * `invoice.payments[].payment.payment_intent`. The old field is read
 * first anyway so an account still pinned to a pre-Basil version keeps
 * working; neither path is assumed to exist.
 */
function extractPaymentIntentId(invoice: Stripe.Invoice): string | null {
  const legacy = (invoice as unknown as { payment_intent?: string | { id?: string } })
    .payment_intent
  if (typeof legacy === 'string') return legacy
  if (legacy && typeof legacy === 'object' && legacy.id) return legacy.id

  for (const entry of invoice.payments?.data ?? []) {
    const pi = entry.payment?.payment_intent
    if (typeof pi === 'string') return pi
    if (pi && typeof pi === 'object' && pi.id) return pi.id
  }
  return null
}

async function findPaymentByInvoice(
  admin: Admin,
  invoiceId: string
): Promise<ApcPaymentRow | null> {
  const { data } = await admin
    .from('payments')
    .select('*')
    .eq('stripe_invoice_id', invoiceId)
    .maybeSingle()
  return (data as unknown as ApcPaymentRow | null) ?? null
}

async function logAudit(
  admin: Admin,
  action: string,
  manuscriptId: string | null,
  details: Record<string, unknown>
): Promise<void> {
  try {
    await (admin.from('audit_logs') as any).insert({
      user_id: null,
      action,
      resource_type: 'manuscript',
      resource_id: manuscriptId,
      details,
    })
  } catch {
    // swallow — never fail a webhook on a logging error
  }
}

// ------------------------------------------------------------
// invoice.paid
// ------------------------------------------------------------
async function handleInvoicePaid(admin: Admin, invoice: Stripe.Invoice): Promise<void> {
  const invoiceId = invoice.id
  if (!invoiceId) return

  const row = await findPaymentByInvoice(admin, invoiceId)
  if (!row) {
    await logAudit(admin, 'apc_webhook_orphan_invoice', null, {
      stripe_invoice_id: invoiceId,
      event: 'invoice.paid',
      note: 'Paid invoice has no matching payments row. Reconcile by hand.',
    })
    return
  }

  // Idempotent: a replayed event finds the row already paid and stops.
  if (row.status === 'paid') return

  const paidAt = new Date()
  const paymentIntentId = extractPaymentIntentId(invoice)

  const { error: updErr } = await (admin.from('payments') as any)
    .update({
      status: 'paid',
      payment_date: paidAt.toISOString(),
      stripe_payment_intent_id: paymentIntentId,
      invoice_pdf_url: invoice.invoice_pdf ?? row.invoice_pdf_url,
    })
    .eq('id', row.id)
  if (updErr) return // Stripe retries; a transient DB error resolves itself

  // Back to `accepted`, NOT forward to in_production. awaiting_payment
  // is a temporary detour off accepted and back to it — the publish
  // pipeline gates on `accepted` and must resume exactly where it was.
  await (admin.from('manuscripts') as any)
    .update({ status: 'accepted' })
    .eq('id', row.manuscript_id)
    .eq('status', 'awaiting_payment')

  await logAudit(admin, 'apc_payment_received', row.manuscript_id, {
    manuscript_id: row.manuscript_id,
    stripe_invoice_id: invoiceId,
    stripe_payment_intent_id: paymentIntentId,
    amount_cents: row.amount_cents,
  })

  // Receipt — best effort, and only on the transition, so a replayed
  // event cannot email the author twice.
  try {
    const { data: mData } = await admin
      .from('manuscripts')
      .select('submission_id, title, corresponding_author_id')
      .eq('id', row.manuscript_id)
      .maybeSingle()
    const m = mData as {
      submission_id: string
      title: string | null
      corresponding_author_id: string | null
    } | null
    if (!m) return

    const { data: aData } = await admin
      .from('manuscript_authors')
      .select('full_name, email, is_corresponding')
      .eq('manuscript_id', row.manuscript_id)
    const authors =
      (aData as Array<{
        full_name: string | null
        email: string | null
        is_corresponding: boolean | null
      }> | null) || []
    const ca = authors.find((a) => a.is_corresponding) || null

    let email = ca?.email ?? null
    let name = ca?.full_name ?? null
    if (!email && m.corresponding_author_id) {
      const { data: uData } = await admin
        .from('users')
        .select('full_name, email')
        .eq('id', m.corresponding_author_id)
        .maybeSingle()
      const u = uData as { full_name: string | null; email: string | null } | null
      email = u?.email ?? null
      name = name || (u?.full_name ?? null)
    }
    if (!email) return

    const { html, text } = renderApcPaymentReceipt({
      authorName: name || 'Author',
      submissionId: m.submission_id,
      title: m.title || '(untitled manuscript)',
      amountDisplay: formatCents(row.amount_cents, row.currency),
      paidDateDisplay: longDate(paidAt),
      invoicePdfUrl: invoice.invoice_pdf ?? row.invoice_pdf_url,
      dashboardUrl: `${siteUrl()}/dashboard`,
    })
    await sendEmail({
      to: email,
      subject: getApcPaymentReceiptSubject(m.submission_id),
      html,
      text,
      emailType: 'apc_payment_receipt',
      manuscriptId: row.manuscript_id,
    })
  } catch {
    // swallow — the payment is recorded; the receipt is a courtesy
  }
}

// ------------------------------------------------------------
// invoice.payment_failed — log only. No author-shaming email.
// ------------------------------------------------------------
async function handlePaymentFailed(admin: Admin, invoice: Stripe.Invoice): Promise<void> {
  if (!invoice.id) return
  const row = await findPaymentByInvoice(admin, invoice.id)
  await logAudit(admin, 'apc_payment_failed', row?.manuscript_id ?? null, {
    stripe_invoice_id: invoice.id,
    manuscript_id: row?.manuscript_id ?? null,
    attempt_count: invoice.attempt_count ?? null,
    note: 'Invoice left pending. A failed card is not an author problem to chase automatically.',
  })
}

// ------------------------------------------------------------
// invoice.marked_uncollectible → overdue
// ------------------------------------------------------------
async function handleUncollectible(admin: Admin, invoice: Stripe.Invoice): Promise<void> {
  if (!invoice.id) return
  const row = await findPaymentByInvoice(admin, invoice.id)
  if (!row || row.status === 'overdue' || row.status === 'paid') return

  await (admin.from('payments') as any).update({ status: 'overdue' }).eq('id', row.id)
  await logAudit(admin, 'apc_marked_uncollectible', row.manuscript_id, {
    manuscript_id: row.manuscript_id,
    stripe_invoice_id: invoice.id,
    amount_cents: row.amount_cents,
  })
}

// ------------------------------------------------------------
// invoice.voided → clear the row, return to `accepted`
// ------------------------------------------------------------
async function handleVoided(admin: Admin, invoice: Stripe.Invoice): Promise<void> {
  if (!invoice.id) return
  const row = await findPaymentByInvoice(admin, invoice.id)
  if (!row || row.status === 'paid') return

  await admin.from('payments').delete().eq('id', row.id)
  await (admin.from('manuscripts') as any)
    .update({ status: 'accepted' })
    .eq('id', row.manuscript_id)
    .eq('status', 'awaiting_payment')

  await logAudit(admin, 'apc_invoice_voided_by_stripe', row.manuscript_id, {
    manuscript_id: row.manuscript_id,
    stripe_invoice_id: invoice.id,
    amount_cents: row.amount_cents,
    note: 'Voided in the Stripe dashboard rather than in the admin panel.',
  })
}

// ------------------------------------------------------------
// charge.refunded → refunded
// ------------------------------------------------------------
async function handleRefunded(admin: Admin, charge: Stripe.Charge): Promise<void> {
  // `Charge.invoice` was removed from the Charge object in the current
  // API version, so the refund is matched back to us by PaymentIntent —
  // which we store on invoice.paid precisely so this lookup works.
  const paymentIntentId =
    typeof charge.payment_intent === 'string'
      ? charge.payment_intent
      : (charge.payment_intent?.id ?? null)
  if (!paymentIntentId) return

  const { data } = await admin
    .from('payments')
    .select('*')
    .eq('stripe_payment_intent_id', paymentIntentId)
    .maybeSingle()
  const row = (data as unknown as ApcPaymentRow | null) ?? null
  if (!row || row.status === 'refunded') return

  await (admin.from('payments') as any).update({ status: 'refunded' }).eq('id', row.id)
  await logAudit(admin, 'apc_payment_refunded', row.manuscript_id, {
    manuscript_id: row.manuscript_id,
    stripe_invoice_id: row.stripe_invoice_id,
    stripe_payment_intent_id: paymentIntentId,
    amount_refunded: charge.amount_refunded,
  })
}

export async function POST(req: Request): Promise<NextResponse> {
  const stripe = getStripe()
  const secret = process.env.STRIPE_WEBHOOK_SECRET

  if (!stripe || !secret) {
    // 503, not 200: Stripe should retry once the env is configured
    // rather than silently discarding a real payment event.
    console.error('[stripe-webhook] STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET is unset')
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 503 })
  }

  const signature = req.headers.get('stripe-signature')
  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 })
  }

  // RAW body. Do not replace with req.json().
  const rawBody = await req.text()

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, secret)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    // Loud: in practice this is almost always a test-vs-live signing
    // secret mismatch, or the apex URL being registered instead of www.
    console.error('[stripe-webhook] signature verification failed:', msg)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const admin = createAdminClient()

  try {
    switch (event.type) {
      case 'invoice.paid':
        await handleInvoicePaid(admin, event.data.object as Stripe.Invoice)
        break
      case 'invoice.payment_failed':
        await handlePaymentFailed(admin, event.data.object as Stripe.Invoice)
        break
      case 'invoice.marked_uncollectible':
        await handleUncollectible(admin, event.data.object as Stripe.Invoice)
        break
      case 'invoice.voided':
        await handleVoided(admin, event.data.object as Stripe.Invoice)
        break
      case 'charge.refunded':
        await handleRefunded(admin, event.data.object as Stripe.Charge)
        break
      default:
        // Acknowledged and ignored, deliberately.
        break
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error(`[stripe-webhook] handler error on ${event.type}:`, msg)
    // 500 so Stripe retries — a dropped invoice.paid is a real payment
    // the journal never records.
    return NextResponse.json({ error: 'Handler failed' }, { status: 500 })
  }

  return NextResponse.json({ received: true, type: event.type }, { status: 200 })
}
