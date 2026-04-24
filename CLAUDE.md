# OSCRSJ Website — Claude Code Context

## Git Safety — READ BEFORE ANY COMMIT OR PUSH

**Background.** On 2026-04-22 a routine favicon-push session accidentally deleted 195 files from `origin/main`. The broken commits (`c46d818` → tree of 2 files, `57c236b` → tree of 4 files) were pushed to GitHub before anyone noticed. The live site kept serving only because Vercel's build of the broken tree failed and it stayed on the prior good deploy. Recovery shipped 2026-04-23 in commits `1f29795` (file restore by a parallel push) + `5150550` (the transparent-favicon change layered on top). Root cause: a `git add -A && commit && push` ran against a corrupted index that thought most project files didn't exist.

**Sanity checks before every commit:**

1. `git ls-tree -r HEAD --name-only | wc -l` — healthy OSCRSJ tree should be ~196-200 files. If HEAD's tree is dramatically smaller than the working tree, **STOP**. The index or HEAD is corrupted; do not commit.
2. `git diff --cached --stat | tail -1` — most feature commits touch 1-15 files. A staged set of 100+ files, especially mostly `new file:` entries, is a **red flag**, not a normal commit. Investigate before pushing.
3. **Never `git add -A` or `git add .` blindly.** Stage by explicit path: `git add app/foo.tsx public/bar.png`. Bulk-staging against a corrupted index is exactly what caused the 2026-04-22 incident.
4. **Never `git reset --hard` or `git push --force` (incl. `--force-with-lease`) without explicit Kanwar approval.** Recovery on 2026-04-23 was only possible because the working tree on disk still had all 197 files; a `git reset --hard` after the destruction would have made recovery require a fresh clone.
5. **If local `main` and `origin/main` diverge in ways you don't fully understand, FETCH and inspect** — `git log HEAD..origin/main` and `git ls-tree -r <SHA> --name-only | wc -l` for each side. Never merge or push until you've explained the divergence in your own words to Kanwar.
6. **Separate concerns across sessions.** If `git status` shows pre-staged files you did not touch in the current session (previous session's agent left work in the index), STOP. Check CLAUDE.md against recent commit history — if a session described as "shipped" has files still sitting staged and never committed, that commit never actually landed. Verify the migration/schema dependency of the stale work has been run in Supabase before bundling it into your commit. If in doubt, `git reset HEAD -- <those paths>` to unstage, commit only the current session's work by explicit path, and flag the leftover work to Kanwar for its owner-agent to resume. Never bundle a different session's feature work into your style/fix commit.

**Recovery cheat-sheet:** the pre-destruction commit is usually findable in `git reflog`. Compare tree sizes with `git ls-tree -r <SHA> --name-only | wc -l` to identify the last healthy commit. Restore by adding back the missing files in a single fast-forward commit titled `fix(repo): restore N source files erroneously deleted by <broken-SHA>`. **Never force-push.** If the FUSE mount between Kanwar's Mac and the Cowork sandbox blocks local git operations with stale lock files (`.git/index.lock`, `.git/HEAD.lock`, `.git/refs/heads/main.lock` that can't be `rm`'d from inside the sandbox — `mv` works around `unlink` failures), do a fresh `git clone` into `/sessions/.../OSCRSJ-push-workspace/`, apply the fix there, push from that clone. After pushing, Kanwar runs `rm -f .git/*.lock .git/refs/heads/*.lock && git fetch && git reset --hard origin/main` from his Mac Terminal to resync the local working copy. When deleting app routes via bash, leftover `.fuse_hidden*` files in the emptied directory are FUSE bookkeeping and don't affect Next.js routing; they clean up on next filesystem sync.

---

## What This Project Is
The official website for **OSCRSJ** (Orthopedic Surgery Case Reports & Series Journal) — Kanwar's independent, open-access orthopedic research journal business targeting medical students, residents, and fellows. Domain: **OSCRSJ.com**. Pre-launch as of April 2026.

---

## Current State
**2026-04-24 Session 18 (Sushant Cowork) — OSCRSJ Renderer.app render chain shipped.** No code changed in this main repo this session. Phase 4 slice 3 shipped as commit `25f3ff4` on the renderer's local `main` at `~/Documents/oscrsj-renderer/` — not pushed to GitHub (Session 17 precedent: Kanwar decides whether the renderer repo goes public, private, or stays local). Tree size 29 → 50 files (24 file changes — explicit-path stage, no `git add -A`). Render chain wires: cleaned HTML → Jinja2-rendered Franklin v1.0 template → WeasyPrint native PDF/A-1b (with `--srgb` output intent + 12-field XMP packet via `--xmp-metadata`) → verapdf 1.30.1 gate → `render-report.json` assembly (matches frozen `RenderReport` interface at `lib/types/database.ts:293`) → Supabase Storage upload at `manuscripts/published_pdf/{id}.pdf` + `{id}_render-report.json` → `manuscripts.status='published'` + `published_date` write-back + audit-log row. UI is a streamed-progress modal behind `useTransition` consuming an NDJSON event stream from `/api/publish/[id]` (live mode) or `/api/smoke/[fixture]` (fixture mode). New route in renderer: `/smoke/[fixture]` for testing against the three vendored fixtures (sample-payload, sample-payload-8-authors, sample-payload-reused-figure). **Implementation pivot from spec deliverable 3:** the gs `PDFA_def.ps` + custom-XMP `/PUT pdfmark` path triggered "Unrecoverable error: rangecheck in `.putdeviceprops`" with gs 10.07.0, AND would have stripped hyperlink annotations needed by Janine compliance items (a) clickable ORCID iD icons + (b) clickable DOI URLs. Pivoted to WeasyPrint 68.1's native `--pdf-variant=pdf/a-1b` path (Franklin README §2/§5 reference impl). The Ghostscript module stays in the tree as defense-in-depth scaffolding for a future iteration; `publishChain.ts` no-ops the stage with an explanatory event so the streamed UI keeps the spec-locked stage list. **Compliance verifications all green (Janine handoff `^handoff-pdf-v1.0-render-endpoint-unblocked` items a–d):** (a) 4 ORCID URIs land as live PDF link annotations in the canonical render's PDF/A-1b output; (b) 11 DOI URIs (page-1 ID bar + suggested citation + every reference with `doi_url`) all live; (c) reused-figure attribution renders italic at end of caption block without clipping (verified against new `sample-payload-reused-figure.json` fixture I authored from canonical + Mont 2015 attribution); (d) 8-author byline wraps cleanly across 3 lines with proper `*+†` symbol cascade and mixed ORCID glyph presence (verified against Franklin's pre-shipped F2 fixture). Fixture renders: canonical 5 pages / 109KB / 4-second wallclock / verapdf:pass / 12 XMP fields / all fonts embedded; 8-author 3 pages / 82KB / 5s / verapdf:pass; reused-figure 5 pages / 110KB / 3.5s / verapdf:pass. **Smoke-test infrastructure stays intentionally separate from the live publish path** — the Session 18 publish endpoint at `/api/publish/[id]` 501s with a helpful message until a payload synthesizer is wired up against a real accepted manuscript (no manuscript in prod yet at session start). When the first manuscript reaches `accepted`, that's the seam to wire — chain itself is fully implemented and validated. **Sanity tests** (Franklin README §8): schema-validate against required keys (now including `declarations.coi_short` per Janine 2026-04-24), running-title ≤45 chars, keyword cardinality 3–5, ORCID regex `^https://orcid\.org/\d{4}-\d{4}-\d{4}-\d{3}[\dX]$`, affiliation-refs cross-reference, corresponding-author consistency, page-count window 3–14, verapdf:pass — auto-caught the missing-coi_short case in pre-render dry runs. **verapdf parser** filters Java 21 reflection-deprecation warnings (per Kanwar 2026-04-24 note) so Java's "WARNING: Final field flavour ... has been mutated reflectively" lines don't get misclassified as render failures. **Locked decisions enforced in code** per Session 18 spec: tool-version probe runs FRESH at the top of every chain run (no caching), publish flow uses confirmation modal with single confirm checkbox (no type-to-confirm, no post-publish undo), upload-success-then-writeback-failure leaves artifacts in Storage and surfaces a "Retry write-back" path via the new `retryWritebackOnly()` action (audit-log uses distinct `article_publish_writeback_failed` + `article_publish_writeback_retried` action values vs. happy-path `article_published`). **Schema sync verified** between renderer and main repo: renderer's `RenderReport` interface byte-identical to main repo `lib/types/database.ts:293`. **Files added** (renderer-side, all under `~/Documents/oscrsj-renderer/`): `lib/renderer/{xmp,weasyprint,ghostscript,verapdf,sanityTests,report,storage,publishChain,streamEvents}.ts` + `jinja_render.py` (Python subprocess pinned to `/usr/bin/python3` for Apple-Python user-site Jinja2), `app/api/{publish,smoke}/[id|fixture]/route.ts`, `app/render/[id]/PublishProgress.tsx`, `app/smoke/[fixture]/{page.tsx,SmokeRunner.tsx}`, `public/template/v1.0/{template.html,template.css,wordmark-ink.svg,sample-payload.json,sample-payload-8-authors.json,sample-payload-reused-figure.json}` (vendored copies of Franklin's locked v1.0 bundle so the chain has a stable read source independent of the vault). **Cleanup pane upgrade** (`app/render/[id]/CleanupPane.tsx`): preview iframe `srcDoc` now injects the vendored `template.css` inline + Lora Google Fonts link so editors clean against final print typography; new "Publish manuscript…" button opens the streamed-progress modal. **Kanwar follow-up actions:** (1) decide whether to push the renderer repo to GitHub — Session 17 + 18 both held local; (2) when first manuscript reaches `status='accepted'`, wire the payload synthesizer (server action that joins manuscripts + manuscript_authors + manuscript_metadata + manuscript_affiliations into the Franklin v1.0 payload shape); (3) Crossref membership decision (~$275/yr) — DOI registration becomes the post-publish DOI flow; (4) the `RENDERER_PYTHON` env-var override in `lib/renderer/weasyprint.ts` lets Kanwar repoint the Python interpreter if his Mac later drops Apple's `/usr/bin/python3` (e.g. macOS 27+ removal). Route count of THIS repo unchanged at 64. This CLAUDE.md edit is the only change to this repo this session. Handoffs pushed: None (Session 18 closes its own deliverable; Janine's `^handoff-pdf-v1.0-render-endpoint-unblocked` 4 compliance items consumed and verified in this session).

**2026-04-23 Session 17 (Sushant Cowork) — OSCRSJ Renderer.app scaffolded.** No code changed in this main repo this session. Phase 4 slice 2 shipped as a **separate Next.js project** at `~/Documents/oscrsj-renderer/` (path intentionally lowercase-hyphenated to disambiguate from this `~/Documents/OSCRSJ/OSCRSJ/` main site repo). Commit `0dbb439` on the renderer's local `main` — not pushed to GitHub (Kanwar decides later whether the renderer repo goes public, private, or stays local). Renderer deliverables: `/` lists `status = 'accepted'` manuscripts via a service-role Supabase client, `/render/[id]` runs `pandoc --from=docx --to=html5 --wrap=none` on the blinded `.docx` downloaded via 30-min signed URL, auto-splits references at the `<h1>References|Bibliography</h1>` heading per Submission Portal Architecture Plan §6.6, shows a 3-column cleanup pane (raw Pandoc read-only `<pre>` / editable textarea / sandboxed iframe preview with 150ms-debounced live diff summary — the `cleanupPass.diffSummary` shape the future `render-report.json` will consume), `/api/health` probes `pandoc >= 3.1`, README documents the Automator launcher recipe. Port 3001 (avoids collision with this main site's dev server on 3000). The renderer's `lib/types/database.ts` mirrors the `RenderReport` interface from `lib/types/database.ts:293` in this repo — any drift requires a paired PR here. Render chain (WeasyPrint + Ghostscript + verapdf + XMP packet injection + `render-report.json` emit + Supabase Storage upload + `manuscripts.status = 'published'` write-back) deferred to Session 18; blocking on Franklin's `template.html` + `template.css` lock at `02 - OSCRSJ/Projects/Article PDF Design System/source/v1.0/` (target 2026-05-16). This CLAUDE.md edit is the only change to this repo this session. Route count unchanged at 66.

**2026-04-23 Session 16 (Sushant Cowork) — Phase 4 foundation shipped.** First slice of the Phase 4 publishing pipeline per Submission Portal Architecture Plan §6. Scope: schema backbone + admin-only surfaces + In Press auto-population. One commit, ~8 files.

Migration 013 (`supabase/migrations/013_phase_4_publishing.sql`, additive-only, manual-run): `manuscripts` gains 7 publishing-lifecycle columns (`elocation_id`, `accepted_date`, `published_date`, `running_title`, `published_pdf_storage_path`, `render_report_storage_path`, `doi`) + partial indexes on (status, accepted_date) for in_production and (status, published_date) for published + a unique partial index on `doi WHERE doi IS NOT NULL`; new `manuscript_affiliations` table (id/manuscript_id/author_id/manuscript_author_id FK/affiliation_order/affiliation_name/department/city/country/ror_id) with the manuscript_authors RLS pattern (author reads+writes own, editor/admin reads all) and an `updated_at` trigger; `manuscript_status` enum gains `'published'` value (TS union already had it). Advisory NOTICE block surfaces the count of post-accept manuscripts missing `accepted_date` for a one-time backfill if non-zero. **Migration-slot arithmetic note:** Session 15 had already consumed slot 012 (pre-revision snapshots); this migration lands in slot 013. The Phase 4 architecture plan §6.10's original call for pre_revision_* columns in "migration 012" is already satisfied by the 012 that shipped in Session 15 under a slightly different shape (a single jsonb snapshot on editorial_decisions rather than flat columns on manuscript_revisions) — so migration 013 does NOT re-add those columns.

Admin-only gate: new `requireAdminOnly()` helper in `lib/admin/actions.ts` alongside `requireEditorOrAdmin()` — editors explicitly do NOT pass. Gates every Phase 4 admin-only surface per §6.1 decision 1.

Two new admin server actions in `lib/admin/actions.ts`: `getPublishedAssetSignedUrl(manuscriptId, which: 'pdf' | 'report')` returns a 30-min signed URL for the published PDF or render-report.json keyed by column lookup (not `manuscript_files` — published assets sit directly on the manuscripts row); `fetchRenderReport(manuscriptId)` downloads + parses the JSON server-side for the viewer route. Both are `requireAdminOnly` and audit-log `admin_published_asset_downloaded`.

Three new UI surfaces on `/dashboard/admin/manuscripts/[id]`: `PublishedPdfPanel.tsx` (server component, read-only; mounted between `RevisionsPanel` and `DecisionHistoryPanel`) shows 3 states — Awaiting render (no PDF yet) / Published ✅ verapdf:pass / Rendered with warnings — with the PDF + report download buttons and a link through to the viewer when a report exists; it peeks into the report to classify pass/warn/fail without loading the full JSON into the card. `PublishedAssetDownloadButton.tsx` client button mirrors the existing `AdminFileDownloadButton` pattern. New admin route `app/dashboard/admin/manuscripts/[id]/render-report/page.tsx` — admin-only (enforced by `fetchRenderReport` — editors hit the editor-or-admin layout then bounce off the action with a clear "Admin-only page" message), `robots: noindex`, pretty-prints the `render-report.json` per §6.11 schema with collapsible `<details>` for the verapdf raw XML / XMP packet / cleanup diff patch (server-component-safe — no client hooks). `RenderReport` TypeScript interface added to `lib/types/database.ts` as the freeze-point the Renderer.app will emit against in a future Sushant session.

`/articles/in-press` rewritten from static placeholder to live server component: pulls `manuscripts WHERE status = 'in_production'` via admin client (safety-fenced by the narrow status filter since RLS would otherwise block anonymous read), orders by `accepted_date DESC`, renders per-article cards with type + subspecialty pills, comma-joined author list with ORCID links where present, accepted date, DOI link (when registered), and a "Full text available soon" caption. Subspecialty labels are now derived from the canonical `SUBSPECIALTIES` list in `lib/constants.ts` so slug changes propagate. Empty state preserved with the encouraging copy; the 4-step workflow explainer section preserved below the listing. `force-dynamic` so new In Press articles surface without a redeploy.

What this unlocks + what comes next: the foundation is the backbone every other Phase 4 piece plugs into. Next slices (pick order Kanwar-gated): (a) **OSCRSJ Renderer.app scaffold** — the local Mac Next.js project at `~/OSCRSJ/renderer/` that emits the PDF + `render-report.json` the panel + viewer consume; (b) **Pre-submission .docx validator** at Step 2 of the submission wizard per §6.7 — gated on Franklin shipping the Author Word Template (`^handoff-author-word-template-v1`) because the 9 constraints only lock once the template exists; (c) **Crossref DOI registration** — needs Crossref membership (~$275/yr, currently not registered); (d) **JATS XML generator** — Janine-owned workstream running parallel to the PDF pipeline; (e) **Proof review workflow** + **Monthly issue assembly** — editorial/publishing-pipeline surfaces. Contribution Matrix row on Submission Portal Architecture Plan for the Phase 4 foundation moves to `✅ delivered`.

**Kanwar follow-up actions:** (1) run `supabase/migrations/013_phase_4_publishing.sql` in the Supabase SQL Editor — watch for the advisory NOTICE on legacy-accepted manuscripts; backfill `accepted_date` via the UPDATE in the NOTICE text if count > 0; (2) the `'published'` ALTER TYPE must commit separately from the column-adds because Postgres rejects `ALTER TYPE ... ADD VALUE` inside a transaction — the migration is written safe-by-default but if Supabase wraps the statement block in a txn, the enum-value step may need to run on its own; Kanwar: if the editor complains about transactions, split the file at the `ALTER TYPE` line; (3) verify the admin detail page renders the new Published PDF card in its "Awaiting render" state on every existing manuscript (visual regression check — should be a benign addition).

---

**2026-04-23 SEO follow-up (post-ship GSC triage)** — After `2ade2d8` shipped, ran GSC Live Test on the 4 former topic slugs to pre-empt the 404 emails. `/topics/sports-medicine` → ✅ URL is available to Google → Request Indexing accepted. `/topics/hand-wrist` → ❌ **Soft 404** because the redirect target `/articles?topic=hand-wrist` renders 0 matching articles (sample set only has 3 articles, covering sports-medicine / trauma / foot-ankle) — Google's Soft 404 detector flags empty-filter views as 404-equivalents. Same pattern will hit `/topics/pediatric-orthopedics` + `/topics/orthopedic-oncology`. **Soft 404s on the 3 sibling URLs are non-blocking** — they self-resolve as soon as each subspecialty gets a real article, and sitemap refetch already removed them from the active crawl queue. But the systemic implication is broader — **any empty filter state on `/articles?topic=<slug>` will Soft-404 until that topic has ≥1 article**. Handoff `^handoff-per-page-seo-acceptance-criteria` pushed to John (2026-04-23) with 4 deliverables: (1) near-term fix for empty-filter Soft 404 via richer empty state OR per-request `generateMetadata` noindex, (2) publish "Per-Page SEO Acceptance Criteria" checklist at [[Technical SEO Pipeline]], (3) codify as an Organization Plan §7.7 brief-authoring gate so every new route ships SEO-correct by construction, (4) retroactive audit of ~30 public-indexable routes. Paired with the existing `^handoff-canonical-metadata-audit-sitewide` — same per-page walk; canonical tag is a line-item on the broader checklist. Sitemap resubmitted successfully in GSC the same session; Google will refetch and see the new 37-URL set. **Future engineers touching `/articles`: if you reintroduce filter-based URLs, they must either (a) guarantee ≥1 indexed result in every category or (b) emit per-request `robots: { index: false }` on empty states, or Google will Soft-404 the empty views. See John's acceptance criteria at [[Technical SEO Pipeline]].**

**2026-04-23 topic-pages retirement + in-page article filtering** — In response to Kanwar's UX directive ("clicking a section on the left should filter the studies on the currently displayed page, not take me to an empty new page") and a GSC 404 flag on `/topics/sports-medicine` (root cause: sitemap declared 8 topic URLs but `app/topics/[slug]/page.tsx` routeData keyed 4 of them under different slugs — `sports` vs `sports-medicine`, `hand` vs `hand-wrist`, `pediatrics` vs `pediatric-orthopedics`, `tumor` vs `orthopedic-oncology`). Shipped in one commit: (1) `app/articles/page.tsx` rewritten as a client component with filter state — topic sidebar is buttons not links, live search over title + abstract + authors + topic + type, Article Type (Case Report / Case Series) filter section DELETED per Kanwar ("serves no value here"), URL reflects active topic via `router.replace('/articles?topic=<slug>', { scroll: false })` with a Suspense boundary around `useSearchParams`, initial topic state seeded from the query param so 301 redirects land on a pre-filtered view, article-card topic pill becomes a filter button, clear-all affordance when a filter is active, graceful empty state. (2) `app/topics/page.tsx` + `app/topics/[slug]/page.tsx` DELETED. (3) `app/sitemap.ts` sheds 9 entries (the `/topics` index + 8 subspecialty slugs) — URL count 46 → 37. (4) `next.config.js` gains a `redirects()` block with 6 entries: 4 explicit legacy-route-key → descriptive-slug mappings (`/topics/sports → /articles?topic=sports-medicine`, and the same for `hand` / `pediatrics` / `tumor`) + a generic `/topics/:slug → /articles?topic=:slug` passthrough + `/topics → /articles`. All permanent (301). (5) `lib/constants.ts` SUBSPECIALTIES list left UNCHANGED — its short slugs (`sports`, `hand`, `tumor`, `pediatrics`) still drive the submission wizard, reviewer application form, and Supabase storage across 15 files; the `/articles` filter UI maintains its own descriptive slug list because URLs ≠ DB keys. The comment block in `lib/constants.ts` is updated to document the separation. Side benefits: the 4-URL topic-slug-mismatch bug is resolved (the routes no longer exist so nothing 404s), the "Duplicate without user-selected canonical" risk shrinks, the search input on `/articles` starts working, and the `/topics` tree stops consuming crawl budget. `tsc --noEmit` clean after `.next` cache clear. Route count 66 → 64.

**2026-04-22 favicon fix (commit `57c236b`)** — `app/icon.tsx` was generating a 64×64 circle with "OS" text that collapsed into an unreadable blob at Google Search's 16px display size. Fixed: `public/favicon.png` added (Kanwar's actual seal from `Logo/jpg/01-seal-cream copy.png`, 486×478); `app/layout.tsx` gains explicit `icons: { icon: '/favicon.png' }` metadata; `app/icon.tsx` rewritten to `readFileSync` + serve the PNG directly; `app/manifest.ts` size corrected to `32x32`. No migration, no new routes. Google Search will update its cached favicon on its own crawl schedule (1–3 weeks).

