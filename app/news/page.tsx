import type { Metadata } from 'next'
import Link from 'next/link'
import PageHeader from '@/components/PageHeader'
import { getLatestBriefs, AI_ORTHO_CATEGORIES, getCategory } from '@/lib/ai-ortho/data'

export const metadata: Metadata = {
  title: 'News',
  description:
    'Curated orthopedic news from OSCRSJ: AI in orthopedics, ortho headlines, and journal updates, sourced from peer-reviewed journals and specialty societies.',
  alternates: { canonical: 'https://www.oscrsj.com/news' },
}

export default function NewsPage() {
  const aiBriefs = getLatestBriefs(3)

  return (
    <div>
      <PageHeader
        label="News"
        title="OSCRSJ News"
        subtitle="Curated orthopedic news for trainees and attendings, sourced from peer-reviewed journals and specialty societies."
      />

      <div className="max-w-content mx-auto px-4 sm:px-6 lg:px-8 py-20 space-y-16">
        {/* AI in Orthopedics — featured feed */}
        <section>
          <div className="flex items-end justify-between mb-6 flex-wrap gap-3">
            <div>
              <span className="section-label">Featured Hub</span>
              <h2 className="section-heading">AI in Orthopedics</h2>
              <p className="text-brown text-sm max-w-xl mt-2">
                Curated research, tools, and guidance on artificial intelligence in orthopedic practice.
              </p>
            </div>
            <Link
              href="/news/ai-in-orthopedics"
              className="text-sm font-medium text-brown hover:text-brown-dark transition-colors"
            >
              Explore the hub &rarr;
            </Link>
          </div>

          {aiBriefs.length === 0 ? (
            <div className="bg-white border border-border rounded-xl p-8 text-center">
              <p className="text-brown-dark text-sm">
                The AI in Orthopedics hub is live. The first curated briefs publish shortly.
              </p>
              <Link
                href="/news/ai-in-orthopedics"
                className="btn-primary-light mt-5 inline-flex"
              >
                Visit the hub
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {aiBriefs.map((b) => {
                const cat = getCategory(b.category)
                return (
                  <Link
                    key={b.slug}
                    href={`/news/ai-in-orthopedics/${b.category}/${b.slug}`}
                    className="bg-white border border-border rounded-xl p-6 hover:border-tan hover:shadow-sm transition-all"
                  >
                    <span className="text-xs font-medium text-brown bg-tan/20 px-3 py-1 rounded-full inline-block mb-3">
                      {cat?.short ?? 'AI'}
                    </span>
                    <h3 className="font-serif text-lg text-brown-dark leading-snug mb-2">
                      {b.headline}
                    </h3>
                    <p className="text-xs text-brown">
                      {new Date(b.publishedAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}{' '}
                      &middot; {b.readMinutes} min read
                    </p>
                  </Link>
                )
              })}
            </div>
          )}
        </section>

        {/* Ortho Headlines — placeholder */}
        <section>
          <div className="mb-6">
            <span className="section-label">Coming Soon</span>
            <h2 className="section-heading">Ortho Headlines</h2>
            <p className="text-brown text-sm max-w-xl mt-2">
              Weekly summaries of the most significant peer-reviewed orthopedic research.
            </p>
          </div>
          <div className="bg-white border border-border rounded-xl p-8 text-center">
            <p className="text-sm text-brown-dark">
              Ortho Headlines launches alongside the first published issue of OSCRSJ.
            </p>
          </div>
        </section>

        {/* Journal Updates — placeholder */}
        <section>
          <div className="mb-6">
            <span className="section-label">Coming Soon</span>
            <h2 className="section-heading">Journal Updates</h2>
            <p className="text-brown text-sm max-w-xl mt-2">
              Milestones, editorial board news, and indexing progress from the journal.
            </p>
          </div>
          <div className="bg-white border border-border rounded-xl p-8 text-center">
            <p className="text-sm text-brown-dark">
              Updates will appear here once OSCRSJ begins publishing.
            </p>
          </div>
        </section>

        {/* Categories at a glance */}
        <section>
          <div className="mb-6">
            <span className="section-label">Browse by Topic</span>
            <h2 className="section-heading">AI in Orthopedics Categories</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {AI_ORTHO_CATEGORIES.map((c) => {
              const Icon = c.Icon
              return (
                <Link
                  key={c.slug}
                  href={`/news/ai-in-orthopedics/${c.slug}`}
                  className="bg-white border border-border rounded-xl p-5 hover:border-tan hover:shadow-sm transition-all flex items-start gap-3"
                >
                  <span className="text-brown flex-shrink-0 mt-0.5">
                    <Icon />
                  </span>
                  <div>
                    <p className="font-serif text-brown-dark text-base leading-snug">{c.short}</p>
                    <p className="text-xs text-brown mt-1">{c.description}</p>
                  </div>
                </Link>
              )
            })}
          </div>
        </section>
      </div>
    </div>
  )
}
