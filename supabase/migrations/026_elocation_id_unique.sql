-- Migration 026 — Publication-identifier integrity (Sushant, 2026-06-15).
--
-- Two coordinated guards so every accepted manuscript publishes with a
-- unique article identity, instead of every article silently defaulting
-- to "e0001" with the same placeholder DOI.
--
-- Background. The renderer derives the article elocation as
--   `manuscript.elocation_id || 'e0001'`  (lib/publish/synthesize.ts §article)
-- and derives the placeholder DOI from that elocation. elocation_id was
-- never auto-assigned, so a second accepted manuscript left at NULL would
-- render as e0001 / 10.XXXXX/oscrsj.<year>.0001 — a duplicate of article 1.
-- There was no DB guard preventing two rows from carrying the same
-- elocation_id, so the duplicate could publish silently.
--
-- This migration adds the missing uniqueness guard. Auto-assignment of the
-- next sequential elocation happens application-side at the acceptance
-- transition (submitEditorialDecision in lib/admin/actions.ts); this partial
-- unique index is the backstop that turns a race or a manual mistake into a
-- loud error instead of a silent duplicate publication.
--
-- Part B normalizes any empty-string DOI placeholder to NULL. The DOI field
-- in the metadata editor is display-only/auto-generated; a blank value was
-- being persisted as '' which, because idx_manuscripts_doi_unique is a
-- partial index over non-NULL doi, collides between two manuscripts (empty
-- string is NOT NULL). The save action (updateManuscriptMetadata) now
-- normalizes blank -> NULL going forward; this backfill cleans existing rows
-- so a fresh-DB replay and the live DB end up consistent.
--
-- IMPORTANT: NOTIFY pgrst at the bottom is required per CLAUDE.md
-- Convention §"PostgREST schema cache".

-- ============================================================
-- Part A: elocation_id uniqueness guard
-- ============================================================
-- Partial index so the many NULL (not-yet-assigned) rows don't collide.
-- Any single elocation_id appears at most once across the corpus.
CREATE UNIQUE INDEX IF NOT EXISTS idx_manuscripts_elocation_id_unique
  ON manuscripts (elocation_id)
  WHERE elocation_id IS NOT NULL;

-- ============================================================
-- Part B: normalize empty-string DOI placeholders to NULL
-- ============================================================
-- Idempotent. Empty strings are the only collision source for
-- idx_manuscripts_doi_unique (real DOIs land only after Crossref membership).
UPDATE manuscripts
  SET doi = NULL
  WHERE doi IS NOT NULL AND btrim(doi) = '';

-- ============================================================
-- PostgREST schema-cache refresh — mandatory per Convention §3.
-- ============================================================

NOTIFY pgrst, 'reload schema';
