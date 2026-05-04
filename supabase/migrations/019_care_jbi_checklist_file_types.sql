-- Reporting-checklist mandates — adds care_checklist + jbi_case_series_checklist to file_type enum.
-- Additive only; safe to re-run; no data migration required (pre-launch).
-- Owner: Sushant Session 43 (2026-05-04).
-- Upstream directive: Kanwar — "make CARE mandatory for Case Reports and JBI mandatory for Case Series in the
-- submission portal, surfaced as visible Step 2 upload slots that gate the Submit button". Closes the
-- gap where authors previously stuffed these checklists into the generic supplement slot (or skipped
-- them entirely) despite /guide-for-authors stating both as mandatory since launch.
--
-- POSTGRES QUIRK: ALTER TYPE ... ADD VALUE cannot run inside a transaction. Supabase SQL Editor wraps
-- statement blocks in a txn. If this file errors with "ALTER TYPE ... cannot run inside a transaction
-- block", split into two runs (one ALTER TYPE per query) per the migration 014 precedent. After the
-- ALTER TYPE statements commit, re-run the COMMENT in a separate query for clean schema annotation.
-- A trailing NOTIFY pgrst, 'reload schema' forces an immediate PostgREST cache refresh so the new
-- enum values are usable from the application without waiting for the ~10-min auto-refresh window.

ALTER TYPE file_type ADD VALUE IF NOT EXISTS 'care_checklist';
ALTER TYPE file_type ADD VALUE IF NOT EXISTS 'jbi_case_series_checklist';

COMMENT ON TYPE file_type IS
  'Manuscript file categories. v1.1 (2026-04-25) added title_page + tables. Session 43 (2026-05-04) added care_checklist (mandatory for case_report submissions) + jbi_case_series_checklist (mandatory for case_series submissions). The Step 2 upload wizard renders these as conditional required slots keyed off manuscript_type; they do NOT appear for surgical_technique / images_in_orthopedics / letter_to_editor / review_article submissions.';

NOTIFY pgrst, 'reload schema';
