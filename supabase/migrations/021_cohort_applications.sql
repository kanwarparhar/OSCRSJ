-- ============================================================
-- Migration 021: Cohort applications (OSCRSJ Research Scholars)
-- ============================================================
-- Backs the public `/scholars/apply` intake form. Each row is one
-- prospective scholar — Kanwar + editorial office triage out of band
-- and flip status manually via the admin UI at
-- `/dashboard/admin/scholars/applications`.
--
-- Tracks the OSCRSJ Research Scholars program — see vault note
-- 02 - OSCRSJ/Projects/Research Cohort Program.md. Soft launch
-- target 2026-06-15 ships /scholars + /scholars/apply + admin UI.
--
-- Notes:
--   * RLS: public INSERT (anyone can apply), no public SELECT,
--     service-role handles all reads/updates from server actions.
--   * `email` carries a UNIQUE constraint so repeat applicants
--     surface as a clean DB-level violation rather than a duplicate
--     row Kanwar has to manually de-dupe.
--   * `cv_storage_path` references the existing 'submissions' Storage
--     bucket under `cohort-applications/<application_id>/cv.<ext>`.
--     Uploaded via the same admin client used elsewhere in the app.
--   * `preferred_track` + `preferred_tier` mirror the three-track
--     architecture locked 2026-05-14 (Pre-Med / Med Student / IMG).
--     IMG track has only one tier so applicants on that track set
--     preferred_tier = 'img'.
--   * `references_json` carries the applicant's 1-3 reference entries
--     (name, email, relationship, institution) as JSONB — kept inline
--     rather than normalized into a join table to minimize Phase 1
--     surface area; revisit when cohort #1 has been scored.
--
-- Trailing NOTIFY pgrst, 'reload schema' per CLAUDE.md §Conventions.
--
-- Run this manually in the Supabase SQL Editor after the commit lands.
-- ============================================================

-- ---- Enums ----

DO $$ BEGIN
  CREATE TYPE cohort_application_status AS ENUM (
    'submitted',
    'under_review',
    'accepted',
    'waitlisted',
    'rejected',
    'withdrawn'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE cohort_track AS ENUM (
    'pre_med',
    'med_student',
    'img'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE cohort_tier AS ENUM (
    'pre_med_tier_1',
    'pre_med_tier_2',
    'med_student_tier_1',
    'med_student_tier_2',
    'img'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---- Table ----

CREATE TABLE IF NOT EXISTS cohort_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),

  -- Identity
  first_name text NOT NULL,
  last_name text NOT NULL,
  email text NOT NULL UNIQUE,
  orcid_id text NULL,

  -- Location + school
  country_of_residence text NOT NULL,
  school text NOT NULL,
  year_in_school text NOT NULL, -- e.g., 'MS2', 'PGY-equivalent', 'Pre-med, sophomore'

  -- Track + tier selection
  preferred_track cohort_track NOT NULL,
  preferred_tier cohort_tier NOT NULL,

  -- Essays
  personal_statement text NOT NULL,    -- "Why do you want to join this program?"
  research_experience text NOT NULL,   -- prior projects, role, completion status
  why_oscrsj text NOT NULL,            -- "Why OSCRSJ specifically?"

  -- References (1-3 entries as JSONB array of {name, email, relationship, institution})
  references_json jsonb NOT NULL DEFAULT '[]'::jsonb,

  -- CV upload — path inside the 'submissions' Supabase Storage bucket
  cv_storage_path text NULL,

  -- Disclosures
  ai_disclosure_ack boolean NOT NULL DEFAULT false,
  participant_agreement_ack boolean NOT NULL DEFAULT false,

  -- Admin triage
  status cohort_application_status NOT NULL DEFAULT 'submitted',
  reviewed_by uuid NULL REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at timestamptz NULL,
  admin_notes text NULL
);

CREATE INDEX IF NOT EXISTS cohort_applications_status_idx
  ON cohort_applications (status);
CREATE INDEX IF NOT EXISTS cohort_applications_created_at_idx
  ON cohort_applications (created_at DESC);
CREATE INDEX IF NOT EXISTS cohort_applications_track_idx
  ON cohort_applications (preferred_track);

-- ---- RLS ----

ALTER TABLE cohort_applications ENABLE ROW LEVEL SECURITY;

-- Anyone (including unauthenticated visitors) may submit an
-- application. The server action validates + sanitizes input
-- before the INSERT runs.
DROP POLICY IF EXISTS "Anyone can submit a cohort application"
  ON cohort_applications;
CREATE POLICY "Anyone can submit a cohort application"
  ON cohort_applications
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Editors/admins can read applications for triage.
DROP POLICY IF EXISTS "Editors can view cohort applications"
  ON cohort_applications;
CREATE POLICY "Editors can view cohort applications"
  ON cohort_applications
  FOR SELECT
  TO authenticated
  USING (is_editor_or_admin());

-- Editors/admins can update application status + admin notes.
DROP POLICY IF EXISTS "Editors can update cohort applications"
  ON cohort_applications;
CREATE POLICY "Editors can update cohort applications"
  ON cohort_applications
  FOR UPDATE
  TO authenticated
  USING (is_editor_or_admin())
  WITH CHECK (is_editor_or_admin());

-- ---- PostgREST schema cache reload ----

NOTIFY pgrst, 'reload schema';
