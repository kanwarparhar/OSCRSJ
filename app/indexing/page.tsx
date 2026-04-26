import type { Metadata } from 'next'
import Link from 'next/link'
import PageHeader from '@/components/PageHeader'

export const metadata: Metadata = { title: 'Indexing & Metrics — OSCRSJ' }

export default function IndexingPage() {
  return (
    <div>
      <PageHeader
        label="Discoverability"
        title="Indexing & Abstracting"
        subtitle="Our path to discoverability and academic recognition"
      />

      <div className="max-w-content mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <section className="mb-12 bg-gradient-to-br from-tan/10 to-cream-alt border border-peach/20 rounded-2xl p-8">
          <span className="section-label">Where We Stand</span>
          <h2 className="section-heading mb-3">Current Status</h2>
          <p className="text-ink leading-relaxed">
            OSCRSJ is a newly established journal (founded 2026). We are registered with Crossref for DOI assignment and are actively pursuing indexing in major medical databases. Every article published in OSCRSJ receives a unique DOI, making it permanently citable and discoverable in academic literature.
          </p>
        </section>

        <section className="mb-12">
          <span className="section-label">Timeline</span>
          <h2 className="section-heading mb-5">Indexing Roadmap</h2>
          <div className="space-y-3">
            {[
              { title: 'Crossref DOI Registration', status: 'Active', desc: 'Every article receives a unique Crossref DOI upon publication, ensuring permanent citability and linking.', done: true },
              { title: 'Google Scholar', status: 'In Progress', desc: 'Automatic indexing once articles are published with proper metadata and DOIs. Typically occurs within weeks of first publication.', done: false },
              { title: 'DOAJ (Directory of Open Access Journals)', status: 'Planned — Year 1', desc: 'Application requires demonstrated commitment to open access, peer review, and editorial standards. We will apply after publishing our first issues.', done: false },
              { title: 'PMC / PubMed', status: 'Planned — Year 2', desc: 'PubMed Central and PubMed indexing require a track record of consistent, high-quality publication (typically 12–24 months). This is our primary indexing goal.', done: false },
              { title: 'Scopus', status: 'Planned — Year 2–3', desc: 'Scopus evaluates journals based on editorial quality, citedness, regularity of publication, and online availability. Application follows PubMed.', done: false },
            ].map((item) => (
              <div key={item.title} className={`flex gap-4 border rounded-xl p-6 ${item.done ? 'bg-tan/10 border-peach/30' : 'bg-white border-border'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${item.done ? 'bg-peach text-white' : 'bg-cream-alt text-brown'}`}>
                  {item.done ? (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <span className="text-xs font-bold">&bull;</span>
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-ink text-sm">{item.title}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${item.done ? 'bg-tan/20 text-brown font-medium' : 'bg-cream-alt text-brown'}`}>
                      {item.status}
                    </span>
                  </div>
                  <p className="text-sm text-ink mt-0.5">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mb-12">
          <span className="section-label">Numbers</span>
          <h2 className="section-heading mb-5">Journal Metrics</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {[
              { label: 'DOI Provider', value: 'Crossref' },
              { label: 'License', value: 'CC BY-NC-ND 4.0 (Open Access)' },
              { label: 'Publication Frequency', value: 'Monthly' },
              { label: 'Impact Factor', value: 'Not yet eligible (requires 2+ years of indexing)' },
              { label: 'Acceptance Rate', value: 'To be reported after first year' },
              { label: 'Average Review Time', value: 'Target: 30 days to first decision' },
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
          <h2 className="section-heading mb-3">Why Indexing Matters</h2>
          <p className="text-ink leading-relaxed">
            Indexing in databases like PubMed and Scopus makes your published work discoverable to the global medical community. For trainees, PubMed-indexed publications carry significant weight on residency and fellowship applications. We are building OSCRSJ with the explicit goal of achieving PubMed indexing within two years — and every article published now contributes to that track record.
          </p>
        </section>

        <div className="flex flex-col sm:flex-row gap-3">
          <Link href="/submit" className="btn-primary-light">Submit a Manuscript</Link>
          <Link href="/about" className="btn-outline">About OSCRSJ</Link>
        </div>
      </div>
    </div>
  )
}
