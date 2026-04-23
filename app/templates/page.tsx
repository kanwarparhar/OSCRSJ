import type { Metadata } from 'next'
import Link from 'next/link'
import PageHeader from '@/components/PageHeader'

export const metadata: Metadata = {
  title: 'Case Report Templates',
  description: 'Download manuscript templates for OSCRSJ case reports, case series, and images in orthopedics.',
}

const templates = [
  {
    type: 'Case Report',
    guideline: 'CARE Guidelines',
    wordLimit: '2,000–3,000 words',
    sections: ['Title Page', 'Structured Abstract', 'Introduction', 'Case Presentation', 'Clinical Findings', 'Diagnosis', 'Treatment', 'Outcomes', 'Discussion', 'Learning Points', 'Patient Consent', 'References'],
    description: 'For reporting a single patient case with novel, instructive, or educational value. Follow the CARE (CAse REport) guidelines for completeness and transparency.',
  },
  {
    type: 'Case Series',
    guideline: 'PROCESS Guidelines',
    wordLimit: '3,000–4,500 words',
    sections: ['Title Page', 'Structured Abstract', 'Introduction', 'Methods', 'Case Presentations', 'Results & Synthesis', 'Discussion', 'Conclusion', 'Patient Consent', 'References'],
    description: 'For reporting 3 or more related cases analyzed collectively. Follow the PROCESS (Preferred Reporting Of CasE Series in Surgery) guidelines.',
  },
  {
    type: 'Images in Orthopedics',
    guideline: 'OSCRSJ Format',
    wordLimit: '500–1,000 words',
    sections: ['Title Page', 'Brief Clinical History', 'Image Description', 'Diagnosis', 'Key Learning Points', 'References'],
    description: 'For striking radiographic, intraoperative, or clinical images with educational value. High-resolution images required (minimum 300 DPI).',
  },
  {
    type: 'Surgical Technique',
    guideline: 'OSCRSJ Format',
    wordLimit: '2,500–4,000 words',
    sections: ['Title Page', 'Abstract', 'Introduction', 'Indications', 'Surgical Technique', 'Pearls & Pitfalls', 'Outcomes', 'Discussion', 'References'],
    description: 'For describing a novel or modified surgical technique with step-by-step instructions, intraoperative images, and outcomes data.',
  },
]

export default function TemplatesPage() {
  return (
    <div>
      <PageHeader
        label="For Authors"
        title="Case Report Templates"
        subtitle="Download structured templates to prepare your manuscript for submission to OSCRSJ."
      />

      <div className="max-w-content mx-auto px-4 sm:px-6 lg:px-8 py-20">
        {/* Intro */}
        <div className="bg-gradient-to-br from-tan/10 to-cream-alt border border-peach/20 rounded-2xl p-8 mb-12">
          <p className="text-ink leading-relaxed">
            Using our templates ensures your manuscript meets OSCRSJ formatting requirements and follows established reporting guidelines. Each template includes all required sections, formatting instructions, and checklists. Templates are available in Microsoft Word (.docx) format.
          </p>
        </div>

        {/* Template cards */}
        <div className="space-y-6 mb-12">
          {templates.map((t) => (
            <div key={t.type} className="bg-white border border-border rounded-xl p-6 hover:border-tan hover:shadow-sm transition-all duration-200">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-4">
                <div>
                  <h2 className="font-serif text-xl font-normal text-brown-dark">{t.type}</h2>
                  <div className="flex flex-wrap gap-2 mt-2">
                    <span className="text-xs font-medium text-brown bg-tan/20 px-2.5 py-1 rounded-full">{t.guideline}</span>
                    <span className="text-xs text-brown bg-cream px-2.5 py-1 rounded-full">{t.wordLimit}</span>
                  </div>
                </div>
                <span className="btn-primary-light text-center cursor-default opacity-60">
                  Template Coming Soon
                </span>
              </div>
              <p className="text-sm text-ink leading-relaxed mb-4">{t.description}</p>
              <div>
                <p className="text-xs font-semibold text-brown uppercase tracking-widest mb-2">Required Sections</p>
                <div className="flex flex-wrap gap-2">
                  {t.sections.map((s) => (
                    <span key={s} className="text-xs text-brown bg-cream px-2.5 py-1 rounded-full">{s}</span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="bg-tan/20 border border-peach/30 rounded-xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
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
