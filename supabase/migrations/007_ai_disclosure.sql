-- ============================================================
-- Migration 007: AI-assisted writing disclosure
-- ============================================================
-- ICMJE + OSCRSJ editorial policy require authors to disclose any
-- use of generative AI / LLM tools in drafting the manuscript.
-- Kanwar decided on 2026-04-17 that the declarations step of the
-- submission portal is the canonical disclosure mechanism (not the
-- cover letter) — see Janine's compliance report from 2026-04-16
-- late night.
--
-- Two fields land on manuscript_metadata:
--   * ai_tools_used    — boolean, NOT NULL, default false.
--                        Mirrors the Step 5 toggle.
--   * ai_tools_details — text, nullable. Authors describe the tool
--                        name, version, and how it was used when
--                        ai_tools_used = true. Max length enforced
--                        in application code, not at the DB level
--                        (keep the schema permissive).
--
-- Published articles reproduce this disclosure verbatim alongside
-- the COI and funding statements. A getter in lib/submission/
-- reads these columns for the future article template.
--
-- Run this manually in the Supabase SQL Editor.
-- ============================================================

ALTER TABLE manuscript_metadata
  ADD COLUMN IF NOT EXISTS ai_tools_used boolean NOT NULL DEFAULT false;

ALTER TABLE manuscript_metadata
  ADD COLUMN IF NOT EXISTS ai_tools_details text NULL;
