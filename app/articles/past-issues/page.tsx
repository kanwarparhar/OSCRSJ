import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = { title: 'Past Issues — OSCRSJ' }

export default function PastIssuesPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-10">
        <h1 className="font-serif text-3xl font-semibold text-charcoal">Past Issues</h1>
        <p className="text-charcoal-muted mt-2 text-lg">
          Archive of all published issues
        </p>
      </div>

      <section className="mb-10 bg-sand border border-border rounded-2xl p-8 text-center">
        <div className="text-4xl mb-4">📁</div>
        <h2 className="font-serif text-xl font-semibold text-charcoal mb-3">No Past Issues Yet</h2>
        <p className="text-charcoal-muted leading-relaxed max-w-lg mx-auto mb-2">
          OSCRSJ was founded in 2026 and is currently preparing its inaugural issue. Once Volume 1, Issue 1 is published, past issues will be archived here with full article listings and downloadable PDFs.
        </p>
        <p className="text-charcoal-muted leading-relaxed max-w-lg mx-auto">
          Our goal is monthly publication, building a robust archive of peer-reviewed orthopedic case literature over time.
        </p>
      </section>

      <section className="mb-10">
        <h2 className="font-serif text-xl font-semibold text-charcoal mb-5">What to Expect</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          {[
            { label: 'Publication Frequency', value: 'Monthly issues' },
            { label: 'Format', value: 'Online, open access' },
            { label: 'Archiving', value: 'Permanent digital archive with DOIs' },
            { label: 'Access', value: 'Free to read, download, and share (CC BY 4.0)' },
          ].map((fact) => (
            <div key={fact.label} className="bg-white border border-border rounded-xl p-4">
              <p className="text-xs font-semibold text-charcoal-muted uppercase tracking-widest">{fact.label}</p>
              <p className="text-sm font-medium text-charcoal mt-0.5">{fact.value}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="flex flex-col sm:flex-row gap-3">
        <Link href="/articles/current-issue" className="btn-primary">View Current Issue</Link>
        <Link href="/articles/in-press" className="btn-outline">Articles in Press</Link>
      </div>
    </div>
  )
}
