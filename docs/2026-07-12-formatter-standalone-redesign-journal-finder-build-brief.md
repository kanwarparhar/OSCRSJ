# Build Brief: Journal Formatter Standalone Redesign + Journal Finder v1

> **How to run this:** paste this brief into Claude Code (Opus 4.8) from the OSCRSJ repo root. It is sized as **two sequential Claude Code sessions** (stop point marked ⏸), plus an optional third polish session. Plan first (`plan mode`), get Kanwar's approval of the plan, then execute. Do not attempt both sessions in one run — commit and verify at the stop point.
>
> Plan of record: vault `02 - OSCRSJ/Projects/Formatter Standalone Redesign & Journal Finder.md`. This brief is the how; every product decision below is **already locked by Kanwar (2026-07-12)** — do not re-litigate them, do not present alternatives. Execute.
>
> Authored by Manvir (Cowork planning session, 2026-07-12). Design, research, copy, and architecture decisions were made in that session; the reference mockup at `docs/formatter-redesign-mockup.html` is the visual ground truth.

---

## 🛑 PRECONDITIONS

1. **Repo health (Git Safety, CLAUDE.md):**
   ```bash
   git pull origin main
   git ls-tree -r HEAD --name-only | wc -l   # expect ~360-375; if dramatically smaller, STOP
   git status                                 # pre-staged files you didn't touch → STOP (orphan protocol)
   grep '^### Session' docs/session-history.md | head -3   # session-number collision pre-check
   ```
2. **Coordination check:** a parallel "Top-100 journal expansion" mega-session was launched 2026-07-12 (Manvir lane — see vault `[[Manvir Archive#^2026-07-12-formatting-top100-expansion-plan]]`). It touches `lib/formatting/journals/*.json` + `docs/formatting-expansion/manifest.json`. Session 1 of THIS brief touches `app/` routes and must not collide: pull latest before starting, and if journal rule files appear staged/untracked from that lane, leave them alone (orphan protocol).
3. **Known repo facts** (verified 2026-07-12, re-verify at run time):
   - Journal DB is **36 validated journals** (`lib/formatting/journalList.ts`), not the 14 from the original Phase 0 — expansion is ongoing toward ~100.
   - `/format` beta is **LIVE and public** (launch gate cleared 2026-07-12); this is a redesign of a live page. No downtime, no route change, no API change in Session 1.
   - Turnstile was **removed** from the /format submit path (orphan commit `c5c7eb3`) — the new UI must NOT reintroduce it.
   - Results are **on-page download only** (no completion email, Session 91 `f04ac17`); email field is retained for usage tracking. Preserve exactly.
   - Root layout `app/layout.tsx` renders `Header` + `Footer` around ALL routes — the standalone layout requires the route-group restructure in §6.1.

## Startup reading (in order)

1. Repo `CLAUDE.md` — Git Safety + all Conventions (explicit-path staging, tsc-clean, www-canonical, constant-fix grep, built-but-hidden grep).
2. This brief, fully, before writing any code.
3. `docs/formatter-redesign-mockup.html` — open it in a browser. It is the design ground truth for Session 1.
4. `app/format/page.tsx` + `app/format/FormatClient.tsx` — the live page you are restyling. The client flow (upload → journal/type → email → poll/advance → on-page results) is **behaviorally frozen**; only its skin changes.
5. `lib/formatting/registry-meta.ts` + `lib/formatting/rulesSchema.ts` — journal summary shape + rule constraints (Session 2 reads limits from here).
6. `app/layout.tsx`, `components/Header.tsx`, `components/Footer.tsx` — what the route-group restructure extracts.

## Active agent

**Sushant** (Submission Portal Architect & Ops Lead) with Franklin-lane design authority delegated via this brief. Handoff anchor: `^handoff-sushant-formatter-standalone-redesign-2026-07-12` in `02 - OSCRSJ/Resources/Agents/Sushant Agent.md`.

---

## §0 — TL;DR and locked decisions

The Journal Formatter becomes a **visually separate product** that still lives inside OSCRSJ: same URL, new self-contained design world, an OSCRSJ→Formatter entry animation as the brand handoff, a code-driven before/after demo in the hero, and a **Journal Finder v1** — the first tool anywhere that is simultaneously cross-publisher, orthopedics-specific, and constraint-aware against the user's actual manuscript.

