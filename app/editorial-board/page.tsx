import type { Metadata } from 'next'
import Link from 'next/link'
import PageHeader from '@/components/PageHeader'
import {
  BOARD_MEMBERS,
  BOARD_MEMBER_BIOS,
  buildEditorialBoardSchema,
  getBoardMemberInitials,
  type BoardMember,
} from '@/lib/schema/editorialBoard'
import { THIN_BIO_SLUGS } from '@/lib/schema/thinBioSlugs'

export const metadata: Metadata = {
  title: 'Editorial Board',
  description:
    'OSCRSJ editorial board — editor-in-chief, section editors, associate editors, and review editors across orthopedic subspecialties, with affiliations and ORCID iDs.',
  alternates: { canonical: 'https://www.oscrsj.com/editorial-board' },
  openGraph: {
    title: 'Editorial Board | OSCRSJ',
    description:
      'OSCRSJ editorial board — editor-in-chief, section editors, associate editors, and review editors across orthopedic subspecialties.',
    url: 'https://www.oscrsj.com/editorial-board',
    type: 'website',
  },
}

// Avatar — real photo when available, otherwise an initials disc. Sized
// per `variant`: 'lg' for EIC + Founding Editor (56px); 'md' for every
// other card (40px). Visual identical across photo + initials variants
// so the listing reads consistently regardless of photo availability.
function Avatar({
  member,
  photo,
  variant = 'md',
}: {
  member: BoardMember
  photo?: string
  variant?: 'lg' | 'md'
}) {
  const sizeClass = variant === 'lg' ? 'w-14 h-14' : 'w-10 h-10'
  const initialsTextClass = variant === 'lg' ? 'text-base' : 'text-xs'

  if (photo) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={photo}
        alt={`Portrait of ${member.name}`}
        className={`${sizeClass} rounded-full object-cover flex-shrink-0`}
      />
    )
  }
  return (
    <div
      role="img"
      aria-label={member.name}
      className={`${sizeClass} rounded-full bg-peach/20 flex-shrink-0 flex items-center justify-center`}
    >
      <span
        className={`font-serif font-semibold text-brown-dark ${initialsTextClass} tracking-tight`}
      >
        {getBoardMemberInitials(member)}
      </span>
    </div>
  )
}

// Returns the bio entry for a member if one exists. Every member should
// have a bio entry now (per the new system) — this is just a typed
// lookup helper.
function bioFor(member: BoardMember) {
  return member.slug ? BOARD_MEMBER_BIOS[member.slug] : undefined
}

// Reusable small card body for Section / Associate / Review editors.
function MemberCardBody({
  member,
  roleLine,
  isLink,
}: {
  member: BoardMember
  roleLine: string
  isLink: boolean
}) {
  const bio = bioFor(member)
  return (
    <div
      className={`bg-white border border-border rounded-xl p-6 flex items-start gap-4 transition-colors h-full ${
        isLink ? 'hover:border-tan hover:shadow-sm' : ''
      }`}
    >
      <Avatar member={member} photo={bio?.photo} variant="md" />
      <div className="flex-1">
        <p className="text-sm font-semibold text-ink">{member.name}</p>
        <p className="text-xs text-brown mt-0.5">{roleLine}</p>
        {isLink && (
          <p className="text-xs text-brown-dark mt-2 font-medium">
            View bio →
          </p>
        )}
      </div>
    </div>
  )
}

// Wraps a card in a Link when the member has a bio entry; otherwise
// renders as a static card. Currently every member has a bio, but
// keeping the conditional means the system stays graceful if a bio
// entry is ever removed.
function MemberCard({
  member,
  roleLine,
}: {
  member: BoardMember
  roleLine: string
}) {
  // Thin-bio members (THIN_BIO_SLUGS) render a static card — no link, no
  // "View bio →" hint — because their per-bio route returns 404 until real
  // bio content lands. Removing the slug from the Set flips everything back.
  const hasBio =
    !!member.slug &&
    !!BOARD_MEMBER_BIOS[member.slug] &&
    !THIN_BIO_SLUGS.has(member.slug)
  if (hasBio) {
    return (
      <Link
        href={`/editorial-board/${member.slug}`}
        className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-peach focus-visible:ring-offset-2 rounded-xl"
      >
        <MemberCardBody member={member} roleLine={roleLine} isLink />
      </Link>
    )
  }
  return <MemberCardBody member={member} roleLine={roleLine} isLink={false} />
}

// Large leadership-card body — used for EIC + Founding Editor. Keeps
// the existing visual weight (larger avatar + descriptive blurb) but
// also gains a clickable wrapper when the member has a bio.
function LeadershipCardBody({
  member,
  roleLine,
  blurb,
  isLink,
}: {
  member: BoardMember
  roleLine: string
  blurb: string
  isLink: boolean
}) {
  const bio = bioFor(member)
  return (
    <div
      className={`bg-white border border-border rounded-xl p-6 flex items-start gap-5 transition-colors ${
        isLink ? 'hover:border-tan hover:shadow-sm' : ''
      }`}
    >
      <Avatar member={member} photo={bio?.photo} variant="lg" />
      <div>
        <p className="font-semibold text-ink">{member.name}</p>
        <p className="text-sm text-brown mt-0.5">{roleLine}</p>
        <p className="text-sm text-ink mt-2">{blurb}</p>
        {isLink && (
          <p className="text-xs text-brown-dark mt-3 font-medium">
            View full bio →
          </p>
        )}
      </div>
    </div>
  )
}

