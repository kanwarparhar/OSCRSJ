import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = { title: 'Peer Review Policy — OSCRSJ' }

export default function PeerReviewPage() {
  const faqData = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: 'What type of peer review does OSCRSJ use?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'OSCRSJ uses double-blind peer review. Neither authors nor reviewers know each other\'s identities during the review process.',
        },
      },
      {
        '@type': 'Question',
        name: 'How many reviewers evaluate each manuscript?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Each manuscript is reviewed by at least two independent reviewers with expertise in the relevant orthopedic subspecialty.',
        },
      },
    ],
  }

  return (
    <div className="max-w-content mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqData) }}
      />
      <div className="mb-10">
        <h1 className="font-serif text-3xl font-normal text-brown-dark">Peer Review Policy</h1>
        <p className="text-tan mt-2 text-lg">
          Rigorous, fair, and timely evaluation of every submission
        </p>
      </div>

      <section className="mb-10 bg-gradient-to-br from-tan/10 to-cream-alt border border-peach/20 rounded-2xl p-8">
        <h2 className="font-serif text-xl font-normal text-brown-dark mb-3">Double-Blind Peer Review</h2>
        <p className="text-tan leading-relaxed">
          All manuscripts submitted to OSCRSJ undergo double-blind peer review. Neither the authors nor the reviewers know each other's identities during the review process. This ensures that every submission is evaluated solely on its scientific merit, clinical significance, and adherence to reporting standards — regardless of the author's institution, training level, or reputation.
        </p>
      </section>

      <section className="mb-10">
        <h2 className="font-serif text-xl font-normal text-brown-dark mb-5">Review Process</h2>
        <div className="space-y-3">
          {[
            { step: '1', title: 'Initial Editorial Screening', desc: 'The Editor-in-Chief screens submissions for scope, completeness, and basic quality. Manuscripts that do not meet minimum criteria are returned within 7 days with feedback.', time: '1–7 days' },
            { step: '2', title: 'Reviewer Assignment', desc: 'Suitable manuscripts are assigned to at least two independent reviewers with expertise in the relevant orthopedic subspecialty.', time: '1–3 days' },
            { step: '3', title: 'Peer Review', desc: 'Reviewers evaluate the manuscript for clinical significance, novelty, methodology, ethical compliance, and clarity of presentation. Structured review forms are used.', time: '14–21 days' },
            { step: '4', title: 'Editorial Decision', desc: 'Based on reviewer recommendations, the editor issues one of four decisions: Accept, Minor Revisions, Major Revisions, or Reject.', time: '1–3 days' },
            { step: '5', title: 'Revision & Resubmission', desc: 'Authors are given clear, constructive feedback and a deadline for revision. Revised manuscripts may undergo additional review.', time: '14 days' },
            { step: '6', title: 'Final Decision & Publication', desc: 'Accepted manuscripts receive copyediting, DOI assignment, and are published online.', time: '3–7 days' },
          ].map((item) => (
            <div key={item.step} className="flex gap-4 bg-cream border border-border rounded-xl p-5">
              <span className="w-8 h-8 rounded-full bg-cream-alt flex items-center justify-center text-sm font-bold text-tan flex-shrink-0">
                {item.step}
              </span>
              <div className="flex-1">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold text-brown-dark text-sm">{item.title}</p>
                  <span className="text-xs text-taupe bg-cream-alt rounded-full px-2.5 py-0.5 flex-shrink-0">{item.time}</span>
                </div>
                <p className="text-sm text-tan mt-0.5">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
        <p className="text-sm text-tan mt-4 italic">
          Target: first decision within 30 days of submission.
        </p>
      </section>

      <section className="mb-10">
        <h2 className="font-serif text-xl font-normal text-brown-dark mb-5">Reviewer Criteria</h2>
        <div className="space-y-3">
          {[
            { title: 'Clinical Significance', desc: 'Does the case contribute meaningful knowledge to orthopedic practice or education?' },
            { title: 'Novelty', desc: 'Does the case present an unusual diagnosis, rare complication, or novel treatment approach?' },
            { title: 'Methodology', desc: 'Is the case reported with sufficient detail, appropriate follow-up, and sound clinical reasoning?' },
            { title: 'Ethical Compliance', desc: 'Does the manuscript include appropriate patient consent and IRB/ethics documentation?' },
            { title: 'Reporting Quality', desc: 'Does the manuscript follow CARE guidelines and OSCRSJ formatting standards?' },
            { title: 'Clarity', desc: 'Is the manuscript well-written, logically structured, and free of ambiguity?' },
          ].map((item) => (
            <div key={item.title} className="flex gap-3 bg-cream border border-border rounded-xl p-5">
              <svg className="w-5 h-5 text-brown mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <div>
                <p className="font-semibold text-brown-dark text-sm">{item.title}</p>
                <p className="text-sm text-tan mt-0.5">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-10">
        <h2 className="font-serif text-xl font-normal text-brown-dark mb-3">Appeals</h2>
        <p className="text-tan leading-relaxed">
          Authors who believe their manuscript was unfairly rejected may submit a written appeal to the Editor-in-Chief at <span className="text-brown font-medium">editor@oscrsj.com</span>. Appeals must include a detailed response to each reviewer comment and a rationale for reconsideration. The editorial team will evaluate the appeal and may seek additional review. The final decision rests with the Editor-in-Chief.
        </p>
      </section>

      <div className="flex flex-col sm:flex-row gap-3">
        <Link href="/submit" className="btn-primary">Submit a Manuscript</Link>
        <Link href="/editorial-policies" className="btn-outline">Editorial Policies</Link>
        <Link href="/guide-for-authors" className="btn-outline">Guide for Authors</Link>
      </div>
    </div>
  )
}