| # | Decision | Locked choice (Kanwar, 2026-07-12) |
|---|---|---|
| D1 | Placement | **Keep `www.oscrsj.com/format`** — new root-level route-group layout (no OSCRSJ nav/footer), zero SEO reset, zero infra work. Subdomain/new-domain explicitly rejected for now. |
| D2 | Name | **"Journal Formatter — by OSCRSJ"** (unchanged from Session 89; the "by OSCRSJ" line is the entity bridge). |
| D3 | Design direction | **Swiss editorial** — pure white, near-black ink, single deep-indigo accent, oversized tight-tracked grotesk display type, hairline rules, generous whitespace, subtle scroll motion. Full token spec in §4. |
| D4 | Demo | **Code-driven live demo component** (no video file): a looping animated before/after scene built in CSS/JS. MP4 export for social is optional Session 3 work via the existing `export_reel.cjs` pipeline. |
| D5 | Entry animation | OSCRSJ text logo alone on white → holds ~0.9s → hands off into the Formatter design world. Full spec §7. Session-scoped (plays once per browser session), reduced-motion safe, zero SEO/layout-shift cost. |
| D6 | Journal Finder | **v1 ships in this build** (Session 2): deterministic constraint-fit matching over the journal rules DB + enriched metadata. LLM (DeepSeek) allowed ONLY for optional plain-English "why this fits" lines — never in scoring. |

**Out of scope (explicitly):** payment/Stripe; changing the formatting engine (`lib/formatting/` pipeline internals are untouchable except additive Finder reads); standalone-upload Finder mode (v1.1); per-journal SEO landing pages (John lane, Phase 4); LaTeX/PDF input; subdomain migration.

---

## §1 — Research: the pain points (verified, citable)

All figures below were verified against primary sources during the 2026-07-12 planning session. These are the numbers the page copy uses (§5). **Do not swap in unverified numbers.** Full citation list in Appendix A.

### 1.1 Formatting is a quantified, personal tax

- **14 hours** (median) to format one manuscript for submission; **US$477** median wage cost per manuscript; **52 hours/researcher/year**; median **2 submission attempts** before acceptance. — LeBlanc et al., *"Scientific sinkhole: The pernicious price of formatting,"* PLOS ONE 2019;14(9):e0223116 (n=372, 41 countries).
- **91%** of authors want the formatting system reformed; only 11.8% are satisfied. **Reformatting alone** consumes ~**23.8 million researcher-hours/year** (~**US$1.1 billion**). Reformatting delayed resubmission **>2 weeks in 51%** of cases and **>3 months in ~20%**. — Jiang et al., *"The high resource impact of reformatting requirements for scientific papers,"* PLOS ONE 2019;14(10):e0223976.
- **~6.3 billion** unique possible combinations of formatting requirements exist across just 302 leading biomedical journals and 8 formatting variables; only ~11% of journals even provide a template; projected **~US$2.5B / 75 million hours lost 2022–2030** to reformatting. — Clotworthy et al., BMC Medicine 2023;21:155.
- **>10,000 citation styles** exist (Zotero Style Repository). Vancouver is one of them.
- Caution flags: the "80% of papers rejected at least once" figure is secondary (Chapman & Swade via LeBlanc) — if used, phrase as "reported." Editage/Enago price points are aggregator-sourced — use "typically $150–$200" only with "paid services" framing; AJE's **$75/manuscript/journal** formatting fee IS verified on aje.com.

### 1.2 The resubmission cascade is the second product story

Only **43%** of papers land at their first-choice journal; **57.3%** require resubmission (Jiang 2019). Every resubmission = a new style sheet. For case-report authors specifically, high-impact journals keep dropping the article type (NEJM never took them; *Anesthesiology* and *A&A* famously stopped) because case reports dilute impact factor — so the venue landscape is fragmented, mostly OA, and only ~40% PubMed-indexed. Finding the next journal — and knowing whether your manuscript *fits* it — is exactly the Finder's job (§8).

### 1.3 Market signal

AJE charges **$75 per manuscript per journal** for formatting (re-pay on every retarget); SciSpace/Typeset markets 100,000+ templates (freemium, generic, no deterministic reference verification); Editage/Enago-type services run ~$150–200 with multi-day turnaround. The Formatter is free, minutes-fast, orthopedics-tuned, and verifies every reference against Crossref/PubMed. That contrast is the closing argument on the page.

---

## §2 — Research: the Journal Finder whitespace (verified)

Landscape verdict from the 2026-07-12 competitive sweep (full memo in Appendix B):

