-- Migration 027: Manuscript Formatting Service job state + storage (Sushant, Session 89).
-- Slot verified: 026 is the latest committed migration; this is 027.
--
-- Backs the /format free tool. A job is created unauthenticated (email +
-- Turnstile only), so there is NO public RLS access — every read/write goes
-- through the API using the service-role client, which matches on the
-- unguessable job id + the submitter's email. RLS is enabled with no policies
-- so RLS is deny-by-default for the anon/authenticated roles.

-- ---------------------------------------------------------------------------
-- formatting_jobs
-- ---------------------------------------------------------------------------
create table if not exists public.formatting_jobs (
  id            uuid primary key default gen_random_uuid(),
  email         text not null,
  journal_id    text not null,
  article_type  text,
  status        text not null default 'uploaded'
                check (status in ('uploaded','parsed','extracted','verified','rendered','complete','failed')),
  input_path    text,
  figure_paths  jsonb,
  output_paths  jsonb,
  report        jsonb,
  error         jsonb,
  stage_cursor  jsonb,
  rules_version text,
  ip            text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Rate-limiting lookups: jobs per email/day and per IP/day.
create index if not exists formatting_jobs_email_created_idx
  on public.formatting_jobs (email, created_at desc);
create index if not exists formatting_jobs_ip_created_idx
  on public.formatting_jobs (ip, created_at desc);

-- RLS on, no policies → anon/authenticated get nothing; the service-role API
-- client bypasses RLS and is the only access path.
alter table public.formatting_jobs enable row level security;

-- ---------------------------------------------------------------------------
-- Storage bucket (private) — inputs + outputs live under formatting/<jobId>/…
-- ---------------------------------------------------------------------------
-- 25 MB ceiling accommodates a 15 MB manuscript + figures + the output zip;
-- the API enforces the per-file 15 MB manuscript / 10 MB figure limits.
insert into storage.buckets (id, name, public, file_size_limit)
values ('formatting', 'formatting', false, 26214400)
on conflict (id) do nothing;

-- No public storage policies: uploads use short-lived signed upload URLs and
-- downloads use short-lived signed URLs, both minted server-side; the
-- service-role client bypasses storage RLS for pipeline reads/writes.

-- PostgREST schema cache reload (Convention: every schema-changing migration
-- referenced by application code ends with this).
notify pgrst, 'reload schema';
