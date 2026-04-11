import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = { title: 'Most Cited Articles — OSCRSJ' }

export default function MostCitedPage() {
  return (
    <div className="max-w-content mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <div className="mb-10">
        <h1 className="font-serif text-3xl font-normal text-brown-dark">Most Cited</h1>
        <p className="text-tan mt-2 text-lg">
          Our highest-impact articles by citation count
        </p>
      </div>

      <section className="mb-10 bg-cream-alt border border-border rounded-2xl p-8 text-center">
        <div className="text-4xl mb-4">🏆</div>
        <h2 className="font-serif text-xl font-normal text-brown-dark mb-3">Coming Soon</h2>
        <p className="text-tan leading-relaxed max-w-lg mx-auto">
          Citation data takes time to accumulate. As our published articles are cited in the broader medical literature, this page will rank them by citation count — a key indicator of academic impact and clinical utility.
        </p>
      </section>

      <section className="mb-10">
        <h2 className="font-serif text-xl font-normal text-brown-dark mb-5">About Citation Tracking</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          {[
            { label: 'Data Source', value: 'Crossref Cited-by API' },
            { label: 'DOI Provider', value: 'Crossref' },
            { label: 'Update Frequency', value: 'Monthly' },
            { label: 'Coverage', value: 'All OSCRSJ articles with assigned DOIs' },
          ].map((fact) => (
            <div key={fact.label} className="bg-cream border border-border rounded-xl p-4">
              <p className="text-xs font-semibold text-tan uppercase tracking-widest">{fact.label}</p>
              <p className="text-sm font-medium text-brown-dark mt-0.5">{fact.value}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-10">
        <h2 className="font-serif text-xl font-normal text-brown-dark mb-3">Why Citations Matter</h2>
        <p className="text-tan leading-relaxed">
          Citations are a primary measure of scholarly impact. When other researchers and clinicians cite your case report, it means your work is influencing clinical understanding and decision-making. For trainees, building a citation record early in your career strengthens residency applications, fellowship candidacy, and grant proposals.
        </p>
      </section>

      <div className="flex flex-col sm:flex-row gap-3">
        <Link href="/articles" className="btn-primary">Browse All Articles</Link>
        <Link href="/articles/most-read" className="btn-outline">Most Read</Link>
      </div>
    </div>
  )
}
