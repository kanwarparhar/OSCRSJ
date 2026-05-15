import type { Metadata } from 'next'
import Link from 'next/link'
import PageHeader from '@/components/PageHeader'

export const metadata: Metadata = {
  title: 'Guide for Authors',
  description:
    'Complete author guidelines for submitting case reports, case series, systematic reviews and meta-analyses, surgical techniques, images in orthopedics, and letters to the editor to the Orthopedic Surgery Case Reports & Series Journal.',
  alternates: { canonical: 'https://www.oscrsj.com/guide-for-authors' },
  openGraph: {
    title: 'Guide for Authors | OSCRSJ',
    description:
      'Complete author guidelines for the six article types accepted by OSCRSJ — case reports, case series, systematic reviews and meta-analyses, surgical techniques, images in orthopedics, and letters to the editor.',
    url: 'https://www.oscrsj.com/guide-for-authors',
    type: 'website',
  },
}

/* ------------------------------------------------------------------ */
/*  Article‑type specs                                                 */
/* ------------------------------------------------------------------ */

interface ArticleTypeChecklist {
  // Reporting-tool details surfaced as a download card inside the
  // article-type section. Currently only Case Report (CARE) and Case
  // Series (JBI) carry one; other types omit the field.
  name: string
  fullName: string
  itemCount: string
  rationale: string
  downloadHref: string
  sourceLabel: string
  sourceHref: string
}

