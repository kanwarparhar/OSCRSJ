// Helper for emitting Person JSON-LD on /editorial-board. Each confirmed
// board member is rendered as a schema.org Person node linked back to the
// root Organization via memberOf. This is the highest-leverage E-E-A-T
// signal OSCRSJ can ship before first-article publication — medical/YMYL
// content is held to Google's strictest quality bar, and named,
// credentialed expertise on editorial pages is what search raters and AI
// retrieval systems look for. Inject via:
//   <script
//     type="application/ld+json"
//     dangerouslySetInnerHTML={{ __html: JSON.stringify(buildEditorialBoardSchema(BOARD_MEMBERS)) }}
//   />
// inside the Server Component's JSX so the block ships in initial SSR HTML.
// "Recruiting" placeholder slots are intentionally NOT emitted — schema
// must reflect real people only (per John's spec).
//
// Members with full bios get a `slug` — that's the URL segment for
// /editorial-board/[slug] and the indicator that their card on the board
// page should render as a clickable Link (instead of a static card).
// Bio detail content lives in BOARD_MEMBER_BIOS keyed by slug.

export interface BoardMember {
  name: string
  givenName: string
  familyName?: string // optional for mononyms (e.g. single-name members)
  honorificSuffix: string // 'MD', 'MBBS, MS, MBA, PhD', etc.
  jobTitle: string // 'Editor-in-Chief' | 'Founding Editor' | 'Section Editor' | 'Associate Editor' | 'Review Editor'
  medicalSpecialty: string // schema.org MedicalSpecialty vocab where possible
  affiliation?: string // institution name (optional — fill when confirmed)
  sameAs?: string[] // ORCID URL, institutional page, ResearchGate, etc.
  slug?: string // when set, member has a bio page at /editorial-board/[slug]
}

