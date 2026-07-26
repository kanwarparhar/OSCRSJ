# Journal Finder v2 — execution report

> Executed 2026-07-25 against `docs/2026-07-25-finder-v2-ladder-build-brief.md`, one Claude Code session, three phases in order. All three gates passed.
>
> **STATUS: LIVE.** Migration 030 was run by Kanwar, all commits were pushed on his instruction, and the feature was verified end to end against production with a real manuscript and a real DeepSeek call. See §"Live verification" at the end.

## Commits

| Commit | Phase |
|---|---|
| `f329f05` | Phase 1 — SJR standing data channel |
| `60bb36a` | Phase 2 — assessment engine + ladder + API |
| `bca7de7` | Phase 3 — `/studio/find` v2 UI |
| _(this file)_ | Execution report |

Repo tree 484 → 500 files. No file outside the per-phase permitted surfaces was touched except the two noted in §"Deviations" below.

## Baseline (§0.8)

- `npx tsc --noEmit -p tsconfig.json` → **exit 0**
- `npm test` → **189 tests / 188 pass / 0 fail / 1 skipped**

The brief predicted ~172; Session 103 added 16 after the brief was written. **188 is the real baseline** and it never regressed.

## Gate results

| | tsc | tests | other |
|---|---|---|---|
| **GATE 1** | exit 0 | 194 / 193 pass / 1 skip (+5) | generator byte-identical on re-run; **all 75 rows machine-compared against the §2.1 table, 0 mismatches** |
| **GATE 2** | exit 0 | 222 / 221 pass / 1 skip (+28) | grep gates clean; migration written |
| **GATE 3** | exit 0 | 222 / 221 pass / 1 skip | **`next build` succeeded**; all 7 UI states reached; 0 console errors |

Phase 1 cross-check went beyond the brief's "eyeball 5 more": every row of the §2.1 table was parsed out of the brief and compared to the generated file programmatically. **75/75 exact.**

### Grep gates

- `grep -rn "accept" lib/finder/ladder.ts lib/finder/assess.ts | grep -i "probab\|likel\|chance"` → **empty**
- `grep -n "isSelf" lib/finder/ladder.ts` → exclusion is at candidate-set construction (line 197), before any slotting
- `grep -rn "probability\|likely to accept\|acceptance rate" app/(formatter)` → two hits, both acceptable: a code comment *forbidding* such language, and the `/studio/find` schema description **denying** it ("Reports tier alignment, never a probability of acceptance"). No user-facing claim.

## Cron coverage confirmation (§3.8) — CONFIRMED BY READING THE CODE

