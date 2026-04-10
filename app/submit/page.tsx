import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = { title: 'Submit a Manuscript' }

const steps = [
  { step: '01', title: 'Prepare Your Manuscript', desc: 'Review the Guide for Authors and ensure your submission meets formatting and content requirements.' },
  { step: '02', title: 'Create an Account', desc: 'Register for a free author account on our submission portal.' },
  { step: '03', title: 'Submit Online', desc: 'Upload your manuscript, cover letter, and any supplementary files through the portal.' },
  { step: '04', title: 'Peer Review', desc: 'Your submission undergoes double-blind peer review. You\'ll receive a decision within 30 days.' },
  { step: '05', title: 'Revision & Acceptance', desc: 'Revise based on reviewer feedback. Once accepted, your article receives a DOI and is published.' },
]

const articleTypes = [
  {
    type: 'Case Report',
    desc: 'A detailed report of a single patient or clinical case with unusual, novel, or educational value.',
    maxWords: '2,500 words',
    figures: 'Up to 6 figures/tables',
    refs: 'Up to 25 references',
  },
  {
    type: 'Case Series',
    desc: 'A report of 3 or more cases sharing common features, analyzed collectively for patterns or outcomes.',
    maxWords: '4,000 words',
    figures: 'Up to 10 figures/tables',
    refs: 'Up to 40 references',
  },
]

export default function SubmitPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-10">
        <h1 className="font-serif text-3xl font-semibold text-charcoal">Submit a Manuscript</h1>
        <p className="text-charcoal-muted mt-2 text-lg">
          We welcome case reports and case series from medical students, residents, fellows, and attending surgeons.
        </p>
      </div>

      {/* APC Notice */}
      <div className="bg-coral/10 border border-coral/30 rounded-xl p-5 mb-10 flex items-start gap-3">
        <svg className="w-5 h-5 text-coral mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <div>
          <p className="text-sm font-semibold text-coral">Free to Publish Through End of 2026</p>
          <p className="text-sm text-charcoal-muted mt-0.5">
            During our launch phase, all article processing charges (APCs) are waived.{' '}
            <Link href="/apc" className="text-coral hover:text-coral-dark underline">Learn about our APC policy →</Link>
          </p>
        </div>
      </div>

      {/* Article types */}
      <section className="mb-12">
        <h2 className="font-serif text-xl font-semibold text-charcoal mb-4">Article Types We Accept</h2>
        <div className="grid sm:grid-cols-2 gap-5">
          {articleTypes.map((t) => (
            <div key={t.type} className="bg-white border border-border rounded-xl p-6">
              <h3 className="font-semibold text-charcoal text-base mb-2">{t.type}</h3>
              <p className="text-sm text-charcoal-muted mb-4">{t.desc}</p>
              <div className="space-y-1.5">
                {[t.maxWords, t.figures, t.refs].map((item) => (
                  <div key={item} className="flex items-center gap-2 text-xs text-charcoal-muted">
                    <svg className="w-3.5 h-3.5 text-coral" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                    {item}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Submission Steps */}
      <section className="mb-12">
        <h2 className="font-serif text-xl font-semibold text-charcoal mb-6">Submission Process</h2>
        <div className="space-y-4">
          {steps.map((s) => (
            <div key={s.step} className="flex gap-5 items-start">
              <div className="w-10 h-10 bg-coral/10 rounded-full flex-shrink-0 flex items-center justify-center">
                <span className="text-xs font-bold text-coral">{s.step}</span>
              </div>
              <div className="pt-1.5">
                <h3 className="font-semibold text-charcoal text-sm">{s.title}</h3>
                <p className="text-sm text-charcoal-muted mt-0.5">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <div className="bg-sand border border-border rounded-2xl p-8 text-center">
        <h2 className="font-serif text-2xl font-semibold text-charcoal mb-2">Ready to Submit?</h2>
        <p className="text-charcoal-muted text-sm mb-6">
          Our submission portal is coming soon. In the meantime, submit via email.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="mailto:submit@oscrsj.com" className="btn-primary">
            Submit via Email
          </Link>
          <Link href="/guide-for-authors" className="btn-outline">
            Read the Guide First
          </Link>
        </div>
      </div>
    </div>
  )
}
