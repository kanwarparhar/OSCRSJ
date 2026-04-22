import type { Metadata } from 'next'
import Link from 'next/link'
import PageHeader from '@/components/PageHeader'

export const metadata: Metadata = {
  title: 'Article Types',
  description: 'Types of manuscripts accepted by OSCRSJ: case reports, case series, images in orthopedics, and surgical techniques.',
}

const articleTypes = [
  {
    type: 'Case Report',
    wordLimit: '2,000–3,000 words',
    abstract: 'Structured, 250 words max',
    figures: 'Up to 6 figures/tables',
    references: 'Up to 25',
    guideline: 'CARE Guidelines',
    description: 'A detailed report of a single patient case that is novel, instructive, or educationally valuable. Case reports should present unusual presentations, unexpected diagnoses, rare conditions, or new approaches to treatment.',
    structure: ['Structured Abstract', 'Introduction', 'Case Presentation', 'Clinical Findings', 'Diagnosis & Assessment', 'Therapeutic Intervention', 'Follow-up & Outcomes', 'Discussion', 'Learning Points', 'Patient Consent Statement'],
  },
  {
    type: 'Case Series',
    wordLimit: '3,000–4,500 words',
    abstract: 'Structured, 300 words max',
    figures: 'Up to 10 figures/tables',
    references: 'Up to 40',
    guideline: 'PROCESS Guidelines',
    description: 'A report of 3 or more related cases sharing common features, analyzed collectively to identify patterns, outcomes, or clinical insights. Case series provide a higher level of evidence than individual case reports.',
    structure: ['Structured Abstract', 'Introduction', 'Methods (case selection criteria)', 'Case Presentations', 'Results & Synthesis', 'Discussion', 'Conclusion', 'Patient Consent Statement'],
  },
  {
    type: 'Images in Orthopedics',
    wordLimit: '500–1,000 words',
    abstract: 'Not required',
    figures: 'Up to 4 high-resolution images (minimum 300 DPI)',
    references: 'Up to 10',
    guideline: 'OSCRSJ Format',
    description: 'Striking or educational radiographic, intraoperative, or clinical images that illustrate key orthopedic concepts, rare findings, or diagnostic challenges. The images are the central element of the submission.',
    structure: ['Brief Clinical History', 'Image Descriptions with Annotations', 'Diagnosis', 'Key Learning Points'],
  },
  {
    type: 'Surgical Technique',
    wordLimit: '2,500–4,000 words',
    abstract: 'Unstructured, 250 words max',
    figures: 'Up to 8 figures/tables (step-by-step images preferred)',
    references: 'Up to 30',
    guideline: 'OSCRSJ Format',
    description: 'A step-by-step description of a novel or modified surgical technique with indications, technical pearls, pitfalls to avoid, and outcomes data. High-quality intraoperative images or illustrations are essential.',
    structure: ['Abstract', 'Introduction & Indications', 'Surgical Technique (step-by-step)', 'Pearls & Pitfalls', 'Outcomes & Complications', 'Discussion'],
  },
]

export default function ArticleTypesPage() {
  return (
    <div>
      <PageHeader
        label="For Authors"
        title="Article Types"
        subtitle="Understand what we publish and the requirements for each manuscript type."
      />

      <div className="max-w-content mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <div className="space-y-8">
          {articleTypes.map((t) => (
            <section key={t.type} className="bg-white border border-border rounded-xl p-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                <h2 className="font-serif text-xl font-normal text-brown-dark">{t.type}</h2>
                <span className="text-xs font-medium text-brown bg-tan/20 px-3 py-1 rounded-full">{t.guideline}</span>
              </div>
              <p className="text-sm text-ink leading-relaxed mb-5">{t.description}</p>

              {/* Specs grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
                {[
                  { label: 'Word Limit', value: t.wordLimit },
                  { label: 'Abstract', value: t.abstract },
                  { label: 'Figures', value: t.figures },
                  { label: 'References', value: t.references },
                ].map((spec) => (
                  <div key={spec.label} className="bg-cream rounded-lg p-3">
                    <p className="text-xs text-brown uppercase tracking-wider font-medium">{spec.label}</p>
                    <p className="text-sm text-ink mt-0.5">{spec.value}</p>
                  </div>
                ))}
              </div>

              {/* Structure */}
              <div>
                <p className="text-xs font-semibold text-brown uppercase tracking-widest mb-2">Required Structure</p>
                <div className="flex flex-wrap gap-2">
                  {t.structure.map((s) => (
                    <span key={s} className="text-xs text-brown bg-cream px-2.5 py-1 rounded-full">{s}</span>
                  ))}
                </div>
              </div>
            </section>
          ))}
        </div>

        {/* CTA */}
        <div className="mt-12 flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/templates" className="btn-primary-light">Download Templates</Link>
          <Link href="/guide-for-authors" className="btn-outline">Full Author Guidelines</Link>
          <Link href="/submit" className="btn-outline">Submit a Manuscript</Link>
        </div>
      </div>
    </div>
  )
}
