# OSCRSJ Website — Claude Code Context

> Live at oscrsj.com · pre-launch as of May 2026.

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

The official website for **OSCRSJ** (Orthopedic Surgery Case Reports & Series Journal) — Kanwar's independent, open-access orthopedic research journal targeting the global orthopedic surgery community. Domain: **OSCRSJ.com**. Pre-launch as of May 2026.

---

## Conventions

Operational rules every session must follow. New entries land here only when a new rule is locked (see [docs/session-history.md#operational--meta-git-safety-conventions-refactors](docs/session-history.md) for surfacing context).

- **Explicit-path stage; never `add -A` or `add .`.** Stage every file by path. The 2026-04-22 file-deletion incident was caused by `add -A` against a corrupted index — see Git Safety above. Surfaced Session 14 (2026-04-22 incident).
- **TypeScript clean before commit.** Run `npx tsc --noEmit -p tsconfig.json` from repo root; commit only when it returns exit 0. Surfaced Sessions 11+.
- **FUSE stale-lock workaround.** When `git` errors with "Operation not permitted" on `.git/HEAD.lock` / `.git/index.lock` / `.git/refs/heads/*.lock` / `tmp_obj_*`, the file can't be `rm`'d from inside the sandbox but `mv` works around the unlink failure: `mv $f .git/.stale-junk/$(basename $f).$(date +%s%N)`. Non-fatal warning; the operation will complete cleanly. Surfaced Sessions 20+, codified Session 32.
- **PostgREST schema cache after column-add.** Every `ALTER TABLE ... ADD COLUMN` migration that's referenced by application code must end with `NOTIFY pgrst, 'reload schema'`. Without it, application writes hit "Could not find the 'X' column in the schema cache" until PostgREST's ~10-minute auto-refresh fires. Surfaced Session 34 (orphan migration 012).
- **Verify Vercel env-var state via Chrome MCP, not via prior CLAUDE.md claims.** Session 43's wrap-up incorrectly claimed `EMAIL_REPLY_TO` was set on Vercel; Session 46's verification revealed it was never set. Env-var state in CLAUDE.md changelogs should be verified before being trusted as ground truth. Surfaced Session 46.
- **www-canonical rule for outbound URLs.** Every emitted URL — `metadataBase`, `alternates.canonical`, `openGraph.url`, JSON-LD `@graph`, sitemap, robots.txt, server-action fallbacks, email footer hrefs, webhook destinations — must use `https://www.oscrsj.com/...`. Apex `oscrsj.com` 307s to www and most webhooks don't re-issue the body on redirect (Resend Svix-webhook silent-failure root cause, Session 5). Codified Session 6 commit `14d03e3`.
- **Reply-To on transactional emails.** `lib/email/resend.ts` `DEFAULT_REPLY_TO` defaults to `oscrsjournal@gmail.com` (env var `EMAIL_REPLY_TO` overrides). Inquiry-form replies override to the inquirer's email so editorial replies route directly back. Surfaced Sessions 6, 27, 43, 46.
- **DNS-level checks on any send-destination domain.** Run `dig MX <domain>` before assuming a domain accepts inbound mail. The contact-form mailbox-void bug (Session 46) silently swallowed every submission to `info@`/`submit@`/`editorial@`/`waivers@oscrsj.com` for ~9 days because `oscrsj.com` apex has no MX records. Surfaced Session 46.
- **Cross-session orphan-files protocol.** If `git status` shows pre-staged files you did not touch this session, STOP — it's another session's in-flight work. Verify migration dependency, unstage via `git reset HEAD -- <paths>`, commit only your work by explicit path, flag the orphans to Kanwar. Codified by §7.6 in [Organization Plan](../Documents/Kanwar%27s%20Second%20Brain/_Meta/Organization%20Plan.md). Surfaced Sessions 28, 32, 33, 44, 45.
- **Migration-slot arithmetic.** Before claiming a migration slot, run `ls supabase/migrations/` AND `git log --diff-filter=A -- supabase/migrations/`. Orphan migrations on disk that were never committed (Session 15's spec for migration 012 sat orphaned until Session 34 committed it as `5bea320`) cause "claim slot" collisions. Surfaced Sessions 28, 29, 34.
- **Audience copy is locked.** "The global orthopedic surgery community — practicing surgeons, fellows, residents, students, and researchers." Replaces all prior trainee-only framing. Surfaced Session 25, codified across `/about`, `/aims-scope`, `/faq`, `/submit`, homepage, layout metadata, `/media` boilerplate.
- **Ortho/Orth-marker credential strip.** Post-MBBS specialty markers in editorial board honorific suffixes are stripped — `MS (Orth)`, `MS(Ortho)`, `DNB (Orth)`, etc. all collapse to bare `MS` / `DNB`. Applies to both the `name` field and `honorificSuffix` in `lib/schema/editorialBoard.ts` `BoardMember` entries. Bio narrative prose may still reference orthopaedic training (degree names, fellowship titles in `BOARD_MEMBER_BIOS.education`/`experience` arrays). Surfaced Session 48 (Sankalp Lal `MS (Orth), DNB (Orth)` → `MS, DNB`; Vikash Raj `MS(Ortho)` → `MS`).
- **Author non-technical preference.** Kanwar is non-technical; prefer self-contained components over abstracted systems; pages must ship complete with real content (no lorem ipsum); Neutral Elegance palette is the brand.
- **CLAUDE.md add/move discipline (post-2026-05-06).** Every wrap-up runs M1-M4 in order: write full narrative to `docs/session-history.md`; update §9 Recent Sessions (full) and demote oldest if >3; prune §10 Recent Sessions (pointers) for 14-day window + 30-entry cap; resolve checked-off items in §11 Open Follow-ups, append new ones. Spec at vault `02 - OSCRSJ/Projects/CLAUDE.md Refactor.md` §9.

---

## Tech Stack

| Item | Value |
|---|---|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS with custom design tokens |
| Fonts | DM Serif Display (display serif) + Inter (body / UI) via Google Fonts |
| Backend / Auth | Supabase (PostgreSQL + Auth + RLS) |
| Email | Resend (transactional) + Svix-signed webhook |
| CAPTCHA | Cloudflare Turnstile (managed mode) |
| ORCID | Public API OAuth 2.0 (profile prefill + verified iD) |
| Deployment | Vercel (free tier) — auto-deploys from `main` |
| PDF render | WeasyPrint 68.1 → verapdf 1.30.1 (PDF/A-1b), separate renderer repo at `~/Documents/oscrsj-renderer/` |

---

## Deployment & Infrastructure

| Item | Details |
|---|---|
| **Live URL** | https://www.oscrsj.com |
| **GitHub Repo** | github.com/kanwarparhar/OSCRSJ (public) |
| **Hosting** | Vercel (free tier) — auto-deploys from `main` (~60s deploy) |
| **Domain Registrar** | GoDaddy — DNS configured |
| **DNS Records** | A: `76.76.21.21` / CNAME: `cname.vercel-dns.com` / SES MX on `send.oscrsj.com` for outbound |
| **SSL** | Auto-provisioned by Vercel (HTTPS) |
| **WWW redirect** | apex `oscrsj.com` → `www.oscrsj.com` (307). Canonical is `www`. Webhook URLs MUST use www form (apex 307 + most services don't re-issue body — Session 5 lesson). |
| **Inbound mail** | `oscrsj.com` apex has **NO MX records** (NXDOMAIN). Every send to `info@`/`submit@`/`editorial@`/`waivers@oscrsj.com` bounces. All form submissions route to `oscrsjournal@gmail.com` until Google Workspace is provisioned. See [docs/session-history.md#inbox-routing-history](docs/session-history.md). |
| **Backup URL** | oscrsj.vercel.app |

**Deploy:** push any commit to `main` → Vercel auto-rebuilds and goes live in ~60s.

---

## Design System

"Neutral Elegance" palette — dark gradient hero, editorial serif typography, warm tones, journal-grade reading ink. Tokens in `tailwind.config.ts` and `app/globals.css`. Current version: **v2.3 — Reading Mode** (rolled out 2026-04-21). Version history at [docs/session-history.md#design-system-history](docs/session-history.md).

| Token | Value | Usage |
|---|---|---|
| `peach` | `#FFDBBB` | CTA buttons on dark backgrounds, accent highlights |
| `peach-dark` | `#F0C49A` | CTA buttons on light/cream backgrounds |
| `taupe` | `#CCBEB1` | Decorative ONLY (borders, dividers). NEVER for text. |
| `tan` | `#997E67` | Hover border on interactive cards. **Banned from text classes** — fails WCAG AA on cream. Use `text-brown` for metadata. |
| `brown` | `#664930` | Accent text on light bg, button text, metadata |
| `brown-dark` | `#3d2a18` | **Headings only** (h1-h6 + `.page-title` + `.section-heading`). Also `.nav-link`. |
| `ink` | `#120D08` | **Primary body/paragraph text** on white and cream surfaces. ~19:1 contrast on cream, ~20:1 on white. Set as HTML body default. |
| `dark` | `#1c0f05` | Hero bg, nav bg, footer bg |
| `dark-card` | `#261609` | Dark card backgrounds |
| `cream` | `#FDFBF8` | Main page background — barely-warm near-white (~99% luminance) |
| `cream-alt` | `#F8F4ED` | Subtle-highlight surface — chips, pills, step-circles, table headers, empty states, hover |
| `white` | `#FFFFFF` | All cards, form inputs, article wells |
| `border` | `rgba(153,126,103,0.18)` | Subtle borders/dividers |

**Text color rule:** Body → `text-ink` (or inherited). Headings → `text-brown-dark` (paired with `font-serif`). Metadata → `text-brown`. Never `text-tan` for text.

**Background color rule:** Full-bleed wrappers → `bg-white`. Subtle highlights (chips/pills/headers/hover) → `bg-cream-alt`. `bg-cream` is near-invisible against white cards; reach for it only when the surface should read "almost the body background."

**Fonts:** Display serif (`font-serif`) — DM Serif Display, Georgia fallback, used for hero + page titles + section headings. UI / body / metadata (`font-sans`) — Inter, used for nav, buttons, body, dashboard chrome.

**Component classes** in `globals.css`: `.btn-primary`, `.btn-primary-light`, `.btn-outline`, `.btn-ghost`, `.card`, `.section-heading`, `.section-label`, `.nav-link`. **Card hover:** interactive cards get `hover:border-tan hover:shadow-sm` (no bg change). Static info cards get no hover.

---

## Business Context

- **No publisher.** Fully independent.
- **APC model:** Manuscripts submitted before **August 1, 2026** publish free; afterwards, single $499 standard rate per accepted manuscript. Discounts case-by-case via the inquiry form on `/apc`. Pricing history at [docs/session-history.md#apc-pricing-history](docs/session-history.md).
- **License:** CC BY 4.0 (reverted 2026-05-04 same-session after Janine surfaced the DOAJ + Plan S + NIH-funded-author indexing trade-off as a structured option-set; prior CC BY-NC-ND 4.0 lock from Session 25 superseded). Resolution at vault `02 - OSCRSJ/Notes/2026-05-04 License Reversion to CC BY 4.0 (Janine).md`.
- **Backend:** Custom LLM-powered submission system (built — see Phase 3.5 sessions). Renderer at `~/Documents/oscrsj-renderer/`.
- **Goal:** PubMed indexing (~2-year path requiring monthly releases).
- **Target audience:** The global orthopedic surgery community — practicing surgeons, fellows, residents, students, and researchers.
- **Revenue projections:** ~$13K Y1 → ~$72K Y2 → ~$170K Y3.

---

## Recent Sessions (full)

The 3 most recent sessions, full narrative. Older sessions surface as 1-line pointers in the next section; full narrative for any session lives in [docs/session-history.md](docs/session-history.md).

### Session 49 — 2026-05-11 — Franklin Cowork — /aims-scope six article types + sitewide audience-reframe sweep + Sivaramakrishnan thin-bio noindex

Closes three inbound Franklin handoffs in one working session: `^handoff-aims-scope-six-types-sync-2026-05-06`, `^handoff-audience-reframe-sweep-2026-04-25`, `^handoff-thin-bio-sivaramakrishnan-2026-05-01`. **Two commits on `main`**, fast-forward push (`dd03126..e4affb9`), explicit-path stage on 8 files, TypeScript clean. **Commit `d187b58`** (`feat(content): /aims-scope six article types + audience-reframe sweep`, 7 files, +23/-16): (a) `/aims-scope` "What We Publish" list went 2 → 6 article types (Case Reports / Case Series / Surgical Techniques / Images in Orthopedics / Letters to the Editor / invited Review Articles) mirroring the canonical FAQ + Guide for Authors list; page metadata + OG description updated; Purpose paragraph dropped trainee-coded clause. UNBLOCKS all SR/MA + Track C invitation campaigns. (b) Audience-reframe sweep (Kanwar-locked 2026-04-25): primary phrase "Orthopedic surgeons across all career stages" landed on `/editorial-board` (page subtitle + Join CTA) + `/guide-for-authors` (page subtitle); Founding Editor card blurb rewritten to Kanwar-locked text (drops "fast" + "genuinely supportive" + trainee anchor, adds "independent, open-access" + "substantive editorial feedback"); same rewrite on `lib/schema/editorialBoard.ts` `BOARD_MEMBER_BIOS['kanwar-parhar']` summary + experience entry; remaining trainee-coded surfaces swept: `app/manifest.ts` PWA description, `app/subscribe` newsletter benefits cards, `app/news` hub subtitle. Backup phrase ("the global orthopedic surgery community") was already present across homepage + /aims-scope + /faq + /media + layout metadata since Session 25. Surfaces preserved per handoff §4 judgment: APC/discount waiver-eligibility copy on /apc + /open-access + /faq q5 (describes waiver scope, not journal audience), form role taxonomies, AI-hub guide titles + body that match SEO-locked URL slugs, `/articles/most-cited` citation-impact-for-trainees prose. `/about` no longer exists in the route table. **Commit `e4affb9`** (`chore(seo): add adithyaa-sivaramakrishnan to THIN_BIO_SLUGS`, 1 file, +1): Set size 5 → 6; body word count 148 matches existing thin-bio precedent abhijit-jayan (149); auto-mechanic emits `robots: { index: false, follow: true }` + drops URL from sitemap on next build; auto-flips back when BOARD_MEMBER_BIOS entry gets fleshed out (real `experience` / `achievements` array). Person JSON-LD on aggregate `/editorial-board` page preserved. **TypeScript clean** (`npx tsc --noEmit -p tsconfig.json` exit 0). **§6 separation event**: working tree at session start carried 4 modifications I did NOT touch (`app/dashboard/admin/manuscripts/[id]/DecisionComposerPanel.tsx`, `lib/admin/actions.ts`, `lib/email/templates/editorialDecisionMajorRevisions.ts`, `lib/email/templates/editorialDecisionMinorRevisions.ts`) — cluster shape suggests in-flight Sushant work on the editorial decision composer + per-decision email templates; left unstaged per §6; flagged to Kanwar. **FUSE stale-lock event**: hit `.git/HEAD.lock` mid-commit; cleared via the `mv` workaround per CLAUDE.md `# Conventions`; both commits + push completed cleanly. **Risks**: (a) `/aims-scope` Purpose paragraph dropped trainee-affinity descriptive prose; if Kanwar wants it back as descriptive (not exclusionary), single-line restore in future polish pass; (b) Founding Editor card blurb is ~5 words longer; visual spot-check at three breakpoints not run from sandbox. **Self-improvement note for next session's owner-agent**: when picking up an inbound handoff that's been open >7 days, run `rg` against the acceptance-criteria phrases FIRST — the handoff status text is a starting hypothesis, not ground truth. The audience-reframe handoff sat "🔲 not started" for 16 days but Session 25 had already landed the backup phrase widely; the actual remaining delta was 6 files (primary phrase + Founding Editor rewrite + 3 stragglers), not the implied "sitewide first-pass" worth of work the handoff status suggested. Suggested addition to Organization Plan §7.6 or a vault-side "Stale Handoff Protocol" doc: ANY inbound handoff older than 7 days gets a pre-flight `rg` scan before scoping. **Kanwar follow-ups**: visual spot-check the 6 modified pages after Vercel auto-deploys; verify `/editorial-board/adithyaa-sivaramakrishnan` emits noindex meta + drops from sitemap; route the 4 orphan working-tree files to their owner-agent. Full narrative + handoffs at [docs/session-history.md#session-49-aims-scope-audience-reframe-thin-bio](docs/session-history.md). **Handoffs pushed: None.**

### Session 48 — 2026-05-06 — Franklin Cowork — Editorial board roster: 2 new section editors + Sukhman/Yash role swap + ortho-marker credential strip

Single-file feature edit on `main` (`lib/schema/editorialBoard.ts`) plus 2 photo file renames in `public/brand/`. Closes 5 Kanwar directives in one pass. **Roster changes:** Section Editors went 10 → 12. (a) **Sukhman Singh** moved Section Editor (Foot and Ankle) → Associate Editor; specialty retained; bio summary updated. (b) **Yash Mehta** promoted Associate Editor → Section Editor for Foot and Ankle; specialty narrowed from "Foot and Ankle Surgery and Adult Reconstruction" to "Foot and Ankle Surgery" (existing comprehensive bio retained intact). (c) **Jean Louka, MD** added as Section Editor for Foot and Ankle (paired with Yash for load redundancy, mirroring Trauma + Spine co-Section Editor pattern); triple-fellowship-trained (foot & ankle, trauma, oncology); MedStar Union Memorial fellow → U-Miami → U-Louisville → Hôpital Simone Veil residency timeline; workLocation Baltimore. (d) **Alejandro Zylberberg, MD** added as Section Editor for Adult Reconstruction (paired with Bill Huang); Hip Team Lead at Clínica Universidad de los Andes since 2014; Traumatology at Hospital del Trabajador de Santiago 2011–2021; University of Ottawa adult arthroplasty fellowship 2011; ResearchGate metrics 9 pubs / 1,341 reads / 256 citations; workLocation Santiago, Chile. **Credential cleanup:** Kanwar directive "remove ortho/orth from anyone's credentials" — Sankalp Lal `MBBS, MS (Orth), DNB (Orth)` → `MBBS, MS, DNB`; Vikash Raj `MBBS, MS(Ortho)` → `MBBS, MS`. Bio narrative prose left untouched (credential strip is a post-nominal rule, not a prose rewrite). **Photo renames:** `Jean Louka .png` → `jean-louka.png`; `Alejandro Zylberberg.webp` → `alejandro-zylberberg.webp` (kebab-case-by-slug convention). Avatar component is extension-agnostic so `.webp` ships unchanged. **Page render: zero edits needed** — `/editorial-board` and `/editorial-board/[slug]` filter `BOARD_MEMBERS` by `jobTitle` dynamically; both new members ship full bios so neither lands in `THIN_BIO_SLUGS`. Sukhman stays in `THIN_BIO_SLUGS` (still summary-only). **Roster count:** 19 → 21 confirmed (2 Leadership + 12 Section Editors + 6 Associate Editors + 1 Managing Editor). **Convention codified §3:** "Ortho/Orth-marker credential strip" — post-MBBS specialty markers in honorific suffixes collapse to bare `MS` / `DNB`; bio narrative prose may still reference orthopaedic training. **TypeScript clean** (exit 0). **Risks:** Section Editors grid balance now self-resolves at 12 cards (was odd-count 9 in §11 follow-up — likely moot at 12); Sukhman's Foot and Ankle Surgery specialty visually inconsistent with other Associate Editors (deferred polish). **Kanwar follow-ups:** stage by explicit path (`lib/schema/editorialBoard.ts` + 2 new photos) + `git rm` the 2 legacy-named photo files in the same commit; suggested message `feat(editorial-board): add Jean Louka + Alejandro Zylberberg, Yash↔Sukhman role swap, strip ortho-markers`; verify grid balance at 12 cards. Full narrative + handoffs at [docs/session-history.md#session-48-editorial-board-roster-expansion](docs/session-history.md). **Handoffs pushed: None.**

### Session 47 — 2026-05-06 — Sushant Cowork — JATS Publishing 1.3 XML capability landed in renderer + main-repo migration 020 + admin panel + first GitHub-ready push of renderer

Closes Manvir handoff `^handoff-jats-xml-implementation-2026-05-05` (P0 — gates Gate 5 PMC application path; every article published without JATS becomes retroactive PMC technical debt). **Two repos touched.** Renderer at `~/Documents/oscrsj-renderer/` ships two commits: `47229a2` lands the orphan working-tree changes from the prior 2026-04-25 Sushant Cowork session that were claimed-shipped in renderer's CLAUDE.md but never committed (sanityTests `abstract_structure_per_type` test + 3 fixture re-vendorings + splitReferences docstring + verify-references-split.mjs); `d28e27c` is the JATS feature itself (~1241 lines added). Main repo ships one commit on `main` with 5-path explicit-path stage: Migration 020 + `lib/types/database.ts` + `lib/admin/actions.ts` (PublishedAssetKind extended) + new `PublishedJatsPanel.tsx` admin surface + `page.tsx` mounting. **Architecture decision:** JATS XML built directly in TypeScript via element-builder helpers in `lib/renderer/jatsXml.ts` rather than running a second Python/Jinja2 subprocess — JATS is structurally mechanical, payload is JSON, deterministic output for refs/figures avoids Pandoc Vancouver-with-DOI flattening (resolves spec §13 Q5). Pandoc still used for body content; embedded `<ref-list>` stripped and replaced with canonical `<mixed-citation>` list from structured `references[]`. **License URL hardcoded to CC BY 4.0** (`https://creativecommons.org/licenses/by/4.0/`) in `buildPermissions()` per Janine handoff `^handoff-license-revert-code-surfaces-2026-05-04` integration point #3 — payload-level `article.license` IGNORED (fixtures still carry CC BY-NC-ND legacy strings; journal policy reverted 2026-05-04). **Day-1 sandbox smoke:** all 3 fixtures generate well-formed JATS (12.3-12.4 KB), full structural verification passes (contribs, affiliations, refs with DOIs, keywords, ORCIDs as full URLs, history dates, `ali:license_ref` CC BY 4.0); xmllint --noout passed for all three. DTD-valid acceptance criteria 1-2 deferred to Kanwar's first Mac smoke after `bash scripts/fetch-jats-dtd.sh` (sandbox has no NCBI DTD; disk space exhausted). **Session 18 dormant bug fixed:** renderer's `STORAGE_BUCKET` flipped from `'manuscripts'` to `'submissions'` to match every main-repo download path + the brief's explicit "submissions Supabase Storage bucket" language. Bug was dormant because Session 18's live publish never fired against a real manuscript. **§6 separation event:** working tree carried 1 unstaged orphan (`lib/schema/editorialBoard.ts` Sukhman Singh → Alejandro Zylberberg roster swap, plus 2 untracked headshots) — Franklin/Manvir editorial-board work in flight from another session, left unstaged per §6. **FUSE workaround upgrade:** the simple `mv .git/index.lock` workaround failed mid-session today; recovered via "fresh clone in /tmp + push to non-checked-out branch via `git push fusemount main:refs/heads/session-20-jats`" pattern (writes to `.git/objects` + `.git/refs` which FUSE tolerates, bypasses the receive.denyCurrentBranch refusal that would block `main:main`). **Risks:** (a) DTD validation hasn't run in this session — well-formedness only; first Mac smoke catches any DTD-side issues; (b) Pandoc 2.9 sandbox vs 3.1+ production — body fragment behavior consistent across versions; (c) `<body>` omitted for empty-cleanedHtml smoke runs (DTD-legal); (d) `retryWritebackOnly` threading shallow — added optional `jatsXmlStoragePath` but no UI exposes "Retry with JATS"; (e) stale CC BY-NC-ND mention in `## Business Context` not corrected this session (Kanwar follow-up). **Kanwar follow-ups:** run `bash scripts/fetch-jats-dtd.sh` once on Mac · run Migration 020 in Supabase Studio · run `npm run dev` + smoke all 3 fixtures via `/smoke/...` routes · GitHub closeout for renderer (`gh repo create kanwarparhar/oscrsj-renderer --private --source=. --remote=origin --push`) · capture canonical SHA256 of DTD bundle and fold into fetch-jats-dtd.sh · correct stale CC BY-NC-ND mention in CLAUDE.md `## Business Context` · wire payload synthesizer for live publish path when first manuscript reaches `accepted`. **Handoffs pushed: Janine** — first JATS XML output ready for PMC Style Checker validation against actual fixture renders (after Kanwar's first Mac smoke + DTD bundle fetch). Full narrative + handoffs at [docs/session-history.md#session-47-jats-xml-implementation](docs/session-history.md).

---

## Recent Sessions (pointers)

Sessions from the last 14 days as 1-line pointers (newest first). Older sessions reachable via grep on the archive.

- **Session 46 — 2026-05-05 — Franklin — Guide for Reviewers rebrand + editorial inbox-routing flip + contact-form mailbox-void quick-fix** — see [docs/session-history.md#session-46-guide-for-reviewers-rebrand](docs/session-history.md)
- **Session 45 — 2026-05-05 — Sushant — Daily editorial-ops digest cron** — see [docs/session-history.md#session-45-daily-editorial-ops](docs/session-history.md)
- **Session 44 — 2026-05-04 — Sushant — Admin manuscript "Reviewer pool" panel sources from unified roster** — see [docs/session-history.md#session-44-reviewer-pool-unified-roster](docs/session-history.md)
- **Session 43 — 2026-05-04 — Sushant — Password reset email pipeline unblocked end-to-end** — see [docs/session-history.md#session-43-password-reset-pipeline](docs/session-history.md)
- **Session 42 — 2026-05-03 — John — Social media integration + P0 zero-index verification + OSCRJ collision refinement** — see [docs/session-history.md#session-42-social-media-integration](docs/session-history.md)
- **Session 41 — 2026-05-03 — Manvir — Three-task SEO + a11y session (John AI citation baseline + Sprint 2 ORCID `sameAs` + Sprint 3 text-tan finding)** — see [docs/session-history.md#session-41-john-ai-citation-baseline](docs/session-history.md)
- **2026-05-02 — Intervening commit `fb43dc2` — Manuscript template formatting locks (8 unified rules across 6 article types)** — see [docs/session-history.md#entry-2026-05-02-template-formatting-locks](docs/session-history.md)
- **2026-05-01 — Intervening commit `f7c3bf7` — Parmida + Yash headshot extraction** — see [docs/session-history.md#entry-2026-05-01-headshot-extraction](docs/session-history.md)
- **Session 40 — 2026-05-01 — Franklin — Editorial board roster expansion 14 → 17 confirmed members** — see [docs/session-history.md#session-40-editorial-board-roster-expansion](docs/session-history.md)
- **Session 39 — 2026-04-30 — Franklin — Sprint 1 SEO bundle: site-wide canonical sweep + soft-404 guards** — see [docs/session-history.md#session-39-sprint-1-seo-canonical-sweep](docs/session-history.md)
- **Session 38 — 2026-04-27 — Sushant — Madhan Jeyaraman credential alignment to Track A v4.1** — see [docs/session-history.md#session-38-madhan-credential-alignment](docs/session-history.md)
- **Session 37 — 2026-04-27 — Franklin — Editorial board roster expansion (3 new members + Dheeraj specialty change)** — see [docs/session-history.md#session-37-editorial-board-roster-expansion](docs/session-history.md)
- **Session 36b — 2026-04-27 — Sushant — First-revision wizard gate fix** — see [docs/session-history.md#session-36b-first-revision-wizard-gate-fix](docs/session-history.md)
- **Session 36 — 2026-04-26 — Sushant — Revision-submission requirements: response template + tracked-changes instructions** — see [docs/session-history.md#session-36-revision-submission-requirements](docs/session-history.md)
- **2026-04-26 — Franklin — `/for-reviewers` + reviewer template `.docx` aligned with single-textarea form (commit `845ff08`)** — see [docs/session-history.md#session-26-04-26-franklin-reviewer-template-aligned](docs/session-history.md)
- **Sessions 32 + 33 + 35 — 2026-04-26 — Sushant — Reviewer form refactor cluster** — see [docs/session-history.md#session-32-35-cluster-reviewer-form-refactor](docs/session-history.md)
- **Session 34 — 2026-04-26 — Sushant — Orphan migration 012 committed, editorial-decision unblocked** — see [docs/session-history.md#session-34-orphan-migration-012](docs/session-history.md)
- **Session 31 — 2026-04-26 — Sushant — Combined reviewer manuscript package on acceptance** — see [docs/session-history.md#session-31-reviewer-package](docs/session-history.md)
- **Session 30 — 2026-04-26 — Sushant — Transactional email shell v2 redesign (no cream, dark-brown header, peach wordmark)** — see [docs/session-history.md#session-30-transactional-email-shell-v2](docs/session-history.md)
- **Session 29b — 2026-04-26 — Sushant — AI disclosure now requires explicit choice** — see [docs/session-history.md#session-29b-ai-disclosure-explicit-choice](docs/session-history.md)
- **Session 29 — 2026-04-26 — Sushant — Step 3 reviewer suggestions persisted + Excel export** — see [docs/session-history.md#session-29-reviewer-suggestions-persisted](docs/session-history.md)
- **Session 28 — 2026-04-26 — Sushant + Franklin — E2E test bug triage + sitewide tables/figures consistency sweep** — see [docs/session-history.md#session-28-e2e-test-bug-triage](docs/session-history.md)
- **Session 27 — 2026-04-26 — Manvir (Franklin + Sushant lanes) — `/open-access` waiver-language sweep + discount-inquiry/contact form backends** — see [docs/session-history.md#session-27-discount-and-contact-form-backends](docs/session-history.md)
- **Session 26 — 2026-04-26 — Franklin — `/apc` page rewrite (single $499 rate + discount form)** — see [docs/session-history.md#session-26-apc-page-rewrite](docs/session-history.md)
- **Session 25 — 2026-04-26 — Franklin — Sitewide consistency audit + 11 commits across two same-day rounds** — see [docs/session-history.md#session-25-sitewide-consistency-sweep](docs/session-history.md)
- **Session 24 — 2026-04-25 — Franklin — Editorial board roster fully populated (11 confirmed members)** — see [docs/session-history.md#session-24-editorial-board-roster-fully-populated](docs/session-history.md)
- **Session 23 — 2026-04-25 — Franklin — Homepage rhythm pass: section dividers + scroll fade-in + EIC photo polish** — see [docs/session-history.md#session-23-homepage-rhythm-pass](docs/session-history.md)
- **Session 22 — 2026-04-25 — Manvir — Editor-in-Chief homepage section shipped for Madhan Jeyaraman** — see [docs/session-history.md#session-22-editor-in-chief-homepage-section](docs/session-history.md)

---

## Open Follow-ups

Live punch list. Items resolve as Kanwar (or downstream agents) confirm completion; the archive entry for the surfacing session preserves the provenance.

- [x] ~~**Run Migration 020 in Supabase Studio**~~ — ✅ done 2026-05-06 same-session (Kanwar confirmed via Supabase Studio). Column `manuscripts.jats_xml_storage_path TEXT` is live in prod.
- [x] ~~**GitHub closeout for renderer**~~ — ✅ done 2026-05-06 same-session. Renderer pushed to https://github.com/kanwarparhar/oscrsj-renderer (private, Session 17/18/20 commits all on `origin/main`). Closes Session 18 deferral.
- [ ] **JATS DTD fetch script + validator path hotfix (renderer repo)** — three coordinated bugs surfaced when Kanwar tried to fetch the JATS 1.3 DTD bundle on his Mac, post-Session-47-ship: (a) `scripts/fetch-jats-dtd.sh` baked URL `https://jats.nlm.nih.gov/publishing/1.3/JATS-Publishing-1-3-DTD.zip` returns 404 — NCBI doesn't ship a single zip there, they ship a directory of variant-specific bundles at `https://public.nlm.nih.gov/projects/jats/publishing/1.3/`. (b) The actual main DTD inside the OASIS+MathML3 bundle is named `JATS-journalpublishing-oasis-article1-3-mathml3.dtd`, not `JATS-journalpublishing1.dtd` (older naming convention). (c) Both `lib/renderer/jatsValidate.ts JATS_DTD_DEFAULT_PATH` and `lib/renderer/jatsXml.ts` DOCTYPE `JATS_DTD_SYSTEM_ID` reference the older filename. Kanwar's local install works via a `JATS-journalpublishing1.dtd → JATS-journalpublishing-oasis-article1-3-mathml3.dtd` symlink workaround, but a fresh clone of the renderer to another Mac (or CI) will fail until this lands. ~10-min Sushant hotfix: rewrite `fetch-jats-dtd.sh` to `wget --recursive --no-parent --no-host-directories --cut-dirs=4 -e robots=off -R "index.html*" https://public.nlm.nih.gov/projects/jats/publishing/1.3/` then `unzip JATS-Publishing-1-3-OASIS-MathML3-DTD.zip` then flatten the resulting `JATS-Publishing-1-3-OASIS-MathML3-DTD/` subdirectory; update `JATS_DTD_DEFAULT_PATH` constant + `JATS_DTD_SYSTEM_ID` constant + the DOCTYPE template literal to use `JATS-journalpublishing-oasis-article1-3-mathml3.dtd` consistently. Bonus: capture canonical SHA256 of the OASIS-MathML3 zip after first run and fold into the script for future-fetch integrity verification. Surfaced Session 47 wrap-up.
- [ ] **Smoke renderer end-to-end on Mac** — `npm run dev` from `~/Documents/oscrsj-renderer/`, exercise `/smoke/sample-payload`, `/smoke/sample-payload-8-authors`, `/smoke/sample-payload-reused-figure`. DTD bundle is installed locally via Session 47 wget+symlink workaround; smoke confirms all 3 fixtures produce DTD-clean JATS (acceptance criteria AC1-AC2 of the spec). Carries the only remaining acceptance check from Session 47's 13-criteria list. Surfaced Session 47.
- [x] ~~**Correct stale CC BY-NC-ND mention** in CLAUDE.md `## Business Context`~~ — ✅ done 2026-05-11 (Janine Cowork — opportunistic during status-check session). Line now reads "License: CC BY 4.0 (reverted 2026-05-04...)" with provenance link.
- [ ] **Visual spot-check Session 49 surfaces post-Vercel-deploy** (~60s after `e4affb9` push) — `/aims-scope` (six items render cleanly in bullet list + trailing Guide for Authors link works), `/editorial-board` (new Founding Editor card blurb + page subtitle + Join CTA), `/guide-for-authors` (subtitle one-liner), `/news` + `/subscribe` (audience-reframe lines), `/manifest.webmanifest` (PWA description) at three breakpoints — surfaced Session 49
- [ ] **Verify `/editorial-board/adithyaa-sivaramakrishnan` emits noindex post-deploy** — `view-source:` should contain `<meta name="robots" content="noindex,follow">`; URL should drop from `https://www.oscrsj.com/sitemap.xml`. Auto-flips back to indexable when his BOARD_MEMBER_BIOS entry gets fleshed out — surfaced Session 49
- [ ] **Route 4 orphan working-tree files to owner-agent** — `app/dashboard/admin/manuscripts/[id]/DecisionComposerPanel.tsx`, `lib/admin/actions.ts`, `lib/email/templates/editorialDecisionMajorRevisions.ts`, `lib/email/templates/editorialDecisionMinorRevisions.ts`. Cluster shape suggests in-flight Sushant decision-composer + per-decision email template work. Left unstaged per §6 in Session 49 — surfaced Session 49
- [ ] **Codify "Stale Handoff Protocol"** in Organization Plan §7.6 (vault-side) — any inbound handoff older than 7 days gets a pre-flight `rg` scan against acceptance criteria BEFORE scoping; handoff status text is a starting hypothesis, not ground truth. Surfaced by Session 49 self-improvement note (audience-reframe handoff sat "🔲 not started" 16 days while ~70% was already done by Session 25's sitewide sweep)
- [ ] **Smoke-test contact form post-Vercel-deploy** — submit any test message via `/contact` and confirm it lands at oscrsjournal@gmail.com (not bouncing) — surfaced Session 46 — see [docs/session-history.md#session-46-guide-for-reviewers-rebrand](docs/session-history.md)
- [ ] **Delete the test reviewer application** — Supabase Studio → Table Editor → `reviewer_applications` → delete row where `email = 'kanwarparhar+oscrsj-smoke-2026-05-05@gmail.com'` — surfaced Session 46
- [ ] **Daily-digest manual-trigger smoke test** — `curl -H "Authorization: Bearer $CRON_SECRET" https://www.oscrsj.com/api/cron/daily-digest` — surfaced Session 45
- [ ] **Daily-digest non-empty test** — sign up a fake user via private window with throwaway email, re-run manual trigger curl, verify digest lands at oscrsjournal@gmail.com with subject `[OSCRSJ Daily] 1 registration` — surfaced Session 45
- [ ] **Set up Gmail filter** for subject `[OSCRSJ Daily]` to label "OSCRSJ ops" — surfaced Session 45
- [ ] **E2E test Invite flow on the unified reviewer pool** — click "Invite" on both Manvir (ACTIVE bucket) and Rawnak (APPROVED bucket) on a test manuscript; verify mode='email' + mode='application' dispatch paths both work — surfaced Session 44
- [ ] **Optional bulk `mailto:` sweep** across the 9 user-facing pages still pointing at dead-letter `@oscrsj.com` addresses (`/peer-review`, `/faq`, `/privacy`, `/terms`, `/accessibility`, `/dashboard/settings`, `/api/dashboard/export`, co-author-dispute final HTML, `/for-reviewers/apply` success-state) — surfaced Session 46
- [ ] **Google Workspace provisioning** for `editorial@`/`info@`/`submit@`/`waivers@oscrsj.com` — when ready, flip routing back to per-department aliases (or refactor to env-var-driven `lib/email/inboxes.ts` per Session 46 risk #1) — surfaced Session 46
- [ ] **DMARC `rua` flip at GoDaddy** — `_dmarc.oscrsj.com` aggregate-report destination still routes to kanwarparhar@gmail.com — optional consolidation to oscrsjournal@gmail.com — surfaced Session 46
- [ ] **Run the 5-surface manual AI citation audit** (~30 min) — fill 30 stubbed cells (ChatGPT / Claude / Perplexity / Bing Chat / Gemini × 6 queries) using capture template at `02 - OSCRSJ/Notes/2026-05-03 John — AI Citation Audit Baseline.md` §5 — surfaced Session 41
- [ ] **Decide on OSCRJ brand-collision response** — Manvir-territory: surface disambiguation paragraph on `/about` + homepage hero, OR alternateName-only path, OR wait until ISSN registers and resolve via Wikidata — surfaced Sessions 41, 42
- [ ] **End-of-Phase-3 smoke test** — single large testing pass covering all 4 decision types + rescind + revision submission + revision-deadline reminder + Major-Rev re-invite + bulk decision modal + Revisions card. Carried over from Session 14. — see [docs/session-history.md#session-14-batch-decisions-revisions-panel](docs/session-history.md)
- [ ] **Decide post-Phase-3 priority** — (a) Stripe payment integration (LLC-gated), (b) Phase 4 publishing pipeline kickoff, (c) full E2E auth retest, (d) reviewer recruitment push, (e) revision-metadata snapshot migration — surfaced Session 14
- [ ] **Full E2E auth retest** — long-overdue from Sessions 5-14
- [ ] **Custom auth domain `auth.oscrsj.com`** — runbook ready at `docs/supabase-custom-auth-domain.md`; gated on Supabase Pro upgrade decision — surfaced Session 8
- [ ] **Crossref membership decision** (~$275/yr) — DOI registration becomes the post-publish DOI flow — surfaced Session 18
- [ ] **First manuscript reaches `accepted` → wire payload synthesizer** for renderer — surfaced Session 18, carried through Session 47
- [ ] **Submit sitemap to Google Search Console** at https://www.oscrsj.com/sitemap.xml — long-pending
- [ ] **Wire up `/contact` + `/subscribe`** form backends fully (Session 27 wired contact + discount-inquiry; subscribe still static) — surfaced Sessions 27+
- [ ] **Sample/template articles** showing what good submissions look like — long-pending
- [ ] **Reviewer recruitment push** + first 3-5 submissions — gated on Kanwar bandwidth
- [ ] **Section Editors grid balance** at `sm:grid-cols-2` — count went 9 → 12 with Session 48 (Yash promoted in, Sukhman demoted out, Alejandro + Jean added). 12 = 6 even rows of 2, so the original odd-count last-row issue likely self-resolves. Verify on next visual pass — optional polish — surfaced Session 40, count updated Session 48

---

## Where to Look

Pointers, not duplicates. Filesystem commands return current truth.

- **Session history:** `docs/session-history.md` — `grep '#session-NN-slug' docs/session-history.md` for any entry; `grep '^### Session' docs/session-history.md | head -30` for chronological scan; `grep '^### ' docs/session-history.md` for topic + section heads.
- **Routes:** `find app -name 'page.tsx'` or `tree -L 3 app/`. Active count ~64 (drift acceptable).
- **Components:** `ls components/ app/dashboard/admin/manuscripts/[id]/ app/dashboard/submit/ app/review/[token]/`.
- **Migrations:** `ls supabase/migrations/`. Migration index with shipped-by-session map at [docs/session-history.md#migration-index](docs/session-history.md).
- **Schema types:** `lib/types/database.ts`.
- **Architecture plan:** vault `02 - OSCRSJ/Projects/Submission Portal Architecture Plan.md`.
- **CLAUDE.md refactor brief + add/move rules (M1-M4):** vault `02 - OSCRSJ/Projects/CLAUDE.md Refactor.md`.
- **Renderer repo:** `~/Documents/oscrsj-renderer/`. Render chain shipped Session 18.
- **Editorial board schema:** `lib/schema/editorialBoard.ts`. 21 confirmed members as of Session 48.
- **Email templates:** `lib/email/templates/`. v2 dark-brown shell from Session 30.
- **Brand assets:** `public/brand/` (Session 15 lockup library) + `/media` Press Kit page.
- **Vault startup ritual:** read `_Meta/Organization Plan.md` then `_Meta/Vault State.md` at every session start (per user preferences).
