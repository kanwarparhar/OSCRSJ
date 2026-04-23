-- ============================================================
-- Migration 011: Session 13 columns + enum extensions
-- ============================================================
-- Three Session 13 features land in this migration:
--
--   1. Revision-deadline reminder cron (Architecture Plan §3.5).
--      Daily Vercel Cron at /api/cron/revision-reminders fires a
--      one-shot reminder when a manuscript is in
--      `revision_requested` status and the latest editorial
--      decision's `revision_deadline - now() < 10 days`. Idempotency
--      enforced by `manuscript_metadata.revision_reminder_sent_at`
--      — once set the cron skips that manuscript. (No second
--      reminder; the amber dashboard banner is the daily in-app
--      prompt.)
--
--   2. Decision edit / rescind 15-min window (§5.2 Decision
--      Workflow). `editorial_decisions` grows two columns:
--      `rescinded_at` (timestamptz) + `rescinded_reason` (text,
--      50-char min validated app-side). Server action
--      `rescindEditorialDecision` (lib/admin/actions.ts) gates on
--      issuing-editor + 15-min window + rescinded_at IS NULL,
--      reverts manuscripts.status, fires a "decision rescinded"
--      email. Rescinded decisions stay in the audit trail (we
--      never DELETE) — the timestamp + reason are the soft-delete
--      marker.
--
--   3. Reject-enum split (§5.2 + §7 schema). The current
--      `editorial_decision_type` enum has `reject` (post-review)
--      and `desk_reject` (before review) as separate values, but
--      the Session 12 status mapping collapsed both into
--      `desk_rejected`. Session 13 restores the distinction:
--        - `editorial_decision_type` gains `post_review_reject`
--          (kept alongside legacy `reject` so existing rows are
--          still queryable; new rows from the composer use
--          `post_review_reject`).
--        - `manuscript_status` gains `rejected` (distinct from
--          `desk_rejected`).
--      The DECISION_TO_STATUS map in lib/admin/actions.ts updates
--      in lock-step with this migration (same commit).
--
-- Plus a partial index on `manuscripts(status)` scoped to
-- `revision_requested` for the cron's hot-path filter, mirroring
-- migration 010's review-reminder index pattern.
--
-- All ADD COLUMN IF NOT EXISTS / ADD VALUE IF NOT EXISTS for safe
-- re-runs.
--
-- Run this manually in the Supabase SQL Editor.
-- ============================================================

-- ---- Part A: revision-reminder idempotency column ----

ALTER TABLE manuscript_metadata
  ADD COLUMN IF NOT EXISTS revision_reminder_sent_at timestamptz;

-- ---- Part B: decision rescind columns ----

ALTER TABLE editorial_decisions
  ADD COLUMN IF NOT EXISTS rescinded_at timestamptz;

ALTER TABLE editorial_decisions
  ADD COLUMN IF NOT EXISTS rescinded_reason text;

-- ---- Part C: enum extensions for the reject split ----
-- ALTER TYPE ... ADD VALUE cannot run inside a transaction block in
-- Postgres < 12 and is rejected if the value already exists. Both
-- guards are needed for safe re-runs in the Supabase SQL Editor.

ALTER TYPE editorial_decision_type ADD VALUE IF NOT EXISTS 'post_review_reject';

ALTER TYPE manuscript_status ADD VALUE IF NOT EXISTS 'rejected';

-- ---- Part D: partial index for the revision-reminder cron ----
-- The cron job's hot-path filter is
--   manuscripts WHERE status = 'revision_requested'
-- joined LATERAL against the latest editorial_decisions row.
-- A partial index on (status) scoped to that single value keeps
-- the scan cheap even at scale.

CREATE INDEX IF NOT EXISTS idx_manuscripts_status_revision_requested
  ON manuscripts(status)
  WHERE status = 'revision_requested';

-- ---- Part E: reject-enum split backfill NOTICE ----
-- ADVISORY ONLY. Counts existing `editorial_decisions.decision =
-- 'reject'` rows that look like post-review rejections (≥1 prior
-- non-draft review) vs. ambiguous (no prior reviews — likely
-- issued through the Reject path before the split landed).
--
-- We do NOT auto-migrate. Kanwar reviews the count and reclassifies
-- manually via a one-off UPDATE if any rows are surfaced. Given
-- Session 12 just shipped, the expected count is 0 or 1.

DO $$
DECLARE
  ambiguous_count int;
  total_reject_count int;
BEGIN
  SELECT count(*) INTO total_reject_count
  FROM editorial_decisions
  WHERE decision = 'reject';

  SELECT count(*) INTO ambiguous_count
  FROM editorial_decisions d
  WHERE d.decision = 'reject'
    AND NOT EXISTS (
      SELECT 1 FROM reviews r
      WHERE r.manuscript_id = d.manuscript_id
        AND r.is_draft = false
        AND r.created_at < d.decision_date
    );

  IF total_reject_count > 0 THEN
    RAISE NOTICE 'Session 13 reject-enum split: % total decision=reject row(s) exist; % have no prior non-draft reviews and may want manual reclassification to desk_reject. New decisions from the composer will use post_review_reject going forward.', total_reject_count, ambiguous_count;
  END IF;
END $$;
