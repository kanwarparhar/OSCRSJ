-- ============================================================
-- Migration 028: Persist reviewer-feedback document on decisions
-- ============================================================
-- Until now the reviewer-feedback .docx that ships with a Minor/Major
-- Revisions decision — whether the editor's uploaded combined document or
-- the auto-generated per-reviewer file — was attached to the decision email
-- and never stored. Authors who lost or never received that email had no way
-- to retrieve the feedback from the site.
--
-- This adds two columns to editorial_decisions so submitEditorialDecision can
-- persist the shipped document to the `submissions` storage bucket and record
-- a pointer to it. The author submission-detail page offers it as a download
-- via getReviewerFeedbackSignedUrl (RLS-gated read of the decision row, then
-- an admin-signed URL for the already-authorized storage path).
--
--   reviewer_feedback_path      Storage object path in the `submissions`
--                               bucket, e.g.
--                               reviewer-feedback/<manuscript_id>/<decision_id>.docx
--   reviewer_feedback_filename  Download filename presented to the author.
--
-- No RLS change is required: the existing "Authors can read decisions on own
-- manuscripts" SELECT policy (migration 002) already covers these columns,
-- and the `submissions` bucket policies (migration 015 + originals) already
-- gate object access. No backfill — rows stay NULL until the next decision
-- writes them; historical decisions can be backfilled out of band.
--
-- Run this manually in the Supabase SQL Editor.
-- ============================================================

ALTER TABLE editorial_decisions
  ADD COLUMN IF NOT EXISTS reviewer_feedback_path text;

ALTER TABLE editorial_decisions
  ADD COLUMN IF NOT EXISTS reviewer_feedback_filename text;
