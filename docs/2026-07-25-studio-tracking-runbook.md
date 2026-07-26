# Submission Studio — usage tracking, API cost, and marketing consent

**Shipped 2026-07-25.** Three things Kanwar asked for on the same day:

1. Studio usage tracked into a Google Sheet, refreshed every morning.
2. DeepSeek API cost visible alongside it.
3. Email addresses collected for marketing, with the person knowing they are signing up.

This document is the setup runbook and the reference for what each number means.
Nothing below works until the four setup steps in §1 are done.

---

## 1. Setup — DONE 2026-07-25 (same session, via Chrome)

> **Both steps below were executed and verified.** Migration 029 is applied to
> production (all six checks pass, §1.1) and the Apps Script is redeployed as
> **Version 2 on Jul 25, 2026, 4:54 PM**, deployment ID and web-app URL
> unchanged so no Vercel env edit was needed. Two pre-existing defects were
> found while doing it and are recorded in §8. Kept below as the runbook of
> record and for whoever repeats this on a second environment.

## 1. Setup (Kanwar, roughly 15 minutes, once)

### 1.1 Run migration 029

Supabase Studio → SQL Editor → paste `supabase/migrations/029_studio_tracking_and_consent.sql` → Run.

It adds four consent columns to `formatting_jobs`, creates `finder_queries`, creates
`studio_daily_metrics`, and ends with `notify pgrst, 'reload schema'`. Idempotent —
safe to re-run.

**Verify:**

```sql
select column_name from information_schema.columns
where table_name = 'formatting_jobs' and column_name like 'consent%';
-- expect: consent_version, consent_scope, consent_at
select count(*) from finder_queries;          -- expect: 0
select count(*) from studio_daily_metrics;    -- expect: 0
```

### 1.2 Re-deploy the Apps Script

The Sheet cannot receive the new tabs until the script that writes them is updated.

Open the **OSCRSJ Form Submissions** sheet → Extensions → Apps Script → replace
`Code.gs` with the current `docs/google-sheets-apps-script.gs` → Save →
Deploy → **Manage deployments** → ✏️ → **New version** → Deploy.

The URL does not change, so no Vercel env var changes. What the new version adds:

- `Studio Daily Metrics` and `Studio Marketing List` tab headers.
- Three consent columns on `Formatter Submissions`.
- `mode: 'replace'`, used to rebuild the marketing list (an append-only tab
  cannot deduplicate someone who formatted three manuscripts).
- Upsert-by-date on `Studio Daily Metrics`, so re-running a day corrects that
  day's row instead of adding a second one.

**If you skip this step:** the daily metrics row will still append (into an
unheadered tab), but the marketing list will silently append duplicates instead
of replacing. Do the re-deploy.

### 1.3 Confirm the env vars on Vercel

All four already exist. Nothing new is needed; this is a check, not a task.

| Var | Used for | Consequence if missing |
|---|---|---|
| `GOOGLE_SHEETS_WEBHOOK_URL` / `_SECRET` | writing both tabs | metrics compute and email fine, sheet stays empty |
| `DEEPSEEK_API_KEY` | reading the account balance | estimated cost still reported, actual spend shows `n/a` |
| `CRON_SECRET` | gating the route | route returns 401 |
| `DIGEST_RECIPIENT_EMAIL` (optional) | brief recipient | falls back to `EMAIL_REPLY_TO`, then `oscrsjournal@gmail.com` |

### 1.4 Backfill and smoke-test

After deploy, from your Mac terminal (needs `CRON_SECRET` from Vercel):

```bash
# yesterday, no email — check the sheet fills in
curl -H "Authorization: Bearer $CRON_SECRET" \
  "https://www.oscrsj.com/api/cron/studio-daily?email=0"

# a specific past day
curl -H "Authorization: Bearer $CRON_SECRET" \
  "https://www.oscrsj.com/api/cron/studio-daily?day=2026-07-20&email=0"

# full run including the email
curl -H "Authorization: Bearer $CRON_SECRET" \
  "https://www.oscrsj.com/api/cron/studio-daily"
```

Expect `{"ok":true,"day":"…","sheets":{"metrics":"ok","marketing":"ok (N)"},"emailed":true}`.

Backfill is safe to run repeatedly: the snapshot is keyed on the day and upserted,
and the sheet upserts on the date column.

---

## 2. What runs when

The job is **not** a sixth Vercel cron. It is called from the existing
`daily-digest` tick at **13:00 UTC = 06:00 America/Los_Angeles**, so the sheet and
the email are both waiting before the working day starts.

Why not its own cron entry: `vercel.json` already declares five, the plan's cron
allowance was never verified, and Session 98 set the precedent of extending an
existing tick rather than claiming another slot. `/api/cron/studio-daily` still
exists as a standalone route for manual runs, so promoting it to a real cron
later is a two-line `vercel.json` change if the allowance turns out to be there.

