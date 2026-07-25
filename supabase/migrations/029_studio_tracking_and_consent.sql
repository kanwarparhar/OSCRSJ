-- Migration 029: Submission Studio usage tracking + marketing consent
-- (Sushant, 2026-07-25). Slot verified: 028 is the latest committed migration.
--
-- Three things, all driven by the Kanwar directive of 2026-07-25:
--   1. Record marketing consent on every formatting job, versioned, so we can
--      prove WHICH wording a given address agreed to. Consent is required to
--      use the Studio, so in practice every new row is true -- but the column
--      is nullable-by-default false rather than a constraint, because rows
--      predating this migration were collected under the OLD promise ("we ask
--      for your email only to prevent abuse") and MUST NOT be back-dated into
--      consent. Backfilling these to true would be manufacturing consent that
--      was never given. Leave them false; they are excluded from the list.
--   2. Give the Journal Finder a persistence row so Studio metrics can report
--      Finder demand at all. It was deliberately stateless (Session 94) and so
--      contributed nothing countable outside the append-only Sheet.
--   3. A daily metrics snapshot table, so the morning job is idempotent (a
--      re-run overwrites the day rather than double-appending) and so the
--      DeepSeek balance delta -- which is the only ACTUAL spend figure we have,
--      as opposed to our own per-token estimate -- can be differenced against
--      the prior day without reading the Sheet back.

-- ---------------------------------------------------------------------------
-- 1. Consent columns on formatting_jobs
-- ---------------------------------------------------------------------------
alter table public.formatting_jobs
  add column if not exists marketing_consent boolean not null default false,
  add column if not exists consent_version   text,
  add column if not exists consent_scope     text,
  add column if not exists consent_at        timestamptz;

comment on column public.formatting_jobs.marketing_consent is
  'True when the submitter affirmatively ticked the required consent box. Rows created before migration 029 are false and are NOT eligible for the marketing list.';
comment on column public.formatting_jobs.consent_version is
  'Version string of the exact consent wording shown (lib/studio/consent.ts CONSENT_VERSION). Never reuse a version after changing the words.';
comment on column public.formatting_jobs.consent_scope is
  'What the address consented to receive: studio_only | studio_and_journal. Kept as a column so journal manuscript-solicitation sends can be scoped separately from Studio product sends without re-collecting consent.';

-- Marketing-list build reads consenting rows newest-first per email.
create index if not exists formatting_jobs_consent_idx
  on public.formatting_jobs (marketing_consent, created_at desc);

-- ---------------------------------------------------------------------------
-- 2. finder_queries -- one row per Journal Finder match request
-- ---------------------------------------------------------------------------
-- No email is collected by the Finder and none is added here; this exists to
-- count demand, not to identify anyone.
create table if not exists public.finder_queries (
  id            uuid primary key default gen_random_uuid(),
  article_type  text,
  word_count    integer,
  subspecialty  text,
  top_journal   text,
  counts        jsonb,
  supplied      integer,
  ip            text,
  created_at    timestamptz not null default now()
);

create index if not exists finder_queries_created_idx
  on public.finder_queries (created_at desc);

alter table public.finder_queries enable row level security;
-- RLS on with no policies: deny-by-default for anon/authenticated. Every write
-- is service-role from the API, same posture as formatting_jobs.

-- ---------------------------------------------------------------------------
-- 3. studio_daily_metrics -- one snapshot row per local day
-- ---------------------------------------------------------------------------
create table if not exists public.studio_daily_metrics (
  day                 date primary key,
  metrics             jsonb not null,
  deepseek_balance_usd numeric,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

alter table public.studio_daily_metrics enable row level security;

-- PostgREST schema cache reload (Convention: every schema-changing migration
-- referenced by application code ends with this).
notify pgrst, 'reload schema';
