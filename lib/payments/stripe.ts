// ============================================================
// Server-only Stripe client singleton.
//
// Never import this from a client component. There is no
// NEXT_PUBLIC Stripe key in this app by design: OSCRSJ never
// collects card details itself. Authors pay on Stripe's own hosted
// invoice page, which keeps us out of PCI scope entirely.
// ============================================================

// NOTE: no `server-only` import — that package is not a dependency of
// this repo and adding one just for a marker import isn't worth it. The
// guard is convention: nothing under lib/payments/ is imported by a
// 'use client' component. Keep it that way.
import Stripe from 'stripe'

let client: Stripe | null = null

/**
 * Returns the Stripe client, or null when STRIPE_SECRET_KEY is unset.
 *
 * Returning null rather than throwing at module load is deliberate:
 * the key is absent on every branch until Kanwar creates the account,
 * and a throwing import would take down the whole admin route tree
 * (and `next build`) for a feature nobody has activated yet. Callers
 * check for null and surface a legible "payments are not configured"
 * message.
 */
export function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) return null
  if (client) return client

  client = new Stripe(key, {
    // apiVersion is deliberately NOT pinned here. stripe-node pins the
    // version it was generated against, so the SDK release IS the pin,
    // and hardcoding a string that disagrees with the installed SDK is
    // a startup-time type error. If you later want an explicit pin,
    // take the exact value from the Stripe dashboard's Developers →
    // API version panel and bump the SDK in the same commit.
    typescript: true,
    appInfo: { name: 'OSCRSJ', url: 'https://www.oscrsj.com' },
    maxNetworkRetries: 2,
  })
  return client
}

/** True when Stripe is configured. Drives the admin panel's empty state. */
export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY)
}

/** Test vs live, inferred from the key prefix. Shown in the admin UI. */
export function stripeMode(): 'test' | 'live' | 'unconfigured' {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) return 'unconfigured'
  return key.startsWith('sk_live_') ? 'live' : 'test'
}

/** Dashboard deep link for a given invoice, mode-aware. */
export function stripeInvoiceDashboardUrl(invoiceId: string): string {
  const seg = stripeMode() === 'live' ? '' : 'test/'
  return `https://dashboard.stripe.com/${seg}invoices/${invoiceId}`
}
