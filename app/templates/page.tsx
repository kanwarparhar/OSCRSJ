import type { Metadata } from 'next'
import Link from 'next/link'
import PageHeader from '@/components/PageHeader'

export const metadata: Metadata = {
  title: 'Manuscript Templates',
  description: 'Download OSCRSJ manuscript templates and worked examples for every accepted article type. Plus the canonical patient consent and IRB approval statements, format requirements, and submission file checklist.',
  alternates: { canonical: 'https://www.oscrsj.com/templates' },
}

/* ---------- Article-type matrix (template + example downloads per type) ---------- */
const articleTypes = [
  {
    id: 'case-report',
    label: 'Case Report',
    tagline: '1–3 patients · 2,000 words · CARE checklist',
    description:
      'A detailed account of one to three patients with a novel, rare, or instructive orthopedic case. Structured abstract: Introduction · Case Presentation · Discussion · Conclusion.',
    templateFile: 'oscrsj-template-case-report.docx',
    exampleFile: 'oscrsj-example-case-report.docx',
  },
  {
    id: 'case-series',
    label: 'Case Series',
    tagline: '4+ patients · 3,000 words · JBI checklist',
    description:
      'Four or more patients with a similar diagnosis, treatment, or outcome. Structured abstract: Background · Methods · Results · Discussion · Conclusion.',
    templateFile: 'oscrsj-template-case-series.docx',
    exampleFile: 'oscrsj-example-case-series.docx',
  },
  {
    id: 'surgical-technique',
    label: 'Surgical Technique',
    tagline: 'Step-by-step · 1,500 words · video encouraged',
    description:
      'A new, modified, or improved operative technique with step-by-step description and intraoperative figures. Unstructured 200-word abstract.',
    templateFile: 'oscrsj-template-surgical-technique.docx',
    exampleFile: 'oscrsj-example-surgical-technique.docx',
  },
  {
    id: 'images-in-orthopedics',
    label: 'Images in Orthopedics',
    tagline: 'Image-driven · 500 words · expedited 7–10 days',
    description:
      'A brief, image-focused article presenting one or more striking clinical, radiographic, or intraoperative images with a concise clinical description and teaching point. No abstract.',
    templateFile: 'oscrsj-template-images-in-orthopedics.docx',
    exampleFile: 'oscrsj-example-images-in-orthopedics.docx',
  },
  {
    id: 'letter-to-editor',
    label: 'Letter to the Editor',
    tagline: 'Commentary · 600 words',
    description:
      'A brief commentary on a previously published OSCRSJ article. Reference the discussed article by DOI; state the point of agreement or disagreement with supporting evidence. No formal section headings.',
    templateFile: 'oscrsj-template-letter-to-editor.docx',
    exampleFile: 'oscrsj-example-letter-to-editor.docx',
  },
  {
    id: 'review-article',
    label: 'Review Article',
    tagline: 'Invited (Year 1) · 3,500 words · PRISMA recommended',
    description:
      'A comprehensive review of a focused topic in orthopedic surgery. Structured abstract: Background · Methods · Results · Conclusion. Invited only during Year 1.',
    templateFile: 'oscrsj-template-review-article.docx',
    exampleFile: 'oscrsj-example-review-article.docx',
  },
]

