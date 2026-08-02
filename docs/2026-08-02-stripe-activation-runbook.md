# Stripe APC Collection — Activation Runbook

> **Built:** 2026-08-02 (Cowork). **Status:** code complete, typechecked, unit-tested, **inert until activated**.
> Nothing in this build can charge anyone until `STRIPE_SECRET_KEY` is set. With it unset the admin panel
> renders a "Stripe is not configured" state and the webhook returns 503. That is deliberate — the code
> could land months before the account exists without breaking a single build.

---

## What was built

| Piece | File |
|---|---|
| Migration — invoice columns + idempotency indexes | `supabase/migrations/034_apc_payment_wiring.sql` |
| Constants (re-exports the fee from `lib/apc/config.ts`) | `lib/payments/constants.ts` |
| Row shapes for the 034 columns | `lib/payments/types.ts` |
| Pure amount + free-window logic | `lib/payments/apc.ts` |
| Stripe client singleton | `lib/payments/stripe.ts` |
| Server actions (issue / waive / void / mark-paid) | `lib/payments/actions.ts` |
| Webhook reconciliation | `app/api/webhooks/stripe/route.ts` |
| Author invoice + receipt emails | `lib/email/templates/apc{InvoiceAuthor,PaymentReceipt}.ts` |
| Admin panel (server) + actions (client) | `.../manuscripts/[id]/ApcPayment{Panel,Actions}.tsx` |
| Unit tests — 19, all passing | `tests/apc.test.ts` |

**Flow:** editor accepts → APC panel appears → *Send APC invoice* → Stripe creates, finalizes and sends
a hosted invoice → manuscript moves to `awaiting_payment` → author pays by ACH or card →
`invoice.paid` webhook → manuscript returns to **`accepted`** → publish pipeline resumes.

`awaiting_payment` is a temporary detour off `accepted` and back to it. It is deliberately **not** added
to any publish gate — an unpaid manuscript cannot be published, which is the entire point.

---

## Ordered activation steps

Each step gates the next.