`runStudioDaily()` never throws. A Studio-side failure cannot take down the
editorial digest, and vice versa.

---

## 3. The metrics, and why each one is there

Appended daily to the **Studio Daily Metrics** tab and summarised in the email.

### Usage — is anyone using it, and does it work

| Metric | Read it as |
|---|---|
| Jobs Started | Raw demand. |
| Completed / Failed / Still Running | Where jobs end up. |
| **Completion Rate %** | **The single health number.** Under ~85% on a real sample means people are hitting something systematic. It moves before anyone bothers to complain. |
| Median Run (s) | A slow run reads to a user as a broken run. |
| Finder Queries | Half the product, and previously uncountable — the Finder was deliberately stateless, so nothing outside the append-only Sheet existed to count. |

### Audience — is it actually useful

| Metric | Read it as |
|---|---|
| Unique Users | Distinct addresses that day. |
| New Users | First-ever job for that address. |
| **Returning Users** | **The number that matters most.** One-and-done traffic is a demo. Anyone formatting a second manuscript is telling you the tool is genuinely useful, and that is the population that will pay. |
| Marketing List Size | Deduplicated consenting addresses to date. |

### Demand — what to build next

Top Journal / Distinct Journals / Top Article Type / Figures Uploaded.

This is the input to the per-journal landing pages question (§11 follow-up, Session
101): which journals to build pages for first, sourced from what people actually
format rather than from a keyword tool.

### Cost — see §4

### Deliberately not tracked

Nothing from inside the manuscript. Every metric is envelope data — journal,
article type, counts, timings. No code in `lib/studio/` reads the author's text.
Keep it that way; it is a large part of what makes the confidentiality copy true.

---

## 4. API cost, and the honest limitation

**DeepSeek publishes no usage or spend API.** The only account-level endpoint is
`GET /user/balance`. The figure on `platform.deepseek.com/usage` cannot be read
programmatically, so it is not mirrored. Two numbers are reported instead, and the
gap between them is itself informative:

| Column | Source | Property |
|---|---|---|
| **Est Cost (USD)** | our own per-job token accounting (`report.cost`) | **Attributable** — per job, per journal, per day. The dashboard number is attributable to nothing. |
| **Actual Spend (USD)** | yesterday's balance minus today's | **True**, including any usage outside the Studio, and immune to rate drift. |

`Cost / Completed Job (USD)` is the unit economics number. It is the figure to
have in hand when the Studio starts charging, since it sets the floor.

When the two diverge materially the brief says so. It means one of two things:
something outside the Studio is using the key, or the hardcoded rates in
`lib/formatting/references/parse.ts` (`PRICE_INPUT_PER_M` / `PRICE_OUTPUT_PER_M`,
which that file already warns will drift) need updating. **Trust the balance
delta; fix the constants.**

The brief also flags a balance under $5. At zero, every job fails at the parse
stage.

---

## 5. Marketing consent

**Kanwar directive, 2026-07-25: consent is required to use the Studio, on one
combined list covering the Studio and the journal.**

### How it is implemented

A checkbox on step 3 of the upload form, unticked by default, that must be ticked
before "Format my manuscript" enables. The API rejects a job without it, so a
hand-rolled POST cannot create a job carrying an address that agreed to nothing.

It is a tick box rather than a passive notice deliberately. The capture rate is
identical — nobody completes a job either way without agreeing — but an
affirmative act with a timestamp is what survives a GDPR or CASL question, and a
notice on a page is not consent in the EU or UK at all.

Every job stores `marketing_consent`, `consent_version`, `consent_scope`, and
`consent_at`. The **version** is stamped server-side from `lib/studio/consent.ts`,
never accepted from the client: a client-supplied version could claim agreement to
wording the user never saw, which is the exact thing the version exists to prove.

### Changing the wording

Edit `lib/studio/consent.ts` and **bump `CONSENT_VERSION`**. Never edit the text of
an existing version. The stored version is the only thing that lets you answer
"what exactly did this person agree to, and when?"

The wording appears in three places, all reading the same constants: the form, the
`/privacy` page, and the Studio's data-handling card. That card was rewritten in
this change — it previously said the address was used "only to prevent abuse" and
was not shared, which stopped being true the moment consent became a condition of
use. **Do not soften it back while the consent box is on the form.**

### Pre-029 rows are excluded, on purpose

Jobs created before this shipped have `marketing_consent = false` and never enter
the marketing list. They were collected under the previous on-page promise. Adding
them retroactively would be using addresses against the terms they were given
under. **Do not "fix" this with a backfill.**

### The open compliance question

`consent_scope` is a column, not a constant, and today reads
`studio_and_journal` for everyone. That is deliberate insurance.

