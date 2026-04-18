import type { Metadata } from 'next'
import Link from 'next/link'
import PageHeader from '@/components/PageHeader'

export const metadata: Metadata = {
  title: 'For Reviewers - OSCRSJ',
  description: 'Complete reviewer guidelines for OSCRSJ. Learn how to conduct a thorough, fair, and constructive peer review for orthopedic case reports and case series.',
}

/* ------------------------------------------------------------------ */
/*  Evaluation criteria by section                                     */
/* ------------------------------------------------------------------ */

const evaluationSections = [
  {
    title: 'Title and Abstract',
    items: [
      'Is the title accurate, concise, and descriptive of the case?',
      'Does the abstract follow the required structure?',
      'Does the abstract stand alone as a complete summary?',
      'Are there abbreviations or references in the abstract? (There should not be.)',
    ],
  },
  {
    title: 'Introduction',
    items: [
      'Is the clinical context clearly established?',
      'Is the novelty or educational value of the case clearly stated?',
      'Is relevant background literature cited?',
      'Is it appropriately brief (not a full literature review)?',
    ],
  },
  {
    title: 'Case Presentation / Methods',
    items: [
      'Is the clinical timeline clear and logical?',
      'Are patient demographics, history, examination findings, and investigations adequately described?',
      'Is the surgical technique or treatment described in sufficient detail for reproduction?',
      'Are outcomes and follow-up duration clearly reported?',
      'Has all protected health information (PHI) been removed?',
    ],
  },
  {
    title: 'Discussion',
    items: [
      'Is the case placed in context of existing literature?',
      'Are differential diagnoses discussed?',
      'Is the rationale for the chosen treatment explained?',
      'Are limitations of the case report acknowledged?',
      'Are the conclusions supported by the evidence presented?',
    ],
  },
  {
    title: 'Figures and Tables',
    items: [
      'Are images of sufficient quality for publication?',
      'Are figure legends accurate and complete?',
      'Are patient identifiers removed from all images?',
      'Do figures and tables add value, or are any redundant?',
    ],
  },
  {
    title: 'References',
    items: [
      'Are references current and relevant?',
      'Are key foundational and recent references included?',
      'Are references formatted in Vancouver style?',
    ],
  },
  {
    title: 'Ethics and Reporting',
    items: [
      'Is a patient consent statement included?',
      'Is a conflict of interest statement included?',
      'Has the CARE checklist been completed (for case reports)?',
      'Has the JBI checklist been completed (for case series)?',
    ],
  },
]

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function ForReviewersPage() {
  return (
    <div>
      <PageHeader
        label="For Reviewers"
        title="Reviewer Guidelines"
        subtitle="Everything you need to conduct a thorough, fair, and constructive peer review."
      />

      <div className="max-w-content mx-auto px-4 sm:px-6 lg:px-8 py-20">

        {/* ---- Welcome ---- */}
        <section className="mb-12 bg-gradient-to-br from-tan/10 to-cream-alt border border-peach/20 rounded-2xl p-8">
          <span className="section-label">Welcome</span>
          <h2 className="section-heading mb-3">Thank You for Reviewing</h2>
          <p className="text-ink leading-relaxed">
            Peer review is the cornerstone of scientific publishing, and your expertise directly shapes the quality of OSCRSJ. As a reviewer, you serve two functions: advising the editorial team on whether a manuscript meets our standards for publication, and providing constructive feedback to help authors improve their work. Even manuscripts that require revision or rejection deserve thoughtful, respectful feedback.
          </p>
          <p className="text-ink leading-relaxed mt-3">
            Many of our authors are medical students and residents submitting their first manuscript. Your review may shape their career in academic publishing.
          </p>
        </section>

        {/* ---- Confidentiality & Ethics ---- */}
        <section id="ethics" className="mb-12 scroll-mt-24">
          <span className="section-label">Ethics</span>
          <h2 className="section-heading mb-5">Confidentiality and Ethics</h2>
          <div className="space-y-3 max-w-3xl">
            {[
              'All manuscripts are confidential. Do not share, discuss, or distribute any manuscript under review.',
              'Do not use information from an unpublished manuscript in your own work.',
              'OSCRSJ uses double-blind review. Do not attempt to identify authors. If you recognize the work, disclose this to the editor.',
              'Decline to review if you have a conflict of interest: personal relationship with likely authors, competing research, financial interest, or institutional affiliation with likely authors.',
              'If you suspect plagiarism, data fabrication, or ethical violations, notify the editor immediately. Do not contact the authors directly.',
            ].map((item, i) => (
              <div key={i} className="flex gap-3 bg-white border border-border rounded-xl p-5">
                <svg className="w-5 h-5 text-brown mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <p className="text-sm text-ink leading-relaxed">{item}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ---- Timeline ---- */}
        <section id="timeline" className="mb-12 scroll-mt-24">
          <span className="section-label">Timeline</span>
          <h2 className="section-heading mb-5">Review Timeline</h2>
          <div className="grid sm:grid-cols-3 gap-4 max-w-3xl">
            {[
              { label: 'Respond to Invitation', time: '48 hours', desc: 'Accept or decline the review request' },
              { label: 'Complete Your Review', time: '14 days', desc: 'From the date you accept the invitation' },
              { label: 'Extension Available', time: 'Up to 7 days', desc: 'Contact the editorial office before your deadline' },
            ].map((item) => (
              <div key={item.label} className="bg-cream border border-border rounded-xl p-5 text-center">
                <p className="text-2xl font-serif text-brown-dark">{item.time}</p>
                <p className="text-xs font-semibold text-brown uppercase tracking-widest mt-1">{item.label}</p>
                <p className="text-xs text-ink mt-2">{item.desc}</p>
              </div>
            ))}
          </div>
          <p className="text-sm text-ink mt-4 max-w-3xl">
            If you are unable to review, please suggest 1-2 alternative reviewers with relevant expertise.
          </p>
        </section>

        {/* ---- How to Review ---- */}
        <section id="how-to-review" className="mb-12 scroll-mt-24">
          <span className="section-label">Process</span>
          <h2 className="section-heading mb-5">How to Conduct Your Review</h2>

          <div className="space-y-4 max-w-3xl">
            {[
              { step: '1', title: 'First Read', desc: 'Read the entire manuscript without taking notes. Get a general impression of the clinical significance, novelty, and presentation quality. Ask yourself: does this case teach something useful? Would I want to know about this case if I encountered a similar patient?' },
              { step: '2', title: 'Detailed Assessment', desc: 'Re-read the manuscript section by section, evaluating against the criteria below. Take notes on strengths and weaknesses, originality, readability, and overall structure.' },
              { step: '3', title: 'Write Your Review', desc: 'Organize your feedback using the structure described in the "Structuring Your Review" section below. Separate confidential comments to the editor from comments to the authors.' },
            ].map((item) => (
              <div key={item.step} className="flex gap-4 bg-white border border-border rounded-xl p-6">
                <span className="w-8 h-8 rounded-full bg-cream flex items-center justify-center text-sm font-bold text-brown flex-shrink-0">
                  {item.step}
                </span>
                <div>
                  <p className="font-semibold text-ink text-sm">{item.title}</p>
                  <p className="text-sm text-ink mt-1">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ---- Evaluation Criteria ---- */}
        <section id="criteria" className="mb-12 scroll-mt-24">
          <span className="section-label">Assessment</span>
          <h2 className="section-heading mb-5">Evaluation Criteria by Section</h2>

          <div className="space-y-4 max-w-3xl">
            {evaluationSections.map((section) => (
              <div key={section.title} className="bg-white border border-border rounded-xl p-6">
                <h3 className="font-semibold text-ink text-sm mb-3 uppercase tracking-wide">{section.title}</h3>
                <ul className="space-y-2">
                  {section.items.map((item, i) => (
                    <li key={i} className="flex gap-3 text-sm text-ink leading-relaxed">
                      <svg className="w-4 h-4 text-brown mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* ---- Structuring Your Review ---- */}
        <section id="structure" className="mb-12 scroll-mt-24">
          <span className="section-label">Format</span>
          <h2 className="section-heading mb-5">Structuring Your Review</h2>

          <div className="space-y-4 max-w-3xl">
            {[
              { heading: 'Summary', desc: '2-3 sentences. Brief synopsis of the manuscript and your overall impression of its contribution.' },
              { heading: 'Major Comments', desc: 'Issues that must be addressed before the manuscript can be considered for publication. These might include missing clinical details, flawed reasoning, unsupported conclusions, or ethical concerns.' },
              { heading: 'Minor Comments', desc: 'Suggestions for improvement that would strengthen the manuscript but are not essential. These might include wording suggestions, additional references, or figure quality improvements.' },
              { heading: 'Recommendation', desc: 'Select one of the four editorial decisions described below.' },
            ].map((item, i) => (
              <div key={item.heading} className="flex gap-4 bg-white border border-border rounded-xl p-6">
                <span className="w-8 h-8 rounded-full bg-cream flex items-center justify-center text-sm font-bold text-brown flex-shrink-0">{i + 1}</span>
                <div>
                  <p className="font-semibold text-ink text-sm">{item.heading}</p>
                  <p className="text-sm text-ink mt-1">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 max-w-3xl bg-cream/50 border border-border rounded-xl p-6">
            <p className="text-xs font-semibold text-brown uppercase tracking-widest mb-3">Decision Options</p>
            <div className="grid sm:grid-cols-2 gap-3">
              {[
                { decision: 'Accept', desc: 'Manuscript is ready for publication as submitted' },
                { decision: 'Minor Revision', desc: 'Small changes needed; does not require re-review' },
                { decision: 'Major Revision', desc: 'Substantial changes needed; will require re-review' },
                { decision: 'Reject', desc: 'Does not meet standards and cannot be improved through revision' },
              ].map((d) => (
                <div key={d.decision} className="bg-white border border-border rounded-lg p-3">
                  <p className="font-semibold text-ink text-sm">{d.decision}</p>
                  <p className="text-xs text-brown mt-0.5">{d.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ---- Tips ---- */}
        <section id="tips" className="mb-12 scroll-mt-24">
          <span className="section-label">Guidance</span>
          <h2 className="section-heading mb-5">Tips for Writing a Great Review</h2>

          <div className="space-y-3 max-w-3xl">
            {[
              { tip: 'Be specific.', example: 'Instead of "the discussion is weak," say "the discussion does not address the alternative diagnosis of X, which presents similarly."' },
              { tip: 'Be constructive.', example: 'Frame feedback as suggestions, not criticisms. "Consider adding a timeline figure" is better than "the chronology is confusing."' },
              { tip: 'Be respectful.', example: 'Remember that many authors are trainees submitting their first manuscript. Your feedback may shape their career in academic publishing.' },
              { tip: 'Separate your comments.', example: 'Comments to the editor (confidential) should be distinct from comments to the authors.' },
              { tip: 'Avoid rewriting.', example: 'Point out what needs improvement, but let the authors make the changes in their own voice.' },
            ].map((item) => (
              <div key={item.tip} className="bg-white border border-border rounded-xl p-5">
                <p className="text-sm text-ink leading-relaxed">
                  <span className="font-semibold">{item.tip}</span>{' '}{item.example}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* ---- Recognition ---- */}
        <section id="recognition" className="mb-12 scroll-mt-24">
          <span className="section-label">Benefits</span>
          <h2 className="section-heading mb-5">Reviewer Recognition</h2>
          <p className="text-sm text-ink mb-4 max-w-3xl">
            OSCRSJ values your contribution to the peer review process. Reviewers who complete reviews on time and provide high-quality feedback will receive:
          </p>
          <div className="grid sm:grid-cols-2 gap-4 max-w-3xl">
            {[
              { title: 'Annual Certificate', desc: 'Reviewer certificates for use in academic portfolios, CVs, and promotion applications.' },
              { title: 'Website Recognition', desc: 'Name listed on the annual reviewer acknowledgment page on the OSCRSJ website.' },
              { title: 'Editorial Opportunities', desc: 'Priority consideration for Associate Editor and Editorial Board positions.' },
              { title: 'CME Credit', desc: 'Continuing medical education credit for peer review activity (planned for Year 2).' },
            ].map((item) => (
              <div key={item.title} className="bg-cream border border-border rounded-xl p-5">
                <p className="font-semibold text-ink text-sm">{item.title}</p>
                <p className="text-xs text-ink mt-1">{item.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ---- CTA ---- */}
        <div className="bg-tan/20 border border-peach/30 rounded-xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <p className="font-semibold text-ink">Interested in reviewing for OSCRSJ?</p>
            <p className="text-sm text-brown mt-0.5">We are actively recruiting reviewers across all orthopedic subspecialties.</p>
          </div>
          <Link href="/for-reviewers/apply" className="btn-primary-light flex-shrink-0">
            Apply to Review
          </Link>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 mt-6">
          <Link href="/peer-review" className="btn-outline">Review Process Overview</Link>
          <Link href="/guide-for-authors" className="btn-outline">Guide for Authors</Link>
          <Link href="/contact" className="btn-outline">Contact Editorial Office</Link>
        </div>
      </div>
    </div>
  )
}
