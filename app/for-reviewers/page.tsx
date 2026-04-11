import type { Metadata } from 'next'
import Link from 'next/link'
import PageHeader from '@/components/PageHeader'

export const metadata: Metadata = {
  title: 'For Reviewers',
  description: 'Reviewer guidelines, expectations, and timeline for OSCRSJ peer review.',
}

const reviewCriteria = [
  { title: 'Originality & Novelty', desc: 'Does the case present new information or a unique clinical scenario that adds to the literature?' },
  { title: 'Clinical Relevance', desc: 'Will this case influence clinical decision-making or educate readers on an important orthopedic topic?' },
  { title: 'Scientific Rigor', desc: 'Is the case presentation thorough, accurate, and supported by appropriate evidence and references?' },
  { title: 'Ethical Compliance', desc: 'Is patient consent documented? Are identifiers removed? Does the work comply with the Declaration of Helsinki?' },
  { title: 'Writing Quality', desc: 'Is the manuscript well-organized, clearly written, and free of major grammatical errors?' },
  { title: 'Figures & Images', desc: 'Are clinical images high-quality, properly labeled, and essential to understanding the case?' },
]

export default function ForReviewersPage() {
  return (
    <div>
      <PageHeader
        label="For Reviewers"
        title="Reviewer Guidelines"
        subtitle="Help us maintain the highest standards in orthopedic case reporting."
      />

      <div className="max-w-content mx-auto px-4 sm:px-6 lg:px-8 py-20">
        {/* Overview */}
        <section className="mb-12">
          <span className="section-label">Overview</span>
          <h2 className="section-heading mb-4">The Role of a Reviewer</h2>
          <p className="text-brown-dark leading-relaxed mb-4">
            Peer reviewers are essential to maintaining the quality and credibility of OSCRSJ. As a reviewer, you provide expert evaluation of submitted manuscripts, offering constructive feedback that helps authors improve their work and ensuring that published articles meet the highest standards of scientific rigor and clinical relevance.
          </p>
          <p className="text-brown-dark leading-relaxed">
            All reviews are double-blind: you will not know the identity of the authors, and they will not know yours. This ensures objectivity and fairness in the evaluation process.
          </p>
        </section>

        {/* Timeline */}
        <section className="mb-12 bg-cream-alt rounded-2xl p-8 -mx-4 sm:-mx-6 lg:-mx-8">
          <span className="section-label">Timeline</span>
          <h2 className="section-heading mb-6">Review Process & Deadlines</h2>
          <div className="grid sm:grid-cols-3 gap-6">
            {[
              { step: '48 hours', label: 'Accept or decline', desc: 'After receiving a review invitation, please respond within 48 hours so we can reassign if needed.' },
              { step: '21 days', label: 'Complete your review', desc: 'We ask reviewers to submit their evaluation within 3 weeks of accepting the invitation.' },
              { step: '7 days', label: 'Revision re-review', desc: 'If asked to re-evaluate a revised manuscript, please respond within 1 week.' },
            ].map((t) => (
              <div key={t.label} className="bg-cream border border-border rounded-xl p-6">
                <p className="font-serif text-2xl text-brown-dark">{t.step}</p>
                <p className="text-xs text-tan mt-1 uppercase tracking-wider font-medium">{t.label}</p>
                <p className="text-sm text-brown-dark mt-3 leading-relaxed">{t.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Review criteria */}
        <section className="mb-12">
          <span className="section-label">Evaluation</span>
          <h2 className="section-heading mb-6">Review Criteria</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {reviewCriteria.map((c) => (
              <div key={c.title} className="flex gap-3 bg-cream border border-border rounded-xl p-6">
                <svg className="w-5 h-5 text-brown mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                <div>
                  <p className="font-semibold text-brown-dark text-sm">{c.title}</p>
                  <p className="text-sm text-tan mt-0.5">{c.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Expectations */}
        <section className="mb-12">
          <span className="section-label">Expectations</span>
          <h2 className="section-heading mb-4">What We Ask of Reviewers</h2>
          <div className="space-y-3">
            {[
              'Provide specific, constructive feedback — explain what should change and why.',
              'Maintain confidentiality — do not share manuscript content with anyone.',
              'Disclose conflicts of interest — recuse yourself if you have a relationship with the authors or a competing interest.',
              'Be respectful — critique the work, not the authors. Remember that many OSCRSJ authors are trainees.',
              'Be timely — if you cannot meet the deadline, let us know as soon as possible so we can reassign.',
            ].map((item, i) => (
              <div key={i} className="flex gap-3 items-start">
                <svg className="w-5 h-5 text-brown mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <p className="text-sm text-brown-dark leading-relaxed">{item}</p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <div className="bg-tan/20 border border-peach/30 rounded-xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <p className="font-semibold text-brown-dark">Interested in reviewing for OSCRSJ?</p>
            <p className="text-sm text-tan mt-0.5">We are actively recruiting reviewers across all orthopedic subspecialties.</p>
          </div>
          <Link href="/contact" className="btn-primary flex-shrink-0">
            Contact Us →
          </Link>
        </div>
      </div>
    </div>
  )
}
