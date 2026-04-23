-- ============================================================
-- Migration 010: Session 11 columns
-- ============================================================
-- Three features land at once:
--
--   1. Review reminder cadence (Architecture Plan §4.5).
--      A daily Vercel Cron job at /api/cron/review-reminders scans
--      `review_invitations` and fires 10-day / 5-day / overdue
--      reminder emails. Idempotency is enforced per-kind by a
--      timestamp column — if the column is non-null the cron skips
--      that invitation for that kind. No separate `email_logs`
--      consultation needed; the timestamp IS the "did we send this
--      already?" source of truth.
--
--   2. "Suggest alternative reviewer" on decline (§4.1 step 5).
--      The existing decline form on /review/[token] grows three
--      optional fields; this migration adds the storage columns on
--      `review_invitations`. All three are nullable with no
--      CHECK-constraint coupling — UX is cleaner if the reviewer
--      can fill just a name and skip the rest. App-layer
--      validates email-if-present.
--
--   3. "All reviews received" editor email (§4.5).
--      `manuscript_metadata.all_reviews_notified_at` is flipped to
--      now() the first time a manuscript accumulates ≥2 submitted
--      reviews. Subsequent submits short-circuit on IS NOT NULL.
--      This is the idempotency gate for the one-shot email.
--
-- All ADD COLUMN IF NOT EXISTS for safe re-runs. No CHECK
-- constraints required for nullable timestamp / text columns.
--
-- Run this manually in the Supabase SQL Editor.
-- ============================================================

-- ---- Part A: reminder timestamp columns on review_invitations ----

ALTER TABLE review_invitations
  ADD COLUMN IF NOT EXISTS reminder_ten_day_sent_at timestamptz;

ALTER TABLE review_invitations
  ADD COLUMN IF NOT EXISTS reminder_five_day_sent_at timestamptz;

ALTER TABLE review_invitations
  ADD COLUMN IF NOT EXISTS reminder_overdue_sent_at timestamptz;

-- ---- Part B: suggest-alternative columns on review_invitations ----

ALTER TABLE review_invitations
  ADD COLUMN IF NOT EXISTS suggested_alternative_name text;

ALTER TABLE review_invitations
  ADD COLUMN IF NOT EXISTS suggested_alternative_email text;

ALTER TABLE review_invitations
  ADD COLUMN IF NOT EXISTS suggested_alternative_reason text;

-- ---- Part D: one-shot "all reviews received" gate ----

ALTER TABLE manuscript_metadata
  ADD COLUMN IF NOT EXISTS all_reviews_notified_at timestamptz;

-- ---- Partial index for the cron scan ----
-- The cron job queries review_invitations WHERE status = 'accepted'
-- AND the relevant reminder_*_sent_at IS NULL AND deadline falls in
-- a specific window. An index on (status, deadline) keeps that query
-- cheap even once we have thousands of invitations.

CREATE INDEX IF NOT EXISTS idx_review_invitations_status_deadline
  ON review_invitations(status, deadline)
  WHERE status = 'accepted';
