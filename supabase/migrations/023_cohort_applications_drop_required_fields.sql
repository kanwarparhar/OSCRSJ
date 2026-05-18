-- ============================================================
-- Migration 023 — cohort_applications: drop NOT NULL on
-- why_oscrsj
-- ============================================================
-- Surfaced 2026-05-18 (Franklin Cowork). Kanwar trimmed the
-- Research Scholars application form: ORCID, the "Why OSCRSJ
-- specifically?" essay, and References were all removed from
-- /scholars/apply. ORCID + references_json were already nullable
-- (orcid_id is NULL, references_json has DEFAULT '[]'::jsonb),
-- but why_oscrsj was declared NOT NULL in migration 021.
--
-- Without this migration the new shorter form would fail every
-- insert with a NOT NULL constraint violation on why_oscrsj.
--
-- After this migration:
--   * existing rows (zero today) keep their why_oscrsj values
--   * new rows can be inserted without supplying why_oscrsj
--   * the admin detail page already guards rendering for
--     truthy values, so null shows up as an empty section
--
-- PostgREST schema cache reload — DROP NOT NULL changes column
-- metadata that PostgREST caches alongside the column shape,
-- so we notify even though no columns were added.
-- ============================================================

ALTER TABLE cohort_applications
  ALTER COLUMN why_oscrsj DROP NOT NULL;

NOTIFY pgrst, 'reload schema';
