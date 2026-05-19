import type { Metadata } from 'next'
import Link from 'next/link'
import PageHeader from '@/components/PageHeader'

export const metadata: Metadata = {
  title: 'OSCRSJ Research Scholars',
  description:
    'A structured research-training program for pre-med students, medical students, and IMG candidates. Cochrane-trained methodology, mentorship, and peer-reviewed journal output.',
  alternates: { canonical: 'https://www.oscrsj.com/scholars' },
  openGraph: {
    title: 'OSCRSJ Research Scholars',
    description:
      'Real journal. Real methodology. Real peer review. A research-training program for pre-med, medical student, and IMG candidates.',
    url: 'https://www.oscrsj.com/scholars',
    type: 'website',
  },
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

const WHAT_YOU_GET: Array<{ heading: string; body: string }> = [
  {
    heading: 'Cochrane-trained methodology',
    body:
      'Protocol development, PICO formulation, search strategy, risk-of-bias assessment, GRADE quality rating, and PRISMA reporting — the full methodological toolkit, taught in cohort.',
  },
  {
    heading: 'Mentorship and a research team',
    body:
      'Monthly project meetings, cohort journal clubs, and a working group of pre-medical students, medical students, and IMGs collaborating on real projects under faculty supervision.',
  },
  {
    heading: 'Structured pipeline, milestone deadlines',
    body:
      'Topic → PICO → PROSPERO registration → systematic search → screening → extraction → synthesis → manuscript draft → submission. Each milestone reviewed and signed off by your mentor.',
  },
]

const WHO_SHOULD_APPLY: Array<{ group: string; bullets: string[] }> = [
  {
    group: 'Pre-medical students',
    bullets: [
      'Applicants who want to be a competitive medical school candidate and position themselves for success when applying to competitive residencies during medical school.',
    ],
  },
  {
    group: 'Medical students',
    bullets: [
      'Students at institutions without a home orthopedic surgery program.',
      'Students with a home program but limited research opportunities within it.',
      'Students preparing to apply to an orthopedic surgery residency who need additional research experience.',
    ],
  },
  {
    group: 'International medical graduates (IMGs)',
    bullets: [
      'IMGs committed to orthopedic surgery and seeking a competitive residency application.',
      'IMGs who require a research letter of recommendation from a sustained, mentored project.',
    ],
  },
]

const TRACKS: Array<{ id: string; name: string; audience: string }> = [
  {
    id: 'pre-med',
    name: 'Pre-Med Scholar',
    audience: 'For first-generation pre-meds and students without an established mentor network.',
  },
  {
    id: 'med-student',
    name: 'Med Student Scholar',
    audience: 'For medical students at schools without a home orthopedics program, or anyone building a stronger surgical-residency research record.',
  },
  {
    id: 'img',
    name: 'IMG Scholar',
    audience: 'For international medical graduates applying through ECFMG to US residency.',
  },
]

export default function ScholarsPage() {
  const programJsonLd = buildProgramJsonLd()

  return (
    <div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(programJsonLd) }}
      />

      <PageHeader
        label="Research Training"
        title="OSCRSJ Research Scholars"
        subtitle="Real journal. Real methodology. Real peer review. A structured research-training program for pre-med students, medical students, and IMG candidates."
      />

      <div className="max-w-content mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {/* Why we created this program */}
        <section className="mb-14">
          <span className="section-label">Why we created this program</span>
          <h2 className="section-heading mb-4">
            The gap in matching into orthopedic surgery is widening. We would
            like to help close it.
          </h2>
          <div className="prose-like space-y-4 text-sm leading-relaxed text-ink max-w-3xl">
            <p>
              The{' '}
              <a
                href="https://www.nrmp.org/wp-content/uploads/2026/03/Advance-Data-Tables-2026_Public.pdf"
                target="_blank"
                rel="noopener noreferrer"
                className="text-brown hover:text-brown-dark underline-offset-2 hover:underline font-medium"
              >
                2026 NRMP Main Residency Match results
              </a>{' '}
              illustrate the scale of the challenge. Across 223 orthopedic
              surgery programs, 963 PGY-1 positions were offered and 100% were
              filled, with zero positions remaining unfilled — one of only a
              handful of specialties to fill every position nationally.{' '}
              <span className="whitespace-nowrap">1,129</span> active U.S. MD
              senior applicants competed for those 963 positions, and only 765
              of them matched into orthopedic surgery — an in-specialty match
              rate of roughly 68% for U.S. MD seniors who pursued the field.
              U.S. MD seniors accounted for 79.4% of every matched position;
              121 osteopathic seniors, 5 non-U.S. IMG applicants, and zero
              U.S. citizen IMG applicants matched into the specialty
              nationwide.
            </p>
            <p>
              Beneath those numbers is a consistent pattern. Applicants who
              match into orthopedic surgery share a common credential:
              substantial, mentored research experience. To build that
              experience, many medical students now take a dedicated research
              year at a strong orthopedic department, work alongside a faculty
              mentor who places them on multiple projects, or join a research
              team in which members contribute meaningfully to each other&apos;s
              work to accumulate the scholarly output the specialty expects.
            </p>
            <p>
              That ecosystem is far harder to access for students at medical
              schools with limited orthopedic research infrastructure, and it
              is largely inaccessible to students at institutions without a
              home orthopedic surgery program. The OSCRSJ Research Scholars
              program was built to make structured research training, faculty
              mentorship, and meaningful project authorship available to
              candidates who do not have those resources at their home
              institution.
            </p>
          </div>
        </section>

        {/* Who should apply */}
        <section className="mb-14">
          <span className="section-label">Who should apply</span>
          <h2 className="section-heading mb-6">
            The candidates this program was designed for
          </h2>
          <p className="text-sm text-ink leading-relaxed mb-6 max-w-3xl">
            The OSCRSJ Research Scholars program is structured to support the
            following applicants:
          </p>
          <ol className="space-y-5 max-w-3xl list-decimal list-outside pl-5 marker:text-brown marker:font-serif marker:text-base">
            {WHO_SHOULD_APPLY.map((group) => (
              <li key={group.group} className="pl-2 text-sm leading-relaxed text-ink">
                <span className="font-serif text-base text-brown-dark block mb-2">
                  {group.group}
                </span>
                {group.bullets.length === 1 ? (
                  <p className="leading-relaxed">{group.bullets[0]}</p>
                ) : (
                  <ul className="list-disc list-outside pl-5 space-y-1.5 marker:text-brown">
                    {group.bullets.map((bullet) => (
                      <li key={bullet} className="leading-relaxed">
                        {bullet}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ol>
        </section>

        {/* What you get */}
        <section className="mb-14">
          <span className="section-label">What you get</span>
          <h2 className="section-heading mb-6">
            The training, the team, and the projects to be an efficient
            researcher
          </h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {WHAT_YOU_GET.map((item) => (
              <div
                key={item.heading}
                className="bg-white border border-border rounded-xl p-5"
              >
                <h3 className="font-serif text-base text-brown-dark mb-2">
                  {item.heading}
                </h3>
                <p className="text-sm text-ink leading-relaxed">{item.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Tracks */}
        <section className="mb-14">
          <span className="section-label">Tracks</span>
          <h2 className="section-heading mb-6">Three tracks</h2>
          <div className="grid sm:grid-cols-3 gap-4">
            {TRACKS.map((track) => (
              <div
                key={track.id}
                className="bg-cream-alt border border-border rounded-xl p-5"
              >
                <h3 className="font-serif text-base text-brown-dark mb-2">
                  {track.name}
                </h3>
                <p className="text-sm text-ink leading-relaxed">
                  {track.audience}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="bg-dark-card rounded-xl p-8 sm:p-10 text-center">
          <h2 className="font-serif text-2xl sm:text-3xl text-peach mb-3">
            Ready to apply?
          </h2>
          <p className="text-sm text-peach/80 max-w-xl mx-auto mb-6 leading-relaxed">
            Applications are open and reviewed on a rolling basis. Submit
            yours and you&apos;ll receive the full program overview &mdash;
            curriculum, deliverables, deadlines, and tuition for your track
            &mdash; within minutes of applying. We respond personally within
            2-3 weeks.
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