// Real members only — "Recruiting" slots are NOT rendered as Person nodes.
// Update this roster as members are confirmed. Every member has a `slug`
// — they all get a bio page at /editorial-board/[slug]. Lean stub bios
// for members without rich CV data still render in the shared format;
// individual sections hide gracefully when their data is empty.
export const BOARD_MEMBERS: BoardMember[] = [
  // Leadership
  {
    name: 'Madhan Jeyaraman, MD, PhD, MBA',
    givenName: 'Madhan',
    familyName: 'Jeyaraman',
    honorificSuffix: 'MD, PhD, MBA',
    jobTitle: 'Editor-in-Chief',
    medicalSpecialty: 'Orthopedic Surgery',
    affiliation: 'Dr. MGR Educational and Research Institute, Chennai',
    slug: 'madhan-jeyaraman',
  },
  {
    name: 'Kanwar Parhar, MD',
    givenName: 'Kanwar',
    familyName: 'Parhar',
    honorificSuffix: 'MD',
    jobTitle: 'Founding Editor',
    medicalSpecialty: 'Orthopedic Surgery',
    affiliation: 'University of California, San Diego',
    slug: 'kanwar-parhar',
    // sameAs to be populated when ready
  },
  // Section Editors
  {
    name: 'Nathaniel Schaffer, MD',
    givenName: 'Nathaniel',
    familyName: 'Schaffer',
    honorificSuffix: 'MD',
    jobTitle: 'Section Editor',
    medicalSpecialty: 'Orthopedic Trauma',
    slug: 'nathaniel-schaffer',
  },
  {
    // Co-Section Editor for Trauma — paired with Schaffer for load
    // redundancy + complementary depth (Schaffer: US-based acute trauma;
    // Alizade: 40+ years Azerbaijan-based reconstructive trauma + trauma
    // infectious complications, SICOT Prize laureate, WAIOT 2nd VP).
    name: 'Chingiz Alizade, MD, PhD, DMSc',
    givenName: 'Chingiz',
    familyName: 'Alizade',
    honorificSuffix: 'MD, PhD, DMSc',
    jobTitle: 'Section Editor',
    medicalSpecialty: 'Orthopedic Trauma',
    affiliation: 'HB Güven Clinic, Baku, Azerbaijan',
    slug: 'chingiz-alizade',
  },
  {
    name: 'Miguel A. Schmitz, MD',
    givenName: 'Miguel',
    familyName: 'Schmitz',
    honorificSuffix: 'MD',
    jobTitle: 'Section Editor',
    medicalSpecialty: 'Spine Surgery',
    slug: 'miguel-schmitz',
  },
  {
    name: 'Bill K. Huang, MD',
    givenName: 'Bill',
    familyName: 'Huang',
    honorificSuffix: 'MD',
    jobTitle: 'Section Editor',
    medicalSpecialty: 'Adult Reconstruction',
    slug: 'bill-huang',
  },
  {
    name: 'Sukhman Singh, MBBS, MS',
    givenName: 'Sukhman',
    familyName: 'Singh',
    honorificSuffix: 'MBBS, MS',
    jobTitle: 'Section Editor',
    medicalSpecialty: 'Foot and Ankle Surgery',
    slug: 'sukhman-singh',
  },
  {
    name: 'Hiroki Okamura, MD, PhD',
    givenName: 'Hiroki',
    familyName: 'Okamura',
    honorificSuffix: 'MD, PhD',
    jobTitle: 'Section Editor',
    medicalSpecialty: 'Sports Medicine',
    slug: 'hiroki-okamura',
  },
  {
    name: 'Dheeraj Makkar, MD',
    givenName: 'Dheeraj',
    familyName: 'Makkar',
    honorificSuffix: 'MD',
    jobTitle: 'Section Editor',
    medicalSpecialty: 'Orthopedic Oncology',
    slug: 'dheeraj-makkar',
  },
  {
    name: 'Shreya Chaudhuri, MD',
    givenName: 'Shreya',
    familyName: 'Chaudhuri',
    honorificSuffix: 'MD',
    jobTitle: 'Section Editor',
    medicalSpecialty: 'Orthopedic Microbiology and Infectious Diseases',
    slug: 'shreya-chaudhuri',
  },
  // Associate Editors
  {
    name: 'Vikash Raj, MBBS, MS',
    givenName: 'Vikash',
    familyName: 'Raj',
    honorificSuffix: 'MBBS, MS',
    jobTitle: 'Associate Editor',
    medicalSpecialty: 'Orthopedic Surgery',
    slug: 'vikash-raj',
  },
  {
    name: 'Abhijit Jayan, MBBS, MS',
    givenName: 'Abhijit',
    familyName: 'Jayan',
    honorificSuffix: 'MBBS, MS',
    jobTitle: 'Associate Editor',
    medicalSpecialty: 'Orthopedic Surgery',
    slug: 'abhijit-jayan',
  },
  {
    // Telugu/South Indian naming convention: surname-first ordering. If
    // the member prefers Western-style ordering for byline rendering,
    // swap given/family at next confirmation.
    name: 'Damarla Meghana, MBBS, MS',
    givenName: 'Meghana',
    familyName: 'Damarla',
    honorificSuffix: 'MBBS, MS',
    jobTitle: 'Associate Editor',
    medicalSpecialty: 'Orthopedic Surgery',
    slug: 'damarla-meghana',
  },
  {
    name: 'Akshay Phupate, MBBS, MS',
    givenName: 'Akshay',
    familyName: 'Phupate',
    honorificSuffix: 'MBBS, MS',
    jobTitle: 'Associate Editor',
    medicalSpecialty: 'Orthopedic Surgery',
    slug: 'akshay-phupate',
  },
  // Review Editor
  {
    name: 'Manvir Kaur, MS',
    givenName: 'Manvir',
    familyName: 'Kaur',
    honorificSuffix: 'MS',
    jobTitle: 'Review Editor',
    medicalSpecialty: 'Orthopedic Surgery',
    affiliation: 'Portland State University',
    slug: 'manvir-kaur',
  },
]

// ---------------------------------------------------------------------------
// Bio detail data — keyed by slug. Members without an entry render as a
// static card on the board page (no Link wrapper). Adding an entry here +
// setting `slug` on the matching BoardMember row above is the full opt-in.
// ---------------------------------------------------------------------------

export interface BoardMemberBio {
  /**
   * Path to portrait JPG/PNG under /public, e.g. '/brand/chingiz-alizade.jpg'.
   * Optional — when missing, the bio page + listing card render an
   * initials-on-peach-circle avatar fallback so the visual rhythm stays
   * consistent across members regardless of photo availability.
   */
  photo?: string
  /** 1-2 sentence summary that anchors the bio page hero. */
  summary: string
  /** Education entries, each line = one degree/credential. */
  education?: string[]
  /** Free-form experience description (rendered as paragraphs). */
  experience?: string[]
  /** Career achievements (rendered as a bulleted list). */
  achievements?: string[]
  /** Society memberships and leadership roles. */
  memberships?: string[]
  /** Awards / honors (year-prefixed where known). */
  awards?: string[]
  /** Locale text for the JSON-LD `address` / `workLocation`. */
  workLocation?: string
}
// Note: contact information (email, phone, etc.) is intentionally NOT a
// field on this interface — Kanwar directive 2026-04-30: editorial board
// members do not have contact info surfaced on their public bio pages.
// Editorial correspondence routes through the journal's editorial inbox
// (editorial@oscrsj.com / oscrsjournal@gmail.com), not individual members.

