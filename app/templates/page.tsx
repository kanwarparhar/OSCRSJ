import type { Metadata } from 'next'
import Link from 'next/link'
import PageHeader from '@/components/PageHeader'

export const metadata: Metadata = {
  title: 'Manuscript Templates',
  description: 'Download the OSCRSJ author manuscript template (Word .docx). Pre-styled, encodes our submission requirements, and gives you a clean Pandoc round-trip to PDF.',
}

const templates = [
  {
    type: 'Case Report',
    guideline: 'CARE Guidelines',
    wordLimit: '2,000–3,000 words',
    sections: ['Title Page', 'Structured Abstract', 'Introduction', 'Case Presentation', 'Clinical Findings', 'Diagnosis', 'Treatment', 'Outcomes', 'Discussion', 'Learning Points', 'Patient Consent', 'References'],
    description: 'For reporting a single patient case with novel, instructive, or educational value. Follow the CARE (CAse REport) guidelines for completeness and transparency.',
    available: true,
  },
  {
    type: 'Case Series',
    guideline: 'JBI Critical Appraisal',
    wordLimit: '3,000–4,500 words',
    sections: ['Title Page', 'Structured Abstract', 'Introduction', 'Methods', 'Case Presentations', 'Results & Synthesis', 'Discussion', 'Conclusion', 'Patient Consent', 'References'],
    description: 'For reporting four or more related cases analyzed collectively. Follow the JBI critical appraisal checklist for case series.',
    available: false,
  },
  {
    type: 'Images in Orthopedics',
    guideline: 'OSCRSJ Format',
    wordLimit: '500–1,000 words',
    sections: ['Title Page', 'Brief Clinical History', 'Image Description', 'Diagnosis', 'Key Learning Points', 'References'],
    description: 'For striking radiographic, intraoperative, or clinical images with educational value. High-resolution images required (minimum 300 DPI).',
    available: false,
  },
  {
    type: 'Surgical Technique',
    guideline: 'OSCRSJ Format',
    wordLimit: '2,500–4,000 words',
    sections: ['Title Page', 'Abstract', 'Introduction', 'Indications', 'Surgical Technique', 'Pearls & Pitfalls', 'Outcomes', 'Discussion', 'References'],
    description: 'For describing a novel or modified surgical technique with step-by-step instructions, intraoperative images, and outcomes data.',
    available: false,
  },
]

