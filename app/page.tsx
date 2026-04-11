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

const editors = [
  { name: 'Position Open', role: 'Editor-in-Chief', specialty: 'General Orthopedics' },
  { name: 'Position Open', role: 'Associate Editor', specialty: 'Trauma & Fractures' },
  { name: 'Position Open', role: 'Associate Editor', specialty: 'Sports Medicine' },
  { name: 'Position Open', role: 'Associate Editor', specialty: 'Spine Surgery' },
  { name: 'Position Open', role: 'Associate Editor', specialty: 'Arthroplasty' },
  { name: 'Position Open', role: 'Associate Editor', specialty: 'Hand & Wrist' },
]

const newsItems = [
  { date: 'April 2026', title: 'OSCRSJ officially launches, accepting submissions across all orthopedic subspecialties' },
  { date: 'April 2026', title: 'Article Processing Charges waived through the end of 2026' },
  { date: 'March 2026', title: 'Crossref membership confirmed, DOI registration active' },
]

const indexingBadges = ['Scopus', 'DOAJ', 'Crossref', 'Google Scholar', 'EMBASE', 'EBSCO', 'Web of Science', 'COPE Member']

export default function HomePage() {
  return (
    <div>
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
            className="font-serif text-peach leading-tight mb-6"
            style={{ fontSize: 'clamp(32px, 4.5vw, 44px)', letterSpacing: '-0.02em' }}
          >
            Advancing <em>surgical knowledge</em>,<br />one case at a time
          </h1>
          <p className="text-peach/60 text-base max-w-xl mx-auto mb-8 leading-relaxed">
            A peer-reviewed, open-access journal for orthopedic case reports and case series. Built for medical students, residents, and fellows.
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
      <section className="bg-cream" style={{ padding: '72px 24px' }}>
        <div className="max-w-content mx-auto">
          <span className="section-label">Latest Articles</span>
          <div className="flex items-end justify-between mb-8">
            <h2 className="section-heading">Recent Publications</h2>
            <Link
              href="/articles"
              className="text-sm text-tan hover:text-brown font-medium transition-colors hidden sm:inline-flex items-center gap-1"
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
                {i === 0 && (
                  <div
                    className="w-full h-48 rounded-lg mb-4 flex items-center justify-center"
                    style={{ background: 'linear-gradient(135deg, var(--cream-alt) 0%, var(--taupe) 100%)' }}
                  >
                    <span className="text-tan/60 text-xs uppercase tracking-widest">Radiograph</span>
                  </div>
                )}
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs font-medium text-brown bg-tan/20 px-2.5 py-1 rounded-full">
                    {article.type}
                  </span>
                  <span className="text-xs text-tan bg-cream-alt px-2.5 py-1 rounded-full">
                    {article.topic}
                  </span>
                </div>
                <h3 className="font-serif text-lg font-normal text-brown-dark leading-snug mb-3 flex-1">
                  {article.title}
                </h3>
                <p className="text-xs text-tan mb-2">{article.authors}</p>
                <p className="text-xs text-taupe font-mono">{article.doi}</p>
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
            <Link href="/articles" className="btn-primary">See all articles</Link>
          </div>
        </div>
      </section>

      {/* 3. For Authors */}
      <section className="bg-cream-alt" style={{ padding: '72px 24px' }}>
        <div className="max-w-content mx-auto">
          <span className="section-label">For Authors</span>
          <h2 className="section-heading mb-2">Our editorial process</h2>
          <p className="text-tan text-base mb-10 max-w-2xl">
            Built on scientific rigour and clinical relevance.
          </p>

          {/* Process steps */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-12">
            {[
              { step: '01', title: 'Submit', desc: 'Upload your manuscript with clinical images and patient consent documentation.' },
              { step: '02', title: 'Review & Revise', desc: 'Double-blind peer review with structured feedback from subspecialty experts.' },
              { step: '03', title: 'Publish', desc: 'Accepted articles receive a Crossref DOI and are published open access.' },
            ].map((s) => (
              <div key={s.step} className="card">
                <span className="text-peach font-serif text-2xl">{s.step}</span>
                <h3 className="font-serif text-xl text-brown-dark mt-3 mb-2">{s.title}</h3>
                <p className="text-sm text-tan leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>

          {/* Metrics row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-12">
            {[
              { value: '21 days', label: 'First decision' },
              { value: '14 days', label: 'To publication' },
              { value: 'Open access', label: 'Always free to read' },
            ].map((m) => (
              <div key={m.label} className="text-center py-6">
                <p className="font-serif text-2xl text-brown-dark">{m.value}</p>
                <p className="text-xs text-tan mt-1 uppercase tracking-wider">{m.label}</p>
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

      {/* 4. Editorial Board */}
      <section className="bg-cream" style={{ padding: '72px 24px' }}>
        <div className="max-w-content mx-auto">
          <span className="section-label">Editorial Board</span>
          <h2 className="section-heading mb-8">Expertise across every subspecialty</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
            {editors.map((editor) => (
              <div key={editor.specialty} className="card">
                <p className="font-serif text-lg text-brown-dark">{editor.name}</p>
                <p className="text-xs text-tan mt-1">{editor.role}</p>
                <span
                  className="inline-block mt-3 text-xs font-medium text-brown px-3 py-1 rounded-full"
                  style={{ backgroundColor: 'rgba(153,126,103,0.12)' }}
                >
                  {editor.specialty}
                </span>
              </div>
            ))}
          </div>

          <div className="mt-8 text-center">
            <Link href="/editorial-board" className="btn-outline border-tan text-tan hover:bg-tan hover:text-cream">
              View full board
            </Link>
          </div>
        </div>
      </section>

      {/* 5. News */}
      <section className="bg-cream-alt" style={{ padding: '72px 24px' }}>
        <div className="max-w-content mx-auto">
          <span className="section-label">News</span>
          <h2 className="section-heading mb-8">From the field</h2>

          <div className="space-y-0">
            {newsItems.map((item, i) => (
              <div
                key={i}
                className="py-5 flex items-start gap-6"
                style={{ borderBottom: '1px solid rgba(153,126,103,0.12)' }}
              >
                <span className="text-xs text-tan whitespace-nowrap mt-0.5 min-w-[90px]">{item.date}</span>
                <p className="text-sm text-brown-dark leading-relaxed">{item.title}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 6. Newsletter */}
      <section className="bg-cream" style={{ padding: '72px 24px' }}>
        <div className="max-w-content mx-auto text-center max-w-lg">
          <span className="section-label">Stay Updated</span>
          <h2 className="section-heading mb-2">Get notified when new issues are published</h2>
          <p className="text-tan text-sm mb-6">
            No spam. Just orthopedic research delivered to your inbox.
          </p>
          <form className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
            <input
              type="email"
              placeholder="your@email.com"
              className="flex-1 text-sm px-4 py-2.5 bg-cream-alt border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-peach/40 placeholder:text-taupe transition"
            />
            <button type="submit" className="btn-primary justify-center">
              Subscribe
            </button>
          </form>
          <p className="text-xs text-taupe mt-3">Unsubscribe at any time.</p>
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