/* ---------- 5 patient consent variants (per Janine PDF Compliance Brief §5.3) ---------- */
const consentVariants = [
  {
    id: 'adult-living',
    label: 'A. Competent adult patient',
    when: 'Use when the patient is a living adult who can give written informed consent on their own behalf.',
    text:
      'Written informed consent was obtained from the patient for publication of this case report and any accompanying images. A copy of the consent form is available on request.',
  },
  {
    id: 'pediatric-guardian',
    label: 'B. Pediatric patient (parent or legal guardian)',
    when: 'Use when the patient is a minor and consent has been obtained from the parent or legal guardian.',
    text:
      'Written informed consent for publication of this case report and any accompanying images was obtained from the parent(s) or legal guardian(s) of the minor patient. Age-appropriate assent was obtained from the patient where developmentally feasible. A copy of the consent form is available on request.',
  },
  {
    id: 'deceased-nok',
    label: 'C. Deceased patient (next of kin)',
    when: 'Use when the patient is deceased and consent has been obtained from the next of kin.',
    text:
      'The patient described in this case report is deceased. Written informed consent for publication of this case report and any accompanying images was obtained from the patient’s next of kin. A copy of the consent form is available on request.',
  },
  {
    id: 'verbal-witnessed',
    label: 'D. Verbal consent witnessed (unusual circumstances)',
    when: 'Use only when written consent cannot be obtained and verbal consent was witnessed by a member of the clinical team. Approval from the institution’s research ethics committee is required.',
    text:
      'Written consent for publication could not be obtained; verbal consent was obtained from the patient and witnessed by a member of the clinical team. All identifying features have been removed from the case description and accompanying images. The decision to proceed under verbal consent was reviewed and approved by the institution’s research ethics committee.',
  },
  {
    id: 'waiver-approved',
    label: 'E. IRB waiver of consent',
    when: 'Use when a formal waiver of informed consent has been granted by an Institutional Review Board.',
    text:
      'A formal waiver of informed consent was granted by the Institutional Review Board of [INSTITUTION] (protocol number [IRB-####]) under 45 CFR 46.116(f) because [WAIVER RATIONALE]. All identifying features have been removed from the case description and accompanying images.',
  },
]

/* ---------- 2 IRB / Ethics approval branches (per Janine PDF Compliance Brief §5.4) ---------- */
const irbBranches = [
  {
    id: 'approved',
    label: 'A. IRB approval obtained',
    when: 'Use when your institution’s IRB has reviewed and approved the case report or series.',
    text:
      'This case report was reviewed and approved by the Institutional Review Board of [INSTITUTION] (protocol number [IRB-####]). Written informed consent was obtained from the patient(s) as described above.',
  },
  {
    id: 'exempt',
    label: 'B. IRB exempt or not required',
    when: 'Use when your institution exempts single-patient case reports from formal IRB review. Cite the specific institutional policy or exemption category.',
    text:
      'Institutional Review Board approval was not required for this case report per [INSTITUTION] policy ([SINGLE-PATIENT CASE REPORT / DE-IDENTIFIED / OTHER EXEMPTION RATIONALE — cite the specific institutional policy or category, e.g., "Category 4 exemption per 45 CFR 46.104(d)(4)"]). Written informed consent was obtained from the patient(s) as described above.',
  },
]

/* ---------- 10-item pre-flight checklist (migrated from v1.0 cover page) ---------- */
const preflightItems = [
  'Read the Guide for Authors before drafting your manuscript.',
  'Use the Title Page template and the article-type-matched manuscript template — not a blank document.',
  'Use Heading 1, Heading 2, and Heading 3 only — never Heading 4 or deeper. Headings render in italic by design.',
  'Number references manually as [1], [2], [3] in citation order. Do not use Word’s auto-numbered list feature.',
  'Place References on a separate page. Insert a hard page break (Cmd+Enter / Ctrl+Enter) immediately before the References heading.',
  'Do not embed figures or tables in the manuscript. Submit figures as separate high-resolution image files; submit all tables in a single Tables.docx.',
  'Indicate placement of figures and tables in the manuscript body with [Insert Figure 1 here] and [Insert Table 1 here] callouts.',
  'Do not use Word’s footnote feature. Disclosures live on the Title Page or in the submission portal’s Step 5.',
  'Replace every [bracketed placeholder] with your content. Delete every instructional sentence in brackets.',
  'Verify continuous line numbering is on (Layout → Line Numbers → Continuous in Word).',
]

