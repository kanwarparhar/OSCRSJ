import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = { title: 'Guide for Authors' }

const sections = [
  {
    id: 'scope',
    title: 'Scope & Eligibility',
    content: `OSCRSJ publishes case reports and case series focused on orthopedic surgery and musculoskeletal medicine. Submissions must present novel, instructive, or clinically relevant cases. We accept work from medical students, residents, fellows, and attending surgeons worldwide.`,
  },
  {
    id: 'ethics',
    title: 'Ethical Requirements',
    content: `All submissions must include written patient consent for publication (or a statement that consent was obtained). Research involving human subjects must comply with the Declaration of Helsinki. Institutional review board (IRB) approval or exemption must be documented. All authors must disclose conflicts of interest.`,
  },
  {
    id: 'structure',
    title: 'Manuscript Structure',
    content: `Case Reports should follow this structure: Title, Abstract (structured: Introduction, Case Presentation, Discussion, Conclusion), Keywords (3–5), Introduction, Case Presentation, Discussion, Conclusion, Patient Consent Statement, Conflict of Interest Disclosure, References.\n\nCase Series follow the same structure with an expanded Discussion synthesizing findings across cases.`,
  },
  {
    id: 'formatting',
    title: 'Formatting Requirements',
    content: `File format: Microsoft Word (.docx). Font: Times New Roman or Arial, 12pt, double-spaced. Figures: TIFF or EPS, minimum 300 DPI, embedded in the document and submitted separately. Tables: in the manuscript file, not as images. Patient identifiers must be removed from all text and images.`,
  },
  {
    id: 'references',
    title: 'References',
    content: `Use Vancouver style (numbered, in order of appearance). Format: Author(s). Title. Journal abbreviation. Year;Volume(Issue):Pages. DOI. Example: Kim DH, Smith JA. Bilateral patellar tendon rupture after corticosteroid injection. J Orthop Case Rep. 2024;14(2):45–49. doi:10.13107/jocr.2024.v14.i02.3910`,
  },
  {
    id: 'images',
    title: 'Images & Figures',
    content: `Clinical photographs, radiographs, MRI, and CT images are encouraged. All images must have figure legends. Patient faces and identifying features must be masked or written consent for publication must be provided. Do not include patient names, MRN numbers, or other identifiers in image metadata.`,
  },
  {
    id: 'cover-letter',
    title: 'Cover Letter',
    content: `Your cover letter should: (1) state the article type and title, (2) briefly describe why the case is novel or instructive, (3) confirm all authors have contributed meaningfully, (4) confirm the work is original and not under review elsewhere, and (5) disclose any conflicts of interest.`,
  },
]

export default function GuideForAuthorsPage() {
  const faqData = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: 'What types of manuscripts does OSCRSJ accept?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'OSCRSJ publishes orthopedic surgery case reports and case series across all subspecialties including trauma, sports medicine, spine, hand, foot and ankle, arthroplasty, pediatric orthopedics, and oncology.',
        },
      },
      {
        '@type': 'Question',
        name: 'How long does peer review take at OSCRSJ?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'OSCRSJ targets a first decision within 30 days of submission. Our double-blind peer review process typically involves 2 independent reviewers.',
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
        <h1 className="font-serif text-3xl font-normal text-brown-dark">Guide for Authors</h1>
        <p className="text-tan mt-2">
          Everything you need to prepare and submit a manuscript to OSCRSJ.
        </p>
      </div>

      {/* Jump links */}
      <div className="bg-cream-alt border border-border rounded-xl p-5 mb-10">
        <p className="text-xs font-semibold text-tan uppercase tracking-widest mb-3">On This Page</p>
        <div className="flex flex-wrap gap-2">
          {sections.map((s) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              className="text-sm text-tan hover:text-brown transition-colors px-3 py-1.5 bg-cream border border-border rounded-full hover:border-peach"
            >
              {s.title}
            </a>
          ))}
        </div>
      </div>

      {/* Sections */}
      <div className="space-y-10">
        {sections.map((section) => (
          <section key={section.id} id={section.id} className="scroll-mt-24">
            <h2 className="font-serif text-xl font-normal text-brown-dark mb-3 pb-2 border-b border-border">
              {section.title}
            </h2>
            <div className="text-sm text-tan leading-relaxed whitespace-pre-line">
              {section.content}
            </div>
          </section>
        ))}
      </div>

      {/* CTA */}
      <div className="mt-14 bg-tan/20 border border-peach/30 rounded-xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <p className="font-semibold text-brown-dark">Ready to submit?</p>
          <p className="text-sm text-tan mt-0.5">Publishing is free through the end of 2026.</p>
        </div>
        <Link href="/submit" className="btn-primary flex-shrink-0">
          Submit a Manuscript →
        </Link>
      </div>
    </div>
  )
}