1. **Every big-publisher finder is a walled garden.** Elsevier JournalFinder, Springer Nature Suggester, Wiley Journal Finder, T&F Suggester, SAGE Recommender — all recommend **only their own portfolio**. Cross-publisher tools exist (JANE, B!SON, Jot, degraded JournalGuide, SciSpace) but are generic.
2. **No tool parses the actual manuscript file for constraint fit.** All of them take pasted title/abstract text and do topical similarity. None answers "does my 3,180-word case series with 6 figures actually *fit* this journal's limits?" SciSpace splits word-limit checking into a separate agent disconnected from its finder. **The constraint-aware lane is empty.**
3. **No specialty-specific finder exists** — orthopedic or otherwise. Only static librarian lists.
4. **Matching methods in production:** Lucene/TF-IDF (JANE), BM25 (Elsevier), citation clustering (Web of Science), neural fusion of semantic+bibliometric (B!SON — the only one with a published evaluation: Entrup et al., *Int J Digit Libr* 2023, showing combined signals beat any single method). RecSys literature 2024–25 converges on: deterministic retrieval/scoring for the shortlist, **LLM only as explainable re-ranker** — which is exactly OSCRSJ's existing AI doctrine (DeepSeek confined to parse/understand).
5. **What authors actually weight** (Rowley 2022 *J Inf Sci*; Beshyah 2019 *SQUMJ*; Gaston 2020 *Learned Publishing*): scope fit and peer-review quality first, indexing next, THEN impact factor; open access rated lower than intuition suggests. Rank Finder results by fit → indexing → speed → cost. **Not IF-first.**
6. **Reusable seed asset:** the JMLA 2023 case-report directory — 1,028 MEDLINE-indexed journals that accept case reports, CC-BY licensed on OSF (osf.io/b9wnx) — filterable to orthopedics for future DB expansion beyond the current 36 (pairs with the Top-100 expansion lane).
7. **Ortho APC backbone:** *"Publish or Perish: The Cost of Publication in Orthopaedic Journals"* (PMC12915719): 306 ortho journals, mean OA APC $1,975 ± $1,524; hybrids average $2,939 vs $857 OA-only; only 4.9% charge submission fees. Use for APC-transparency data and marketing framing.

**Positioning sentence (locked):** *"The only journal finder that reads your actual manuscript — and the only one built just for orthopedics."*

---

## §3 — Brand & identity

- **Name:** "Journal Formatter" as the product wordmark; "by OSCRSJ" always adjacent in smaller type, linking to `https://www.oscrsj.com`. The Finder is a feature of the same product surface ("Journal Finder" section), not a separately branded tool.
- **Relationship to OSCRSJ:** separate design world, same entity. The entry animation (§7) IS the brand bridge: OSCRSJ's serif wordmark literally hands off to the Formatter's grotesk wordmark. Footer carries "A free tool from the Orthopedic Surgery Case Reports & Series Journal" + link.
- **Voice:** confident, precise, zero academic stuffiness, zero SaaS-hype. Short declaratives. Numbers do the persuading. Never "revolutionize," "supercharge," "unleash." The reader is a surgeon-author who has lost weekends to margins; respect that.
- **The one trust rule carried over:** the four "It never..." guarantees (never rewrites science, AI for understanding only, never upscales figures, never invents a requirement) survive the redesign verbatim in meaning — they are the product's spine. Copy may be tightened but not weakened.

---

## §4 — Design system: "Swiss editorial" (the Formatter design world)

Everything below is scoped to the formatter route group ONLY. OSCRSJ's Neutral Elegance tokens must not leak in; these must not leak out.

### 4.1 Tokens

Add a `fmt` namespace to `tailwind.config.ts` colors (usage: `text-fmt-ink`, `bg-fmt-paper`, `border-fmt-hairline`):

| Token | Value | Usage |
|---|---|---|
| `fmt-paper` | `#FFFFFF` | Page background. The page is white. Resist any urge to tint it. |
| `fmt-surface` | `#FAFAFC` | Alternate section band, input backgrounds, demo "desk" |
| `fmt-ink` | `#0A0A0F` | Display + body text. Near-black, slightly blue-cold. |
| `fmt-ink-2` | `#52525E` | Secondary text, sublines, descriptions |
| `fmt-ink-3` | `#9494A1` | Captions, footnote refs, timestamps |
| `fmt-hairline` | `#E8E8EC` | 1px rules, card borders, dividers |
| `fmt-accent` | `#3B5BDB` | THE accent. Links, primary buttons, active states, demo highlights. Use sparingly — if a screen is >5% indigo, it's too much. |
| `fmt-accent-deep` | `#2B44A8` | Hover/pressed on accent |
| `fmt-accent-wash` | `#EEF1FB` | Accent-tinted chips, selected states, demo callouts |
| `fmt-ok` | `#147A4D` | Compliance ticks, "fits" states |
| `fmt-warn` | `#A16207` | "Near fit" / action-needed |
| `fmt-bad` | `#B3261E` | "Doesn't fit" / errors |

Contrast notes (WCAG AA): body text is always `fmt-ink` or `fmt-ink-2` on white/surface (both >7:1). `fmt-accent` on white is ~5.9:1 — fine for links/buttons/large text; never use it for long body copy. White text on `fmt-accent` buttons passes at button sizes.

### 4.2 Type

Load via `next/font/google` **in the formatter layout only**, exposed as CSS vars scoped to the route group:

- **Display — Inter Tight**, weights 600/700, letter-spacing −0.03em at display sizes, −0.01em at h3 and below. This is the Stripe/Linear look: big, tight, calm.
- **Body — Inter**, 400/500/600.
- **Mono — JetBrains Mono**, 400/500 — stats, filenames (`manuscript_JBJS.docx`), the compliance-report motif, footnote markers.

Scale (desktop → mobile via clamp): display `clamp(44px, 7vw, 76px)/1.02`; h2 `clamp(28px, 4vw, 40px)/1.1`; h3 `22px/1.25`; body-lg `19px/1.6`; body `17px/1.65`; small `15px/1.5`; mono-data `13px/1.4`; kicker `12px/1.2` uppercase tracked +0.14em (mono).

