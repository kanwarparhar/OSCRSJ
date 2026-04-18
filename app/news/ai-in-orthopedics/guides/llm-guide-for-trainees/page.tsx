import type { Metadata } from 'next'
import Link from 'next/link'
import { buildBreadcrumbSchema } from '@/lib/schema/breadcrumb'

export const metadata: Metadata = {
  title: 'Large Language Models for Orthopedic Trainees: What\u2019s Safe, What\u2019s Not',
  description:
    'A reference guide from OSCRSJ on the safe and unsafe uses of large language models for orthopedic residents, fellows, and medical students. Covers studying, writing, citation verification, PHI, and authoritative guidance from ICMJE, WAME, and AAOS.',
  keywords: [
    'ChatGPT orthopedic residents',
    'LLM medical trainees',
    'AI in medical education',
    'ICMJE AI authorship',
    'WAME chatbot disclosure',
    'AAOS AI guidance',
    'HIPAA language model',
  ],
  alternates: {
    canonical: 'https://www.oscrsj.com/news/ai-in-orthopedics/guides/llm-guide-for-trainees',
  },
  openGraph: {
    title: 'Large Language Models for Orthopedic Trainees: What\u2019s Safe, What\u2019s Not',
    description:
      'Practical and ethical guidance on LLM use for research, studying, writing, and patient-facing tasks. Institutional reference by OSCRSJ.',
    url: 'https://www.oscrsj.com/news/ai-in-orthopedics/guides/llm-guide-for-trainees',
    type: 'article',
  },
}

