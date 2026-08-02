'use server'

// ============================================================
// APC payment server actions.
//
// Every export in this file is an async function. That is a hard
// requirement of 'use server', it is not caught by `tsc --noEmit`,
// and violating it fails only at `next build` (it broke commit
// 9adac57). Constants live in ./constants.ts, pure logic in ./apc.ts.
//
// Ordering rule for createApcInvoice: create the Stripe invoice
// BEFORE the DB write, flip manuscript status AFTER the DB write
// succeeds. Supabase JS has no .transaction(), so if Stripe succeeds
// and the insert fails we return an error naming the orphaned invoice
// id for a human to void — we do not attempt a distributed rollback
// and pretend it worked.
// ============================================================

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/server'
import { requireEditorOrAdmin } from '@/lib/admin/actions'
import { sendEmail } from '@/lib/email/resend'
import {
  renderApcInvoiceAuthor,
  getApcInvoiceAuthorSubject,
} from '@/lib/email/templates/apcInvoiceAuthor'
import { getStripe } from './stripe'
import {
  APC_STANDARD_CENTS,
  APC_CURRENCY,
  APC_INVOICE_DUE_DAYS,
  APC_PAYMENT_METHOD_TYPES,
} from './constants'
import {
  computeApcCents,
  isWithinFreeWindow,
  deriveWaiverFields,
  computeDueDate,
  formatCents,
  ApcAmountError,
} from './apc'
import type { ApcPaymentRow } from './types'

// `object` (not Record<string, never>) as the default: intersecting
// { ok: true } with an empty-record type makes `ok` incompatible with
// the index signature and every bare `{ ok: true }` return fails.
type ActionResult<T = object> = ({ ok: true } & T) | { ok: false; error: string }

const ADMIN_PATH = '/dashboard/admin/manuscripts'

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

interface ManuscriptForBilling {
  id: string
  submission_id: string
  title: string | null
  status: string
  submission_date: string | null
  corresponding_author_id: string | null
}

/** Manuscript + corresponding author, or a legible error. */
async function loadBillingContext(manuscriptId: string): Promise<
  | {
      ok: true
      manuscript: ManuscriptForBilling
      authorName: string
      authorEmail: string | null
      existing: ApcPaymentRow | null
    }
  | { ok: false; error: string }
> {
  const admin = createAdminClient()

  const { data: mData, error: mErr } = await admin
    .from('manuscripts')
    .select('id, submission_id, title, status, submission_date, corresponding_author_id')
    .eq('id', manuscriptId)
    .maybeSingle()

  if (mErr || !mData) return { ok: false, error: 'Manuscript not found.' }
  const manuscript = mData as unknown as ManuscriptForBilling

  // Corresponding author — same resolution order as the decision
  // emails (lib/admin/actions.ts): the manuscript_authors snapshot
  // first, then the linked user account.
  const { data: aData } = await admin
    .from('manuscript_authors')
    .select('full_name, email, is_corresponding, author_id')
    .eq('manuscript_id', manuscriptId)
  const authors =
    (aData as Array<{
      full_name: string | null
      email: string | null
      is_corresponding: boolean | null
      author_id: string | null
    }> | null) || []

  let userName: string | null = null
  let userEmail: string | null = null
  if (manuscript.corresponding_author_id) {
    const { data: uData } = await admin
      .from('users')
      .select('full_name, email')
      .eq('id', manuscript.corresponding_author_id)
      .maybeSingle()
    const u = uData as { full_name: string | null; email: string | null } | null
    userName = u?.full_name ?? null
    userEmail = u?.email ?? null
  }

  const ca =
    authors.find((a) => a.is_corresponding) ||
    authors.find((a) => a.author_id === manuscript.corresponding_author_id) ||
    null

  const { data: pData } = await admin
    .from('payments')
    .select('*')
    .eq('manuscript_id', manuscriptId)
    .in('status', ['pending', 'paid', 'waived'])
    .maybeSingle()

  return {
    ok: true,
    manuscript,
    authorName: ca?.full_name || userName || 'Author',
    authorEmail: ca?.email || userEmail || null,
    existing: (pData as unknown as ApcPaymentRow | null) ?? null,
  }
}

