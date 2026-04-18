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
  familyName: string
  honorificSuffix: string // 'MD', 'MD, PhD', etc.
  jobTitle: string // 'Associate Editor' | 'Editor-in-Chief'
  medicalSpecialty: string // schema.org MedicalSpecialty vocab where possible
  affiliation?: string // institution name (optional — fill when confirmed)
  sameAs?: string[] // ORCID URL, institutional page, ResearchGate, etc.
}

// Real members only — "Recruiting" slots are NOT rendered as Person nodes.
// Update this roster as members are confirmed.
export const BOARD_MEMBERS: BoardMember[] = [
  {
    name: 'Nathaniel Schaffer, MD',
    givenName: 'Nathaniel',
    familyName: 'Schaffer',
    honorificSuffix: 'MD',
    jobTitle: 'Associate Editor',
    medicalSpecialty: 'Orthopedic Trauma',
    // affiliation + sameAs to be populated from Kanwar's confirmation data
  },
  {
    name: 'Miguel A. Schmitz, MD',
    givenName: 'Miguel',
    familyName: 'Schmitz',
    honorificSuffix: 'MD',
    jobTitle: 'Associate Editor',
    medicalSpecialty: 'Spine Surgery',
  },
  {
    name: 'Bill K. Huang, MD',
    givenName: 'Bill',
    familyName: 'Huang',
    honorificSuffix: 'MD',
    jobTitle: 'Associate Editor',
    medicalSpecialty: 'Adult Reconstruction',
  },
]

export function buildEditorialBoardSchema(members: BoardMember[]) {
  return {
    '@context': 'https://schema.org',
    '@graph': members.map((m) => ({
      '@type': 'Person',
      '@id': `https://www.oscrsj.com/editorial-board#${m.familyName.toLowerCase()}`,
      name: m.name,
      givenName: m.givenName,
      familyName: m.familyName,
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
