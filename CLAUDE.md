# OSCRSJ Website — Claude Code Context

## What This Project Is
The official website for **OSCRSJ** (Orthopedic Surgery Case Reports & Series Journal) — Kanwar's independent, open-access orthopedic research journal business targeting medical students, residents, and fellows. Domain: **OSCRSJ.com**. Pre-launch as of April 2026.

---

## Current State
A complete Next.js 14 website — **58 pages total** (35 existing + `/news` landing + `/news/ai-in-orthopedics` + 6 category archives + 2 Editor's Pick guides + 11 inaugural AI-in-Ortho briefs shipped 2026-04-16 + `/for-reviewers/apply` shipped Session 7 + `/dashboard/admin/reviewer-applications` shipped Session 8), all TypeScript-clean, no 404s. The site includes a full auth system (register, login, password reset), author dashboard, ORCID OAuth integration, Cloudflare Turnstile CAPTCHA, and an AI in Orthopedics hub with 2 Editor's Picks + 20-term glossary + the full inaugural 11-brief slate (Imaging ×2, Surgical Planning ×2, Robotics ×2, Outcomes ×1, LLMs ×2, Research Tools ×2) now live across all six categories. **Live at https://oscrsj.com**.

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
| `/topics` | `app/topics/page.tsx` | ✅ Complete |
| `/topics/[slug]` | `app/topics/[slug]/page.tsx` | ✅ Complete (dynamic, 8 subspecialties) |
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
- Migrations 003–007 executed (003/004 in Session 5, 005 defensive RLS restore in Session 6, 006 reviewer_applications + 007 ai_disclosure in Session 7). No new migrations shipped Session 8.
- ~~No reviewer application form~~ ✅ Shipped Session 7 (`/for-reviewers/apply`). ~~Admin approval UI~~ ✅ Shipped Session 8 (`/dashboard/admin/reviewer-applications` — editor/admin-gated list + inline row expansion + status transitions + admin notes + audit log). Detail subroute deferred; inline expansion carries the whole UI.
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
"Neutral Elegance" palette inspired by newgenre.studio. Dark gradient hero, editorial serif typography, warm tones. All tokens in `tailwind.config.ts` and `app/globals.css`. Design system v2.0 (overhauled 2026-04-12).

| Token | Value | Usage |
|---|---|---|
| `peach` | `#FFDBBB` | CTA buttons on dark backgrounds, accent highlights |
| `peach-dark` | `#F0C49A` | CTA buttons on light/cream backgrounds |
| `taupe` | `#CCBEB1` | Decorative ONLY (borders, dividers). NEVER for text. |
| `tan` | `#997E67` | Hover border on interactive cards, decorative dividers. **Banned from text classes** site-wide as of commit `14d03e3` (2026-04-17) — 3.53:1 contrast on cream fails WCAG AA for normal text. Use `text-brown` (7.62:1) for metadata. |
| `brown` | `#664930` | Accent text on light bg, button text |
| `brown-dark` | `#3d2a18` | Primary text |
| `dark` | `#1c0f05` | Hero bg, nav bg, footer bg |
| `dark-card` | `#261609` | Dark card backgrounds |
| `cream` | `#FFF5EB` | Main page background |
| `cream-alt` | `#F5EAE0` | Alternating section background |
| `white` | `#FFFFFF` | All cards, form inputs, article wells (surface tier) |
| `border` | `rgba(153,126,103,0.12)` | Subtle borders/dividers |

**4-tier visual hierarchy:** dark (#1c0f05) > cream (#FFF5EB) > cream-alt (#F5EAE0) > white (#FFFFFF)

**Fonts:** DM Serif Display (headings) + Inter (body)

**Component classes in `globals.css`:** `.btn-primary` (peach, for dark bg), `.btn-primary-light` (peach-dark + brown border, for light bg), `.btn-outline`, `.btn-ghost`, `.card` (white bg, no hover), `.section-heading`, `.section-label`, `.nav-link`

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

The site is live at oscrsj.com. **Session 8 (2026-04-18, Sushant)** shipped the admin approval UI for `reviewer_applications`, GDPR data export endpoint, and the custom auth domain runbook. Session 7 (2026-04-17) shipped `/for-reviewers/apply` reviewer intake form + AI-assisted-writing disclosure field on Step 5. Session 6 (2026-04-17) shipped withdrawal flow + Reply-To header + E2E email pipeline confirmed live. Franklin commit `14d03e3` (2026-04-17) shipped apex → www canonical cleanup + a11y tan→brown contrast pass; live on production. AI in Orthopedics hub: 11 inaugural briefs + 20-term glossary + 2 Editor's Picks live. Session 9 priorities in order:

1. **AI in Orthopedics content population** (Arjun Agent scope — 6 of 10 briefs shipped 2026-04-16)
   - ✅ Glossary v1 (20 terms) — live on landing page accordion
   - ✅ Final 150-word primer (`AI_ORTHO_PRIMER`) — shipped
   - ✅ Editor's Pick: Imaging Primer for Residents — live at `/news/ai-in-orthopedics/guides/imaging-primer-for-residents`
   - ✅ Editor's Pick: LLM Guide for Trainees — live at `/news/ai-in-orthopedics/guides/llm-guide-for-trainees`
   - ✅ 11 inaugural briefs shipped 2026-04-16 across two same-day Cowork sessions: Imaging (commercial-ai-fracture-detection-meta-analysis, deep-learning-cobb-angle-meta-analysis), Surgical Planning (ai-3d-planning-total-hip-arthroplasty-meta-analysis, ar-navigation-pedicle-screw-rct), Robotics (robot-assisted-femoral-shaft-reduction-controlled-trial, robotic-assisted-arthroscopy-hss-review), Outcomes (xgboost-tka-complications-prediction), LLMs (chatgpt-deepseek-aaos-clavicle-guidelines, chatgpt-medicine-applications-challenges-review), Research Tools (chatgpt-orthopedic-literature-review-comparison, ai-research-assistant-orthopedic-resident-review). Path (b) (uploaded PDFs → in-context extraction via `pdftotext -layout`) proved the higher-fidelity route over web fetch.
   - ⏳ Kanwar to supply the Canva hero export per Page Plan §13 (1920×800) and drop at `/public/images/ai-in-ortho-hero.png` — `<Image>` block is already uncommented and waiting
   - ⏳ OG image: drop 1200×630 Canva export at `/public/images/ai-in-ortho-og.png` so social previews render (metadata wired 2026-04-14)

2. **Submission Portal Session 9: Reviewer invitation workflow + deferred auth retest** (Sushant Agent scope)
   - ⏳ Full end-to-end auth retest — deferred from Sessions 5, 6, 7, and 8 (not attempted in code-only Session 8). Kanwar/Sushant to walk signup → email confirm → dashboard → reset on production.
   - 🔨 Reviewer invitation workflow (Phase 2 kickoff) — editor picks a reviewer from the `active` reviewer_applications slate, sends an invitation email with a magic-token `/review/[token]` acceptance URL, seeds a `review_invitations` row.
   - 📋 Stripe payment integration spec draft (still blocked on LLC for execution, but Brad can scope the APC invoice flow: ACCEPTED → AWAITING_PAYMENT → Stripe invoice → PAID).
   - 📋 Custom auth domain `auth.oscrsj.com` — runbook ready at `docs/supabase-custom-auth-domain.md`; execution needs Supabase Pro upgrade decision + GoDaddy CNAME + email template rewrite.
   - 📋 `EMAIL_REPLY_TO=editorial@oscrsj.com` env var set on all 3 Vercel envs once Google Workspace mailbox is provisioned. Currently falling through to the code-level `kanwarparhar@gmail.com` default.
   - 📋 Optional admin UI polish: dedicated `/dashboard/admin/reviewer-applications/[id]` detail view (Session 8 shipped inline expand on the list row; detail route was deferred).

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
│   ├── topics/
│   │   ├── page.tsx
│   │   └── [slug]/page.tsx            ← Dynamic — 8 subspecialties
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
│   │   ├── DashboardShell.tsx         ← Client component (sidebar nav, mobile menu; Session 8 shows Admin section for editor/admin roles)
│   │   ├── page.tsx                   ← My Submissions list with status badges
│   │   ├── settings/
│   │   │   ├── page.tsx
│   │   │   └── ProfileForm.tsx        ← Client component (profile editor + Session 8 GDPR export button)
│   │   ├── admin/
│   │   │   ├── layout.tsx             ← Server-side editor/admin role guard for every /dashboard/admin/* route (Session 8)
│   │   │   └── reviewer-applications/
│   │   │       ├── page.tsx           ← Server component: list + status filter query param (Session 8)
│   │   │       └── ReviewerApplicationsTable.tsx  ← Client component: inline expand, status transitions, admin notes (Session 8)
│   │   └── submit/
│   │       ├── page.tsx               ← Server wrapper (loads draft + authors + profile, renders wizard)
│   │       ├── SubmissionWizard.tsx    ← Client component (5-step wizard shell + auto-save + submit)
│   │       ├── Step1Type.tsx           ← Client component (manuscript type + confirmations)
│   │       ├── Step2Files.tsx          ← Client component (file upload + Supabase Storage)
│   │       ├── Step3Info.tsx           ← Client component (title, abstract, keywords, reviewers)
│   │       ├── Step4Authors.tsx        ← Client component (author list, reorder, ICMJE, certification)
│   │       └── Step5Declarations.tsx   ← Client component (COI, funding, ethics, review summary, submit)
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
│   ├── reviewer/
│   │   └── actions.ts                 ← Server actions: submitReviewerApplication (Session 7) + Session 8 admin triage (listReviewerApplications, updateReviewerApplicationStatus, updateReviewerApplicationAdminNotes — all re-check editor/admin role, audit-log status transitions)
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
│   │       └── coAuthorDisputeNotification.ts
│   ├── submission/
│   │   └── actions.ts                 ← Server actions (createOrUpdateDraft, saveManuscriptInfo, recordFile, deleteFile, saveAuthors, saveDeclarations, submitManuscript — submitManuscript now fires transactional emails)
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
        └── 007_ai_disclosure.sql                    ← manuscript_metadata.ai_tools_used + ai_tools_details (Session 7)
```
