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
      'Protocol development, PICO formulation, search strategy, risk-of-bias assessment, GRADE quality rating, PRISMA reporting — the real research toolkit, taught in cohort.',
  },
  {
    heading: 'A real peer-reviewed journal',
    body:
      'Cohort projects route through OSCRSJ’s standard double-blind peer review by reviewers outside our network. Your publication record is built on real editorial decisions, not internal handoffs.',
  },
  {
    heading: 'Mentorship and a cohort community',
    body:
      'Monthly project meetings, cohort journal clubs, and a working group of pre-meds, med students, and IMGs collaborating on real projects in front of a real journal.',
  },
  {
    heading: 'Structured pipeline, strict deadlines',
    body:
      'Topic → PICO → PROSPERO → search → screening → extraction → synthesis → draft → submission. Milestone gates with mentor sign-off. Real training, not vibes.',
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
        {/* The pitch */}
        <section className="mb-14">
          <span className="section-label">Why this program</span>
          <h2 className="section-heading mb-4">
            The opportunity gap is real. We were built to close it.
          </h2>
          <div className="prose-like space-y-4 text-sm leading-relaxed text-ink max-w-3xl">
            <p>
              Students matching at top orthopedic residency programs share the
              same pattern: a research year in a strong department, a mentor
              placing them on every project, or a team where members
              cross-pollinate on each other&apos;s work. That ecosystem is much
              harder to access from a medical school without a strong
              orthopedic department, and nearly impossible without an ortho
              program at all.
            </p>
            <p>
              The OSCRSJ Research Scholars program is built for those
              candidates. Cohort scholars learn the methodological skills that
              define a credible researcher, work on real projects with mentor
              sign-off at every milestone, and submit those projects to a real
              peer-reviewed journal &mdash; not a vanity outlet.
            </p>
          </div>
        </section>

        {/* What you get */}
        <section className="mb-14">
          <span className="section-label">What you get</span>
          <h2 className="section-heading mb-6">The training, the team, the credential</h2>
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

        {/* Who this is for */}
        <section className="mb-14">
          <span className="section-label">Who this is for</span>
          <h2 className="section-heading mb-6">Three tracks, one cohort</h2>
          <p className="text-sm text-ink leading-relaxed mb-6 max-w-3xl">
            Every scholar, regardless of track, joins the same cohort
            community, shares mentor meetings and journal clubs, and learns
            the same core methodology. Project scope and timeline are matched
            to where you are in your training. Full curriculum, deliverables,
            and tuition for your track are sent privately after you apply.
          </p>
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

        {/* Credibility line */}
        <section className="mb-14">
          <span className="section-label">The guardrail</span>
          <h2 className="section-heading mb-4">
            Publication is conditional on peer review
          </h2>
          <div className="prose-like space-y-4 text-sm leading-relaxed text-ink max-w-3xl">
            <p>
              The program promises training, mentorship, and structured
              project opportunities. It does not promise publication. Every
              cohort manuscript routes through{' '}
              <Link
                href="/peer-review"
                className="text-brown hover:text-brown-dark underline-offset-2 hover:underline font-medium"
              >
                OSCRSJ&apos;s double-blind peer review
              </Link>{' '}
              by reviewers outside our network, carries an explicit
              conflict-of-interest disclosure, and is decided by editors who
              were never involved in the project. We publish the cohort
              acceptance rate publicly each year. Transparency is part of the
              design.
            </p>
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
