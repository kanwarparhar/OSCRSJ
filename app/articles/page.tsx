'use client'

import { useMemo, useState, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import PageHeader from '@/components/PageHeader'

// Articles use descriptive slugs for URL-facing presentation.
// (Internal SUBSPECIALTIES slugs in lib/constants.ts — used by the
// submission wizard + reviewer app form + Supabase storage — stay
// short. When real articles flow from the DB, map internal slug →
// descriptive URL slug at read time.)
type Article = {
  type: 'Case Report' | 'Case Series'
  title: string
  authors: string
  doi: string
  topic: string
  topicSlug: string
  date: string
  abstract: string
}

const articles: Article[] = [
  {
    type: 'Case Report',
    title: 'Bilateral Spontaneous Patellar Tendon Rupture in a Young Athlete: A Rare Presentation',
    authors: 'Smith JA, Patel RK, Johnson ML',
    doi: '10.XXXX/oscrsj.2026.001',
    topic: 'Sports Medicine',
    topicSlug: 'sports-medicine',
    date: 'March 2026',
    abstract: 'We report a rare case of simultaneous bilateral patellar tendon rupture in a 24-year-old competitive weightlifter with no history of corticosteroid use or systemic disease.',
  },
  {
    type: 'Case Series',
    title: 'Minimally Invasive Fixation of Distal Radius Fractures in Elderly Patients: A Three-Case Series',
    authors: 'Chen W, Rodriguez L, Kim DH',
    doi: '10.XXXX/oscrsj.2026.002',
    topic: 'Trauma & Fractures',
    topicSlug: 'trauma',
    date: 'March 2026',
    abstract: 'Three cases of distal radius fractures in patients over 75 years of age managed with volar locking plate fixation, demonstrating favorable outcomes with early mobilization.',
  },
  {
    type: 'Case Report',
    title: 'Unusual Presentation of Pigmented Villonodular Synovitis in the Ankle Joint',
    authors: 'Thompson BJ, Nguyen TT',
    doi: '10.XXXX/oscrsj.2026.003',
    topic: 'Foot & Ankle',
    topicSlug: 'foot-ankle',
    date: 'February 2026',
    abstract: 'A 31-year-old woman presented with a 2-year history of right ankle swelling and pain. MRI and subsequent arthroscopic biopsy confirmed diffuse pigmented villonodular synovitis.',
  },
]

// Descriptive URL slugs. Kept alphabetical-by-label for the sidebar.
const topicFilters = [
  { label: 'All Topics', slug: '' },
  { label: 'Arthroplasty', slug: 'arthroplasty' },
  { label: 'Foot & Ankle', slug: 'foot-ankle' },
  { label: 'Hand & Wrist', slug: 'hand-wrist' },
  { label: 'Pediatric Orthopedics', slug: 'pediatric-orthopedics' },
  { label: 'Spine', slug: 'spine' },
  { label: 'Sports Medicine', slug: 'sports-medicine' },
  { label: 'Trauma & Fractures', slug: 'trauma' },
  { label: 'Tumor & Oncology', slug: 'orthopedic-oncology' },
]

const tabs = [
  { label: 'All Articles', href: '/articles' },
  { label: 'Current Issue', href: '/articles/current-issue' },
  { label: 'Articles in Press', href: '/articles/in-press' },
  { label: 'Most Read', href: '/articles/most-read' },
  { label: 'Most Cited', href: '/articles/most-cited' },
]

function ArticlesBrowser() {
  const searchParams = useSearchParams()
  const router = useRouter()

  // Initial state seeded from ?topic=... so old /topics/<slug> 301-redirects
  // land on a pre-filtered view.
  const initialTopic = searchParams.get('topic') ?? ''
  const [activeTopic, setActiveTopic] = useState(initialTopic)
  const [query, setQuery] = useState('')

  // Keep the URL in sync with active topic without navigating (shallow).
  useEffect(() => {
    const params = new URLSearchParams(Array.from(searchParams.entries()))
    if (activeTopic) {
      params.set('topic', activeTopic)
    } else {
      params.delete('topic')
    }
    const qs = params.toString()
    router.replace(qs ? `/articles?${qs}` : '/articles', { scroll: false })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTopic])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return articles.filter((a) => {
      const topicOk = activeTopic === '' || a.topicSlug === activeTopic
      if (!topicOk) return false
      if (q === '') return true
      return (
        a.title.toLowerCase().includes(q) ||
        a.abstract.toLowerCase().includes(q) ||
        a.authors.toLowerCase().includes(q) ||
        a.topic.toLowerCase().includes(q) ||
        a.type.toLowerCase().includes(q)
      )
    })
  }, [activeTopic, query])

  const activeTopicLabel = topicFilters.find((t) => t.slug === activeTopic)?.label ?? ''
  const hasActiveFilter = activeTopic !== '' || query !== ''

  return (
    <div>
      <PageHeader
        label="Research"
        title="Articles"
        subtitle="Browse peer-reviewed case reports and case series in orthopedic surgery."
      />

      <div className="max-w-content mx-auto px-4 sm:px-6 lg:px-8 py-20">
        {/* Tabs: separate pages, not filters */}
        <div className="flex gap-1 mb-8 border-b border-border overflow-x-auto">
          {tabs.map((tab) => (
            <Link
              key={tab.label}
              href={tab.href}
              className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                tab.href === '/articles'
                  ? 'border-peach text-brown'
                  : 'border-transparent text-brown hover:text-ink'
              }`}
            >
              {tab.label}
            </Link>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Sidebar */}
          <aside className="lg:col-span-1 space-y-6">
            {/* Search */}
            <div>
              <label htmlFor="articles-search" className="block text-xs font-semibold text-brown uppercase tracking-widest mb-2">
                Search
              </label>
              <div className="relative">
                <input
                  id="articles-search"
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Keywords, authors..."
                  className="w-full text-sm pl-9 pr-3 py-2.5 bg-white border border-border rounded-lg focus:outline-none focus:border-peach focus:ring-1 focus:ring-peach/40"
                />
                <svg className="absolute left-3 top-3 w-4 h-4 text-brown pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>

            {/* Filter by topic */}
            <div>
              <span className="block text-xs font-semibold text-brown uppercase tracking-widest mb-2">
                Topic
              </span>
              <div className="space-y-1" role="group" aria-label="Filter articles by topic">
                {topicFilters.map((topic) => {
                  const isActive = activeTopic === topic.slug
                  return (
                    <button
                      key={topic.label}
                      type="button"
                      onClick={() => setActiveTopic(topic.slug)}
                      className={`block w-full text-left text-sm px-3 py-2 rounded-lg transition-colors ${
                        isActive
                          ? 'bg-tan/20 text-brown font-medium'
                          : 'text-brown hover:bg-cream-alt'
                      }`}
                      aria-pressed={isActive}
                    >
                      {topic.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Clear-all affordance (only visible when a filter is active) */}
            {hasActiveFilter && (
              <button
                type="button"
                onClick={() => {
                  setActiveTopic('')
                  setQuery('')
                }}
                className="text-xs text-brown underline hover:text-ink"
              >
                Clear filters
              </button>
            )}
          </aside>

          {/* Article list */}
          <div className="lg:col-span-3 space-y-6">
            {/* Result count / active filter summary */}
            <div className="flex items-center justify-between text-sm text-brown mb-2">
              <span>
                {filtered.length} article{filtered.length === 1 ? '' : 's'}
                {activeTopicLabel && (
                  <>
                    {' '}in <span className="text-brown-dark font-medium">{activeTopicLabel}</span>
                  </>
                )}
                {query && (
                  <>
                    {' '}matching <span className="text-brown-dark font-medium">&ldquo;{query}&rdquo;</span>
                  </>
                )}
              </span>
            </div>

            {filtered.length === 0 ? (
              <div className="bg-white border border-border rounded-xl p-10 text-center">
                <p className="text-sm text-brown mb-2">No articles match your current filters.</p>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTopic('')
                    setQuery('')
                  }}
                  className="text-sm text-brown-dark font-medium underline hover:text-ink"
                >
                  Clear filters
                </button>
              </div>
            ) : (
              filtered.map((article) => (
                <article
                  key={article.doi}
                  className="bg-white border border-border rounded-xl p-6 hover:border-tan hover:shadow-sm transition-all duration-200"
                >
                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    <span className="text-xs font-semibold text-brown bg-tan/20 px-2.5 py-1 rounded-full">
                      {article.type}
                    </span>
                    <button
                      type="button"
                      onClick={() => setActiveTopic(article.topicSlug)}
                      className="text-xs text-brown bg-cream-alt px-2.5 py-1 rounded-full hover:bg-peach/20 hover:text-brown transition-colors"
                      aria-label={`Filter by ${article.topic}`}
                    >
                      {article.topic}
                    </button>
                    <span className="text-xs text-brown ml-auto">{article.date}</span>
                  </div>
                  <h2 className="font-serif text-xl font-normal text-brown-dark leading-snug mb-2 hover:text-brown transition-colors cursor-pointer">
                    {article.title}
                  </h2>
                  <p className="text-sm text-brown mb-3">{article.authors}</p>
                  <p className="text-sm text-ink leading-relaxed mb-4 line-clamp-3">{article.abstract}</p>
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-brown font-mono">{article.doi}</p>
                    <Link
                      href={`/articles/${article.doi}`}
                      className="text-sm text-brown font-medium hover:text-brown transition-colors flex items-center gap-1"
                    >
                      Read article &rarr;
                    </Link>
                  </div>
                </article>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function ArticlesPage() {
  // useSearchParams needs a Suspense boundary in Next 14 App Router.
  return (
    <Suspense fallback={<div />}>
      <ArticlesBrowser />
    </Suspense>
  )
}
