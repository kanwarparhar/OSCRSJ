import type { Metadata } from 'next'
import Link from 'next/link'
import PageHeader from '@/components/PageHeader'

export const metadata: Metadata = {
  title: 'OSCRSJ Research Scholars',
  description:
    'A structured research-training program for pre-med students, medical students, and IMG candidates. Real journal, real Cochrane-trained methodology, real peer review. Publication of any work is conditional on independent peer review.',
  alternates: { canonical: 'https://www.oscrsj.com/scholars' },
  openGraph: {
    title: 'OSCRSJ Research Scholars',
    description:
      'A structured research-training program for pre-med students, medical students, and IMG candidates — Cochrane-trained methodology and mentorship, peer-reviewed journal output.',
    url: 'https://www.oscrsj.com/scholars',
    type: 'website',
  },
}

interface Tier {
  label: string
  price: string
  duration: string
  highlights: string[]
}

interface Track {
  id: string
  name: string
  audience: string
  blurb: string
  tiers: Tier[]
}

const TRACKS: Track[] = [
  {
    id: 'pre-med',
    name: 'Pre-Med Scholar',
    audience: 'For pre-med students',
    blurb:
      'Equips students early with the research skills needed to be competitive applicants to surgical specialties — particularly students with no medical school guidance or first-generation pre-meds.',
    tiers: [
      {
        label: 'Tier 1',
        price: '$499',
        duration: '6 months',
        highlights: [
          'Middle author on one database study supervised by a med student',
          'Abstract + manuscript writing instruction',
          'Zotero reference-management training',
          'Monthly project meeting + monthly "how to match into med school" Q&A',
          'Conference presentation / poster as the project goal',
        ],
      },
      {
        label: 'Tier 2',
        price: '$999',
        duration: '1 year',
        highlights: [
          'Two research projects (one first-author on a database study OR second author on SR/MA)',
          'Mock interview with feedback',
          'Pre-med to residency path roadmap workshop',
          'Conditional medical-school LOR on successful completion of 2 projects + 1 conference presentation',
          'Monthly project meeting + monthly "how to match" Q&A',
        ],
      },
    ],
  },
  {
    id: 'med-student',
    name: 'Med Student Scholar',
    audience: 'For medical students',
    blurb:
      'Best for med students at schools without a home orthopedics program — or those wanting more research experience to be competitive for surgical residencies.',
    tiers: [
      {
        label: 'Tier 1',
        price: '$499',
        duration: '6 months',
        highlights: [
          '2-3 research projects, including one first-author project',
          'Abstract + manuscript writing instruction',
          'Zotero reference-management training',
          'How to respond to reviewer feedback',
          'Monthly project meeting',
        ],
      },
      {
        label: 'Tier 2',
        price: '$999',
        duration: '1 year',
        highlights: [
          '5-6 research projects (mix of SR/MA + database studies)',
          '2-3 first-author projects',
          'Full conference planning + submission support',
          'Shared calendar with all submission dates',
          'Away rotation planning + academic-researcher outreach templates',
        ],
      },
    ],
  },
  {
    id: 'img',
    name: 'IMG Scholar',
    audience: 'For international medical graduates',
    blurb:
      'US research credentials and mentor letters from US-practicing orthopedic surgeons — for IMGs applying through ECFMG to US residency.',
    tiers: [
      {
        label: '',
        price: '$299',
        duration: '6 months',
        highlights: [
          '2-3 research projects — all first-author (deliberate)',
          'Abstract + manuscript writing instruction',
          'Zotero reference-management training',
          'How to respond to reviewer feedback',
          'Monthly project meeting',
        ],
      },
    ],
  },
]

