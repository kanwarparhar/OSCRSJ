-- Phase 4 v1.1 template compatibility — adds title_page + tables to file_type enum.
-- Additive only; safe to re-run; no data migration required (pre-launch, no published manuscripts).
-- Owner: Sushant Session 19 (2026-04-25).
-- Upstream: Franklin's v1.1 multi-file submission shape (commit 40e7925 on main).
--
-- POSTGRES QUIRK: ALTER TYPE ... ADD VALUE cannot run inside a transaction.
-- Supabase SQL Editor wraps statement blocks in a txn. If this file errors with
-- "ALTER TYPE ... cannot run inside a transaction block", split into two runs:
--   Run 1: the two ALTER TYPE statements (one at a time, txn-free).
--   Run 2: the COMMENT statements.

ALTER TYPE file_type ADD VALUE IF NOT EXISTS 'title_page';
ALTER TYPE file_type ADD VALUE IF NOT EXISTS 'tables';

COMMENT ON TYPE file_type IS
  'Manuscript file categories. v1.1 (2026-04-25) split title_page and tables out of the main manuscript per NEJM/JAMA/JBJS-style multi-file submission. v1.0 single-file submissions (where title page lives inside the manuscript) remain valid; new field is purely additive.';