A journal that collects addresses from authors uploading **unpublished
manuscripts** to its free tool, and then emails them soliciting submissions, is
close to the pattern DOAJ's predatory-practice review looks for. DOAJ sits
downstream of the ISSN application, which is the highest-leverage open item in the
journal. Janine's Session 99 editorial firewall exists for this reason and this
change overrides it at Kanwar's explicit direction.

Because the scope is stored per row, journal manuscript-solicitation sends can
later be narrowed to a subset **without re-collecting consent from anyone**. If
DOAJ or a reviewer ever raises it, that is the lever. Nothing auto-sends today —
the list is a sheet and a database column until an ESP is wired up.

### Before the first send

- One-click unsubscribe in every message, honoured in the ESP.
- A physical mailing address in the footer (CAN-SPAM requires it).
- Unsubscribes live in the email tool, **not** in the sheet — the
  `Studio Marketing List` tab is rebuilt from the database every morning and any
  hand-edit is overwritten.

---

## 6. Files

**New:** `supabase/migrations/029_studio_tracking_and_consent.sql` ·
`lib/studio/consent.ts` · `lib/studio/deepseekBalance.ts` · `lib/studio/metrics.ts` ·
`lib/email/templates/studioDailyBrief.ts` · `app/api/cron/studio-daily/route.ts` ·
`tests/studio-metrics.test.ts`

**Changed:** `app/api/cron/daily-digest/route.ts` (calls the Studio job) ·
`app/api/format/jobs/route.ts` + `lib/formatting/pipeline/jobs.ts` +
`lib/formatting/pipeline/api.ts` (consent gate and persistence) ·
`app/api/finder/match/route.ts` (query logging) ·
`app/(formatter)/studio/format/FormatClient.tsx` (the checkbox) ·
`app/(formatter)/_copy.ts` (data-handling card) · `app/(site)/privacy/page.tsx` ·
`lib/integrations/googleSheets.ts` (`replaceSheetRows`) ·
`docs/google-sheets-apps-script.gs`

## 7. Verification status

`tsc --noEmit` exit 0. Full suite **188 pass / 0 fail / 1 skipped** (172 before,
16 new), run in the sandbox via the Session 99 compile workaround, since
`npm test` still cannot run directly on Linux against macOS esbuild binaries.

**Not verified, and needs the post-deploy curls in §1.4:** the live Sheets
round-trip against the re-deployed Apps Script, a real DeepSeek balance read, and
the first brief actually landing in the inbox. `next build` was not run.

---

## 8. What the deploy turned up (2026-07-25)

Two things were already broken before this change. Neither was caused by it;
both were invisible until someone opened the live script.

### 8.1 The Apps Script had never been updated past Version 1 (fixed)

The deployment was still serving **Version 1, 19 May 2026** — the original
Scholars-only webhook. It defined headers for `Scholars Applications` and
nothing else. `Formatter Submissions` and `Finder Submissions` were therefore
auto-created by `insertSheet` with **no header row at all**, because
`HEADERS[sheetName]` was `undefined` for both, and the code only writes headers
it has. Every Studio row since the Studio shipped landed in an unlabelled tab.

The repo copy at `docs/google-sheets-apps-script.gs` had been kept current in
git and simply never deployed. Editing the committed file is not deploying it,
and nothing in the pipeline made that gap visible: rows kept arriving, so the
integration looked healthy.

Fixed: Version 2 deployed, and header rows were inserted by hand on both
existing tabs (a redeploy alone would not have — headers are written only when
a tab is first created). `Formatter Submissions` data moved to rows 2-7,
`Finder Submissions` to rows 2-4. Nothing was overwritten.

### 8.2 The Scholars Applications header row is off by one column (NOT fixed)

The live script carried a 17th header, `AI Policy Ack`, between
`Admin Detail URL` and `Participant Agreement Ack`. `lib/scholars/actions.ts`
builds **16** values and has no AI-policy field, so every application submitted
after that field was dropped from the form writes its
`participantAgreementAck` into the column labelled **`AI Policy Ack`**, and
leaves `Participant Agreement Ack` empty.

Visible in the live sheet: rows 2-8 (older) carry `Yes` in both columns; the
three genuine applicants from 2026-05-24 onward carry `Yes` under
`AI Policy Ack` and **nothing** under `Participant Agreement Ack`.

**This matters because it reads backwards.** Those applicants did acknowledge
the participant agreement. The sheet says they did not, and says instead that
they acknowledged an AI policy that is no longer part of the form.

Deliberately left alone. Deleting column P would destroy the real
`AI Policy Ack` values on rows 2-8, and relabelling it would mislabel those
same rows. It needs a judgment call about which era of the form each row
belongs to — Kanwar's or Manvir's, not a mechanical fix. The freshly deployed
script now carries the correct 16-column header, so any tab created from here
is right.