const FAQ_ENTRIES: Array<{ question: string; answer: string }> = [
  {
    question: 'Who is the ideal candidate for this program?',
    answer:
      'We see this as a learning opportunity in the world of research — how to be efficient in writing manuscripts and abstracts, while working on real projects that let you have meaningful conversations with PDs and attendings at conferences. This program is best for someone from a medical school with no home orthopedics program who wants research experience, or someone who wants more research experience on their resume. If you come from a school with a home ortho program, we strongly suggest checking in with your department first — that face-to-face interaction and clinical/research-experience-based LOR is invaluable. In a scenario where your home program is fully saturated with students, this program is a good fit to continue working towards something.',
  },
  {
    question: 'How do people publish so much?',
    answer:
      'You cannot reach the top alone. You must work in groups. Divide and conquer. Look up research profiles for students matching at the top orthopedic residency programs — search them on PubMed and you will see they (a) took a research year at a program other than their med school, (b) had a research mentor who put them on all their projects, or (c) worked in a research team with candidates cross-pollinating each other on their projects. That is the reality of the process. This is significantly difficult for students coming from medical schools without a strong ortho research department, and worse for those without any ortho program at all. This program is built for those specific candidates — we want to break that barrier and create a version of that opportunity for students.',
  },
  {
    question: 'Is publication guaranteed?',
    answer:
      'No. This is not a guaranteed-publication program. It is based on your work ethic. We provide the structure, tools, education, and projects. Publication of any work submitted to OSCRSJ is conditional on independent peer review through the journal\'s standard editorial pipeline. Due to strict deadlines, failure to meet program requirements will result in removal from the program.',
  },
  {
    question: 'Will OSCRSJ write me a letter of recommendation?',
    answer:
      'For residency applications, an LOR from someone who knows you and has worked with you in an in-person setting holds significant weight. The virtual nature of this program makes it difficult for our attendings to write LORs in that capacity. For students completing all their projects with at least 3 first-author projects, we can write an LOR if they are lacking letters when ERAS comes around — but we strongly recommend letters from those whom you have met and worked closely with in person.',
  },
  {
    question: 'How does OSCRSJ use AI in research?',
    answer:
      'AI in research is the reality of 2026. We are a strong proponent of "work smarter, not harder" — and an even bigger proponent of not pumping out useless papers and fake citations into the literature. AI should be used as a writing assistant for introductions and discussions, to confirm claims when citing, to draft methods and results sections, and to generate analysis code (RStudio / Python). AI should NOT be used to find citations (unreliable) or to write the introduction and background draft (this is the heart of the manuscript, where you learn about your topic). OSCRSJ has built Claude Skills for orthopedic abstract writing, methods, results, and claim verification — these are made available to scholars as part of the curriculum.',
  },
  {
    question: 'What is the peer-review firewall?',
    answer:
      'Manuscripts produced in the program go through OSCRSJ\'s standard double-blind peer review by reviewers outside of our network — recruited from outside the OSCRSJ editorial board. Cohort manuscripts carry an explicit COI disclosure: "This manuscript was developed as part of the OSCRSJ Research Scholars program. Cohort mentors were not involved in the editorial decision." We publish our cohort manuscript acceptance rate publicly each year. Transparency is part of the design.',
  },
  {
    question: 'When does the next cohort start?',
    answer:
      'Applications are open now. The first cohort kicks off Q3/Q4 2026 once mentor pool and program infrastructure are finalized. We review applications on a rolling basis and will reach out within 2-3 weeks of your submission.',
  },
  {
    question: 'What happens to program materials?',
    answer:
      'All program materials are confidential. Sharing of any program content — from the moment you sign up — will result in legal action.',
  },
]

function buildFaqJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQ_ENTRIES.map((entry) => ({
      '@type': 'Question',
      name: entry.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: entry.answer,
      },
    })),
  }
}

function buildProgramJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'EducationalOccupationalProgram',
    name: 'OSCRSJ Research Scholars',
    description:
      'A structured research-training program in orthopedic case reports, case series, and systematic review / meta-analysis methodology. For pre-med students, medical students, and international medical graduates.',
    url: 'https://www.oscrsj.com/scholars',
    provider: {
      '@type': 'Organization',
      name: 'OSCRSJ — Orthopedic Surgery Case Reports & Series Journal',
      url: 'https://www.oscrsj.com',
    },
    educationalProgramMode: 'online',
    occupationalCategory: 'Medical research training',
    programType: 'Research scholars program',
  }
}

