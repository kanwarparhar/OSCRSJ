-- ============================================================
-- Migration 009: External-reviewer reviews + is_draft flag + RLS
-- ============================================================
-- Session 10 (Submission Portal Phase 2 closure) ships the
-- structured review form on `/review/[token]/form`. External
-- token-only reviewers may submit reviews without a `users` row, so
-- we relax `reviews.reviewer_id NOT NULL` the same way migration
-- 008 relaxed `review_invitations.reviewer_id NOT NULL`. Every
-- review row still carries a non-null `review_invitation_id`; a
-- CHECK constraint defensively enforces that at least one identity
-- column is populated.
--
-- Also adds `is_draft boolean NOT NULL DEFAULT true` so auto-save
-- (saveReviewDraft) can UPSERT a row without inadvertently marking
-- it submitted. `submitReview` flips `is_draft = false` and sets
-- `submitted_date = now()` in the same UPDATE.
--
-- Fixes a silent spec mismatch in migration 001: `scope_score`
-- shipped with CHECK 1-5 but Architecture Plan §4.2 specifies 1-4.
-- Safe to narrow because `reviews` is empty in production.
--
-- RLS: editor/admin SELECT + UPDATE via `is_editor_or_admin()`.
-- Reviewer SELECT own row via `reviewer_id = auth.uid()`. No
-- anonymous SELECT -- token-only access flows through the admin
-- client, identical to the Session 9 invitation pattern. No INSERT
-- policy from authenticated users -- all inserts happen through
-- server actions that use the admin client (service role bypasses
-- RLS).
--
-- Run this manually in the Supabase SQL Editor.
-- ============================================================

-- ---- Relax FK + add columns ----

ALTER TABLE reviews
  ALTER COLUMN reviewer_id DROP NOT NULL;

ALTER TABLE reviews
  ADD COLUMN IF NOT EXISTS is_draft boolean NOT NULL DEFAULT true;

ALTER TABLE reviews
  ADD COLUMN IF NOT EXISTS review_invitation_id_snapshot_email text;

-- ---- At-least-one-identity CHECK ----

DO $$ BEGIN
  ALTER TABLE reviews
    ADD CONSTRAINT reviews_reviewer_identity_check
    CHECK (reviewer_id IS NOT NULL OR review_invitation_id IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---- Narrow scope_score CHECK to 1-4 per Architecture Plan §4.2 ----
-- Migration 001 shipped scope_score CHECK 1-5 in a single unnamed
-- inline CHECK constraint. Postgres autogenerates the name as
-- `reviews_scope_score_check`. Drop it (safe: table is empty) and
-- re-add the corrected range.

DO $$ BEGIN
  ALTER TABLE reviews
    DROP CONSTRAINT IF EXISTS reviews_scope_score_check;
EXCEPTION WHEN undefined_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE reviews
    ADD CONSTRAINT reviews_scope_score_check
    CHECK (scope_score IS NULL OR (scope_score >= 1 AND scope_score <= 4));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---- Indexes ----

CREATE INDEX IF NOT EXISTS idx_reviews_invitation_draft
  ON reviews(review_invitation_id, is_draft);

-- ---- RLS ----
-- Migration 002 enabled RLS on `reviews` and installed 4 policies
-- assuming reviewer_id was always a `users.id`. With nullable
-- reviewer_id (external reviewers) + admin-client server-action
-- writes, those INSERT/UPDATE policies are obsolete. Drop all four
-- and install the Session 10 set: editor SELECT + editor UPDATE +
-- reviewer SELECT-own. Writes happen via admin client.

ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Reviewers can read own reviews" ON reviews;
DROP POLICY IF EXISTS "Editors can read all reviews" ON reviews;
DROP POLICY IF EXISTS "Reviewers can insert own reviews" ON reviews;
DROP POLICY IF EXISTS "Reviewers can update own reviews" ON reviews;

CREATE POLICY "Editors can view reviews"
  ON reviews
  FOR SELECT
  TO authenticated
  USING (is_editor_or_admin());

CREATE POLICY "Editors can update reviews"
  ON reviews
  FOR UPDATE
  TO authenticated
  USING (is_editor_or_admin())
  WITH CHECK (is_editor_or_admin());

CREATE POLICY "Reviewers can view their own reviews"
  ON reviews
  FOR SELECT
  TO authenticated
  USING (reviewer_id = auth.uid());