export const BOARD_MEMBER_BIOS: Record<string, BoardMemberBio> = {
  // ----- Leadership -----
  'madhan-jeyaraman': {
    photo: '/brand/madhan-jeyaraman.jpg',
    summary:
      "Editor-in-Chief of OSCRSJ. Professor of Orthopaedics at Dr. MGR Educational and Research Institute, Chennai. Leads OSCRSJ's editorial direction with an emphasis on rigorous methodology, scholarly quality, and substantive review.",
    experience: [
      'Professor of Orthopaedics, Dr. MGR Educational and Research Institute, Chennai.',
      'Founder Director, Agathisha Ortho Stemcell Clinic (AOSC).',
      'Head, Research and Development, Sri Lalithambigai Medical College and Hospital.',
    ],
    achievements: [
      '460+ peer-reviewed publications',
      '4,295+ citations',
    ],
    workLocation: 'Chennai, India',
  },
  'kanwar-parhar': {
    summary:
      'Founding Editor of OSCRSJ. Founded the journal in 2026 to give the global orthopedic community a rigorous, fast, and supportive venue for case reports and case series. Oversees editorial operations, journal development, and day-to-day management during the launch phase.',
    workLocation: 'San Diego, California, United States',
  },

  // ----- Section Editors -----
  'nathaniel-schaffer': {
    summary:
      'Section Editor for Orthopedic Trauma at OSCRSJ. Brings clinical expertise across acute and reconstructive trauma to the journal’s peer-review process.',
  },
  'chingiz-alizade': {
    photo: '/brand/chingiz-alizade.jpg',
    summary:
      'A distinguished orthopedic surgeon with over 40 years of dedicated service at the Azerbaijan Scientific Research Institute of Traumatology and Orthopedics, recognized for founding a new scientific direction in the study of infectious complications in traumatology and orthopedics in Azerbaijan.',
    education: [
      'Azerbaijan Medical Institute — MD (1974)',
      'PhD in Traumatology and Orthopedics — Moscow, Russia (1985)',
      'Doctor of Medical Sciences (DMSc) — Moscow, Russia (2003)',
      'Professor (since 2005)',
    ],
    experience: [
      'Azerbaijan Scientific Research Institute of Traumatology and Orthopedics, Baku — 1974 to 2019.',
      'Currently practicing at HB Güven Clinic, Baku, Azerbaijan, with a clinical focus on infections in traumatology and orthopedics and reconstructive surgery.',
    ],
    achievements: [
      'Supervised 8 PhD dissertations',
      'Authored 13 patents, including 6 with international recognition',
      'Published over 230 scientific works',
      'Authored 2 monographs',
    ],
    memberships: [
      'SICOT — Société Internationale de Chirurgie Orthopédique et de Traumatologie',
      'WAIOT — World Association against Infection in Orthopaedics and Trauma (2nd Vice President)',
      'EFORT — European Federation of National Associations of Orthopaedics and Traumatology',
    ],
    awards: ['2019 — SICOT Prize in Fundamental Science'],
    workLocation: 'Baku, Azerbaijan',
  },
  'miguel-schmitz': {
    summary:
      'Section Editor for Spine Surgery at OSCRSJ. Brings clinical expertise across cervical, thoracic, and lumbar spine pathology to the journal’s peer-review process.',
  },
  'bill-huang': {
    summary:
      'Section Editor for Adult Reconstruction at OSCRSJ. Brings clinical expertise across primary and revision joint arthroplasty to the journal’s peer-review process.',
  },
  'sukhman-singh': {
    summary:
      'Section Editor for Foot and Ankle Surgery at OSCRSJ. Brings clinical expertise across foot and ankle reconstruction, deformity correction, and trauma to the journal’s peer-review process.',
  },
  'hiroki-okamura': {
    summary:
      'Section Editor for Sports Medicine at OSCRSJ. Brings clinical expertise across arthroscopy, ligament reconstruction, and sports-related injury management to the journal’s peer-review process.',
  },
  'dheeraj-makkar': {
    summary:
      'Section Editor for Orthopedic Oncology at OSCRSJ. Brings clinical expertise across primary and metastatic musculoskeletal tumors and limb-salvage surgery to the journal’s peer-review process.',
  },
  'shreya-chaudhuri': {
    summary:
      'Section Editor for Orthopedic Microbiology and Infectious Diseases at OSCRSJ. Brings clinical expertise across periprosthetic joint infection, osteomyelitis, and infection-related reconstruction to the journal’s peer-review process.',
  },

  // ----- Associate Editors -----
  'vikash-raj': {
    summary:
      'Associate Editor at OSCRSJ. Contributes to peer review and editorial decision-making across orthopedic case reports and series.',
  },
  'abhijit-jayan': {
    summary:
      'Associate Editor at OSCRSJ. Contributes to peer review and editorial decision-making across orthopedic case reports and series.',
  },
  'damarla-meghana': {
    summary:
      'Associate Editor at OSCRSJ. Contributes to peer review and editorial decision-making across orthopedic case reports and series.',
  },
  'akshay-phupate': {
    summary:
      'Associate Editor at OSCRSJ. Contributes to peer review and editorial decision-making across orthopedic case reports and series.',
  },

  // ----- Review Editor -----
  'manvir-kaur': {
    summary:
      'Review Editor at OSCRSJ. Coordinates reviewer recruitment and review-quality oversight across the journal.',
    workLocation: 'Portland, Oregon, United States',
  },
}

