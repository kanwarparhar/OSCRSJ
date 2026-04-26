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

export interface BoardMember {
  name: string
  givenName: string
  familyName?: string // optional for mononyms (e.g. single-name members)
  honorificSuffix: string // 'MD', 'MBBS, MS, MBA, PhD', etc.
  jobTitle: string // 'Editor-in-Chief' | 'Founding Editor' | 'Section Editor' | 'Associate Editor' | 'Review Editor'
  medicalSpecialty: string // schema.org MedicalSpecialty vocab where possible
  affiliation?: string // institution name (optional — fill when confirmed)
  sameAs?: string[] // ORCID URL, institutional page, ResearchGate, etc.
}

// Real members only — "Recruiting" slots are NOT rendered as Person nodes.
// Update this roster as members are confirmed.
export const BOARD_MEMBERS: BoardMember[] = [
  // Leadership
  {
    name: 'Madhan Jeyaraman, MBBS, MS, MBA, PhD',
    givenName: 'Madhan',
    familyName: 'Jeyaraman',
    honorificSuffix: 'MBBS, MS, MBA, PhD',
    jobTitle: 'Editor-in-Chief',
    medicalSpecialty: 'Orthopedic Surgery',
    affiliation: 'Dr. MGR Educational and Research Institute, Chennai',
  },
  {
    name: 'Kanwar Parhar, MD',
    givenName: 'Kanwar',
    familyName: 'Parhar',
    honorificSuffix: 'MD',
    jobTitle: 'Founding Editor',
    medicalSpecialty: 'Orthopedic Surgery',
    // affiliation + sameAs to be populated when ready
  },
  // Section Editors
  {
    name: 'Nathaniel Schaffer, MD',
    givenName: 'Nathaniel',
    familyName: 'Schaffer',
    honorificSuffix: 'MD',
    jobTitle: 'Section Editor',
    medicalSpecialty: 'Orthopedic Trauma',
  },
  {
    name: 'Miguel A. Schmitz, MD',
    givenName: 'Miguel',
    familyName: 'Schmitz',
    honorificSuffix: 'MD',
    jobTitle: 'Section Editor',
    medicalSpecialty: 'Spine Surgery',
  },
  {
    name: 'Bill K. Huang, MD',
    givenName: 'Bill',
    familyName: 'Huang',
    honorificSuffix: 'MD',
    jobTitle: 'Section Editor',
    medicalSpecialty: 'Adult Reconstruction',
  },
  {
    name: 'Sukhman Singh, MBBS, MS',
    givenName: 'Sukhman',
    familyName: 'Singh',
    honorificSuffix: 'MBBS, MS',
    jobTitle: 'Section Editor',
    medicalSpecialty: 'Foot and Ankle Surgery',
  },
  {
    name: 'Dheeraj Makkar, MBBS, MS',
    givenName: 'Dheeraj',
    familyName: 'Makkar',
    honorificSuffix: 'MBBS, MS',
    jobTitle: 'Section Editor',
    medicalSpecialty: 'Sports Medicine',
  },
  // Associate Editors
  {
    name: 'Vikash, MBBS, MS',
    givenName: 'Vikash',
    // mononym — no familyName provided; @id derivation falls back to givenName
    honorificSuffix: 'MBBS, MS',
    jobTitle: 'Associate Editor',
    medicalSpecialty: 'Orthopedic Surgery',
  },
  {
    name: 'Abhijit Jayan, MBBS, MS',
    givenName: 'Abhijit',
    familyName: 'Jayan',
    honorificSuffix: 'MBBS, MS',
    jobTitle: 'Associate Editor',
    medicalSpecialty: 'Orthopedic Surgery',
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
  },
  // Review Editor
  {
    name: 'Manvir Kaur, MS',
    givenName: 'Manvir',
    familyName: 'Kaur',
    honorificSuffix: 'MS',
    jobTitle: 'Review Editor',
    medicalSpecialty: 'Orthopedic Surgery',
  },
]

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
      // Links each Person back to the root Organization node emitted in app/layout.tsx.
      memberOf: { '@id': 'https://www.oscrsj.com/#organization' },
    })),
  }
}
