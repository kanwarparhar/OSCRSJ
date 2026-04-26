import type { Metadata } from 'next'
import Link from 'next/link'
import PageHeader from '@/components/PageHeader'

export const metadata: Metadata = { title: 'Open Access Policy — OSCRSJ' }

export default function OpenAccessPage() {
  return (
    <div>
      <PageHeader
        label="Access Policy"
        title="Open Access"
        subtitle="Free to read, share, and build upon — for everyone"
      />

      <div className="max-w-content mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <section className="mb-12 bg-gradient-to-br from-tan/10 to-cream-alt border border-peach/20 rounded-2xl p-8">
          <span className="section-label">Our Commitment</span>
          <h2 className="section-heading mb-3">Fully Open Access</h2>
          <p className="text-ink leading-relaxed">
            All articles published in OSCRSJ are immediately and permanently available to read, download, and share at no cost to the reader. We do not maintain paywalls, subscription fees, or institutional access requirements. Medical knowledge — especially educational case-based literature — should be freely accessible to clinicians, trainees, and patients worldwide.
          </p>
        </section>

        <section className="mb-12">
          <span className="section-label">Licensing</span>
          <h2 className="section-heading mb-5">Creative Commons License</h2>
          <div className="bg-white border border-border rounded-xl p-6 mb-4">
            <p className="font-semibold text-ink text-sm mb-2">CC BY-NC-ND 4.0 — Creative Commons Attribution-NonCommercial-NoDerivatives 4.0 International</p>
            <p className="text-sm text-ink leading-relaxed">
              All articles are published under the Creative Commons Attribution-NonCommercial-NoDerivatives 4.0 International (CC BY-NC-ND 4.0) license. Under this license, anyone is free to:
            </p>
            <ul className="mt-3 space-y-2 pl-4">
              {[
                'Share — copy and redistribute the material in any medium or format for non-commercial purposes',
              ].map((item) => (
                <li key={item} className="flex items-start gap-2 text-ink text-sm leading-relaxed">
                  <span className="text-brown mt-1 flex-shrink-0">&rarr;</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <p className="text-sm text-ink leading-relaxed mt-3">
              Under the following terms: appropriate credit must be given to the original authors with a link to the license, the material may not be used for commercial purposes, and if the material is remixed, transformed, or built upon, the modified material may not be distributed.
            </p>
          </div>
        </section>

        <section className="mb-12">
          <span className="section-label">Advantages</span>
          <h2 className="section-heading mb-5">Benefits of Open Access</h2>
          <div className="space-y-3">
            {[
              { title: 'Global Reach', desc: 'Your case report is accessible to surgeons, residents, and medical students worldwide — not just those at institutions with journal subscriptions.' },
              { title: 'Higher Visibility', desc: 'Open-access articles are read, downloaded, and cited more frequently than paywalled articles, increasing the impact of your work.' },
              { title: 'Educational Impact', desc: 'Trainees at community programs, international institutions, and under-resourced hospitals can access the same literature as those at academic medical centers.' },
              { title: 'Author Rights', desc: 'Authors retain copyright of their work and the right to reuse their article in their own teaching, presentations, theses, and subsequent research without seeking publisher permission.' },
              { title: 'Content Integrity', desc: 'The NoDerivatives clause means your work cannot be republished in altered or excerpted form, protecting the integrity of your clinical reporting and your professional reputation.' },
            ].map((item) => (
              <div key={item.title} className="flex gap-3 bg-white border border-border rounded-xl p-6">
                <svg className="w-5 h-5 text-brown mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <div>
                  <p className="font-semibold text-ink text-sm">{item.title}</p>
                  <p className="text-sm text-ink mt-0.5">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mb-12">
          <span className="section-label">Sustainability</span>
          <h2 className="section-heading mb-3">How We Sustain Open Access</h2>
          <p className="text-ink leading-relaxed mb-3">
            OSCRSJ is funded through article processing charges (APCs) paid by authors upon acceptance. APCs cover the costs of peer review coordination, copyediting, DOI registration, web hosting, and long-term digital archiving.
          </p>
          <p className="text-ink leading-relaxed">
            We offer generous waivers for trainees, first-time authors, and researchers from low- and middle-income countries. APCs are waived entirely during our 2026 launch phase. See our <Link href="/apc" className="text-brown hover:text-brown transition-colors font-medium">APC & Fees</Link> page for full details.
          </p>
        </section>

        <div className="flex flex-col sm:flex-row gap-3">
          <Link href="/apc" className="btn-primary-light">APC & Fees</Link>
          <Link href="/submit" className="btn-outline">Submit a Manuscript</Link>
        </div>
      </div>
    </div>
  )
}
