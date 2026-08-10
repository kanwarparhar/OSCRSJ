-- Migration 035: Crossref deposit state machine (Sushant, Crossref DOI Integration Phase 1).
-- Slot verified: 034_apc_payment_wiring is the latest committed migration; this is 035.
-- (The execution plan drafted this as "034" before the APC payment work claimed
-- that slot — numbering is from the actual repo state, per the plan's own rule.)
--
-- WHY THIS TABLE EXISTS
-- Crossref deposits are ASYNCHRONOUS. `POST /servlet/deposit` returns only
-- "your batch has been queued"; the accept/reject verdict arrives later via the
-- submission log (`/servlet/submissionDownload`). Without a durable record of
-- what was deposited, when, under which doi_batch_id, and what Crossref
-- ultimately said, a rejected batch fails SILENTLY — the worst possible failure
-- mode for a permanent identifier that we have publicly asserted.
--
-- Crossref overwrite semantics also make the row important as an audit trail:
-- a re-deposit of the same DOI NULLS any field not supplied, so every deposit
-- must be a complete record. deposit_xml_sha256 lets us prove which exact
-- record produced the DOI's current metadata state.
--
-- Access model copied from 027_formatting_jobs: RLS enabled with ZERO policies,
-- so anon/authenticated get nothing and the service-role client (deposit worker,
-- poller, admin actions) is the only access path.

-- ---------------------------------------------------------------------------
-- crossref_deposits
-- ---------------------------------------------------------------------------
create table if not exists public.crossref_deposits (
  id                 uuid primary key default gen_random_uuid(),
  manuscript_id      uuid not null references public.manuscripts(id) on delete cascade,
  doi                text not null,
  status             text not null default 'queued'
                     check (status in ('queued','submitted','success','failed')),
  -- Crossref's batch handle, returned by doMDUpload; the key for polling the
  -- submission log. Null until the POST succeeds.
  doi_batch_id       text,
  -- sha256 of the exact deposit XML sent, so a later metadata question can be
  -- answered without guessing which generator version produced the record.
  deposit_xml_sha256 text,
  submitted_at       timestamptz,
  confirmed_at       timestamptz,
  attempts           integer not null default 0,
  last_error         jsonb,
  submission_log     jsonb,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- One live deposit per manuscript. 'failed' rows are excluded so a failed
-- attempt can be superseded by a fresh one without deleting the audit trail.
create unique index if not exists crossref_deposits_manuscript_active_idx
  on public.crossref_deposits (manuscript_id)
  where status <> 'failed';

-- Poller hot path: pick up everything not yet resolved, oldest first.
create index if not exists crossref_deposits_pending_idx
  on public.crossref_deposits (status, created_at)
  where status in ('queued','submitted');

-- Lookup by DOI (admin surfaces, re-deposit button).
create index if not exists crossref_deposits_doi_idx
  on public.crossref_deposits (doi);

-- updated_at trigger, mirroring the manuscript_affiliations pattern from 013.
create or replace function public.bump_crossref_deposits_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_bump_crossref_deposits_updated_at on public.crossref_deposits;
create trigger trg_bump_crossref_deposits_updated_at
  before update on public.crossref_deposits
  for each row execute function public.bump_crossref_deposits_updated_at();

-- RLS on, no policies → anon/authenticated get nothing; the service-role client
-- bypasses RLS and is the only access path.
alter table public.crossref_deposits enable row level security;

-- PostgREST schema cache reload (Convention: every schema-changing migration
-- referenced by application code ends with this).
notify pgrst, 'reload schema';
