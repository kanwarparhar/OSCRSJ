import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = { title: 'Current Issue — OSCRSJ' }

export default function CurrentIssuePage() {
  return (
    <div className="max-w-content mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <div className="mb-10">
        <h1 className="font-serif text-3xl font-normal text-brown-dark">Current Issue</h1>
        <p className="text-tan mt-2 text-lg">
          Volume 1, Issue 1 — 2026
        </p>
      </div>

      <section className="mb-10 bg-gradient-to-br from-tan/10 to-cream-alt border border-peach/20 rounded-2xl p-8">
        <h2 className="font-serif text-xl font-normal text-brown-dark mb-3">Inaugural Issue Coming Soon</h2>
        <p className="text-tan leading-relaxed mb-4">
          OSCRSJ is preparing to publish its first issue. We are currently accepting submissions across all orthopedic subspecialties and will publish our inaugural collection once we have assembled a strong set of peer-reviewed articles.
        </p>
        <p className="text-tan leading-relaxed">
          As a new journal, we are committed to quality over speed — every article in our first issue will undergo the same rigorous double-blind peer review as those in established journals.
        </p>
      </section>

      <section className="mb-10">
        <h2 className="font-serif text-xl font-normal text-brown-dark mb-5">Publication Timeline</h2>
        <div className="space-y-3">
          {[
            { step: '1', title: 'Accepting Submissions', desc: 'We are open for case report and case series submissions now. All subspecialties welcome.', active: true },
            { step: '2', title: 'Peer Review', desc: 'Each submission undergoes double-blind peer review with a target first decision within 30 days.' },
            { step: '3', title: 'Accepted Articles Published Online', desc: 'Accepted articles appear in "Articles in Press" with DOIs assigned immediately.' },
            { step: '4', title: 'Issue Compilation', desc: 'Once enough accepted articles are available, they will be compiled into Volume 1, Issue 1.' },
          ].map((item) => (
            <div key={item.step} className={`flex gap-4 border rounded-xl p-5 ${item.active ? 'bg-tan/10 border-peach/30' : 'bg-cream border-border'}`}>
              <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${item.active ? 'bg-peach text-white' : 'bg-cream-alt text-tan'}`}>
                {item.step}
              </span>
              <div>
                <p className="font-semibold text-brown-dark text-sm">{item.title}</p>
                <p className="text-sm text-tan mt-0.5">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-10 bg-cream-alt border border-border rounded-2xl p-8 text-center">
        <h2 className="font-serif text-xl font-normal text-brown-dark mb-3">Be Part of Our First Issue</h2>
        <p className="text-tan leading-relaxed mb-5 max-w-xl mx-auto">
          Publishing in a journal's inaugural issue is a unique opportunity. APCs are waived through the end of 2026 — submit your case report or case series today.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/submit" className="btn-primary">Submit a Manuscript</Link>
          <Link href="/guide-for-authors" className="btn-outline">Guide for Authors</Link>
        </div>
      </section>
    </div>
  )
}
