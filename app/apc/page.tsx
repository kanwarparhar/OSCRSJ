import type { Metadata } from 'next'
import Link from 'next/link'
import PageHeader from '@/components/PageHeader'
import DiscountInquiryForm from './DiscountInquiryForm'

export const metadata: Metadata = { title: 'APC & Fees' }

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
          text: 'OSCRSJ is currently free to publish for all manuscripts submitted before August 1, 2026. After this launch window, the article processing charge is $499 per accepted manuscript.',
        },
      },
      {
        '@type': 'Question',
        name: 'Does OSCRSJ offer discounts on the APC?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Yes. We review discount requests on a case-by-case basis for medical students, trainees, and authors from lower-income settings. We do not want cost to be a barrier to publication — please use the discount inquiry form on our APC page to start the conversation.',
        },
      },
      {
        '@type': 'Question',
        name: 'Is OSCRSJ open access?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Yes. All articles published in OSCRSJ are immediately and permanently free to read, download, and share for non-commercial purposes under a Creative Commons Attribution-NonCommercial-NoDerivatives (CC BY-NC-ND 4.0) license.',
        },
      },
    ],
  }

  return (
    <div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqData) }}
      />
      <PageHeader
        label="For Authors"
        title="Article Processing Charges"
        subtitle="OSCRSJ is fully open access. APCs support our operations — peer review coordination, DOI registration, and hosting."
      />

      <div className="max-w-content mx-auto px-4 sm:px-6 lg:px-8 py-20">
        {/* Currently free banner — dark editorial brown */}
        <div className="bg-brown-dark text-cream rounded-xl p-6 mb-12">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-peach/20 rounded-full flex-shrink-0 flex items-center justify-center text-xl">🎉</div>
            <div>
              <p className="font-semibold text-lg text-cream">Free to Publish — Submit Before August 1, 2026</p>
              <p className="text-cream/80 text-sm mt-1">
                All APCs are waived for manuscripts submitted before August 1, 2026. Submit now and publish at no cost during our launch window.
              </p>
            </div>
          </div>
        </div>

        {/* Standard APC — single rate */}
        <section className="mb-12">
          <span className="section-label">Pricing</span>
          <h2 className="section-heading mb-5">Standard Article Processing Charge</h2>
          <div className="bg-white border border-border rounded-xl p-8">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <p className="text-xs font-semibold text-brown uppercase tracking-widest">Per Accepted Manuscript</p>
                <p className="text-sm text-ink mt-2 max-w-xl leading-relaxed">
                  After August 1, 2026, OSCRSJ charges a flat article processing charge per accepted manuscript. The fee covers editorial coordination, peer review management, DOI registration, indexing submissions, hosting, and long-term preservation.
                </p>
              </div>
              <div className="text-left sm:text-right">
                <p className="font-serif text-5xl font-bold text-brown-dark leading-none">$499</p>
                <p className="text-xs text-brown mt-2">Charged on acceptance</p>
              </div>
            </div>
          </div>
          <p className="text-xs text-brown mt-3">
            Authors are never charged before acceptance. If your manuscript is rejected, there is no fee.
          </p>
        </section>

        {/* FAQ */}
        <section className="mb-12">
          <span className="section-label">Common Questions</span>
          <h2 className="section-heading mb-5">Frequently Asked Questions</h2>
          <div className="space-y-4">
            {[
              { q: 'When is the APC charged?', a: 'The APC is charged after acceptance — never before. You won\'t pay anything if your manuscript is rejected.' },
              { q: 'Is the APC per article or per author?', a: 'It\'s per accepted manuscript, regardless of the number of authors.' },
              { q: 'Are revisions charged separately?', a: 'No. Resubmissions after major revision are not re-charged. You pay once per accepted article.' },
              { q: 'How do I pay?', a: 'We accept payment via Stripe (credit/debit card). An invoice is provided for institutional reimbursement.' },
            ].map((faq) => (
              <div key={faq.q} className="bg-white border border-border rounded-xl p-6">
                <p className="font-semibold text-ink text-sm mb-1.5">{faq.q}</p>
                <p className="text-sm text-ink">{faq.a}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Discount Inquiry */}
        <section className="mb-12">
          <span className="section-label">Financial Support</span>
          <h2 className="section-heading mb-3">Request a Discount</h2>
          <p className="text-ink text-sm mb-6 max-w-2xl leading-relaxed">
            We are committed to supporting authors who would otherwise face a financial barrier to publication — particularly medical students and authors from lower-income settings. We do not want cost to stand between rigorous orthopedic scholarship and the readers who need it. Tell us a little about your situation and our editorial team will follow up directly.
          </p>
          <DiscountInquiryForm />
        </section>

        <div className="text-center">
          <Link href="/submit" className="btn-primary-light">Submit a Manuscript — Free Before Aug 1, 2026</Link>
        </div>
      </div>
    </div>
  )
}
