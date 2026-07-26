-- 032_quality_cache.sql — methodological quality grading cache (2026-07-26)
--
-- WHY. `temperature: 0` is not a reproducibility guarantee. The same manuscript
-- can grade slightly differently on two runs, and the Finder ladder is anchored
-- partly on that grade, so without a cache an author who simply reloaded could
-- watch their recommended journals move for no reason they caused. This table
-- makes "same manuscript, same score, same ladder" true by construction.
--
-- The key is a SHA-256 of the exact truncated text sent to the model plus the
-- instrument applied, computed in lib/quality/cache.ts. Change a word of the
-- manuscript, or correct the study design so a different instrument applies, and
-- the hash changes and the manuscript is graded afresh — which is correct.
--
-- ADDITIVE AND IDEMPOTENT. Creates one new table. Alters nothing that exists.
-- Safe to re-run.
--
-- NOTE: no manuscript text is stored here. The hash is one-way and the payload
-- is the grade — item verdicts and the quotes that justified them. Those quotes
-- ARE manuscript excerpts, so this table inherits the Studio's 7-day retention
-- posture in spirit; a reaper for it belongs with the existing cleanup cron if
-- this table ever grows to matter.

create table if not exists public.quality_cache (
  content_hash  text primary key,
  instrument_id text not null,
  score         jsonb not null,
  created_at    timestamptz not null default now()
);

comment on table public.quality_cache is
  'Memoized methodological-quality grades, keyed by SHA-256 of (instrument_id + truncated manuscript text sent to the model). Guarantees a manuscript yields the same score and the same ladder on every run.';
comment on column public.quality_cache.content_hash is
  'SHA-256 of `${instrument_id} ${sent_text}`. One-way; no manuscript text is recoverable from it.';
comment on column public.quality_cache.score is
  'A serialized MethodologyScore. Failed gradings are never cached, so a transient network blip cannot be pinned to a content hash permanently.';

-- Cheapest useful index for an eventual age-based reaper.
create index if not exists quality_cache_created_at_idx
  on public.quality_cache (created_at);

-- Service-role only, the same posture as formatting_jobs: RLS on with NO
-- policies granted, so anon and authenticated can reach nothing. Every read and
-- write goes through the server-side admin client.
alter table public.quality_cache enable row level security;

-- PostgREST caches the schema for ~10 minutes; without this, the first writes
-- after deploy fail with "Could not find the table in the schema cache".
notify pgrst, 'reload schema';