/* ---------- File-format requirements (per OSCRSJ submission policy) ---------- */
const formatRequirements = [
  { label: 'File Format', value: 'Microsoft Word (.docx)' },
  { label: 'Font', value: 'Times New Roman, 12 point — all text in black' },
  { label: 'Style', value: 'No bold, no underline; headings in italic only' },
  { label: 'Spacing', value: 'Double-spaced throughout' },
  { label: 'Margins', value: '1 inch (2.54 cm) on all sides' },
  { label: 'Line Numbering', value: 'Continuous line numbering, on every page' },
  { label: 'Page Numbers', value: 'Bottom center of every page' },
  { label: 'References', value: 'Vancouver style, manual [n] numbering, on a separate page after a hard page break' },
  { label: 'Figures', value: 'Separate high-resolution image files (TIFF, PNG, or JPEG; minimum 300 DPI). Not embedded in the manuscript.' },
  { label: 'Tables', value: 'Single Tables.docx file, one table per page, real Word tables (not images). Not embedded in the manuscript.' },
]

/* ---------- What to upload at submission ---------- */
const submissionFiles = [
  {
    name: 'Title Page',
    filename: 'oscrsj-title-page.docx',
    required: 'Required',
    description: 'Manuscript title, running title, author byline, affiliations, corresponding author email + ORCID. This is the only file that contains author-identifying information.',
  },
  {
    name: 'Manuscript (blinded)',
    filename: 'oscrsj-template-{article-type}.docx',
    required: 'Required',
    description: 'The blinded manuscript. Begins at the Abstract; contains no author names or affiliations. Use the article-type-matched template from the matrix below.',
  },
  {
    name: 'Tables',
    filename: 'oscrsj-tables-template.docx',
    required: 'If applicable',
    description: 'A single Word document containing every table in your manuscript, one table per page. Skip if your manuscript contains no tables.',
  },
  {
    name: 'Figures',
    filename: 'Figure_1.tiff, Figure_2.png, …',
    required: 'If applicable',
    description: 'Each figure as a separate high-resolution image file (TIFF, PNG, or JPEG; minimum 300 DPI). Use the file naming pattern Figure_1, Figure_2, etc.',
  },
  {
    name: 'Reporting Checklist',
    filename: 'CARE-checklist.pdf · JBI-checklist.pdf · PRISMA-checklist.pdf',
    required: 'Per article type',
    description: 'CARE checklist for case reports; JBI critical appraisal checklist for case series; PRISMA recommended for systematic review articles. Submit as a supplementary file.',
  },
  {
    name: 'Cover Letter',
    filename: 'cover-letter.docx',
    required: 'Required',
    description: 'A brief cover letter to the editor describing the article type, why the case is novel or instructive, that the work is original and not under review elsewhere, and any prior conference presentations.',
  },
]

