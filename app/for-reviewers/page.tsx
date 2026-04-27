import type { Metadata } from 'next'
import Link from 'next/link'
import PageHeader from '@/components/PageHeader'

export const metadata: Metadata = {
  title: 'For Reviewers - OSCRSJ',
  description: 'Reviewer guidelines for OSCRSJ. Standards, expectations, timeline, and ethics for peer reviewers of orthopedic case reports and case series.',
}

export default function ForReviewersPage() {
  return (
    <div>
      <PageHeader
        label="For Reviewers"
        title="Reviewer Guidelines"
        subtitle="Standards, expectations, and ethics for peer reviewers at OSCRSJ."
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
            OSCRSJ publishes work from across the global orthopedic surgery community, from first-time student authors to established researchers. Your review shapes the quality of the literature and the development of every author you evaluate.
          </p>
        </section>

        {/* ---- AI Prohibition ---- */}
        <section id="ai-prohibition" className="mb-12 scroll-mt-24">
          <div className="border-2 border-brown-dark/30 bg-white rounded-2xl p-8">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-brown-dark/10 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-brown-dark" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <span className="section-label">Strict Prohibition</span>
                <h2 className="section-heading mb-3">No AI-Generated Reviews</h2>
                <p className="text-ink leading-relaxed mb-3">
                  <strong>The use of large language models, generative AI tools, or any automated review-writing assistance is strictly prohibited at OSCRSJ.</strong> This includes ChatGPT, Claude, Gemini, Perplexity, and any other AI system, whether used to generate reviewer comments, summarize the manuscript, draft the recommendation, or paraphrase your own notes.
                </p>
                <p className="text-ink leading-relaxed mb-3">
                  Reasons: (1) confidentiality — uploading any portion of an unpublished manuscript to a third-party AI service is a breach of the confidentiality agreement you accept when invited to review; (2) accountability — peer review at OSCRSJ is a human judgment by a qualified domain expert, and AI-generated text bypasses the qualifications that earned you the invitation; (3) integrity — automated reviews cannot reliably identify subtle clinical errors, ethical concerns, or methodological flaws that an experienced orthopedic surgeon recognizes immediately.
                </p>
                <p className="text-ink leading-relaxed">
                  Reviews suspected of AI generation will be discarded, the reviewer will be removed from the OSCRSJ reviewer pool, and the relevant institutional and professional bodies may be notified. If you cannot complete the review yourself, decline the invitation and suggest an alternative reviewer.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ---- Confidentiality & Ethics ---- */}
        <section id="ethics" className="mb-12 scroll-mt-24">
          <span className="section-label">Ethics</span>
          <h2 className="section-heading mb-5">Confidentiality and Ethics</h2>
          <div className="space-y-3 max-w-3xl">
            {[
              'All manuscripts are confidential. Do not share, discuss, or distribute any manuscript under review — including with AI tools (see prohibition above).',
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
              { label: 'Complete Your Review', time: '21 days', desc: 'From the date you accept the invitation' },
              { label: 'Extension Available', time: 'Up to 7 days', desc: 'Contact the editorial office before your deadline' },
            ].map((item) => (
              <div key={item.label} className="bg-cream-alt border border-border rounded-xl p-5 text-center">
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
              { step: '2', title: 'Detailed Assessment', desc: 'Re-read the manuscript section by section, evaluating clinical significance, novelty, methodology, ethical compliance, reporting quality, and clarity. Take notes on strengths and weaknesses, originality, readability, and overall structure.' },
              { step: '3', title: 'Use the OSCRSJ Reviewer Template as Your Guide', desc: 'Download the OSCRSJ Reviewer Template (Word document — see below) and use it as a scaffold for organizing your thinking. It walks you through the structure of a strong review (summary, major comments, minor comments, recommendation), section-by-section evaluation prompts, and guidance tips. When you are ready to submit, paste your completed review into the Feedback and review field on the structured review form linked from your invitation email — reviews are submitted through the form, not as a Word document upload.' },
            ].map((item) => (
              <div key={item.step} className="flex gap-4 bg-white border border-border rounded-xl p-6">
                <span className="w-8 h-8 rounded-full bg-cream-alt flex items-center justify-center text-sm font-bold text-brown flex-shrink-0">
                  {item.step}
                </span>
                <div>
                  <p className="font-semibold text-ink text-sm">{item.title}</p>
                  <p className="text-sm text-ink mt-1">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Reviewer Template download */}
          <div className="mt-6 max-w-3xl bg-cream-alt/50 border border-peach/30 rounded-xl p-6">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-peach/30 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-brown-dark" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
              </div>
              <div className="flex-1">
                <p className="font-semibold text-ink text-sm">OSCRSJ Reviewer Template (Word document)</p>
                <p className="text-xs text-ink/80 mt-1 mb-3">
                  Recommended scaffold for every review. Walks through the review structure, section-by-section evaluation prompts, decision categories, and guidance tips. Use it to organize your thinking, then paste the completed review into the Feedback and review field on the structured review form.
                </p>
                <a
                  href="/downloads/oscrsj-reviewer-template.docx"
                  download
                  className="inline-flex items-center gap-2 text-sm font-medium text-brown-dark hover:text-brown underline underline-offset-2"
                >
                  Download Template (.docx)
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                </a>
              </div>
            </div>
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
              <div key={item.title} className="bg-cream-alt border border-border rounded-xl p-5">
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
