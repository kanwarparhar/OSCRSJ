-- ============================================================
-- Migration 006: Reviewer applications
-- ============================================================
-- Backs the public `/for-reviewers/apply` intake form. Each row is
-- one prospective reviewer — the editorial office triages them out
-- of band (email follow-up, ORCID/affiliation sanity check) and
-- flips status manually until the admin UI lands.
--
-- Notes:
--   * RLS: public INSERT (anyone can apply), no public SELECT,
--     service-role handles all reads/updates from server actions.
--   * `email` carries a UNIQUE constraint so repeat applicants
--     surface as a clean DB-level violation rather than a
--     duplicate row the editorial team has to de-dupe.
--   * `subspecialty_interests` is stored as `text[]` — the 8
--     canonical subspecialties live on the site (`/topics`) and
--     are not normalized into a join table for v1. Good enough
--     until reviewer assignment UI lands.
--
-- Slot history: originally specced as `005_reviewer_applications.sql`
-- but slot 005 was consumed by `005_restore_submission_rls_policies.sql`
-- in Session 6 (commit aca01e6). Reviewer applications land on 006.
--
-- Run this manually in the Supabase SQL Editor.
-- ============================================================

-- ---- Enums ----

DO $$ BEGIN
  CREATE TYPE career_stage AS ENUM (
    'med_student',
    'resident',
    'fellow',
    'attending',
    'other'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE reviewer_application_status AS ENUM (
    'pending',
    'approved',
    'active',
    'declined',
    'withdrawn'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---- Table ----

CREATE TABLE IF NOT EXISTS reviewer_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  first_name text NOT NULL,
  last_name text NOT NULL,
  email text NOT NULL UNIQUE,
  orcid_id text NULL,
  affiliation text NOT NULL,
  country text NOT NULL,
  career_stage career_stage NOT NULL,
  subspecialty_interests text[] NOT NULL DEFAULT ARRAY[]::text[],
  writing_sample_url text NULL,
  heard_about text NULL,
  status reviewer_application_status NOT NULL DEFAULT 'pending',
  reviewed_by uuid NULL REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at timestamptz NULL,
  admin_notes text NULL
);

CREATE INDEX IF NOT EXISTS reviewer_applications_status_idx
  ON reviewer_applications (status);
CREATE INDEX IF NOT EXISTS reviewer_applications_created_at_idx
  ON reviewer_applications (created_at DESC);

-- ---- RLS ----

ALTER TABLE reviewer_applications ENABLE ROW LEVEL SECURITY;

-- Anyone (including unauthenticated visitors) may submit an
-- application. The server action still validates + sanitizes input
-- before the INSERT runs.
DROP POLICY IF EXISTS "Anyone can submit an application"
  ON reviewer_applications;
CREATE POLICY "Anyone can submit an application"
  ON reviewer_applications
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Editors/admins can read and update applications for triage.
DROP POLICY IF EXISTS "Editors can view applications"
  ON reviewer_applications;
CREATE POLICY "Editors can view applications"
  ON reviewer_applications
  FOR SELECT
  TO authenticated
  USING (is_editor_or_admin());

DROP POLICY IF EXISTS "Editors can update applications"
  ON reviewer_applications;
CREATE POLICY "Editors can update applications"
  ON reviewer_applications
  FOR UPDATE
  TO authenticated
  USING (is_editor_or_admin())
  WITH CHECK (is_editor_or_admin());
