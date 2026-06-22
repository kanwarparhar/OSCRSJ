import type { Metadata } from 'next'
import Link from 'next/link'
import ArticleFigureImage from '@/components/ArticleFigureImage'
import { createAdminClient } from '@/lib/supabase/server'
import { SUBSPECIALTIES } from '@/lib/constants'
import type {
  ManuscriptRow,
  ManuscriptAuthorRow,
  ManuscriptType,
} from '@/lib/types/database'

// Homepage canonical — `metadataBase` in the root layout doesn't emit a
// canonical tag on its own (it only resolves relative URLs in OG/Twitter
// blocks). Per John's 2026-04-24 site-wide canonical sweep, every public-
// indexable page gets an explicit `alternates.canonical`. Inherits title
// + description defaults from app/layout.tsx so we don't double up.
export const metadata: Metadata = {
  alternates: { canonical: 'https://www.oscrsj.com' },
  openGraph: {
    url: 'https://www.oscrsj.com',
    type: 'website',
  },
}

// Always fetch fresh — published-state transitions are editor-driven
// and rare; cheap query so revalidation overhead is fine.
export const dynamic = 'force-dynamic'

// Homepage Latest Articles block — pulls directly from `manuscripts`
// filtered to status='published' (LIMIT 3, newest first). Mirrors the
// server-component pattern Manvir locked at /articles in commit 93f6c9d
// (Option B per [[2026-04-30 John — Thin-Content Sweep]] D6). Admin
// client (service-role) on the server side because RLS would otherwise
// block an anonymous read; the narrow status='published' filter is the
// safety fence. Pre-launch (no published articles yet) renders an
// EmptyState — no fake-DOI samples, no E-E-A-T risk from broken
// doi.org redirects.
type FeaturedArticle = {
  id: string
  type: string
  title: string
  authors: string
  doi: string | null
  topic: string
  pdfStoragePath: string | null
}

const TYPE_LABELS: Record<ManuscriptType, string> = {
  case_report: 'Case Report',
  case_series: 'Case Series',
  surgical_technique: 'Surgical Technique',
  images_in_orthopedics: 'Images in Orthopedics',
  letter_to_editor: 'Letter to the Editor',
  review_article: 'Systematic Review & Meta-Analysis',
  narrative_review: 'Narrative Review',
}

const SUBSPECIALTY_LABELS: Record<string, string> = Object.fromEntries(
  SUBSPECIALTIES.map((s) => [s.slug, s.name])
)

async function loadFeaturedArticles(): Promise<FeaturedArticle[]> {
  const admin = createAdminClient()

  const { data: mData } = await admin
    .from('manuscripts')
    .select('*')
    .eq('status', 'published')
    .order('published_date', { ascending: false })
    .limit(3)

  const manuscripts = (mData as ManuscriptRow[] | null) || []
  if (manuscripts.length === 0) return []

  const manuscriptIds = manuscripts.map((m) => m.id)

  const { data: aData } = await admin
    .from('manuscript_authors')
    .select('*')
    .in('manuscript_id', manuscriptIds)
    .order('author_order', { ascending: true })

  const authorsById = new Map<string, ManuscriptAuthorRow[]>()
  for (const a of (aData as ManuscriptAuthorRow[] | null) || []) {
    const bucket = authorsById.get(a.manuscript_id) || []
    bucket.push(a)
    authorsById.set(a.manuscript_id, bucket)
  }

  return manuscripts.map((m) => {
    const authors = authorsById.get(m.id) || []
    const authorsLine = authors.map((a) => a.full_name).join(', ')
    const internalSlug = m.subspecialty || ''
    const subspecialtyLabel =
      SUBSPECIALTY_LABELS[internalSlug] || internalSlug
    const typeLabel = m.manuscript_type
      ? TYPE_LABELS[m.manuscript_type]
      : 'Case Report'
    return {
      id: m.id,
      type: typeLabel,
      title: m.title || '(untitled manuscript)',
      authors: authorsLine,
      doi: m.doi,
      topic: subspecialtyLabel,
      pdfStoragePath: m.published_pdf_storage_path ?? null,
    }
  })
}

