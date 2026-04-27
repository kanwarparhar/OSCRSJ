-- ============================================================
-- Migration 017: Reviewer manuscript-package build cache
-- ============================================================
-- When a reviewer accepts a review invitation, we automatically
-- build a single combined Word document containing the blinded
-- manuscript, the tables document (if any), and each figure on
-- its own page with a caption. The combined .docx is uploaded to
-- Supabase Storage at:
--
--   manuscripts/{id}/v{n}/reviewer-package.docx
--
-- The first reviewer to accept on a given manuscript-version
-- triggers the build (~5-8 sec). Subsequent reviewers of that
-- same version reuse the cached file. Submitting a revision
-- bumps the version and naturally invalidates the cache.
--
-- Three columns:
--   reviewer_package_storage_path  — full Storage path of the
--     cached .docx, or NULL until the first successful build.
--     Doubles as a "build in progress" sentinel: we set
--     reviewer_package_built_at first as a sentinel timestamp
--     before the work begins, and only set the path on success.
--   reviewer_package_built_at       — most recent build attempt
--     start (used as in-progress sentinel + cache freshness).
--   reviewer_package_version        — the manuscript "version"
--     (latest manuscript_revisions.revision_number + 1, or 1 for
--     a never-revised manuscript) that the cached package
--     corresponds to. When a new revision is submitted this no
--     longer matches the live version and the build module
--     rebuilds.
--
-- Idempotent — safe to re-run. Defaults to NULL so every existing
-- pre-launch metadata row reads cleanly without a backfill.
--
-- Run this manually in the Supabase SQL Editor.
-- ============================================================

ALTER TABLE manuscript_metadata
  ADD COLUMN IF NOT EXISTS reviewer_package_storage_path text;

ALTER TABLE manuscript_metadata
  ADD COLUMN IF NOT EXISTS reviewer_package_built_at timestamptz;

ALTER TABLE manuscript_metadata
  ADD COLUMN IF NOT EXISTS reviewer_package_version integer;
