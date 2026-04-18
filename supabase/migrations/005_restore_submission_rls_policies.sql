-- ============================================================
-- Migration 005: Restore submission-portal RLS policies
-- Created: 2026-04-17
-- ============================================================
-- Diagnosed 2026-04-17: submissions from authenticated users were
-- failing with "new row violates row-level security policy for table
-- 'manuscripts'" even though SELECT and UPDATE policies on the same
-- table passed from the same session (auth.uid() resolved correctly to
-- the caller's id). The only way this shape is possible is if the
-- INSERT policy on manuscripts was dropped or never created in the
-- live DB, leaving RLS enabled but with no permissive INSERT path.
--
-- This migration defensively drops-and-recreates the author-facing
-- INSERT policies on every write-heavy submission-portal table, so the
-- live DB converges on the exact policy set from migration 002 even if
-- one or more of them went missing. No behaviour change is intended
-- relative to migration 002 — this is purely a convergence step.
--
-- Run this manually in the Supabase SQL Editor.
-- ============================================================

-- ---- manuscripts ----
DROP POLICY IF EXISTS "Authors can create manuscripts" ON manuscripts;
CREATE POLICY "Authors can create manuscripts"
  ON manuscripts FOR INSERT
  WITH CHECK (corresponding_author_id = auth.uid());

DROP POLICY IF EXISTS "Authors can update own drafts" ON manuscripts;
CREATE POLICY "Authors can update own drafts"
  ON manuscripts FOR UPDATE
  USING (corresponding_author_id = auth.uid() AND status = 'draft')
  WITH CHECK (corresponding_author_id = auth.uid());

-- ---- manuscript_metadata ----
DROP POLICY IF EXISTS "Authors can insert metadata for own manuscripts" ON manuscript_metadata;
CREATE POLICY "Authors can insert metadata for own manuscripts"
  ON manuscript_metadata FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM manuscripts
      WHERE id = manuscript_id
      AND corresponding_author_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Authors can update metadata on own drafts" ON manuscript_metadata;
CREATE POLICY "Authors can update metadata on own drafts"
  ON manuscript_metadata FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM manuscripts
      WHERE id = manuscript_id
      AND corresponding_author_id = auth.uid()
      AND status = 'draft'
    )
  );

-- ---- manuscript_files ----
DROP POLICY IF EXISTS "Authors can upload files to own drafts" ON manuscript_files;
CREATE POLICY "Authors can upload files to own drafts"
  ON manuscript_files FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM manuscripts
      WHERE id = manuscript_id
      AND corresponding_author_id = auth.uid()
      AND status IN ('draft', 'revision_requested')
    )
  );

DROP POLICY IF EXISTS "Authors can delete files from own drafts" ON manuscript_files;
CREATE POLICY "Authors can delete files from own drafts"
  ON manuscript_files FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM manuscripts
      WHERE id = manuscript_id
      AND corresponding_author_id = auth.uid()
      AND status IN ('draft', 'revision_requested')
    )
  );

-- ---- manuscript_authors ----
DROP POLICY IF EXISTS "Authors can add co-authors to own manuscripts" ON manuscript_authors;
CREATE POLICY "Authors can add co-authors to own manuscripts"
  ON manuscript_authors FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM manuscripts
      WHERE id = manuscript_id
      AND corresponding_author_id = auth.uid()
      AND status = 'draft'
    )
  );

DROP POLICY IF EXISTS "Authors can update co-authors on own drafts" ON manuscript_authors;
CREATE POLICY "Authors can update co-authors on own drafts"
  ON manuscript_authors FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM manuscripts
      WHERE id = manuscript_id
      AND corresponding_author_id = auth.uid()
      AND status = 'draft'
    )
  );

DROP POLICY IF EXISTS "Authors can remove co-authors from own drafts" ON manuscript_authors;
CREATE POLICY "Authors can remove co-authors from own drafts"
  ON manuscript_authors FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM manuscripts
      WHERE id = manuscript_id
      AND corresponding_author_id = auth.uid()
      AND status = 'draft'
    )
  );
