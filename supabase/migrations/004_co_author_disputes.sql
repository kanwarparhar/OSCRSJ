-- ============================================================
-- Migration 004: Co-author dispute tracking
-- ============================================================
-- Per COPE guidelines, every co-author listed on a manuscript must be
-- given a way to object if they did not consent to authorship. Each
-- co-author notification email contains a signed dispute link that hits
-- the /api/submissions/[id]/co-author-dispute route. This migration
-- adds the storage needed to record those objections.
--
-- Run this manually in the Supabase SQL Editor.
-- ============================================================

ALTER TABLE manuscript_metadata
  ADD COLUMN IF NOT EXISTS co_author_disputes jsonb NOT NULL DEFAULT '[]'::jsonb;

-- audit_logs.details — generic JSONB payload for event metadata.
-- Used by the dispute handler to record the disputing co-author's email
-- alongside the standard action/resource fields.
ALTER TABLE audit_logs
  ADD COLUMN IF NOT EXISTS details jsonb;
