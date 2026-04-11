import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = { title: 'APC & Fees' }

const phases = [
  { phase: 'Phase 1', period: 'Months 1–6 (2026)', price: '$0', label: 'Free', desc: 'Launch phase — all APCs waived. Build volume, attract early authors, establish the journal.' },
  { phase: 'Phase 2', period: 'Months 7–18', price: '$299', label: 'Founding Rate', desc: 'Soft introduction of fees. Authors in this phase are "founding authors" and receive this rate for their next submission too.' },
  { phase: 'Phase 3', period: 'Year 2–3', price: '$499', label: 'Standard Rate', desc: 'Competitive with comparable open-access orthopedic journals. Best value in the market.' },
  { phase: 'Phase 4', period: 'Post-PubMed Indexing', price: '$699', label: 'Post-Indexing', desc: 'Once PubMed indexed, pricing steps up to reflect credibility — still well below major publishers.' },
]

const waivers = [
  { group: 'Low-income country authors', discount: '100% waiver', note: 'World Bank low-income country list, updated annually' },
  { group: 'Lower-middle-income country authors', discount: '50% discount', note: 'World Bank classification' },
  { group: 'PGY-1 and PGY-2 residents', discount: '50% discount', note: 'Verification required' },
  { group: 'Medical students (first author)', discount: '50% discount', note: 'Enrolled student verification required' },
  { group: 'First-ever publication (any author)', discount: '25% discount', note: 'For authors with no prior publications' },
  { group: 'Financial hardship', discount: 'Case-by-case', note: 'Apply via the waiver request form' },
]

export default function ApcPage() {
  const faqData = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: 'How much does it cost to publish in OSCRSJ?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'OSCRSJ is currently offering free article processing for all submissions through the end of 2026. After this introductory period, APCs will begin at $299.',
        },
      },
      {
        '@type': 'Question',
        name: 'Does OSCRSJ offer APC waivers?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Yes. OSCRSJ offers 100% waivers for authors from low-income countries, 50% for lower-middle-income countries and PGY-1/2 residents or medical students, and 25% for first-time published authors.',
        },
      },
      {
        '@type': 'Question',
        name: 'Is OSCRSJ open access?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Yes. All articles published in OSCRSJ are immediately and permanently free to read, download, and share under a Creative Commons license.',
        },
      },
    ],
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqData) }}
      />
      <div className="mb-10">
        <h1 className="font-serif text-3xl font-semibold text-charcoal">Article Processing Charges</h1>
        <p className="text-charcoal-muted mt-2 text-lg">
          OSCRSJ is fully open access. APCs support our operations — peer review coordination, DOI registration, and hosting.
        </p>
      </div>

      {/* Currently free banner */}
      <div className="bg-coral text-white rounded-xl p-6 mb-10">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 bg-white/20 rounded-full flex-shrink-0 flex items-center justify-center text-xl">🎉</div>
          <div>
            <p className="font-semibold text-lg">Currently Free to Publish</p>
            <p className="text-white/80 text-sm mt-1">
              Through the end of 2026, all APCs are waived. Submit now and publish at no cost during our launch phase.
            </p>
          </div>
        </div>
      </div>

      {/* Pricing timeline */}
      <section className="mb-12">
        <h2 className="font-serif text-xl font-semibold text-charcoal mb-5">Pricing Roadmap</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          {phases.map((p, i) => (
            <div key={p.phase} className={`border rounded-xl p-5 ${i === 0 ? 'border-coral/50 bg-coral/5' : 'border-border bg-white'}`}>
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="text-xs font-semibold text-charcoal-muted uppercase tracking-widest">{p.phase}</p>
                  <p className="text-xs text-charcoal-muted mt-0.5">{p.period}</p>
                </div>
                <div className="text-right">
                  <p className="font-serif text-2xl font-bold text-coral">{p.price}</p>
                  <p className={`text-xs font-semibold mt-0.5 ${i === 0 ? 'text-coral' : 'text-charcoal-muted'}`}>{p.label}</p>
                </div>
              </div>
              <p className="text-sm text-charcoal-muted leading-relaxed">{p.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Waivers */}
      <section className="mb-12">
        <h2 className="font-serif text-xl font-semibold text-charcoal mb-2">Waiver & Discount Policy</h2>
        <p className="text-charcoal-muted text-sm mb-5">
          OSCRSJ is mission-driven. We don&apos;t want cost to be a barrier for trainees or authors from lower-income settings.
        </p>
        <div className="bg-white border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-sand border-b border-border">
              <tr>
                <th className="text-left px-5 py-3 text-xs font-semibold text-charcoal-muted uppercase tracking-widest">Group</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-charcoal-muted uppercase tracking-widest">Discount</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-charcoal-muted uppercase tracking-widest hidden sm:table-cell">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {waivers.map((w) => (
                <tr key={w.group} className="hover:bg-sand/50 transition-colors">
                  <td className="px-5 py-3 text-charcoal">{w.group}</td>
                  <td className="px-5 py-3 font-semibold text-coral">{w.discount}</td>
                  <td className="px-5 py-3 text-charcoal-muted hidden sm:table-cell">{w.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-charcoal-muted mt-3">
          To apply for a waiver, email <a href="mailto:waivers@oscrsj.com" className="text-coral hover:underline">waivers@oscrsj.com</a> with your submission ID and supporting documentation.
        </p>
      </section>

      {/* FAQ */}
      <section>
        <h2 className="font-serif text-xl font-semibold text-charcoal mb-5">Frequently Asked Questions</h2>
        <div className="space-y-4">
          {[
            { q: 'When is the APC charged?', a: 'The APC is charged after acceptance — never before. You won\'t pay anything if your manuscript is rejected.' },
            { q: 'Is the APC per article or per author?', a: 'It\'s per accepted manuscript, regardless of the number of authors.' },
            { q: 'Are revisions charged separately?', a: 'No. Resubmissions after major revision are not re-charged. You pay once per accepted article.' },
            { q: 'How do I pay?', a: 'We accept payment via Stripe (credit/debit card). An invoice is provided for institutional reimbursement.' },
          ].map((faq) => (
            <div key={faq.q} className="bg-white border border-border rounded-xl p-5">
              <p className="font-semibold text-charcoal text-sm mb-1.5">{faq.q}</p>
              <p className="text-sm text-charcoal-muted">{faq.a}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="mt-10 text-center">
        <Link href="/submit" className="btn-primary">Submit a Manuscript — Free in 2026</Link>
      </div>
    </div>
  )
}
