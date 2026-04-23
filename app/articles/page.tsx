import type { Metadata } from 'next'
import Link from 'next/link'
import PageHeader from '@/components/PageHeader'

export const metadata: Metadata = { title: 'Articles' }

const articles = [
  {
    type: 'Case Report',
    title: 'Bilateral Spontaneous Patellar Tendon Rupture in a Young Athlete: A Rare Presentation',
    authors: 'Smith JA, Patel RK, Johnson ML',
    doi: '10.XXXX/oscrsj.2026.001',
    topic: 'Sports Medicine',
    topicSlug: 'sports',
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

const topics = [
  { label: 'All Topics', slug: '' },
  { label: 'Trauma & Fractures', slug: 'trauma' },
  { label: 'Sports Medicine', slug: 'sports' },
  { label: 'Spine', slug: 'spine' },
  { label: 'Arthroplasty', slug: 'arthroplasty' },
  { label: 'Pediatric Orthopedics', slug: 'pediatrics' },
  { label: 'Hand & Wrist', slug: 'hand' },
  { label: 'Foot & Ankle', slug: 'foot-ankle' },
  { label: 'Tumor & Oncology', slug: 'tumor' },
]

const articleTypes = [
  { label: 'All Types', slug: '' },
  { label: 'Case Report', slug: 'case-report' },
  { label: 'Case Series', slug: 'case-series' },
]

const tabs = [
  { label: 'All Articles', href: '/articles' },
  { label: 'Current Issue', href: '/articles/current-issue' },
  { label: 'Articles in Press', href: '/articles/in-press' },
  { label: 'Most Read', href: '/articles/most-read' },
  { label: 'Most Cited', href: '/articles/most-cited' },
]

export default function ArticlesPage() {
  return (
    <div>
      <PageHeader
        label="Research"
        title="Articles"
        subtitle="Browse peer-reviewed case reports and case series in orthopedic surgery."
      />

      <div className="max-w-content mx-auto px-4 sm:px-6 lg:px-8 py-20">
        {/* Filter tabs */}
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
              <label className="block text-xs font-semibold text-brown uppercase tracking-widest mb-2">Search</label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Keywords, authors..."
                  className="w-full text-sm pl-9 pr-3 py-2.5 bg-white border border-border rounded-lg focus:outline-none focus:border-peach focus:ring-1 focus:ring-peach/40"
                />
                <svg className="absolute left-3 top-3 w-4 h-4 text-brown" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>

            {/* Filter by topic */}
            <div>
              <label className="block text-xs font-semibold text-brown uppercase tracking-widest mb-2">Topic</label>
              <div className="space-y-1">
                {topics.map((topic) => (
                  topic.slug === '' ? (
                    <Link
                      key={topic.label}
                      href="/articles"
                      className="block w-full text-left text-sm px-3 py-2 rounded-lg transition-colors bg-tan/20 text-brown font-medium"
                    >
                      {topic.label}
                    </Link>
                  ) : (
                    <Link
                      key={topic.label}
                      href={`/topics/${topic.slug}`}
                      className="block w-full text-left text-sm px-3 py-2 rounded-lg transition-colors text-brown hover:bg-cream"
                    >
                      {topic.label}
                    </Link>
                  )
                ))}
              </div>
            </div>

            {/* Filter by type */}
            <div>
              <label className="block text-xs font-semibold text-brown uppercase tracking-widest mb-2">Article Type</label>
              <div className="space-y-1">
                {articleTypes.map((type) => (
                  type.slug === '' ? (
                    <Link
                      key={type.label}
                      href="/articles"
                      className="block w-full text-left text-sm px-3 py-2 rounded-lg transition-colors bg-tan/20 text-brown font-medium"
                    >
                      {type.label}
                    </Link>
                  ) : (
                    <Link
                      key={type.label}
                      href={`/article-types#${type.slug}`}
                      className="block w-full text-left text-sm px-3 py-2 rounded-lg transition-colors text-brown hover:bg-cream"
                    >
                      {type.label}
                    </Link>
                  )
                ))}
              </div>
            </div>
          </aside>

          {/* Article list */}
          <div className="lg:col-span-3 space-y-6">
            {articles.map((article) => (
              <article
                key={article.doi}
                className="bg-white border border-border rounded-xl p-6 hover:border-tan hover:shadow-sm transition-all duration-200"
              >
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  <span className="text-xs font-semibold text-brown bg-tan/20 px-2.5 py-1 rounded-full">{article.type}</span>
                  <Link href={`/topics/${article.topicSlug}`} className="text-xs text-brown bg-cream px-2.5 py-1 rounded-full hover:bg-peach/20 hover:text-brown transition-colors">
                    {article.topic}
                  </Link>
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
            ))}

            {/* Pagination placeholder */}
            <div className="flex justify-center gap-2 pt-4">
              <span className="px-4 py-2 text-sm font-medium text-brown bg-tan/20 rounded-lg">1</span>
              <span className="px-4 py-2 text-sm text-brown rounded-lg">2</span>
              <span className="px-4 py-2 text-sm text-brown rounded-lg">3</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
