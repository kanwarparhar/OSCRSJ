import type { Metadata } from 'next'
import Link from 'next/link'
import PageHeader from '@/components/PageHeader'

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
    <div>
      <PageHeader
        label="For Authors"
        title="Submit a Manuscript"
        subtitle="We welcome case reports and case series from medical students, residents, fellows, and attending surgeons."
      />

      <div className="max-w-content mx-auto px-4 sm:px-6 lg:px-8 py-20">
        {/* Submit via Email CTA — moved higher */}
        <div className="bg-gradient-to-br from-tan/10 to-cream-alt border border-peach/20 rounded-2xl p-8 mb-12 text-center">
          <h2 className="font-serif text-2xl font-normal text-brown-dark mb-2">Submit via Email</h2>
          <p className="text-tan text-sm mb-6 max-w-lg mx-auto">
            Send your manuscript, cover letter, and supplementary files to the address below. Online portal launching soon.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="mailto:submit@oscrsj.com" className="btn-primary">
              submit@oscrsj.com
            </Link>
            <Link href="/guide-for-authors" className="border border-brown text-brown font-medium px-6 py-2.5 rounded-full transition-all duration-200 inline-flex items-center gap-2 text-sm hover:bg-brown hover:text-cream">
              Read the Guide First
            </Link>
          </div>
        </div>

        {/* APC Notice */}
        <div className="bg-tan/20 border border-peach/30 rounded-xl p-5 mb-12 flex items-start gap-3">
          <svg className="w-5 h-5 text-brown mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <p className="text-sm font-semibold text-brown">Free to Publish Through End of 2026</p>
            <p className="text-sm text-tan mt-0.5">
              During our launch phase, all article processing charges (APCs) are waived.{' '}
              <Link href="/apc" className="text-brown hover:text-brown underline">Learn about our APC policy →</Link>
            </p>
          </div>
        </div>

        {/* Article types */}
        <section className="mb-12">
          <span className="section-label">Article Types</span>
          <h2 className="section-heading mb-6">What We Accept</h2>
          <div className="grid sm:grid-cols-2 gap-6">
            {articleTypes.map((t) => (
              <div key={t.type} className="bg-cream border border-border rounded-xl p-6">
                <h3 className="font-serif text-xl font-normal text-brown-dark mb-2">{t.type}</h3>
                <p className="text-sm text-tan mb-4">{t.desc}</p>
                <div className="space-y-1.5">
                  {[t.maxWords, t.figures, t.refs].map((item) => (
                    <div key={item} className="flex items-center gap-2 text-xs text-tan">
                      <svg className="w-3.5 h-3.5 text-brown" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
          <span className="section-label">How It Works</span>
          <h2 className="section-heading mb-8">Submission Process</h2>
          <div className="space-y-5">
            {steps.map((s) => (
              <div key={s.step} className="flex gap-5 items-start">
                <div className="w-12 h-12 bg-tan/20 rounded-full flex-shrink-0 flex items-center justify-center border-2 border-peach/30">
                  <span className="text-sm font-bold text-brown">{s.step}</span>
                </div>
                <div className="pt-2">
                  <h3 className="font-semibold text-brown-dark">{s.title}</h3>
                  <p className="text-sm text-tan mt-0.5">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
