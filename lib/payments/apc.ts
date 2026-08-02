// ============================================================
// APC amount logic — PURE. No clock reads, no I/O, no Supabase.
//
// Follows the lib/finder/match.ts precedent: every time-dependent
// function takes `now` as an argument so it can be unit-tested at
// the boundary instead of only on the day the boundary happens to
// fall. Tests live in tests/apc.test.ts.
//
// This module decides ONE thing: how many cents an accepted
// manuscript owes. It never decides policy — policy is the flat fee
// in lib/apc/config.ts and the grandfather rule below.
// ============================================================

import type { WaiverType } from '@/lib/types/database'
import { APC_STANDARD_CENTS, APC_FREE_WINDOW_END } from './constants'

/**
 * True when a manuscript was submitted during the retired launch
 * window and therefore carries no charge, whatever its decision date.
 *
 * A null submission_date returns TRUE — fail safe. Missing data must
 * never result in billing a real person. The column is nullable in
 * migration 001 and a draft that was never formally submitted has no
 * date at all; treating that as "free" is the only defensible default.
 */
export function isWithinFreeWindow(submissionDate: string | null | undefined): boolean {
  if (!submissionDate) return true
  const submitted = Date.parse(submissionDate)
  if (Number.isNaN(submitted)) return true // unparseable → fail safe
  return submitted < Date.parse(APC_FREE_WINDOW_END)
}

export class ApcAmountError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ApcAmountError'
  }
}

/**
 * The amount to charge, in cents.
 *
 * In-window manuscripts are free and an override cannot make them
 * payable — that is a hard rule, not a default, because the
 * grandfather promise is published on /publication-agreement.
 *
 * An override may only ever LOWER the charge. Nothing may bill an
 * author more than the rate they accepted at submission.
 */
export function computeApcCents(
  submissionDate: string | null | undefined,
  overrideCents?: number | null
): number {
  if (isWithinFreeWindow(submissionDate)) return 0

  if (overrideCents === undefined || overrideCents === null) {
    return APC_STANDARD_CENTS
  }

  if (!Number.isInteger(overrideCents)) {
    throw new ApcAmountError('Amount must be a whole number of cents.')
  }
  if (overrideCents < 0) {
    throw new ApcAmountError('Amount cannot be negative.')
  }
  if (overrideCents > APC_STANDARD_CENTS) {
    throw new ApcAmountError(
      `Amount cannot exceed the standard APC of ${APC_STANDARD_CENTS} cents.`
    )
  }
  return overrideCents
}

/**
 * Maps a dollar amount onto the existing waiver_type enum for
 * bookkeeping. This RECORDS a decision an editor already made; it
 * never makes one.
 *
 * Note OSCRSJ publicly operates a single flat rate with no waivers or
 * discounts. In practice only the 0 (grandfathered) and full-price
 * branches should ever be hit. The middle branch exists so a genuine
 * correction is recorded honestly rather than silently.
 */
export function deriveWaiverFields(amountCents: number): {
  waiver_type: WaiverType
  waiver_percentage: number
} {
  if (amountCents === 0) return { waiver_type: 'full', waiver_percentage: 100 }
  if (amountCents >= APC_STANDARD_CENTS) {
    return { waiver_type: 'none', waiver_percentage: 0 }
  }
  const pct = Math.round(100 - (amountCents / APC_STANDARD_CENTS) * 100)
  return { waiver_type: 'custom', waiver_percentage: pct }
}

/** Due date for an invoice sent at `sentAt`, N days out. */
export function computeDueDate(sentAt: Date, dueDays: number): Date {
  const d = new Date(sentAt.getTime())
  d.setUTCDate(d.getUTCDate() + dueDays)
  return d
}

/** "$399.00" — for UI and email copy. Never used for arithmetic. */
export function formatCents(cents: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(cents / 100)
}
