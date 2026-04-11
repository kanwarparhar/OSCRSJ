import type { Metadata } from 'next'
import Link from 'next/link'
import PageHeader from '@/components/PageHeader'

export const metadata: Metadata = { title: 'Articles in Press — OSCRSJ' }

export default function InPressPage() {
  return (
    <div>
      <PageHeader
        label="Coming Soon"
        title="Articles in Press"
        subtitle="Accepted articles awaiting final issue assignment"
      />

      <div className="max-w-content mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <section className="mb-12 bg-gradient-to-br from-tan/10 to-cream-alt border border-peach/20 rounded-2xl p-8">
          <span className="section-label">Overview</span>
          <h2 className="section-heading mb-3">What Are Articles in Press?</h2>
          <p className="text-brown-dark leading-relaxed">
            Articles in Press are manuscripts that have been peer-reviewed, accepted, and assigned a DOI, but have not yet been compiled into a formal issue. These articles are fully citable and represent the latest accepted research in orthopedic case reporting. They appear here as soon as they are accepted and move to the current issue upon publication.
          </p>
        </section>

        <section className="mb-12 bg-cream-alt border border-border rounded-2xl p-8 text-center">
          <div className="text-4xl mb-4">📄</div>
          <h2 className="section-heading mb-3">No Articles in Press Yet</h2>
          <p className="text-brown-dark leading-relaxed max-w-lg mx-auto">
            As we build our initial submission pipeline, accepted articles will appear here before they are assigned to an issue. Check back soon — or submit your own manuscript to be among the first.
          </p>
        </section>

        <section className="mb-12">
          <span className="section-label">Workflow</span>
          <h2 className="section-heading mb-5">From Submission to Publication</h2>
          <div className="space-y-3">
            {[
              { title: 'Submission Received', desc: 'Manuscript enters our editorial workflow.' },
              { title: 'Double-Blind Peer Review', desc: 'Reviewed by at least two orthopedic surgeons within 30 days.' },
              { title: 'Acceptance & DOI Assignment', desc: 'Accepted articles receive a Crossref DOI and appear here.' },
              { title: 'Issue Publication', desc: 'Article moves to the current issue and is permanently archived.' },
            ].map((item, i) => (
              <div key={item.title} className="flex gap-4 bg-cream border border-border rounded-xl p-6">
                <span className="w-8 h-8 rounded-full bg-cream-alt flex items-center justify-center text-sm font-bold text-tan flex-shrink-0">
                  {i + 1}
                </span>
                <div>
                  <p className="font-semibold text-brown-dark text-sm">{item.title}</p>
                  <p className="text-sm text-brown-dark mt-0.5">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <div className="flex flex-col sm:flex-row gap-3">
          <Link href="/submit" className="btn-primary">Submit a Manuscript</Link>
          <Link href="/articles/current-issue" className="btn-outline">Current Issue</Link>
        </div>
      </div>
    </div>
  )
}