### 4.3 Layout & components

- Content max-width **1120px**, 24px gutters mobile, 8px spacing grid. Sections separated by 112–144px vertical air on desktop (64–80px mobile) — whitespace is the aesthetic.
- **Hairline rules** (`1px fmt-hairline`) mark section starts, often with a mono kicker sitting on the rule — this is the signature Swiss move (see mockup).
- Cards: `bg-white`, `1px fmt-hairline` border, radius **12px**, shadow `0 1px 2px rgba(10,10,15,.04)`; hover (interactive only) `0 6px 24px rgba(10,10,15,.07)` + border-color `#D6D6DE`, translateY(−1px), 200ms ease-out. No background shifts on hover.
- Buttons: primary = `fmt-accent` bg, white text, radius 10px, 15px/600 Inter, 12px×20px padding, hover `fmt-accent-deep`; secondary = white bg, `fmt-ink` text, hairline border, hover border-darkens; ghost/text = `fmt-accent` with underline on hover. No gradients anywhere on buttons.
- Pills/chips: radius 999, `fmt-accent-wash` bg + `fmt-accent-deep` text (selected) or surface bg + ink-2 (idle).
- Footnote markers: superscript mono `fmt-ink-3` numerals linking to a sources block at page bottom — every research stat on the page carries one.

### 4.4 Motion

- Micro-interactions 150–200ms ease-out. Section reveals: opacity 0→1 + translateY(16px→0), 550ms `cubic-bezier(.22,1,.36,1)`, staggered 70ms between siblings, triggered at 20% viewport intersection, **once** (no re-trigger on scroll-up).
- Stat count-ups: 1.2s ease-out, start on intersection, render final value immediately for `prefers-reduced-motion`.
- **`prefers-reduced-motion: reduce` disables ALL of it** — intro animation, demo loop autoplay (shows static side-by-side), reveals, count-ups. Non-negotiable; test it.

---

## §5 — Page architecture + copy deck (the new `/format`)

Single page, this exact section order. Copy below is final — typo-level edits only. Footnote numbers map to Appendix A sources; render the sources block as §11 of the page.

1. **`IntroTransition`** (overlay, §7).
2. **Top bar** (sticky, white, hairline bottom; 64px): left — wordmark `Journal Formatter` (Inter Tight 600) + `by OSCRSJ` (13px mono, `fmt-ink-3`, links to `https://www.oscrsj.com`); right — anchor links `How it works` · `Journals` · `Journal Finder` + primary button `Format a manuscript` (scrolls to `#app`).
3. **Hero** (white, generous):
   - Kicker (mono): `FREE DURING BETA · 36 ORTHOPEDIC JOURNALS · REFERENCES VERIFIED AGAINST CROSSREF & PUBMED` (journal count rendered from `JOURNAL_SUMMARIES.length`, not hard-coded — the Top-100 expansion will move it).
   - H1: **`Your science. Their style sheet. Done in minutes.`**
   - Subline (body-lg, ink-2, max 60ch): `Upload your orthopedic manuscript, pick a target journal, and download a submission-ready .docx with verified references and a plain-language compliance report. It never rewrites a word of your science.`
   - CTAs: primary `Format your manuscript — free` → `#app`; ghost `See it work ↓` → demo.
   - Below/right: the **`BeforeAfterDemo`** component (§6.3 / mockup).
4. **Stats band** (surface band, 4 count-up figures with mono footnote marks):
   - `14 hours` — `median time researchers spend formatting a single manuscript¹`
   - `$477` — `median cost of formatting one paper, in your own wages¹`
   - `1 in 5` — `resubmissions delayed more than three months by reformatting alone²`
   - `10,000+` — `citation styles in circulation. Your target journal wants exactly one³`
5. **The app itself** (`#app`) — the restyled `FormatClient` (§6.2). Section heading: `Format a manuscript` / subline `Free during beta. Your files are used only to produce your output — nothing is published or shared.`
6. **How it works** — 3 steps, current copy carried over, re-set in the new type (numbered with oversized mono numerals, not circles).
7. **What it never does** — the 4 trust guarantees, 2×2 hairline grid, `fmt-ok` check glyphs.
8. **Journal wall** (`#journals`) — all journals from `JOURNAL_SUMMARIES` as a dense grid: name, publisher (ink-2), mono verified-date chip `Verified Jun 2026`, supported article-type count. Client-side text filter above the grid ("Find your journal…"). Cards link to guidelines URL. Footer line: `Rules encoded directly from each journal's published Guide for Authors and re-checked monthly by an automated freshness cron.`
9. **Journal Finder** (`#finder`) — Session 2 feature section (§8). In Session 1, ship the section shell with the H2, positioning copy, and a disabled state reading `Launching shortly — finish a formatting job and we'll tell you which journals your manuscript actually fits.` (Do NOT ship a waitlist; v1 lands in Session 2.)
10. **Why we built this** — narrative section (three short paragraphs, research-backed):
    - P1: `Researchers lose a median of fourteen hours — and $477 in their own time — formatting a single manuscript.¹ Not doing science. Moving margins, renumbering references, hunting the author-guidelines PDF for the running-title character limit.`
    - P2: `It gets worse after a rejection. Fewer than half of papers land at their first-choice journal,² and every new target means a new style sheet — across the literature there are billions of possible combinations of formatting requirements,⁴ and reformatting alone delays one in five resubmissions by more than three months.² Ninety-one percent of authors say this system needs to change.²`
    - P3: `We publish an orthopedic journal. We got tired of watching good science stall in the style-sheet stage — so we encoded the rules and automated the tedium. Paid services charge $75 per journal, per attempt, and take days.⁵ This is free, takes minutes, and tells you exactly what it did.`
