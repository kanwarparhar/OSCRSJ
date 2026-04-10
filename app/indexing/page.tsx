import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = { title: 'Indexing & Metrics — OSCRSJ' }

export default function IndexingPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-10">
        <h1 className="font-serif text-3xl font-semibold text-charcoal">Indexing & Metrics</h1>
        <p className="text-charcoal-muted mt-2 text-lg">
          Our path to discoverability and academic recognition
        </p>
      </div>

      <section className="mb-10 bg-gradient-to-br from-coral/10 to-sand border border-coral/20 rounded-2xl p-8">
        <h2 className="font-serif text-xl font-semibold text-charcoal mb-3">Current Status</h2>
        <p className="text-charcoal-muted leading-relaxed">
          OSCRSJ is a newly established journal (founded 2026). We are registered with Crossref for DOI assignment and are actively pursuing indexing in major medical databases. Every article published in OSCRSJ receives a unique DOI, making it permanently citable and discoverable in academic literature.
        </p>
      </section>

      <section className="mb-10">
        <h2 className="font-serif text-xl font-semibold text-charcoal mb-5">Indexing Roadmap</h2>
        <div className="space-y-3">
          {[
            { title: 'Crossref DOI Registration', status: 'Active', desc: 'Every article receives a unique Crossref DOI upon publication, ensuring permanent citability and linking.', done: true },
            { title: 'Google Scholar', status: 'In Progress', desc: 'Automatic indexing once articles are published with proper metadata and DOIs. Typically occurs within weeks of first publication.', done: false },
            { title: 'DOAJ (Directory of Open Access Journals)', status: 'Planned — Year 1', desc: 'Application requires demonstrated commitment to open access, peer review, and editorial standards. We will apply after publishing our first issues.', done: false },
            { title: 'PMC / PubMed', status: 'Planned — Year 2', desc: 'PubMed Central and PubMed indexing require a track record of consistent, high-quality publication (typically 12–24 months). This is our primary indexing goal.', done: false },
            { title: 'Scopus', status: 'Planned — Year 2–3', desc: 'Scopus evaluates journals based on editorial quality, citedness, regularity of publication, and online availability. Application follows PubMed.', done: false },
          ].map((item) => (
            <div key={item.title} className={`flex gap-4 border rounded-xl p-5 ${item.done ? 'bg-coral/5 border-coral/30' : 'bg-white border-border'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${item.done ? 'bg-coral text-white' : 'bg-sand text-charcoal-muted'}`}>
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
                  <p className="font-semibold text-charcoal text-sm">{item.title}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${item.done ? 'bg-coral/10 text-coral font-medium' : 'bg-sand text-charcoal-muted'}`}>
                    {item.status}
                  </span>
                </div>
                <p className="text-sm text-charcoal-muted mt-0.5">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-10">
        <h2 className="font-serif text-xl font-semibold text-charcoal mb-5">Journal Metrics</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          {[
            { label: 'DOI Provider', value: 'Crossref' },
            { label: 'License', value: 'CC BY 4.0 (Open Access)' },
            { label: 'Publication Frequency', value: 'Monthly' },
            { label: 'Impact Factor', value: 'Not yet eligible (requires 2+ years of indexing)' },
            { label: 'Acceptance Rate', value: 'To be reported after first year' },
            { label: 'Average Review Time', value: 'Target: 30 days to first decision' },
          ].map((fact) => (
            <div key={fact.label} className="bg-white border border-border rounded-xl p-4">
              <p className="text-xs font-semibold text-charcoal-muted uppercase tracking-widest">{fact.label}</p>
              <p className="text-sm font-medium text-charcoal mt-0.5">{fact.value}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-10">
        <h2 className="font-serif text-xl font-semibold text-charcoal mb-3">Why Indexing Matters</h2>
        <p className="text-charcoal-muted leading-relaxed">
          Indexing in databases like PubMed and Scopus makes your published work discoverable to the global medical community. For trainees, PubMed-indexed publications carry significant weight on residency and fellowship applications. We are building OSCRSJ with the explicit goal of achieving PubMed indexing within two years — and every article published now contributes to that track record.
        </p>
      </section>

      <div className="flex flex-col sm:flex-row gap-3">
        <Link href="/submit" className="btn-primary">Submit a Manuscript</Link>
        <Link href="/about" className="btn-outline">About OSCRSJ</Link>
      </div>
    </div>
  )
}
