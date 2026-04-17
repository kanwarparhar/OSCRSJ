# OSCRSJ Website — Claude Code Context

## What This Project Is
The official website for **OSCRSJ** (Orthopedic Surgery Case Reports & Series Journal) — Kanwar's independent, open-access orthopedic research journal business targeting medical students, residents, and fellows. Domain: **OSCRSJ.com**. Pre-launch as of April 2026.

---

## Current State
A complete Next.js 14 website — **56 pages total** (35 existing + `/news` landing + `/news/ai-in-orthopedics` + 6 category archives + 2 Editor's Pick guides + 11 inaugural AI-in-Ortho briefs shipped 2026-04-16), all TypeScript-clean, no 404s. The site includes a full auth system (register, login, password reset), author dashboard, ORCID OAuth integration, Cloudflare Turnstile CAPTCHA, and an AI in Orthopedics hub with 2 Editor's Picks + 20-term glossary + the full inaugural 11-brief slate (Imaging ×2, Surgical Planning ×2, Robotics ×2, Outcomes ×1, LLMs ×2, Research Tools ×2) now live across all six categories. **Live at https://oscrsj.com**.

### Deployment & Infrastructure
| Item | Details |
|---|---|
| **Live URL** | https://oscrsj.com |
| **GitHub Repo** | github.com/kanwarparhar/OSCRSJ (public) |
| **Hosting** | Vercel (free tier) — auto-deploys from `main` branch |
| **Domain Registrar** | GoDaddy — DNS configured |
| **DNS Records** | A record: `76.76.21.21` / CNAME: `cname.vercel-dns.com` |
| **SSL** | Active — auto-provisioned by Vercel (HTTPS) |
| **WWW redirect** | www.oscrsj.com → oscrsj.com |
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
| `/faq` | `app/faq/page.tsx` | ✅ Complete (27 questions, 5 categories, added 2026-04-11) |
| `/accessibility` | `app/accessibility/page.tsx` | ✅ Complete (added 2026-04-11) |
| `/dashboard` | `app/dashboard/page.tsx` | ✅ Complete (Session 2, author submissions list) |
| `/dashboard/settings` | `app/dashboard/settings/page.tsx` | ✅ Complete (Session 2, profile editor) |
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
- Auth system built but not yet tested on production (Vercel env vars added)
- File upload RLS on Supabase Storage bucket should be verified with a real upload test
- ~~No email notifications~~ ✅ Submission confirmation + co-author notification live as of Session 5 (2026-04-14). Withdrawal email pending until Session 6 ships the dashboard withdrawal button.
- Resend webhook must be registered manually in the Resend dashboard (URL `https://oscrsj.com/api/webhooks/resend`, events: delivered/bounced/complained/delivery_delayed) and its signing secret copied into `RESEND_WEBHOOK_SECRET` on Vercel before delivery status updates will flow.
- Migrations 003 and 004 must be executed manually in the Supabase SQL Editor before Session 5 features work end-to-end.
- No draft withdrawal button on dashboard -- coming Session 6
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
| `tan` | `#997E67` | Secondary metadata text, hover border on interactive cards |
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

The site is live at oscrsj.com. 43 pages pushed to main. Session Franklin (2026-04-14) completed: AI in Orthopedics hub scaffolding shipped — landing, 6 category archives, brief template with NewsArticle + ScholarlyArticle JSON-LD (SSR-verified), 6 inline SVG category icons, sitemap + nav updates. Content is placeholder; Arjun owns brief population. Session 5 (2026-04-14) prior: transactional email pipeline live (Resend SDK + 4 branded templates + JWT dispute tokens + webhook). Priorities in order:

1. **AI in Orthopedics content population** (Arjun Agent scope — 6 of 10 briefs shipped 2026-04-16)
   - ✅ Glossary v1 (20 terms) — live on landing page accordion
   - ✅ Final 150-word primer (`AI_ORTHO_PRIMER`) — shipped
   - ✅ Editor's Pick: Imaging Primer for Residents — live at `/news/ai-in-orthopedics/guides/imaging-primer-for-residents`
   - ✅ Editor's Pick: LLM Guide for Trainees — live at `/news/ai-in-orthopedics/guides/llm-guide-for-trainees`
   - ✅ 11 inaugural briefs shipped 2026-04-16 across two same-day Cowork sessions: Imaging (commercial-ai-fracture-detection-meta-analysis, deep-learning-cobb-angle-meta-analysis), Surgical Planning (ai-3d-planning-total-hip-arthroplasty-meta-analysis, ar-navigation-pedicle-screw-rct), Robotics (robot-assisted-femoral-shaft-reduction-controlled-trial, robotic-assisted-arthroscopy-hss-review), Outcomes (xgboost-tka-complications-prediction), LLMs (chatgpt-deepseek-aaos-clavicle-guidelines, chatgpt-medicine-applications-challenges-review), Research Tools (chatgpt-orthopedic-literature-review-comparison, ai-research-assistant-orthopedic-resident-review). Path (b) (uploaded PDFs → in-context extraction via `pdftotext -layout`) proved the higher-fidelity route over web fetch.
   - ⏳ Kanwar to supply the Canva hero export per Page Plan §13 (1920×800) and drop at `/public/images/ai-in-ortho-hero.png` — `<Image>` block is already uncommented and waiting
   - ⏳ OG image: drop 1200×630 Canva export at `/public/images/ai-in-ortho-og.png` so social previews render (metadata wired 2026-04-14)

2. **Submission Portal Session 6: Withdrawal flow + deferred polish** (Sushant Agent scope)
   - Dashboard withdrawal button (UI on the submissions list for pre-decision manuscripts)
   - `withdrawManuscript` server action (DRAFT/SUBMITTED/UNDER_REVIEW → WITHDRAWN, with optional reason)
   - Withdrawal confirmation email to author + editor + active reviewers
   - End-to-end auth retest deferred from 2026-04-13 (signup → email → confirm → dashboard)
   - Reply-To header on `noreply@oscrsj.com` so replies route to a real inbox
   - Custom auth domain (`auth.oscrsj.com`) so Supabase confirmation links match the sending domain
   - Stripe payment integration planning (blocked until LLC formed, but can spec)

2. **Submit sitemap to Google Search Console**
   - Go to search.google.com/search-console → add oscrsj.com property
   - Submit https://oscrsj.com/sitemap.xml

3. **Wire up forms**
   - Contact form: connect to Resend or Next.js API route
   - Newsletter signup (`/subscribe`): integrate with Buttondown, Mailchimp, or Resend
   - Add form validation and success/error states

4. **Downloadable templates & checklists**
   - Create downloadable patient consent form template (PDF or DOCX)
   - Create author pre-submission checklist (on Guide for Authors + Submit pages)

5. **Sample articles & reviewer recruitment**
   - Create 1-2 sample/template articles showing what good submissions look like
   - Build a reviewer interest/application form

6. **Publish first articles & launch** (target: mid-2026)
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
│   │   ├── DashboardShell.tsx         ← Client component (sidebar nav, mobile menu)
│   │   ├── page.tsx                   ← My Submissions list with status badges
│   │   ├── settings/
│   │   │   ├── page.tsx
│   │   │   └── ProfileForm.tsx        ← Client component (profile editor)
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
│   ├── for-reviewers/page.tsx          ← Full reviewer instruction guide
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
│       └── database.ts                ← TypeScript types for all 12 Supabase tables + enums
└── supabase/
    └── migrations/
        ├── 001_initial_schema.sql     ← Full schema: 12 tables, enums, RLS policies, triggers
        ├── 002_rls_policies.sql       ← RLS policy adjustments
        ├── 003_email_logs_resend.sql  ← Resend message id, delivery event columns, enum additions
        └── 004_co_author_disputes.sql ← manuscript_metadata.co_author_disputes + audit_logs.details
```
