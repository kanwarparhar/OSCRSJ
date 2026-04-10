import Link from 'next/link'

const stats = [
  { value: 'Free', label: 'APC through end of 2026', sub: 'No charge to publish' },
  { value: '< 30', label: 'Days to first decision', sub: 'Fast, structured peer review' },
  { value: '100%', label: 'Open access', sub: 'Free to read, forever' },
  { value: 'DOI', label: 'Crossref registered', sub: 'Every article indexed' },
]

const quickActions = [
  {
    title: 'Submit a Manuscript',
    desc: 'Case reports and case series in all areas of orthopedic surgery.',
    href: '/submit',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 4v16m8-8H4" />
      </svg>
    ),
  },
  {
    title: 'Aims & Scope',
    desc: 'Learn what we publish and who we serve.',
    href: '/aims-scope',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
  {
    title: 'Guide for Authors',
    desc: 'Formatting, structure, and submission requirements.',
    href: '/guide-for-authors',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
    ),
  },
  {
    title: 'Sign Up for Alerts',
    desc: 'Get notified when new issues are published.',
    href: '/subscribe',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
      </svg>
    ),
  },
]

const featuredArticles = [
  {
    type: 'Case Report',
    title: 'Bilateral Spontaneous Patellar Tendon Rupture in a Young Athlete: A Rare Presentation',
    authors: 'Smith JA, Patel RK, Johnson ML',
    doi: '10.XXXX/oscrsj.2026.001',
    topic: 'Sports Medicine',
  },
  {
    type: 'Case Series',
    title: 'Minimally Invasive Fixation of Distal Radius Fractures in Elderly Patients: A Three-Case Series',
    authors: 'Chen W, Rodriguez L, Kim DH',
    doi: '10.XXXX/oscrsj.2026.002',
    topic: 'Trauma & Fractures',
  },
  {
    type: 'Case Report',
    title: 'Unusual Presentation of Pigmented Villonodular Synovitis in the Ankle Joint',
    authors: 'Thompson BJ, Nguyen TT',
    doi: '10.XXXX/oscrsj.2026.003',
    topic: 'Foot & Ankle',
  },
]

const topics = [
  'Trauma & Fractures', 'Sports Medicine', 'Spine', 'Arthroplasty',
  'Pediatric Orthopedics', 'Hand & Wrist', 'Foot & Ankle', 'Tumor & Oncology',
]