**Session 15 (2026-04-19, Manvir Cowork) shipped the OSCRSJ brand rollout Tier 1** — replaced `public/logo.svg` + `public/logo-mark.svg` in place (JSON-LD + email templates pick up the new brand automatically with zero schema change); created full `public/brand/` lockup library (8 SVGs with inline `<style>` font-stacks + PNG fallbacks: wordmark-peach, wordmark-ink, seal-cream, seal-dark, masthead-cream, masthead-dark, combined-cream, combined-dark + 2 cover HTMLs); created new file-based special routes `app/apple-icon.tsx` (180×180 iOS home-screen with brown-dark backdrop + peach border + serif wordmark + MMXXVI eyebrow) and `app/manifest.ts` (PWA manifest with `theme_color: '#3d2a18'`); redesigned homepage hero at `app/page.tsx` to replace the text-only `<h1>OSCRSJ</h1>` with the full masthead lockup — eyebrow ("PEER REVIEWED · QUARTERLY") + serif wordmark at clamp(64px, 11vw, 144px) + diamond rule + italic serif subtitle; anchored seal-cream SVGs at `/about` (180-220px) and `/editorial-board` (160-200px); created `app/not-found.tsx` (dark hero with seal-dark + "Lost in the Stacks" headline + 6-tile popular destinations grid + `robots: { index: false }`); created `/media` Press Kit page (8 downloadable lockup cards + 8-color palette + typography + DO/DON'T guidelines); sitemap + Footer updated to surface `/media`. **Route count 65 → 66.** Wrap-up handoffs pushed to Franklin (UI review: cream-on-cream seal contrast audit, responsive homepage hero at 320-375px, DM Serif Display preload gap, optional Brand Guidelines doc, acceptance criteria) + Janine (brand-asset provenance for ISSN/Crossref/DOAJ applications).

A complete Next.js 14 website — **66 pages total** (35 existing + `/news` landing + `/news/ai-in-orthopedics` + 6 category archives + 2 Editor's Pick guides + 11 inaugural AI-in-Ortho briefs shipped 2026-04-16 + `/for-reviewers/apply` shipped Session 7 + `/dashboard/admin/reviewer-applications` shipped Session 8 + `/dashboard/admin/manuscripts` list + `/dashboard/admin/manuscripts/[id]` detail + `/review/[token]` public reviewer invitation page shipped Session 9 + `/review/[token]/form` structured review form + `/review/[token]/manuscript` double-blind manuscript download + `/dashboard/reviewer` auth-gated reviewer dashboard shipped Session 10 + `/dashboard/admin/manuscripts/[id]/reviews/[reviewId]` editor read-only review detail view shipped Session 11). Session 11.5 (2026-04-19) bundled two editorial-UX gap closers with no new route. Session 12 (2026-04-20) shipped Phase 3 kickoff as two commits (`272dbfb` Part A editorial decision composer, `93f6537` Part B revision submission flow). Session 13 (2026-04-21) shipped Phase 3.5 cleanups in one commit: revision-deadline reminder cron at `/api/cron/revision-reminders`, 15-minute decision rescind window with apologetic author email, reject-enum split (`post_review_reject` distinct from `desk_reject`; new `rejected` manuscript_status), and Major-Revisions reviewer auto-re-invite via composer checkbox. Migration 011 + second cron entry in `vercel.json`. **Session 14 (2026-04-22) shipped Phase 3.5 stretch remainder in two commits: `e0c6571` (Part A — batch decision actions on admin manuscripts list) + `9477423` (Part B — revisions panel on admin manuscript detail). Part A: checkbox column + indeterminate select-all + sticky footer "Bulk decision" button that opens a modal composer scoped to selected manuscripts; mixed-status selections are gated before the modal opens with an actionable "filter to eligible" shortcut; sequential per-manuscript `submitEditorialDecision` calls with live per-row ✓/✗ progress; `{{submission_id}}` is the only merge token supported in bulk mode. Part B: read-only "Revisions" card visible when ≥1 `manuscript_revisions` row exists; shows each revision's response-to-reviewers letter + note-to-editor + files uploaded in that version + triggering decision deadline. No field-level title/abstract/keyword/author diff because the schema doesn't snapshot pre-revision state (explicit footer copy says so; a future session adds snapshot columns). No migration this session; route count unchanged at 65. Phase 3.5 complete.** All TypeScript-clean, no 404s. The site includes a full auth system (register, login, password reset), author dashboard, ORCID OAuth integration, Cloudflare Turnstile CAPTCHA, and an AI in Orthopedics hub with 2 Editor's Picks + 20-term glossary + the full inaugural 11-brief slate (Imaging ×2, Surgical Planning ×2, Robotics ×2, Outcomes ×1, LLMs ×2, Research Tools ×2) now live across all six categories. **Live at https://oscrsj.com**.

### Deployment & Infrastructure
| Item | Details |
|---|---|
| **Live URL** | https://oscrsj.com |
| **GitHub Repo** | github.com/kanwarparhar/OSCRSJ (public) |
| **Hosting** | Vercel (free tier) — auto-deploys from `main` branch |
| **Domain Registrar** | GoDaddy — DNS configured |
| **DNS Records** | A record: `76.76.21.21` / CNAME: `cname.vercel-dns.com` |
| **SSL** | Active — auto-provisioned by Vercel (HTTPS) |
| **WWW redirect** | apex oscrsj.com → www.oscrsj.com (307). Canonical is `www`. Any webhook URL (Resend, Crossref, ORCID, Stripe) must use the `https://www.oscrsj.com/...` form — posting to the apex 307s and most services do not re-issue the body on redirect. (This was Session 5's Svix-webhook silent-failure root cause.) **Codebase-wide apex→www sweep shipped in commit `14d03e3` (2026-04-17 Franklin) — every emitted URL in `metadataBase`, `alternates.canonical`, `openGraph.url`, JSON-LD `@graph`, sitemap, robots.txt, server-action fallbacks, and email footer hrefs now uses the www form. Kanwar post-deploy actions: verify Vercel env vars `NEXT_PUBLIC_SITE_URL` + `NEXT_PUBLIC_APP_URL` = www; resubmit sitemap in GSC at www; confirm ORCID redirect URI is www.** |
| **Backup URL** | oscrsj.vercel.app |

**How to deploy updates:** Push any commit to the `main` branch on GitHub → Vercel auto-rebuilds and goes live in ~60 seconds.

### Pages Built — All 43
| Route | File | Status |
|---|---|---|
| `/` | `app/page.tsx` | ✅ Complete |
| `/articles` | `app/articles/page.tsx` | ✅ Complete |
| `/articles/current-issue` | `app/articles/current-issue/page.tsx` | ✅ Complete |
| `/articles/past-issues` | `app/articles/past-issues/page.tsx` | ✅ Complete |
| `/articles/in-press` | `app/articles/in-press/page.tsx` | ✅ Complete |
| `/articles/most-read` | `app/articles/most-read/page.tsx` | ✅ Complete |
| `/articles/most-cited` | `app/articles/most-cited/page.tsx` | ✅ Complete |
| ~~`/topics`~~ | ~~`app/topics/page.tsx`~~ | 🗄️ **Retired 2026-04-23** — replaced by in-page filter on `/articles`. 301 redirect `/topics → /articles` in `next.config.js`. |
| ~~`/topics/[slug]`~~ | ~~`app/topics/[slug]/page.tsx`~~ | 🗄️ **Retired 2026-04-23** — replaced by `/articles?topic=<descriptive-slug>` filter. 301 redirects in `next.config.js` map both old route-key slugs (`/topics/sports` → `sports-medicine`, `/hand` → `hand-wrist`, `/pediatrics` → `pediatric-orthopedics`, `/tumor` → `orthopedic-oncology`) AND the descriptive sitemap slugs (`/topics/sports-medicine`, etc.) onto the filtered `/articles` view. |
| `/submit` | `app/submit/page.tsx` | ✅ Complete |
| `/guide-for-authors` | `app/guide-for-authors/page.tsx` | ✅ Complete (6 article types, full specs) |
| `/apc` | `app/apc/page.tsx` | ✅ Complete |
| `/peer-review` | `app/peer-review/page.tsx` | ✅ Complete |
| `/editorial-policies` | `app/editorial-policies/page.tsx` | ✅ Complete |
| `/open-access` | `app/open-access/page.tsx` | ✅ Complete |
| `/indexing` | `app/indexing/page.tsx` | ✅ Complete |
| `/about` | `app/about/page.tsx` | ✅ Complete |
| `/aims-scope` | `app/aims-scope/page.tsx` | ✅ Complete |
| `/editorial-board` | `app/editorial-board/page.tsx` | ✅ Complete (3 real members + 5 recruiting) |
| `/contact` | `app/contact/page.tsx` | ✅ Complete |
| `/subscribe` | `app/subscribe/page.tsx` | ✅ Complete |
| `/login` | `app/login/page.tsx` | ✅ Complete (Session 2, full auth form + ORCID sign-in) |
| `/register` | `app/register/page.tsx` | ✅ Complete (Session 2, full auth form + ORCID prefill + Turnstile) |
| `/privacy` | `app/privacy/page.tsx` | ✅ Complete |
| `/terms` | `app/terms/page.tsx` | ✅ Complete |
| `/article-types` | `app/article-types/page.tsx` | ✅ Complete (added 2026-04-11) |
| `/templates` | `app/templates/page.tsx` | ✅ Complete (added 2026-04-11) |
| `/for-reviewers` | `app/for-reviewers/page.tsx` | ✅ Complete (full reviewer guide, added 2026-04-11) |
| `/for-reviewers/apply` | `app/for-reviewers/apply/page.tsx` | ✅ Complete (Session 7, reviewer intake form + dual Resend emails) |
| `/faq` | `app/faq/page.tsx` | ✅ Complete (27 questions, 5 categories, added 2026-04-11) |
| `/accessibility` | `app/accessibility/page.tsx` | ✅ Complete (added 2026-04-11) |
| `/dashboard` | `app/dashboard/page.tsx` | ✅ Complete (Session 2, author submissions list) |
| `/dashboard/settings` | `app/dashboard/settings/page.tsx` | ✅ Complete (Session 2, profile editor + Session 8 GDPR export button) |
| `/dashboard/admin/reviewer-applications` | `app/dashboard/admin/reviewer-applications/page.tsx` | ✅ Complete (Session 8, editor/admin-only triage UI, list + inline expand + status transitions + admin notes) |
| `/dashboard/admin/manuscripts` | `app/dashboard/admin/manuscripts/page.tsx` + `ManuscriptsListClient.tsx` + `BulkDecisionModal.tsx` | ✅ Complete (Session 9 editor/admin-only list + Session 14 multi-select with sticky footer + bulk decision modal) |
| `/dashboard/admin/manuscripts/[id]` | `app/dashboard/admin/manuscripts/[id]/page.tsx` | ✅ Complete (Session 9 shell + Session 11.5 adds `InviteByEmailPanel` + `AdminFileDownloadButton` + Session 12 adds `DecisionComposerPanel` + `DecisionHistoryPanel` sibling cards + Session 14 adds `RevisionsPanel` card mounted between composer and history) |
| `/review/[token]` | `app/review/[token]/page.tsx` | ✅ Complete (Session 9, public token-only reviewer invitation page — accept/decline with pre-action confirmation step, `noindex`) |
| `/review/[token]/form` | `app/review/[token]/form/page.tsx` | ✅ Complete (Session 10, public token-only structured review form — 6 Likert scales + recommendation + comments-to-author/editor + CoI, auto-save draft every 30s, `noindex`) |
| `/review/[token]/manuscript` | `app/review/[token]/manuscript/page.tsx` | ✅ Complete (Session 10, public token-only double-blind manuscript download — lists `blinded_manuscript` + `figure` + `supplement` files only, 30-min signed URLs, `noindex`) |
| `/dashboard/reviewer` | `app/dashboard/reviewer/page.tsx` | ✅ Complete (Session 10, auth-gated reviewer dashboard — aggregates invitations by `reviewer_id = auth.uid() OR reviewer_email = auth.email`, partitions Active / Submitted / Past) |
| `/dashboard/admin/manuscripts/[id]/reviews/[reviewId]` | `app/dashboard/admin/manuscripts/[id]/reviews/[reviewId]/page.tsx` | ✅ Complete (Session 11, editor/admin-only read-only review detail — reviewer identity + recommendation pill + 6-row Likert grid with horizontal bars + comments-to-author + comments-to-editor + CoI + invitation history; 404 on draft reviews) |
| `/dashboard/admin/manuscripts/[id]/render-report` | `app/dashboard/admin/manuscripts/[id]/render-report/page.tsx` | ✅ Complete (Session 16, admin-only pretty-printed render-report.json viewer — collapsible verapdf / fonts / sanity tests / tool versions / cleanup diff / XMP sections; `robots: noindex`; gated via `fetchRenderReport` → `requireAdminOnly`; editors bounce off the action with a clear message) |
| `/dashboard/submit` | `app/dashboard/submit/page.tsx` | ✅ Complete (Session 3-4, full 5-step wizard) |
| `/forgot-password` | `app/forgot-password/page.tsx` | ✅ Complete (Session 2, email reset request) |
| `/reset-password` | `app/reset-password/page.tsx` | ✅ Complete (Session 2, new password form) |
| `/news` | `app/news/page.tsx` | ✅ Scaffold (Session Franklin 2026-04-14, AI feed + placeholders for headlines/updates) |
| `/news/ai-in-orthopedics` | `app/news/ai-in-orthopedics/page.tsx` | ✅ Scaffold (hero + primer + 6 category cards + latest + Editor's Picks + glossary placeholder + CTAs + methodology) |
| `/news/ai-in-orthopedics/[slug]` | `app/news/ai-in-orthopedics/[slug]/page.tsx` | ✅ Scaffold — 6 category archives pre-rendered via generateStaticParams |
| `/news/ai-in-orthopedics/[slug]/[brief]` | `app/news/ai-in-orthopedics/[slug]/[brief]/page.tsx` | ✅ Template ready — NewsArticle + ScholarlyArticle JSON-LD in SSR, full Vancouver citation block, cross-links, submit CTA |
| `/news/ai-in-orthopedics/guides/imaging-primer-for-residents` | `app/news/ai-in-orthopedics/guides/imaging-primer-for-residents/page.tsx` | ✅ Complete (Arjun Session 2026-04-14, ~1350 words, institutional voice) |
| `/news/ai-in-orthopedics/guides/llm-guide-for-trainees` | `app/news/ai-in-orthopedics/guides/llm-guide-for-trainees/page.tsx` | ✅ Complete (Arjun Session 2026-04-14, ~1050 words, institutional voice) |

### Components
- `components/Header.tsx` -- sticky header, full dropdown nav, mobile hamburger, search bar, top bar with Submit/Login/Register links (~200 lines)
- `components/Footer.tsx` -- 4-column footer with dark charcoal background (~95 lines)
- `components/PageHeader.tsx` -- reusable page header with breadcrumbs
- `components/Turnstile.tsx` -- Cloudflare Turnstile CAPTCHA widget (dynamic script loading, managed mode)
- `app/dashboard/submit/SubmissionWizard.tsx` -- 5-step wizard shell with progress bar, auto-save, step navigation
- `app/dashboard/submit/Step1Type.tsx` -- Manuscript type radio selector + 3 confirmation checkboxes
- `app/dashboard/submit/Step2Files.tsx` -- 6-category file upload with drag-and-drop, Supabase Storage integration
- `app/dashboard/submit/Step3Info.tsx` -- Title, abstract (word counter), keyword tags, subspecialty dropdown, reviewer suggestions
- `app/dashboard/submit/Step4Authors.tsx` -- Author list with reorder, inline add/edit, ICMJE contributions, certification
- `app/dashboard/submit/Step5Declarations.tsx` -- COI, funding, data availability, ethics, clinical trial, note to editor, full review summary, submit button
- `app/dashboard/admin/manuscripts/[id]/InviteByEmailPanel.tsx` -- Session 11.5 sibling card to `InviteReviewerPanel`; 3 required fields (first name / last name / email) + deadline + optional 500-char note; calls `inviteReviewer({mode: 'email', ...})`
- `app/dashboard/admin/manuscripts/[id]/AdminFileDownloadButton.tsx` -- Session 11.5 client button; calls `getAdminFileSignedUrl(fileId)` → `window.location.href = signedUrl`; `text-xs text-brown hover:text-ink`
- `app/dashboard/admin/manuscripts/[id]/DecisionComposerPanel.tsx` -- Session 12 client component; 4 decision radios (Accept/Minor/Major/**Reject (post-review)**), markdown letter textarea (120-char min), conditional 60-day-default revision deadline picker, "Load template" dropdown with 4 inline outcome-specific templates + merge tokens, desk-reject affordance modal-gated on `status === 'submitted' && reviewCount === 0`, confirm checkbox + optimistic UI. Gates visibility on `status ∈ {submitted, under_review, revision_received}`. **Session 13** adds: live-countdown "Undo decision" banner when the most recent decision was issued by the current editor within 15 min (calls `rescindEditorialDecision`); "Re-invite original reviewers for round 2" checkbox visible when `decision === 'major_revisions'`; Reject radio relabelled to **Reject (post-review)** and now emits `post_review_reject` enum (distinct from `desk_reject`).
- `app/dashboard/admin/manuscripts/[id]/DecisionHistoryPanel.tsx` -- Session 12 server component; interleaves `editorial_decisions` + `manuscript_revisions` rows in reverse-chronological order with color-coded pills, editor name lookup, expand/collapse letter + response-summary. Read-only.
- `app/dashboard/admin/manuscripts/[id]/RevisionsPanel.tsx` -- Session 14 read-only server component; visible only when ≥1 `manuscript_revisions` row exists. Renders each revision with submitted date + triggering-decision deadline + response-to-reviewers letter + note-to-editor + files grouped by version (`manuscript_files.version = revision_number + 1`). Explicit italic footer flags that field-level title/abstract/keyword/author diffs aren't computed because the schema doesn't snapshot pre-revision state.
- `app/dashboard/admin/manuscripts/ManuscriptsListClient.tsx` -- Session 14 client wrapper around the manuscripts list table; checkbox column + indeterminate select-all + sticky footer bar ("{n} selected · Bulk decision · Clear selection"). Opens `BulkDecisionModal` on demand. Selection state is client-side only.
- `app/dashboard/admin/manuscripts/BulkDecisionModal.tsx` -- Session 14 client modal; mixed-status gate with "filter to eligible" shortcut + 4 decision radios + letter textarea (with `{{submission_id}}` per-row merge) + optional deadline + confirm checkbox. Sequential `submitEditorialDecision` loop with per-row ✓/✗ progress. No merge tokens beyond `{{submission_id}}`, no rescind banner, no Major-Rev re-invite checkbox, no desk-reject affordance (desk-rejects still issued per-manuscript).
- `app/dashboard/submit/RevisionStep0.tsx` -- Session 12 read-only client component; renders the editor's decision letter + anonymised Reviewer A/B/C reviews with score bars and deadline pill (red <10 days, amber otherwise). Shown only in revising mode. Does NOT import the admin review-detail component — separate anonymised-display path preserves double-blind.
- `lib/admin/actions.ts` -- Admin-scoped server-action module. Session 11.5 added `getAdminFileSignedUrl(fileId)`. Session 12 added `submitEditorialDecision(args)`. **Session 13** updates the status mapping (`post_review_reject` + legacy `reject` → `rejected`; `desk_reject` → `desk_rejected`); extends `submitEditorialDecision` args with `reInviteOriginalReviewers?: boolean` (when true + decision is major_revisions, calls internal helper `reInviteOriginalReviewers` that enumerates non-draft reviewers on the manuscript, dedupes by email, skips reviewers who already have a post-decision invitation, seeds fresh `review_invitations` rows, fires `reviewerInvitation` Resend emails with a Round-2 editor note pre-filled, audit-logs `reviewer_re_invited` / `reviewer_re_invite_failed`, returns `{reInvited, reInviteSkipped, reInviteFailed}`); adds `rescindEditorialDecision({decisionId, reason})` (editor/admin gate + ownership check `editor_id === auth.uid()` + 15-min window + 50-char-min reason; sets `editorial_decisions.rescinded_at + rescinded_reason`, reverts `manuscripts.status` via `deriveRestoredStatus` helper that walks prior non-rescinded decisions → revisions → reviews to compute the rollback target, audit-logs `editorial_decision_rescinded`, fires apologetic `decisionRescindedAuthor` email).
- `lib/email/resend.ts` -- Resend client singleton + `sendEmail()` wrapper (logs every send to `email_logs`, never throws into callers)
- `lib/email/disputeTokens.ts` -- HS256 JWT sign/verify (30-day expiry) and URL builder for co-author dispute links
- `lib/email/templates/shared.ts` -- Inline-styled OSCRSJ email shell (cream bg, peach CTA, editorial footer) plus paragraph/cta/detailsList helpers
- `lib/email/templates/submissionConfirmation.ts` -- Branded receipt email to the corresponding author
- `lib/email/templates/coAuthorNotification.ts` -- COPE-compliant co-author notice with signed "I did not agree" link
- `lib/email/templates/coAuthorDisputeNotification.ts` -- Dispute notice to corresponding author and editorial office (forEditor flag tweaks wording)
- `lib/email/templates/reviewerApplicationConfirmation.ts` -- Confirmation email to applicant after `/for-reviewers/apply` submission (Session 7)
- `lib/email/templates/reviewerApplicationInternalNotification.ts` -- Internal editorial notification on new reviewer application (Session 7, routed to `kanwarparhar@gmail.com` until Workspace)
- `lib/reviewer/actions.ts` -- `submitReviewerApplication()` server action: validates 10-field intake, inserts into `reviewer_applications`, fires confirmation + internal emails fire-and-forget
- `app/for-reviewers/apply/page.tsx` + `ApplyForm.tsx` -- public reviewer intake form (Session 7)
- `app/api/submissions/[id]/co-author-dispute/route.ts` -- GET handler that verifies the JWT, records the dispute, and renders a confirmation/error page
- `app/api/webhooks/resend/route.ts` -- POST handler that verifies Svix signatures and updates `email_logs.delivery_status` on delivered/bounced/complained events
- `components/icons/ai-ortho/` -- six inline SVG category icons (Imaging, SurgicalPlanning, Robotics, Outcomes, LLMs, ResearchTools); 24x24 viewBox, 1.5px stroke, currentColor for theme inheritance
- `lib/ai-ortho/data.ts` -- typed category list + `AiOrthoBrief` schema (includes optional `keyFigure` field with label + description + url for citing a single canonical figure or table per brief) + `AI_ORTHO_BRIEFS` (populated with 11 inaugural briefs shipped 2026-04-16 across two same-day Arjun Cowork sessions — Husarek commercial fracture detection, Zhu Cobb angle DL, Altahtamouni 3D THA planning meta-analysis, Ma AR pedicle screw RCT, Zhao femoral shaft robotics, Kunze HSS robotic arthroscopy review, Müller TKA XGBoost complications, Keçeci ChatGPT-vs-DeepSeek AAOS clavicle, Mu ChatGPT-in-medicine narrative review, Yao ChatGPT orthopedic literature review, Arias Perez AI research assistant review; 9 of 11 carry `keyFigure` references — Kunze and Mu are narrative reviews with no main-text figures/tables) + helper getters + `AI_ORTHO_GLOSSARY` (20 terms, live on landing page) + `AI_ORTHO_PRIMER` (final 150-word institutional copy, shipped 2026-04-14)
- `lib/schema/newsArticle.ts` -- `buildNewsArticleSchema()` returning NewsArticle + nested ScholarlyArticle JSON-LD for every brief page; injected via inline `<script type="application/ld+json">` inside the server component for SSR rendering (verified on dev — `/news/ai-in-orthopedics/[slug]/[brief]` ships JSON-LD in initial HTML)

### What Doesn't Work Yet (known gaps)
- Forms are static (contact, subscribe, search) -- no backend wired
- Search bar in header is non-functional UI
- No real articles published (3 sample placeholders on `/articles`)
- ~~Supabase Storage bucket~~ ✅ Created (private, 50MB max)
- Auth system built but not yet tested on production (Vercel env vars added) — **Session 7 carry-over: auth retest deferred from Sessions 5 & 6**
- File upload RLS on Supabase Storage bucket should be verified with a real upload test
- ~~No email notifications~~ ✅ Full transactional pipeline live as of Session 6 (2026-04-17): submission confirmation + co-author notification + co-author dispute + withdrawal (author/editor/reviewer variants) all confirmed delivering end-to-end via Resend. `Reply-To: kanwarparhar@gmail.com` wired on every send via `DEFAULT_REPLY_TO` in `lib/email/resend.ts` (env var `EMAIL_REPLY_TO` with Gmail fallback).
- ~~No draft withdrawal button on dashboard~~ ✅ Shipped Session 6 (`app/dashboard/WithdrawButton.tsx` + `withdrawManuscript` server action in `lib/submission/actions.ts`). DRAFT/SUBMITTED/UNDER_REVIEW → WITHDRAWN; invited/accepted reviewers auto-cancelled on `review_invitations`.
- Resend webhook must be registered manually in the Resend dashboard (URL `https://www.oscrsj.com/api/webhooks/resend`, events: delivered/bounced/complained/delivery_delayed) and its signing secret copied into `RESEND_WEBHOOK_SECRET` on Vercel before delivery status updates will flow.
- Migrations 003–007 executed; migration 008 shipped Session 9 (reviewer invitation schema) + migration 009 shipped Session 10 (reviews schema for external reviewers). **Migration 010 (`010_session_11_columns.sql`) shipped in Session 11 — must be run manually in Supabase SQL Editor before review reminder cron, suggest-alternative persistence, or the all-reviews-received email will function**. 010 adds 3 reminder timestamp columns + 3 suggest-alt columns on `review_invitations`, `all_reviews_notified_at` on `manuscript_metadata`, and a partial index on `(status, deadline)` scoped to `status = 'accepted'` for the cron scan. 008 relaxes `review_invitations.reviewer_id` to nullable, adds `reviewer_application_id` FK + `reviewer_email`/`reviewer_first_name`/`reviewer_last_name`/`declined_reason` snapshot columns, a CHECK constraint requiring at least one identity column, and RLS policies gating editor/admin writes.
- ~~No reviewer application form~~ ✅ Shipped Session 7 (`/for-reviewers/apply`). ~~Admin approval UI~~ ✅ Shipped Session 8 (`/dashboard/admin/reviewer-applications` — editor/admin-gated list + inline row expansion + status transitions + admin notes + audit log). Detail subroute deferred; inline expansion carries the whole UI.
- ~~No reviewer invitation workflow~~ ✅ Shipped Session 9. Editor opens `/dashboard/admin/manuscripts/[id]` → "Active reviewer pool" panel ranks applicants by subspecialty match → "Invite" button opens a modal with deadline (default +21 days) + optional note → server action creates a `review_invitations` row + fires `reviewerInvitation` email. Invitee lands on `/review/[token]` (token-only auth, 122-bit `gen_random_uuid()`), sees title/type/subspecialty/abstract only (double-blind — no authors), clicks Accept or Decline, confirms on a second step (prevents email-client preview-fetch auto-accept), and receives a confirmation email while the editorial office gets an editor-notification email. Audit log rows: `invite_sent`, `invitation_accepted`, `invitation_declined`.
- ~~No structured review form~~ ✅ Shipped Session 10 (2026-04-18). Migration 009 + `/review/[token]/form` + `/review/[token]/manuscript` + `/dashboard/reviewer` + 3 new server actions (`saveReviewDraft`, `submitReview`, `getReviewerFileSignedUrl`) + 2 new Resend templates (`reviewSubmittedConfirmation`, `reviewSubmittedEditorNotification`). Phase 2 reviewer arc is now end-to-end functional (apply → approve → invite → accept → review → submit). **Migration 009 (`009_reviews_external_reviewers_and_rls.sql`) must be run manually in Supabase SQL Editor before any review can be saved or submitted.** 009 relaxes `reviews.reviewer_id` to nullable (external token-only reviewers), adds `is_draft boolean NOT NULL DEFAULT true` + `review_invitation_id_snapshot_email` + CHECK identity constraint, narrows `scope_score` from 1–5 to 1–4 (fixes spec mismatch in migration 001), and rewrites RLS policies (editor SELECT/UPDATE + reviewer SELECT-own; no INSERT policy, admin client writes).
- ~~No review reminder email cadence~~ ✅ Shipped Session 11 (2026-04-19). Daily Vercel Cron at 14:00 UTC (`vercel.json`) hits `/api/cron/review-reminders`, bearer-header gated by `CRON_SECRET`. Scans `review_invitations WHERE status = 'accepted'` and fires `reviewReminder` emails at the 10-day / 5-day / overdue thresholds. Idempotency is enforced per-kind by three timestamp columns on `review_invitations` (migration 010) — once set, the cron skips the row for that kind. Audit-logged `review_reminder_sent` with `{kind, invitation_id}`. **Kanwar action before first cron tick: provision `CRON_SECRET` on Vercel (all 3 envs) via `openssl rand -hex 32`.**
- ~~No "suggest alternative reviewer" field on decline~~ ✅ Shipped Session 11. Three optional fields (name / email / note) on the decline confirmation step of `/review/[token]`. Persisted to `review_invitations.suggested_alternative_{name,email,reason}` (migration 010). Admin "Alternative reviewers suggested on decline" panel on `/dashboard/admin/manuscripts/[id]` surfaces them; advisory only — no auto-invite (editor must click through the existing Invite Reviewer modal). Audit-logged `suggested_alternative_reviewer_recorded`.
- ~~No editor detail view for a submitted review~~ ✅ Shipped Session 11 at `/dashboard/admin/manuscripts/[id]/reviews/[reviewId]`. Server component, inherits editor/admin gate from `app/dashboard/admin/layout.tsx`. Read-only — shows reviewer identity (real name / email / affiliation / ORCID — editor sees both identities per §4.3), recommendation pill (color-coded), 6-row Likert grid with horizontal bars, comments-to-author + comments-to-editor (monospace, badged confidential), CoI, and invitation history. Linked from the invitations table on `/dashboard/admin/manuscripts/[id]` only on rows where a non-draft review exists. 404s on draft reviews. No edit affordances — decision UI ships in Phase 3.
- ~~No "all reviews received" editor email~~ ✅ Shipped Session 11. `triggerAllReviewsReceivedIfReady(manuscriptId)` helper in `lib/reviewer/actions.ts` called fire-and-forget from inside `submitReview` after the flag flip. Counts `reviews WHERE manuscript_id = ? AND is_draft = false`; fires `allReviewsReceivedEditorNotification` to the editorial inbox once per manuscript when count crosses ≥2. Idempotency gated by `manuscript_metadata.all_reviews_notified_at` (migration 010). Audit-logged `all_reviews_received_email_sent`.
- ~~No editorial decision composer~~ ✅ Shipped Session 12 (2026-04-20, commit `272dbfb`). `DecisionComposerPanel` on `/dashboard/admin/manuscripts/[id]` — 4 decision radios (Accept / Minor / Major / Reject) + 120-char-min markdown letter + conditional 60-day-default revision deadline + "Load template" dropdown + desk-reject affordance gated on `status === 'submitted' && reviewCount === 0`. `submitEditorialDecision` server action in `lib/admin/actions.ts` gates on `DECIDABLE_STATUSES = {submitted, under_review, revision_received}`, inserts `editorial_decisions` row, flips `manuscripts.status` per mapping, audit-logs `editorial_decision_issued`, fires decision-letter email. 4 Resend templates (`editorialDecisionAccept/MinorRevisions/MajorRevisions/Reject`). `DecisionHistoryPanel` interleaves decisions + revisions chronologically, read-only, expand/collapse full letter.
- ~~No revision-deadline reminder cron~~ ✅ Shipped Session 13 (2026-04-21). Daily Vercel Cron at `0 14 * * *` → `/api/cron/revision-reminders`, bearer-header-gated by `CRON_SECRET` (same secret as the review-reminder cron). Scans `manuscripts WHERE status = 'revision_requested'` joined to the latest non-rescinded `editorial_decisions.revision_deadline` filtered to <10 days out, gated by `manuscript_metadata.revision_reminder_sent_at IS NULL`. Fires `revisionDeadlineReminder` Resend email to the corresponding author, stamps the idempotency timestamp. One-shot per revision cycle (no second tier — the amber dashboard banner is the daily in-app prompt). Audit-logged `revision_reminder_sent`.
- ~~No decision rescind window~~ ✅ Shipped Session 13. 15-minute undo for editorial decisions, gated to the editor who issued the decision (`editor_id === auth.uid()`). `rescindEditorialDecision({decisionId, reason})` server action sets `editorial_decisions.rescinded_at + rescinded_reason` (50-char min) and reverts `manuscripts.status` via `deriveRestoredStatus` helper. `DecisionComposerPanel` renders a live-countdown "Undo decision" banner above the form; `DecisionHistoryPanel` shows rescinded decisions struck-through with a "Rescinded N min after issue" pill + reason snippet (audit-trail preserved). Apologetic `decisionRescindedAuthor` email fires fire-and-forget. Audit-logged `editorial_decision_rescinded`. Desk-rejects ARE rescindable under the same window.
- ~~No reject-enum split~~ ✅ Shipped Session 13 (migration 011). `editorial_decision_type` enum gains `post_review_reject` (distinct from `desk_reject`); `manuscript_status` enum gains `rejected` (distinct from `desk_rejected`). Composer's Reject radio relabelled to "Reject (post-review)" and now emits `post_review_reject`; legacy `reject` stays in the enum and maps to `rejected` for backward compat. Status mapping in `lib/admin/actions.ts.DECISION_TO_STATUS` updated in lock-step. Migration includes a NOTICE-only audit pass over existing `decision = 'reject'` rows — Kanwar reclassifies manually if any are surfaced (expected: 0).
- ~~No reviewer auto-re-invite on Major Revisions~~ ✅ Shipped Session 13. Checkbox on `DecisionComposerPanel` (visible only when `decision === 'major_revisions'`): "Re-invite original reviewers for round 2 (fresh 21-day deadline)". When checked + decision submitted, `submitEditorialDecision` enumerates non-draft reviewers on the manuscript (deduped by email), seeds fresh `review_invitations` rows with new tokens + Round-2 editor note pre-filled, fires `reviewerInvitation` emails. Idempotent: skips reviewers who already have an `invited|accepted|submitted` invitation row created after the most recent decision. Re-invite failures are best-effort (audit-logged `reviewer_re_invite_failed`); they do NOT roll back the decision.
- ~~No batch decision actions~~ ✅ Shipped Session 14 (2026-04-22, commit `e0c6571`). `/dashboard/admin/manuscripts` list gains a checkbox column + indeterminate select-all + sticky footer ("{n} selected · Bulk decision · Clear selection"). "Bulk decision" opens `BulkDecisionModal.tsx` scoped to the selected manuscripts; reuses the composer shape (4 radios + letter + optional deadline) minus merge tokens (`{{submission_id}}` is the only token and resolves per-row client-side), minus rescind banner, minus Major-Rev re-invite checkbox, minus desk-reject affordance. Mixed-status selections are gated before the modal opens with a "filter to eligible" shortcut. Sequential per-manuscript `submitEditorialDecision` calls with per-row live ✓/✗ progress avoid Resend rate limits and keep each decision individually rescindable within its own 15-min window. New `logBulkDecisionInitiated` server action writes a single `editorial_decision_bulk_initiated` row to `audit_logs` at batch start. Primary use case: desk-reject sweeps after a call for papers.
- ~~No revisions panel for editors~~ ✅ Shipped Session 14 (2026-04-22, commit `9477423`) as a scope-pivoted "Revisions" summary card rather than a field-level diff. The current schema does not snapshot pre-revision title/abstract/keywords/author_list (manuscript_revisions stores only `response_to_reviewers` + `note_to_editor` + `submitted_date`), so a computed metadata diff isn't possible without schema work. The card is visible only when ≥1 `manuscript_revisions` row exists and renders per-revision: submitted date + triggering-decision deadline + response-to-reviewers letter + note-to-editor + files uploaded in that version (via `manuscript_files.version = revision_number + 1`). Italic footer is explicit about what the card does and does not compare. Field-level metadata diff deferred to a future session that adds snapshot columns (natural pairing with Phase 4 publishing-pipeline work).
- ~~No revision submission flow~~ ✅ Shipped Session 12 (2026-04-20, commit `93f6537`). `/dashboard/submit?revising={id}` reuses the existing 5-step wizard with a revisionContext prop that branches each step into revising mode: new read-only Step 0 (editor letter + anonymised Reviewer A/B/C reviews with score bars, server-side identity strip), Step 1 type read-only, Step 2 requires revised manuscript + revised blinded + `tracked_changes` + `response_to_reviewers` files (new required slots) with `v{n}/` Storage prefix, Step 3 subspecialty read-only + reviewer suggestions hidden, Step 5 note-to-editor routes to `manuscript_revisions.note_to_editor` (not the original manuscript), "Submit Revision" button label. `submitRevision` + `loadRevisionContext` in `lib/submission/actions.ts`; 2 Resend templates (`revisionReceivedAuthor`, `revisionReceivedEditor`). Amber revision-requested banner on `/dashboard` with countdown (red <10 days).
- ~~No AI disclosure mechanism~~ ✅ Shipped Session 7 (Step 5 toggle + conditional textarea + reinforcement line; `getManuscriptAiDisclosure()` getter ready for the future published-article template).
- ~~No GDPR data export~~ ✅ Shipped Session 8 (`/api/dashboard/export` returns a JSON blob of the authed user's profile + owned + co-authored manuscripts + authors + metadata + file listings + payments + any reviewer_applications by email match; download button lives at the bottom of `/dashboard/settings`; file contents from Storage are *not* embedded — only file metadata).
- Custom auth domain `auth.oscrsj.com` — runbook shipped Session 8 at `docs/supabase-custom-auth-domain.md`. Execution blocked on Supabase Pro upgrade decision; no code change required once Kanwar runs the 5-step flow.
- **AI in Orthopedics hub — inaugural slate complete**: landing has live 20-term glossary + final 150-word primer; 2 of 3 Editor's Picks live (Imaging Primer + LLM Guide). Third Editor's Pick tile (glossary) anchors to `#glossary` on the landing page. `AI_ORTHO_BRIEFS` now carries **11 of 11 inaugural briefs** — Imaging ×2, Surgical Planning ×2, Robotics ×2, Outcomes ×1, LLMs ×2, Research Tools ×2. All six category archives populated and live. First batch of 6 shipped in commit `02cc31e` on 2026-04-16; final batch of 5 (Altahtamouni, Ma, Müller, Yao, Arias Perez) shipped later the same day.
- Hero image at `/news/ai-in-orthopedics` is a placeholder slot. Drop the Canva export at `/public/images/ai-in-ortho-hero.png` (1920×800 web hero + 1200×630 OG export per Page Plan §13) and uncomment the `<Image>` block in `app/news/ai-in-orthopedics/page.tsx` to wire it up.
- Editor's Picks on the hub link to `#` (primer, LLM guide, glossary not yet written). The "For Students hub" link also points to `#` — `/students` doesn't exist yet.

---

## Tech Stack
- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS with custom design tokens
- **Fonts:** DM Serif Display (serif headings) + Inter (body) via Google Fonts
- **Backend/Auth:** Supabase (PostgreSQL + Auth + Row Level Security)
- **CAPTCHA:** Cloudflare Turnstile (managed mode)
- **ORCID:** Public API OAuth 2.0 (profile prefill + verified iD)
- **Deployment:** Vercel (free tier), auto-deploys from `main`

---

## Design System
"Neutral Elegance" palette inspired by newgenre.studio. Dark gradient hero, editorial serif typography, warm tones with journal-grade reading ink. All tokens in `tailwind.config.ts` and `app/globals.css`. Design system **v2.3 — Reading Mode** (rollout 2026-04-21, Session 16 Franklin Cowork) is a color-tint recalibration only: `cream` moves from #FFF5EB (visibly warm) to `#FDFBF8` (barely-warm near-white, ~99% luminance) so the main page background reads as editorial white at first glance, and `ink` moves from #1a1410 to `#120D08` (warmer near-black — hint of brown retained). A body-serif typographic pairing (Source Serif 4 + `font-serif-body` token + `.journal-prose` opt-in class on 17 long-form pages) was shipped alongside the tint change in commit `fb593ae` but reverted the same session per Kanwar directive — the journal-body-serif direction is off the table for v2.3. Body text continues to use Inter at 16px/1.65 per v2.2. DM Serif Display remains the display face for hero + page titles + section headings. Design system **v2.2 — Journal Ink** (rollout 2026-04-18) had introduced the `ink` token; v2.3 keeps the token, just retunes its value. Design system **v2.1 — Clean Journal** (commit `0ba6db4`, 2026-04-18 earlier same day) shipped the white body base.

| Token | Value | Usage |
|---|---|---|
| `peach` | `#FFDBBB` | CTA buttons on dark backgrounds, accent highlights |
| `peach-dark` | `#F0C49A` | CTA buttons on light/cream backgrounds |
| `taupe` | `#CCBEB1` | Decorative ONLY (borders, dividers). NEVER for text. |
| `tan` | `#997E67` | Hover border on interactive cards, decorative dividers. **Banned from text classes** site-wide as of commit `14d03e3` (2026-04-17) — 3.53:1 contrast on cream fails WCAG AA for normal text. Use `text-brown` (7.62:1) for metadata. |
| `brown` | `#664930` | Accent text on light bg, button text |
| `brown-dark` | `#3d2a18` | **Headings only** (h1–h6 + `.page-title` + `.section-heading`). Serif + brown-dark = OSCRSJ signature. Also nav (`.nav-link`) for brand identity on dropdowns. |
| `ink` | `#120D08` | **Primary body/paragraph text** (all `<p>`, `<li>`, `<span>`, `<td>` on white and cream surfaces). Warmer near-black as of v2.3 — ~19:1 contrast on the new `cream` (#FDFBF8), ~20:1 on pure white. Retains a barely-perceptible brown warmth so it doesn't read cold next to peach accents. Set as HTML body default in `globals.css`. |
| `dark` | `#1c0f05` | Hero bg, nav bg, footer bg |
| `dark-card` | `#261609` | Dark card backgrounds |
| `cream` | `#FDFBF8` | Main page background — **reading mode** as of v2.3 (was #FFF5EB). ~99% luminance, barely-warm tint. Reads as editorial white against white cards, only visibly warm next to pure white. |
| `cream-alt` | `#F8F4ED` | **Subtle-highlight surface on white** (v2.3 retune — was #F5EAE0). As of commits `a51aca2` + `f05ca3d` (2026-04-23, Franklin + Sushant) this is the canonical chip/pill/step-circle/table-header/empty-state-card/hover surface throughout the site, because `cream` is now too close to pure white (~99% luminance) to contrast chips against `bg-white` cards. |
| `white` | `#FFFFFF` | All cards, form inputs, article wells (surface tier) |
| `border` | `rgba(153,126,103,0.18)` | Subtle borders/dividers (bumped from 0.12 in v2.1 to strengthen card edges against the white body) |

**3-tier visual hierarchy (v2.3):** dark (#1c0f05) → cream (#FDFBF8) body (reads as near-white) → white (#FFFFFF) cards within the body. Cards now contrast through the subtle cream→white step instead of the old cream→white warmth jump.

**Text color rule (v2.3):** Body/paragraph elements → `text-ink` (#120D08, or inherited from body default). Headings → `text-brown-dark` (always paired with `font-serif`). Metadata → `text-brown`. Never use `text-tan` for text.

**Background color rule (v2.3, ratified 2026-04-23):** Full-bleed section wrappers → `bg-white` (match homepage rhythm; no tint-band strips). Subtle highlights — chips, pills, step-number circles, keyword tags, table header rows, empty-state placeholder cards, hover states — → `bg-cream-alt`. Opacity fractions preserve the relationship (`bg-cream-alt/40`, `bg-cream-alt/50`, etc.). `bg-cream` is now a near-invisible near-white; reach for it only when you want the surface to read as "almost the body background" (rare). **Never reach for `bg-cream` expecting the pre-v2.3 warmth of `#FFF5EB` — that value no longer exists.**

**Fonts (v2.3):**
- **Display serif** (`font-serif`) — DM Serif Display, Georgia fallback. Used for hero + page titles + section headings. Unchanged from v2.2.
- **UI / body / metadata** (`font-sans`) — Inter. Used for nav, buttons, form controls, body/paragraph text, metadata badges, fact cards, dashboard chrome. Unchanged from v2.2. (A Source Serif 4 body-serif pairing was shipped and reverted in Session 16 per Kanwar directive — body text stays on Inter.)

**Component classes in `globals.css`:** `.btn-primary` (peach, for dark bg), `.btn-primary-light` (peach-dark + brown border, for light bg), `.btn-outline`, `.btn-ghost`, `.card` (white bg, no hover), `.section-heading`, `.section-label`, `.nav-link`.

**Card hover rules:** Interactive cards get `hover:border-tan hover:shadow-sm` (no bg change). Static info cards get no hover.

---

## Business Context (Important for Content Decisions)
- **No publisher.** Fully independent.
- **APC model:** Free in 2026 → $299 (M7-18) → $499 (Y2-3) → $699 (post-PubMed)
- **Waiver policy:** 100% for low-income countries, 50% for lower-middle-income + PGY-1/2 residents/med students, 25% for first-ever publication
- **Backend:** Custom LLM-powered submission system (not OJS) — to be built
- **Goal:** PubMed indexing (~2-year path requiring monthly releases)
- **Target audience:** US-based, med students / residents / fellows
- **Revenue projections:** ~$13K Y1 → ~$72K Y2 → ~$170K Y3

---

## Immediate Next Steps (for this Claude Code session)

The site is live at oscrsj.com. **Session 14 (2026-04-22, Sushant)** shipped the Phase 3.5 stretch remainder in two commits on `main`: `e0c6571` (Part A — batch decision actions on `/dashboard/admin/manuscripts`) + `9477423` (Part B — revisions panel on `/dashboard/admin/manuscripts/[id]`). Part A: new `ManuscriptsListClient.tsx` extracts the table into a client component with checkbox column + indeterminate select-all + sticky footer bar ("{n} selected · Bulk decision · Clear selection"); new `BulkDecisionModal.tsx` reuses the composer shape (4 radios + letter + conditional deadline) minus merge tokens (only `{{submission_id}}` resolved per-row client-side), minus rescind banner, minus Major-Rev re-invite checkbox, minus desk-reject affordance; mixed-status selections are gated before the modal opens with a "filter to eligible" shortcut; sequential per-manuscript `submitEditorialDecision` calls with live per-row ✓/✗ progress avoid Resend rate-limits and keep each decision row individually rescindable within its own 15-min window; new `logBulkDecisionInitiated` server action writes `editorial_decision_bulk_initiated` to audit_logs at batch start. Part B: new read-only `RevisionsPanel.tsx` server component visible only when ≥1 `manuscript_revisions` row exists, mounted between `DecisionComposerPanel` and `DecisionHistoryPanel`; each revision card renders submitted date + triggering-decision deadline + response-to-reviewers letter + note-to-editor + files filtered to that version (via `manuscript_files.version = revision_number + 1`); explicit footer copy states that field-level title/abstract/keyword/author diffs aren't available because the schema doesn't snapshot pre-revision state (deferred to a future session alongside publishing-pipeline work). **No new migration, no new env vars, no new routes.** Route count unchanged at 65. Contribution Matrix: `26/29 delivered · 2 in-progress · 1 blocked` → `28/29 delivered · 0 in-progress · 1 blocked` (Stripe still LLC-gated). **Phase 3.5 complete.** Session 15 priorities in order:

1. **Submission Portal — post-Phase-3 direction** (Sushant Agent scope, gated on Kanwar's decision + the end-of-Phase-3 smoke test)
   - ⏳ **Kanwar end-of-Phase-3 smoke test** (dashboard action row #36) — single large testing pass covering all 4 decision types on test manuscripts in appropriate statuses → confirm emails land + status transitions correct + audit logs populated. Test rescind by issuing and undoing a decision within 15 min (verify the apology email + status revert). Submit a revision → confirm files land + status flips + emails fire. Wait for cron tick (or `curl -H "Authorization: Bearer $CRON_SECRET" https://www.oscrsj.com/api/cron/revision-reminders`) → confirm revision-deadline reminder fires on a test manuscript with deadline <10 days away. Issue Major Revisions with the re-invite checkbox checked → confirm round-2 invitations seeded + emails fire. Session 14's new surfaces included: open `/dashboard/admin/manuscripts` → select two or more rows with mixed statuses → confirm the bulk modal blocks + offers "filter to eligible"; select two eligible rows → issue a bulk decision → confirm per-row ✓ appears + each decision rescindable individually. Open a manuscript with ≥1 revision → confirm the Revisions card renders with response letter + files.
   - 📋 **Decide post-Phase-3 priority** — the next Manvir-led decision session chooses between (a) Stripe payment integration (once LLC + EIN land, Brad-coordinated), (b) Phase 4 publishing pipeline kickoff (requires 1+ accepted manuscript to drive real requirements), (c) full E2E auth retest (long-overdue), (d) reviewer recruitment push (gated on Kanwar bandwidth), or (e) revision-metadata snapshot migration (unblocks a real field-level diff — natural pairing with Phase 4).
   - 📋 Reject-enum legacy backfill review — Kanwar checks the migration-011 NOTICE output for any `decision = 'reject'` rows that look like desk-rejects and reclassifies manually (expected count: 0).
   - ⏳ Full end-to-end auth retest — deferred from Sessions 5–14.
   - 📋 Custom auth domain `auth.oscrsj.com` — runbook ready at `docs/supabase-custom-auth-domain.md`.
   - 📋 `EMAIL_REPLY_TO=editorial@oscrsj.com` once Workspace mailbox is provisioned.

2. **AI in Orthopedics content population** (Arjun Agent scope — inaugural slate complete)
   - ✅ Glossary v1 (20 terms), final 150-word primer, 2 Editor's Picks, 11 inaugural briefs — all live
   - ⏳ Kanwar to supply the Canva hero export (1920×800 at `/public/images/ai-in-ortho-hero.png`)
   - ⏳ OG image (1200×630 at `/public/images/ai-in-ortho-og.png`)

3. **Submit sitemap to Google Search Console**
   - Go to search.google.com/search-console → add oscrsj.com property
   - Submit https://oscrsj.com/sitemap.xml

4. **Wire up forms**
   - Contact form: connect to Resend or Next.js API route
   - Newsletter signup (`/subscribe`): integrate with Buttondown, Mailchimp, or Resend
   - Add form validation and success/error states

5. **Downloadable templates & checklists**
   - Create downloadable patient consent form template (PDF or DOCX)
   - Create author pre-submission checklist (on Guide for Authors + Submit pages)

6. **Sample articles & reviewer recruitment**
   - Create 1-2 sample/template articles showing what good submissions look like
   - Build a reviewer interest/application form (handled in Session 7, item 2 above)

7. **Publish first articles & launch** (target: mid-2026)
   - Recruit 3-5 initial submissions from your network
   - Complete peer review and publish with Crossref DOIs
   - Begin monthly publication cadence (required for PubMed application)
   - Apply for DOAJ listing after first few issues

### Article Types Accepted (as of 2026-04-12)
All defined with full specs on `/guide-for-authors`:
- **Case Report** (1-3 patients, 2000 words, CARE checklist required)
- **Case Series** (4+ patients, 3000 words, JBI checklist required)
- **Surgical Technique** (1500 words, min 4 figures, video encouraged)
- **Images in Orthopedics** (500 words, 1-4 images, expedited 7-10 day review)
- **Letter to the Editor** (600 words, commentary on published work)
- **Review Article** (3500 words, invited only in Year 1)

---

## What Kanwar Wants Claude Code to Focus On
- He is **non-technical** but comfortable using Claude Code with Opus
- Prefer clear, self-contained components over abstracted systems
- Design uses the "Neutral Elegance" palette (dark hero, warm browns/peach, DM Serif Display headings) inspired by newgenre.studio
- Every page should be complete with real content (no lorem ipsum left behind)
- The site should look credible and polished on day one — it's a professional journal

---

## File Structure
```
OSCRSJ/
├── CLAUDE.md                          ← You are here
├── package.json
├── next.config.js
├── tailwind.config.ts
├── tsconfig.json
├── postcss.config.js
├── middleware.ts                       ← Supabase session refresh + route protection
├── .env.local                         ← Environment variables (gitignored)
├── .env.example                       ← Template for env vars
├── OSCRSJ_CREDENTIALS.md             ← Master credential file (gitignored)
├── app/
│   ├── layout.tsx
│   ├── globals.css
│   ├── sitemap.ts                     ← Dynamic sitemap (45 URLs — includes /news hub)
│   ├── page.tsx                       ← Homepage
│   ├── api/
│   │   ├── auth/
│   │   │   └── orcid/route.ts         ← ORCID OAuth redirect endpoint
│   │   ├── submissions/
│   │   │   └── [id]/
│   │   │       └── co-author-dispute/route.ts  ← Co-author dispute handler (JWT-verified)
│   │   └── webhooks/
│   │       └── resend/route.ts        ← Resend webhook (Svix-signed delivery events)
│   ├── auth/
│   │   └── callback/
│   │       ├── route.ts               ← Supabase auth code exchange
│   │       └── orcid/route.ts         ← ORCID OAuth callback handler
│   ├── articles/
│   │   ├── page.tsx
│   │   ├── current-issue/page.tsx
│   │   ├── past-issues/page.tsx
│   │   ├── in-press/page.tsx
│   │   ├── most-read/page.tsx
│   │   └── most-cited/page.tsx
│   # (app/topics/ retired 2026-04-23 — replaced by in-page filter on /articles; legacy URLs 301 via next.config.js)
│   ├── submit/page.tsx
│   ├── guide-for-authors/page.tsx
│   ├── apc/page.tsx
│   ├── peer-review/page.tsx
│   ├── editorial-policies/page.tsx
│   ├── open-access/page.tsx
│   ├── indexing/page.tsx
│   ├── about/page.tsx
│   ├── aims-scope/page.tsx
│   ├── editorial-board/page.tsx
│   ├── contact/page.tsx
│   ├── subscribe/page.tsx
│   ├── login/
│   │   ├── page.tsx
│   │   └── LoginForm.tsx              ← Client component (email/password + ORCID)
│   ├── register/
│   │   ├── page.tsx
│   │   └── RegisterForm.tsx           ← Client component (7 fields + ORCID prefill + Turnstile)
│   ├── forgot-password/
│   │   ├── page.tsx
│   │   └── ForgotPasswordForm.tsx     ← Client component (email reset request)
│   ├── reset-password/
│   │   ├── page.tsx
│   │   └── ResetPasswordForm.tsx      ← Client component (new password form)
│   ├── dashboard/
│   │   ├── layout.tsx                 ← Auth guard + DashboardShell wrapper
│   │   ├── DashboardShell.tsx         ← Client component (sidebar nav, mobile menu; Session 8 shows Admin section for editor/admin roles; Session 10 adds My Reviews nav item for reviewer/editor/admin roles)
│   │   ├── page.tsx                   ← My Submissions list with status badges
│   │   ├── reviewer/
│   │   │   └── page.tsx               ← Server component: reviewer dashboard — Active / Submitted / Past invitation sections, auth-gated (Session 10)
│   │   ├── settings/
│   │   │   ├── page.tsx
│   │   │   └── ProfileForm.tsx        ← Client component (profile editor + Session 8 GDPR export button)
│   │   ├── admin/
│   │   │   ├── layout.tsx             ← Server-side editor/admin role guard for every /dashboard/admin/* route (Session 8)
│   │   │   ├── manuscripts/
│   │   │   │   ├── page.tsx           ← Server component: list of non-draft manuscripts (Session 9)
│   │   │   │   └── [id]/
│   │   │   │       ├── page.tsx       ← Server component: manuscript detail + authors + files + declarations (Session 9)
│   │   │   │       ├── InviteReviewerPanel.tsx  ← Client component: current invitations + active reviewer pool + invite modal (Session 9)
│   │   │   │       ├── InviteByEmailPanel.tsx   ← Client component: direct-email reviewer invite, sibling card (Session 11.5)
│   │   │   │       ├── AdminFileDownloadButton.tsx ← Client component: per-file signed-URL download (Session 11.5)
│   │   │   │       ├── DecisionComposerPanel.tsx ← Client component: editorial decision composer (Session 12)
│   │   │   │       ├── DecisionHistoryPanel.tsx ← Server component: read-only decisions + revisions timeline (Session 12)
│   │   │   │       └── RevisionsPanel.tsx ← Server component: per-revision response letter + note + files (Session 14)
│   │   │   ├── ManuscriptsListClient.tsx ← Client component: checkbox column + sticky footer (Session 14)
│   │   │   └── BulkDecisionModal.tsx ← Client component: bulk decision composer + sequential submit (Session 14)
│   │   │   └── reviewer-applications/
│   │   │       ├── page.tsx           ← Server component: list + status filter query param (Session 8)
│   │   │       └── ReviewerApplicationsTable.tsx  ← Client component: inline expand, status transitions, admin notes (Session 8)
│   │   └── submit/
│   │       ├── page.tsx               ← Server wrapper (loads draft OR revisionContext when ?revising={id} — Session 12)
│   │       ├── SubmissionWizard.tsx    ← Client component (5-step wizard shell + auto-save + submit + Session 12 revising-mode branches + Step 0 render)
│   │       ├── RevisionStep0.tsx       ← Client component (read-only Session 12 — editor letter + anonymised Reviewer A/B/C reviews with score bars)
│   │       ├── Step1Type.tsx           ← Client component (manuscript type + confirmations; Session 12 adds `manuscriptTypeLocked` for revising)
│   │       ├── Step2Files.tsx          ← Client component (file upload + Supabase Storage; Session 12 adds revision categories + `v{n}/` prefix)
│   │       ├── Step3Info.tsx           ← Client component (title, abstract, keywords, reviewers; Session 12 adds `subspecialtyLocked` + `hideReviewerSuggestions`)
│   │       ├── Step4Authors.tsx        ← Client component (author list, reorder, ICMJE, certification)
│   │       └── Step5Declarations.tsx   ← Client component (COI, funding, ethics, review summary, submit; Session 12 adds revision-response textarea + label swap)
│   ├── privacy/page.tsx
│   ├── terms/page.tsx
│   ├── article-types/page.tsx          ← 6 article type specs
│   ├── templates/page.tsx              ← Downloadable templates (coming soon)
│   ├── for-reviewers/
│   │   ├── page.tsx                   ← Full reviewer instruction guide
│   │   └── apply/
│   │       ├── page.tsx               ← Server wrapper for reviewer intake (Session 7)
│   │       └── ApplyForm.tsx          ← Client component (10-field form + consent + dual Resend emails)
│   ├── faq/page.tsx                    ← 27 questions, 5 categories
│   ├── accessibility/page.tsx
│   ├── review/
│   │   └── [token]/
│   │       ├── page.tsx               ← Public token-only reviewer invitation page (Session 9, noindex)
│   │       ├── ReviewResponseForm.tsx ← Client component: Accept/Decline with pre-action confirmation (Session 9)
│   │       ├── form/
│   │       │   ├── page.tsx           ← Server component: token + status-gated structured review form shell (Session 10, noindex)
│   │       │   └── ReviewSubmissionForm.tsx ← Client component: 6 Likert scales + recommendation + comments + CoI + 30s auto-save draft (Session 10)
│   │       └── manuscript/
│   │           ├── page.tsx           ← Server component: double-blind manuscript teaser + reviewer file list (blinded_manuscript + figure + supplement only) (Session 10, noindex)
│   │           └── ReviewerFileDownloadButton.tsx ← Client component: server-action call → 30-min signed URL → browser download (Session 10)
│   └── news/
│       ├── page.tsx                   ← /news landing (AI feed + Ortho Headlines + Journal Updates placeholders)
│       └── ai-in-orthopedics/
│           ├── page.tsx               ← AI in Orthopedics hub landing
│           └── [slug]/
│               ├── page.tsx           ← Category archive (6 pre-rendered via generateStaticParams)
│               └── [brief]/
│                   └── page.tsx       ← Individual brief template (NewsArticle JSON-LD in SSR)
├── components/
│   ├── Header.tsx                     ← News dropdown added 2026-04-14
│   ├── Footer.tsx
│   ├── PageHeader.tsx                 ← Reusable page header with breadcrumbs
│   ├── Turnstile.tsx                  ← Cloudflare Turnstile CAPTCHA widget
│   └── icons/
│       └── ai-ortho/                  ← 6 inline SVG category icons (Imaging, SurgicalPlanning, Robotics, Outcomes, LLMs, ResearchTools)
├── lib/
│   ├── auth/
│   │   ├── actions.ts                 ← Server actions (signUp, signIn, signOut, resetPassword, updateProfile)
│   │   └── orcid.ts                   ← ORCID OAuth utilities (auth URL, code exchange, profile fetch)
│   ├── admin/
│   │   └── actions.ts                 ← Session 11.5 admin-scoped server actions: getAdminFileSignedUrl (editor/admin-gated 30-min signed URL, no file-type allowlist, audit-logged)
│   ├── reviewer/
│   │   └── actions.ts                 ← Server actions: submitReviewerApplication (Session 7) + Session 8 admin triage + Session 9 invitation workflow (inviteReviewer discriminated union over mode: 'application' | 'email' — Session 11.5, listInvitationsForManuscript, acceptReviewInvitation, declineReviewInvitation — token-only public actions for accept/decline, editor-gated for invite, all audit-logged with invite_method)
│   ├── ai-ortho/
│   │   └── data.ts                    ← Category list + AiOrthoBrief schema + empty AI_ORTHO_BRIEFS + landing primer
│   ├── schema/
│   │   └── newsArticle.ts             ← NewsArticle + ScholarlyArticle JSON-LD builder (buildNewsArticleSchema)
│   ├── constants.ts                   ← Shared constants (COUNTRIES list)
│   ├── email/
│   │   ├── resend.ts                  ← Resend client + sendEmail() wrapper with email_logs logging
│   │   ├── disputeTokens.ts           ← HS256 JWT sign/verify (co-author dispute tokens)
│   │   └── templates/
│   │       ├── shared.ts              ← Inline-styled email shell + helpers (paragraph, cta, detailsList)
│   │       ├── submissionConfirmation.ts
│   │       ├── coAuthorNotification.ts
│   │       ├── coAuthorDisputeNotification.ts
│   │       ├── reviewerApplicationConfirmation.ts   ← Session 7
│   │       ├── reviewerApplicationInternalNotification.ts  ← Session 7
│   │       ├── reviewerInvitation.ts               ← Session 9: editor → invitee (Accept/Decline CTAs)
│   │       ├── reviewerInvitationConfirmation.ts   ← Session 9: invitee receipt after response
│   │       ├── reviewerInvitationEditorNotification.ts  ← Session 9: editor notified on invitee response
│   │       ├── reviewSubmittedConfirmation.ts          ← Session 10: reviewer receipt after submitting review
│   │       ├── reviewSubmittedEditorNotification.ts    ← Session 10: editor notification with 6 Likert scores + recommendation
│   │       ├── editorialDecisionAccept.ts              ← Session 12: Accept decision letter
│   │       ├── editorialDecisionMinorRevisions.ts      ← Session 12: Minor Revisions letter with deadline + revising-link CTA
│   │       ├── editorialDecisionMajorRevisions.ts      ← Session 12: Major Revisions letter with deadline + revising-link CTA
│   │       ├── editorialDecisionReject.ts              ← Session 12: Reject / Desk Reject letter (isDeskReject flag tweaks framing)
│   │       ├── revisionReceivedAuthor.ts               ← Session 12: author confirmation receipt after revision submit
│   │       └── revisionReceivedEditor.ts               ← Session 12: editorial office notification with admin deep link + note-to-editor
│   ├── submission/
│   │   └── actions.ts                 ← Server actions (createOrUpdateDraft, saveManuscriptInfo, recordFile, deleteFile, saveAuthors, saveDeclarations, submitManuscript — fires transactional emails — plus Session 12 submitRevision + loadRevisionContext + AnonymisedReview / RevisionContext types; saveDeclarations.noteToEditor is now optional so revising mode can skip overwriting the original manuscript's note)
│   ├── supabase/
│   │   ├── client.ts                  ← Browser Supabase client
│   │   ├── server.ts                  ← Server Supabase client (cookie-based)
│   │   ├── middleware.ts              ← Supabase middleware helper
│   │   └── db.ts                      ← Admin client (service role key)
│   └── types/
│       └── database.ts                ← TypeScript types for all 13 Supabase tables + enums (reviewer_applications + career_stage + reviewer_application_status added Session 8)
├── docs/
│   └── supabase-custom-auth-domain.md ← Session 8 runbook: 5-step flow for migrating Supabase auth emails onto auth.oscrsj.com
├── app/api/dashboard/
│   └── export/route.ts                ← Session 8 GDPR data export endpoint (GET, auth-required, returns JSON blob with Content-Disposition attachment)
└── supabase/
    └── migrations/
        ├── 001_initial_schema.sql     ← Full schema: 12 tables, enums, RLS policies, triggers
        ├── 002_rls_policies.sql        ← RLS policy adjustments
        ├── 003_email_logs_resend.sql  ← Resend message id, delivery event columns, enum additions
        ├── 004_co_author_disputes.sql ← manuscript_metadata.co_author_disputes + audit_logs.details
        ├── 005_restore_submission_rls_policies.sql  ← Defensive INSERT/UPDATE/DELETE policy restore (Session 6)
        ├── 006_reviewer_applications.sql            ← Reviewer intake table + enums + RLS (Session 7)
        ├── 007_ai_disclosure.sql                    ← manuscript_metadata.ai_tools_used + ai_tools_details (Session 7)
        ├── 008_review_invitation_external_reviewers.sql  ← Relax review_invitations.reviewer_id to nullable + reviewer_application_id/email/name snapshot columns + CHECK identity constraint + editor RLS policies (Session 9)
        ├── 009_reviews_external_reviewers_and_rls.sql    ← Relax reviews.reviewer_id to nullable + is_draft boolean + review_invitation_id_snapshot_email + CHECK identity constraint + scope_score CHECK narrowed 1-5 → 1-4 + editor RLS (Session 10)
        ├── 010_session_11_columns.sql                     ← 3 reminder timestamp columns + 3 suggest-alt columns on review_invitations, all_reviews_notified_at on manuscript_metadata, partial index on (status, deadline) (Session 11)
        └── 011_session_13_columns.sql                     ← revision_reminder_sent_at on manuscript_metadata, rescinded_at + rescinded_reason on editorial_decisions, post_review_reject + rejected enum extensions, partial index on manuscripts(status), advisory NOTICE on legacy reject rows (Session 13)
```

### Session 11 new files (Sushant, 2026-04-19)
- `vercel.json` — `crons` block with daily `0 14 * * *` ping to `/api/cron/review-reminders`. Created this session.
- `app/api/cron/review-reminders/route.ts` — GET handler, bearer-header-gated by `CRON_SECRET`, three passes (ten_day / five_day / overdue), per-kind idempotency via timestamp column, audit-logged, returns `{ten_day_sent, five_day_sent, overdue_sent, scanned, timestamp}`.
- `app/dashboard/admin/manuscripts/[id]/reviews/[reviewId]/page.tsx` — editor/admin-gated read-only review detail view.
- `lib/email/templates/reviewReminder.ts` — parameterised by `kind ∈ {'ten_day','five_day','overdue'}`.
- `lib/email/templates/allReviewsReceivedEditorNotification.ts` — fires once per manuscript via `triggerAllReviewsReceivedIfReady`.
- `supabase/migrations/010_session_11_columns.sql` — 3+3+1 columns + partial index.

### Session 12 new files (Sushant, 2026-04-20)
- `app/dashboard/admin/manuscripts/[id]/DecisionComposerPanel.tsx` — client component; 4 decision radios + markdown letter + deadline picker + "Load template" dropdown + desk-reject affordance + confirm checkbox.
- `app/dashboard/admin/manuscripts/[id]/DecisionHistoryPanel.tsx` — server component; interleaves decisions + revisions in reverse-chrono order.
- `app/dashboard/submit/RevisionStep0.tsx` — read-only client component; editor letter + anonymised Reviewer A/B/C reviews with score bars + deadline pill.
- `lib/email/templates/editorialDecisionAccept.ts`, `editorialDecisionMinorRevisions.ts`, `editorialDecisionMajorRevisions.ts`, `editorialDecisionReject.ts` — 4 decision-letter Resend templates (monospace letter block inside the shared email shell).
- `lib/email/templates/revisionReceivedAuthor.ts`, `revisionReceivedEditor.ts` — 2 revision-received templates (author receipt + editorial office notification).
- `lib/admin/actions.ts` gains `submitEditorialDecision` + constants (`DECIDABLE_STATUSES`, `REVISION_DECISIONS`, `DECISION_TO_STATUS`).
- `lib/submission/actions.ts` gains `submitRevision` + `loadRevisionContext` + `AnonymisedReview` / `RevisionContext` types; `saveDeclarations` grows an optional `noteToEditor` (caller may omit in revising mode so the original submission's note stays intact).
- **No new migration.** `editorial_decisions` + `manuscript_revisions` tables, `editorial_decision_type` enum, `manuscript_files.file_type` enum values `response_to_reviewers` + `tracked_changes`, and RLS policies all shipped in migrations 001 + 002. Migration slot 011 reserved for Session 13 (`manuscript_metadata.revision_reminder_sent_at`).

### Session 13 new files (Sushant, 2026-04-21)
- `supabase/migrations/011_session_13_columns.sql` — `manuscript_metadata.revision_reminder_sent_at` + `editorial_decisions.rescinded_at + rescinded_reason` + enum extensions (`post_review_reject` on `editorial_decision_type`, `rejected` on `manuscript_status`) + partial index `idx_manuscripts_status_revision_requested` + advisory `RAISE NOTICE` block on legacy `decision = 'reject'` rows. `ADD COLUMN IF NOT EXISTS` / `ADD VALUE IF NOT EXISTS` throughout for safe re-runs. Must be run manually in Supabase SQL Editor before Session 13's surfaces will function.
- `app/api/cron/revision-reminders/route.ts` — daily Vercel Cron entry point (mirrors `/api/cron/review-reminders` exactly: same bearer-header gate against `CRON_SECRET`, same `runtime: 'nodejs'`, same audit-log pattern). Loads `manuscript_metadata` rows with `revision_reminder_sent_at IS NULL`, joins to `manuscripts WHERE status = 'revision_requested'`, then to the latest non-rescinded `editorial_decisions.revision_deadline` filtered to (now, +10 days). One-shot per revision cycle. Returns `{reminders_sent, scanned, timestamp}`.
- `lib/email/templates/revisionDeadlineReminder.ts` — Resend template parameterised by `daysRemaining`. Subject: `[OSCRSJ] Revision deadline in {n} days — submission {id}`. CTA links to `/dashboard/submit?revising={id}`.
- `lib/email/templates/decisionRescindedAuthor.ts` — apologetic email fired by `rescindEditorialDecision`. Subject: `[OSCRSJ] Editorial decision rescinded — submission {id} (please disregard prior letter)`. CTA returns the author to `/dashboard`.
- `lib/admin/actions.ts` extended with `rescindEditorialDecision({decisionId, reason})` (editor-ownership + 15-min-window + 50-char-min reason; sets `rescinded_at + rescinded_reason`; reverts `manuscripts.status` via `deriveRestoredStatus` helper that prefers prior non-rescinded decision, falls back to revision presence, then to non-draft review presence, finally to `submitted`); `submitEditorialDecision` extended with `reInviteOriginalReviewers?: boolean` arg + internal `reInviteOriginalReviewers` helper (enumerates `review_invitations.status IN ('accepted','submitted')` rows whose `id IN (SELECT review_invitation_id FROM reviews WHERE is_draft = false)`, dedupes by lowercased email, idempotency via "any post-decision invitation already exists for this reviewer" check, seeds fresh `review_invitations` rows with new tokens + Round-2 editor note pre-filled, fires `reviewerInvitation` Resend email, audit-logs `reviewer_re_invited` / `reviewer_re_invite_failed`); `DECISION_TO_STATUS` updated for the reject split (`post_review_reject` + legacy `reject` → `rejected`; `desk_reject` → `desk_rejected`); `validDecisions` allowlist gains `post_review_reject`; the email-routing branch handles `post_review_reject` with a distinct `emailType` value for observability.
- `lib/types/database.ts` extended with `post_review_reject` on `EditorialDecisionType`, `rejected` on `ManuscriptStatus`, `rescinded_at + rescinded_reason` on `EditorialDecisionRow`, `revision_reminder_sent_at` on `ManuscriptMetadataRow`.
- `app/dashboard/admin/manuscripts/[id]/DecisionComposerPanel.tsx` extended with: `RescindableDecision` exported interface + `rescindable?` prop; `RescindBanner` sub-component with live `useEffect`-driven 1-second countdown; rescind reason modal (50-char-min textarea + Cancel/Rescind buttons); Major-Revisions re-invite checkbox (visible only when `decision === 'major_revisions'`); Reject radio relabelled to "Reject (post-review)" and emits `post_review_reject` enum; helper text under the Reject radio steering pre-review rejections to the Desk Reject affordance.
- `app/dashboard/admin/manuscripts/[id]/DecisionHistoryPanel.tsx` extended with strike-through rendering for rescinded decisions (struck pill + greyed letter block + amber "Rescinded N min after issue" pill + reason snippet); `post_review_reject` added to `DECISION_LABELS` + `DECISION_PILLS`. Rescinded decisions stay in the chronological timeline (audit trail preserved).
- `app/dashboard/admin/manuscripts/[id]/page.tsx` extended with server-side computation of the `rescindable` prop (loads currently-authed user via `createClient()`, reads the most recent non-rescinded `editorial_decisions` row, gates on `editor_id === currentUser.id` + `decision_date` within 15 min, exposes `RescindableDecision` shape); `rejected` status pill style added.
- `app/dashboard/admin/manuscripts/page.tsx` + `app/dashboard/page.tsx` — `rejected` status pill / badge added to status maps.
- `vercel.json` — second cron entry appended (`/api/cron/revision-reminders` at `0 14 * * *`). Confirmed Vercel Hobby tier supports 2 crons per Session 11's deploy.

### Session 14 new files (Sushant, 2026-04-22)
- `app/dashboard/admin/manuscripts/ManuscriptsListClient.tsx` — new client wrapper for the manuscripts list table. Manages selection state (React `useState<Set<string>>`), renders the checkbox column (with indeterminate state on the header), and shows the sticky footer bar ("{n} selected · Bulk decision · Clear selection") when ≥1 row is selected. Opens `BulkDecisionModal` on demand. Selection resets on reload — no URL reflection, no localStorage.
- `app/dashboard/admin/manuscripts/BulkDecisionModal.tsx` — new client modal. `selected: BulkSelectable[]` prop lets it distinguish eligible (status ∈ `DECIDABLE_STATUSES`) from ineligible rows before the editor types a letter; if any ineligible rows are present, the modal opens in a "mixed-status gate" mode showing the offending statuses + a "filter to the {n} eligible rows" button that calls back into the parent to shrink the selection. Once the selection is clean, renders the 4-radio composer shape + letter textarea (120-char min) + conditional deadline picker; no merge tokens beyond `{{submission_id}}` which is resolved per-manuscript client-side before each `submitEditorialDecision` call. Sequential `for…await` loop with per-row progress state (`pending` / `sending` / `ok` / `error`); failures don't abort the remaining rows so partial commits are visible. Modal stays open after the run completes so the editor reviews the ✓/✗ outcome before dismissing. `logBulkDecisionInitiated` runs once at the start of the batch, inside the `useTransition` boundary.
- `app/dashboard/admin/manuscripts/[id]/RevisionsPanel.tsx` — new read-only server component rendered between `DecisionComposerPanel` and `DecisionHistoryPanel` on the admin detail page. Returns `null` early if `manuscript_revisions` is empty. Three parallel queries load revisions + all files + revision-triggering `editorial_decisions` rows (non-rescinded, `decision IN ('minor_revisions','major_revisions')`). Files are grouped by `version` — the i-th revision corresponds to `manuscript_files.version = revision_number + 1` (because v1 = the original submission). Each revision card renders header + submitted date + triggering-decision date + deadline pill (from the matching editorial decisions row) + response-to-reviewers `<pre>` block + optional note-to-editor + per-revision file list. The italic footer copy (the end-of-card caveat) explicitly explains the schema-snapshot gap so editors aren't misled by the absence of a true field-level diff.
- `app/dashboard/admin/manuscripts/[id]/page.tsx` — import + mount of `RevisionsPanel`.
- `app/dashboard/admin/manuscripts/page.tsx` — refactored from a monolithic server component to a shell that hydrates a `AdminManuscriptRow[]` and delegates to `ManuscriptsListClient`. Kept the header + error + empty-state branches on the server.
- `lib/admin/actions.ts` — new `logBulkDecisionInitiated({manuscriptIds, decision, letterLength})` server action. Editor/admin role gate (reuses `requireEditorOrAdmin`). Inserts one `audit_logs` row with `action: 'editorial_decision_bulk_initiated'` + `details: {manuscript_ids, count, decision, letter_length}`. Best-effort; failure is swallowed so the batch proceeds regardless.
- **No new migration.** `audit_logs.action` is `text`, so the two new action values (`editorial_decision_bulk_initiated` + none else — per-row success rows are written by the existing `submitEditorialDecision` as `editorial_decision_issued`) require no schema change. Brief accountability risk #5 anticipated the revision-diff fallback; the schema-snapshot gap is honestly declared in the panel's own footer copy.
- **No new env vars, no new routes.** Route count held at 65.

### Session 15 new files (Manvir Cowork, 2026-04-19) — OSCRSJ Brand Rollout Tier 1
- `public/brand/` — new canonical brand asset library with inline `<style>` font stacks (DM Serif Display → Playfair Display → Georgia fallback; Inter → Helvetica Neue → Arial sans fallback) and `role="img"` + `aria-label` + `<title>` on every SVG. Files: `wordmark-peach.svg`, `wordmark-ink.svg`, `seal-cream.svg`, `seal-dark.svg`, `masthead-cream.svg`, `masthead-dark.svg`, `combined-cream.svg`, `combined-dark.svg`, `cover-cream.html`, `cover-dark.html`. PNG fallbacks via ImageMagick `convert`: `seal-cream.png` (400×400), `seal-dark.png` (400×400), `wordmark-peach.png` (480×64), `wordmark-ink.png` (480×64), `combined-dark-og.png` (1200×630).
- `public/logo.svg` + `public/logo-mark.svg` — replaced in place with new brand. JSON-LD `Organization.logo` in `app/layout.tsx` picks up the new mark automatically (zero schema change); every email template hotlinking the mark inherits the new brand; Crossref content-registration previews + Google crawler passes update on next fetch.
- `app/apple-icon.tsx` — 180×180 iOS home-screen icon via `next/og` `ImageResponse`. Brown-dark (#3d2a18) backdrop + 4px peach (#FFDBBB) border + borderRadius 50% + serif OSCRSJ wordmark (fontSize 54, letter-spacing -3px) + 36×1 tan divider + MMXXVI eyebrow (fontSize 9, letter-spacing 3px).
- `app/manifest.ts` — PWA manifest (`MetadataRoute.Manifest`). `name`, `short_name: 'OSCRSJ'`, `theme_color: '#3d2a18'` (controls mobile Chrome/Safari/Edge browser chrome), `background_color: '#FFF5EB'`, `display: 'standalone'`, 4-entry `icons` array (generated `/icon` 64×64, `/apple-icon` 180×180, `/brand/seal-cream.svg` any, `/brand/seal-dark.svg` maskable), `categories: ['medical', 'education', 'science']`.
- `app/not-found.tsx` — new 404 page. `metadata: { title: 'Page Not Found', robots: { index: false, follow: false } }`. Dark hero (radial-gradient brown→dark, minHeight 520px) with seal-dark at 140-160px + "404 · Page Not Found" eyebrow + serif "Lost in the Stacks" headline at clamp(48px, 8vw, 96px) + "Popular Destinations" 6-tile grid (Submit, Guide for Authors, Current Issue, Editorial Board, Peer Review, Contact).
- `app/media/page.tsx` — new Press Kit page. PageHeader + seal anchor + boilerplate copy (short/medium/long) + 8 downloadable SVG lockup cards (each previews on appropriate backdrop — dark variants on #3d2a18, cream variants on #FFF5EB — with name + description + recommended-use pill + direct SVG download via `download` attribute) + 8-palette-color grid (Peach, Peach Dark, Brown, Brown Dark, Tan, Ink, Dark, Cream; each with name + hex + rgb + usage) + typography cards for DM Serif Display + Inter + DO/DON'T usage guidelines + Contact CTA. Serves as brand-asset provenance URL for indexing-body due diligence (ISSN, Crossref, DOAJ).
- `app/page.tsx` — homepage hero replaced. Old: text-only `<h1>OSCRSJ</h1>` at clamp(36px, 5vw, 52px). New: full masthead lockup — eyebrow "PEER REVIEWED · QUARTERLY" (letter-spacing 0.6em, fontSize 13, peach-dark, uppercase, fontWeight 600) → serif wordmark at clamp(64px, 11vw, 144px) with letter-spacing -0.05em → diamond rule (two 120×1 tan lines + rotated 10×10 tan square, `aria-hidden`) → italic serif subtitle at clamp(20px, 2.6vw, 30px) → existing intro paragraph + CTA buttons preserved. minHeight 440→520, padding 80/24 → 96/24.
- `app/about/page.tsx` — seal-cream SVG anchor added (180-220px responsive) immediately inside content wrapper, above Mission section.
- `app/editorial-board/page.tsx` — seal-cream SVG anchor added (160-200px responsive) above Editor-in-Chief section.
- `app/sitemap.ts` — new `/media` entry appended to `staticPages` (weekly, priority 0.6).
- `components/Footer.tsx` — `{ label: 'Press Kit', href: '/media' }` added to Quick Links array (after Contact).
- **SVG font-rendering note.** Every brand SVG in `public/brand/` carries an inline `<style>` block defining `.serif` / `.serif-it` / `.sans` font stacks. This is intentional — it lets the lockups render identically in Next.js runtime, Google crawler, Crossref landing-page fetcher, and email clients without any external font dependency. Font-bearing SVGs are rendered with plain `<img>` tags (not `next/image`) + `eslint-disable-next-line @next/next/no-img-element` to avoid next/image optimizer behavior; this also avoids needing `dangerouslyAllowSVG` in `next.config.js`.
- **Route count 65 → 66** (added `/media`). No new env vars. No migration. No new server actions.
- **Post-session follow-ups** (handled by Franklin handoff `^handoff-brand-rollout-ui-review` in `Franklin Agent.md`): cream-on-cream seal contrast audit (WCAG 2.1 3:1 for graphical objects), responsive homepage hero audit at 320-375px, DM Serif Display preload gap (`<link rel="preload" as="font">` in root layout to avoid FOUT on the masthead lockup), optional vault-side Brand Guidelines doc, acceptance criteria (tsc clean, Lighthouse accessibility ≥95, WCAG graphical-objects contrast).
- **Indexing-application asset swap** (handled by Janine handoff `^handoff-brand-rollout-indexing-assets` in `Janine Agent.md`): all ISSN / Crossref / DOAJ applications from this point forward attach the new canonical lockups (primary wordmark → `wordmark-ink.svg`, seal → `seal-cream.svg`, composite → `combined-cream.svg`, OG preview → `combined-dark-og.png`) and cite `https://www.oscrsj.com/media` as brand-asset provenance URL.