export default function TemplatesPage() {
  return (
    <div>
      <PageHeader
        label="For Authors"
        title="Manuscript Templates"
        subtitle="Download structured templates to prepare your manuscript for submission to OSCRSJ."
      />

      <div className="max-w-content mx-auto px-4 sm:px-6 lg:px-8 py-20">
        {/* Featured: the case-report Word template (shipped 2026-04-25) */}
        <section className="mb-12">
          <div className="bg-white border-2 border-peach-dark/40 rounded-2xl p-8 sm:p-10 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-6 mb-6">
              <div className="flex-1">
                <p className="text-xs font-semibold text-brown uppercase tracking-widest mb-2">Recommended for every submission</p>
                <h2 className="font-serif text-3xl text-brown-dark mb-3">OSCRSJ Author Manuscript Template</h2>
                <p className="text-ink leading-relaxed mb-4">
                  A pre-styled Word document that encodes OSCRSJ's submission requirements as named paragraph styles. Using this template instead of a blank document is the single biggest thing you can do to make your manuscript move quickly through editorial review — your file converts cleanly to our published-PDF format with minimal hand cleanup, which means a faster decision and a faster publication.
                </p>
              </div>
              <div className="flex-shrink-0 flex flex-col gap-2">
                <a
                  href="/downloads/oscrsj-manuscript-template.docx"
                  download
                  className="btn-primary-light text-center inline-block"
                >
                  Download Template (.docx)
                </a>
                <p className="text-xs text-brown text-center">Word 2016+ · Google Docs · Pages · LibreOffice</p>
                <p className="text-xs text-brown text-center">~46 KB · macro-free</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
              <div className="bg-cream-alt/60 rounded-xl p-5">
                <p className="text-xs font-semibold text-brown uppercase tracking-widest mb-3">What's inside</p>
                <ul className="space-y-2 text-sm text-ink">
                  <li>· Title block, structured abstract, and keyword line</li>
                  <li>· Worked-example case report demonstrating every section</li>
                  <li>· Eleven named paragraph styles (Heading 1–4, Figure Caption, Table Caption, Block Quote, Patient Consent Statement, plus body styles)</li>
                  <li>· Seven declarations sections (Funding, COI, Patient Consent with all five variants, IRB / Ethics, Data Availability, CRediT, AI Disclosure)</li>
                  <li>· Three worked-example Vancouver references with DOI URLs</li>
                  <li>· Verbatim CC BY-NC-ND 4.0 license clause</li>
                </ul>
              </div>
              <div className="bg-cream-alt/60 rounded-xl p-5">
                <p className="text-xs font-semibold text-brown uppercase tracking-widest mb-3">How to use it</p>
                <ol className="space-y-2 text-sm text-ink list-none">
                  <li><strong>1.</strong> Download and save a copy under your manuscript title.</li>
                  <li><strong>2.</strong> Read the cover-page checklist — it lists every constraint the submission portal will check at upload.</li>
                  <li><strong>3.</strong> Replace each <code className="text-xs bg-white px-1 rounded">[REPLACE WITH YOUR CONTENT]</code> marker with your text.</li>
                  <li><strong>4.</strong> Delete every <code className="text-xs bg-white px-1 rounded">[INSTRUCTIONS — DELETE BEFORE SUBMISSION]</code> block.</li>
                  <li><strong>5.</strong> Use the styles already in the Style Pane — do not introduce your own.</li>
                  <li><strong>6.</strong> Submit via the <Link href="/dashboard/submit" className="text-brown-dark underline hover:text-brown">submission portal</Link>.</li>
                </ol>
              </div>
            </div>

            <div className="mt-6 pt-6 border-t border-border">
              <p className="text-xs text-brown leading-relaxed">
                <strong className="text-brown-dark">Why a template at all?</strong> OSCRSJ converts your Word file to a peer-reviewed PDF using a Pandoc-driven pipeline. Free-form Word documents take an editor 30–45 minutes per article to clean up; manuscripts authored against this template take under 10. That difference compounds across every issue we publish — and shows up in the polish of the final article. The template is the path of least resistance for both you and us.
              </p>
            </div>
          </div>
        </section>

        {/* Article-type matrix */}
        <section className="mb-12">
          <h2 className="font-serif text-2xl text-brown-dark mb-2">All Article Types</h2>
          <p className="text-sm text-brown mb-6">The case-report template above also serves as the structural reference for our other accepted article types. Type-specific templates are in development; until they ship, use the case-report template and adapt the section headings per the article-type guidelines below.</p>

          <div className="space-y-4">
            {templates.map((t) => (
              <div key={t.type} className="bg-white border border-border rounded-xl p-6 hover:border-tan hover:shadow-sm transition-all duration-200">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-4">
                  <div>
                    <h3 className="font-serif text-xl text-brown-dark">{t.type}</h3>
                    <div className="flex flex-wrap gap-2 mt-2">
                      <span className="text-xs font-medium text-brown bg-tan/20 px-2.5 py-1 rounded-full">{t.guideline}</span>
                      <span className="text-xs text-brown bg-cream-alt px-2.5 py-1 rounded-full">{t.wordLimit}</span>
                    </div>
                  </div>
                  {t.available ? (
                    <a
                      href="/downloads/oscrsj-manuscript-template.docx"
                      download
                      className="btn-primary-light text-center flex-shrink-0"
                    >
                      Download (.docx)
                    </a>
                  ) : (
                    <span className="btn-primary-light text-center cursor-default opacity-60 flex-shrink-0">
                      Type-specific template in progress
                    </span>
                  )}
                </div>
                <p className="text-sm text-ink leading-relaxed mb-4">{t.description}</p>
                <div>
                  <p className="text-xs font-semibold text-brown uppercase tracking-widest mb-2">Required Sections</p>
                  <div className="flex flex-wrap gap-2">
                    {t.sections.map((s) => (
                      <span key={s} className="text-xs text-brown bg-cream-alt px-2.5 py-1 rounded-full">{s}</span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <div className="bg-cream-alt border border-peach/30 rounded-xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <p className="font-semibold text-ink">Need help preparing your manuscript?</p>
            <p className="text-sm text-brown mt-0.5">Review our full author guidelines for detailed formatting and content requirements.</p>
          </div>
          <Link href="/guide-for-authors" className="btn-primary-light flex-shrink-0">
            Guide for Authors →
          </Link>
        </div>
      </div>
    </div>
  )
}