11. **FAQ + disclaimer + sources** — keep the existing disclaimer verbatim (it is legally worded); add 5–6 FAQs (is it free · what file types · is my data published · does it guarantee acceptance · which journals · what does the AI see) mined from existing page copy; sources block lists Appendix A citations 1–5 in mono small type.
12. **Minimal footer**: `Journal Formatter — a free tool from the Orthopedic Surgery Case Reports & Series Journal` (links to oscrsj.com) · `Terms` · `Privacy` · `Contact`. No OSCRSJ mega-footer.

**SEO/metadata (Session 1):** keep canonical `https://www.oscrsj.com/format` (www-canonical rule); rewrite title to `Journal Formatter — free orthopedic manuscript formatting | by OSCRSJ`; keep description close to current; total server-rendered copy must stay ≥700 words (the copy deck above clears it); add JSON-LD `SoftwareApplication` (name, publisher OSCRSJ, offers price 0 USD) + `FAQPage` for the FAQ block (mind quote-escaping — FAQ JSON-LD has a bug history here, validate with Rich Results Test post-deploy).

---

## §6 — Engineering plan, Session 1 (standalone design world)

### 6.1 Route-group restructure (the chrome split)

Root layout currently hard-wraps every route in `Header`/`Footer`. Canonical Next.js fix — **route groups** (URLs do not change):