// ------------------------------------------------------------
// Issue the APC invoice.
// ------------------------------------------------------------
export async function createApcInvoice(args: {
  manuscriptId: string
  amountCents?: number
  discountReason?: string
}): Promise<ActionResult<{ hostedInvoiceUrl: string }>> {
  const gate = await requireEditorOrAdmin()
  if ('error' in gate) return { ok: false, error: gate.error }

  const stripe = getStripe()
  if (!stripe) {
    return {
      ok: false,
      error:
        'Stripe is not configured. Set STRIPE_SECRET_KEY before issuing invoices.',
    }
  }

  const ctx = await loadBillingContext(args.manuscriptId)
  if (!ctx.ok) return ctx
  const { manuscript, authorName, authorEmail, existing } = ctx

  // Never bill anything that is not accepted. "Pay to be reviewed" is
  // item one on every predatory-journal checklist and /apc publicly
  // promises authors are never charged before acceptance.
  if (manuscript.status !== 'accepted') {
    return {
      ok: false,
      error: `Only accepted manuscripts can be invoiced. This one is "${manuscript.status.replace(/_/g, ' ')}".`,
    }
  }

  // The grandfather window is a server-side gate, not a UI hint.
  if (isWithinFreeWindow(manuscript.submission_date)) {
    return {
      ok: false,
      error:
        'This manuscript was submitted before August 1, 2026 and carries no article processing charge. Record it as waived instead.',
    }
  }

  if (existing && (existing.status === 'pending' || existing.status === 'paid')) {
    return {
      ok: false,
      error: `An APC invoice already exists for this manuscript (status: ${existing.status}). Void it before issuing another.`,
    }
  }
  if (existing && existing.status === 'waived') {
    return {
      ok: false,
      error: 'This APC is already recorded as waived. Nothing further is due.',
    }
  }

  if (!authorEmail) {
    return {
      ok: false,
      error:
        'No corresponding-author email on file. Add one before issuing an invoice — an invoice with nowhere to go is worse than none.',
    }
  }

  let amountCents: number
  try {
    amountCents = computeApcCents(manuscript.submission_date, args.amountCents)
  } catch (e) {
    if (e instanceof ApcAmountError) return { ok: false, error: e.message }
    throw e
  }

  if (amountCents <= 0) {
    return { ok: false, error: 'Computed amount is zero. Record as waived instead.' }
  }
  // OSCRSJ publicly operates one flat rate with no discounts. If an
  // editor ever does reduce a charge, the reason is recorded — an
  // unexplained below-standard invoice is not auditable.
  const discountReason = (args.discountReason || '').trim()
  if (amountCents < APC_STANDARD_CENTS && !discountReason) {
    return {
      ok: false,
      error:
        'A reduced amount requires a written reason. OSCRSJ publishes a single flat rate with no waivers or discounts — deviating from it must be justified in the record.',
    }
  }

  const title = manuscript.title || '(untitled manuscript)'
  const sentAt = new Date()
  const dueAt = computeDueDate(sentAt, APC_INVOICE_DUE_DAYS)
  const admin = createAdminClient()

  // ---- Stripe ----
  let invoiceId = ''
  let hostedInvoiceUrl = ''
  let invoicePdfUrl: string | null = null
  let customerId = ''

  try {
    // Reuse a customer by email so one author is one customer in the
    // dashboard, rather than a new record per manuscript.
    const found = await stripe.customers.list({ email: authorEmail, limit: 1 })
    const customer =
      found.data[0] ||
      (await stripe.customers.create({
        email: authorEmail,
        name: authorName,
        metadata: { oscrsj_manuscript_id: manuscript.id },
      }))
    customerId = customer.id

    await stripe.invoiceItems.create({
      customer: customerId,
      amount: amountCents,
      currency: APC_CURRENCY,
      // This string lands on an institutional finance officer's desk.
      description: `Article Processing Charge — ${manuscript.submission_id}: ${title}`,
    })

    const draft = await stripe.invoices.create({
      customer: customerId,
      collection_method: 'send_invoice',
      days_until_due: APC_INVOICE_DUE_DAYS,
      description: `OSCRSJ article processing charge for accepted manuscript ${manuscript.submission_id}. Acceptance is not contingent on payment.`,
      payment_settings: {
        payment_method_types: [...APC_PAYMENT_METHOD_TYPES],
      },
      metadata: {
        oscrsj_manuscript_id: manuscript.id,
        oscrsj_submission_id: manuscript.submission_id,
      },
    })
    if (!draft.id) throw new Error('Stripe returned an invoice with no id.')

    const finalized = await stripe.invoices.finalizeInvoice(draft.id)
    if (!finalized.id) throw new Error('Stripe returned a finalized invoice with no id.')
    const sent = await stripe.invoices.sendInvoice(finalized.id)

    invoiceId = sent.id || finalized.id
    hostedInvoiceUrl = sent.hosted_invoice_url || finalized.hosted_invoice_url || ''
    invoicePdfUrl = sent.invoice_pdf || finalized.invoice_pdf || null
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { ok: false, error: `Stripe rejected the invoice: ${msg}` }
  }

  // ---- Our record ----
  const waiver = deriveWaiverFields(amountCents)
  const { error: insErr } = await (admin.from('payments') as any).insert({
    manuscript_id: manuscript.id,
    stripe_invoice_id: invoiceId,
    stripe_customer_id: customerId,
    hosted_invoice_url: hostedInvoiceUrl || null,
    invoice_pdf_url: invoicePdfUrl,
    amount_cents: amountCents,
    currency: APC_CURRENCY,
    status: 'pending',
    invoice_sent_date: sentAt.toISOString(),
    due_date: dueAt.toISOString(),
    discount_reason: discountReason || null,
    created_by: gate.userId,
    ...waiver,
  })

  if (insErr) {
    // Stripe already sent a real invoice to a real person. Name it so
    // a human can void it rather than leaving a silent orphan.
    return {
      ok: false,
      error: `The invoice was sent by Stripe but could not be recorded (${insErr.message}). Void Stripe invoice ${invoiceId} in the dashboard, then retry.`,
    }
  }

  // ---- Status flip, only after the record exists ----
  await (admin.from('manuscripts') as any)
    .update({ status: 'awaiting_payment' })
    .eq('id', manuscript.id)

  try {
    await (admin.from('audit_logs') as any).insert({
      user_id: gate.userId,
      action: 'apc_invoice_sent',
      resource_type: 'manuscript',
      resource_id: manuscript.id,
      details: {
        manuscript_id: manuscript.id,
        submission_id: manuscript.submission_id,
        amount_cents: amountCents,
        currency: APC_CURRENCY,
        discount_reason: discountReason || null,
        stripe_invoice_id: invoiceId,
        editor_id: gate.userId,
      },
    })
  } catch {
    // swallow — an audit-log failure must not undo a sent invoice
  }

  // Our contextual email goes first; Stripe's carries the payment UX.
  try {
    const { html, text } = renderApcInvoiceAuthor({
      authorName,
      submissionId: manuscript.submission_id,
      title,
      amountDisplay: formatCents(amountCents, APC_CURRENCY),
      dueDateDisplay: longDate(dueAt),
      hostedInvoiceUrl,
      invoicePdfUrl,
      dashboardUrl: `${siteUrl()}/dashboard`,
    })
    await sendEmail({
      to: authorEmail,
      subject: getApcInvoiceAuthorSubject(
        manuscript.submission_id,
        formatCents(amountCents, APC_CURRENCY)
      ),
      html,
      text,
      emailType: 'apc_invoice_author',
      manuscriptId: manuscript.id,
    })
  } catch {
    // swallow — a failed email must never roll back a sent invoice
  }

  revalidatePath(`${ADMIN_PATH}/${manuscript.id}`)
  revalidatePath('/dashboard')
  return { ok: true, hostedInvoiceUrl }
}

