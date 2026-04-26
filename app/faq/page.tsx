import type { Metadata } from 'next'
import Link from 'next/link'
import PageHeader from '@/components/PageHeader'

export const metadata: Metadata = {
  title: 'Author FAQ - OSCRSJ',
  description: 'Frequently asked questions about submitting to OSCRSJ, peer review timelines, APCs, waivers, formatting, and publication.',
}

/* ------------------------------------------------------------------ */
/*  FAQ data                                                           */
/* ------------------------------------------------------------------ */

const faqSections = [
  {
    label: 'Submission & Eligibility',
    questions: [
      {
        q: 'Who can submit to OSCRSJ?',
        a: 'Anyone involved in orthopedic surgery or musculoskeletal medicine, including medical students, residents, fellows, attending surgeons, and allied health professionals. We particularly welcome submissions from trainees. All submissions must have at least one supervising physician as a co-author.',
      },
      {
        q: 'What types of articles does OSCRSJ accept?',
        a: 'We accept Case Reports (1-3 patients), Case Series (4+ patients), Surgical Techniques, Images in Orthopedics, Letters to the Editor, and invited Review Articles. See our Guide for Authors for detailed requirements for each article type.',
      },
      {
        q: 'Can I submit a case that has been presented at a conference?',
        a: 'Yes. Conference presentations (posters or podium) do not constitute prior publication. However, the manuscript must contain substantially more detail than the conference abstract. Please disclose any prior presentations in your cover letter.',
      },
      {
        q: 'Can I submit a case report from a patient treated at any institution?',
        a: 'Yes. There are no institutional restrictions. However, you must comply with your institution\'s IRB requirements and obtain written patient consent for publication.',
      },
      {
        q: 'What subspecialties are covered?',
        a: 'All orthopedic subspecialties: trauma, spine, sports medicine, arthroplasty/joint reconstruction, hand and upper extremity, foot and ankle, pediatric orthopedics, and musculoskeletal oncology.',
      },
      {
        q: 'How do I submit my manuscript?',
        a: 'All submissions are handled through our online submission portal. Visit oscrsj.com/submit, register for a free author account (or sign in with your ORCID iD), and follow the 5-step submission wizard: choose your article type, upload your files (title page, blinded manuscript, figures, tables, reporting checklist), enter your manuscript details and keywords, add your co-authors and ICMJE contributions, and complete the declarations (conflicts of interest, funding, ethics, patient consent). Your draft is auto-saved at every step and you can return to finish later. The portal accepts .docx for manuscripts and TIFF/PNG/JPEG (≥300 DPI) for figures.',
      },
    ],
  },
  {
    label: 'Review Process',
    questions: [
      {
        q: 'What type of peer review does OSCRSJ use?',
        a: 'Double-blind peer review. Neither authors nor reviewers know each other\'s identities during the review process.',
      },
      {
        q: 'How long does the review process take?',
        a: 'Our target turnaround is 10 days from submission to first decision and 35 days from acceptance to publication. Initial editorial screening completes within 1–2 business days; if your manuscript passes screening, peer review runs in parallel by at least two reviewers and we issue an editorial decision within 10 days total. Images in Orthopedics undergo expedited review (7–10 days).',
      },
      {
        q: 'How many reviewers evaluate each manuscript?',
        a: 'Each manuscript is evaluated by at least two independent reviewers with expertise in the relevant orthopedic subspecialty, plus an associate editor.',
      },
      {
        q: 'What are the possible editorial decisions?',
        a: 'Accept, Minor Revision, Major Revision, or Reject. Most manuscripts require at least one round of revisions. A request for revision is a positive sign that the editorial team sees value in your work.',
      },
      {
        q: 'How long do I have to submit revisions?',
        a: '14 days for minor revisions, 30 days for major revisions. Extensions may be granted upon request by contacting the editorial office.',
      },
      {
        q: 'What is double-blind peer review?',
        a: 'In double-blind review, neither the authors nor the reviewers know each other\'s identities. This ensures that every submission is evaluated solely on its scientific merit, clinical significance, and adherence to reporting standards.',
      },
    ],
  },
  {
    label: 'Fees & Open Access',
    questions: [
      {
        q: 'Is there a submission fee?',
        a: 'No. OSCRSJ does not charge any fees for submission or peer review. Fees only apply if your manuscript is accepted for publication.',
      },
      {
        q: 'What is the Article Processing Charge (APC)?',
        a: 'During our launch year (2026), the APC is waived entirely. Starting in 2027, the APC will be $299 per accepted article. See our APC page for the full fee schedule and future pricing.',
      },
      {
        q: 'Are APC waivers available?',
        a: 'Yes. We offer: 100% waiver for authors from low-income countries (World Bank classification), 50% waiver for authors from lower-middle-income countries or PGY-1/PGY-2 residents and medical students, and 25% discount for authors publishing their first-ever peer-reviewed article. Waiver requests must be submitted at the time of manuscript submission.',
      },
      {
        q: 'Is OSCRSJ open access?',
        a: 'Yes. All published articles are immediately and permanently free to read, download, and share for non-commercial purposes under a Creative Commons Attribution-NonCommercial-NoDerivatives (CC BY-NC-ND 4.0) license.',
      },
      {
        q: 'Does OSCRSJ assign DOIs?',
        a: 'Yes. Every published article receives a unique Digital Object Identifier (DOI) via Crossref, making it permanently citable and discoverable.',
      },
    ],
  },
  {
    label: 'Formatting & Technical',
    questions: [
      {
        q: 'What file format should I use for submission?',
        a: 'Microsoft Word (.docx). A typical submission consists of a separate Title Page (with author info), the blinded manuscript (which begins at the Abstract — no author info inside), a Tables.docx file if your manuscript has tables, and each figure as a separate high-resolution image file (TIFF, PNG, or JPEG; minimum 300 DPI; 600 DPI recommended). Do NOT embed figures or tables inside the manuscript file. Use the article-type-matched templates at oscrsj.com/templates — they have the correct format pre-applied (Times New Roman 12pt, double-spaced, line numbering on, italic-only headings, hard page break before References).',
      },
      {
        q: 'Do I need to follow a specific reference style?',
        a: 'Yes. Vancouver style (numbered, in order of appearance). See our Guide for Authors for formatting examples.',
      },
      {
        q: 'Is the CARE checklist required?',
        a: 'Yes, for all case report submissions. For case series, the JBI Critical Appraisal Checklist is required. Both should be submitted as supplementary files. Manuscripts submitted without the appropriate checklist will be returned to authors.',
      },
      {
        q: 'How should I handle patient consent?',
        a: 'Written informed consent for publication must be obtained from the patient (or their legal guardian, or next of kin if the patient is deceased) before submission. The canonical OSCRSJ consent statements (5 variants — adult, pediatric, deceased, verbal-witnessed, IRB waiver) are at oscrsj.com/templates#consent. Copy the variant matching your patient situation verbatim into your manuscript at the appropriate point (typically near the end of the Case Presentation section, or in the Methods of a case series). Do not paraphrase. You may use your institution\'s own consent form to obtain the consent itself; do not upload the signed consent form unless requested by the editor.',
      },
      {
        q: 'What are the word limits for each article type?',
        a: 'Case Report: 2,000 words. Case Series: 3,000 words. Surgical Technique: 1,500 words. Images in Orthopedics: 500 words. Letter to the Editor: 600 words. Review Article: 3,500 words. All word limits exclude the abstract, references, figure legends, and tables.',
      },
    ],
  },
  {
    label: 'After Publication',
    questions: [
      {
        q: 'How quickly are accepted articles published?',
        a: 'Accepted articles are typically published online within 14 days of final acceptance. Articles are published online first and then included in the next monthly issue.',
      },
      {
        q: 'Is OSCRSJ indexed in PubMed?',
        a: 'OSCRSJ is currently pursuing indexing. Our roadmap includes DOAJ listing, Crossref registration, and application to PubMed Central (PMC). We will update this page as indexing milestones are achieved.',
      },
      {
        q: 'Can I share my published article on social media or my personal website?',
        a: 'Absolutely. As an open-access journal with CC BY-NC-ND 4.0 licensing, you are encouraged to share your work widely for non-commercial purposes (teaching, social media, your personal website, conference handouts). We provide shareable links and citation information for every published article. Authors retain copyright and may reuse their own work without restriction.',
      },
      {
        q: 'How do I correct an error in a published article?',
        a: 'Contact the editorial office at editor@oscrsj.com. Minor errors are addressed through a published erratum. Significant errors that affect the conclusions may require a correction notice or, in rare cases, retraction in accordance with COPE guidelines.',
      },
      {
        q: 'Will my article appear on Google Scholar?',
        a: 'Yes. All OSCRSJ articles are indexed by Google Scholar automatically. Additionally, Crossref DOI registration ensures your article is discoverable across major academic search engines and databases.',
      },
    ],
  },
]

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function FAQPage() {
  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqSections.flatMap((s) =>
      s.questions.map((q) => ({
        '@type': 'Question',
        name: q.q,
        acceptedAnswer: { '@type': 'Answer', text: q.a },
      }))
    ),
  }

  return (
    <div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <PageHeader
        label="For Authors"
        title="Frequently Asked Questions"
        subtitle="Common questions about submitting, peer review, fees, and publication at OSCRSJ."
      />

      <div className="max-w-content mx-auto px-4 sm:px-6 lg:px-8 py-20">

        {/* Jump links */}
        <div className="bg-cream-alt border border-border rounded-xl p-5 mb-12">
          <p className="text-xs font-semibold text-brown uppercase tracking-widest mb-3">Categories</p>
          <div className="flex flex-wrap gap-2">
            {faqSections.map((s) => (
              <a
                key={s.label}
                href={`#${s.label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}
                className="text-xs text-ink hover:text-brown transition-colors px-3 py-2 bg-white border border-border rounded-lg hover:border-tan font-medium"
              >
                {s.label}
              </a>
            ))}
          </div>
        </div>

        {/* FAQ sections */}
        {faqSections.map((section, si) => (
          <section
            key={section.label}
            id={section.label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}
            className={`scroll-mt-24 ${si > 0 ? 'mt-14 pt-14 border-t border-border' : ''}`}
          >
            <span className="section-label">{section.label}</span>
            <h2 className="section-heading mb-6">{section.label}</h2>
            <div className="space-y-4 max-w-3xl">
              {section.questions.map((faq) => (
                <div key={faq.q} className="bg-white border border-border rounded-xl p-6">
                  <h3 className="font-semibold text-ink mb-2 text-sm">{faq.q}</h3>
                  <p className="text-sm text-ink leading-relaxed">{faq.a}</p>
                </div>
              ))}
            </div>
          </section>
        ))}

        {/* CTA */}
        <div className="mt-14 bg-tan/20 border border-peach/30 rounded-xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <p className="font-semibold text-ink">Still have questions?</p>
            <p className="text-sm text-brown mt-0.5">Our editorial team is here to help.</p>
          </div>
          <Link href="/contact" className="btn-primary-light flex-shrink-0">
            Contact Us
          </Link>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 mt-6">
          <Link href="/guide-for-authors" className="btn-outline">Guide for Authors</Link>
          <Link href="/apc" className="btn-outline">APC Fees</Link>
          <Link href="/submit" className="btn-outline">Submit a Manuscript</Link>
        </div>
      </div>
    </div>
  )
}