export function buildEditorialBoardSchema(members: BoardMember[]) {
  return {
    '@context': 'https://schema.org',
    '@graph': members.map((m) => ({
      '@type': 'Person',
      '@id': `https://www.oscrsj.com/editorial-board#${(m.familyName || m.givenName).toLowerCase()}`,
      name: m.name,
      givenName: m.givenName,
      ...(m.familyName && { familyName: m.familyName }),
      honorificSuffix: m.honorificSuffix,
      jobTitle: m.jobTitle,
      medicalSpecialty: m.medicalSpecialty,
      ...(m.affiliation && {
        affiliation: { '@type': 'Organization', name: m.affiliation },
      }),
      ...(m.sameAs && { sameAs: m.sameAs }),
      // Members with a bio page get a `url` pointing at the canonical bio URL
      // — strengthens the Person node for indexing and AI retrieval, and gives
      // search engines a destination for the rich-result link.
      ...(m.slug && { url: `https://www.oscrsj.com/editorial-board/${m.slug}` }),
      // Links each Person back to the root Organization node emitted in app/layout.tsx.
      memberOf: { '@id': 'https://www.oscrsj.com/#organization' },
    })),
  }
}

/**
 * Per-member detail JSON-LD for the bio page. Adds bio-specific fields
 * (image, description, workLocation) on top of the base Person node.
 *
 * Contact information (email, telephone) is intentionally NOT emitted —
 * Kanwar directive 2026-04-30: editorial-board members do not have
 * contact info surfaced publicly. Editorial correspondence routes
 * through the journal's editorial inbox, not individual members.
 */
export function buildBoardMemberDetailSchema(
  member: BoardMember,
  bio: BoardMemberBio
) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    '@id': `https://www.oscrsj.com/editorial-board#${(member.familyName || member.givenName).toLowerCase()}`,
    name: member.name,
    givenName: member.givenName,
    ...(member.familyName && { familyName: member.familyName }),
    honorificSuffix: member.honorificSuffix,
    jobTitle: member.jobTitle,
    medicalSpecialty: member.medicalSpecialty,
    description: bio.summary,
    ...(bio.photo && { image: `https://www.oscrsj.com${bio.photo}` }),
    url: `https://www.oscrsj.com/editorial-board/${member.slug}`,
    ...(member.affiliation && {
      affiliation: { '@type': 'Organization', name: member.affiliation },
    }),
    ...(bio.workLocation && {
      workLocation: { '@type': 'Place', name: bio.workLocation },
    }),
    ...(member.sameAs && { sameAs: member.sameAs }),
    memberOf: { '@id': 'https://www.oscrsj.com/#organization' },
  }
}

/**
 * Initials derivation for the avatar fallback used on bio pages and
 * editorial-board listing cards when a member has no photo. Returns
 * up to 2 characters: the given-name initial + family-name initial.
 * Mononym members fall back to the first 2 characters of givenName.
 */
export function getBoardMemberInitials(member: BoardMember): string {
  const givenInitial = member.givenName.charAt(0).toUpperCase()
  if (member.familyName) {
    return `${givenInitial}${member.familyName.charAt(0).toUpperCase()}`
  }
  return member.givenName.slice(0, 2).toUpperCase()
}
