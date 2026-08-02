-- ============================================================
-- 034_apc_payment_wiring.sql
--
-- Wires the `payments` table (live and unused since migration 001)
-- to Stripe Invoicing for APC collection.
--
-- Nothing here creates the table, the payment_status enum, the
-- waiver_type enum, the RLS policies, or the awaiting_payment
-- manuscript status — all six shipped in 001/002 and are correct.
-- This migration adds only the columns Stripe hands back to us,
-- plus the two indexes that make the webhook idempotent.
--
-- Migration-slot arithmetic: 033 (apc_publication_agreement) is
-- the newest on disk at time of writing. 034 is claimed here.
-- ============================================================

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS stripe_customer_id  text,
  ADD COLUMN IF NOT EXISTS hosted_invoice_url  text,
  ADD COLUMN IF NOT EXISTS invoice_pdf_url     text,
  ADD COLUMN IF NOT EXISTS discount_reason     text,
  ADD COLUMN IF NOT EXISTS due_date            timestamptz,
  ADD COLUMN IF NOT EXISTS created_by          uuid REFERENCES auth.users(id);

-- One live invoice per manuscript. Partial, so a voided or refunded
-- row never blocks a re-issue after a genuine mistake.
CREATE UNIQUE INDEX IF NOT EXISTS payments_one_live_per_manuscript
  ON public.payments (manuscript_id)
  WHERE status IN ('pending', 'paid');

-- The webhook's lookup key. Stripe retries and WILL deliver
-- duplicates; reconciliation is by invoice id, so it must be unique.
CREATE UNIQUE INDEX IF NOT EXISTS payments_stripe_invoice_id_key
  ON public.payments (stripe_invoice_id)
  WHERE stripe_invoice_id IS NOT NULL;

COMMENT ON COLUMN public.payments.stripe_customer_id IS
  'Stripe customer id for the corresponding author. Reused across re-issues so one author is one customer in the Stripe dashboard.';

COMMENT ON COLUMN public.payments.hosted_invoice_url IS
  'Stripe-hosted payment page. Surfaced to the author on their dashboard and in our invoice email; never expires while the invoice is open.';

COMMENT ON COLUMN public.payments.invoice_pdf_url IS
  'Stripe-generated PDF. Authors forward this to institutional finance for reimbursement — it is the single most-requested artifact in APC collection.';

COMMENT ON COLUMN public.payments.discount_reason IS
  'Editor justification recorded when amount_cents is below the standard APC. OSCRSJ publicly operates a single flat rate with NO waivers or discounts (/apc, /publication-agreement, DOAJ Principles of Transparency 13). This column exists for the grandfathered $0 launch-window rows and for a genuine correction, NOT as a discount facility. Do not build a discount UI against it without changing the public copy first.';

COMMENT ON COLUMN public.payments.due_date IS
  'Payment due date quoted on the invoice (invoice_sent_date + APC_PAYMENT_TERMS_DAYS). Stored so the author dashboard and reminder logic do not each recompute it and drift.';

COMMENT ON COLUMN public.payments.created_by IS
  'Editor or admin who issued the invoice. Payment is an editorial-office action and must be attributable.';

-- MANDATORY. Without this, every write fails with "Could not find the
-- 'X' column in the schema cache" until PostgREST auto-refreshes
-- (~10 min). Repo convention, surfaced Session 34.
NOTIFY pgrst, 'reload schema';