### 1. Business bank account — the long pole
Mercury or Relay, ~10 minutes online. Needs EIN `42-2798301` + the WA LLC formation docs
(Work Order #2026052400418054). **Open since 2026-05-27 and blocking everything below.**

### 2. Create the Stripe account
Use the LLC legal name **OSCRSJ LLC**, the EIN, and the bank account from step 1.
**Not a personal account and not an SSN** — keeping the entity clean is the reason the LLC exists.

### 3. Stripe → Settings → Business
- Statement descriptor: **`OSCRSJ APC`** (a cryptic descriptor is a leading cause of chargebacks)
- Support email + the `https://www.oscrsj.com/apc` URL
- **Enable ACH** (`us_bank_account`) as an invoice payment method. The code already requests it and
  lists it *before* card, deliberately: a $399 APC costs ~$11.87 on card and ~$3.19 by ACH.

### 4. Run migration 034
Supabase Studio → SQL Editor → paste `supabase/migrations/034_apc_payment_wiring.sql` → Run.
It ends with `NOTIFY pgrst, 'reload schema'` — do not drop that line, or every write fails with
"Could not find the 'X' column in the schema cache" for about ten minutes.

Verify afterwards: `payments` has `stripe_customer_id`, `hosted_invoice_url`, `invoice_pdf_url`,
`discount_reason`, `due_date`, `created_by`, plus both new indexes.

### 5. Install the dependency
```bash
cd ~/Documents/OSCRSJ/OSCRSJ && npm install
```
`stripe@^22.4.0` is already in `package.json`; this writes the lockfile entry.
(A copy was unpacked into `node_modules/` during the build so it could be typechecked — `npm install`
supersedes it. `.stale-junk/stripe-pkg.tgz` is the transfer artifact and can be deleted.)

### 6. Test mode first — do not skip this
Set on **Vercel Preview only**:
```
STRIPE_SECRET_KEY=sk_test_…
```
Create the **test-mode** webhook at `https://www.oscrsj.com/api/webhooks/stripe`, subscribe to
`invoice.paid`, `invoice.payment_failed`, `invoice.marked_uncollectible`, `invoice.voided`,
`charge.refunded`, and copy the signing secret to `STRIPE_WEBHOOK_SECRET`.

> ⚠️ **The `www` is not optional.** Apex `oscrsj.com` 307s and Stripe does not re-issue the body on
> redirect. This exact mistake silently broke the Resend webhook in Session 5.

Then run the test plan below end to end.

### 7. Go live
Swap to `sk_live_…` on Production, **re-create the webhook in live mode**, and copy the *new* signing
secret. Test and live have **different** signing secrets — swapping only the API key is the single most
common go-live failure. Redeploy.

### 8. Log it
Financial Tracker → Expense Log for Stripe fees; Revenue Log for the **net** received, per the
existing convention.

---

## Test plan (test mode, Preview)

1. Pick a manuscript, force `status='accepted'` and `submission_date='2026-08-15'`.
2. Admin page → the APC panel shows the standard charge → Send → confirm → sent.
3. Assert: `payments` row `pending`; manuscript `awaiting_payment`; `audit_logs` has `apc_invoice_sent`;
   author received our email **and** Stripe's; the hosted invoice URL opens.
4. Pay with `4242 4242 4242 4242`.
5. Assert: webhook 200; row `paid` with `payment_date` and `stripe_payment_intent_id`; manuscript back
   to `accepted`; receipt email sent.
6. **Idempotency:** replay `invoice.paid` from the Stripe dashboard → no duplicate row, no second email,
   still `paid`.
7. **Free window:** set `submission_date='2026-07-20'` → panel shows *No charge*, and the server action
   hard-fails if called directly. Repeat with `submission_date=NULL` → same.
8. **Double invoice:** send twice → the second is refused with a readable message, not a Postgres 23505.
9. **Unpaid publish:** with `awaiting_payment`, try to publish → blocked.
10. **Void:** void the invoice → manuscript returns to `accepted`, row cleared, invoice voided in Stripe.
11. **Signature:** `POST` garbage to the webhook → **400**, no DB write.

---

## Two things to decide

**1. Stripe's own invoice email.** Stripe sends one; so do we. Ours is written as the contextual
heads-up ("here is what is coming and why") and Stripe's carries the payment UX — they do not duplicate
each other. If you would rather carry everything yourself, disable Stripe's in
Settings → Billing → Invoices. Do **not** ship two emails that say the same thing.

**2. The discount contradiction.** The July build brief specced a case-by-case discount input on the
admin panel. The site copy shipped today says the opposite, in public, in three places — `/apc`,
`/publication-agreement`, and `/faq` all state there are **no waivers, no discounts, and no
case-by-case reductions**, framed as a DOAJ transparency commitment.

The build follows the **live copy**, per the production-surface-is-canonical rule: the panel offers one
flat amount and no discount field. The underlying capability is still there and still tested — the
server action accepts a lower amount if a written reason is supplied, and records it as a `custom`
waiver — so a genuine correction is possible and auditable. But nothing in the UI invites one.

If you want editor-granted discounts back as a real feature, the public copy has to change first.

---

## Known gaps

- **`lib/payments/types.ts` is a seam.** Migration 034's six columns are layered on top of `PaymentRow`
  in a separate file because `lib/types/database.ts` was held by a parallel session during this build.
  Fold them into `PaymentRow` / `PaymentInsert` the next time that file is touched, and delete
  `lib/payments/types.ts`.
- **No payment-reminder job.** `payments.reminder_sent_date` exists and nothing writes it. A 7-days-
  before-due nudge is the obvious follow-up; deliberately not built, because an automated chaser is a
  tone decision, not a technical one.
- **Refunds are manual.** Issue them in the Stripe dashboard; the `charge.refunded` webhook records the
  result. There is no refund button, on purpose.
- **`next build` has not been run.** `tsc --noEmit` is exit 0 and the 19 unit tests pass, but the
  `'use server'` export rule is only enforced at build time. Every export in `lib/payments/actions.ts`
  was hand-audited as async; run `next build` on the Mac before pushing anyway.