1. Create `app/(site)/` and `git mv` every page route dir into it EXCEPT `format/`, `api/`, and root-level special files (`layout.tsx`, `sitemap.ts`, `robots.ts`, `manifest.webmanifest` route, `apple-icon`, `globals.css`, error/not-found).
2. New `app/(site)/layout.tsx`: renders `<Header/>{children}<Footer/>` (moved out of root layout) — OSCRSJ metadata template stays at root.
3. Root `app/layout.tsx` keeps: html/body, global fonts, `globals.css`, Analytics, metadataBase + default metadata, JSON-LD `@graph`.
4. `git mv app/format app/(formatter)/format`; new `app/(formatter)/layout.tsx`: loads Inter Tight/Inter/JetBrains Mono via `next/font/google`, sets font CSS vars + a `fmt-root` wrapper class, imports `app/(formatter)/formatter.css` (token vars + component classes), renders NO site chrome, own `metadata` (template `%s | Journal Formatter`).
5. **Verify list after the move** (this is the risky step — do it methodically): `npx tsc --noEmit` clean; `next build` green; spot-check `/` `/about` `/articles` `/dashboard` `/format` `/api/format/jobs` all resolve; `app/sitemap.ts` still emits identical URLs (route groups are URL-invisible — confirm, don't assume); not-found + error boundaries still render with site chrome.
6. Commit the restructure as its OWN commit before any visual work (`refactor(app): split site chrome into (site) route group; (formatter) gets standalone layout`). Explicit-path staging — this commit is nearly all renames; `git status` must show renames, not delete+add storms. If the index looks corrupted, STOP per Git Safety.

**Fallback (only if the mv surfaces something ugly):** keep the tree, make `Header`/`Footer` return `null` under `/format` via a tiny client `usePathname` gate component. Ship the fallback rather than fighting a broken restructure — but the route group is strongly preferred and expected to be uneventful.

### 6.2 FormatClient restyle

- Behavior frozen: same state machine, same endpoints, same rate-limit errors, same download flow, same Sheets logging, same progress interpolation (Session 91). Skin only.
- Visual changes: white cards with hairlines; drop-zone becomes a large dashed-hairline surface with mono filename echo after selection (`manuscript.docx · 2.4 MB`); journal picker gets the wall's filter treatment; progress bar becomes a thin (3px) `fmt-accent` line with the mono stage label + "N of M references" beneath; results render as a document-style card stack (formatted .docx / report / zip) with mono filenames showing the `_JBJS` suffix pattern; report severity chips map to `fmt-ok/warn/bad`.
- Keep every `aria-*`/focus behavior; visible focus rings `2px fmt-accent` offset 2px.

### 6.3 BeforeAfterDemo component (D4)

Self-contained client component, pure CSS transforms + one rAF-free JS driver (CSS animations with class-swapped scenes are fine). Looping ~14s, 4 scenes, staged inside a fixed-aspect "desk" card (see mockup implementation):

1. **Before (0–3.5s):** a mini manuscript page renders visibly wrong — mixed font sizes, cramped single spacing, unnumbered lines, refs like `(Smith 2019)` — with a red-tinted mono caption `manuscript_draft.docx`.
2. **Choose (3.5–6s):** a journal chip row slides in; `JBJS` chip activates (`fmt-accent-wash`); caption `Target: The Journal of Bone & Joint Surgery`.
3. **Work (6–9.5s):** three mono progress lines tick with `fmt-ok` checks — `Parsing references… 24 found` → `Verifying against Crossref · PubMed… 24 ✓` → `Applying JBJS layout…`.
4. **After (9.5–14s):** the page morphs — double-spaced lines, continuous line numbers fade in on the left margin, title page ordering snaps, refs renumber to `[1]`-style superscripts — caption flips to `manuscript_JBJS.docx` with an `fmt-ok` tick + `Compliance report · 0 blocking issues`. Hold, fade, loop.
- `IntersectionObserver`: pause off-screen. Reduced-motion: render a static split view (Before | After) with a caption, no loop.
- Type inside the demo uses a serif stack for the fake manuscript (it should look like a Word doc, not like the site).
- Build it so scenes are data-driven (array of scene defs) — Session 3 can then replay the same scenes at 1080×1920 for an MP4 social export via `Post Templates/_pipeline/scripts/export_reel.cjs`.

⏸ **STOP POINT — end of Session 1.** `npx tsc --noEmit` exit 0; `next build` green; `npm test` unchanged (62 tests, 61 pass + 1 live-gated); visual pass at 375px/768px/1440px; reduced-motion pass; commit by explicit path; M1–M4 wrap-up per CLAUDE.md; do not start Session 2 in the same run.

---

## §7 — Entry animation spec: the OSCRSJ → Formatter handoff (D5)

**Concept (Kanwar's directive):** navigating to the tool gives a brief pause — the OSCRSJ text logo alone in the middle of a white page — then it animates into the new design world.

**Component:** `app/(formatter)/IntroTransition.tsx` (client), rendered in the formatter layout ABOVE `{children}`. The page content is fully server-rendered underneath from the first byte — the overlay merely covers it. Zero SEO cost, zero CLS (overlay is `position: fixed; inset: 0; z-50`).

**Timeline (total 1.8s, plays once per browser session):**

| t | What happens |
|---|---|
| 0–150ms | Solid white overlay. Nothing else. The pause is the point. |
| 150–500ms | `OSCRSJ` wordmark fades in dead-center — **DM Serif Display, `#3d2a18`** (the journal's own heading font/color: this moment belongs to OSCRSJ, not the Formatter). Opacity 0→1, scale 0.97→1. |
| 500–950ms | Hold. Beneath it at 450ms, a hairline draws horizontally (scaleX 0→1, center-out) and a 12px mono line fades in: `presents`. |
| 950–1450ms | The handoff: OSCRSJ wordmark + rule slide up 24px and fade out; `Journal Formatter` (Inter Tight 700, `fmt-ink`) rises into center, tight and confident, with `by OSCRSJ` in mono beneath. |
| 1450–1800ms | Whole overlay lifts: `clip-path: inset(0 0 100% 0)` (curtain up), 350ms `cubic-bezier(.65,0,.35,1)`. Page beneath is already there; hero children stagger-reveal (§4.4) as the curtain clears. |

**Rules:**
- `sessionStorage.jf_intro_seen = "1"` → subsequent visits in the same session skip the overlay entirely (render nothing, not a fast version). First paint of the check must be synchronous enough to avoid a flash — gate with a tiny inline script or initial `visibility` guard, same pattern as theme-flash prevention.
- `prefers-reduced-motion: reduce` → skip entirely (simple 200ms opacity fade of the overlay, or nothing).
- Escape hatches: any click/keypress/scroll during the intro jumps to the end state instantly.
- No animation libraries. CSS keyframes + one small state component.
- Do NOT block interaction longer than 1.8s; do NOT replay on client-side nav within the group.

---

## §8 — Journal Finder v1 spec (D6) — Session 2

### 8.1 Product definition

**"Find where your manuscript actually fits."** Input: the numbers that describe a manuscript (article type, word count, abstract word count, figure count, table count, reference count, subspecialty) — either **(a) handed over from a just-completed formatter job** (the pipeline already extracted them; primary path, zero extra typing) or **(b) typed into a short manual form** (secondary path). Output: a ranked scorecard of the journal DB showing, per journal, whether this manuscript is *eligible and fits* — with exact numbers, not vibes.

v1 explicitly does NOT: upload/parse a fresh file outside a formatter job (v1.1), scrape live journal stats, use the LLM for scoring, or persist finder queries in the DB (stateless; log a row to a "Finder Submissions" tab of the existing Google Sheet via the Session-61 webhook, same pattern as Session 91).

### 8.2 Matching model (deterministic, transparent)

Per journal, compute in `lib/finder/match.ts` (pure function, unit-tested):

1. **Eligibility gate:** requested article type ∈ journal's `article_types` (from the rules DB). Fail → bucket `Not eligible`, shown collapsed at the bottom with the reason (`JBJS does not accept case reports` — this is the case-report author's key signal).
2. **Constraint fit** against the journal's rule file limits where present (word count, abstract limit, figure/table/reference caps — read from `rulesSchema` constraint fields; a journal silent on a limit contributes neutral, echoing the formatter's "never invent a requirement" principle): every check returns `fit` / `near` (≤10% over) / `over`, with the exact delta (`3,180 words vs 3,000 limit — 180 over`).
3. **Scope match:** overlap of the user's subspecialty pick against a new `scope_tags` field (§8.3). Contributes to ordering, never to eligibility.
4. **Ordering (per the survey research, §2.5):** eligible journals sorted by scope match → constraint fit score → user-selectable secondary sort (`Indexing` / `Review speed` / `APC low→high`). **No impact-factor-first sorting.** IF/CiteScore may display as metadata but never drives default rank.
5. **Buckets rendered:** `Fits` (all constraints fit) · `Near fit` (≤2 `near`, zero `over`) · `Needs work` (any `over`) · `Not eligible` (collapsed).

**OSCRSJ self-listing (ethics, locked):** OSCRSJ ranks by the same math, no boosting, badged `Published by us` with a one-line disclosure under the results: `OSCRSJ builds this tool and appears in results only when your manuscript genuinely fits our scope and limits — scored identically to every other journal.`

**LLM use:** optional per-result one-liner (`Why this fits: single-case sports-medicine report within AJSM's case limits...`) via DeepSeek, `lib/finder/explain.ts`, behind a flag, graceful empty fallback. Never in scoring (matches the OSCRSJ AI Layer doctrine and §2.4 evidence).

### 8.3 Metadata enrichment (`lib/finder/journalMeta.ts`)

New per-journal record keyed by slug (do NOT modify the formatting rule files — additive module, so the Top-100 expansion lane stays unblocked): `indexing: ('MEDLINE'|'PMC'|'Scopus'|'ESCI'|'DOAJ')[]`, `oa_model: 'oa'|'hybrid'|'subscription'`, `apc_usd: number|null`, `review_speed: string|null` (verbatim from journal page, e.g. `"~4 weeks to first decision"`), `scope_tags: string[]` (controlled vocab: trauma, arthroplasty, sports, spine, hand, foot-ankle, shoulder-elbow, pediatric, oncology, basic-science, general), `accepts_case_reports: boolean`, `source_urls: string[]`, `verified_date`.

Populate for all 36 current journals from each journal's own about/OA pages (WebFetch during the session; cite `source_urls`); the ortho APC study (PMC12915719) is corroboration, not primary. Anything unverifiable → `null` and the UI renders `—`, never a guess. **Janine audits this table before the Finder section goes public** — handoff `^handoff-janine-finder-metadata-audit` to be pushed by the Session 2 wrap-up (spec: spot-check ≥10 journals' indexing/APC/case-report cells against live pages; her sign-off flips the section from the Session-1 shell to live).