export default function HomePage() {
  return (
    <div>
      {/* Hero — Current Issue + Quick Actions + Stats */}
      <section className="bg-gradient-to-b from-sand to-cream border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 lg:py-14">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-12">

            {/* Current Issue */}
            <div className="lg:col-span-1">
              <p className="text-xs font-semibold text-coral uppercase tracking-widest mb-3">Current Issue</p>
              <div className="flex gap-5 items-start">
                {/* Journal cover placeholder */}
                <div className="w-24 h-32 bg-gradient-to-br from-coral/20 to-coral/5 border border-coral/20 rounded-lg flex-shrink-0 flex items-center justify-center shadow-sm">
                  <div className="text-center px-2">
                    <p className="font-serif text-xs font-semibold text-coral leading-tight">OSCRSJ</p>
                    <p className="text-[9px] text-charcoal-muted mt-1">Vol. 1, Issue 1</p>
                    <p className="text-[9px] text-charcoal-muted">2026</p>
                  </div>
                </div>
                <div>
                  <Link href="/articles/current-issue" className="font-semibold text-coral text-sm hover:text-coral-dark transition-colors">
                    Volume 1, Issue 1 · 2026
                  </Link>
                  <div className="mt-3 space-y-1.5">
                    <Link href="/articles/in-press" className="block text-sm text-charcoal-muted hover:text-charcoal transition-colors">
                      → Articles in Press
                    </Link>
                    <Link href="/articles/past-issues" className="block text-sm text-charcoal-muted hover:text-charcoal transition-colors">
                      → Past Issues
                    </Link>
                    <Link href="/articles/most-read" className="block text-sm text-charcoal-muted hover:text-charcoal transition-colors">
                      → Most Read
                    </Link>
                  </div>
                  <Link href="/articles/current-issue" className="mt-4 btn-primary text-xs py-2 px-3 inline-flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    View Full Issue
                  </Link>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="lg:col-span-1">
              <p className="text-xs font-semibold text-charcoal-muted uppercase tracking-widest mb-3">Quick Access</p>
              <div className="space-y-2">
                {quickActions.map((action) => (
                  <Link
                    key={action.title}
                    href={action.href}
                    className="flex items-center gap-3 p-3 bg-white border border-border rounded-lg hover:border-coral/50 hover:shadow-sm transition-all duration-200 group"
                  >
                    <span className="text-coral group-hover:scale-110 transition-transform">{action.icon}</span>
                    <span className="text-sm font-medium text-charcoal group-hover:text-coral transition-colors">
                      {action.title}
                    </span>
                    <svg className="w-4 h-4 text-charcoal-light ml-auto group-hover:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                ))}
              </div>
            </div>

            {/* Journal Stats */}
            <div className="lg:col-span-1">
              <p className="text-xs font-semibold text-charcoal-muted uppercase tracking-widest mb-3">Journal Highlights</p>
              <div className="grid grid-cols-2 gap-3">
                {stats.map((stat) => (
                  <div key={stat.label} className="bg-white border border-border rounded-xl p-4">
                    <p className="font-serif text-2xl font-bold text-coral">{stat.value}</p>
                    <p className="text-xs font-semibold text-charcoal mt-1 leading-tight">{stat.label}</p>
                    <p className="text-xs text-charcoal-muted mt-0.5">{stat.sub}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Mission Banner */}
      <section className="bg-coral">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div>
              <h2 className="font-serif text-2xl font-semibold text-white">
                Advancing Orthopedic Education
              </h2>
              <p className="text-white/80 text-sm mt-1 max-w-xl">
                OSCRSJ is the go-to venue for medical students, residents, and fellows who need to publish quality orthopedic case reports with fast, fair peer review.
              </p>
            </div>
            <Link
              href="/submit"
              className="flex-shrink-0 bg-white text-coral font-semibold text-sm px-6 py-3 rounded-lg hover:bg-cream transition-colors"
            >
              Submit Your Case →
            </Link>
          </div>
        </div>
      </section>

      {/* Featured Articles */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <div className="flex items-center justify-between mb-6">
          <h2 className="section-heading">Recent Articles</h2>
          <Link href="/articles" className="text-sm text-coral hover:text-coral-dark font-medium transition-colors">
            View all articles →
          </Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {featuredArticles.map((article) => (
            <article
              key={article.doi}
              className="bg-white border border-border rounded-xl p-6 hover:border-coral/40 hover:shadow-md transition-all duration-200 flex flex-col"
            >
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs font-semibold text-coral bg-coral/10 px-2.5 py-1 rounded-full">
                  {article.type}
                </span>
                <span className="text-xs text-charcoal-muted bg-sand px-2.5 py-1 rounded-full">
                  {article.topic}
                </span>
              </div>
              <h3 className="font-serif text-base font-semibold text-charcoal leading-snug mb-3 flex-1">
                {article.title}
              </h3>
              <p className="text-xs text-charcoal-muted mb-2">{article.authors}</p>
              <p className="text-xs text-charcoal-light font-mono">{article.doi}</p>
              <Link
                href={`/articles/${article.doi}`}
                className="mt-4 text-sm text-coral font-medium hover:text-coral-dark transition-colors flex items-center gap-1"
              >
                Read article
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </article>
          ))}
        </div>
      </section>

      {/* Browse by Topic */}
      <section className="bg-sand border-y border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <h2 className="section-heading mb-6">Browse by Topic</h2>
          <div className="flex flex-wrap gap-2.5">
            {topics.map((topic) => (
              <Link
                key={topic}
                href={`/topics/${topic.toLowerCase().replace(/ & /g, '-').replace(/ /g, '-')}`}
                className="px-4 py-2 bg-white border border-border rounded-full text-sm text-charcoal-muted hover:text-coral hover:border-coral hover:shadow-sm transition-all duration-200 font-medium"
              >
                {topic}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Newsletter Signup */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <div className="bg-white border border-border rounded-2xl p-8 md:p-12 text-center max-w-2xl mx-auto">
          <div className="w-12 h-12 bg-coral/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-coral" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h2 className="font-serif text-2xl font-semibold text-charcoal mb-2">Stay Updated</h2>
          <p className="text-charcoal-muted text-sm mb-6">
            Get notified when new articles and issues are published. No spam — just orthopedic research.
          </p>
          <form className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
            <input
              type="email"
              placeholder="your@email.com"
              className="flex-1 text-sm px-4 py-2.5 bg-sand border border-border rounded-lg focus:outline-none focus:border-coral focus:ring-1 focus:ring-coral/30"
            />
            <button type="submit" className="btn-primary justify-center">
              Subscribe
            </button>
          </form>
          <p className="text-xs text-charcoal-light mt-3">Unsubscribe at any time.</p>
        </div>
      </section>
    </div>
  )
}
