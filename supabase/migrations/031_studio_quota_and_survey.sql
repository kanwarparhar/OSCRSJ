-- Migration 031: Submission Studio free-run quota + unlock survey
-- (Sushant, 2026-07-26). Slot verified: 030 is the latest committed migration.
--
-- Kanwar directive, 2026-07-26. The Studio moves from a rolling DAILY rate
-- limit to a LIFETIME free allowance for the free period ending 2026-09-01:
--
--   * 3 completed runs per email address per ROLLING SEVEN DAYS, shared across
--     the formatter and the Finder assessment. Runs age out individually seven
--     days after they happen, so the allowance refills continuously rather than
--     all at once on a calendar boundary.
--   * The allowance can additionally be refilled ON DEMAND exactly ONCE, and
--     only by completing the feedback survey. That is the trade: honest
--     feedback buys an immediate refill instead of waiting out the window. The
--     cap of one keeps it feedback and not a renewable currency.
--   * Admin addresses bypass all of it (lib/studio/quotaConstants.ts).
--
-- Three design points worth writing down, because each one was a choice:
--
--   1. USAGE IS DERIVED, NOT COUNTED. There is no runs_used integer anywhere.
--      Consumption is computed from formatting_jobs at check time (see
--      lib/studio/quota.ts). A stored counter is a second source of truth that
--      drifts the first time a job row is deleted, a transaction half-fails, or
--      someone fixes data by hand -- and drift here means either locking out a
--      paying-in-goodwill user or handing out free runs. The only thing this
--      migration stores is the EPOCH the count runs from.
--
--   2. ONLY COMPLETED RUNS ARE CHARGED. A job that fails inside our pipeline is
--      free. This is deliberate: charging for our own parser bugs both angers
--      the exact users we are trying to learn from AND poisons the failure data
--      we are collecting, because a user who loses a third of their allowance
--      to a crash stops reporting crashes and just leaves. The abuse this opens
--      (start jobs, never finish) is closed by the in-flight grace window in
--      lib/studio/quota.ts plus the surviving per-IP daily cap, not by billing
--      people for our defects.
--
--   3. THE SURVEY IS ITS OWN TABLE, NOT A JSONB BLOB ON THE QUOTA ROW. Survey
--      responses are the deliverable of this whole exercise -- they are read by
--      analytics, exported to Sheets, and will outlive the quota mechanic that
--      motivated them. A response row is immutable history; a quota row is
--      mutable state. Different lifetimes, different tables.

-- ---------------------------------------------------------------------------
-- 1. Terms acceptance on formatting_jobs
-- ---------------------------------------------------------------------------
-- From 2026-07-26 there are TWO boxes, and the distinction is load bearing:
--
--   * Agreement to the Submission Studio Terms is REQUIRED. Its version lands
--     in terms_version below.
--   * Marketing consent is a SEPARATE, OPTIONAL, unticked box. It keeps its
--     migration-029 columns and its own version, and marketing_consent is now
--     genuinely false for people who declined rather than true-for-everyone.
--
-- They were briefly bundled into one required box earlier the same day. That
-- was reversed on Kanwar's instruction because bundling makes the marketing
-- permission invalid consent under GDPR/UK GDPR and PECR, where it must be
-- freely given and separate from acceptance of terms, and consent conditioned
-- on service is not consent at all. Recording both versions is what lets us
-- reconstruct exactly what a given person was shown and what they chose.
alter table public.formatting_jobs
  add column if not exists terms_version    text,
  add column if not exists terms_accepted_at timestamptz;

comment on column public.formatting_jobs.terms_version is
  'Version of the Submission Studio Terms the submitter accepted (lib/studio/terms.ts STUDIO_TERMS_VERSION). Null on rows predating migration 031, where consent was collected via the standalone marketing tick box instead.';
comment on column public.formatting_jobs.terms_accepted_at is
  'When the Terms box was ticked. Distinct from consent_at only in principle; kept separate so a future terms-only re-acceptance does not overwrite the marketing consent timestamp.';

-- ---------------------------------------------------------------------------
-- 2. studio_email_quota -- one row per email, created lazily on first run
-- ---------------------------------------------------------------------------
-- Absence of a row is meaningful and normal: it means "never reset, count from
-- the beginning of time". Rows are written only when something non-default
-- happens (a reset is granted, or a survey is recorded).
create table if not exists public.studio_email_quota (
  email               text primary key,
  -- Count completed runs from HERE. Null = from the beginning of time.
  -- Advancing this is what a "reset" physically is: the old jobs stay on the
  -- record for metrics and for the marketing list, they just stop counting
  -- against the allowance. Nothing is deleted to give someone more runs.
  quota_reset_at      timestamptz,
  -- Hard-capped at 1 by application logic AND by the check constraint below.
  -- Belt and braces on purpose: this is the only thing standing between "free
  -- beta" and "unlimited free tool with a survey speed bump".
  reset_count         integer not null default 0,
  survey_completed_at timestamptz,
  -- Denormalised pointer to the response that bought the reset. Nullable
  -- because a survey can be recorded without granting a reset (someone who
  -- fills it in before running out, or a second submission).
  reset_survey_id     uuid,
  first_seen_at       timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint studio_email_quota_reset_count_check check (reset_count >= 0 and reset_count <= 1)
);

