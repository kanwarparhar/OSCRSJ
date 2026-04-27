-- ============================================================
-- Migration 016: Suggested + non-preferred reviewers (jsonb)
-- ============================================================
-- Step 3 of the submission wizard collects up to 5 suggested
-- reviewers (now: ≥1 required) and up to 3 non-preferred reviewers.
-- Until this migration these fields were collected in the UI and
-- silently dropped on the server (saveManuscriptInfo never wrote
-- them to the database). This migration adds the backing storage
-- so the data is durable and exportable on demand by editors via
-- the new /api/admin/exports/suggested-reviewers .xlsx endpoint.
--
-- Shape (jsonb arrays of objects):
--   suggested_reviewers:
--     [{ "name": string, "email": string, "expertise": string }, ...]  (1..5)
--   non_preferred_reviewers:
--     [{ "name": string, "reason": string }, ...]                       (0..3)
--
-- Idempotent — safe to re-run. Defaults to empty arrays so every
-- existing pre-launch metadata row reads cleanly without a backfill.
--
-- Run this manually in the Supabase SQL Editor.
-- ============================================================

ALTER TABLE manuscript_metadata
  ADD COLUMN IF NOT EXISTS suggested_reviewers jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE manuscript_metadata
  ADD COLUMN IF NOT EXISTS non_preferred_reviewers jsonb NOT NULL DEFAULT '[]'::jsonb;
