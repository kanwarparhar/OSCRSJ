import type { Metadata } from 'next'
import Link from 'next/link'
import PageHeader from '@/components/PageHeader'

export const metadata: Metadata = {
  title: 'Author FAQ',
  description: 'Frequently asked questions about submitting to OSCRSJ, peer review, APCs, and publication.',
}

const faqSections = [
  {
    label: 'Submission',
    questions: [
      {
        q: 'What types of manuscripts does OSCRSJ accept?',
        a: 'We accept case reports, case series, images in orthopedics, and surgical technique articles across all orthopedic subspecialties. See our Article Types page for detailed requirements.',
      },
      {
        q: 'Can medical students submit manuscripts?',
        a: 'Absolutely. OSCRSJ specifically encourages submissions from medical students, residents, and fellows. We believe early-career clinicians produce important educational literature. A supervising faculty member should be listed as a co-author.',
      },
      {
        q: 'How do I submit my manuscript?',
        a: 'Currently, manuscripts can be submitted via email to submit@oscrsj.com. Our online submission portal is under development and will launch soon. Include your manuscript (.docx), cover letter, and any supplementary files.',
      },
      {
        q: 'What file format should my manuscript be in?',
        a: 'Microsoft Word (.docx) format. Use Times New Roman or Arial, 12pt, double-spaced. Images should be TIFF or EPS at minimum 300 DPI, embedded in the document and also submitted as separate files.',
      },
    ],
  },
  {
    label: 'Peer Review',
    questions: [
      {
        q: 'How long does peer review take?',
        a: 'We target a first decision within 30 days of submission. Our double-blind peer review process typically involves 2 independent reviewers with subspecialty expertise.',
      },
      {
        q: 'What is double-blind peer review?',
        a: 'In double-blind review, neither the authors nor the reviewers know each other\'s identities. This ensures objective and fair evaluation of the manuscript.',
      },
      {
        q: 'What happens after peer review?',
        a: 'You will receive one of four decisions: Accept, Minor Revisions, Major Revisions, or Reject. If revisions are requested, you will have 30 days to submit a revised manuscript with a point-by-point response to reviewer comments.',
      },
    ],
  },
  {
    label: 'Fees & Access',
    questions: [
      {
        q: 'Are there article processing charges (APCs)?',
        a: 'All APCs are waived through the end of 2026. After that, standard APCs will apply with generous waivers available for trainees and authors from low-income countries. See our APC page for details.',
      },
      {
        q: 'Is OSCRSJ open access?',
        a: 'Yes. All published articles are immediately and permanently free to read, download, and share under a Creative Commons CC BY 4.0 license.',
      },
      {
        q: 'Does OSCRSJ assign DOIs?',
        a: 'Yes. Every published article receives a Crossref DOI, ensuring permanent discoverability and citation tracking.',
      },
    ],
  },
  {
    label: 'Publication',
    questions: [
      {
        q: 'How quickly are accepted articles published?',
        a: 'Accepted articles are typically published within 14 days of final acceptance. Articles are published online first and then included in the next monthly issue.',
      },
      {
        q: 'Is OSCRSJ indexed in PubMed?',
        a: 'We are actively working toward PubMed indexing, which requires a track record of consistent monthly publication. This is a 2-year pathway. Articles are currently discoverable via Crossref and Google Scholar.',
      },
      {
        q: 'Can I share my published article?',
        a: 'Yes. Under our CC BY 4.0 license, you are free to share, copy, and redistribute your article in any medium or format, as long as proper attribution is given.',
      },
    ],
  },
]

export default function FAQPage() {
  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqSections.flatMap((s) =>
      s.questions.map((q) => ({
        '@type': 'Question',
        name: q.q,
        acceptedAnswer: { '@type': 'Answer', text: q.a },
      }))
    ),
  }

  return (
    <div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <PageHeader
        label="For Authors"
        title="Frequently Asked Questions"
        subtitle="Common questions about submitting, peer review, fees, and publication."
      />

      <div className="max-w-content mx-auto px-4 sm:px-6 lg:px-8 py-20">
        {faqSections.map((section, si) => (
          <section key={section.label} className={`${si > 0 ? 'mt-12' : ''}`}>
            <span className="section-label">{section.label}</span>
            <h2 className="section-heading mb-6">{section.label} Questions</h2>
            <div className="space-y-4">
              {section.questions.map((faq) => (
                <div key={faq.q} className="bg-white border border-border rounded-xl p-6">
                  <h3 className="font-semibold text-brown-dark mb-2">{faq.q}</h3>
                  <p className="text-sm text-brown-dark leading-relaxed">{faq.a}</p>
                </div>
              ))}
            </div>
          </section>
        ))}

        {/* CTA */}
        <div className="mt-12 bg-tan/20 border border-peach/30 rounded-xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <p className="font-semibold text-brown-dark">Still have questions?</p>
            <p className="text-sm text-tan mt-0.5">Our editorial team is here to help.</p>
          </div>
          <Link href="/contact" className="btn-primary-light flex-shrink-0">
            Contact Us →
          </Link>
        </div>
      </div>
    </div>
  )
}
