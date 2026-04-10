# OSCRSJ Website — Claude Code Context

## What This Project Is
The official website for **OSCRSJ** (Orthopedic Surgery Case Reports & Series Journal) — Kanwar's independent, open-access orthopedic research journal business targeting medical students, residents, and fellows. Domain: **OSCRSJ.com**. Pre-launch as of April 2026.

---

## Current State
A complete Next.js 14 website — **26 pages total**, all TypeScript-clean, no 404s. The site is feature-complete for a pre-launch journal. The site has **not yet been deployed** — that is the next step.

### Pages Built — All 26
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
| `/guide-for-authors` | `app/guide-for-authors/page.tsx` | ✅ Complete |
| `/apc` | `app/apc/page.tsx` | ✅ Complete |
| `/peer-review` | `app/peer-review/page.tsx` | ✅ Complete |
| `/editorial-policies` | `app/editorial-policies/page.tsx` | ✅ Complete |
| `/open-access` | `app/open-access/page.tsx` | ✅ Complete |
| `/indexing` | `app/indexing/page.tsx` | ✅ Complete |
| `/about` | `app/about/page.tsx` | ✅ Complete |
| `/aims-scope` | `app/aims-scope/page.tsx` | ✅ Complete |
| `/editorial-board` | `app/editorial-board/page.tsx` | ✅ Complete |
| `/contact` | `app/contact/page.tsx` | ✅ Complete |
| `/subscribe` | `app/subscribe/page.tsx` | ✅ Complete |
| `/login` | `app/login/page.tsx` | ✅ Placeholder (portal coming soon) |
| `/register` | `app/register/page.tsx` | ✅ Placeholder (registration coming soon) |
| `/privacy` | `app/privacy/page.tsx` | ✅ Complete |
| `/terms` | `app/terms/page.tsx` | ✅ Complete |

### Components
- `components/Header.tsx` — sticky header, full dropdown nav, mobile hamburger, search bar, top bar with Submit/Login/Register links (~200 lines)
- `components/Footer.tsx` — 4-column footer with dark charcoal background (~95 lines)

### What Doesn't Work Yet (known gaps)
- Forms are static (contact, subscribe, search) — no backend wired
- Login/Register are placeholder pages — no auth system built yet
- Search bar in header is non-functional UI
- No real articles published (3 sample placeholders on `/articles`)

---

## Tech Stack
- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS with custom design tokens
- **Fonts:** Lora (serif headings) + Inter (body) via Google Fonts
- **Deployment target:** Vercel (free tier) → connect OSCRSJ.com

---

## Design System
Inspired by Anthropic/Claude's warm aesthetic. All tokens are in `tailwind.config.ts` and `app/globals.css`.

| Token | Value | Usage |
|---|---|---|
| `cream` | `#FAF9F7` | Main background |
| `sand` | `#F0EBE3` | Cards, secondary bg |
| `border` | `#E5DDD5` | All borders |
| `coral` | `#D97757` | Primary accent, CTAs, links |
| `coral-dark` | `#C46442` | Hover states |
| `charcoal` | `#1A1A1A` | Primary text |
| `charcoal-muted` | `#6B6560` | Secondary text |
| `charcoal-light` | `#9C9490` | Placeholder, labels |

Custom component classes in `globals.css`: `.btn-primary`, `.btn-outline`, `.btn-ghost`, `.card`, `.section-heading`, `.nav-link`

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

All 26 pages are built and the site is ready for deployment. Priorities in order:

1. **Deploy to Vercel** ← START HERE
   - `git init && git add . && git commit -m "Initial OSCRSJ website — 26 pages"`
   - Push to a new GitHub repo
   - Connect repo to Vercel at vercel.com → New Project
   - Add custom domain `OSCRSJ.com` in Vercel dashboard
   - Configure DNS records with domain registrar
   - Verify HTTPS is working

2. **Logo & branding** — No logo yet
   - Design an SVG wordmark or monogram ("OSCRSJ") fitting the coral/serif aesthetic
   - Create a favicon (consider an "O" monogram)
   - Add Open Graph images for social sharing

3. **Wire up forms**
   - Contact form: connect to Resend, Formspree, or a Next.js API route
   - Newsletter signup (`/subscribe`): integrate with Buttondown, Mailchimp, or Resend
   - Add form validation and success/error states

4. **SEO & Analytics**
   - Add Google Analytics or Plausible for visitor tracking
   - Submit `sitemap.xml` to Google Search Console
   - Add JSON-LD structured data for scholarly articles
   - Optimize meta descriptions for each page

5. **Build the Submission Portal** (core product — future session)
   - Author registration and authentication
   - Manuscript upload with metadata form
   - Automated screening and plagiarism detection
   - Reviewer assignment and tracking dashboard
   - Editorial decision workflow + email notifications

6. **Publish first articles & launch** (target: mid-2026)
   - Recruit 3–5 initial submissions from your network
   - Complete peer review and publish with Crossref DOIs
   - Begin monthly publication cadence (required for PubMed application)
   - Apply for DOAJ listing after first few issues

---

## What Kanwar Wants Claude Code to Focus On
- He is **non-technical** but comfortable using Claude Code with Opus
- Prefer clear, self-contained components over abstracted systems
- Design should stay true to the Anthropic/Claude warm aesthetic — don't drift to generic medical blue
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
├── app/
│   ├── layout.tsx
│   ├── globals.css
│   ├── page.tsx                       ← Homepage
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
│   ├── login/page.tsx
│   ├── register/page.tsx
│   ├── privacy/page.tsx
│   └── terms/page.tsx
└── components/
    ├── Header.tsx
    └── Footer.tsx
```
