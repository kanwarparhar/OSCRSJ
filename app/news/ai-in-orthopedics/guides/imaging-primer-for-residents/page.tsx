import type { Metadata } from 'next'
import Link from 'next/link'
import { buildBreadcrumbSchema } from '@/lib/schema/breadcrumb'

export const metadata: Metadata = {
  title: 'AI in Orthopedic Imaging: A 2026 Primer for Residents',
  description:
    'A structured reference from OSCRSJ on AI in orthopedic imaging. Covers how AI imaging tools are built, what is in clinical use, what remains in research, and how to read a validation study critically.',
  keywords: [
    'AI orthopedic imaging',
    'deep learning fracture detection',
    'AI MRI segmentation',
    'automated Cobb angle',
    'AI osteoarthritis grading',
    'external validation medical AI',
    'PACS DICOM AI',
  ],
  alternates: {
    canonical: 'https://www.oscrsj.com/news/ai-in-orthopedics/guides/imaging-primer-for-residents',
  },
  openGraph: {
    title: 'AI in Orthopedic Imaging: A 2026 Primer for Residents',
    description:
      'What AI imaging tools actually do, which applications are in clinical use, which remain in research, and how to read a validation study critically.',
    url: 'https://www.oscrsj.com/news/ai-in-orthopedics/guides/imaging-primer-for-residents',
    type: 'article',
  },
}

