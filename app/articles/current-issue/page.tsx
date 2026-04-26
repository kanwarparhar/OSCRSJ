import type { Metadata } from 'next'
import Link from 'next/link'
import PageHeader from '@/components/PageHeader'

export const metadata: Metadata = { title: 'Current Issue — OSCRSJ' }

export default function CurrentIssuePage() {
  return (
    <div>
      <PageHeader
        label="Current Issue"
        title="Current Issue"
        subtitle="Volume 1, Issue 1, 2026"
      />

      <div className="max-w-content mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <section className="mb-12 bg-gradient-to-br from-tan/10 to-cream-alt border border-peach/20 rounded-2xl p-8">
          <span className="section-label">Status</span>
          <h2 className="section-heading mb-3">Inaugural Issue Coming Soon</h2>
          <p className="text-ink leading-relaxed">
            OSCRSJ is preparing to publish its first issue. We are currently accepting submissions across all orthopedic subspecialties and will publish our inaugural collection once we have assembled a strong set of peer-reviewed articles.
          </p>
        </section>

        <section className="mb-12">
          <span className="section-label">Process</span>
          <h2 className="section-heading mb-5">Publication Timeline</h2>
          <div className="space-y-3">
            {[
              { step: '1', title: 'Accepting Submissions', desc: 'We are open for case report and case series submissions now. All subspecialties welcome.', active: true },
              { step: '2', title: 'Peer Review', desc: 'Each submission undergoes double-blind peer review. Authors receive an initial editorial response within 10 days; the full peer-reviewed decision typically follows within 30 days.' },
              { step: '3', title: 'Accepted Articles Published Online', desc: 'Accepted articles appear in "Articles in Press" with DOIs assigned immediately.' },
              { step: '4', title: 'Issue Compilation', desc: 'Once enough accepted articles are available, they will be compiled into Volume 1, Issue 1.' },
            ].map((item) => (
              <div key={item.step} className={`flex gap-4 border rounded-xl p-6 ${item.active ? 'bg-tan/10 border-peach/30' : 'bg-white border-border'}`}>
                <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${item.active ? 'bg-peach text-white' : 'bg-cream-alt text-brown'}`}>
                  {item.step}
                </span>
                <div>
                  <p className="font-semibold text-ink text-sm">{item.title}</p>
                  <p className="text-sm text-ink mt-0.5">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mb-12 bg-cream-alt border border-border rounded-2xl p-8 text-center">
          <span className="section-label">Get Involved</span>
          <h2 className="section-heading mb-3">Be Part of Our First Issue</h2>
          <p className="text-ink leading-relaxed mb-5 max-w-xl mx-auto">
            Publishing in a journal&apos;s inaugural issue is a unique opportunity. APCs are waived for all manuscripts submitted before August 1, 2026. Submit your case report or case series today.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/submit" className="btn-primary-light">Submit a Manuscript</Link>
            <Link href="/guide-for-authors" className="btn-primary-light">Guide for Authors</Link>
          </div>
        </section>
      </div>
    </div>
  )
}
