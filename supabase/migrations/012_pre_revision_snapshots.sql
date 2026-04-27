-- ============================================================
-- Migration 012: Pre-revision metadata snapshots
-- ============================================================
-- Closes the schema gap Session 14's Revisions panel footer
-- declared: the current schema doesn't snapshot the manuscript
-- state that existed immediately before a revision was submitted,
-- so an editor can't see a real field-level diff of what the
-- author changed between revision cycles.
--
-- Why snapshot at editorial-decision time (not at revision submit):
-- the revising wizard writes *live* to the production tables.
-- `saveManuscriptInfo` overwrites title/abstract/keywords/
-- subspecialty as soon as Step 3 saves; `saveAuthors` hard
-- delete-then-inserts `manuscript_authors` as soon as Step 4
-- saves. By the time `submitRevision` fires, the pre-revision
-- state has already been overwritten. The only reliable capture
-- point upstream of those live writes is the moment the editor
-- issues the Minor/Major Revisions decision — at that moment,
-- the manuscripts row + author list ARE the pre-revision state.
--
-- Capture + propagation flow:
--   1. `submitEditorialDecision` (lib/admin/actions.ts), when the
--      decision is `minor_revisions` or `major_revisions`, reads
--      the current manuscripts row + manuscript_authors list and
--      writes a jsonb payload into
--      `editorial_decisions.pre_revision_snapshot` on the same
--      INSERT.
--   2. `submitRevision` (lib/submission/actions.ts) looks up the
--      most-recent non-rescinded editorial_decisions row for the
--      manuscript, pulls `pre_revision_snapshot`, and copies the
--      individual fields into the new `manuscript_revisions` row's
--      snapshot_* columns. If no snapshot exists (legacy decision
--      issued before this migration), the snapshot_* columns stay
--      NULL — the RevisionsPanel footer declares this honestly.
--
-- jsonb payload shape (populated by submitEditorialDecision,
-- mirrored into manuscript_revisions snapshot_* columns):
--   {
--     "title": text,
--     "abstract": text,
--     "keywords": text[],
--     "subspecialty": text,
--     "authors": [
--       {
--         "author_order": int,
--         "full_name": text,
--         "email": text,
--         "affiliation": text | null,
--         "orcid_id": text | null,
--         "degrees": text | null,
--         "contribution": text | null,
--         "is_corresponding": bool
--       },
--       ...
--     ]
--   }
--
-- Backfill: none. Legacy editorial_decisions rows issued before
-- this migration stay with pre_revision_snapshot = NULL; any
-- revision submitted against those decisions records NULL
-- snapshot_* columns and surfaces an honest "snapshot unavailable"
-- state in a future diff UI. No retroactive best-effort population
-- because the current manuscripts state is post-revision, not
-- pre-revision — populating from it would be misleading.
--
-- All ADD COLUMN IF NOT EXISTS for safe re-runs.
--
-- Run this manually in the Supabase SQL Editor.
-- ============================================================

-- ---- Part A: capture column on editorial_decisions ----

ALTER TABLE editorial_decisions
  ADD COLUMN IF NOT EXISTS pre_revision_snapshot jsonb;

COMMENT ON COLUMN editorial_decisions.pre_revision_snapshot IS
  'Snapshot of manuscript state (title/abstract/keywords/subspecialty/authors) captured at decision-issue time when decision ∈ (minor_revisions, major_revisions). NULL for accept/reject/desk_reject/post_review_reject decisions and for legacy decisions issued before migration 012. See submitEditorialDecision in lib/admin/actions.ts for the capture path.';

-- ---- Part B: snapshot columns on manuscript_revisions ----

ALTER TABLE manuscript_revisions
  ADD COLUMN IF NOT EXISTS snapshot_title text;

ALTER TABLE manuscript_revisions
  ADD COLUMN IF NOT EXISTS snapshot_abstract text;

ALTER TABLE manuscript_revisions
  ADD COLUMN IF NOT EXISTS snapshot_keywords text[];

ALTER TABLE manuscript_revisions
  ADD COLUMN IF NOT EXISTS snapshot_subspecialty text;

ALTER TABLE manuscript_revisions
  ADD COLUMN IF NOT EXISTS snapshot_authors jsonb;

ALTER TABLE manuscript_revisions
  ADD COLUMN IF NOT EXISTS snapshot_source text;

ALTER TABLE manuscript_revisions
  ADD COLUMN IF NOT EXISTS snapshot_captured_at timestamptz;

COMMENT ON COLUMN manuscript_revisions.snapshot_source IS
  'Provenance tag. Current values: ''editorial_decision'' (copied from editorial_decisions.pre_revision_snapshot when submitRevision ran). NULL when no pre-revision snapshot was available (legacy revision against a decision issued before migration 012). Reserved for future values if the capture point moves.';

-- ---- Part C: advisory NOTICE ----
-- Session 14's RevisionsPanel footer declared the snapshot gap
-- honestly. After migration 012 runs, *new* editorial decisions
-- and *new* revisions carry snapshots; existing rows do not.
-- This NOTICE surfaces the retroactive-null count so Kanwar can
-- confirm the migration landed cleanly.

DO $$
DECLARE
  legacy_revision_count int;
  legacy_revision_decision_count int;
BEGIN
  SELECT count(*) INTO legacy_revision_count
  FROM manuscript_revisions;

  SELECT count(*) INTO legacy_revision_decision_count
  FROM editorial_decisions
  WHERE decision IN ('minor_revisions', 'major_revisions');

  IF legacy_revision_count > 0 OR legacy_revision_decision_count > 0 THEN
    RAISE NOTICE 'Session 15 pre-revision snapshots: % existing manuscript_revisions row(s) and % existing minor/major editorial_decisions row(s) predate this migration and will carry NULL snapshot columns. New revisions submitted after this migration will capture snapshots automatically.', legacy_revision_count, legacy_revision_decision_count;
  END IF;
END $$;