export default function ImagingPrimerForResidents() {
  const breadcrumbLd = buildBreadcrumbSchema([
    { name: 'News', url: 'https://www.oscrsj.com/news' },
    { name: 'AI in Orthopedics', url: 'https://www.oscrsj.com/news/ai-in-orthopedics' },
    { name: 'Guides', url: 'https://www.oscrsj.com/news/ai-in-orthopedics' },
    {
      name: 'AI in Orthopedic Imaging: A 2026 Primer for Residents',
      url: 'https://www.oscrsj.com/news/ai-in-orthopedics/guides/imaging-primer-for-residents',
    },
  ])

  return (
    <article className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
      />
      {/* Breadcrumb */}
      <nav className="text-xs text-brown mb-6">
        <Link href="/news" className="hover:text-ink transition-colors">
          News
        </Link>
        <span className="mx-2">/</span>
        <Link href="/news/ai-in-orthopedics" className="hover:text-ink transition-colors">
          AI in Orthopedics
        </Link>
        <span className="mx-2">/</span>
        <span className="text-ink">Guides</span>
      </nav>

      {/* Label */}
      <div className="flex items-center gap-3 mb-4">
        <span className="text-xs font-medium text-brown bg-peach/40 px-3 py-1 rounded-full">
          Reference Primer
        </span>
        <span className="text-xs text-brown">Last reviewed April 2026</span>
      </div>

      {/* Headline */}
      <h1
        className="font-serif text-brown-dark font-normal mb-5"
        style={{ fontSize: 'clamp(28px, 3.5vw, 40px)', letterSpacing: '-0.02em', lineHeight: 1.15 }}
      >
        AI in Orthopedic Imaging: A 2026 Primer for Residents
      </h1>

      <p className="text-base text-brown leading-relaxed mb-10 pb-8 border-b border-border">
        A structured entry point to the AI-in-imaging literature for orthopedic residents, fellows, and medical students. Written in institutional voice by OSCRSJ.
      </p>

      {/* Body */}
      <div className="space-y-10 text-ink leading-relaxed">
        <section>
          <p>
            This primer is written for orthopedic residents, fellows, and medical students who want a structured entry point to the AI-in-imaging literature. It describes what AI tools in orthopedic imaging actually do, which applications have moved into clinical use, which remain in research, and how to read a validation study critically. It does not recommend specific products and does not reproduce figures from paywalled sources.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-xl text-brown-dark mb-3">How an AI imaging tool is built</h2>
          <p className="mb-4">
            An AI imaging tool is a statistical model, typically a deep neural network, trained on a labeled dataset to perform a defined task on medical images. In orthopedics, the common tasks are classification (fracture present or absent), grading (for example Kellgren-Lawrence osteoarthritis severity), segmentation (such as cartilage or meniscus outlines on MRI), and landmark detection (measurement points for Cobb angle or mechanical axis).
          </p>
          <p>
            The development pipeline is the same across tasks. A large set of labeled images is partitioned into training, validation, and test sets. The model learns on the training set, is tuned on the validation set, and is evaluated on the held-out test set. Performance is reported using metrics such as sensitivity, specificity, area under the ROC curve (AUC), Dice coefficient for segmentation, and mean absolute error for continuous measurements. External validation on data from other institutions, scanners, or populations is the standard for judging whether a model will generalize.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-xl text-brown-dark mb-3">What is in clinical use today</h2>
          <p className="mb-4">
            Several categories of AI imaging tools are FDA-cleared and integrated into hospital workflows in the United States and comparable regulatory environments abroad. Clearance does not mean the tool has replaced the radiologist or the orthopedic surgeon. All cleared tools operate as adjuncts, typically flagging findings for review or automating a measurement that a physician confirms.
          </p>

          <div className="space-y-5">
            <div>
              <h3 className="font-serif text-base text-brown-dark mb-1">Fracture detection on plain radiographs</h3>
              <p>
                This is the most mature category. Multiple commercial tools are cleared for use as secondary readers on hand, wrist, hip, and shoulder radiographs, among other body regions. The evidence base includes prospective and retrospective reader studies, with performance that varies meaningfully across bone, fracture pattern, and patient demographic. Systematic reviews in the orthopedic and radiology literature have summarized the range. When reading a specific tool&rsquo;s claims, the relevant questions are: which body region, which fracture type, which ground truth reader, and whether performance was maintained on external validation.
              </p>
            </div>

            <div>
              <h3 className="font-serif text-base text-brown-dark mb-1">Osteoarthritis severity grading on knee and hip radiographs</h3>
              <p>
                A second category in clinical or near-clinical use. Models trained to predict Kellgren-Lawrence grade show substantial agreement with expert musculoskeletal radiologists in aggregate, but disagree in a minority of cases, particularly at intermediate grades where expert reliability is also lower. Automated grading is useful for research cohorts and increasingly for clinical triage.
              </p>
            </div>

            <div>
              <h3 className="font-serif text-base text-brown-dark mb-1">Spine deformity measurement</h3>
              <p>
                Automated Cobb angle measurement from standing radiographs is available in several imaging vendors&rsquo; tools and is used in pediatric and adolescent idiopathic scoliosis follow-up. Reported accuracy versus expert readers in recent validation studies is within clinically acceptable ranges for follow-up imaging, though edge cases with rotated vertebrae or poor image quality remain a known limitation.
              </p>
            </div>

            <div>
              <h3 className="font-serif text-base text-brown-dark mb-1">Knee MRI segmentation</h3>
              <p>
                Automated cartilage, meniscus, bone, and effusion segmentation is in active clinical research use and is beginning to enter clinical workflows through vendor integrations. The primary use is research throughput and longitudinal measurement rather than routine diagnosis.
              </p>
            </div>
          </div>
        </section>

        <section>
          <h2 className="font-serif text-xl text-brown-dark mb-3">What is still in research</h2>
          <p className="mb-4">
            Several promising categories have not yet entered routine clinical use.
          </p>

          <div className="space-y-4">
            <div>
              <h3 className="font-serif text-base text-brown-dark mb-1">Tumor and lesion classification</h3>
              <p>
                Tumor and lesion classification on radiographs, CT, and MRI is under active investigation. The published literature includes promising single-center results on bone tumor classification, but external validation across institutions, scanners, and rare lesion types is limited. Clinical deployment at specialty centers is emerging; general deployment is not.
              </p>
            </div>
            <div>
              <h3 className="font-serif text-base text-brown-dark mb-1">Intraoperative imaging applications</h3>
              <p>
                AI-assisted fluoroscopy and real-time guidance during fracture reduction or implant placement are in early clinical use. The evidence base is primarily technical validation and small case series.
              </p>
            </div>
            <div>
              <h3 className="font-serif text-base text-brown-dark mb-1">Outcome prediction from preoperative imaging</h3>
              <p>
                Predicting revision surgery risk from a pre-TKA knee radiograph or progression of adolescent scoliosis from initial films is an area of strong research activity without routine clinical deployment.
              </p>
            </div>
          </div>
        </section>

        <section>
          <h2 className="font-serif text-xl text-brown-dark mb-3">How to read an AI imaging study critically</h2>
          <p className="mb-4">
            A small number of questions separate a rigorous validation study from a marketing exercise.
          </p>
          <div className="space-y-3">
            <div>
              <h3 className="font-serif text-base text-brown-dark">Were sensitivity and specificity reported together?</h3>
              <p>
                A model with 95 percent sensitivity and 60 percent specificity floods the clinical workflow with false positives. A single headline number in isolation is a flag.
              </p>
            </div>
            <div>
              <h3 className="font-serif text-base text-brown-dark">Was external validation performed?</h3>
              <p>
                Performance on the development cohort is the floor, not the ceiling. External validation on data from a different institution, scanner, or population is the standard for clinical relevance. Studies reporting only internal test-set performance are preliminary.
              </p>
            </div>
            <div>
              <h3 className="font-serif text-base text-brown-dark">What was the ground truth?</h3>
              <p>
                A model compared against a single resident&rsquo;s read is less trustworthy than one compared against consensus of multiple subspecialty-trained radiologists, with intraoperative or pathology confirmation where available.
              </p>
            </div>
            <div>
              <h3 className="font-serif text-base text-brown-dark">Did the study account for prevalence?</h3>
              <p>
                Positive predictive value and negative predictive value depend on the prevalence of the condition in the target population. A model validated on a high-prevalence research cohort may perform differently in a general emergency department setting.
              </p>
            </div>
            <div>
              <h3 className="font-serif text-base text-brown-dark">Was the reader study design appropriate?</h3>
              <p>
                Retrospective studies in which radiologists read with and without AI assistance are common and useful. Fully prospective deployment studies are rarer and more informative.
              </p>
            </div>
            <div>
              <h3 className="font-serif text-base text-brown-dark">What did the model miss?</h3>
              <p>
                Every serious paper reports failure cases. Studies that do not describe failure modes are incomplete.
              </p>
            </div>
          </div>
        </section>

        <section>
          <h2 className="font-serif text-xl text-brown-dark mb-3">Clinical integration</h2>
          <p>
            AI imaging tools in clinical use are typically integrated at the PACS level. The tool consumes DICOM inputs, runs inference on a local or cloud server, and returns results as an annotation layer or a secondary report. Workflow integration, alert fatigue, and trust calibration in the human reader are active areas of clinical research and are often the limiting factor in adoption, separate from algorithm performance.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-xl text-brown-dark mb-3">Where this primer will be updated</h2>
          <p>
            This reference will be updated as FDA clearances evolve, as major systematic reviews are published, and as the orthopedic society positions develop. Readers are encouraged to consult the most recent society guidance from AAOS, the Radiological Society of North America (RSNA), and the journal-level literature for up-to-date specifics.
          </p>
          <p className="mt-4">
            OSCRSJ does not recommend specific commercial products. Individual briefs in the AI in Orthopedics hub summarize peer-reviewed validation studies on named tools; readers should consult primary sources and local institutional review before integrating any AI tool into clinical practice.
          </p>
        </section>
      </div>

      {/* Cross-links */}
      <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Link
          href="/news/ai-in-orthopedics/guides/llm-guide-for-trainees"
          className="bg-white border border-border rounded-lg px-4 py-3 text-sm text-ink hover:border-tan hover:shadow-sm transition-all"
        >
          Companion: LLM Guide for Trainees &rarr;
        </Link>
        <Link
          href="/news/ai-in-orthopedics/imaging"
          className="bg-white border border-border rounded-lg px-4 py-3 text-sm text-ink hover:border-tan hover:shadow-sm transition-all"
        >
          Latest briefs: AI in Imaging &rarr;
        </Link>
      </div>

      {/* Submit CTA */}
      <div className="mt-12 bg-gradient-to-br from-tan/10 to-cream-alt border border-peach/20 rounded-2xl p-8 text-center">
        <h3 className="font-serif text-xl text-brown-dark mb-2">Publishing AI imaging research?</h3>
        <p className="text-sm text-ink/80 leading-relaxed mb-5 max-w-lg mx-auto">
          OSCRSJ accepts case reports and series on novel AI-assisted diagnoses and surgical planning. Free to publish for manuscripts submitted before August 1, 2026.
        </p>
        <Link href="/submit" className="btn-primary-light">
          Submit a manuscript
        </Link>
      </div>

      {/* Disclaimer */}
      <p className="text-xs text-brown leading-relaxed mt-10">
        This primer is an editorial reference for educational purposes. It is not a clinical recommendation, endorsement, or substitute for the primary literature or local institutional protocol. Always consult the source paper and applicable specialty-society guidelines before changing practice.
      </p>
    </article>
  )
}
