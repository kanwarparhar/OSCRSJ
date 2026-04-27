-- ============================================================
-- Migration 018: Reviewer withdrawals (editor-marked)
-- ============================================================
-- Tracks reviewers who have asked to be removed from active
-- reviewing — typically via an email to the editor saying "please
-- remove me from your reviewer pool" or "I am stepping back from
-- reviewing for a while". The editor marks them withdrawn from the
-- unified reviewer roster page (`/dashboard/admin/reviewer-
-- applications`).
--
-- Why a separate table instead of reusing
-- `reviewer_applications.status = 'withdrawn'`?
-- A reviewer can be invited via the "direct email" path WITHOUT
-- ever submitting a `reviewer_applications` row (see migration 008
-- which relaxed `review_invitations.reviewer_id` to nullable and
-- added the `reviewer_email` snapshot column). Marking those
-- direct-email invitees as withdrawn would otherwise require
-- synthesizing a fake `reviewer_applications` row whose required
-- fields (affiliation, country, career_stage,
-- subspecialty_interests) we do not have. A standalone
-- email-keyed table keeps the schema honest.
--
-- Idempotent — safe to re-run. RLS gates writes to
-- editor/admin via `users.role`.
--
-- Run this manually in the Supabase SQL Editor.
-- ============================================================

CREATE TABLE IF NOT EXISTS reviewer_withdrawals (
  email          text PRIMARY KEY,
  reason         text,
  withdrawn_at   timestamptz NOT NULL DEFAULT now(),
  withdrawn_by   uuid REFERENCES users(id) ON DELETE SET NULL
);

-- Lower-case email is the canonical identity key elsewhere in the
-- system (review_invitations.ilike, reviewer_applications.email).
-- Enforce that here too with a CHECK so a future trigger doesn't
-- drift.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM information_schema.table_constraints
     WHERE table_name      = 'reviewer_withdrawals'
       AND constraint_name = 'reviewer_withdrawals_email_lowercase'
  ) THEN
    ALTER TABLE reviewer_withdrawals
      ADD CONSTRAINT reviewer_withdrawals_email_lowercase
      CHECK (email = lower(email));
  END IF;
END$$;

ALTER TABLE reviewer_withdrawals ENABLE ROW LEVEL SECURITY;

-- Editor + admin SELECT.
DROP POLICY IF EXISTS "reviewer_withdrawals_editor_admin_select"
  ON reviewer_withdrawals;
CREATE POLICY "reviewer_withdrawals_editor_admin_select"
  ON reviewer_withdrawals
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
       WHERE users.id = auth.uid()
         AND users.role IN ('editor', 'admin')
    )
  );

-- Editor + admin INSERT.
DROP POLICY IF EXISTS "reviewer_withdrawals_editor_admin_insert"
  ON reviewer_withdrawals;
CREATE POLICY "reviewer_withdrawals_editor_admin_insert"
  ON reviewer_withdrawals
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
       WHERE users.id = auth.uid()
         AND users.role IN ('editor', 'admin')
    )
  );

-- Editor + admin UPDATE (for "un-withdraw" / reason edits).
DROP POLICY IF EXISTS "reviewer_withdrawals_editor_admin_update"
  ON reviewer_withdrawals;
CREATE POLICY "reviewer_withdrawals_editor_admin_update"
  ON reviewer_withdrawals
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
       WHERE users.id = auth.uid()
         AND users.role IN ('editor', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
       WHERE users.id = auth.uid()
         AND users.role IN ('editor', 'admin')
    )
  );

-- Editor + admin DELETE (rare — used to un-withdraw, but UPDATE is
-- the preferred path so the audit-trail stays continuous).
DROP POLICY IF EXISTS "reviewer_withdrawals_editor_admin_delete"
  ON reviewer_withdrawals;
CREATE POLICY "reviewer_withdrawals_editor_admin_delete"
  ON reviewer_withdrawals
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
       WHERE users.id = auth.uid()
         AND users.role IN ('editor', 'admin')
    )
  );

-- All admin-client writes (server actions using the service-role
-- key) bypass RLS, so the policies above only matter for direct
-- authenticated reads/writes from the dashboard. Kept tight by
-- default.
