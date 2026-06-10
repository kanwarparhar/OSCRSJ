-- Narrative Review launch + checklist hard-gates — adds narrative_review to manuscript_type enum,
-- sanra_self_rating + prisma_checklist to file_type enum.
-- Additive only; safe to re-run; no data migration required.
-- Owner: Sushant Session 78 (2026-06-10).
-- Upstream: Manvir Cowork 2026-05-20 — Narrative Review Launch (^handoff-sushant-narrative-review-launch-2026-05-20)
--   + Session 50 PRISMA hard-gate follow-up (CLAUDE.md §11). Combined into one migration because both
--   phases share identical ALTER TYPE mechanics and a single Studio run beats two.
--
-- POSTGRES QUIRK: ALTER TYPE ... ADD VALUE cannot run inside a transaction. Supabase SQL Editor wraps
-- statement blocks in a txn. If this file errors with "ALTER TYPE ... cannot run inside a transaction
-- block", split into three runs (one ALTER TYPE per query) per the migration 014 / 019 precedent.
-- After the ALTER TYPE statements commit, re-run the COMMENTs in a separate query for clean schema
-- annotation. The trailing NOTIFY pgrst, 'reload schema' forces an immediate PostgREST cache refresh
-- so the new enum values are usable from the application without waiting for the ~10-min auto-refresh.

ALTER TYPE manuscript_type ADD VALUE IF NOT EXISTS 'narrative_review';
ALTER TYPE file_type ADD VALUE IF NOT EXISTS 'sanra_self_rating';
ALTER TYPE file_type ADD VALUE IF NOT EXISTS 'prisma_checklist';

COMMENT ON TYPE manuscript_type IS
  'OSCRSJ accepted article types. 2026-05-20 locked narrative_review as the 7th type (shipped Session 78, 2026-06-10). Standard track requires a senior author; Mentored track requires a named OSCRSJ Section Editor co-author. Distinct from review_article (Systematic Review & Meta-Analysis) — narrative reviews use SANRA self-rating, not PRISMA.';

COMMENT ON TYPE file_type IS
  'Manuscript file categories. v1.1 (2026-04-25) added title_page + tables. Session 43 (2026-05-04) added care_checklist (mandatory for case_report) + jbi_case_series_checklist (mandatory for case_series). Session 78 (2026-06-10) added sanra_self_rating (mandatory for narrative_review) + prisma_checklist (mandatory for review_article, i.e. Systematic Review & Meta-Analysis). The Step 2 upload wizard renders these as conditional required slots keyed off manuscript_type; no mandatory checklist for surgical_technique / images_in_orthopedics / letter_to_editor.';

NOTIFY pgrst, 'reload schema';
