import type { Metadata } from 'next'
import Link from 'next/link'
import PageHeader from '@/components/PageHeader'

export const metadata: Metadata = {
  title: 'Guide for Authors - OSCRSJ',
  description: 'Complete author guidelines for submitting case reports, case series, surgical techniques, and more to the Orthopedic Surgery Case Reports & Series Journal.',
}

/* ------------------------------------------------------------------ */
/*  Article‑type specs                                                 */
/* ------------------------------------------------------------------ */

const articleTypes = [
  {
    id: 'case-report',
    label: 'Case Report',
    tagline: '1-3 patients',
    definition:
      'A detailed account of the diagnosis, treatment, and outcome of a medical condition in one to three patients. Case reports at OSCRSJ should present novel, rare, or instructive orthopedic cases that contribute meaningfully to clinical knowledge.',
    specs: [
      { label: 'Word Limit', value: '2,000 words (excluding abstract, references, figure legends, and tables)' },
      { label: 'Abstract', value: '300 words maximum, structured (Introduction, Case Presentation, Discussion, Conclusion)' },
      { label: 'Keywords', value: '3-5 MeSH terms' },
      { label: 'Figures', value: 'Maximum 8 (clinical photos, radiographs, MRI, CT, intraoperative)' },
      { label: 'Tables', value: 'Maximum 3' },
      { label: 'References', value: '10-25 in Vancouver style' },
      { label: 'Required Checklist', value: 'CARE checklist (mandatory, submit as supplementary file)' },
      { label: 'Review Timeline', value: 'Target first decision within 2-3 weeks' },
    ],
    sections: [
      'Title Page: full title (max 20 words), running title (max 50 characters), all author names with affiliations and ORCID IDs, corresponding author email',
      'Abstract: structured into Introduction (why this case matters), Case Presentation (demographics, history, exam, investigations, treatment), Discussion (how findings relate to literature), Conclusion (key learning point)',
      'Keywords: 3-5 MeSH terms',
      'Introduction: clinical context, brief literature background, why this case is novel or instructive (150-250 words)',
      'Case Presentation: patient demographics (age, sex), chief complaint, history of present illness, past medical/surgical history, physical examination findings, diagnostic workup (labs, imaging, pathology), treatment/surgical intervention with technique details, postoperative course, complications, follow-up and outcome',
      'Discussion: comparison with existing literature, pathophysiology review, differential diagnoses considered, why the chosen management was appropriate, limitations of the report',
      'Conclusion: 1-2 key clinical takeaways',
      'Patient Consent Statement',
      'Conflict of Interest Disclosure',
      'Acknowledgments (optional)',
      'References',
      'Figure Legends',
    ],
  },
  {
    id: 'case-series',
    label: 'Case Series',
    tagline: '4+ patients',
    definition:
      'A descriptive study reporting on the clinical details and outcomes of four or more patients with a similar diagnosis, treatment, or outcome. Case series at OSCRSJ should identify patterns, outcomes, or complications across multiple cases that contribute to clinical decision-making in orthopedic surgery.',
    specs: [
      { label: 'Word Limit', value: '3,000 words (excluding abstract, references, figure legends, and tables)' },
      { label: 'Abstract', value: '350 words maximum, structured (Background, Methods, Results, Discussion, Conclusion)' },
      { label: 'Keywords', value: '3-6 MeSH terms' },
      { label: 'Figures', value: 'Maximum 10' },
      { label: 'Tables', value: 'Maximum 5 (patient demographics/summary table strongly recommended)' },
      { label: 'References', value: '15-40 in Vancouver style' },
      { label: 'Required Checklist', value: 'JBI Critical Appraisal Checklist for Case Series (mandatory)' },
      { label: 'IRB', value: 'IRB approval or exemption statement required' },
      { label: 'Review Timeline', value: 'Target first decision within 3-4 weeks' },
    ],
    sections: [
      'Title Page: same format as Case Reports',
      'Abstract: structured into Background (context and rationale), Methods (patient selection, data collection), Results (key findings), Discussion (interpretation), Conclusion (clinical implications)',
      'Keywords: 3-6 MeSH terms',
      'Introduction: clinical context, gap in literature, purpose of the series (200-300 words)',
      'Methods: patient selection criteria (inclusion/exclusion), time period, data collection methods, outcome measures, ethical approvals/consent',
      'Results: patient demographics table, case-by-case or aggregated findings, clinical outcomes, complications, follow-up duration',
      'Discussion: synthesis of findings across cases, comparison with published literature, clinical implications, strengths and limitations',
      'Conclusion: summary of key findings and recommendations for practice',
      'Patient Consent Statement, Conflict of Interest Disclosure, Acknowledgments',
      'References',
      'Figure Legends and Appendices (if applicable)',
    ],
  },
  {
    id: 'surgical-technique',
    label: 'Surgical Technique',
    tagline: 'Step-by-step procedural',
    definition:
      'Presents a new, modified, or improved operative technique with step-by-step description, illustrated with intraoperative photographs or diagrams. The technique should offer a clear advantage over existing approaches in terms of outcomes, efficiency, reproducibility, or safety.',
    specs: [
      { label: 'Word Limit', value: '1,500 words (excluding abstract, references, figure legends, tables)' },
      { label: 'Abstract', value: '200 words maximum, unstructured' },
      { label: 'Keywords', value: '3-5 MeSH terms' },
      { label: 'Figures', value: 'Minimum 4, maximum 10 (this is a visually-driven article type)' },
      { label: 'Tables', value: 'Maximum 2' },
      { label: 'References', value: '8-15 in Vancouver style' },
      { label: 'Supplementary', value: 'Video links (YouTube or similar) are strongly encouraged' },
      { label: 'Review Timeline', value: 'Target first decision within 2-3 weeks' },
    ],
    sections: [
      'Title Page: same format as Case Reports',
      'Abstract: brief unstructured summary of the technique and its advantage',
      'Introduction: clinical problem addressed, limitations of current techniques, rationale for the new/modified approach (150-200 words)',
      'Surgical Technique: step-by-step procedural description including patient positioning, approach, instruments required, key steps with intraoperative photos/diagrams, closure, and postoperative protocol. Use numbered steps for clarity.',
      'Discussion: advantages over existing techniques, potential limitations, learning curve, tips and pitfalls (200-400 words)',
      'Conclusion: when to consider this technique',
      'References',
      'Figure Legends',
    ],
  },
  {
    id: 'images-in-orthopedics',
    label: 'Images in Orthopedics',
    tagline: 'Image-focused, brief',
    definition:
      'A brief, image-focused article that presents one or more striking clinical, radiographic, or intraoperative images with a concise clinical description. The image(s) should be visually compelling and educationally valuable. This is an ideal format for medical students and junior residents.',
    specs: [
      { label: 'Word Limit', value: '500 words total' },
      { label: 'Abstract', value: 'Not required' },
      { label: 'Keywords', value: '3 keywords' },
      { label: 'Images', value: '1-4 images (this is the primary content). Minimum 300 DPI, 600 DPI recommended.' },
      { label: 'Tables', value: 'None' },
      { label: 'References', value: 'Maximum 5' },
      { label: 'Review Timeline', value: 'Expedited: target 7-10 days' },
    ],
    sections: [
      'Title: descriptive, hints at the diagnosis or finding (max 15 words)',
      'Clinical Description: brief clinical context including patient demographics, presenting complaint, key findings, diagnosis (300-500 words)',
      'Teaching Point: 1-2 sentences on the clinical learning point',
      'Patient Consent Statement',
      'References',
    ],
  },
  {
    id: 'letter-to-editor',
    label: 'Letter to the Editor',
    tagline: 'Commentary on published work',
    definition:
      'Allows readers to comment on published OSCRSJ articles, present brief preliminary observations, or raise important clinical questions. The original article authors will be invited to submit a response. Both letter and response are published together.',
    specs: [
      { label: 'Word Limit', value: '600 words' },
      { label: 'Abstract', value: 'Not required' },
      { label: 'Figures/Tables', value: 'Maximum 1 figure or 1 table' },
      { label: 'References', value: 'Maximum 5' },
      { label: 'Review Timeline', value: 'Target 1-2 weeks' },
    ],
    sections: [
      'No formal section headings required',
      'Must reference the specific OSCRSJ article being discussed (by DOI)',
      'State the point of agreement or disagreement with supporting evidence or reasoning',
    ],
  },
  {
    id: 'review-article',
    label: 'Review Article',
    tagline: 'Invited only (Year 1)',
    definition:
      'Comprehensive reviews of a focused topic in orthopedic surgery. During Year 1, review articles are accepted by editorial invitation only. Open submissions will begin in Year 2 after OSCRSJ establishes its credibility and indexing milestones.',
    specs: [
      { label: 'Word Limit', value: '3,500 words' },
      { label: 'Abstract', value: '350 words maximum, structured (Background, Methods, Results, Conclusion)' },
      { label: 'Keywords', value: '3-6 MeSH terms' },
      { label: 'Figures', value: 'Maximum 6' },
      { label: 'Tables', value: 'Maximum 4' },
      { label: 'References', value: '20-60 in Vancouver style' },
      { label: 'Reporting Guideline', value: 'PRISMA checklist recommended for systematic reviews' },
      { label: 'Submission', value: 'By editorial invitation only during Year 1' },
      { label: 'Review Timeline', value: 'Target first decision within 4-6 weeks' },
    ],
    sections: [
      'Title Page: same format as Case Reports',
      'Abstract: structured into Background, Methods, Results, Conclusion',
      'Introduction: clinical context, why this review is needed',
      'Methods: search strategy, databases searched, inclusion/exclusion criteria, date range',
      'Results: organized by theme or chronology',
      'Discussion: synthesis, clinical implications, gaps in current knowledge',
      'Conclusion: key findings and future directions',
      'References',
    ],
  },
]