// ------------------------------------------------------------
// Record a grandfathered / non-chargeable manuscript as waived.
// ------------------------------------------------------------
export async function recordWaivedApc(args: {
  manuscriptId: string
  reason?: string
}): Promise<ActionResult> {
  const gate = await requireEditorOrAdmin()
  if ('error' in gate) return { ok: false, error: gate.error }

  const ctx = await loadBillingContext(args.manuscriptId)
  if (!ctx.ok) return ctx
  const { manuscript, existing } = ctx

  if (manuscript.status !== 'accepted' && manuscript.status !== 'awaiting_payment') {
    return { ok: false, error: 'Only an accepted manuscript can have its APC recorded.' }
  }
  if (existing) {
    return {
      ok: false,
      error: `A payment record already exists for this manuscript (status: ${existing.status}).`,
    }
  }

  const inWindow = isWithinFreeWindow(manuscript.submission_date)
  const reason =
    (args.reason || '').trim() ||
    (inWindow
      ? 'Submitted before August 1, 2026 — grandfathered under the retired launch-window waiver.'
      : '')

  if (!inWindow && !reason) {
    return {
      ok: false,
      error:
        'This manuscript is outside the free window, so waiving it needs a written reason. OSCRSJ publishes a single flat rate with no waiver scheme.',
    }
  }

  const admin = createAdminClient()
  const { error: insErr } = await (admin.from('payments') as any).insert({
    manuscript_id: manuscript.id,
    amount_cents: 0,
    currency: APC_CURRENCY,
    status: 'waived',
    waiver_type: 'full',
    waiver_percentage: 100,
    discount_reason: reason,
    created_by: gate.userId,
  })
  if (insErr) return { ok: false, error: `Could not record the waiver: ${insErr.message}` }

  if (manuscript.status === 'awaiting_payment') {
    await (admin.from('manuscripts') as any)
      .update({ status: 'accepted' })
      .eq('id', manuscript.id)
  }

  try {
    await (admin.from('audit_logs') as any).insert({
      user_id: gate.userId,
      action: 'apc_waived',
      resource_type: 'manuscript',
      resource_id: manuscript.id,
      details: {
        manuscript_id: manuscript.id,
        submission_id: manuscript.submission_id,
        within_free_window: inWindow,
        reason,
        editor_id: gate.userId,
      },
    })
  } catch {
    // swallow
  }

  revalidatePath(`${ADMIN_PATH}/${manuscript.id}`)
  revalidatePath('/dashboard')
  return { ok: true }
}

