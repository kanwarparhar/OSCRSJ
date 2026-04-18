-- ============================================================
-- Migration 008: External-reviewer invitations
-- ============================================================
-- Session 9 (Submission Portal Phase 2 kickoff) opens the reviewer
-- invitation flow on `/review/[token]`. Invitees are drawn from
-- `reviewer_applications` and may not yet have a row in `users` --
-- the token lookup alone authenticates them. So we relax
-- `review_invitations.reviewer_id NOT NULL` and add snapshot /
-- foreign-key columns so an invitation can reference an application
-- even without a registered user.
--
-- A CHECK constraint guarantees at least one identity column is set:
-- either `reviewer_id` (the old path, once the invitee accepts +
-- signs up) or `reviewer_email` (the new path, from the application
-- snapshot).
--
-- RLS: editors/admins can INSERT/SELECT/UPDATE via
-- `is_editor_or_admin()`. Public access to a row by token is handled
-- server-side with the admin client (no anon policy is exposed).
--
-- Run this manually in the Supabase SQL Editor.
-- ============================================================

-- ---- Relax FK + add snapshot columns ----

ALTER TABLE review_invitations
  ALTER COLUMN reviewer_id DROP NOT NULL;

ALTER TABLE review_invitations
  ADD COLUMN IF NOT EXISTS reviewer_application_id uuid
    REFERENCES reviewer_applications(id) ON DELETE SET NULL;

ALTER TABLE review_invitations
  ADD COLUMN IF NOT EXISTS reviewer_email text;

ALTER TABLE review_invitations
  ADD COLUMN IF NOT EXISTS reviewer_first_name text;

ALTER TABLE review_invitations
  ADD COLUMN IF NOT EXISTS reviewer_last_name text;

ALTER TABLE review_invitations
  ADD COLUMN IF NOT EXISTS declined_reason text;

-- ---- At-least-one-identity CHECK ----

DO $$ BEGIN
  ALTER TABLE review_invitations
    ADD CONSTRAINT review_invitations_reviewer_identity_check
    CHECK (reviewer_id IS NOT NULL OR reviewer_email IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---- Indexes ----

CREATE INDEX IF NOT EXISTS idx_review_invitations_application
  ON review_invitations(reviewer_application_id);

CREATE INDEX IF NOT EXISTS idx_review_invitations_email
  ON review_invitations(reviewer_email);

-- ---- RLS ----
-- Earlier migrations did not add explicit policies for
-- `review_invitations` (the table was built for future use and has
-- sat unused until now). With this migration it becomes active, so
-- we enable RLS and gate editor/admin writes + reads through the
-- `is_editor_or_admin()` helper established in 002_rls_policies.sql.
-- Anonymous access by token is NOT exposed via RLS -- the server
-- action uses the admin client and validates the token before
-- returning any row.

ALTER TABLE review_invitations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Editors can view invitations"
  ON review_invitations;
CREATE POLICY "Editors can view invitations"
  ON review_invitations
  FOR SELECT
  TO authenticated
  USING (is_editor_or_admin());

DROP POLICY IF EXISTS "Editors can insert invitations"
  ON review_invitations;
CREATE POLICY "Editors can insert invitations"
  ON review_invitations
  FOR INSERT
  TO authenticated
  WITH CHECK (is_editor_or_admin());

DROP POLICY IF EXISTS "Editors can update invitations"
  ON review_invitations;
CREATE POLICY "Editors can update invitations"
  ON review_invitations
  FOR UPDATE
  TO authenticated
  USING (is_editor_or_admin())
  WITH CHECK (is_editor_or_admin());

-- A registered reviewer may still see their own invitation rows once
-- they accept and sign up (reviewer_id is populated at that point).
DROP POLICY IF EXISTS "Reviewers can view their own invitations"
  ON review_invitations;
CREATE POLICY "Reviewers can view their own invitations"
  ON review_invitations
  FOR SELECT
  TO authenticated
  USING (reviewer_id = auth.uid());
