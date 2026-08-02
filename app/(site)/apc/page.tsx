import type { Metadata } from 'next'
import Link from 'next/link'
import PageHeader from '@/components/PageHeader'
import {
  APC_DISPLAY,
  APC_DISPLAY_WITH_CURRENCY,
  APC_CURRENCY,
  APC_GRANDFATHER_NOTE,
  APC_PAYMENT_TERMS_DAYS,
} from '@/lib/apc/config'

export const metadata: Metadata = {
  title: 'APC & Fees',
  description:
    `OSCRSJ charges a flat ${APC_DISPLAY_WITH_CURRENCY} article processing charge per accepted manuscript. No submission fee, no page or colour charges, nothing payable if your manuscript is rejected.`,
  alternates: { canonical: 'https://www.oscrsj.com/apc' },
  openGraph: {
    title: 'APC & Fees | OSCRSJ',
    description:
      `A flat ${APC_DISPLAY_WITH_CURRENCY} article processing charge per accepted manuscript. Nothing is payable unless your manuscript is accepted.`,
    url: 'https://www.oscrsj.com/apc',
    type: 'website',
  },
}

const FAQS = [
  {
    q: 'When is the APC charged?',
    a: `After acceptance, never before. Submission is free, peer review is free, and you pay nothing if your manuscript is rejected or you withdraw it before a decision.`,
  },
  {
    q: 'Is the APC per article or per author?',
    a: 'Per accepted manuscript, regardless of how many authors are listed. Liability sits with the corresponding author, who can direct the invoice to an institution, department, or grant.',
  },
  {
    q: 'Are revisions charged separately?',
    a: 'No. A manuscript that goes through two rounds of revision pays exactly the same single charge as one accepted on first review.',
  },
  {
    q: 'Are there any other fees?',
    a: 'None. No submission fee, no page charges, no colour figure charges, no supplementary material charges, and no surcharge for length or number of authors. The APC is the only author-facing charge OSCRSJ levies.',
  },
  {
    q: 'How do I pay?',
    a: `Payment is by credit or debit card through Stripe, due within ${APC_PAYMENT_TERMS_DAYS} days of the acceptance invoice. An itemized invoice suitable for institutional or grant reimbursement is issued in every case.`,
  },
  {
    q: 'Does OSCRSJ offer waivers or discounts?',
    a: 'No. OSCRSJ operates a single flat charge with no waivers, no discounts, and no institutional or membership schemes. Applying one rate to every accepted manuscript is what keeps the charge low and keeps fee decisions entirely out of the editorial process.',
  },
  {
    q: 'Does paying affect whether my manuscript is accepted?',
    a: 'No. Reviewers and handling editors are never told whether an author has paid or been invoiced. Fee administration only begins once a decision has been issued, and no member of the editorial team receives any share of APC revenue.',
  },
  {
    q: 'What if my article is later retracted?',
    a: 'A duplicate or erroneous charge is refunded in full. Where an article is retracted because of an error attributable to the journal, the APC is refunded in full. Retraction for author misconduct carries no refund.',
  },
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
          text: `OSCRSJ charges a flat article processing charge of ${APC_DISPLAY_WITH_CURRENCY} per accepted manuscript. There is no submission fee and nothing is payable if your manuscript is rejected.`,
        },
      },
      ...FAQS.map((f) => ({
        '@type': 'Question',
        name: f.q,
        acceptedAnswer: { '@type': 'Answer', text: f.a },
      })),
      {
        '@type': 'Question',
        name: 'Is OSCRSJ open access?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Yes. All articles published in OSCRSJ are immediately and permanently free to read, download, share, and adapt — including for commercial purposes, with attribution — under a Creative Commons Attribution 4.0 International (CC BY 4.0) license.',
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
        subtitle="OSCRSJ is fully open access. Readers pay nothing. A single charge on acceptance covers peer review coordination, production, DOI registration, indexing, and permanent hosting."
      />

      <div className="max-w-content mx-auto px-4 sm:px-6 lg:px-8 py-20">
        {/* Headline price */}
        <section className="mb-12">
          <span className="section-label">Pricing</span>
          <h2 className="section-heading mb-5">One charge, on acceptance</h2>
          <div className="bg-white border border-border rounded-xl p-8">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
              <div>
                <p className="text-xs font-semibold text-brown uppercase tracking-widest">Per Accepted Manuscript</p>
                <p className="text-sm text-ink mt-2 max-w-xl leading-relaxed">
                  OSCRSJ charges a flat article processing charge per accepted manuscript. It covers editorial coordination, peer review management, copy-editing and typesetting, DOI registration with Crossref, indexing submissions, hosting, and long-term preservation.
                </p>
              </div>
              <div className="text-left sm:text-right shrink-0">
                <p className="font-serif text-5xl font-bold text-brown-dark leading-none">{APC_DISPLAY}</p>
                <p className="text-xs text-brown mt-2">{APC_CURRENCY} &middot; charged on acceptance</p>
              </div>
            </div>
          </div>

          <div className="grid sm:grid-cols-3 gap-4 mt-4">
            {[
              { t: 'Free to submit', d: 'No submission fee. Peer review costs you nothing.' },
              { t: 'Free if rejected', d: 'Nothing is payable unless your manuscript is accepted.' },
              { t: 'No hidden extras', d: 'No page, colour, figure, or supplementary charges.' },
            ].map((item) => (
              <div key={item.t} className="bg-cream-alt border border-border rounded-xl p-5">
                <p className="font-semibold text-ink text-sm mb-1">{item.t}</p>
                <p className="text-xs text-brown leading-relaxed">{item.d}</p>
              </div>
            ))}
          </div>

          <p className="text-xs text-brown mt-4 leading-relaxed">
            {APC_GRANDFATHER_NOTE}
          </p>
        </section>

        {/* Editorial independence — COPE / DOAJ transparency requirement */}
        <section className="mb-12">
          <span className="section-label">Integrity</span>
          <h2 className="section-heading mb-3">Payment does not influence editorial decisions</h2>
          <div className="bg-white border border-border rounded-xl p-6">
            <p className="text-sm text-ink leading-relaxed">
              Reviewers and handling editors are never told whether an author has paid or been invoiced. Acceptance is decided on scientific merit alone. Fee administration is handled separately from editorial decision-making and only begins once a decision has been issued. No member of the editorial team receives any share of APC revenue.
            </p>
          </div>
        </section>

        {/* Payment terms */}
        <section className="mb-12">
          <span className="section-label">Payment</span>
          <h2 className="section-heading mb-3">How and when you pay</h2>
          <div className="bg-white border border-border rounded-xl p-6">
            <ul className="space-y-2.5 text-sm">
              {[
                `An invoice is emailed to the corresponding author after a formal decision of acceptance, payable within ${APC_PAYMENT_TERMS_DAYS} days.`,
                'Payment is by credit or debit card through Stripe. An itemized invoice for institutional or grant reimbursement is provided in every case.',
                `The charge is stated and payable in ${APC_CURRENCY}. Any bank or currency-conversion fees are the payer's responsibility.`,
                'Production of the final article begins on receipt of payment; an article is not published while its invoice is outstanding.',
              ].map((line) => (
                <li key={line} className="flex items-start gap-2">
                  <span className="text-brown mt-1 flex-shrink-0">&rarr;</span>
                  <span className="text-ink">{line}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* FAQ */}
        <section className="mb-12">
          <span className="section-label">Common Questions</span>
          <h2 className="section-heading mb-5">Frequently Asked Questions</h2>
          <div className="space-y-4">
            {FAQS.map((faq) => (
              <div key={faq.q} className="bg-white border border-border rounded-xl p-6">
                <p className="font-semibold text-ink text-sm mb-1.5">{faq.q}</p>
                <p className="text-sm text-ink">{faq.a}</p>
              </div>
            ))}
          </div>
        </section>

        {/* No-waiver disclosure — DOAJ Principles of Transparency §13 requires
            the absence of waivers to be stated as plainly as their presence. */}
        <section className="mb-12">
          <span className="section-label">Waivers</span>
          <h2 className="section-heading mb-3">One rate, applied to everyone</h2>
          <div className="bg-white border border-border rounded-xl p-6">
            <p className="text-sm text-ink leading-relaxed">
              OSCRSJ does not operate a waiver or discount scheme. There are no institutional agreements, no membership rates, and no case-by-case reductions. Every accepted manuscript pays the same {APC_DISPLAY_WITH_CURRENCY}.
            </p>
            <p className="text-sm text-ink leading-relaxed mt-3">
              We have set the charge deliberately low &mdash; well under the typical open-access rate in orthopedics &mdash; so that a single, predictable figure works for authors without needing a negotiation. Applying one rate to everyone also keeps fee decisions completely outside the editorial process, which is where they belong.
            </p>
          </div>
        </section>

        {/* Agreement pointer */}
        <section className="mb-12">
          <div className="bg-cream-alt border border-border rounded-xl p-6">
            <p className="font-semibold text-ink text-sm mb-1.5">Before you submit</p>
            <p className="text-sm text-ink leading-relaxed">
              The {APC_DISPLAY} charge, the CC BY 4.0 license, and the warranties you give as an author are set out in full in the{' '}
              <Link href="/publication-agreement" className="text-brown hover:text-brown underline font-medium">Author Publication Agreement</Link>. You will be asked to accept it as a required step in the submission portal, before your manuscript is sent to the editorial office.
            </p>
          </div>
        </section>

        <div className="text-center">
          <Link href="/submit" className="btn-primary-light">
            Submit a Manuscript &mdash; free unless accepted
          </Link>
        </div>
      </div>
    </div>
  )
}
