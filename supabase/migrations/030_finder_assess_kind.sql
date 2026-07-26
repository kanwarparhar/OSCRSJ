-- 030 — Finder v2: distinguish assessment jobs from formatter jobs (2026-07-25)
--
-- SLOT NOTE. The Finder v2 build brief specified this as migration 029. Slot 029
-- was already taken by 029_studio_tracking_and_consent.sql (Session 103, shipped
-- in commit dd904c4) before this work began, so it lands at 030. Nothing else
-- about the migration changed.
--
-- WHY REUSE formatting_jobs RATHER THAN A NEW TABLE. A Finder assessment has the
-- same lifecycle as a formatting job: an uploaded .docx, an async DeepSeek pass,
-- a terminal result, and a 7-day retention obligation. Sharing the table means
-- the existing retention reaper in /api/cron/cleanup-preview-artifacts reaps
-- Finder uploads with ZERO changes — it selects rows by updated_at with no kind
-- filter and derives every storage path from the row id, so a finder_assess row
-- storing its upload at formatting/<jobId>/input/ is already covered. A separate
-- table would have silently sat outside that retention guarantee, which is the
-- one promise the Studio's confidentiality copy makes in writing.
--
-- Idempotent. Safe to re-run.

ALTER TABLE public.formatting_jobs
  ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'format';

-- Guard the vocabulary. Added separately so a re-run does not error on an
-- already-present constraint.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'formatting_jobs_kind_check'
  ) THEN
    ALTER TABLE public.formatting_jobs
      ADD CONSTRAINT formatting_jobs_kind_check CHECK (kind IN ('format', 'finder_assess'));
  END IF;
END $$;

COMMENT ON COLUMN public.formatting_jobs.kind IS
  'format = Submission Studio formatter job; finder_assess = Finder v2 manuscript assessment job (2026-07-25).';

-- Existing rows are all formatter jobs and the DEFAULT already backfilled them.
-- Do NOT backfill any row to finder_assess.

-- PostgREST caches the schema; without this the API fails with "Could not find
-- the 'kind' column in the schema cache" until the ~10-minute auto-refresh.
NOTIFY pgrst, 'reload schema';
