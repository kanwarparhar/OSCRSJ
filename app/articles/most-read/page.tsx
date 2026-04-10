import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = { title: 'Most Read Articles — OSCRSJ' }

export default function MostReadPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-10">
        <h1 className="font-serif text-3xl font-semibold text-charcoal">Most Read</h1>
        <p className="text-charcoal-muted mt-2 text-lg">
          Our most-viewed articles across all issues
        </p>
      </div>

      <section className="mb-10 bg-sand border border-border rounded-2xl p-8 text-center">
        <div className="text-4xl mb-4">📊</div>
        <h2 className="font-serif text-xl font-semibold text-charcoal mb-3">Coming Soon</h2>
        <p className="text-charcoal-muted leading-relaxed max-w-lg mx-auto">
          Once we begin publishing articles, this page will display the most-read case reports and case series ranked by readership. Metrics will update automatically as articles accumulate views.
        </p>
      </section>

      <section className="mb-10">
        <h2 className="font-serif text-xl font-semibold text-charcoal mb-5">How We Track Readership</h2>
        <div className="space-y-3">
          {[
            { title: 'Article Views', desc: 'Total page views for each published article, updated in real time.' },
            { title: 'Download Counts', desc: 'Number of PDF downloads per article.' },
            { title: 'Rolling Window', desc: 'Rankings reflect activity over the past 90 days to highlight trending research.' },
            { title: 'All-Time Rankings', desc: 'Cumulative readership data available for the full archive.' },
          ].map((item) => (
            <div key={item.title} className="flex gap-3 bg-white border border-border rounded-xl p-5">
              <svg className="w-5 h-5 text-coral mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <div>
                <p className="font-semibold text-charcoal text-sm">{item.title}</p>
                <p className="text-sm text-charcoal-muted mt-0.5">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="flex flex-col sm:flex-row gap-3">
        <Link href="/articles" className="btn-primary">Browse All Articles</Link>
        <Link href="/articles/most-cited" className="btn-outline">Most Cited</Link>
      </div>
    </div>
  )
}