comment on table public.studio_email_quota is
  'Per-email Submission Studio allowance state. Rows are sparse: no row means no refill has ever been granted, so the count runs over the plain rolling window. Usage itself is NEVER stored here -- it is derived from formatting_jobs at check time over max(quota_reset_at, now - STUDIO_QUOTA_WINDOW_DAYS). See lib/studio/quota.ts.';

alter table public.studio_email_quota enable row level security;
-- RLS on with no policies: deny-by-default for anon/authenticated. Every read
-- and write is service-role from the API, same posture as formatting_jobs.

-- ---------------------------------------------------------------------------
-- 3. studio_survey_responses -- immutable feedback history
-- ---------------------------------------------------------------------------
create table if not exists public.studio_survey_responses (
  id               uuid primary key default gen_random_uuid(),
  email            text not null,
  -- Wording changes bump this. Analytics MUST group by it before comparing
  -- distributions: a question whose options changed is a different question,
  -- and silently pooling the two is how you get a confident wrong answer.
  survey_version   text not null,
  -- The full answer set, keyed by question id (lib/studio/survey.ts).
  -- jsonb rather than 11 columns because the question set will change at least
  -- twice before September and a schema migration per wording tweak is a tax
  -- that gets paid by NOT asking the better question.
  responses        jsonb not null,
  -- Promoted out of the blob for indexing. Only usefulness: it is the one
  -- number that gets averaged and filtered on constantly. The `role` and
  -- `willingness_to_pay` columns an earlier draft carried are gone with their
  -- questions (cut 2026-07-26); a column nothing writes to is a standing
  -- invitation to segment on a dimension that does not exist.
  usefulness       smallint,
  -- True when this response is the one that bought the reset. At most one per
  -- email in practice; enforced in application logic, not here, because a
  -- partial unique index would fight the retry path.
  granted_reset    boolean not null default false,
  -- Opt-in permission to reply to this person about their answers. Its own
  -- column rather than a key inside `responses`, because it is permission and
  -- not data: anyone building a follow-up list filters on it, and a permission
  -- flag buried in a jsonb blob is one that eventually gets missed.
  follow_up_ok     boolean not null default false,
  -- Rough completion time, from the client. Used only to spot people who
  -- speed-ran it to get the reset, whose free-text is usually worthless.
  duration_seconds integer,
  ip               text,
  created_at       timestamptz not null default now()
);

comment on column public.studio_survey_responses.duration_seconds is
  'Client-reported seconds from survey open to submit. Advisory only, trivially spoofable, and used for exactly one thing: flagging sub-30-second responses as low-confidence before anyone acts on their free text.';

create index if not exists studio_survey_responses_created_idx
  on public.studio_survey_responses (created_at desc);
create index if not exists studio_survey_responses_email_idx
  on public.studio_survey_responses (email, created_at desc);

alter table public.studio_survey_responses enable row level security;

-- ---------------------------------------------------------------------------
-- 4. NO BACKFILL IS NEEDED (and one would be wrong)
-- ---------------------------------------------------------------------------
-- An earlier draft of this migration carried a grandfather backfill, stamping
-- every pre-existing address with a fresh epoch. That was written against a
-- LIFETIME allowance, where counting from the beginning of time would have
-- locked out anyone who had legitimately used the old 3-per-DAY formatter more
-- than three times ever.
--
-- The rolling seven-day window removes the problem at the root: usage is only
-- ever counted over the last week, so every historical job is already outside
-- the window and nobody carries anything into the new scheme. The backfill was
-- deleted rather than kept "just in case", because it is not inert. Writing a
-- quota_reset_at for every address makes the window start at the migration
-- timestamp instead of at now-7d for as long as that timestamp is recent, and
-- more importantly it would create thousands of rows in a table whose whole
-- design assumes it stays sparse (absence of a row is the meaningful default).

-- ---------------------------------------------------------------------------
-- 5. Supporting index for quota derivation
-- ---------------------------------------------------------------------------
-- The quota check reads (email, status, created_at) for one address since its
-- epoch. formatting_jobs_email_created_idx (migration 027) already covers the
-- lookup; status is fetched from the heap. At Studio volumes that is correct
-- and adding a third index would cost more on write than it saves on read.

-- PostgREST schema cache reload (Convention: every schema-changing migration
-- referenced by application code ends with this).
notify pgrst, 'reload schema';