export default function LlmGuideForTrainees() {
  const breadcrumbLd = buildBreadcrumbSchema([
    { name: 'News', url: 'https://www.oscrsj.com/news' },
    { name: 'AI in Orthopedics', url: 'https://www.oscrsj.com/news/ai-in-orthopedics' },
    { name: 'Guides', url: 'https://www.oscrsj.com/news/ai-in-orthopedics' },
    {
      name: 'Large Language Models for Orthopedic Trainees: What\u2019s Safe, What\u2019s Not',
      url: 'https://www.oscrsj.com/news/ai-in-orthopedics/guides/llm-guide-for-trainees',
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
        <Link href="/news" className="hover:text-brown-dark transition-colors">
          News
        </Link>
        <span className="mx-2">/</span>
        <Link href="/news/ai-in-orthopedics" className="hover:text-brown-dark transition-colors">
          AI in Orthopedics
        </Link>
        <span className="mx-2">/</span>
        <span className="text-brown-dark">Guides</span>
      </nav>

      {/* Label */}
      <div className="flex items-center gap-3 mb-4">
        <span className="text-xs font-medium text-brown bg-peach/40 px-3 py-1 rounded-full">
          Reference Guide
        </span>
        <span className="text-xs text-brown">Last reviewed April 2026</span>
      </div>

      {/* Headline */}
      <h1
        className="font-serif text-brown-dark font-normal mb-5"
        style={{ fontSize: 'clamp(28px, 3.5vw, 40px)', letterSpacing: '-0.02em', lineHeight: 1.15 }}
      >
        Large Language Models for Orthopedic Trainees: What&rsquo;s Safe, What&rsquo;s Not
      </h1>

      <p className="text-base text-tan leading-relaxed mb-10 pb-8 border-b border-border">
        A reference guide by OSCRSJ for residents, fellows, and medical students on practical and ethical use of large language models in training, research, and clinical work.
      </p>

      {/* Body */}
      <div className="space-y-10 text-brown-dark leading-relaxed">
        <section>
          <p>
            The question is not whether orthopedic trainees should use large language models. Most already do. The question is where use is appropriate, where it is risky, and where it is explicitly prohibited by current publishing and practice standards. This guide is a working reference, not an endorsement of any particular tool or workflow. It reflects the state of the field at the time of writing and will be updated as authoritative guidance evolves.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-xl text-brown-dark mb-3">What a large language model actually is</h2>
          <p>
            A large language model is a neural network trained to predict text. Given an input, it produces a plausible continuation. Models such as ChatGPT, Claude, and DeepSeek can summarize journal articles, draft clinical notes, answer study questions, and generate code. They are not databases, search engines, or peer reviewers. They do not have live access to PubMed, to hospital records, or to the most recent literature unless they are connected to an external retrieval system. Output quality depends heavily on the prompt, and the same model can return different answers to functionally identical questions. Most critically, large language models can produce fluent text that is false. This failure mode, known as hallucination, is a well-documented property of the architecture.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-xl text-brown-dark mb-3">Where LLM use is generally safe for trainees</h2>
          <p className="mb-4">
            Three categories of use are low risk when output is verified against primary sources.
          </p>
          <div className="space-y-4">
            <div>
              <h3 className="font-serif text-base text-brown-dark mb-1">Studying and comprehension</h3>
              <p>
                A language model can explain concepts, generate practice questions, and rephrase dense passages from a textbook or paper. Trainees should still verify any factual claim against the source material before relying on it for exams or clinical decisions.
              </p>
            </div>
            <div>
              <h3 className="font-serif text-base text-brown-dark mb-1">Writing assistance on trainee-authored work</h3>
              <p>
                Language models can improve clarity, grammar, and flow in a draft the trainee has already written. This is consistent with ICMJE guidance as long as the model is acknowledged and the human author remains responsible for every claim in the final text. Language models cannot be listed as authors. They do not meet ICMJE authorship criteria because they cannot take accountability for the work.
              </p>
            </div>
            <div>
              <h3 className="font-serif text-base text-brown-dark mb-1">Code and statistical assistance for research</h3>
              <p>
                Language models are frequently used to write or debug analysis code in R or Python. Code should be read, understood, and tested before it is applied to real data, and the use should be disclosed if the resulting work is published.
              </p>
            </div>
          </div>
        </section>

        <section>
          <h2 className="font-serif text-xl text-brown-dark mb-3">Where LLM use is not safe</h2>
          <p className="mb-4">
            Several categories of use are either prohibited or carry material clinical and academic risk.
          </p>
          <div className="space-y-4">
            <div>
              <h3 className="font-serif text-base text-brown-dark mb-1">Entering protected health information</h3>
              <p>
                Most consumer language model interfaces transmit input data to the vendor&rsquo;s servers, where it may be retained or used for training. Entering patient names, medical record numbers, dates of birth, or other identifiable data into a public model is a HIPAA violation in US institutions and a parallel violation under most international frameworks. HIPAA-compliant enterprise agreements exist at some health systems; default consumer interfaces do not qualify.
              </p>
            </div>
            <div>
              <h3 className="font-serif text-base text-brown-dark mb-1">Generating citations without verification</h3>
              <p>
                Language models routinely fabricate citations, producing plausible-looking journal names, author lists, volumes, and DOIs that do not correspond to real papers. Every citation produced by a language model must be verified in PubMed or on the publisher&rsquo;s website before it enters a manuscript, case report, or clinical note. Submission of fabricated references is a research integrity violation and is grounds for manuscript rejection and retraction.
              </p>
            </div>
            <div>
              <h3 className="font-serif text-base text-brown-dark mb-1">Answering guideline-sensitive clinical questions without checking the guideline</h3>
              <p>
                A language model may produce an answer that is close to but not fully concordant with the current AAOS clinical practice guideline, ACGME requirement, or specialty society position. Published benchmark studies have found that general-purpose models follow published guidelines in roughly 70 to 85 percent of cases, depending on topic. Trainees should treat model output as a starting point for literature review, not as a substitute for the guideline itself.
              </p>
            </div>
            <div>
              <h3 className="font-serif text-base text-brown-dark mb-1">Patient-facing communication without physician review</h3>
              <p>
                A language model can draft patient education materials, discharge summaries, or letter responses. These outputs must be reviewed and edited by a licensed physician before they are given to a patient. Direct, unreviewed patient-facing use is prohibited in most institutional AI policies.
              </p>
            </div>
          </div>
        </section>

        <section>
          <h2 className="font-serif text-xl text-brown-dark mb-3">What the authoritative bodies say</h2>
          <p className="mb-4">
            Three sources currently define the boundaries of acceptable LLM use in biomedical research and practice.
          </p>
          <p className="mb-3">
            The <strong>International Committee of Medical Journal Editors (ICMJE)</strong> states that artificial intelligence tools do not qualify for authorship and that use of AI in manuscript preparation must be disclosed. The journal is responsible for all content, and authors must be able to vouch for the accuracy and originality of the work. OSCRSJ follows the ICMJE standard on this point.
          </p>
          <p className="mb-3">
            The <strong>World Association of Medical Editors (WAME)</strong> offers parallel guidance. AI-generated content must be disclosed. Chatbots cannot be authors. The corresponding author is responsible for any AI-assisted content.
          </p>
          <p>
            The <strong>American Academy of Orthopaedic Surgeons (AAOS)</strong> has published position content on AI in orthopedic practice emphasizing that AI tools are adjuncts, not substitutes for clinical judgment, and that responsibility for patient care remains with the treating surgeon.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-xl text-brown-dark mb-3">A working framework for trainees</h2>
          <p className="mb-4">Four principles summarize current safe use:</p>
          <ol className="list-decimal pl-6 space-y-2">
            <li>
              <strong>Verify every factual claim</strong> against a primary source before relying on it.
            </li>
            <li>
              <strong>Cite the original literature</strong>, not the language model, and verify that every citation corresponds to a real paper.
            </li>
            <li>
              <strong>Disclose AI assistance</strong> in any submitted manuscript per the target journal&rsquo;s policy.
            </li>
            <li>
              <strong>Never enter patient data</strong> into a consumer language model interface.
            </li>
          </ol>
          <p className="mt-4">
            Use at the level of reading comprehension, writing polish, and code scaffolding is well within current norms. Use at the level of independent clinical decision-making, unverified citation generation, or patient communication is not.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-xl text-brown-dark mb-3">How OSCRSJ handles AI-assisted submissions</h2>
          <p>
            Authors submitting to OSCRSJ must disclose the use of any large language model, generative AI system, or AI writing assistant in the preparation of the manuscript. Disclosure is made in the submission portal&rsquo;s declarations step and reproduced in the published article. Disclosed use does not reduce the editorial or peer-review standard applied to the manuscript, and editors may request additional verification of methods, citations, or figures if AI involvement is substantial. Language models cannot be listed as authors. The corresponding author remains responsible for the accuracy of every claim, citation, and figure in the submission. Manuscripts found to contain fabricated citations or unverified AI-generated content are rejected and, if already published, retracted per COPE guidelines.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-xl text-brown-dark mb-3">When this guide will be updated</h2>
          <p>
            This guide is reviewed each quarter and revised when ICMJE, WAME, AAOS, or relevant regulatory bodies update their positions. The current revision reflects guidance available as of April 2026.
          </p>
        </section>
      </div>

      {/* Cross-links */}
      <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Link
          href="/news/ai-in-orthopedics/guides/imaging-primer-for-residents"
          className="bg-white border border-border rounded-lg px-4 py-3 text-sm text-brown-dark hover:border-tan hover:shadow-sm transition-all"
        >
          Companion: Imaging Primer for Residents &rarr;
        </Link>
        <Link
          href="/news/ai-in-orthopedics#glossary"
          className="bg-white border border-border rounded-lg px-4 py-3 text-sm text-brown-dark hover:border-tan hover:shadow-sm transition-all"
        >
          AI in Orthopedics Glossary &rarr;
        </Link>
      </div>

      {/* Submit CTA */}
      <div className="mt-12 bg-gradient-to-br from-tan/10 to-cream-alt border border-peach/20 rounded-2xl p-8 text-center">
        <h3 className="font-serif text-xl text-brown-dark mb-2">Writing an AI-assisted manuscript?</h3>
        <p className="text-sm text-brown-dark/80 leading-relaxed mb-5 max-w-lg mx-auto">
          OSCRSJ accepts case reports and series on novel AI-assisted diagnoses and surgical planning, with clear AI-disclosure policy. Free to publish in 2026.
        </p>
        <Link href="/submit" className="btn-primary-light">
          Submit a manuscript
        </Link>
      </div>

      {/* Disclaimer */}
      <p className="text-xs text-brown leading-relaxed mt-10">
        This guide is an editorial reference for educational purposes. It is not legal, regulatory, or institutional compliance advice. Readers should consult their local institutional AI, research integrity, and HIPAA compliance offices before adopting new workflows.
      </p>
    </article>
  )
}