### 8.4 Surfaces & API

- `POST /api/finder/match` — body: the manuscript stats + preferences; returns scored list. Stateless, no auth, rate-limit 20/IP/day (mirror the formatter's limiter util), logs to the Sheets "Finder Submissions" tab (timestamp, article type, word count, subspecialty, top result — no email required).
- `FinderClient.tsx` in the `#finder` section: manual form (7 fields, one row of chips for subspecialty) OR auto-filled banner when arriving from a completed format job (`Using the numbers from manuscript_JBJS.docx — edit any of them`; pass stats client-side via in-memory state/context, NOT the URL). Results as scorecard rows: journal name, bucket chip (`fmt-ok/warn/bad`), per-constraint mono deltas, metadata line (indexing · OA · APC · speed), guidelines link, and `Format for this journal →` button that pre-selects the journal in the formatter app section — **the loop that makes the two tools one product.**
- FAQ + JSON-LD updated; hero kicker gains `+ JOURNAL FINDER`; the §5.9 shell copy is replaced by the live tool.

⏸ **STOP POINT — end of Session 2.** Unit tests for `match.ts` (≥12 cases incl. gates, near-fit boundary at exactly +10%, null-limit neutrality, OSCRSJ-no-boost); tsc 0; build green; Sheets row verified with a real POST; commit by explicit path; M1–M4 wrap-up; push the Janine audit handoff + update the Sushant handoff status in the vault.

---

## §9 — Session 3 (optional, after Kanwar reviews live Sessions 1–2)

1. MP4 export of the demo scenes at 1080×1920 via `export_reel.cjs` for an Instagram/LinkedIn launch reel (pairs with the reel workflow's caption rules; NO voiceover-tool attribution).
2. Finder v1.1: standalone `.docx` upload reusing the pipeline's extract stage (job row with a `finder` flavor).
3. Journal wall + Finder absorb the Top-100 expansion output as it lands (both render from the registries — should be automatic; verify).
4. John lane: GSC re-crawl request for /format, Rich Results validation of both JSON-LD blocks, AI-citation check ("best free manuscript formatting tool orthopedics").

---

## §10 — Risks & guardrails

- **Route-group mv is the highest-risk step** — it touches every page as a rename. Own commit, verify list in §6.1.5, orphan protocol if anything unexpected is staged. Never `git add -A` (Git Safety — this is exactly the corrupted-index scenario).
- **Concurrent Top-100 expansion lane** — journal JSONs/manifest may change under you. Additive-only design (§8.3) exists for this reason. Pull before each session.
- **Do not touch** `lib/formatting/` engine internals, the immutability gate, migrations, or `app/api/format/*` behavior. Finder reads registries; it never writes them.
- **Live page** — /format has real users mid-beta. No moment on `main` where the page 404s or the API contract changes; the restructure commit and the visual commit must each build green.
- **Copy discipline** — every stat keeps its footnote; anything flagged "secondary" in §1.1 keeps hedged phrasing. Medical-adjacent product: accuracy is brand.
- **Accessibility** — AA on all text tokens (§4.1 notes), focus rings, reduced-motion paths, demo `aria-hidden` (decorative) with an adjacent visually-hidden text description.

## Appendix A — Pain-point sources (verified 2026-07-12)

1. LeBlanc AG, et al. *Scientific sinkhole: The pernicious price of formatting.* PLOS ONE 2019;14(9):e0223116. — 14h; $477; 52h/yr; median 2 attempts. https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0223116
2. Jiang Y, et al. *The high resource impact of reformatting requirements for scientific papers.* PLOS ONE 2019;14(10):e0223976. — 91% want reform; 23.8M h / $1.1B per yr; >3mo delay in ~20%; 43% first-choice acceptance; 57.3% resubmit. https://pmc.ncbi.nlm.nih.gov/articles/PMC6821399/
3. Zotero Style Repository — 10,000+ CSL styles. https://www.zotero.org/styles
4. Clotworthy A, et al. *Saving time and money in biomedical publishing: the case for free-format submissions with minimal requirements.* BMC Medicine 2023;21:155. — ~6.3B combinations; ~11% provide templates; ~$2.5B / 75M h 2022–2030. https://bmcmedicine.biomedcentral.com/articles/10.1186/s12916-023-02882-y
5. AJE Manuscript Formatting — $75/manuscript/journal. https://www.aje.com/services/formatting (Editage/Enago ~$150–200: aggregator-sourced, phrase softly.)
6. (Context) Khan et al. *Put science first and formatting later.* EMBO Reports 2018;19(5):e45731 · format-free registry https://asntech.github.io/format-free-journals/

## Appendix B — Finder landscape sources (verified 2026-07-12)

- Publisher-locked finders: Elsevier journalfinder.elsevier.com (BM25/fingerprint; shows CiteScore/IF/speed/acceptance/APC) · Springer journalsuggester.springer.com · Wiley journalfinder.wiley.com · T&F + SAGE suggesters. Cross-publisher: JANE jane.biosemantics.org (Lucene MoreLikeThis; MEDLINE/DOAJ tags; free API) · B!SON service.tib.eu/bison (neural semantic+bibliometric; open source; eval paper: Entrup et al., Int J Digit Libr 2023, doi:10.1007/s00799-023-00372-3) · Jot jot.publichealth.yale.edu (JANE API + NLM/DOAJ/Sherpa joins) · JournalGuide (degraded) · SciSpace agents (finder ≠ word-limit checker; fragmented). Edanz Journal Selector discontinued 2024.
- Author-priority surveys: Rowley et al. 2022, J Information Science (10.1177/0165551520958591) · Beshyah 2019, SQUMJ (PMC6544072) · Gaston et al. 2020, Learned Publishing (10.1002/leap.1285) — scope + review quality > indexing > IF; OA lower than assumed.
- Case-report venue landscape: JMLA 2023 directory, 1,028 MEDLINE-indexed case-report-accepting journals, CC-BY at https://osf.io/b9wnx (PMC10621715) · ortho APC study PMC12915719 (306 journals, mean APC $1,975) · sample APCs: JOCR ~$450 · JBJS OA $2,400 · JOS Case Reports $800 · Case Reports in Orthopedics $870 · Clinical Case Reports $1,910 · Cureus $0-if-criteria.
- Differentiation verdict: no existing tool is cross-publisher + specialty-specific + manuscript-constraint-aware; SciSpace is the nearest and splits the capabilities across disconnected agents.

*— End of brief. Handoffs and session wrap-ups per CLAUDE.md M1-M4 + Organization Plan §7.6. This file and the mockup are untracked at authoring time; Session 1 commits both by explicit path alongside its work (per the 2026-07-08 brief precedent).*
