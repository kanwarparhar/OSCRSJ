import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import PageHeader from '@/components/PageHeader'
import {
  BOARD_MEMBERS,
  BOARD_MEMBER_BIOS,
  buildBoardMemberDetailSchema,
  getBoardMemberInitials,
  type BoardMember,
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
      ...(bio.photo && {
        images: [{ url: bio.photo, alt: `Portrait of ${member.name}` }],
      }),
      type: 'profile',
    },
    alternates: {
      canonical: `https://www.oscrsj.com/editorial-board/${member.slug}`,
    },
  }
}

// Hero portrait — real photo when bio.photo is set, otherwise a
// peach-on-cream initials disc that matches the existing card icon
// rhythm so members without photos still feel "in format".
function HeroPortrait({
  member,
  photo,
}: {
  member: BoardMember
  photo?: string
}) {
  if (photo) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={photo}
        alt={`Portrait of ${member.name}, ${member.jobTitle}`}
        className="rounded-md shadow-md max-w-[280px] w-full h-auto"
        width={320}
        height={384}
      />
    )
  }
  return (
    <div
      role="img"
      aria-label={`${member.name}, ${member.jobTitle}`}
      className="rounded-md shadow-md w-[240px] aspect-[5/6] bg-peach/20 flex items-center justify-center"
    >
      <span className="font-serif text-7xl text-brown-dark tracking-tight">
        {getBoardMemberInitials(member)}
      </span>
    </div>
  )
}

export default function BoardMemberBioPage({ params }: PageProps) {
  const member = BOARD_MEMBERS.find((m) => m.slug === params.slug)
  const bio = BOARD_MEMBER_BIOS[params.slug]

  if (!member || !bio) {
    notFound()
  }

  const detailSchema = buildBoardMemberDetailSchema(member, bio)

  // Subtitle text — combines role + subspecialty when set on a Section Editor
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

        {/* Hero — portrait + summary */}
        <section className="grid lg:grid-cols-12 gap-8 lg:gap-12 items-start mb-12">
          <div className="lg:col-span-4 flex justify-center lg:justify-start">
            <HeroPortrait member={member} photo={bio.photo} />
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
        {bio.education && bio.education.length > 0 && (
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
        )}

        {/* Professional Experience */}
        {bio.experience && bio.experience.length > 0 && (
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
        )}

        {/* Achievements + Memberships side-by-side at lg+ when both present */}
        {((bio.achievements && bio.achievements.length > 0) ||
          (bio.memberships && bio.memberships.length > 0)) && (
          <section className="grid lg:grid-cols-2 gap-6 mb-10">
            {bio.achievements && bio.achievements.length > 0 && (
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
            )}
            {bio.memberships && bio.memberships.length > 0 && (
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
            )}
          </section>
        )}

        {/* Awards */}
        {bio.awards && bio.awards.length > 0 && (
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

        {/* Back-to-board CTA — contact section intentionally omitted per
            Kanwar directive (no public contact info on member bios). */}
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
