-- Storage: UPDATE policy on storage.objects for the 'submissions' bucket.
-- Owner: Sushant Session 28 (2026-04-26).
-- Status: applied live in production via Supabase SQL Editor on 2026-04-26
-- during Kanwar's E2E test of the case-report submission flow. This file
-- captures that policy in source so a future Supabase project rebuild
-- reproduces it.
--
-- Why it's needed: storage.objects had INSERT, SELECT, and DELETE policies
-- for the 'submissions' bucket but no UPDATE policy. Combined with the
-- `upsert: true` Storage upload mode introduced in commit bb44ea2 (same
-- session, Step2Files.tsx), this caused retries on a previously-orphaned
-- object to fail with "new row violates row-level security policy" —
-- Supabase Storage's upsert path falls through to UPDATE when the target
-- object already exists, and PG denied the UPDATE for lack of policy.
--
-- The policy mirrors the existing INSERT policy ("Authors can upload
-- pn4br_0"): same `bucket_id = 'submissions'` check, same `authenticated`
-- role, no path/filename pattern matching. Idempotent via DROP IF EXISTS.

DROP POLICY IF EXISTS "Authors can update own files" ON storage.objects;

CREATE POLICY "Authors can update own files"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'submissions'::text)
WITH CHECK (bucket_id = 'submissions'::text);
