import type { Metadata } from 'next'
import Link from 'next/link'
import PageHeader from '@/components/PageHeader'

export const metadata: Metadata = { title: 'Submit a Manuscript' }

const resourceLinks = [
  {
    title: 'Guide for Authors',
    desc: 'Article-type specifications, manuscript structure, formatting, references, ethics, and reporting checklists. The canonical reference for every submission.',
    href: '/guide-for-authors',
  },
  {
    title: 'Manuscript Templates',
    desc: 'Downloadable Word templates and worked examples for every article type. Pre-formatted to OSCRSJ specifications (Times New Roman 12pt, double-spaced, line numbering on, italic-only headings).',
    href: '/templates',
  },
  {
    title: 'Peer Review Process',
    desc: 'How OSCRSJ evaluates manuscripts: double-blind review, two independent reviewers, decision categories, and turnaround targets.',
    href: '/peer-review',
  },
  {
    title: 'Editorial Policies',
    desc: 'Patient consent, IRB approval, data availability, conflict of interest, authorship criteria (ICMJE), and AI disclosure requirements.',
    href: '/editorial-policies',
  },
  {
    title: 'APC & Fees',
    desc: 'Article processing charges, the launch-window waiver, and discount eligibility for low-income countries, lower-middle-income countries, and first-time authors.',
    href: '/apc',
  },
  {
    title: 'Open Access Policy',
    desc: 'Licensing terms (CC BY-NC-ND 4.0), copyright retention, and reuse rights for authors and readers.',
    href: '/open-access',
  },
  {
    title: 'Author FAQ',
    desc: 'Common questions on submission, peer review, formatting, ethics, and post-publication. Start here if you are unsure about any submission step.',
    href: '/faq',
  },
  {
    title: 'For Reviewers',
    desc: 'Standards, expectations, and guidance for serving as a peer reviewer at OSCRSJ.',
    href: '/for-reviewers',
  },
]

export default function SubmitPage() {
  return (
    <div>
      <PageHeader
        label="For Authors"
        title="Submit a Manuscript"
        subtitle="We welcome submissions from across the global orthopedic surgery community."
      />

      <div className="max-w-content mx-auto px-4 sm:px-6 lg:px-8 py-20">
        {/* Submit Online CTA */}
        <div className="bg-gradient-to-br from-tan/10 to-cream-alt border border-peach/20 rounded-2xl p-8 mb-12 text-center">
          <h2 className="font-serif text-2xl font-normal text-brown-dark mb-2">Submit Online</h2>
          <p className="text-brown text-sm mb-6 max-w-lg mx-auto">
            Use our submission portal to upload your manuscript, cover letter, and supplementary files. You&apos;ll need a free author account to get started.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/dashboard/submit" className="btn-primary-light">
              Start a Submission
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
            <p className="text-sm font-semibold text-brown">Free to Publish — Submit Before August 1, 2026</p>
            <p className="text-sm text-brown mt-0.5">
              Article processing charges (APCs) are waived for all manuscripts submitted before August 1, 2026.{' '}
              <Link href="/apc" className="text-brown hover:text-brown underline">Learn about our APC policy →</Link>
            </p>
          </div>
        </div>

        {/* Resource grid — author-facing reference pages */}
        <section className="mb-12">
          <span className="section-label">Before You Submit</span>
          <h2 className="section-heading mb-6">Author Resources</h2>
          <p className="text-ink leading-relaxed mb-8 max-w-2xl">
            Every page below contains information you should review before submitting. The Guide for Authors is the canonical reference; the rest are deep-dives on specific aspects of the submission and publication process.
          </p>
          <div className="grid sm:grid-cols-2 gap-4">
            {resourceLinks.map((r) => (
              <Link
                key={r.title}
                href={r.href}
                className="group bg-white border border-border rounded-xl p-6 hover:border-tan hover:shadow-sm transition-all duration-200"
              >
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-serif text-lg font-normal text-brown-dark group-hover:text-brown transition-colors">{r.title}</h3>
                  <svg className="w-4 h-4 text-brown flex-shrink-0 mt-1.5 group-hover:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
                <p className="text-sm text-ink/80 mt-2 leading-relaxed">{r.desc}</p>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
