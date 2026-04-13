import type { Metadata } from 'next'
import Link from 'next/link'
import PageHeader from '@/components/PageHeader'

export const metadata: Metadata = { title: 'Editorial Policies — OSCRSJ' }

export default function EditorialPoliciesPage() {
  return (
    <div>
      <PageHeader
        label="Policies"
        title="Editorial Policies"
        subtitle="Standards of integrity, transparency, and ethical publishing"
      />

      <div className="max-w-content mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="space-y-12">

          <section>
            <span className="section-label">Ethics</span>
            <h2 className="section-heading mb-3">Publication Ethics</h2>
            <p className="text-brown-dark leading-relaxed mb-3">
              OSCRSJ adheres to the guidelines established by the Committee on Publication Ethics (COPE) and the International Committee of Medical Journal Editors (ICMJE). We are committed to maintaining the highest standards of integrity in medical publishing.
            </p>
            <p className="text-brown-dark leading-relaxed">
              All authors, reviewers, and editors are expected to uphold these standards throughout the submission, review, and publication process.
            </p>
          </section>

          <section>
            <span className="section-label">Patient Rights</span>
            <h2 className="section-heading mb-3">Patient Consent & Privacy</h2>
            <p className="text-brown-dark leading-relaxed mb-3">
              All case reports and case series must include documented informed patient consent for publication. Authors must ensure that no personally identifiable information is included in the manuscript unless the patient has provided explicit written consent.
            </p>
            <p className="text-brown-dark leading-relaxed">
              Images should be de-identified. If a patient's face is visible, written consent specifically for image publication is required. IRB approval or exemption documentation must be provided where applicable.
            </p>
          </section>

          <section>
            <span className="section-label">Attribution</span>
            <h2 className="section-heading mb-3">Authorship Criteria</h2>
            <p className="text-brown-dark leading-relaxed mb-3">
              OSCRSJ follows the ICMJE authorship criteria. All listed authors must have made substantial contributions to:
            </p>
            <ul className="space-y-2 pl-4">
              {[
                'Conception or design of the work, or acquisition, analysis, or interpretation of data',
                'Drafting the manuscript or revising it critically for important intellectual content',
                'Final approval of the version to be published',
                'Agreement to be accountable for all aspects of the work',
              ].map((item) => (
                <li key={item} className="flex items-start gap-2 text-brown-dark text-sm leading-relaxed">
                  <span className="text-brown mt-1 flex-shrink-0">&rarr;</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <p className="text-brown-dark leading-relaxed mt-3">
              All four criteria must be met. Contributors who do not meet all criteria should be acknowledged in the Acknowledgments section.
            </p>
          </section>

          <section>
            <span className="section-label">Disclosure</span>
            <h2 className="section-heading mb-3">Conflicts of Interest</h2>
            <p className="text-brown-dark leading-relaxed mb-3">
              All authors must disclose any financial or personal relationships that could influence or appear to influence their work. Disclosures must cover the preceding 36 months and include: funding sources, consulting fees, honoraria, stock ownership, patent holdings, paid expert testimony, and institutional affiliations that may pose a conflict. The corresponding author is responsible for collecting and submitting conflict of interest statements from all co-authors at the time of submission.
            </p>
            <p className="text-brown-dark leading-relaxed mb-3">
              Editors and reviewers are held to the same standard. Any editor or reviewer with a potential conflict must recuse themselves from the decision-making process for that manuscript. The Editor-in-Chief will assign an alternate editor when necessary.
            </p>
            <p className="text-brown-dark leading-relaxed">
              Failure to disclose a relevant conflict of interest may result in rejection of the manuscript, retraction of a published article, or notification of the authors' institutions. All COI disclosures are published alongside the article.
            </p>
          </section>

          <section>
            <span className="section-label">Integrity</span>
            <h2 className="section-heading mb-3">Plagiarism & Originality</h2>
            <p className="text-brown-dark leading-relaxed mb-3">
              All submissions must be original work that has not been published previously and is not under consideration by another journal. OSCRSJ uses plagiarism detection software to screen all submissions.
            </p>
            <p className="text-brown-dark leading-relaxed">
              Manuscripts found to contain plagiarized content — including self-plagiarism, duplicate publication, or undisclosed overlap with previously published material — will be rejected or retracted, and the authors' institutions may be notified.
            </p>
          </section>

          <section>
            <span className="section-label">Post-Publication</span>
            <h2 className="section-heading mb-3">Corrections & Retractions</h2>
            <div className="space-y-3">
              {[
                { title: 'Erratum', desc: 'Published when a significant error is identified that affects the interpretation of the article but does not invalidate its conclusions. The erratum is linked to the original article.' },
                { title: 'Corrigendum', desc: 'Published to correct author-attributed errors (typographical errors, incorrect data) that do not affect the overall findings.' },
                { title: 'Retraction', desc: 'Issued when an article is found to contain fabricated data, serious ethical violations, or fundamental errors that invalidate the conclusions. Retracted articles remain accessible with a retraction notice.' },
                { title: 'Expression of Concern', desc: 'Published when there is reason to question the integrity of an article but insufficient evidence for a retraction. Further investigation is typically ongoing.' },
              ].map((item) => (
                <div key={item.title} className="flex gap-3 bg-white border border-border rounded-xl p-6">
                  <svg className="w-5 h-5 text-brown mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <div>
                    <p className="font-semibold text-brown-dark text-sm">{item.title}</p>
                    <p className="text-sm text-brown-dark mt-0.5">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section>
            <span className="section-label">Disputes</span>
            <h2 className="section-heading mb-3">Authorship Disputes</h2>
            <p className="text-brown-dark leading-relaxed mb-3">
              If a dispute arises regarding authorship before or after publication, the corresponding author should notify the Editor-in-Chief immediately. OSCRSJ will follow COPE guidelines for resolving authorship disputes. The journal will not adjudicate authorship disagreements but will require all named authors to confirm their contributions before publication proceeds.
            </p>
            <p className="text-brown-dark leading-relaxed">
              If a dispute cannot be resolved among the authors, the manuscript will be held until the authors' institutions have investigated and provided a resolution. Published articles with unresolved authorship disputes may receive a published notice pending resolution.
            </p>
          </section>

          <section>
            <span className="section-label">Animal Studies</span>
            <h2 className="section-heading mb-3">Animal Research Ethics</h2>
            <p className="text-brown-dark leading-relaxed">
              Although OSCRSJ primarily publishes clinical case reports and case series involving human subjects, manuscripts that include animal research must comply with institutional and national guidelines for the care and use of laboratory animals. Authors must confirm that appropriate Institutional Animal Care and Use Committee (IACUC) approval was obtained and must include the approval number in the manuscript. All animal research must adhere to the ARRIVE guidelines for reporting.
            </p>
          </section>

          <section>
            <span className="section-label">Transparency</span>
            <h2 className="section-heading mb-3">Data Availability & Reproducibility</h2>
            <p className="text-brown-dark leading-relaxed mb-3">
              OSCRSJ requires all authors to include a Data Availability Statement in their manuscript. This statement should describe whether data supporting the findings are available and, if so, how they can be accessed. For case reports, this typically includes de-identified clinical data, imaging, and outcome measures.
            </p>
            <p className="text-brown-dark leading-relaxed">
              Authors are encouraged to deposit supplementary data in publicly accessible repositories when possible. All shared data must comply with patient privacy regulations, including HIPAA in the United States. If data cannot be shared due to privacy or ethical restrictions, this should be stated explicitly.
            </p>
          </section>

          <section>
            <span className="section-label">Technology</span>
            <h2 className="section-heading mb-3">AI-Assisted Writing</h2>
            <p className="text-brown-dark leading-relaxed">
              Authors may use AI tools (such as ChatGPT, Claude, or Grammarly) to assist with grammar, clarity, or formatting. However, AI tools cannot be listed as authors and must not generate clinical content, data, or conclusions. Authors must disclose the use of AI writing tools in their cover letter and remain fully responsible for the accuracy, integrity, and originality of their manuscript.
            </p>
          </section>

          <section>
            <span className="section-label">Open Data</span>
            <h2 className="section-heading mb-3">Data Sharing</h2>
            <p className="text-brown-dark leading-relaxed">
              OSCRSJ encourages authors to make supporting data available where possible and appropriate. For case reports, this typically includes de-identified imaging, operative photographs, and outcome data. Data sharing must comply with patient privacy regulations (HIPAA in the US) and should not include any personally identifiable information.
            </p>
          </section>
        </div>

        <div className="mt-12 flex flex-col sm:flex-row gap-3">
          <Link href="/peer-review" className="btn-primary-light">Peer Review Policy</Link>
          <Link href="/guide-for-authors" className="btn-outline">Guide for Authors</Link>
          <Link href="/submit" className="btn-outline">Submit a Manuscript</Link>
        </div>
      </div>
    </div>
  )
}