const articleTypes: Array<{
  id: string
  label: string
  tagline: string
  definition: string
  specs: { label: string; value: string }[]
  sections: string[]
  checklist?: ArticleTypeChecklist
}> = [
  {
    id: 'case-report',
    label: 'Case Report',
    tagline: '1-3 patients',
    definition:
      'A detailed account of the diagnosis, treatment, and outcome of a medical condition in one to three patients. Case reports at OSCRSJ should present novel, rare, or instructive orthopedic cases that contribute meaningfully to clinical knowledge.',
    checklist: {
      name: 'CARE Checklist',
      fullName: 'CAse REport reporting guidelines (CARE, 2013)',
      itemCount: '13 reporting items',
      rationale:
        'Mandatory for every Case Report submission. The CARE checklist forces systematic reporting of patient information, clinical findings, timeline, diagnostic assessment, intervention, follow-up, outcomes, patient perspective, and informed consent. Complete every item and upload the filled-in checklist as part of your submission (Step 2 of the portal).',
      downloadHref: '/downloads/oscrsj-care-checklist.pdf',
      sourceLabel: 'care-statement.org',
      sourceHref: 'https://www.care-statement.org/checklist',
    },
    specs: [
      { label: 'Word Limit', value: '2,000 words (excluding abstract, references, figure legends, and tables)' },
      { label: 'Abstract', value: '300 words maximum, structured (Introduction, Case Presentation, Discussion, Conclusion)' },
      { label: 'Keywords', value: '3-5 MeSH terms' },
      { label: 'Figures', value: 'Maximum 8 (clinical photos, radiographs, MRI, CT, intraoperative)' },
      { label: 'Tables', value: 'Maximum 3' },
      { label: 'References', value: '10-25 in Vancouver style' },
      { label: 'Required Checklist', value: 'CARE checklist (mandatory, submit as supplementary file)' },
    ],
    sections: [
      'Title Page: full title (max 20 words), all author names with degrees and superscript affiliation numbers, numbered affiliations, disclosures (Funding, Conflicts of Interest, Acknowledgements), and the corresponding-author block (name, mailing address, email, phone)',
      'Abstract: structured into Introduction (why this case matters), Case Presentation (demographics, history, exam, investigations, treatment), Discussion (how findings relate to literature), Conclusion (key learning point)',
      'Keywords: 3-5 MeSH terms',
      'Introduction',
      'Case Presentation',
      'Discussion',
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
    checklist: {
      name: 'JBI Case Series Checklist',
      fullName: 'Joanna Briggs Institute Critical Appraisal Checklist for Case Series (2017)',
      itemCount: '10 appraisal items',
      rationale:
        'Mandatory for every Case Series submission. The JBI checklist is the canonical critical-appraisal tool for case series — it covers inclusion criteria, valid measurement of the condition, consecutive and complete patient inclusion, demographic and clinical reporting, outcome measurement, follow-up duration, and statistical analysis. Complete every item and upload the filled-in checklist as part of your submission (Step 2 of the portal).',
      downloadHref: '/downloads/oscrsj-jbi-case-series-checklist.pdf',
      sourceLabel: 'jbi.global',
      sourceHref: 'https://jbi.global/critical-appraisal-tools',
    },
    specs: [
      { label: 'Word Limit', value: '3,000 words (excluding abstract, references, figure legends, and tables)' },
      { label: 'Abstract', value: '300 words maximum, structured (Background, Methods, Results, Discussion, Conclusion)' },
      { label: 'Keywords', value: '3-6 MeSH terms' },
      { label: 'Figures', value: 'Maximum 10' },
      { label: 'Tables', value: 'Maximum 5 (patient demographics/summary table strongly recommended)' },
      { label: 'References', value: '15-40 in Vancouver style' },
      { label: 'Required Checklist', value: 'JBI Critical Appraisal Checklist for Case Series (mandatory)' },
      { label: 'IRB', value: 'IRB approval or exemption statement required' },
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
    id: 'review-article',
    label: 'Systematic Review & Meta-Analysis',
    tagline: 'Evidence synthesis · 3,500 words',
    definition:
      'A systematic review or meta-analysis on a focused clinical question in orthopedic surgery. Authored with a pre-defined search strategy, transparent eligibility criteria, and (for meta-analyses) quantitative pooling of effect estimates. Unsolicited submissions are welcome and undergo our standard double-blind peer review by reviewers outside of our network.',
    checklist: {
      name: 'PRISMA 2020 Checklist',
      fullName: 'Preferred Reporting Items for Systematic reviews and Meta-Analyses (PRISMA 2020)',
      itemCount: '27 reporting items',
      rationale:
        'Required for every Systematic Review & Meta-Analysis submission. The PRISMA 2020 checklist is the international standard for transparent reporting of systematic reviews — it covers protocol registration, eligibility criteria, information sources, search strategy, study selection, data extraction, risk-of-bias assessment, synthesis methods, and reporting of results. Complete every item and upload the filled-in checklist as part of your submission (Step 2 of the portal).',
      downloadHref: '/downloads/oscrsj-prisma-checklist.pdf',
      sourceLabel: 'prisma-statement.org',
      sourceHref: 'https://www.prisma-statement.org/prisma-2020-checklist',
    },
    specs: [
      { label: 'Word Limit', value: '3,500 words (excluding abstract, references, figure legends, and tables)' },
      { label: 'Abstract', value: '300 words maximum, structured (Background, Methods, Results, Conclusion)' },
      { label: 'Keywords', value: '3-6 MeSH terms' },
      { label: 'Figures', value: 'Maximum 6 (PRISMA flow diagram strongly recommended; forest plot for meta-analyses)' },
      { label: 'Tables', value: 'Maximum 4 (study characteristics + outcomes tables strongly recommended)' },
      { label: 'References', value: '20-60 in Vancouver style' },
      { label: 'Required Checklist', value: 'PRISMA 2020 checklist (mandatory, submit as supplementary file)' },
      { label: 'Protocol Registration', value: 'PROSPERO (or equivalent) registration ID strongly recommended; include in Methods' },
    ],
    sections: [
      'Title Page: same format as Case Reports',
      'Abstract: structured into Background (clinical question and rationale), Methods (search strategy, eligibility, synthesis approach), Results (study selection flow, key findings, pooled estimates if applicable), Conclusion (clinical implications and evidence gaps)',
      'Keywords: 3-6 MeSH terms',
      'Introduction: clinical context, gap in the existing literature, the specific PICO question this review answers',
      'Methods: protocol registration (PROSPERO ID if applicable), eligibility criteria (PICO), information sources and search strategy (with dates), study selection process, data extraction, risk-of-bias assessment tool, synthesis methodology (narrative or meta-analytic — specify statistical software and pooling model if applicable)',
      'Results: study selection (PRISMA flow diagram), study characteristics, risk-of-bias summary, narrative or quantitative synthesis of findings, subgroup or sensitivity analyses if performed',
      'Discussion: synthesis of findings, comparison with prior reviews, strengths and limitations of the included evidence and of the review itself',
      'Conclusion: clinical implications and directions for future research',
      'References',
      'Figure Legends',
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
      { label: 'Abstract', value: '300 words maximum, unstructured' },
      { label: 'Keywords', value: '3-5 MeSH terms' },
      { label: 'Figures', value: 'Minimum 4, maximum 10 (this is a visually-driven article type)' },
      { label: 'Tables', value: 'Maximum 2' },
      { label: 'References', value: '8-15 in Vancouver style' },
      { label: 'Supplementary', value: 'Video links (YouTube or similar) are strongly encouraged' },
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
    ],
    sections: [
      'No formal section headings required',
      'Must reference the specific OSCRSJ article being discussed (by DOI)',
      'State the point of agreement or disagreement with supporting evidence or reasoning',
    ],
  },
]

/* ------------------------------------------------------------------ */
/*  Quick-reference comparison table                                   */
/* ------------------------------------------------------------------ */

// Column order matches articleTypes[] above:
//   [Case Report, Case Series, Systematic Review & Meta-Analysis, Surgical Technique, Images in Orthopedics, Letter to the Editor]
const comparisonRows = [
  { param: 'Word Limit', values: ['2,000', '3,000', '3,500', '1,500', '500', '600'] },
  { param: 'Abstract', values: ['300 (structured)', '300 (structured)', '300 (structured)', '300 (unstructured)', 'None', 'None'] },
  { param: 'Max Figures', values: ['8', '10', '6', '10', '4', '1'] },
  { param: 'Max Tables', values: ['3', '5', '4', '2', '0', '1'] },
  { param: 'References', values: ['10-25', '15-40', '20-60', '8-15', 'Max 5', 'Max 5'] },
  { param: 'Checklist', values: ['CARE', 'JBI', 'PRISMA', 'N/A', 'N/A', 'N/A'] },
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
      'File Format: Microsoft Word (.docx). Use the OSCRSJ manuscript templates available at /templates — they have the correct format pre-applied.',
      'Font: Times New Roman, 12-point. All text in black.',
      'Style: headings in bold sentence case (only the first letter capitalised), no italics. Body text in regular weight, no underline.',
      'Spacing: double-spaced throughout.',
      'Line Numbers: continuous line numbering, on every page.',
      'Margins: 1 inch (2.54 cm) on all sides.',
      'Page Numbers: bottom center of each page.',
      'Headings: use Heading 1, Heading 2, and Heading 3 only — never Heading 4 or deeper. Every heading is bold, sentence case, with no italics, and carries an empty line above it (never below).',
      'Running Title: a short running title appears in the top-right corner of every page (the manuscript template carries a placeholder you replace).',
      'In-text Citations: format each citation number as a superscript hyperlinked to the matching entry in the Reference list.',
      'References: Vancouver Style with citations numbered in sequential order or appearance. The Introduction begins on a new page after the abstract and keywords. The References section sits on its own page; the "References" heading is centered, sentence case, and the first reference begins on the line directly below the heading (no blank line between).',
      'Figure Legends: also on a separate page after the references; the "Figure legends" heading is centered, sentence case, with the first legend on the line directly below.',
      'Figures: submit each figure as a separate high-resolution image file (TIFF, PNG, or JPEG; minimum 300 DPI; 600 DPI recommended). Do NOT embed figures in the manuscript file. Add the figure legend in the Figure Legends section at the end of the manuscript and indicate placement with [Insert Figure 1 here] callouts in the body. Remove all patient identifiers; mask faces unless explicit consent is provided.',
      'Tables: submit all tables in a single Tables.docx file (use the Tables template at /templates), one table per page, real Word tables (not images). Do NOT embed tables in the manuscript file. Indicate placement with [Insert Table 1 here] callouts in the body.',
      'Title Page: separate document containing the manuscript title, author byline with affiliations, disclosures (Funding, Conflicts of Interest, Acknowledgements), and the corresponding-author block. The blinded manuscript file does NOT contain author-identifying information.',
    ],
  },
  {
    id: 'references',
    label: 'References',
    title: 'Reference Format (Vancouver Style)',
    items: [
      'Number references consecutively in order of first citation',
      'Cite references in text as superscripts (e.g. ¹), hyperlinked to the matching entry in the Reference list',
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
      'Written patient consent for publication is required for all case-based submissions. The canonical OSCRSJ consent statements (5 variants — adult, pediatric, deceased, verbal-witnessed, IRB waiver) are at /templates#consent. Copy the variant matching your patient situation verbatim into your manuscript.',
      'IRB approval or exemption must be documented for case series. The canonical OSCRSJ statements (2 branches — approved or exempt) are at /templates#irb. Copy the branch matching your institution’s determination verbatim.',
      'Research involving human subjects must comply with the Declaration of Helsinki.',
      'All authors must disclose conflicts of interest. Disclosures live on the Title Page or in the submission portal’s Step 5 — not in the blinded manuscript.',
      'CARE checklist is mandatory for case reports. JBI critical appraisal checklist is mandatory for case series. PRISMA 2020 checklist is mandatory for systematic reviews and meta-analyses.',
    ],
  },
  {
    id: 'peer-review',
    label: 'Peer Review',
    title: 'Peer Review',
    items: [
      'Every submission undergoes double-blind peer review by reviewers outside of our network. Neither authors nor reviewers know each other’s identities during the review process.',
      'Reviewers are recruited from outside the OSCRSJ editorial board — subspecialty-matched orthopedic surgeons and clinician-researchers — so that no editor evaluates work by their own collaborators.',
      'Each manuscript is read by at least two independent reviewers using structured review forms covering scientific merit, methodology, clarity, and ethical compliance.',
      'Initial editorial response within 10 days of submission; full peer-reviewed decision within 30–35 days. Full process at /peer-review.',
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
          text: 'OSCRSJ accepts Case Reports, Case Series, Systematic Reviews & Meta-Analyses, Surgical Techniques, Images in Orthopedics, and Letters to the Editor across all orthopedic subspecialties. All six article types are evaluated under our standard double-blind peer review by reviewers outside of our network.',
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
        subtitle="Everything you need to prepare and submit a manuscript to OSCRSJ. We welcome submissions from orthopedic surgeons across all career stages."
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
                    <td className="px-4 py-2.5 font-medium text-ink">{row.param}</td>
                    {row.values.map((v, j) => (
                      <td key={j} className="px-3 py-2.5 text-ink">{v}</td>
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
            <p className="text-sm text-ink leading-relaxed max-w-3xl mb-6">{type.definition}</p>

            {/* Specs grid */}
            <div className="grid sm:grid-cols-2 gap-x-8 gap-y-2 mb-6 max-w-3xl">
              {type.specs.map((s) => (
                <div key={s.label} className="flex gap-3 py-1.5 border-b border-border">
                  <span className="text-xs font-semibold text-brown uppercase tracking-wide min-w-[150px] flex-shrink-0">{s.label}</span>
                  <span className="text-sm text-ink">{s.value}</span>
                </div>
              ))}
            </div>

            {/* Required sections */}
            <div className="bg-cream-alt/50 border border-border rounded-xl p-6 max-w-3xl">
              <p className="text-xs font-semibold text-brown uppercase tracking-widest mb-3">Required Sections (in order)</p>
              <p className="text-xs text-brown italic mb-3 leading-relaxed">
                The Title Page is a <strong>separate document</strong> from the blinded manuscript — it contains the title, author byline, affiliations, and corresponding-author block. The blinded manuscript file begins at the Abstract. Patient consent and IRB statements are copied verbatim from <Link href="/templates#consent" className="text-brown-dark underline">/templates</Link>. Conflict of Interest, Funding, CRediT, and AI disclosures live on the Title Page or in the submission portal’s Step 5 — not in the blinded manuscript.
              </p>
              <ol className="space-y-2">
                {type.sections.map((sec, i) => (
                  <li key={i} className="flex gap-3 text-sm text-ink leading-relaxed">
                    <span className="text-xs font-bold text-brown mt-0.5 w-5 flex-shrink-0">{i + 1}.</span>
                    {sec}
                  </li>
                ))}
              </ol>
            </div>

            {/* Reporting-checklist download card (CARE for Case Reports, JBI for Case Series) */}
            {type.checklist && (
              <div className="mt-6 bg-white border border-peach/40 rounded-xl p-6 max-w-3xl">
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-5">
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-brown uppercase tracking-widest mb-2">Required Reporting Checklist</p>
                    <h3 className="font-serif text-xl text-brown-dark mb-1">{type.checklist.name}</h3>
                    <p className="text-xs text-brown mb-3">{type.checklist.fullName} · {type.checklist.itemCount}</p>
                    <p className="text-sm text-ink leading-relaxed mb-3">{type.checklist.rationale}</p>
                    <p className="text-xs text-brown">
                      Source:{' '}
                      <a
                        href={type.checklist.sourceHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline hover:text-brown-dark"
                      >
                        {type.checklist.sourceLabel}
                      </a>{' '}
                      · OSCRSJ hosts the official version verbatim with attribution.
                    </p>
                  </div>
                  <div className="flex flex-col gap-2 flex-shrink-0 lg:w-56">
                    <a
                      href={type.checklist.downloadHref}
                      download
                      className="btn-primary-light text-center"
                    >
                      Download Checklist (.pdf)
                    </a>
                  </div>
                </div>
              </div>
            )}
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
                  className="text-xs text-ink hover:text-brown transition-colors px-3 py-2 bg-white border border-border rounded-lg hover:border-tan font-medium"
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
                  <li key={j} className="flex gap-3 text-sm text-ink leading-relaxed">
                    <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 rounded-full bg-brown flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
              {section.example && (
                <div className="mt-4 bg-cream-alt border border-border rounded-lg p-4 max-w-3xl">
                  <p className="text-xs font-semibold text-brown uppercase tracking-widest mb-2">Example</p>
                  <p className="text-sm text-ink italic">{section.example}</p>
                </div>
              )}
            </section>
          ))}
        </div>

        {/* ---- CTA ---- */}
        <div className="mt-12 bg-tan/20 border border-peach/30 rounded-xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <p className="font-semibold text-ink">Ready to submit?</p>
            <p className="text-sm text-brown mt-0.5">The full APC is waived for manuscripts submitted before August 1, 2026.</p>
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