/* ------------------------------------------------------------------ */
/*  Quick-reference comparison table                                   */
/* ------------------------------------------------------------------ */

const comparisonRows = [
  { param: 'Word Limit', values: ['2,000', '3,000', '1,500', '500', '600', '3,500'] },
  { param: 'Abstract', values: ['300 (structured)', '350 (structured)', '200 (unstructured)', 'None', 'None', '350 (structured)'] },
  { param: 'Max Figures', values: ['8', '10', '10', '4', '1', '6'] },
  { param: 'Max Tables', values: ['3', '5', '2', '0', '1', '4'] },
  { param: 'References', values: ['10-25', '15-40', '8-15', 'Max 5', 'Max 5', '20-60'] },
  { param: 'Checklist', values: ['CARE', 'JBI', 'N/A', 'N/A', 'N/A', 'PRISMA rec.'] },
  { param: 'Review Target', values: ['2-3 wk', '3-4 wk', '2-3 wk', '7-10 d', '1-2 wk', '4-6 wk'] },
]

/* ------------------------------------------------------------------ */
/*  General formatting & ethics (shared)                               */
/* ------------------------------------------------------------------ */

const generalSections = [
  {
    id: 'formatting',
    label: 'Formatting',
    title: 'Formatting Requirements',
    items: [
      'File Format: Microsoft Word (.docx)',
      'Font: Times New Roman or Arial, 12-point',
      'Spacing: double-spaced throughout',
      'Line Numbers: continuous line numbering required',
      'Margins: 1 inch (2.54 cm) on all sides',
      'Page Numbers: bottom center of each page',
      'Figures: submit as separate high-resolution files (TIFF, PNG, or JPEG, minimum 300 DPI) in addition to embedding in the manuscript. All patient identifiers must be removed. Faces must be masked unless explicit consent is provided. Use arrows or annotations to highlight pathology.',
      'Tables: editable tables within the manuscript file (not images)',
    ],
  },
  {
    id: 'references',
    label: 'References',
    title: 'Reference Format (Vancouver Style)',
    items: [
      'Number references consecutively in order of first citation',
      'Use square brackets in text, e.g. [1]',
      'Journal names should be abbreviated per Index Medicus',
    ],
    example:
      'Kim DH, Smith JA. Bilateral patellar tendon rupture after corticosteroid injection: a case report. J Orthop Case Rep. 2024;14(2):45-49. doi:10.13107/jocr.2024.v14.i02.3910',
  },
  {
    id: 'ethics',
    label: 'Ethics',
    title: 'Ethical Requirements',
    items: [
      'Written patient consent for publication is required for all case-based submissions. You may use your institution\'s consent form or the OSCRSJ consent template.',
      'Research involving human subjects must comply with the Declaration of Helsinki.',
      'IRB approval or exemption must be documented for case series and review articles.',
      'All authors must disclose conflicts of interest.',
      'CARE checklist is mandatory for case reports. JBI checklist is mandatory for case series.',
    ],
  },
  {
    id: 'cover-letter',
    label: 'Cover Letter',
    title: 'Cover Letter',
    items: [
      'State the article type and title',
      'Briefly describe why the case is novel or instructive',
      'Confirm all authors have contributed meaningfully',
      'Confirm the work is original and not under review elsewhere',
      'Disclose prior conference presentations, if any',
      'Disclose any conflicts of interest',
    ],
  },
]

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

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
          text: 'OSCRSJ accepts Case Reports, Case Series, Surgical Techniques, Images in Orthopedics, Letters to the Editor, and invited Review Articles across all orthopedic subspecialties.',
        },
      },
      {
        '@type': 'Question',
        name: 'What is the word limit for a case report at OSCRSJ?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Case reports have a maximum word limit of 2,000 words (excluding abstract, references, figure legends, and tables) with a structured abstract of up to 300 words.',
        },
      },
      {
        '@type': 'Question',
        name: 'Is the CARE checklist required?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Yes. A completed CARE checklist is mandatory for all case report submissions and must be submitted as a supplementary file.',
        },
      },
    ],
  }

  return (
    <div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqData) }}
      />
      <PageHeader
        label="For Authors"
        title="Guide for Authors"
        subtitle="Everything you need to prepare and submit a manuscript to OSCRSJ."
      />

      <div className="max-w-content mx-auto px-4 sm:px-6 lg:px-8 py-20">

        {/* ---- Quick‑reference comparison table ---- */}
        <section id="comparison" className="mb-16">
          <span className="section-label">At a Glance</span>
          <h2 className="section-heading mb-6">Article Types Comparison</h2>
          <div className="overflow-x-auto -mx-4 px-4">
            <table className="w-full text-sm border-collapse min-w-[720px]">
              <thead>
                <tr className="bg-brown-dark text-peach">
                  <th className="text-left px-4 py-3 font-medium rounded-tl-lg">Parameter</th>
                  {articleTypes.map((t) => (
                    <th key={t.id} className="text-left px-3 py-3 font-medium last:rounded-tr-lg">
                      <a href={`#${t.id}`} className="hover:text-white transition-colors">{t.label}</a>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {comparisonRows.map((row, i) => (
                  <tr key={row.param} className={i % 2 === 0 ? 'bg-white' : 'bg-cream-alt/50'}>
                    <td className="px-4 py-2.5 font-medium text-brown-dark">{row.param}</td>
                    {row.values.map((v, j) => (
                      <td key={j} className="px-3 py-2.5 text-brown-dark">{v}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* ---- Article‑type detail sections ---- */}
        {articleTypes.map((type) => (
          <section key={type.id} id={type.id} className="mb-16 scroll-mt-24">
            <div className="flex items-baseline gap-3 mb-1">
              <span className="section-label">{type.tagline}</span>
            </div>
            <h2 className="section-heading mb-3">{type.label}</h2>
            <p className="text-sm text-brown-dark leading-relaxed max-w-3xl mb-6">{type.definition}</p>

            {/* Specs grid */}
            <div className="grid sm:grid-cols-2 gap-x-8 gap-y-2 mb-6 max-w-3xl">
              {type.specs.map((s) => (
                <div key={s.label} className="flex gap-2 py-1.5 border-b border-border">
                  <span className="text-xs font-semibold text-tan uppercase tracking-wide whitespace-nowrap min-w-[110px]">{s.label}</span>
                  <span className="text-sm text-brown-dark">{s.value}</span>
                </div>
              ))}
            </div>

            {/* Required sections */}
            <div className="bg-cream-alt/50 border border-border rounded-xl p-6 max-w-3xl">
              <p className="text-xs font-semibold text-tan uppercase tracking-widest mb-3">Required Sections (in order)</p>
              <ol className="space-y-2">
                {type.sections.map((sec, i) => (
                  <li key={i} className="flex gap-3 text-sm text-brown-dark leading-relaxed">
                    <span className="text-xs font-bold text-tan mt-0.5 w-5 flex-shrink-0">{i + 1}.</span>
                    {sec}
                  </li>
                ))}
              </ol>
            </div>
          </section>
        ))}

        {/* ---- General requirements ---- */}
        <div className="border-t border-border pt-16">
          <span className="section-label">All Article Types</span>
          <h2 className="section-heading mb-8">General Requirements</h2>

          {/* Jump links */}
          <div className="bg-cream-alt border border-border rounded-xl p-5 mb-10">
            <div className="flex flex-wrap gap-2">
              {generalSections.map((s) => (
                <a
                  key={s.id}
                  href={`#${s.id}`}
                  className="text-xs text-brown-dark hover:text-brown transition-colors px-3 py-2 bg-white border border-border rounded-lg hover:border-tan font-medium"
                >
                  {s.label}
                </a>
              ))}
            </div>
          </div>

          {generalSections.map((section, i) => (
            <section
              key={section.id}
              id={section.id}
              className={`scroll-mt-24 py-8 ${i > 0 ? 'border-t border-border' : ''}`}
            >
              <h3 className="text-lg font-serif text-brown-dark mb-4">{section.title}</h3>
              <ul className="space-y-2 max-w-3xl">
                {section.items.map((item, j) => (
                  <li key={j} className="flex gap-3 text-sm text-brown-dark leading-relaxed">
                    <svg className="w-4 h-4 text-tan mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {item}
                  </li>
                ))}
              </ul>
              {section.example && (
                <div className="mt-4 bg-cream-alt border border-border rounded-lg p-4 max-w-3xl">
                  <p className="text-xs font-semibold text-tan uppercase tracking-widest mb-2">Example</p>
                  <p className="text-sm text-brown-dark italic">{section.example}</p>
                </div>
              )}
            </section>
          ))}
        </div>

        {/* ---- CTA ---- */}
        <div className="mt-12 bg-tan/20 border border-peach/30 rounded-xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <p className="font-semibold text-brown-dark">Ready to submit?</p>
            <p className="text-sm text-tan mt-0.5">Publishing is free through the end of 2026.</p>
          </div>
          <div className="flex gap-3">
            <Link href="/submit" className="btn-primary-light flex-shrink-0">
              Submit a Manuscript
            </Link>
            <Link href="/faq" className="btn-outline flex-shrink-0">
              Author FAQ
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
