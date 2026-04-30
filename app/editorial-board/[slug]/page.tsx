import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import PageHeader from '@/components/PageHeader'
import {
  BOARD_MEMBERS,
  BOARD_MEMBER_BIOS,
  buildBoardMemberDetailSchema,
} from '@/lib/schema/editorialBoard'

interface PageProps {
  params: { slug: string }
}

// Pre-render every member who has a bio entry. New bios automatically join
// the static-params list — no manual route registration needed.
export function generateStaticParams() {
  return Object.keys(BOARD_MEMBER_BIOS).map((slug) => ({ slug }))
}

export function generateMetadata({ params }: PageProps): Metadata {
  const member = BOARD_MEMBERS.find((m) => m.slug === params.slug)
  const bio = BOARD_MEMBER_BIOS[params.slug]
  if (!member || !bio) {
    return { title: 'Editorial Board Member Not Found' }
  }
  return {
    title: `${member.name} — ${member.jobTitle}`,
    description: bio.summary,
    openGraph: {
      title: `${member.name} — ${member.jobTitle} · OSCRSJ`,
      description: bio.summary,
      url: `https://www.oscrsj.com/editorial-board/${member.slug}`,
      images: [{ url: bio.photo, alt: `Portrait of ${member.name}` }],
      type: 'profile',
    },
    alternates: {
      canonical: `https://www.oscrsj.com/editorial-board/${member.slug}`,
    },
  }
}

export default function BoardMemberBioPage({ params }: PageProps) {
  const member = BOARD_MEMBERS.find((m) => m.slug === params.slug)
  const bio = BOARD_MEMBER_BIOS[params.slug]

  if (!member || !bio) {
    notFound()
  }

  const detailSchema = buildBoardMemberDetailSchema(member, bio)

  // Specialty pill text — combines role + subspecialty when set
  const roleLine =
    member.jobTitle === 'Section Editor'
      ? `${member.jobTitle} · ${member.medicalSpecialty}`
      : member.jobTitle

  return (
    <div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(detailSchema) }}
      />

      <PageHeader
        label="Editorial Board"
        title={member.name}
        subtitle={roleLine}
      />

      <div className="max-w-content mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
        {/* Back link */}
        <div className="mb-8">
          <Link
            href="/editorial-board"
            className="text-sm text-brown hover:text-brown-dark inline-flex items-center gap-1"
          >
            <span aria-hidden="true">←</span>
            <span>Back to Editorial Board</span>
          </Link>
        </div>

        {/* Hero — photo + summary */}
        <section className="grid lg:grid-cols-12 gap-8 lg:gap-12 items-start mb-12">
          <div className="lg:col-span-4 flex justify-center lg:justify-start">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={bio.photo}
              alt={`Portrait of ${member.name}, ${member.jobTitle}`}
              className="rounded-md shadow-md max-w-[280px] w-full h-auto"
              width={320}
              height={384}
            />
          </div>
          <div className="lg:col-span-8 space-y-4">
            <span className="section-label">{member.jobTitle}</span>
            {member.affiliation && (
              <p className="text-base text-brown leading-relaxed">
                {member.affiliation}
              </p>
            )}
            <p className="text-ink text-base leading-relaxed">{bio.summary}</p>
            {bio.workLocation && (
              <p className="text-sm text-brown">
                <span className="font-semibold">Based in:</span>{' '}
                {bio.workLocation}
              </p>
            )}
          </div>
        </section>

        {/* Education */}
        <section className="mb-10">
          <span className="section-label">Education</span>
          <h2 className="section-heading mb-4">Education &amp; Training</h2>
          <div className="bg-white border border-border rounded-xl p-6">
            <ul className="space-y-3">
              {bio.education.map((entry, idx) => (
                <li
                  key={idx}
                  className="text-sm text-ink flex items-start gap-3"
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full bg-peach-dark mt-2 flex-shrink-0"
                    aria-hidden="true"
                  />
                  <span>{entry}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Professional Experience */}
        <section className="mb-10">
          <span className="section-label">Career</span>
          <h2 className="section-heading mb-4">Professional Experience</h2>
          <div className="bg-white border border-border rounded-xl p-6 space-y-3">
            {bio.experience.map((para, idx) => (
              <p key={idx} className="text-sm text-ink leading-relaxed">
                {para}
              </p>
            ))}
          </div>
        </section>

        {/* Achievements + Memberships side-by-side at lg+ */}
        <section className="grid lg:grid-cols-2 gap-6 mb-10">
          <div>
            <span className="section-label">Scholarship</span>
            <h2 className="section-heading mb-4">Career Achievements</h2>
            <div className="bg-white border border-border rounded-xl p-6">
              <ul className="space-y-3">
                {bio.achievements.map((entry, idx) => (
                  <li
                    key={idx}
                    className="text-sm text-ink flex items-start gap-3"
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full bg-peach-dark mt-2 flex-shrink-0"
                      aria-hidden="true"
                    />
                    <span>{entry}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div>
            <span className="section-label">Affiliations</span>
            <h2 className="section-heading mb-4">Society Memberships</h2>
            <div className="bg-white border border-border rounded-xl p-6">
              <ul className="space-y-3">
                {bio.memberships.map((entry, idx) => (
                  <li
                    key={idx}
                    className="text-sm text-ink flex items-start gap-3"
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full bg-peach-dark mt-2 flex-shrink-0"
                      aria-hidden="true"
                    />
                    <span>{entry}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* Awards */}
        {bio.awards.length > 0 && (
          <section className="mb-10">
            <span className="section-label">Recognition</span>
            <h2 className="section-heading mb-4">Awards &amp; Honors</h2>
            <div className="bg-white border border-border rounded-xl p-6">
              <ul className="space-y-3">
                {bio.awards.map((entry, idx) => (
                  <li
                    key={idx}
                    className="text-sm text-ink flex items-start gap-3"
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full bg-peach-dark mt-2 flex-shrink-0"
                      aria-hidden="true"
                    />
                    <span>{entry}</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )}

        {/* Contact */}
        {bio.email && (
          <section className="mb-12">
            <span className="section-label">Contact</span>
            <h2 className="section-heading mb-4">Get in Touch</h2>
            <div className="bg-cream-alt border border-border rounded-xl p-6">
              <p className="text-sm text-ink">
                <span className="font-semibold">Email: </span>
                <a
                  href={`mailto:${bio.email}`}
                  className="text-brown-dark underline hover:text-brown"
                >
                  {bio.email}
                </a>
              </p>
            </div>
          </section>
        )}

        {/* Back-to-board CTA */}
        <div className="bg-gradient-to-br from-tan/10 to-cream-alt border border-peach/20 rounded-2xl p-8 text-center">
          <h2 className="section-heading mb-2">Meet the Full Editorial Board</h2>
          <p className="text-ink text-sm mb-6 max-w-xl mx-auto">
            Explore the editors and reviewers shaping rigorous, supportive peer
            review at OSCRSJ.
          </p>
          <Link href="/editorial-board" className="btn-primary-light">
            View Editorial Board
          </Link>
        </div>
      </div>
    </div>
  )
}
