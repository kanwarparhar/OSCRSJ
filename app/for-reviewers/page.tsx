import type { Metadata } from 'next'
import Link from 'next/link'
import PageHeader from '@/components/PageHeader'

export const metadata: Metadata = {
  title: 'Guide for Reviewers',
  description:
    'Guide for Reviewers at OSCRSJ. Standards, ethics, timeline, and review structure for peer reviewers of orthopedic case reports and case series. Reviews open with an overall comment and then walk the manuscript section by section with line-number citations.',
  alternates: { canonical: 'https://www.oscrsj.com/for-reviewers' },
  openGraph: {
    title: 'Guide for Reviewers | OSCRSJ',
    description:
      'Guide for Reviewers at OSCRSJ — standards, ethics, timeline, and the section-by-section review structure with line-number citations.',
    url: 'https://www.oscrsj.com/for-reviewers',
    type: 'website',
  },
}

export default function ForReviewersPage() {
  return (
    <div>
      <PageHeader
        label="For Reviewers"
        title="Guide for Reviewers"
        subtitle="Standards, ethics, and the review structure we expect at OSCRSJ."
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
              { step: '2', title: 'Detailed Assessment', desc: 'Re-read the manuscript section by section, evaluating clinical significance, novelty, methodology, ethical compliance, reporting quality, and clarity. Track line numbers as you go — every comment you make in your review should be tied to a specific line in the manuscript so the author knows exactly what you are referring to.' },
              { step: '3', title: 'Write Your Review', desc: 'Open with a general comment that captures your overall impression of the manuscript, then walk the paper section by section, citing line numbers for each issue. The structure below shows exactly what we expect in the Feedback and review field on the structured review form linked from your invitation email.' },
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
        </section>

        {/* ---- Review Structure ---- */}
        <section id="review-structure" className="mb-12 scroll-mt-24">
          <span className="section-label">Format</span>
          <h2 className="section-heading mb-5">Review Structure</h2>
          <p className="text-ink leading-relaxed mb-6 max-w-3xl">
            Every review at OSCRSJ follows the same two-part structure. Open with a general comment, then address every issue you raise section by section, citing the line number in the main manuscript. This format keeps the author oriented, makes the editor&rsquo;s decision letter easier to assemble, and ensures nothing gets lost in translation between reviewer notes and author revisions.
          </p>

          <div className="space-y-4 max-w-3xl">
            {/* Part 1 — Overall Comment */}
            <div className="bg-white border border-border rounded-xl p-6">
              <div className="flex items-start gap-4">
                <span className="w-8 h-8 rounded-full bg-peach/30 flex items-center justify-center text-sm font-bold text-brown-dark flex-shrink-0">
                  1
                </span>
                <div className="flex-1">
                  <p className="font-semibold text-ink text-sm">Overall Comment</p>
                  <p className="text-sm text-ink mt-1 leading-relaxed">
                    Open the review with one or two short paragraphs summarizing your overall impression of the manuscript before going into specifics. Briefly describe what the paper is about in your own words (this confirms to the editor that you read it carefully), state whether the case or series adds something useful to the orthopedic literature, and flag the headline strengths and weaknesses. Do not cite line numbers in the overall comment — that is what the section-by-section review is for.
                  </p>
                </div>
              </div>
            </div>

            {/* Part 2 — Section-by-Section */}
            <div className="bg-white border border-border rounded-xl p-6">
              <div className="flex items-start gap-4">
                <span className="w-8 h-8 rounded-full bg-peach/30 flex items-center justify-center text-sm font-bold text-brown-dark flex-shrink-0">
                  2
                </span>
                <div className="flex-1">
                  <p className="font-semibold text-ink text-sm">Section-by-Section Review (with line numbers)</p>
                  <p className="text-sm text-ink mt-1 mb-3 leading-relaxed">
                    After the overall comment, walk the manuscript section by section. Address every issue you raise under the section it appears in, and cite the specific line number in the main manuscript so the author can find it without guessing. Use the section headings the manuscript itself uses; if a section has no issues, write &ldquo;No issues.&rdquo; rather than skipping it.
                  </p>
                  <ul className="list-disc pl-5 space-y-1.5 text-sm text-ink leading-relaxed mb-3">
                    <li>Title and Abstract</li>
                    <li>Introduction</li>
                    <li>Case Presentation / Methods</li>
                    <li>Results / Outcomes</li>
                    <li>Discussion</li>
                    <li>References</li>
                    <li>Figures and Tables</li>
                  </ul>
                  <div className="bg-cream-alt/60 border border-border rounded-lg p-4">
                    <p className="text-xs font-semibold text-brown uppercase tracking-widest mb-2">Example</p>
                    <p className="text-sm text-ink leading-relaxed font-mono">
                      <span className="font-semibold not-italic">Introduction</span>
                      <br />
                      Line 42: The cited incidence rate (1 in 100,000) is from a 2008 epidemiology paper; the 2021 update from Smith et al. revises this to 1 in 60,000. Please update.
                      <br />
                      Line 58: This sentence implies causation where the underlying study only demonstrated correlation. Suggest softening to &ldquo;associated with.&rdquo;
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <p className="text-sm text-ink/80 mt-4 max-w-3xl italic">
            Your recommendation and the conflict-of-interest declaration are collected as separate fields on the structured review form — you do not need to repeat them in the Feedback and review text.
          </p>
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
