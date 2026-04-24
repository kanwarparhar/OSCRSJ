-- ============================================================
-- Migration 013: Phase 4 — Publishing pipeline foundation
-- ============================================================
-- Phase 4 of the Submission Portal Architecture Plan (§6) lands
-- the publishing pipeline: take accepted articles through
-- copyediting to a compliant published PDF with DOIs and a
-- PubMed-ready JATS XML.
--
-- This migration is the FOUNDATION slice only — the backbone
-- every other Phase 4 piece (Renderer.app, DOI registration,
-- JATS XML, proof workflow) plugs into. It is additive-only and
-- safe to re-run (ADD COLUMN IF NOT EXISTS / CREATE TABLE IF
-- NOT EXISTS / ADD VALUE IF NOT EXISTS throughout).
--
-- What it does:
--
--   Part A. `manuscripts` grows 7 new columns that track the
--     article's publishing-pipeline lifecycle:
--       - elocation_id           final published article ID (e.g. e001)
--       - accepted_date          snapshot of the accept decision
--       - published_date         stamped when status flips to 'published'
--       - running_title          short-form title for PDF header/footer
--       - published_pdf_storage_path  Supabase Storage path to the PDF
--       - render_report_storage_path  Supabase Storage path to the JSON receipt
--       - doi                    set post-Crossref registration
--     All nullable (every current row is pre-publication).
--
--   Part B. New `manuscript_affiliations` table — normalises
--     authors' free-text affiliations out of `users.affiliation`
--     + `manuscript_authors.affiliation` and supports Janine's
--     PMC evidence packet (RoR IDs, department-level granularity,
--     multi-affiliation authors, country-of-record for indexing).
--     RLS policies mirror the `manuscript_authors` pattern:
--       - author of the manuscript can SELECT / INSERT / UPDATE
--         / DELETE their own manuscript's affiliations
--       - editor/admin can SELECT all rows
--       - admin client bypasses RLS for the Renderer write path
--
--   Part C. `manuscript_status` enum gets the `published` value
--     that the TypeScript type union `lib/types/database.ts`
--     already anticipates. Must run OUTSIDE a transaction (see
--     migration 011's pattern for `post_review_reject`).
--
-- Notes on migration-slot arithmetic:
--   Slot 012 was taken by Session 15's pre-revision metadata
--   snapshots migration (`012_pre_revision_snapshots.sql`). That
--   covers the schema gap Section §6.10 of the Phase 4 plan
--   anticipated for `manuscript_revisions` snapshot columns —
--   just under a different shape (a single `jsonb` snapshot
--   per editorial_decision row, not flat columns). So this
--   migration does NOT re-add the pre_revision_* columns the
--   Phase 4 plan described; they already exist via 012.
--
-- Run this manually in the Supabase SQL Editor.
-- ============================================================

-- ---- Part A: manuscripts lifecycle columns ----

ALTER TABLE manuscripts
  ADD COLUMN IF NOT EXISTS elocation_id text;

ALTER TABLE manuscripts
  ADD COLUMN IF NOT EXISTS accepted_date timestamptz;

ALTER TABLE manuscripts
  ADD COLUMN IF NOT EXISTS published_date timestamptz;

ALTER TABLE manuscripts
  ADD COLUMN IF NOT EXISTS running_title text;

ALTER TABLE manuscripts
  ADD COLUMN IF NOT EXISTS published_pdf_storage_path text;

ALTER TABLE manuscripts
  ADD COLUMN IF NOT EXISTS render_report_storage_path text;

ALTER TABLE manuscripts
  ADD COLUMN IF NOT EXISTS doi text;

-- DOI uniqueness guard: any single DOI should appear at most
-- once across the corpus. Partial index so NULLs don't collide.
CREATE UNIQUE INDEX IF NOT EXISTS idx_manuscripts_doi_unique
  ON manuscripts (doi)
  WHERE doi IS NOT NULL;

-- Partial index for the /articles/in-press and /articles/current-issue
-- hot-path filters. Both pages scan a narrow status slice, and the
-- default btree on `status` would mix all rows together.
CREATE INDEX IF NOT EXISTS idx_manuscripts_status_in_production
  ON manuscripts (status, accepted_date DESC)
  WHERE status = 'in_production';

CREATE INDEX IF NOT EXISTS idx_manuscripts_status_published
  ON manuscripts (status, published_date DESC)
  WHERE status = 'published';

-- ---- Part B: manuscript_affiliations table ----

CREATE TABLE IF NOT EXISTS manuscript_affiliations (
  id uuid primary key default gen_random_uuid(),
  manuscript_id uuid not null references manuscripts(id) on delete cascade,
  author_id uuid references users(id) on delete set null,
  -- `manuscript_author_id` is the *row-level* link; use it when you
  -- need to join per-author-per-manuscript rather than per-user.
  manuscript_author_id uuid references manuscript_authors(id) on delete cascade,
  affiliation_order integer not null default 1,
  affiliation_name text not null,
  department text,
  city text,
  country text,
  ror_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Lookup indexes for the two hot-path query patterns:
--   1. "all affiliations for this manuscript" (publishing pipeline)
--   2. "all affiliations for this author" (user-profile aggregation)
CREATE INDEX IF NOT EXISTS idx_manuscript_affiliations_manuscript
  ON manuscript_affiliations (manuscript_id, affiliation_order);

CREATE INDEX IF NOT EXISTS idx_manuscript_affiliations_author
  ON manuscript_affiliations (author_id)
  WHERE author_id IS NOT NULL;

-- updated_at bumper, mirroring the pattern used elsewhere in the schema.
CREATE OR REPLACE FUNCTION bump_manuscript_affiliations_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_manuscript_affiliations_updated_at
  ON manuscript_affiliations;
CREATE TRIGGER trg_manuscript_affiliations_updated_at
  BEFORE UPDATE ON manuscript_affiliations
  FOR EACH ROW
  EXECUTE FUNCTION bump_manuscript_affiliations_updated_at();

-- RLS policies: mirror the manuscript_authors policy set verbatim.
ALTER TABLE manuscript_affiliations ENABLE ROW LEVEL SECURITY;

-- Drop-then-recreate so the migration is idempotent on re-run.
DROP POLICY IF EXISTS "authors can read own manuscript affiliations"
  ON manuscript_affiliations;
CREATE POLICY "authors can read own manuscript affiliations"
  ON manuscript_affiliations FOR SELECT
  USING (
    manuscript_id IN (
      SELECT id FROM manuscripts WHERE corresponding_author_id = auth.uid()
    )
    OR author_id = auth.uid()
  );

DROP POLICY IF EXISTS "authors can insert affiliations on own manuscripts"
  ON manuscript_affiliations;
CREATE POLICY "authors can insert affiliations on own manuscripts"
  ON manuscript_affiliations FOR INSERT
  WITH CHECK (
    manuscript_id IN (
      SELECT id FROM manuscripts WHERE corresponding_author_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "authors can update affiliations on own manuscripts"
  ON manuscript_affiliations;
CREATE POLICY "authors can update affiliations on own manuscripts"
  ON manuscript_affiliations FOR UPDATE
  USING (
    manuscript_id IN (
      SELECT id FROM manuscripts WHERE corresponding_author_id = auth.uid()
    )
  )
  WITH CHECK (
    manuscript_id IN (
      SELECT id FROM manuscripts WHERE corresponding_author_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "authors can delete affiliations on own manuscripts"
  ON manuscript_affiliations;
CREATE POLICY "authors can delete affiliations on own manuscripts"
  ON manuscript_affiliations FOR DELETE
  USING (
    manuscript_id IN (
      SELECT id FROM manuscripts WHERE corresponding_author_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "editors and admins can read all manuscript affiliations"
  ON manuscript_affiliations;
CREATE POLICY "editors and admins can read all manuscript affiliations"
  ON manuscript_affiliations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
        AND users.role IN ('editor', 'admin')
    )
  );

-- ---- Part C: 'published' enum value on manuscript_status ----
-- ALTER TYPE ... ADD VALUE cannot run inside a transaction block
-- in Postgres < 12 and is rejected if the value already exists.
-- Both guards are needed for safe re-runs in the Supabase SQL
-- Editor, mirroring migration 011's pattern for post_review_reject.

ALTER TYPE manuscript_status ADD VALUE IF NOT EXISTS 'published';

-- ---- Part D: advisory notice on legacy accepted manuscripts ----
-- Phase 4 reads `accepted_date` to populate the In Press listing.
-- Any existing `status = 'accepted'` manuscripts predate this
-- column. Surface the count so Kanwar knows whether a one-time
-- backfill is needed (if zero, skip it; if >0, backfill manually
-- from the matching editorial_decisions row).

DO $$
DECLARE
  legacy_count integer;
BEGIN
  SELECT COUNT(*) INTO legacy_count
  FROM manuscripts
  WHERE status IN ('accepted', 'awaiting_payment', 'in_production', 'published')
    AND accepted_date IS NULL;

  IF legacy_count > 0 THEN
    RAISE NOTICE 'Phase 4 foundation migration: % manuscript(s) in post-accept status without accepted_date. Backfill recommended via: UPDATE manuscripts m SET accepted_date = d.decision_date FROM editorial_decisions d WHERE m.id = d.manuscript_id AND d.decision = ''accept'' AND d.rescinded_at IS NULL AND m.accepted_date IS NULL;', legacy_count;
  END IF;
END $$;
