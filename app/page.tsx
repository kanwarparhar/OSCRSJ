import Link from 'next/link'

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

const newsItems = [
  { date: 'April 2026', title: 'OSCRSJ officially launches, accepting submissions across all orthopedic subspecialties', tag: 'Journal' },
  { date: 'April 2026', title: 'Article Processing Charges waived through the end of 2026', tag: 'Journal' },
  { date: 'March 2026', title: 'Crossref membership confirmed, DOI registration active', tag: 'Journal' },
  { date: 'March 2026', title: 'AAOS 2026: Highlights in trauma and sports medicine research', tag: 'Orthopedics' },
  { date: 'February 2026', title: 'New CARE guidelines update for surgical case reporting', tag: 'Research' },
  { date: 'February 2026', title: 'Rising interest in AI-assisted fracture classification tools', tag: 'Orthopedics' },
]

const indexingBadges = ['Scopus', 'DOAJ', 'Crossref', 'Google Scholar', 'EMBASE', 'EBSCO', 'Web of Science', 'COPE Member']

export default function HomePage() {
  return (
    <div className="bg-white">
      {/* 1. Hero */}
      <section
        className="relative flex items-center justify-center text-center"
        style={{
          background: 'radial-gradient(ellipse at 50% 40%, var(--brown) 0%, var(--dark) 70%)',
          minHeight: '440px',
          padding: '80px 24px',
        }}
      >
        <div className="max-w-content mx-auto">
          <h1
            className="font-serif text-peach leading-tight mb-2"
            style={{ fontSize: 'clamp(36px, 5vw, 52px)', letterSpacing: '-0.02em' }}
          >
            OSCRSJ
          </h1>
          <p
            className="font-serif text-peach/80 leading-tight mb-6"
            style={{ fontSize: 'clamp(18px, 2.5vw, 26px)', letterSpacing: '-0.01em' }}
          >
            Orthopedic Surgery Case Reports &amp; Series Journal
          </p>
          <p className="text-peach/60 text-base max-w-2xl mx-auto mb-8 leading-relaxed">
            A peer-reviewed, open-access journal dedicated to the publication of case reports and case series in all subspecialties of orthopedic surgery and musculoskeletal medicine.
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

      {/* 2. Latest Articles */}
      <section className="bg-white" style={{ padding: '72px 24px' }}>
        <div className="max-w-content mx-auto">
          <span className="section-label">Latest Articles</span>
          <div className="flex items-end justify-between mb-8">
            <h2 className="section-heading">Recent Publications</h2>
            <Link
              href="/articles"
              className="text-sm text-brown hover:text-brown font-medium transition-colors hidden sm:inline-flex items-center gap-1"
            >
              See all articles
              <svg className="w-3.5 h-3.5 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {featuredArticles.map((article, i) => (
              <article
                key={article.doi}
                className={`card flex flex-col ${i === 0 ? 'md:row-span-2' : ''}`}
              >
                <div
                  className={`w-full rounded-lg mb-4 flex items-center justify-center ${i === 0 ? 'h-48' : 'h-32'}`}
                  style={{ background: 'linear-gradient(135deg, var(--cream-alt) 0%, var(--taupe) 100%)' }}
                >
                  <span className="text-tan/60 text-xs uppercase tracking-widest">Radiograph</span>
                </div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs font-medium text-brown bg-tan/20 px-2.5 py-1 rounded-full">
                    {article.type}
                  </span>
                  <span className="text-xs text-brown bg-cream px-2.5 py-1 rounded-full">
                    {article.topic}
                  </span>
                </div>
                <h3 className="font-serif text-lg font-normal text-brown-dark leading-snug mb-3 flex-1">
                  {article.title}
                </h3>
                <p className="text-xs text-brown mb-2">{article.authors}</p>
                <p className="text-xs text-brown font-mono">{article.doi}</p>
                <Link
                  href={`/articles/${article.doi}`}
                  className="mt-4 text-sm text-brown font-medium hover:text-peach transition-colors flex items-center gap-1"
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
        </div>
      </section>

      {/* 3. For Authors */}
      <section className="bg-white" style={{ padding: '72px 24px' }}>
        <div className="max-w-content mx-auto">
          <span className="section-label">For Authors</span>

          {/* Process steps */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-12">
            {[
              { step: '01', title: 'Submit', desc: 'Upload your manuscript with clinical images and patient consent documentation.', href: '/submit' },
              { step: '02', title: 'Guide for Authors', desc: 'Everything you need to know about formatting, structure, and submission requirements.', href: '/guide-for-authors' },
              { step: '03', title: 'Author FAQ', desc: 'Answers to common questions about peer review, APCs, timelines, and more.', href: '/faq' },
            ].map((s) => (
              <Link key={s.step} href={s.href} className="card group hover:border-tan hover:shadow-md cursor-pointer block">
                <span className="text-peach font-serif text-2xl">{s.step}</span>
                <h3 className="font-serif text-xl text-brown-dark mt-3 mb-2 group-hover:text-brown transition-colors">{s.title}</h3>
                <p className="text-sm text-brown leading-relaxed">{s.desc}</p>
                <span className="mt-3 inline-flex items-center gap-1 text-sm text-brown font-medium group-hover:text-peach transition-colors">
                  Learn more
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </span>
              </Link>
            ))}
          </div>

          {/* Metrics row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-12">
            {[
              { value: '21', unit: 'days', label: 'First Decision', icon: (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              )},
              { value: '14', unit: 'days', label: 'To Publication', icon: (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              )},
              { value: '100%', unit: '', label: 'Open Access', icon: (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" /></svg>
              )},
              { value: 'COPE', unit: '', label: 'Ethical Standards', icon: (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" /></svg>
              )},
            ].map((m) => (
              <div key={m.label} className="bg-white border border-border rounded-xl p-5 text-center">
                <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-peach/20 text-brown mb-3">
                  {m.icon}
                </div>
                <p className="font-serif text-brown-dark leading-none" style={{ fontSize: '28px' }}>
                  {m.value}<span className="text-brown text-sm font-sans ml-1">{m.unit}</span>
                </p>
                <p className="text-xs text-brown mt-2 uppercase tracking-wider font-medium">{m.label}</p>
              </div>
            ))}
          </div>

          {/* Indexing badges */}
          <div className="flex flex-wrap justify-center gap-3">
            {indexingBadges.map((badge) => (
              <span
                key={badge}
                className="text-xs font-medium text-brown px-4 py-2 rounded-full"
                style={{ backgroundColor: 'rgba(153,126,103,0.12)' }}
              >
                {badge}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* 5. News */}
      <section className="bg-white" style={{ padding: '72px 24px' }}>
        <div className="max-w-content mx-auto">
          <span className="section-label">News &amp; Updates</span>
          <h2 className="section-heading mb-8" style={{ fontSize: 'clamp(28px, 3.5vw, 36px)' }}>From the Field</h2>

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
                          backgroundColor: item.tag === 'Journal' ? 'rgba(255,219,187,0.3)' : item.tag === 'Orthopedics' ? 'rgba(153,126,103,0.12)' : 'rgba(102,73,48,0.1)',
                          color: 'var(--brown)',
                        }}
                      >
                        {item.tag}
                      </span>
                    </div>
                    <p className="font-serif text-brown-dark leading-snug" style={{ fontSize: '16px' }}>
                      {item.title}
                    </p>
                  </div>
                  <p className="text-xs text-brown mt-4">{item.date}</p>
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

      {/* 6. Newsletter */}
      <section className="bg-white" style={{ padding: '72px 24px' }}>
        <div className="max-w-content mx-auto text-center max-w-lg">
          <span className="section-label">Stay Updated</span>
          <h2 className="section-heading mb-2">Get notified when new issues are published</h2>
          <p className="text-brown text-sm mb-6">
            No spam. Just orthopedic research delivered to your inbox.
          </p>
          <form className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
            <input
              type="email"
              placeholder="your@email.com"
              className="flex-1 text-sm px-4 py-2.5 bg-white border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-peach/40 placeholder:text-tan transition"
            />
            <button type="submit" className="btn-primary-light justify-center">
              Subscribe
            </button>
          </form>
          <p className="text-xs text-brown mt-3">Unsubscribe at any time.</p>
        </div>
      </section>

      {/* 7. CTA */}
      <section style={{ backgroundColor: 'var(--dark)', padding: '72px 24px' }}>
        <div className="max-w-content mx-auto text-center">
          <h2
            className="font-serif text-peach leading-tight mb-6"
            style={{ fontSize: 'clamp(28px, 4vw, 40px)', letterSpacing: '-0.02em' }}
          >
            Raising the bar for orthopedic case reporting
          </h2>
          <p className="text-peach/50 text-sm mb-8 max-w-lg mx-auto">
            Join a growing community of orthopedic trainees and faculty publishing rigorous, peer-reviewed case reports.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/submit" className="btn-primary">
              Submit Your Case
            </Link>
            <Link href="/about" className="btn-ghost">
              Learn More
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