const newsItems = [
  { date: 'April 2026', title: 'OSCRSJ officially launches, accepting submissions across all orthopedic subspecialties', tag: 'Journal' },
  { date: 'April 2026', title: 'Article Processing Charges waived for manuscripts submitted before July 1, 2026', tag: 'Journal' },
  { date: 'March 2026', title: 'Crossref membership confirmed, DOI registration active', tag: 'Journal' },
  { date: 'March 2026', title: 'AAOS 2026: Highlights in trauma and sports medicine research', tag: 'Orthopedics' },
  { date: 'February 2026', title: 'New CARE guidelines update for surgical case reporting', tag: 'Research' },
  { date: 'February 2026', title: 'Rising interest in AI-assisted fracture classification tools', tag: 'Orthopedics' },
]

export default async function HomePage() {
  const featuredArticles = await loadFeaturedArticles()

  return (
    <div className="bg-white">
      {/* Scroll-driven fade-in for content sections (CSS-only, view-timeline-based; gracefully degrades to no-animation on older browsers). */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @supports (animation-timeline: view()) {
              .scroll-fade-in {
                animation: oscrsj-scroll-fade-in linear both;
                animation-timeline: view();
                animation-range: entry 0% entry 80%;
              }
              @keyframes oscrsj-scroll-fade-in {
                from { opacity: 0; transform: translateY(24px); }
                to { opacity: 1; transform: translateY(0); }
              }
            }
            @media (prefers-reduced-motion: reduce) {
              .scroll-fade-in { animation: none !important; opacity: 1 !important; transform: none !important; }
            }
          `,
        }}
      />

      {/* 1. Hero — brand masthead lockup (eyebrow → OSCRSJ wordmark → diamond rule → italic subtitle) */}
      <section
        className="relative flex items-center justify-center text-center"
        style={{
          background: 'radial-gradient(ellipse at 50% 40%, var(--brown) 0%, var(--dark) 70%)',
          minHeight: '520px',
          padding: '96px 24px',
        }}
      >
        <div className="max-w-content mx-auto">
          {/* Eyebrow */}
          <p
            className="text-peach-dark mb-6"
            style={{
              fontSize: '13px',
              letterSpacing: '0.6em',
              fontWeight: 600,
              textTransform: 'uppercase',
            }}
          >
            Peer Reviewed · Quarterly
          </p>
          {/* Wordmark — serif, same rhythm as masthead-dark.svg */}
          <h1
            className="font-serif text-peach leading-none mb-5"
            style={{
              fontSize: 'clamp(64px, 11vw, 144px)',
              letterSpacing: '-0.05em',
              fontWeight: 400,
            }}
          >
            OSCRSJ
          </h1>
          {/* Diamond rule */}
          <div className="flex items-center justify-center gap-3 mb-6" aria-hidden="true">
            <span className="inline-block" style={{ width: '120px', height: '1px', background: 'var(--tan)' }} />
            <span
              className="inline-block"
              style={{ width: '10px', height: '10px', background: 'var(--tan)', transform: 'rotate(45deg)' }}
            />
            <span className="inline-block" style={{ width: '120px', height: '1px', background: 'var(--tan)' }} />
          </div>
          {/* Italic subtitle */}
          <p
            className="font-serif text-peach leading-snug mb-8"
            style={{
              fontSize: 'clamp(20px, 2.6vw, 30px)',
              fontStyle: 'italic',
              letterSpacing: '0.01em',
            }}
          >
            Orthopedic Surgery Case Reports &amp; Series Journal
          </p>
          <p className="text-peach/60 text-base max-w-2xl mx-auto mb-8 leading-relaxed">
            A peer-reviewed, open-access journal publishing case reports, case series, systematic reviews and meta-analyses, surgical techniques, images in orthopedics, and letters to the editor across all orthopedic subspecialties.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/submit" className="btn-primary">
              Submit Your Manuscript
            </Link>
            <Link href="/articles" className="btn-ghost">
              Browse Articles
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </Link>
          </div>
        </div>
      </section>

      {/* 2. For Authors — 3-column journal layout (no section heading; equal-height columns) */}
      <section className="bg-white scroll-fade-in" style={{ padding: '72px 24px 28px' }}>
        <div className="max-w-content mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-stretch">
            {/* LEFT — Journal cover (portrait, edge-to-edge cream) */}
            <div className="lg:col-span-4 flex items-center justify-center lg:justify-start">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/brand/cover-cream.png"
                alt="OSCRSJ inaugural issue cover — Volume 1, Number 1, April 2026"
                width={1360}
                height={1760}
                className="w-full max-w-[300px] h-auto rounded-md shadow-md"
                style={{ border: '1px solid var(--border)' }}
              />
            </div>

            {/* MIDDLE — Action buttons (4 buttons, slightly compact) */}
            <div className="lg:col-span-4 flex flex-col justify-center gap-3">
              {[
                { label: 'Submit Article', href: '/submit', external: true },
                { label: 'Guide for Authors', href: '/guide-for-authors' },
                { label: 'Author FAQ', href: '/faq' },
                { label: 'All Articles', href: '/articles' },
              ].map((b) => (
                <Link
                  key={b.href}
                  href={b.href}
                  className="group flex items-center justify-between gap-4 px-5 py-4 bg-white border border-border rounded-lg hover:border-brown-dark hover:shadow-md transition-all"
                >
                  <span className="font-serif text-black" style={{ fontSize: '18px' }}>
                    {b.label}
                  </span>
                  {b.external ? (
                    <svg className="w-4 h-4 text-brown group-hover:text-brown-dark transition-colors flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4 text-brown group-hover:text-brown-dark transition-colors flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  )}
                </Link>
              ))}
            </div>

            {/* RIGHT — Indexing / standards / open access (no heading) */}
            <div className="lg:col-span-4 flex flex-col justify-center">
              {/* Two key turnaround stats */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-cream-alt/50 rounded-lg p-4">
                  <p className="font-serif text-brown-dark leading-none mb-2" style={{ fontSize: '36px' }}>
                    10<span className="text-ink text-sm font-sans ml-1">days</span>
                  </p>
                  <p className="text-xs text-ink leading-snug">
                    From submission to initial editorial response
                  </p>
                </div>
                <div className="bg-cream-alt/50 rounded-lg p-4">
                  <p className="font-serif text-brown-dark leading-none mb-2" style={{ fontSize: '36px' }}>
                    35<span className="text-ink text-sm font-sans ml-1">days</span>
                  </p>
                  <p className="text-xs text-ink leading-snug">
                    From acceptance to publication
                  </p>
                </div>
              </div>

              {/* Standards rows */}
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-peach/20 flex items-center justify-center mt-0.5">
                    <svg className="w-4 h-4 text-brown-dark" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 6h16M4 12h16M4 18h7" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-black mb-1">Indexing</p>
                    <p className="text-xs text-ink leading-snug">
                      Crossref-registered DOIs. Active applications: DOAJ, Google Scholar, EBSCO. PubMed pathway underway.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-peach/20 flex items-center justify-center mt-0.5">
                    <svg className="w-4 h-4 text-brown-dark" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-black mb-1">COPE Standards</p>
                    <p className="text-xs text-ink leading-snug">
                      Editorial policies aligned with the Committee on Publication Ethics. Double-blind peer review.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-peach/20 flex items-center justify-center mt-0.5">
                    <svg className="w-4 h-4 text-brown-dark" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-black mb-1">Open Access</p>
                    <p className="text-xs text-ink leading-snug">
                      All articles published under CC BY 4.0. Authors retain copyright. APCs waived for 2026.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Section divider — light brown line between content sections */}
      <div className="bg-white px-6">
        <div className="max-w-content mx-auto">
          <hr style={{ border: 'none', borderTop: '1px solid rgba(153,126,103,0.3)', margin: 0 }} />
        </div>
      </div>

      {/* About the Journal — self-contained descriptive prose; primary
          search/AI-citation source so home/about (not /media) is what gets
          quoted when describing OSCRSJ. */}
      <section className="bg-white scroll-fade-in" style={{ padding: '64px 24px' }}>
        <div className="max-w-content mx-auto">
          <span className="section-label">About the Journal</span>
          <h2 className="section-heading mb-4">What Is OSCRSJ?</h2>
          <div className="max-w-3xl space-y-4 text-ink leading-relaxed">
            <p>
              The <strong>Orthopedic Surgery Case Reports &amp; Series Journal (OSCRSJ)</strong> is an independent, peer-reviewed, open-access medical journal founded in 2026. OSCRSJ publishes case reports, case series, systematic reviews and meta-analyses, narrative reviews, surgical techniques, images in orthopedics, and letters to the editor across every musculoskeletal subspecialty — including trauma, sports medicine, spine, adult reconstruction, pediatric orthopedics, hand and wrist, foot and ankle, shoulder, and orthopedic oncology.
            </p>
            <p>
              Every manuscript undergoes double-blind peer review by reviewers outside of our network, with a target first decision within ten days. Accepted articles receive a Crossref DOI and are published open access — free to read, download, and reuse with attribution — with an active pathway toward PubMed indexing. OSCRSJ serves the global orthopedic surgery community: practicing surgeons, fellows, residents, students, and researchers.
            </p>
          </div>
          <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2">
            <Link href="/aims-scope" className="text-brown hover:text-brown-dark transition-colors font-medium underline-offset-2 hover:underline">
              Aims &amp; Scope →
            </Link>
            <Link href="/editorial-board" className="text-brown hover:text-brown-dark transition-colors font-medium underline-offset-2 hover:underline">
              Editorial Board →
            </Link>
            <Link href="/peer-review" className="text-brown hover:text-brown-dark transition-colors font-medium underline-offset-2 hover:underline">
              Peer Review Process →
            </Link>
          </div>
        </div>
      </section>

      {/* Section divider — light brown line between content sections */}
      <div className="bg-white px-6">
        <div className="max-w-content mx-auto">
          <hr style={{ border: 'none', borderTop: '1px solid rgba(153,126,103,0.3)', margin: 0 }} />
        </div>
      </div>

      {/* 3. Editor-in-Chief — leadership credibility section */}
      <section className="bg-white scroll-fade-in" style={{ padding: '72px 24px' }}>
        <div className="max-w-content mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
            {/* LEFT — Headshot, no surrounding frame box */}
            <div className="lg:col-span-5 flex items-center justify-center lg:justify-start">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/brand/madhan-jeyaraman.jpg"
                alt="Portrait of Dr. Madhan Jeyaraman, Editor-in-Chief of OSCRSJ"
                width={800}
                height={800}
                className="block w-full max-w-[400px] h-auto rounded-md shadow-md"
              />
            </div>

            {/* RIGHT — Editorial content */}
            <div className="lg:col-span-7 flex flex-col justify-center">
              <span className="section-label text-ink mb-3">Editor-in-Chief</span>
              <h2
                className="font-serif text-brown-dark mb-2 leading-tight"
                style={{ fontSize: 'clamp(32px, 4vw, 44px)', letterSpacing: '-0.01em' }}
              >
                Madhan Jeyaraman, MD, PhD, MBA
              </h2>
              <div className="text-brown text-base mb-6 space-y-1 leading-relaxed">
                <p>Professor of Orthopaedics · Dr. MGR Educational and Research Institute, Chennai</p>
                <p>Founder Director · Agathisha Ortho Stemcell Clinic (AOSC)</p>
                <p>Head, Research and Development · Sri Lalithambigai Medical College and Hospital</p>
              </div>

              {/* Stat block — matches Journal Insights styling in For Authors */}
              <div className="grid grid-cols-2 gap-4 mb-6 max-w-md">
                <div className="bg-cream-alt/50 rounded-lg p-4">
                  <p
                    className="font-serif text-brown-dark leading-none mb-2"
                    style={{ fontSize: '36px' }}
                  >
                    460<span className="text-ink text-sm font-sans ml-1">+</span>
                  </p>
                  <p className="text-xs text-ink leading-snug">Peer-reviewed publications</p>
                </div>
                <div className="bg-cream-alt/50 rounded-lg p-4">
                  <p
                    className="font-serif text-brown-dark leading-none mb-2"
                    style={{ fontSize: '36px' }}
                  >
                    4,295<span className="text-ink text-sm font-sans ml-1">+</span>
                  </p>
                  <p className="text-xs text-ink leading-snug">Citations</p>
                </div>
              </div>

              <p className="text-ink text-base leading-relaxed mb-6 max-w-xl">
                Leads OSCRSJ&apos;s editorial direction with an emphasis on rigorous methodology, scholarly quality, and substantive review.
              </p>

              <div>
                <Link
                  href="/editorial-board"
                  className="inline-flex items-center gap-2 text-brown-dark hover:text-brown font-medium border-b border-brown-dark/30 hover:border-brown-dark pb-1 transition-colors"
                >
                  Meet the editorial board
                  <svg
                    className="w-3.5 h-3.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Section divider — light brown line between content sections */}
      <div className="bg-white px-6">
        <div className="max-w-content mx-auto">
          <hr style={{ border: 'none', borderTop: '1px solid rgba(153,126,103,0.3)', margin: 0 }} />
        </div>
      </div>

      {/* 4. Latest Articles */}
      <section className="bg-white scroll-fade-in" style={{ padding: '28px 24px 72px' }}>
        <div className="max-w-content mx-auto">
          <span className="section-label text-ink">Latest Articles</span>
          <div className="flex items-end justify-between mb-8">
            <h2 className="section-heading text-black">Recent Publications</h2>
            <Link
              href="/articles"
              className="text-sm text-ink hover:text-black font-medium transition-colors hidden sm:inline-flex items-center gap-1"
            >
              See all articles
              <svg className="w-3.5 h-3.5 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>

          {featuredArticles.length === 0 ? (
            <div className="bg-cream-alt border border-border rounded-2xl p-8 text-center">
              <div className="text-4xl mb-4">📚</div>
              <h3 className="section-heading mb-3">No Published Articles Yet</h3>
              <p className="text-ink leading-relaxed max-w-xl mx-auto mb-6">
                OSCRSJ is in pre-launch. Our first peer-reviewed manuscripts —
                across all six article types — will appear here as they
                complete editorial review.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Link href="/submit" className="btn-primary-light">
                  Submit a Manuscript
                </Link>
                <Link href="/articles/in-press" className="btn-outline">
                  See Articles in Press
                </Link>
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {featuredArticles.map((article, i) => (
                  <article
                    key={article.id}
                    className={`card flex flex-col ${i === 0 ? 'md:row-span-2' : ''}`}
                  >
                    <Link href={`/articles/${article.id}`} className="block">
                      <ArticleFigureImage
                        articleId={article.id}
                        title={article.title}
                        height={i === 0 ? 'tall' : 'short'}
                      />
                    </Link>
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-xs font-medium text-ink bg-tan/20 px-2.5 py-1 rounded-full">
                        {article.type}
                      </span>
                      {article.topic && (
                        <span className="text-xs text-ink bg-black/5 px-2.5 py-1 rounded-full">
                          {article.topic}
                        </span>
                      )}
                    </div>
                    <Link href={`/articles/${article.id}`} className="group block flex-1">
                      <h3 className="font-serif text-lg font-normal text-black leading-snug mb-3 group-hover:text-brown-dark transition-colors">
                        {article.title}
                      </h3>
                    </Link>
                    {article.authors && (
                      <p className="text-xs text-ink mb-2">{article.authors}</p>
                    )}
                    {article.doi && (
                      <p className="text-xs text-ink font-mono">{article.doi}</p>
                    )}
                    <Link
                      href={`/articles/${article.id}`}
                      className="mt-4 text-sm text-ink font-medium hover:text-black transition-colors flex items-center gap-1"
                    >
                      Read article
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </Link>
                  </article>
                ))}
              </div>

              <div className="mt-8 text-center sm:hidden">
                <Link href="/articles" className="btn-primary-light">See all articles</Link>
              </div>
            </>
          )}
        </div>
      </section>

      {/* Section divider — light brown line between content sections */}
      <div className="bg-white px-6">
        <div className="max-w-content mx-auto">
          <hr style={{ border: 'none', borderTop: '1px solid rgba(153,126,103,0.3)', margin: 0 }} />
        </div>
      </div>

      {/* 5. News */}
      <section className="bg-white scroll-fade-in" style={{ padding: '72px 24px' }}>
        <div className="max-w-content mx-auto">
          <span className="section-label text-ink">News &amp; Updates</span>
          <h2 className="section-heading text-black mb-8" style={{ fontSize: 'clamp(28px, 3.5vw, 36px)' }}>From the Field</h2>

          <div className="relative">
            <div
              className="flex gap-5 overflow-x-auto pb-4"
              style={{ scrollSnapType: 'x mandatory', WebkitOverflowScrolling: 'touch', scrollbarWidth: 'thin' }}
            >
              {newsItems.map((item, i) => (
                <div
                  key={i}
                  className="card flex-shrink-0 flex flex-col justify-between"
                  style={{ width: '300px', minHeight: '180px', scrollSnapAlign: 'start' }}
                >
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <span
                        className="text-xs font-medium px-2.5 py-1 rounded-full"
                        style={{
                          backgroundColor: item.tag === 'Journal' ? 'rgba(255,219,187,0.3)' : item.tag === 'Orthopedics' ? 'rgba(0,0,0,0.06)' : 'rgba(0,0,0,0.04)',
                          color: 'var(--ink)',
                        }}
                      >
                        {item.tag}
                      </span>
                    </div>
                    <p className="font-serif text-black leading-snug" style={{ fontSize: '16px' }}>
                      {item.title}
                    </p>
                  </div>
                  <p className="text-xs text-ink mt-4">{item.date}</p>
                </div>
              ))}
            </div>
            {/* Scroll fade hint */}
            <div
              className="absolute right-0 top-0 bottom-4 w-16 pointer-events-none hidden sm:block"
              style={{ background: 'linear-gradient(to right, transparent, #FFFFFF)' }}
            />
          </div>
        </div>
      </section>

      {/* Section divider — light brown line between content sections */}
      <div className="bg-white px-6">
        <div className="max-w-content mx-auto">
          <hr style={{ border: 'none', borderTop: '1px solid rgba(153,126,103,0.3)', margin: 0 }} />
        </div>
      </div>

      {/* 6. Newsletter */}
      <section className="bg-white scroll-fade-in" style={{ padding: '72px 24px' }}>
        <div className="max-w-content mx-auto text-center max-w-lg">
          <span className="section-label text-ink">Stay Updated</span>
          <h2 className="section-heading text-black mb-2">Get notified when new issues are published</h2>
          <p className="text-ink text-sm mb-6">
            No spam. Just orthopedic research delivered to your inbox.
          </p>
          <form className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
            <input
              type="email"
              placeholder="your@email.com"
              className="flex-1 text-sm px-4 py-2.5 bg-white border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-peach/40 placeholder:text-ink/50 text-ink transition"
            />
            <button type="submit" className="btn-primary-light justify-center">
              Subscribe
            </button>
          </form>
          <p className="text-xs text-ink mt-3">Unsubscribe at any time.</p>
        </div>
      </section>

      {/* 7. CTA */}
      <section className="scroll-fade-in" style={{ backgroundColor: 'var(--dark)', padding: '72px 24px' }}>
        <div className="max-w-content mx-auto text-center">
          <h2
            className="font-serif text-peach leading-tight mb-6"
            style={{ fontSize: 'clamp(28px, 4vw, 40px)', letterSpacing: '-0.02em' }}
          >
            Raising the bar for orthopedic scholarship
          </h2>
          <p className="text-peach/50 text-sm mb-8 max-w-lg mx-auto">
            Join the global orthopedic surgery community publishing rigorous, peer-reviewed case reports, case series, systematic reviews, and more.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/submit" className="btn-primary">
              Submit a Manuscript
            </Link>
            <Link href="/aims-scope" className="btn-ghost">
              Learn More
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
