import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = { title: 'Open Access Policy — OSCRSJ' }

export default function OpenAccessPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-10">
        <h1 className="font-serif text-3xl font-semibold text-charcoal">Open Access Policy</h1>
        <p className="text-charcoal-muted mt-2 text-lg">
          Free to read, share, and build upon — for everyone
        </p>
      </div>

      <section className="mb-10 bg-gradient-to-br from-coral/10 to-sand border border-coral/20 rounded-2xl p-8">
        <h2 className="font-serif text-xl font-semibold text-charcoal mb-3">Fully Open Access</h2>
        <p className="text-charcoal-muted leading-relaxed">
          All articles published in OSCRSJ are immediately and permanently available to read, download, and share at no cost to the reader. We do not maintain paywalls, subscription fees, or institutional access requirements. Medical knowledge — especially educational case-based literature — should be freely accessible to clinicians, trainees, and patients worldwide.
        </p>
      </section>

      <section className="mb-10">
        <h2 className="font-serif text-xl font-semibold text-charcoal mb-5">Creative Commons License</h2>
        <div className="bg-white border border-border rounded-xl p-6 mb-4">
          <p className="font-semibold text-charcoal text-sm mb-2">CC BY 4.0 — Creative Commons Attribution 4.0 International</p>
          <p className="text-sm text-charcoal-muted leading-relaxed">
            All articles are published under the Creative Commons Attribution 4.0 International (CC BY 4.0) license. This means anyone is free to:
          </p>
          <ul className="mt-3 space-y-2 pl-4">
            {[
              'Share — copy and redistribute the material in any medium or format',
              'Adapt — remix, transform, and build upon the material for any purpose, including commercially',
            ].map((item) => (
              <li key={item} className="flex items-start gap-2 text-charcoal-muted text-sm leading-relaxed">
                <span className="text-coral mt-1 flex-shrink-0">&rarr;</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
          <p className="text-sm text-charcoal-muted leading-relaxed mt-3">
            The only requirement is appropriate credit — users must give proper attribution to the original authors and indicate if changes were made.
          </p>
        </div>
      </section>

      <section className="mb-10">
        <h2 className="font-serif text-xl font-semibold text-charcoal mb-5">Benefits of Open Access</h2>
        <div className="space-y-3">
          {[
            { title: 'Global Reach', desc: 'Your case report is accessible to surgeons, residents, and medical students worldwide — not just those at institutions with journal subscriptions.' },
            { title: 'Higher Visibility', desc: 'Open-access articles are read, downloaded, and cited more frequently than paywalled articles, increasing the impact of your work.' },
            { title: 'Educational Impact', desc: 'Trainees at community programs, international institutions, and under-resourced hospitals can access the same literature as those at academic medical centers.' },
            { title: 'Funder Compliance', desc: 'Many funding agencies (NIH, NSF, Wellcome Trust) require open-access publication. CC BY 4.0 satisfies Plan S and other open-access mandates.' },
            { title: 'Author Rights', desc: 'Authors retain copyright of their work. You can share, present, and reuse your article without seeking publisher permission.' },
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

      <section className="mb-10">
        <h2 className="font-serif text-xl font-semibold text-charcoal mb-3">How We Sustain Open Access</h2>
        <p className="text-charcoal-muted leading-relaxed mb-3">
          OSCRSJ is funded through article processing charges (APCs) paid by authors upon acceptance. APCs cover the costs of peer review coordination, copyediting, DOI registration, web hosting, and long-term digital archiving.
        </p>
        <p className="text-charcoal-muted leading-relaxed">
          We offer generous waivers for trainees, first-time authors, and researchers from low- and middle-income countries. APCs are waived entirely during our 2026 launch phase. See our <Link href="/apc" className="text-coral hover:text-coral-dark transition-colors font-medium">APC & Fees</Link> page for full details.
        </p>
      </section>

      <div className="flex flex-col sm:flex-row gap-3">
        <Link href="/apc" className="btn-primary">APC & Fees</Link>
        <Link href="/submit" className="btn-outline">Submit a Manuscript</Link>
      </div>
    </div>
  )
}