export default function ScholarsPage() {
  const faqJsonLd = buildFaqJsonLd()
  const programJsonLd = buildProgramJsonLd()

  return (
    <div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(programJsonLd) }}
      />

      <PageHeader
        label="Research Training"
        title="OSCRSJ Research Scholars"
        subtitle="A structured research-training program for pre-med students, medical students, and IMG candidates. Real methodology, real mentorship, real peer review."
      />

      <div className="max-w-content mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {/* Why this program */}
        <section className="mb-16">
          <span className="section-label">Why this program</span>
          <h2 className="section-heading mb-4">
            The opportunity gap is real
          </h2>
          <div className="prose-like space-y-4 text-sm leading-relaxed text-ink">
            <p>
              You cannot reach the top of orthopedics alone. You have to work
              in groups. Look up research profiles for students matching at
              the top orthopedic residency programs and you will see the same
              pattern: a research year somewhere with a strong department, or
              a mentor putting them on every project, or a research team where
              candidates cross-pollinate on each other&apos;s work. That is
              how the publication numbers happen.
            </p>
            <p>
              That ecosystem is much harder to access from a medical school
              without a strong orthopedic research department — and nearly
              impossible without an ortho program at all. The OSCRSJ Research
              Scholars program is built specifically for those candidates: we
              teach the methodological skills of being a successful researcher
              while giving you the structured opportunity to work on real
              projects in front of a real peer-reviewed journal.
            </p>
            <p>
              We are a strong proponent of <em>work smarter, not harder</em>
              {' '}— and an even bigger proponent of not pumping out useless
              papers and fake citations into orthopedic literature. The
              program emphasizes methodological rigor, careful attribution,
              and clinically meaningful questions.
            </p>
          </div>
        </section>

        {/* Tracks */}
        <section className="mb-16">
          <span className="section-label">Choose your track</span>
          <h2 className="section-heading mb-4">Three tracks, one community</h2>
          <p className="text-sm text-ink leading-relaxed mb-8 max-w-3xl">
            Every scholar — regardless of track — joins the same cohort
            community, shares mentor meetings and journal clubs, and learns
            the same core methodology. Track and tier differ only in project
            scope and timeline.
          </p>

          <div className="space-y-6">
            {TRACKS.map((track) => (
              <article
                key={track.id}
                id={track.id}
                className="bg-white border border-border rounded-xl p-6 sm:p-8"
              >
                <div className="mb-5">
                  <span className="text-xs uppercase tracking-wider text-brown font-medium">
                    {track.audience}
                  </span>
                  <h3 className="font-serif text-2xl text-brown-dark mt-1">
                    {track.name}
                  </h3>
                  <p className="text-sm text-ink mt-2 leading-relaxed">
                    {track.blurb}
                  </p>
                </div>

                <div
                  className={`grid gap-4 ${
                    track.tiers.length > 1 ? 'sm:grid-cols-2' : ''
                  }`}
                >
                  {track.tiers.map((tier, idx) => (
                    <div
                      key={idx}
                      className="border border-border rounded-lg p-5 bg-cream-alt"
                    >
                      <div className="flex items-baseline gap-2 mb-2">
                        {tier.label && (
                          <span className="text-sm font-medium text-brown">
                            {tier.label}
                          </span>
                        )}
                        <span className="text-2xl font-serif text-brown-dark">
                          {tier.price}
                        </span>
                        <span className="text-sm text-brown">
                          / {tier.duration}
                        </span>
                      </div>
                      <ul className="space-y-1.5 text-sm text-ink mt-3">
                        {tier.highlights.map((h, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <span className="text-brown mt-1 flex-shrink-0">
                              →
                            </span>
                            <span>{h}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* Methodology */}
        <section className="mb-16">
          <span className="section-label">Methodology</span>
          <h2 className="section-heading mb-4">Real training, real rigor</h2>
          <p className="text-sm text-ink leading-relaxed mb-6 max-w-3xl">
            What turns &quot;students writing reviews&quot; into a credible
            research training program is the methodology. Every cohort
            project — regardless of track — is built on the same scaffolding.
          </p>
          <div className="grid sm:grid-cols-3 gap-4">
            <div className="bg-white border border-border rounded-xl p-5">
              <h3 className="font-serif text-base text-brown-dark mb-2">
                Cochrane training
              </h3>
              <p className="text-sm text-ink leading-relaxed">
                The Cochrane Handbook for Systematic Reviews is the
                methodological bible. We cover protocol development, PICO
                question formulation, search strategy, risk-of-bias
                assessment (RoB 2.0, ROBINS-I, MINORS), meta-analysis
                statistics, GRADE quality rating, and PRISMA-compliant
                reporting.
              </p>
            </div>
            <div className="bg-white border border-border rounded-xl p-5">
              <h3 className="font-serif text-base text-brown-dark mb-2">
                PROSPERO registration
              </h3>
              <p className="text-sm text-ink leading-relaxed">
                Every systematic review and meta-analysis is registered with
                PROSPERO before screening begins. The registration becomes
                an external commitment to the protocol — a defining feature
                of credible SR/MA work.
              </p>
            </div>
            <div className="bg-white border border-border rounded-xl p-5">
              <h3 className="font-serif text-base text-brown-dark mb-2">
                Structured timeline
              </h3>
              <p className="text-sm text-ink leading-relaxed">
                Six- and twelve-month cadences with milestone gates: topic →
                PICO → PROSPERO → search → screening → extraction → RoB →
                synthesis → draft → submission. Each milestone gets mentor
                sign-off before the next begins.
              </p>
            </div>
          </div>
        </section>

        {/* Peer review firewall */}
        <section className="mb-16">
          <span className="section-label">Peer review</span>
          <h2 className="section-heading mb-4">
            Publication is conditional on peer review
          </h2>
          <div className="prose-like space-y-4 text-sm leading-relaxed text-ink max-w-3xl">
            <p>
              This is the most important sentence on this page:{' '}
              <strong>
                publication of any work produced in the Research Scholars
                program is conditional on independent peer review through
                OSCRSJ&apos;s standard editorial pipeline.
              </strong>{' '}
              The program promises training, mentorship, and structured
              project opportunities — it does not promise publication.
            </p>
            <p>
              Manuscripts produced in the program go through{' '}
              <Link
                href="/peer-review"
                className="text-brown hover:text-brown-dark underline-offset-2 hover:underline font-medium"
              >
                OSCRSJ&apos;s double-blind peer review
              </Link>{' '}
              by reviewers outside of our network. Cohort manuscripts carry
              an explicit COI disclosure on submission, and cohort mentors are
              never involved in the editorial decision on their own
              scholar&apos;s manuscript.
            </p>
            <p>
              We publish our cohort manuscript acceptance rate publicly each
              year. Transparency is part of the design — it is the strongest
              signal that the peer review is real.
            </p>
          </div>
        </section>

        {/* AI policy */}
        <section className="mb-16">
          <span className="section-label">AI policy</span>
          <h2 className="section-heading mb-4">How we use AI</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="bg-white border border-border rounded-xl p-5">
              <h3 className="font-serif text-base text-brown-dark mb-2">
                Where AI helps
              </h3>
              <ul className="space-y-1.5 text-sm text-ink">
                <li className="flex items-start gap-2">
                  <span className="text-green-700 mt-0.5 flex-shrink-0">
                    ✓
                  </span>
                  <span>
                    Writing assistant for introductions, discussions, and
                    flow editing
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-700 mt-0.5 flex-shrink-0">
                    ✓
                  </span>
                  <span>Confirming claims when citing</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-700 mt-0.5 flex-shrink-0">
                    ✓
                  </span>
                  <span>First drafts of methods and results sections</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-700 mt-0.5 flex-shrink-0">
                    ✓
                  </span>
                  <span>
                    Generating RStudio / Python analysis code (we still
                    run the code, never inference in chat)
                  </span>
                </li>
              </ul>
            </div>
            <div className="bg-white border border-border rounded-xl p-5">
              <h3 className="font-serif text-base text-brown-dark mb-2">
                Where AI does not help
              </h3>
              <ul className="space-y-1.5 text-sm text-ink">
                <li className="flex items-start gap-2">
                  <span className="text-red-700 mt-0.5 flex-shrink-0">
                    ✗
                  </span>
                  <span>
                    Writing the introduction / background draft — the heart
                    of the manuscript, where you learn about your topic
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-700 mt-0.5 flex-shrink-0">
                    ✗
                  </span>
                  <span>
                    Finding citations — not yet reliable at the level
                    research demands
                  </span>
                </li>
              </ul>
              <p className="text-xs text-brown mt-4 leading-relaxed">
                OSCRSJ has built Claude Skills for abstract writing, methods,
                results, and claim verification — made available to scholars
                as part of the curriculum.
              </p>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="mb-16">
          <span className="section-label">FAQ</span>
          <h2 className="section-heading mb-6">Common questions</h2>
          <div className="space-y-3">
            {FAQ_ENTRIES.map((entry) => (
              <details
                key={entry.question}
                className="bg-white border border-border rounded-lg group"
              >
                <summary className="px-5 py-4 cursor-pointer text-sm font-medium text-brown-dark hover:bg-cream-alt rounded-lg flex items-center justify-between gap-3">
                  <span>{entry.question}</span>
                  <span className="text-brown text-xs flex-shrink-0 group-open:rotate-180 transition-transform">
                    ▾
                  </span>
                </summary>
                <div className="px-5 pb-5 pt-1 text-sm text-ink leading-relaxed">
                  {entry.answer}
                </div>
              </details>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="bg-dark-card rounded-xl p-8 sm:p-10 text-center">
          <h2 className="font-serif text-2xl sm:text-3xl text-peach mb-3">
            Ready to apply?
          </h2>
          <p className="text-sm text-peach/80 max-w-xl mx-auto mb-6 leading-relaxed">
            Applications are open. We review every submission carefully and
            respond within 2-3 weeks.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/scholars/apply" className="btn-primary">
              Apply to the program
            </Link>
            <Link href="/contact" className="btn-ghost text-peach">
              Contact us first
            </Link>
          </div>
        </section>
      </div>
    </div>
  )
}