`/api/cron/cleanup-preview-artifacts` selects from `formatting_jobs` filtered **only** on `updated_at`, with **no `kind` filter**, and derives every storage path from `row.id` (`<id>`, `<id>/input`, `<id>/output`). Finder assessment jobs are rows in that same table storing their upload at `storagePaths.input(jobId)` = `<jobId>/input/manuscript.docx`, and their two sidecars at `<jobId>/meta.json` and `<jobId>/assess-input.json` (root level, which the reaper's first prefix covers).

**Finder uploads are therefore reaped by the existing 7-day retention cron with zero changes to it.** Their statuses (`uploaded` → `extracted` → `complete`/`failed`) are all inside 027's existing CHECK constraint, so `retentionActionFor` classifies them correctly with no changes either. This was the deciding reason to reuse `formatting_jobs` rather than create a new table: a separate table would have sat silently outside the only retention promise the Studio makes in writing.

## Migration status — ✅ RUN AND VERIFIED

**`supabase/migrations/030_finder_assess_kind.sql` was run by Kanwar** after the three phases landed. Verified live: the `kind` column is readable through PostgREST (so the schema cache reloaded), pre-existing rows carry the `format` default, and newly created assessment rows carry `finder_assess`.

The section below records the pre-migration state, which is worth keeping because it is the evidence that the fail-closed path works.

**Slot 029 was already taken.** The brief specified `029_finder_assess_kind.sql`, but `029_studio_tracking_and_consent.sql` (Session 103) was already committed in `dd904c4` before this work began. Per the repo's migration-slot-arithmetic convention the file landed at **030**. Nothing else changed.

The defensive wrap required by §3.8 is in place and **was verified live**: with the migration unrun, `POST /api/finder/assess` returns

```
[503] {"error":"The assessment service is not fully set up yet (database migration 030_finder_assess_kind.sql has not been run). Please try again later."}
```

and the UI renders that message in its error state. The job row created just before the failure is **rolled back** (`deleteJobRow`), verified against the live database: **0 rows remain** for the probe address. No test data is owed.

## Ambiguities resolved under §0.7

Each resolved toward doing less, showing less, or claiming less.

1. **Migration slot 029 → 030.** Collision with shipped Session 103 work. Documented in the migration header.
2. **Upload transport: signed URL, not multipart.** The brief said "multipart upload". The formatter uses a signed-upload-URL handshake, and matching it is what guarantees the identical storage path the retention cron depends on. Multipart would have meant a new write path outside that guarantee. The brief's actual requirements — "same size/magic checks" and "the SAME storage path convention" — are both satisfied, and better. Size cap + `PK\x03\x04` magic are checked server-side on first sight of the bytes, exactly as `run.ts` does.
3. **`POST /api/finder/assess/[id]` advances; `GET` only polls.** The brief listed two routes but the assessment has to run somewhere. A GET that did the work would re-fire on every poll.
4. **A second POST rebuilds the ladder.** The brief's state machine asks the three questions *after* showing the profile, so the ladder must be recomputable from a stored profile. `rebuildLadder` re-derives the anchor from the same verified fields with the new author shift, and makes **no second DeepSeek call**.
5. **Consent is required on the assessment path.** The brief predates/parallels Session 103's consent gate and does not mention it. This path collects an email, so it collects it under the same disclosed terms, same `CONSENT_VERSION`/`CONSENT_SCOPE`, gated client- and server-side. Leaving it ungated would have created a Studio email-collection path with no recorded agreement and made the shipped `/privacy` copy false again.
6. **`journal_id` sentinel.** `formatting_jobs.journal_id` is `NOT NULL` and an assessment has no target journal. The row stores the literal `finder_assess`. A real slug would have been a fabricated target.
7. **Manual mode is not double-logged.** `/api/finder/match` already writes its own "Finder Submissions" row; adding a second would double-count demand. Only the upload path writes the new envelope row.
8. **Word count is the one stat read from the upload.** Everything else in `ManuscriptStats` stays null so the sparse-input notice tells the truth about what was checked.
9. **`lib/finder/assessJob.ts` is a new file not named in the brief.** Server-only glue (Supabase, registry, OOXML) kept out of `assess.ts` so the pure engine stays unit-testable without those imports.

## Deviations from the brief's "do not modify" list

Two, both additive and both necessary to compile:

1. **`lib/finder/match.ts`** — added the `export` keyword to `articleTypePhrase` and `bestIndexRank`. No scoring logic changed; the brief explicitly instructs reusing `articleTypePhrase` and `parseReviewWeeks`, and the first two were module-private.
2. **`tests/finder-match.test.ts`** — the v1 fixture builder needed the new required `sjr` field (defaulted to `NULL_SJR_STANDING`, so v1 behaviour is unchanged). Without it `tsc` fails.

Also: `EnrichedMeta` in `journalMeta.ts` now omits `sjr` as well as `accepts_case_reports`, so the 75 data entries stayed untouched and SJR remains a merged/derived channel rather than hand-maintained data.

## ⚠️ Flagged, not changed: em dashes in the §3.5/§3.6 templates

§4 restates the Session-96 house rule — "no em dashes in any user-facing string" — while §3.5, §3.6 and §3.4 step 6 specify template strings **verbatim that contain em dashes**. Both are in the brief.

The Phase 3 copy deck (`FINDER_V2` in `_copy.ts`, all of §4.2) is **clean**: zero prose em dashes. The only remaining ones are the four brief-verbatim engine templates in `lib/finder/ladder.ts`:

- `"Above your manuscript's verified tier — worth a shot if you can absorb a longer path."`
- `" SJR {sjr} — #{rank} in {category}."`
- `"...management-changing cases — lead with what this case changes."`
- `"Shown as {band} — few {band}-range journals accept {phrase} in this scope."`

Kept verbatim because §4.2 says these strings are load-bearing and to flag rather than change. **This is the flag.** They are four one-character edits if Franklin or Kanwar wants the house rule to win. (The `—` used as the "unknown value" dash in metadata rows is the existing house convention — §4.2 itself specifies "Unknown values render as a dash" — and is not affected.)

## Manual walkthrough (§4 GATE 3)

Driven against `npm run dev` in a real browser. **0 console errors** throughout.

| State | Reached | Evidence |
|---|---|---|
| `idle` | ✅ | Hero H1/sub verbatim, dropzone, article type, 11 subspecialty chips, email, consent block, "Build my profile", manual link |
| `manual_form` | ✅ | Self-reported banner, questions intro, Q1/Q2/Q3, "Build my ladder", back link |
| `uploading` → `processing` | ✅ | `aria-busy="true"`, "Reading your manuscript…", "Please keep this tab open" |
| `profile_review` | ✅ | Heading, verbatim quote rendered in mono, **all three field states** (verified chip / "Not stated in the text we read." / "We could not verify this against the text, so it is not used."), truncation note, Level of evidence IV |
| `results` (upload) | ✅ | Bands `REACH,REACH,TARGET,TARGET,SAFETY`, disclaimer, OSCRSJ card, all-eligible expander, provenance footer |
| `results` (manual) | ✅ | Same, plus **both disagreement lines** rendered from the real derivation |
| `error` | ✅ | Forced by the real 503; message names migration 030; "Start over" present |

`uploading`/`processing`/`profile_review` were exercised with the **two assess endpoints stubbed at the transport layer only** (no app code modified) because migration 030 is unrun; the ladder in that run still came from the real `/api/finder/match`. `error`, `idle`, `manual_form` and manual `results` were fully real. **A real end-to-end upload with DeepSeek has not been run and is Kanwar's post-migration check.**

### Engine behaviour observed on the real 75-journal registry

The relative-banding design works exactly as §1 predicted:

- **spine case report** → ladder banded among spine case-report venues (`asian-spine-journal`, `acta-orthopaedica`, `european-spine-journal`, `nassj`, `aots`). JBJS and BJSM never appear, because they are not eligible. 33 eligible.
- **systematic review** (level 1, anchor 0.90) → reach `sports-medicine` (#2) + `bjsm` (#1), targets `ajsm`/`arthroscopy`. The top-tier ladder is correct.
- **case report + "adds to established literature"** → anchor 0.20 and the §3.6 rule-4 strengthen line fires.
- **editorial** → `showOscrsjCard` is **false** on real data, because OSCRSJ's rule file does not list `editorial`. The pure article-type/scope gate works against the registry, not just the fixture.
- `oscrsj` appeared in a ladder slot in **zero** of every configuration tried, live and in the 126-combination unit invariant.

## Tests added (33 total, all passing)

`tests/finder-sjr.test.ts` (5) · `tests/finder-ladder.test.ts` (15) · `tests/finder-assess.test.ts` (13).

Worth knowing about two of them:

- **The isSelf invariant** loops 9 anchors × 7 priority sets × 2 article types = **126 configurations** and asserts OSCRSJ never occupies a slot in any of them.
- **`showOscrsjCard` independence** asserts the same answer across all 9 anchors, enforcing that our own journal's visibility can never become a function of an assessment we performed.

The ladder fixtures use **invented slugs**, deliberately: binding them to real registry data would turn Janine's monthly re-verification into a false engine regression.

## Post-session gates (not the executor's)

1. **🔴 Kanwar — run `supabase/migrations/030_finder_assess_kind.sql`** in Supabase Studio (idempotent, ends with the PostgREST reload). **Nothing on the upload path works until this runs** — it fails closed with the message above, by design. Then: one real manuscript end to end, eyeball the profile honesty (do the quotes really appear in your text?), and push when satisfied. Push is the public flip.
2. **Janine** — SJR-cell spot audit (manifest → `sjrData.ts` → UI chip, ≥10 journals) plus sign-off that the upload path inherits the 7-day retention (confirmed above by code reading, not yet observed live) and that the **editorial firewall now has a second inlet**: the Finder upload path collects an email under the same required-consent terms as the formatter, so it feeds the same combined list. That extends the Session 99 control to a surface it did not previously cover, and your DOAJ disclosure should account for it.
3. **Franklin** — visual pass at 375/768/1440 on all seven states. The ladder slot card is the densest new surface (band chip + 2 chips + title + button + why + borrow note + expectation + strengthen + review speed + expandable checks + metadata row) and the most likely to break at 375. Also: the em-dash decision above is yours.
4. **John** — re-baseline `/studio/find` after deploy. The page's metadata, JSON-LD description and `featureList` all changed from "constraint checker" to "tiered recommender", so pre-deploy impressions are not comparable.
5. **Sheet header row** — the "Finder Submissions" tab gains a different 8-column shape for assessment rows (timestamp, article type, design, anchor, top reach slug, eligible count, mode, IP). Same known Apps Script caveat as before.

## Parallel session on the same branch

Two commits from a concurrent session interleaved with mine: `6c9e0cb` (docs: 029 + Apps Script deploy) and `3c59638` (Studio tabs move to the Admin Manuscript Hub). They are the reason `.git/HEAD.lock` had to be cleared twice mid-session (stale zero-byte locks from contention; moved to `.git/.stale-junk/` per the FUSE convention, never `rm`'d).

**Zero file overlap verified** between their two commits and my four. They did touch `lib/integrations/googleSheets.ts`, which my assessment logger imports, so the full battery was **re-run on the combined HEAD**: `tsc` exit 0, **222 tests / 221 pass / 0 fail / 1 skipped**, `next build` compiled successfully. `appendRowToSheet`'s signature is unchanged.

Note their `6c9e0cb` records that migration **029** was deployed. That is Session 103's tracking/consent migration, unrelated to and not a substitute for **030**, which is still unrun.

## Live verification (post-push)

Everything below ran against `https://www.oscrsj.com` after the push.

**A production defect was found by the first real end-to-end run, and it was bigger than this feature.** The assessment completed but every field came back null, with this disclosed error:

```
DeepSeek HTTP 400: "The supported API model names are deepseek-v4-pro or
deepseek-v4-flash, but you passed deepseek-chat."
```

DeepSeek retired `deepseek-chat`, and **four call sites had the name hardcoded independently**: the formatter's title-page extractor (`pipeline/extract.ts`), the formatter's reference parser (`references/parse.ts`), the Finder's assessment extractor, and the Finder's flag-gated explanation writer. So every AI-backed capability in Submission Studio was failing in production simultaneously, each degrading quietly in its own way. **Session 100's "⚠️ Unverified — check manually" on all five well-formed DOI-bearing references, filed then as possible DeepSeek variance, was this.** It was not transient, and the open follow-up asking for "one deliberate re-run before announcing" can be closed by this fix rather than by a re-run.

Fixed in `16ce648`: the name now lives once in `lib/deepseekModel.ts`, is resolved per call, and is overridable with a `DEEPSEEK_MODEL` env var. Default is `deepseek-v4-flash`, the cost and latency successor to the model this product's ~$0.0014/manuscript figure was measured against; `deepseek-v4-pro` is a one-variable change in Vercel if extraction quality proves weak. This is precisely the failure the repo's constant-fix-repo-wide-grep convention exists to catch.

**Real end-to-end run after the fix** (`oscrsj-example-case-report.docx`, article type case report, subspecialty trauma):

| Field | Value | Confidence | Quote |
|---|---|---|---|
| design | `case_report` | high | "We describe a case of complete iatrogenic median nerve palsy in a 7-year..." |
| sampleSize | `1` | high | "A 7-year-old previously healthy boy" |
| followUpMonths | `12` | high | "Surveillance examination at 12 months showed no residual deficit." |
| multicenter / comparative / statsReported / noveltyClaim | null | — | correctly silent for a case report |

Level of evidence V, anchor 0.25, `extractionError: null`, 13s. Ladder built; `oscrsj` absent from every slot; OSCRSJ card shown. **No `cost` key on the wire.** Every surviving quote passed the substring guardrail against the real manuscript.

Also verified live: `kind='finder_assess'` set on all three test rows; consent gate rejects `marketingConsent:false`; article-type validation rejects junk; the manual ladder path returns the spine-banded ladder; the deployed page carries the verbatim hero, the four "how it is scored" steps, a Studio-scoped `twitter:title`, and an `og:image`.

**Test data cleaned up by me**: three `formatting_jobs` rows (`d67f5498`, `0057a3c6`, `a4cac07f`) plus all eight storage objects deleted; zero remain. Nothing is owed to Kanwar.

## Out of scope, confirmed not built (§6)

No outcome tracking or calibration loop; `explain.ts` untouched and still off; no registry expansion; no `apc_amount`/`apc_currency`; no two-tier et-al; no `figures_tables_combined_max`; **no Impact Factor field anywhere**; no change to the formatter product.
