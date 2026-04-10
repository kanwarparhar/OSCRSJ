import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = { title: 'Editorial Policies — OSCRSJ' }

export default function EditorialPoliciesPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-10">
        <h1 className="font-serif text-3xl font-semibold text-charcoal">Editorial Policies</h1>
        <p className="text-charcoal-muted mt-2 text-lg">
          Standards of integrity, transparency, and ethical publishing
        </p>
      </div>

      <div className="space-y-10">

        <section>
          <h2 className="font-serif text-xl font-semibold text-charcoal mb-3">Publication Ethics</h2>
          <p className="text-charcoal-muted leading-relaxed mb-3">
            OSCRSJ adheres to the guidelines established by the Committee on Publication Ethics (COPE) and the International Committee of Medical Journal Editors (ICMJE). We are committed to maintaining the highest standards of integrity in medical publishing.
          </p>
          <p className="text-charcoal-muted leading-relaxed">
            All authors, reviewers, and editors are expected to uphold these standards throughout the submission, review, and publication process.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-xl font-semibold text-charcoal mb-3">Patient Consent & Privacy</h2>
          <p className="text-charcoal-muted leading-relaxed mb-3">
            All case reports and case series must include documented informed patient consent for publication. Authors must ensure that no personally identifiable information is included in the manuscript unless the patient has provided explicit written consent.
          </p>
          <p className="text-charcoal-muted leading-relaxed">
            Images should be de-identified. If a patient's face is visible, written consent specifically for image publication is required. IRB approval or exemption documentation must be provided where applicable.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-xl font-semibold text-charcoal mb-3">Authorship Criteria</h2>
          <p className="text-charcoal-muted leading-relaxed mb-3">
            OSCRSJ follows the ICMJE authorship criteria. All listed authors must have made substantial contributions to:
          </p>
          <ul className="space-y-2 pl-4">
            {[
              'Conception or design of the work, or acquisition, analysis, or interpretation of data',
              'Drafting the manuscript or revising it critically for important intellectual content',
              'Final approval of the version to be published',
              'Agreement to be accountable for all aspects of the work',
            ].map((item) => (
              <li key={item} className="flex items-start gap-2 text-charcoal-muted text-sm leading-relaxed">
                <span className="text-coral mt-1 flex-shrink-0">&rarr;</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
          <p className="text-charcoal-muted leading-relaxed mt-3">
            All four criteria must be met. Contributors who do not meet all criteria should be acknowledged in the Acknowledgments section.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-xl font-semibold text-charcoal mb-3">Conflicts of Interest</h2>
          <p className="text-charcoal-muted leading-relaxed">
            All authors must disclose any financial or personal relationships that could influence or appear to influence their work. This includes funding sources, consulting relationships, stock ownership, patent holdings, and institutional affiliations that may pose a conflict. The corresponding author is responsible for collecting and submitting conflict of interest statements from all co-authors at the time of submission.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-xl font-semibold text-charcoal mb-3">Plagiarism & Originality</h2>
          <p className="text-charcoal-muted leading-relaxed mb-3">
            All submissions must be original work that has not been published previously and is not under consideration by another journal. OSCRSJ uses plagiarism detection software to screen all submissions.
          </p>
          <p className="text-charcoal-muted leading-relaxed">
            Manuscripts found to contain plagiarized content — including self-plagiarism, duplicate publication, or undisclosed overlap with previously published material — will be rejected or retracted, and the authors' institutions may be notified.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-xl font-semibold text-charcoal mb-3">Corrections & Retractions</h2>
          <div className="space-y-3">
            {[
              { title: 'Erratum', desc: 'Published when a significant error is identified that affects the interpretation of the article but does not invalidate its conclusions. The erratum is linked to the original article.' },
              { title: 'Corrigendum', desc: 'Published to correct author-attributed errors (typographical errors, incorrect data) that do not affect the overall findings.' },
              { title: 'Retraction', desc: 'Issued when an article is found to contain fabricated data, serious ethical violations, or fundamental errors that invalidate the conclusions. Retracted articles remain accessible with a retraction notice.' },
              { title: 'Expression of Concern', desc: 'Published when there is reason to question the integrity of an article but insufficient evidence for a retraction. Further investigation is typically ongoing.' },
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

        <section>
          <h2 className="font-serif text-xl font-semibold text-charcoal mb-3">AI-Assisted Writing</h2>
          <p className="text-charcoal-muted leading-relaxed">
            Authors may use AI tools (such as ChatGPT, Claude, or Grammarly) to assist with grammar, clarity, or formatting. However, AI tools cannot be listed as authors and must not generate clinical content, data, or conclusions. Authors must disclose the use of AI writing tools in their cover letter and remain fully responsible for the accuracy, integrity, and originality of their manuscript.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-xl font-semibold text-charcoal mb-3">Data Sharing</h2>
          <p className="text-charcoal-muted leading-relaxed">
            OSCRSJ encourages authors to make supporting data available where possible and appropriate. For case reports, this typically includes de-identified imaging, operative photographs, and outcome data. Data sharing must comply with patient privacy regulations (HIPAA in the US) and should not include any personally identifiable information.
          </p>
        </section>
      </div>

      <div className="mt-12 flex flex-col sm:flex-row gap-3">
        <Link href="/peer-review" className="btn-primary">Peer Review Policy</Link>
        <Link href="/guide-for-authors" className="btn-outline">Guide for Authors</Link>
        <Link href="/submit" className="btn-outline">Submit a Manuscript</Link>
      </div>
    </div>
  )
}