function LeadershipCard({
  member,
  roleLine,
  blurb,
}: {
  member: BoardMember
  roleLine: string
  blurb: string
}) {
  const hasBio =
    !!member.slug &&
    !!BOARD_MEMBER_BIOS[member.slug] &&
    !THIN_BIO_SLUGS.has(member.slug)
  if (hasBio) {
    return (
      <Link
        href={`/editorial-board/${member.slug}`}
        className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-peach focus-visible:ring-offset-2 rounded-xl"
      >
        <LeadershipCardBody
          member={member}
          roleLine={roleLine}
          blurb={blurb}
          isLink
        />
      </Link>
    )
  }
  return (
    <LeadershipCardBody
      member={member}
      roleLine={roleLine}
      blurb={blurb}
      isLink={false}
    />
  )
}

// Filter-by-role helpers
function membersByRole(role: string): BoardMember[] {
  return BOARD_MEMBERS.filter((m) => m.jobTitle === role)
}

export default function EditorialBoardPage() {
  const personSchema = buildEditorialBoardSchema(BOARD_MEMBERS)

  const eic = BOARD_MEMBERS.find((m) => m.jobTitle === 'Editor-in-Chief')
  const foundingEditor = BOARD_MEMBERS.find(
    (m) => m.jobTitle === 'Founding Editor'
  )
  const managingEditor = BOARD_MEMBERS.find(
    (m) => m.jobTitle === 'Managing Editor'
  )
  const sectionEditors = membersByRole('Section Editor')
  const associateEditors = membersByRole('Associate Editor')
  const reviewEditors = membersByRole('Review Editor')

  return (
    <div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(personSchema) }}
      />
      <PageHeader
        label="Our Team"
        title="Editorial Board"
        subtitle="OSCRSJ is guided by an editorial board of orthopedic surgeons across all career stages — practicing surgeons, fellows, residents, and researchers — committed to rigorous, fair peer review."
      />

      <div className="max-w-content mx-auto px-4 sm:px-6 lg:px-8 py-20">
        {/* Editor-in-Chief */}
        {eic && (
          <section className="mb-12">
            <span className="section-label">Leadership</span>
            <h2 className="section-heading mb-4">Editor-in-Chief</h2>
            <LeadershipCard
              member={eic}
              roleLine="Editor-in-Chief · OSCRSJ"
              blurb="Professor of Orthopaedics, Dr. MGR Educational and Research Institute, Chennai. Leads OSCRSJ's editorial direction with an emphasis on rigorous methodology, scholarly quality, and substantive review."
            />
          </section>
        )}

        {/* Founding Editor */}
        {foundingEditor && (
          <section className="mb-12">
            <span className="section-label">Leadership</span>
            <h2 className="section-heading mb-4">Founding Editor</h2>
            <LeadershipCard
              member={foundingEditor}
              roleLine="Founding Editor · OSCRSJ"
              blurb="Founded OSCRSJ in 2026 as an independent, open-access venue for orthopedic case reports and case series, built around rigorous peer review and substantive editorial feedback. Oversees editorial operations, journal development, and day-to-day management during the launch phase."
            />
          </section>
        )}

        {/* Managing Editor — operations leadership tier */}
        {managingEditor && (
          <section className="mb-12">
            <span className="section-label">Leadership</span>
            <h2 className="section-heading mb-4">Managing Editor</h2>
            <LeadershipCard
              member={managingEditor}
              roleLine="Managing Editor · OSCRSJ"
              blurb="Leads day-to-day editorial operations across reviewer recruitment, peer-review coordination, manuscript workflow, and cross-functional program management. Brings a decade of strategy and program management leadership at Fortune 500 corporations (Nike, Nordstrom) to the operational backbone of the journal."
            />
          </section>
        )}

        {/* Section Editors */}
        {sectionEditors.length > 0 && (
          <section className="mb-12">
            <span className="section-label">Subspecialty Leadership</span>
            <h2 className="section-heading mb-4">Section Editors</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              {sectionEditors.map((member) => (
                <MemberCard
                  key={member.slug || member.name}
                  member={member}
                  roleLine={`Section Editor · ${member.medicalSpecialty}`}
                />
              ))}
            </div>
          </section>
        )}

        {/* Associate Editors */}
        {associateEditors.length > 0 && (
          <section className="mb-12">
            <span className="section-label">Editorial Team</span>
            <h2 className="section-heading mb-4">Associate Editors</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              {associateEditors.map((member) => (
                <MemberCard
                  key={member.slug || member.name}
                  member={member}
                  roleLine="Associate Editor"
                />
              ))}
            </div>
          </section>
        )}

        {/* Review Editor — kept as a render-when-non-empty section for any
            future review-editor recruits. Currently empty since Manvir was
            promoted to Managing Editor at the leadership tier. */}
        {reviewEditors.length > 0 && (
          <section className="mb-12">
            <span className="section-label">Editorial Team</span>
            <h2 className="section-heading mb-4">Review Editor</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              {reviewEditors.map((member) => (
                <MemberCard
                  key={member.slug || member.name}
                  member={member}
                  roleLine="Review Editor"
                />
              ))}
            </div>
          </section>
        )}

        {/* Join the board CTA */}
        <div className="bg-gradient-to-br from-tan/10 to-cream-alt border border-peach/20 rounded-2xl p-8 text-center">
          <span className="section-label">Get Involved</span>
          <h2 className="section-heading mb-2">Join Our Editorial Board</h2>
          <p className="text-ink text-sm mb-6 max-w-xl mx-auto">
            We are building an editorial board of orthopedic surgeons across all career stages and all subspecialties. Board members contribute to the mission of providing rigorous, fair, high-quality peer review for the global orthopedic surgery community.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/contact" className="btn-primary-light">Express Interest</Link>
            <Link href="/aims-scope" className="btn-outline">Learn More About OSCRSJ</Link>
          </div>
        </div>
      </div>
    </div>
  )
}
