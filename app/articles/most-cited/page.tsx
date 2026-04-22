import type { Metadata } from 'next'
import Link from 'next/link'
import PageHeader from '@/components/PageHeader'

export const metadata: Metadata = { title: 'Most Cited Articles — OSCRSJ' }

export default function MostCitedPage() {
  return (
    <div>
      <PageHeader
        label="Impact"
        title="Most Cited Articles"
        subtitle="Our highest-impact articles by citation count"
      />

      <div className="max-w-content mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <section className="mb-12 bg-cream border border-border rounded-2xl p-8 text-center">
          <div className="text-4xl mb-4">🏆</div>
          <h2 className="section-heading mb-3">Coming Soon</h2>
          <p className="text-ink leading-relaxed max-w-lg mx-auto">
            Citation data takes time to accumulate. As our published articles are cited in the broader medical literature, this page will rank them by citation count, a key indicator of academic impact and clinical utility.
          </p>
        </section>

        <section className="mb-12">
          <span className="section-label">Data Sources</span>
          <h2 className="section-heading mb-5">About Citation Tracking</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {[
              { label: 'Data Source', value: 'Crossref Cited-by API' },
              { label: 'DOI Provider', value: 'Crossref' },
              { label: 'Update Frequency', value: 'Monthly' },
              { label: 'Coverage', value: 'All OSCRSJ articles with assigned DOIs' },
            ].map((fact) => (
              <div key={fact.label} className="bg-white border border-border rounded-xl p-6">
                <p className="text-xs font-semibold text-brown uppercase tracking-widest">{fact.label}</p>
                <p className="text-sm font-medium text-ink mt-0.5">{fact.value}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mb-12">
          <span className="section-label">Why It Matters</span>
          <h2 className="section-heading mb-3">Why Citations Matter</h2>
          <p className="text-ink leading-relaxed">
            Citations are a primary measure of scholarly impact. When other researchers and clinicians cite your case report, it means your work is influencing clinical understanding and decision-making. For trainees, building a citation record early in your career strengthens residency applications, fellowship candidacy, and grant proposals.
          </p>
        </section>

        <div className="flex flex-col sm:flex-row gap-3">
          <Link href="/articles" className="btn-primary-light">Browse All Articles</Link>
          <Link href="/articles/most-read" className="btn-outline">Most Read</Link>
        </div>
      </div>
    </div>
  )
}