// ------------------------------------------------------------
// Void an issued invoice and return the manuscript to `accepted`.
// ------------------------------------------------------------
export async function voidApcInvoice(args: {
  manuscriptId: string
  reason: string
}): Promise<ActionResult> {
  const gate = await requireEditorOrAdmin()
  if ('error' in gate) return { ok: false, error: gate.error }

  const reason = (args.reason || '').trim()
  if (!reason) return { ok: false, error: 'A reason is required to void an invoice.' }

  const ctx = await loadBillingContext(args.manuscriptId)
  if (!ctx.ok) return ctx
  const { manuscript, existing } = ctx

  if (!existing || existing.status !== 'pending') {
    return { ok: false, error: 'There is no open invoice to void on this manuscript.' }
  }

  const stripe = getStripe()
  if (stripe && existing.stripe_invoice_id) {
    try {
      await stripe.invoices.voidInvoice(existing.stripe_invoice_id)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      return { ok: false, error: `Stripe could not void the invoice: ${msg}` }
    }
  }

  const admin = createAdminClient()
  // Delete rather than mark, so the partial unique index frees up and a
  // corrected invoice can be issued. The audit log carries the history.
  const { error: delErr } = await admin.from('payments').delete().eq('id', existing.id)
  if (delErr) return { ok: false, error: `Could not clear the payment row: ${delErr.message}` }

  await (admin.from('manuscripts') as any)
    .update({ status: 'accepted' })
    .eq('id', manuscript.id)

  try {
    await (admin.from('audit_logs') as any).insert({
      user_id: gate.userId,
      action: 'apc_invoice_voided',
      resource_type: 'manuscript',
      resource_id: manuscript.id,
      details: {
        manuscript_id: manuscript.id,
        submission_id: manuscript.submission_id,
        stripe_invoice_id: existing.stripe_invoice_id,
        amount_cents: existing.amount_cents,
        reason,
        editor_id: gate.userId,
      },
    })
  } catch {
    // swallow
  }

  revalidatePath(`${ADMIN_PATH}/${manuscript.id}`)
  revalidatePath('/dashboard')
  return { ok: true }
}

// ------------------------------------------------------------
// Mark an invoice paid by hand — for a wire that lands outside Stripe.
// ------------------------------------------------------------
export async function markApcPaidManually(args: {
  manuscriptId: string
  note: string
}): Promise<ActionResult> {
  const gate = await requireEditorOrAdmin()
  if ('error' in gate) return { ok: false, error: gate.error }

  const note = (args.note || '').trim()
  if (!note) {
    return {
      ok: false,
      error:
        'A note is required — record how the payment arrived, so the Stripe record and the ledger can be reconciled later.',
    }
  }

  const ctx = await loadBillingContext(args.manuscriptId)
  if (!ctx.ok) return ctx
  const { manuscript, existing } = ctx

  if (!existing || existing.status !== 'pending') {
    return { ok: false, error: 'There is no open invoice to mark paid on this manuscript.' }
  }

  const admin = createAdminClient()
  const paidAt = new Date().toISOString()
  const { error: updErr } = await (admin.from('payments') as any)
    .update({
      status: 'paid',
      payment_date: paidAt,
      discount_reason: existing.discount_reason
        ? `${existing.discount_reason} | Manual payment: ${note}`
        : `Manual payment: ${note}`,
    })
    .eq('id', existing.id)
  if (updErr) return { ok: false, error: `Could not record payment: ${updErr.message}` }

  await (admin.from('manuscripts') as any)
    .update({ status: 'accepted' })
    .eq('id', manuscript.id)

  try {
    await (admin.from('audit_logs') as any).insert({
      user_id: gate.userId,
      action: 'apc_marked_paid_manually',
      resource_type: 'manuscript',
      resource_id: manuscript.id,
      details: {
        manuscript_id: manuscript.id,
        submission_id: manuscript.submission_id,
        stripe_invoice_id: existing.stripe_invoice_id,
        amount_cents: existing.amount_cents,
        note,
        editor_id: gate.userId,
      },
    })
  } catch {
    // swallow
  }

  revalidatePath(`${ADMIN_PATH}/${manuscript.id}`)
  revalidatePath('/dashboard')
  return { ok: true }
}