export default function TemplatesPage() {
  return (
    <div>
      <PageHeader
        label="For Authors"
        title="Manuscript Templates"
        subtitle="Pre-styled Word templates and worked examples for every OSCRSJ article type, plus the canonical patient consent and IRB approval statements, format requirements, and submission file checklist."
      />

      <div className="max-w-content mx-auto px-4 sm:px-6 lg:px-8 py-20 space-y-16">
        {/* ============================================================
            INTRO + WHY USE THE TEMPLATE
            ============================================================ */}
        <section>
          <div className="bg-white border-2 border-peach-dark/40 rounded-2xl p-8 sm:p-10">
            <h2 className="font-serif text-3xl text-brown-dark mb-3">Start here</h2>
            <p className="text-ink leading-relaxed mb-4">
              OSCRSJ accepts manuscripts in standard journal-submission format: Times New Roman 12pt, all black, no bold or underline, double-spaced, with continuous line numbering. Use the article-type-matched template below — it has the structure, section headings, and word-count placeholders already laid out, so you can focus on the science.
            </p>
            <p className="text-ink leading-relaxed">
              Every submission needs a <strong>Title Page</strong> (with author info), a <strong>blinded manuscript</strong> (using the template that matches your article type), a <strong>Tables.docx</strong> if you have tables, and <strong>each figure as a separate image file</strong>. No author info appears in the manuscript file itself — that is the standard for blinded peer review.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <a href="#article-types" className="btn-primary-light">Jump to templates →</a>
              <a href="#consent" className="text-brown-dark underline hover:text-brown self-center">Patient consent statements</a>
              <a href="#irb" className="text-brown-dark underline hover:text-brown self-center">IRB approval statements</a>
            </div>
          </div>
        </section>

        {/* ============================================================
            PRE-FLIGHT CHECKLIST
            ============================================================ */}
        <section id="checklist">
          <h2 className="font-serif text-3xl text-brown-dark mb-2">Before You Begin</h2>
          <p className="text-brown mb-6">A 10-item pre-flight checklist that mirrors what the submission portal will check at upload.</p>
          <div className="bg-cream-alt/50 rounded-xl p-6">
            <ol className="space-y-3 text-ink">
              {preflightItems.map((item, i) => (
                <li key={i} className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-white border border-tan flex items-center justify-center text-xs font-semibold text-brown-dark">{i + 1}</span>
                  <span>{item}</span>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ============================================================
            FORMAT REQUIREMENTS
            ============================================================ */}
        <section id="format">
          <h2 className="font-serif text-3xl text-brown-dark mb-2">Format Requirements</h2>
          <p className="text-brown mb-6">Every manuscript must conform to these formatting rules — they are baked into the templates so you don’t need to set them yourself, but they apply equally if you author from a blank document.</p>
          <div className="bg-white border border-border rounded-xl overflow-hidden">
            <table className="w-full">
              <tbody>
                {formatRequirements.map((row, i) => (
                  <tr key={row.label} className={i % 2 === 0 ? 'bg-white' : 'bg-cream-alt/30'}>
                    <td className="px-6 py-3 font-semibold text-brown-dark text-sm w-1/4 align-top">{row.label}</td>
                    <td className="px-6 py-3 text-ink text-sm">{row.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* ============================================================
            SUBMISSION FILE CHECKLIST
            ============================================================ */}
        <section id="files">
          <h2 className="font-serif text-3xl text-brown-dark mb-2">What to Upload</h2>
          <p className="text-brown mb-6">A typical submission consists of these files. Your specific submission may include some or all depending on your article type.</p>
          <div className="space-y-4">
            {submissionFiles.map((f) => (
              <div key={f.name} className="bg-white border border-border rounded-xl p-5">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 mb-2">
                  <div>
                    <h3 className="font-serif text-xl text-brown-dark">{f.name}</h3>
                    <p className="text-xs font-mono text-brown mt-1">{f.filename}</p>
                  </div>
                  <span className="text-xs font-medium text-brown bg-cream-alt px-2.5 py-1 rounded-full self-start whitespace-nowrap">{f.required}</span>
                </div>
                <p className="text-sm text-ink leading-relaxed">{f.description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ============================================================
            SHARED DOWNLOADS — Title Page + Tables Template
            ============================================================ */}
        <section id="shared-templates">
          <h2 className="font-serif text-3xl text-brown-dark mb-2">Shared Templates</h2>
          <p className="text-brown mb-6">Used by every article type, regardless of which manuscript template you choose.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white border border-border rounded-xl p-6">
              <h3 className="font-serif text-xl text-brown-dark mb-2">Title Page</h3>
              <p className="text-sm text-ink mb-4 leading-relaxed">
                The non-blinded title page that accompanies every submission. Contains the manuscript title, running title, author byline, affiliations, and corresponding-author block. The blinded manuscript file does NOT contain any of this information.
              </p>
              <a href="/downloads/oscrsj-title-page.docx" download className="btn-primary-light inline-block">
                Download Title Page (.docx)
              </a>
            </div>
            <div className="bg-white border border-border rounded-xl p-6">
              <h3 className="font-serif text-xl text-brown-dark mb-2">Tables</h3>
              <p className="text-sm text-ink mb-4 leading-relaxed">
                A single Word document for all tables in your manuscript. One table per page, real editable Word tables (not images), caption above each table. Submit only if your manuscript contains tables.
              </p>
              <a href="/downloads/oscrsj-tables-template.docx" download className="btn-primary-light inline-block">
                Download Tables Template (.docx)
              </a>
            </div>
          </div>
        </section>

        {/* ============================================================
            ARTICLE-TYPE TEMPLATES + EXAMPLES
            ============================================================ */}
        <section id="article-types">
          <h2 className="font-serif text-3xl text-brown-dark mb-2">Templates by Article Type</h2>
          <p className="text-brown mb-6">Each article type has a matched template (empty structure with placeholders) and a complete worked example (the same structure populated with realistic content). Download both — read the example first to see what good looks like, then author against the template.</p>
          <div className="space-y-5">
            {articleTypes.map((t) => (
              <div key={t.id} className="bg-white border border-border rounded-xl p-6">
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-5">
                  <div className="flex-1">
                    <h3 className="font-serif text-2xl text-brown-dark">{t.label}</h3>
                    <p className="text-xs text-brown mt-1 mb-3">{t.tagline}</p>
                    <p className="text-sm text-ink leading-relaxed">{t.description}</p>
                  </div>
                  <div className="flex flex-col gap-2 flex-shrink-0 lg:w-64">
                    <a
                      href={`/downloads/${t.templateFile}`}
                      download
                      className="btn-primary-light text-center"
                    >
                      Download Template (.docx)
                    </a>
                    <a
                      href={`/downloads/${t.exampleFile}`}
                      download
                      className="text-center text-sm text-brown-dark underline hover:text-brown py-2"
                    >
                      Download Worked Example (.docx)
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-brown mt-6 italic">
            Templates encode the format requirements as Word styles. The blinded manuscript begins on page 1 with the Abstract — there is no title or author block in the manuscript file (those live on the separate Title Page).
          </p>
        </section>

        {/* ============================================================
            FIGURES & TABLES GUIDE
            ============================================================ */}
        <section id="figures-tables">
          <h2 className="font-serif text-3xl text-brown-dark mb-2">How to Handle Figures and Tables</h2>
          <p className="text-brown mb-6">Figures and tables do NOT live inside the manuscript .docx. They are submitted as separate files. The manuscript file contains placement callouts and figure legends only.</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="bg-white border border-border rounded-xl p-6">
              <h3 className="font-serif text-xl text-brown-dark mb-3">Figures</h3>
              <ul className="space-y-2 text-sm text-ink">
                <li>· Submit each figure as a separate image file: <code className="text-xs bg-cream-alt px-1 rounded">Figure_1.tiff</code>, <code className="text-xs bg-cream-alt px-1 rounded">Figure_2.png</code>, etc.</li>
                <li>· Accepted formats: TIFF, PNG, or JPEG.</li>
                <li>· Minimum 300 DPI; 600 DPI strongly recommended.</li>
                <li>· Remove all patient identifiers; mask faces unless explicit consent is provided.</li>
                <li>· Use arrows or annotations to highlight key pathology.</li>
                <li>· In the manuscript, mark placement with <code className="text-xs bg-cream-alt px-1 rounded">[Insert Figure 1 here]</code> at the relevant point in the text.</li>
                <li>· Add the figure legend in the Figure Legends section at the end of the manuscript.</li>
              </ul>
            </div>
            <div className="bg-white border border-border rounded-xl p-6">
              <h3 className="font-serif text-xl text-brown-dark mb-3">Tables</h3>
              <ul className="space-y-2 text-sm text-ink">
                <li>· Submit all tables in a single <code className="text-xs bg-cream-alt px-1 rounded">Tables.docx</code> file.</li>
                <li>· One table per page, with the caption on the line above each table.</li>
                <li>· Real Word tables only — never rasterized images.</li>
                <li>· No nested tables. Single-level only.</li>
                <li>· In the manuscript, mark placement with <code className="text-xs bg-cream-alt px-1 rounded">[Insert Table 1 here]</code> at the relevant point in the text.</li>
                <li>· Use the <a href="/downloads/oscrsj-tables-template.docx" download className="text-brown-dark underline hover:text-brown">Tables template</a> as your starting point.</li>
              </ul>
            </div>
          </div>
        </section>

        {/* ============================================================
            PATIENT CONSENT STATEMENTS (5 variants)
            ============================================================ */}
        <section id="consent">
          <h2 className="font-serif text-3xl text-brown-dark mb-2">Patient Consent Statements</h2>
          <p className="text-brown mb-6">
            Every case-based article requires a patient consent statement. Pick the variant that matches your patient situation and copy the verbatim text into your manuscript at the appropriate location (typically near the end of the Case Presentation section, or in the Methods of a case series). Do not paraphrase — the editorial office and indexing bodies expect the canonical wording.
          </p>
          <div className="space-y-4">
            {consentVariants.map((v) => (
              <div key={v.id} id={`consent-${v.id}`} className="bg-white border border-border rounded-xl p-6">
                <h3 className="font-serif text-lg text-brown-dark mb-1">{v.label}</h3>
                <p className="text-xs text-brown italic mb-3">{v.when}</p>
                <blockquote className="border-l-4 border-tan pl-4 text-ink leading-relaxed text-sm bg-cream-alt/30 py-3 pr-3 rounded-r">
                  {v.text}
                </blockquote>
              </div>
            ))}
          </div>
        </section>

        {/* ============================================================
            IRB / ETHICS APPROVAL (2 branches)
            ============================================================ */}
        <section id="irb">
          <h2 className="font-serif text-3xl text-brown-dark mb-2">IRB / Ethics Approval Statements</h2>
          <p className="text-brown mb-6">
            Every case-based article requires an IRB / ethics approval statement. Pick the branch that matches your institution’s determination and copy the verbatim text into your manuscript (typically in the Methods section of a case series, or near the patient consent statement of a case report).
          </p>
          <div className="space-y-4">
            {irbBranches.map((b) => (
              <div key={b.id} id={`irb-${b.id}`} className="bg-white border border-border rounded-xl p-6">
                <h3 className="font-serif text-lg text-brown-dark mb-1">{b.label}</h3>
                <p className="text-xs text-brown italic mb-3">{b.when}</p>
                <blockquote className="border-l-4 border-tan pl-4 text-ink leading-relaxed text-sm bg-cream-alt/30 py-3 pr-3 rounded-r">
                  {b.text}
                </blockquote>
              </div>
            ))}
          </div>
        </section>

        {/* ============================================================
            LICENSE INFORMATION (informational only)
            ============================================================ */}
        <section id="license">
          <h2 className="font-serif text-3xl text-brown-dark mb-2">Publication License</h2>
          <p className="text-brown mb-6">
            All articles published in OSCRSJ are released under the Creative Commons Attribution-NonCommercial-NoDerivatives 4.0 International License (CC BY-NC-ND 4.0). The license clause is added to your article by the editorial office at publication — you do not need to include it in your manuscript file.
          </p>
          <div className="bg-white border border-border rounded-xl p-6">
            <p className="text-sm text-brown italic mb-2">For your reference, the published license clause reads:</p>
            <blockquote className="border-l-4 border-tan pl-4 text-ink leading-relaxed text-sm">
              <strong>&copy; YYYY The Author(s). Published by OSCRSJ.</strong>
              <br /><br />
              This article is distributed under the terms of the Creative Commons Attribution-NonCommercial-NoDerivatives 4.0 International License (CC BY-NC-ND 4.0), which permits use, distribution, and reproduction in any non-commercial medium, provided the original work is properly cited and is not altered, transformed, or built upon in any way. To view a copy of this license, visit{' '}
              <a href="https://creativecommons.org/licenses/by-nc-nd/4.0/" className="text-brown-dark underline hover:text-brown" target="_blank" rel="noopener noreferrer">
                https://creativecommons.org/licenses/by-nc-nd/4.0/
              </a>
            </blockquote>
          </div>
        </section>

        {/* ============================================================
            CTA — back to Guide for Authors
            ============================================================ */}
        <div className="bg-cream-alt border border-peach/30 rounded-xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <p className="font-semibold text-ink">Need the full author guidelines?</p>
            <p className="text-sm text-brown mt-0.5">Detailed article-type specs, ethics requirements, cover-letter checklist, and review timeline.</p>
          </div>
          <Link href="/guide-for-authors" className="btn-primary-light flex-shrink-0">
            Guide for Authors →
          </Link>
        </div>
      </div>
    </div>
  )
}
