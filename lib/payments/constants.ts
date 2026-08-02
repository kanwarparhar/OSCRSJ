// ============================================================
// APC payment constants.
//
// Plain module — NO 'use server' directive. A 'use server' file may
// export only async functions; a constant in one is what broke the
// Vercel deploy in commit 9adac57, and `tsc --noEmit` does not catch
// it (only `next build` does). Keep constants here, actions in
// actions.ts.
//
// The fee itself is NOT defined here. It lives in lib/apc/config.ts,
// which is the single source of truth every author-facing surface
// already reads. Re-exporting rather than redeclaring is deliberate:
// two files defining the same money value with different numbers is a
// real bug class (Constant-fix repo-wide grep convention, Session 57).
// ============================================================

import {
  APC_AMOUNT_CENTS,
  APC_CURRENCY as APC_CURRENCY_UPPER,
  APC_EFFECTIVE_DATE,
  APC_PAYMENT_TERMS_DAYS,
} from '@/lib/apc/config'

/** The standard APC in cents. Canonical value: lib/apc/config.ts. */
export const APC_STANDARD_CENTS = APC_AMOUNT_CENTS

/** Stripe expects a lowercase ISO-4217 code. */
export const APC_CURRENCY = APC_CURRENCY_UPPER.toLowerCase()

/**
 * Manuscripts SUBMITTED strictly before this instant carry no charge.
 * The boundary is the submission date, not the acceptance date — an
 * editor may accept a July manuscript in November and it is still
 * free. See lib/apc/config.ts APC_GRANDFATHER_NOTE, and the promise
 * made on /publication-agreement.
 */
export const APC_FREE_WINDOW_END = `${APC_EFFECTIVE_DATE}T00:00:00Z`

/** Days from invoice to due date. */
export const APC_INVOICE_DUE_DAYS = APC_PAYMENT_TERMS_DAYS

/**
 * Payment methods offered on the invoice.
 *
 * ACH (`us_bank_account`) is listed FIRST deliberately. A $399 APC
 * costs roughly $11.87 in card fees and about $3.19 by ACH — a ~73%
 * reduction — and institutional finance offices generally prefer a
 * bank transfer anyway. Stripe renders the list in order, so ordering
 * is the entire lever. Do not reorder without a reason.
 */
export const APC_PAYMENT_METHOD_TYPES = ['us_bank_account', 'card'] as const

/**
 * What lands on a card statement and on a finance officer's desk.
 * A cryptic descriptor is a leading cause of chargebacks.
 */
export const APC_STATEMENT_DESCRIPTOR = 'OSCRSJ APC'

/** Stripe events the webhook acts on. Anything else returns 200 and is ignored. */
export const STRIPE_HANDLED_EVENTS = [
  'invoice.paid',
  'invoice.payment_failed',
  'invoice.marked_uncollectible',
  'invoice.voided',
  'charge.refunded',
] as const

export type StripeHandledEvent = (typeof STRIPE_HANDLED_EVENTS)[number]
