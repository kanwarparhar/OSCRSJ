// ============================================================
// Payment row shapes, extended for migration 034.
//
// lib/types/database.ts carries PaymentRow / PaymentInsert as
// shipped in migration 001. Migration 034 adds six columns. Rather
// than editing the shared database.ts (which a parallel session is
// actively holding), the new columns are layered here and the query
// sites cast to these types.
//
// FOLLOW-UP: when database.ts is next touched, fold these six fields
// into PaymentRow / PaymentInsert directly and delete this file. Two
// shapes for one table is a tolerable seam, not a good permanent home.
// ============================================================

import type { PaymentRow, PaymentInsert, WaiverType } from '@/lib/types/database'

/** Columns added by migration 034. */
export interface ApcPaymentExtras {
  stripe_customer_id: string | null
  hosted_invoice_url: string | null
  invoice_pdf_url: string | null
  discount_reason: string | null
  due_date: string | null
  created_by: string | null
}

export type ApcPaymentRow = PaymentRow & ApcPaymentExtras

export type ApcPaymentInsert = PaymentInsert & Partial<ApcPaymentExtras>

/** What the admin panel and the author dashboard actually need. */
export interface ApcPaymentSummary {
  id: string
  status: PaymentRow['status']
  amountCents: number
  currency: string
  waiverType: WaiverType
  hostedInvoiceUrl: string | null
  invoicePdfUrl: string | null
  invoiceSentDate: string | null
  dueDate: string | null
  paymentDate: string | null
  discountReason: string | null
  stripeInvoiceId: string | null
}

export function toApcPaymentSummary(row: ApcPaymentRow): ApcPaymentSummary {
  return {
    id: row.id,
    status: row.status,
    amountCents: row.amount_cents,
    currency: row.currency,
    waiverType: row.waiver_type,
    hostedInvoiceUrl: row.hosted_invoice_url,
    invoicePdfUrl: row.invoice_pdf_url,
    invoiceSentDate: row.invoice_sent_date,
    dueDate: row.due_date,
    paymentDate: row.payment_date,
    discountReason: row.discount_reason,
    stripeInvoiceId: row.stripe_invoice_id,
  }
}
