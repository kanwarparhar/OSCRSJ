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

import { THIN_BIO_SLUGS } from './thinBioSlugs'

export interface BoardMember {
  name: string
  givenName: string
  familyName?: string // optional for mononyms (e.g. single-name members)
  honorificSuffix: string // 'MD', 'MBBS, MS, MBA, PhD', etc.
  jobTitle: string // 'Editor-in-Chief' | 'Founding Editor' | 'Managing Editor' | 'Section Editor' | 'Associate Editor' | 'Review Editor'
  /**
   * schema.org MedicalSpecialty vocabulary where applicable. Optional —
   * non-clinical board members (e.g. Managing Editor with operations or
   * business backgrounds) omit this field; the JSON-LD Person node
   * conditionally emits medicalSpecialty only when set.
   */
  medicalSpecialty?: string
  affiliation?: string // institution name (optional — fill when confirmed)
  sameAs?: string[] // ORCID URL, institutional page, ResearchGate, etc.
  slug?: string // when set, member has a bio page at /editorial-board/[slug]
}

// Real members only — "Recruiting" slots are NOT rendered as Person nodes.
// Update this roster as members are confirmed. Every member has a `slug`
// — they all get a bio page at /editorial-board/[slug]. Lean stub bios
// for members without rich CV data still render in the shared format;
// individual sections hide gracefully when their data is empty.
//
// `sameAs` convention (Sprint 2, 2026-05-03): every member declares an
// explicit `sameAs: []` even when no ORCID URI has been collected yet.
// Empty array (rather than omitted field) reads as "ORCID not yet
// collected" rather than "we forgot to add the field" — keeps Janine's
// parallel collection deliverable auditable. Brad collects ORCIDs at
// agreement signing; Janine maintains the source-of-truth ledger.
// `buildEditorialBoardSchema` filters empty `sameAs` arrays out of the
// emitted JSON-LD so the public structured-data output stays clean.
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
    sameAs: [],
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
    sameAs: [],
    slug: 'kanwar-parhar',
  },
  // Section Editors
  {
    // MSTP graduate (MD/PhD) of UT Southwestern. Credentials reflect dual
    // training; PhD added per the bio document supplied 2026-04-30.
    name: 'Nathaniel Schaffer, MD, PhD',
    givenName: 'Nathaniel',
    familyName: 'Schaffer',
    honorificSuffix: 'MD, PhD',
    jobTitle: 'Section Editor',
    medicalSpecialty: 'Orthopedic Trauma',
    affiliation: 'Denver Health',
    sameAs: [],
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
    sameAs: [],
    slug: 'chingiz-alizade',
  },
  {
    name: 'Miguel A. Schmitz, MD',
    givenName: 'Miguel',
    familyName: 'Schmitz',
    honorificSuffix: 'MD',
    jobTitle: 'Section Editor',
    medicalSpecialty: 'Spine Surgery',
    affiliation: 'Alpine Orthopaedic and Spine, PC',
    sameAs: ['https://orcid.org/0000-0002-7350-2605'],
    slug: 'miguel-schmitz',
  },
  {
    // Co-Section Editor for Spine — paired with Schmitz for load
    // redundancy + complementary depth (Schmitz: US-based dual-board
    // sports-medicine + spine surgery; Shahbazi: MD-credentialed
    // orthopedic researcher with cross-discipline interests in
    // orthopedic surgery, rheumatology, and rehabilitation, anchored at
    // the Orthopedic Subspeciality Research Center, Iran). Mirrors the
    // co-Section Editor pattern established for Trauma (Schaffer +
    // Alizade).
    name: 'Parmida Shahbazi, MD',
    givenName: 'Parmida',
    familyName: 'Shahbazi',
    honorificSuffix: 'MD',
    jobTitle: 'Section Editor',
    medicalSpecialty: 'Spine Surgery',
    affiliation: 'Orthopedic Subspeciality Research Center (OSRC)',
    sameAs: [],
    slug: 'parmida-shahbazi',
  },
  {
    name: 'Bill K. Huang, MD',
    givenName: 'Bill',
    familyName: 'Huang',
    honorificSuffix: 'MD',
    jobTitle: 'Section Editor',
    medicalSpecialty: 'Adult Reconstruction',
    affiliation:
      'Washington State University, Elson S. Floyd College of Medicine',
    sameAs: [],
    slug: 'bill-huang',
  },
  {
    // Section Editor for Adult Reconstruction. Chilean orthopedic surgeon
    // with a clinical fellowship in adult arthroplasty at the University of
    // Ottawa, decade-plus tenure in Traumatology at Hospital del Trabajador
    // de Santiago, and a current Hip Team Lead role at Clínica Universidad
    // de los Andes. Paired with Bill Huang on the Adult Reconstruction desk
    // for international + arthroplasty depth (similar load-redundancy
    // pattern to Trauma and Spine).
    name: 'Alejandro Zylberberg, MD',
    givenName: 'Alejandro',
    familyName: 'Zylberberg',
    honorificSuffix: 'MD',
    jobTitle: 'Section Editor',
    medicalSpecialty: 'Adult Reconstruction',
    affiliation: 'Hospital del Trabajador de Santiago',
    sameAs: [],
    slug: 'alejandro-zylberberg',
  },
  {
    // Third Section Editor for Adult Reconstruction. Pakistani orthopaedic
    // surgeon with deep arthroplasty + limb-reconstruction depth: dedicated
    // arthroplasty fellowship at Ospedale Alessandro Manzoni in Lecco,
    // Italy; Ilizarov fellowships at the National Ilizarov Medical Research
    // Centre in Kurgan, Russia and at Lecco; FRCS-credentialed via the
    // Royal College of Physicians and Surgeons of Glasgow. Currently
    // Associate Professor of Orthopaedic Surgery at the Lady Reading
    // Hospital Medical Teaching Institute, Peshawar, with operative
    // experience spanning cemented/non-cemented/hybrid/dual-mobility THA
    // and TKA. Joins Bill Huang and Alejandro Zylberberg on the Adult
    // Reconstruction desk for additional load redundancy and South Asia +
    // Ilizarov reconstruction depth. Credential strip applied per
    // Convention §3 ortho-marker rule (FCPS (Orthopaedic Surgery) → FCPS;
    // MRCS path superseded by FRCS).
    name: 'Muhammad Inam, MBBS, FCPS, FRCS',
    givenName: 'Muhammad',
    familyName: 'Inam',
    honorificSuffix: 'MBBS, FCPS, FRCS',
    jobTitle: 'Section Editor',
    medicalSpecialty: 'Adult Reconstruction',
    affiliation:
      'Lady Reading Hospital Medical Teaching Institute, Peshawar',
    sameAs: ['https://orcid.org/0000-0002-1358-5306'],
    slug: 'muhammad-inam',
  },
  {
    // Yash Mehta promoted from Associate Editor to Section Editor for Foot
    // and Ankle on 2026-05-06 per Kanwar directive — the desk needed
    // dedicated leadership and Yash's foot & ankle clinical depth (plus
    // robotic-arthroplasty fellowship and active NHS Senior Fellow practice)
    // matched the role. Specialty narrowed from "Foot and Ankle Surgery and
    // Adult Reconstruction" to "Foot and Ankle Surgery" to reflect the
    // section assignment; arthroplasty interests still surface in the bio.
    name: 'Yash Mehta, MBBS, MS, MRCS, SICOT Dip',
    givenName: 'Yash',
    familyName: 'Mehta',
    honorificSuffix: 'MBBS, MS, MRCS, SICOT Dip',
    jobTitle: 'Section Editor',
    medicalSpecialty: 'Foot and Ankle Surgery',
    affiliation: 'Royal Bolton Hospital NHS Trust, Manchester',
    sameAs: [],
    slug: 'yash-mehta',
  },
  {
    // Co-Section Editor for Foot and Ankle. Triple-fellowship-trained
    // orthopaedic surgeon currently completing a Foot & Ankle Surgery
    // fellowship at MedStar Union Memorial Hospital, with prior fellowships
    // in orthopaedic trauma (University of Louisville) and orthopaedic
    // oncology (University of Miami). Brings cross-disciplinary depth in
    // complex reconstruction, limb salvage, and revision surgery to the
    // Foot and Ankle desk. Paired with Yash Mehta for load redundancy.
    name: 'Jean Louka, MD',
    givenName: 'Jean',
    familyName: 'Louka',
    honorificSuffix: 'MD',
    jobTitle: 'Section Editor',
    medicalSpecialty: 'Foot and Ankle Surgery',
    affiliation: 'MedStar Union Memorial Hospital',
    sameAs: [],
    slug: 'jean-louka',
  },
  {
    name: 'Hiroki Okamura, MD, PhD',
    givenName: 'Hiroki',
    familyName: 'Okamura',
    honorificSuffix: 'MD, PhD',
    jobTitle: 'Section Editor',
    medicalSpecialty: 'Sports Medicine',
    affiliation: 'Department of Orthopedic Surgery, Showa Medical University',
    sameAs: [],
    slug: 'hiroki-okamura',
  },
  {
    name: 'Dheeraj Makkar, MD',
    givenName: 'Dheeraj',
    familyName: 'Makkar',
    honorificSuffix: 'MD',
    jobTitle: 'Section Editor',
    medicalSpecialty: 'Orthopedic Oncology',
    affiliation: 'Emory University',
    sameAs: [],
    slug: 'dheeraj-makkar',
  },
  {
    name: 'Shreya Chaudhuri, MD',
    givenName: 'Shreya',
    familyName: 'Chaudhuri',
    honorificSuffix: 'MD',
    jobTitle: 'Section Editor',
    medicalSpecialty: 'Orthopedic Microbiology and Infectious Diseases',
    sameAs: [],
    slug: 'shreya-chaudhuri',
  },
  {
    // Section Editor for Hand & Upper Extremity. Indian-trained
    // orthopaedic surgeon (MBBS / MS Orth / DNB Orth) with clinical and
    // academic interests spanning sports medicine, hand and wrist surgery,
    // and complex trauma. Currently a Senior Resident at the Sports Injury
    // Centre, Vardhman Mahavir Medical College & Safdarjung Hospital, New
    // Delhi — one of India's premier trauma + sports medicine training
    // centres. Honorific suffix preserves the parenthetical specialty
    // markers Kanwar supplied (MS (Orth), DNB (Orth)) since both MS and
    // DNB are post-MBBS specialty credentials in the Indian system and the
    // disambiguation matters for medical readers.
    name: 'Sankalp Lal, MBBS, MS, DNB',
    givenName: 'Sankalp',
    familyName: 'Lal',
    honorificSuffix: 'MBBS, MS, DNB',
    jobTitle: 'Section Editor',
    medicalSpecialty: 'Hand and Upper Extremity Surgery',
    affiliation:
      'Sports Injury Centre, Vardhman Mahavir Medical College & Safdarjung Hospital',
    sameAs: [],
    slug: 'sankalp-lal',
  },
  // Associate Editors
  {
    // Credentials updated 2026-04-30 per ResearchGate screenshot supplied
    // by Kanwar — actual designation is MS(Ortho), preserving the Indian-
    // convention specialty marker in parentheses.
    name: 'Vikash Raj, MBBS, MS',
    givenName: 'Vikash',
    familyName: 'Raj',
    honorificSuffix: 'MBBS, MS',
    jobTitle: 'Associate Editor',
    medicalSpecialty: 'Orthopedic Surgery',
    affiliation: 'All India Institute of Medical Sciences, Deoghar',
    sameAs: [],
    slug: 'vikash-raj',
  },
  {
    name: 'Abhijit Jayan, MBBS, MS',
    givenName: 'Abhijit',
    familyName: 'Jayan',
    honorificSuffix: 'MBBS, MS',
    jobTitle: 'Associate Editor',
    medicalSpecialty: 'Orthopedic Surgery',
    sameAs: [],
    slug: 'abhijit-jayan',
  },
  {
    // Western given-then-family ordering confirmed by member's own bio
    // document supplied 2026-05-15 ("Dr. Meghana Damarla, MBBS, MS
    // (Orthopaedics)"). Earlier Telugu surname-first assumption (Session 24)
    // superseded; slug flipped damarla-meghana → meghana-damarla in lock-step.
    // Ortho marker stripped per the post-MBBS specialty-marker convention
    // (Session 48): MS (Orthopaedics) → MS. Bio narrative retains the
    // orthopaedic training descriptors.
    name: 'Meghana Damarla, MBBS, MS',
    givenName: 'Meghana',
    familyName: 'Damarla',
    honorificSuffix: 'MBBS, MS',
    jobTitle: 'Associate Editor',
    medicalSpecialty: 'Orthopedic Surgery',
    affiliation: 'ESIC Medical College and Hospital, Hyderabad',
    sameAs: [],
    slug: 'meghana-damarla',
  },
  {
    name: 'Akshay Phupate, MBBS, MS',
    givenName: 'Akshay',
    familyName: 'Phupate',
    honorificSuffix: 'MBBS, MS',
    jobTitle: 'Associate Editor',
    medicalSpecialty: 'Orthopedic Surgery',
    sameAs: [],
    slug: 'akshay-phupate',
  },
  {
    // South Indian (Tamil/Telugu) given-then-family ordering assumed
    // (Adithyaa = given, Sivaramakrishnan = family). Credential `MS`
    // preserved verbatim from source; in Indian convention this typically
    // denotes Master of Surgery — flagged for Kanwar confirmation if a
    // future audit pass surfaces ambiguity.
    name: 'Adithyaa Sivaramakrishnan, MS',
    givenName: 'Adithyaa',
    familyName: 'Sivaramakrishnan',
    honorificSuffix: 'MS',
    jobTitle: 'Associate Editor',
    medicalSpecialty: 'Orthopedic Surgery',
    sameAs: [],
    slug: 'adithyaa-sivaramakrishnan',
  },
  {
    // Moved from Section Editor for Foot and Ankle to Associate Editor on
    // 2026-05-06 per Kanwar directive. Foot and Ankle desk leadership
    // shifted to Yash Mehta + Jean Louka the same day. medicalSpecialty
    // retained as Foot and Ankle Surgery to reflect ongoing clinical area.
    name: 'Sukhman Singh, MBBS, MS',
    givenName: 'Sukhman',
    familyName: 'Singh',
    honorificSuffix: 'MBBS, MS',
    jobTitle: 'Associate Editor',
    medicalSpecialty: 'Foot and Ankle Surgery',
    sameAs: [],
    slug: 'sukhman-singh',
  },
  // Managing Editor — operations leadership, sits at the leadership tier
  // alongside EIC + Founding Editor. Non-clinical role — medicalSpecialty
  // intentionally omitted (her domain is editorial operations + program
  // management, not a clinical subspecialty).
  {
    name: 'Manvir Kaur, MS',
    givenName: 'Manvir',
    familyName: 'Kaur',
    honorificSuffix: 'MS',
    jobTitle: 'Managing Editor',
    affiliation: 'OSCRSJ',
    sameAs: [],
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
    photo: '/brand/kanwar-parhar.png',
    summary:
      'Founding Editor of OSCRSJ and orthopedic surgery resident at the University of California, San Diego. Founded the journal in 2026 as an independent, open-access venue for orthopedic case reports and case series, built around rigorous peer review and substantive editorial feedback. Oversees editorial operations, journal development, and day-to-day management during the launch phase.',
    education: [
      'Medical School — Washington State University, Elson S. Floyd College of Medicine, MD',
      'Residency — Orthopedic Surgery, University of California, San Diego',
    ],
    experience: [
      'Founded OSCRSJ in 2026 to address a structural gap in orthopedic publishing: the lack of an independent, open-access venue for case reports and case series built around rigorous peer review and substantive editorial feedback, with particular emphasis on underrepresented research from across the global orthopedic surgery community.',
      'Currently completing orthopedic surgery residency training at the University of California, San Diego.',
      'Active research collaborator on multiple peer-reviewed orthopedic publications spanning trauma, sports medicine, and spine surgery.',
    ],
    achievements: [
      '28.6 ResearchGate Research Interest Score',
      '48 citations',
      'h-index of 1',
    ],
    workLocation: 'San Diego, California, United States',
  },

  // ----- Section Editors -----
  'nathaniel-schaffer': {
    photo: '/brand/nathaniel-schaffer.jpg',
    summary:
      'Chief of the orthopedic trauma team at Denver Health. MD/PhD graduate of the Medical Scientist Training Program at UT Southwestern, with a longstanding commitment to providing care in lesser-developed countries through service trips abroad.',
    education: [
      'Undergraduate — Washington University in St. Louis',
      'MD/PhD — Medical Scientist Training Program, University of Texas Southwestern Medical Center',
      'Residency — University of Michigan, Orthopedic Surgery',
      'Fellowship — Vanderbilt University Medical Center, Orthopedic Trauma',
    ],
    experience: [
      'Pursued orthopedic surgery residency training at the University of Michigan, continuing his commitment to global health service trips throughout residency.',
      'Completed his orthopedic trauma fellowship at Vanderbilt University Medical Center.',
      'Practiced briefly in Everett, Washington, before joining Denver Health, where he serves as chief of the orthopedic trauma team.',
    ],
    workLocation: 'Denver, Colorado, United States',
  },
  'chingiz-alizade': {
    photo: '/brand/chingiz-alizade.png',
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
    photo: '/brand/miguel-schmitz.png',
    summary:
      'Dual board-certified orthopedic surgeon (Orthopaedic Surgery + Sports Medicine CAQ) practicing at Alpine Orthopaedic and Spine, PC, in Spokane, Washington. Dual fellowship trained in sports medicine/arthroscopy at the University of Rochester and in spine surgery at the Harvard Combined Orthopaedic Programs (Massachusetts General Hospital and Brigham and Women’s Hospital). Active journal peer reviewer for Spine and the Journal of Orthopaedic Surgery & Research.',
    education: [
      'Undergraduate — Carroll College, Helena, Montana — B.A. Biology, Minor in Chemistry; Summa Cum Laude with Honors; Delta Epsilon Sigma Honor Society (1986–1990)',
      'Medical School — University of Washington School of Medicine; Graduated with Honors; Inducted into Alpha Omega Alpha (1990)',
      'Internship — General Surgery, University of Texas Southwestern (1990–1991)',
      'Residency — Orthopaedic Surgery, University of Texas Southwestern (1991–1995)',
      'Fellowship — Sports Medicine and Arthroscopy, University of Rochester / Strong Memorial Hospital (Kenneth DeHaven, MD, Lucien Rouse, MD, Robert Bronstein, MD) (1995–1996)',
      'Fellowship — Spine Surgery, Massachusetts General Hospital / Brigham and Women’s Hospital / Harvard Combined Orthopaedic Programs (Kirkham Wood, MD, Christopher Bono, MD, Mitchell Harris, MD) (2007–2008)',
    ],
    experience: [
      'Practicing orthopedic surgeon at Alpine Orthopaedic and Spine, PC in Spokane Valley, Washington, with dual fellowship credentials in surgical sports medicine and comprehensive spine surgery.',
      'Clinical Assistant Professor at Washington State University, Elson S. Floyd College of Medicine (2019–present); Clinical Assistant Professor at the University of Washington MEDEX Physician Assistant Training Program (2022–present); preceptor at the Heritage University Physician Assistant Educational Program (2017–present).',
      'Active journal peer reviewer for Spine (2020–present) and the Journal of Orthopaedic Surgery & Research (2025–present).',
      'Qualified Medical Examiner for the California Department of Workers’ Compensation (2026); active medical licensure in Washington, Idaho, and California.',
    ],
    achievements: [
      'Dual board certification — American Board of Orthopaedic Surgery (recertified in 2008 with a 99th-percentile written score) and ABOS Certificate of Added Qualification for Sports Medicine (certified in 2008 with a 95th-percentile score)',
      '30+ peer-reviewed publications spanning sports medicine, knee surgery, spine surgery, and orthopedic case reports',
      'Two book chapters in Vaccaro, Fehlings, and Dvorak, eds., Spine and Spinal Cord Trauma (Thieme, 2011): "Imaging of the Thoracic and Lumbar Spine During the Emergency Department Evaluation" and "The Benefits of Early Stabilization of Spinal Fractures in the Trauma Patient"',
      'Selected publications in Clinical Orthopaedics and Related Research, American Journal of Sports Medicine, Spine, The Spine Journal, Clinics in Sports Medicine, and the Journal of Orthopaedic Trauma',
      'Team physician experience including the Rochester Amerks (AHL hockey), Rochester Red Wings (AAA baseball), St. John Fisher College (NCAA Division III), and the Empire State Games',
    ],
    memberships: [
      'North American Spine Society — NASS (2009–present)',
      'Arthroscopy Association of North America — AANA (2002–present)',
      'American Orthopaedic Society for Sports Medicine — AOSSM (2002–present)',
      'American Academy of Orthopaedic Surgeons — AAOS (2000–present)',
      'Alpha Omega Alpha Medical Honor Society — AΩA, University of Washington (1990–present)',
      'American Medical Association — AMA (1987–present)',
      'Delta Epsilon Sigma Honor Society — Carroll College (1985–present)',
      'Spokane County Medical Society',
    ],
    awards: [
      '2026 — Qualified Medical Examiner, California Department of Workers’ Compensation',
      '2008 — ABOS Certificate of Added Qualification for Sports Medicine, certified at the 95th percentile',
      '2008 — ABOS Recertification, written-pathway score at the 99th percentile',
      '1990 — Inducted into Alpha Omega Alpha Medical Honor Society, University of Washington School of Medicine',
      '1989 — Medical Thesis Honor in Biochemistry, University of Washington',
      '1986 — John Richardson Prize for Anatomical Studies, Montana State University',
    ],
    workLocation: 'Spokane, Washington, United States',
  },
  'parmida-shahbazi': {
    photo: '/brand/parmida-shahbazi.png',
    summary:
      'MD-credentialed orthopedic researcher and Section Editor for Spine at OSCRSJ. Research scientist at the Orthopedic Subspeciality Research Center (OSRC), with cross-disciplinary interests spanning orthopedic surgery, rheumatology, and rehabilitation medicine.',
    education: ['Doctor of Medicine (MD)'],
    experience: [
      'MD graduate and general physician at a referral trauma center, with active clinical work in the orthopedic surgery department.',
      'Research scientist at the Orthopedic Subspeciality Research Center (OSRC), pursuing research interests across orthopedic surgery and rheumatology.',
      'Clinical practice in a physical therapy clinic, with continued engagement in patient care and rehabilitation. Committed to expanding the boundaries of orthopedic science and advocating for improved patient care through ongoing research.',
    ],
    achievements: [
      '68.9 ResearchGate Research Interest Score',
      '110 citations',
      'h-index of 5',
    ],
    workLocation: 'Iran',
  },
  'alejandro-zylberberg': {
    photo: '/brand/alejandro-zylberberg.webp',
    summary:
      'Section Editor for Adult Reconstruction at OSCRSJ. Chilean orthopedic surgeon with a clinical fellowship in adult arthroplasty at the University of Ottawa, decade-plus tenure in Traumatology at Hospital del Trabajador de Santiago, and an active Hip Team Lead role at Clínica Universidad de los Andes.',
    education: [
      'Orthopedic Surgery Residency — Universidad de los Andes (Chile), Santiago, Chile (2005–2008)',
      'Clinical Fellowship in Adult Arthroplasty — University of Ottawa (2011)',
    ],
    experience: [
      'Hip Team Lead, Clínica Universidad de los Andes, Santiago, Chile (2014–present).',
      'Traumatology, Hospital del Trabajador de Santiago, Santiago, Chile (2011–2021).',
      'Active orthopedic researcher with peer-reviewed publications in adult reconstruction and traumatology.',
    ],
    achievements: [
      '9 publications',
      '1,341 reads',
      '256 citations',
    ],
    workLocation: 'Santiago, Chile',
  },
  'muhammad-inam': {
    photo: '/brand/muhammad-inam.png',
    summary:
      'Section Editor for Adult Reconstruction at OSCRSJ. Associate Professor of Orthopaedic Surgery at the Lady Reading Hospital Medical Teaching Institute in Peshawar, Pakistan, with subspecialty depth in adult arthroplasty (cemented, non-cemented, hybrid, and dual-mobility THA; total and unicompartmental TKA) and Ilizarov limb reconstruction. Fellowship-trained in arthroplasty and Ilizarov technique in Italy and Russia, FRCS-credentialed via the Royal College of Physicians and Surgeons of Glasgow.',
    education: [
      'MBBS — Peshawar University, Pakistan (1994)',
      'FCPS (Orthopaedic Surgery) — College of Physicians and Surgeons Pakistan (2011)',
      'MRCSEd — Royal College of Surgeons of Edinburgh (2012)',
      'Ilizarov Fellowship in Limb Reconstruction — National Ilizarov Medical Research Centre for Traumatology and Orthopaedics, Kurgan, Russia (2013)',
      'Arthroplasty Fellowship — Ospedale Alessandro Manzoni, Lecco, Italy (2015)',
      'Ilizarov Fellowship — Ospedale Alessandro Manzoni, Lecco, Italy (2015)',
      'Diploma in Health Care Management — Athena Global Education, Oxford, UK (2023)',
      'Fellowship in Arthroscopy, Sports Surgery, Orthobiology and Arthroplasty — Interbalkan European Hospital, Greece (2025)',
      'FRCS — Royal College of Physicians and Surgeons of Glasgow (2025)',
      'Diploma in Health Professional Education — Health Services Academy, Islamabad (2026)',
    ],
    experience: [
      'Associate Professor of Orthopaedic Surgery, Department of Orthopaedics and Trauma, Lady Reading Hospital Medical Teaching Institute, Peshawar (Jan 2023 – present); previously Assistant Professor at the same department (May 2017 – Jan 2023), with prior Senior Registrar and Junior Registrar appointments at PGMI Hayatabad Medical Complex, Peshawar (2010 – 2017).',
      'Operative breadth across adult reconstruction (cemented, non-cemented, hybrid, and dual-mobility total hip arthroplasty; total and unicompartmental knee arthroplasty), trauma (Dynamic Hip Screw, interlocking nails, MIPO, pelvis and acetabulum fixation), Ilizarov limb reconstruction and deformity correction, arthroscopic sports surgery (ACL/PCL/MPFL reconstruction, meniscal repair, rotator cuff and labral repair), and anterior/posterior thoracolumbar and cervical spine fixation.',
      'Controller of Examination, College of Physicians and Surgeons Pakistan (CPSP), Peshawar (March 2023 – November 2024) — conducted FCPS, MCPS, and IMM examinations across all medical and surgical specialties.',
      'CPSP Supervisor in Orthopaedics and POA Deformity Correction Supervisor; Chairman of the Departmental Research Committee at Lady Reading Hospital MTI Peshawar (June 2024 – present); Member of the Operation Theatre and Infection Control Committee (Sept 2025 – present).',
    ],
    achievements: [
      '100+ peer-reviewed publications across orthopaedic trauma, adult reconstruction, Ilizarov limb reconstruction, spine, and sports surgery',
      'Active reviewer for BMJ Case Reports, BMC Musculoskeletal Disorders, Cureus Journal of Medical Sciences, Journal of the College of Physicians and Surgeons of Pakistan, and over a dozen additional orthopaedic and surgical journals',
      'Associate Editor at three peer-reviewed journals: BMC Musculoskeletal Disorders (UK), Cureus Journal of Medical Sciences (US), and Orthopedic and Sports Medicine Open Access Journal (US)',
      'Faculty and organizer at multiple national workshops on Ilizarov technique, hip and knee arthroplasty, and pelvis & acetabulum fixation across Pakistan',
    ],
    memberships: [
      'Pakistan Orthopaedic Association — POA (Lifetime Member)',
      'Société Internationale de Chirurgie Orthopédique et de Traumatologie — SICOT',
      'AO Trauma',
      'American Academy of Orthopaedic Surgeons — AAOS',
      'ASAMI Pakistan (Lifetime Member)',
      'Fellow, American College of Surgeons',
      'Pakistan Arthroplasty Society (Lifetime Member)',
      'Asia Pacific Orthopaedic Association (Lifetime Member)',
      'International Society of Arthroscopy, Knee Surgery and Orthopaedic Sports Medicine — ISAKOS (Lifetime Member)',
    ],
    workLocation: 'Peshawar, Pakistan',
  },
  'bill-huang': {
    photo: '/brand/bill-huang.jpg',
    summary:
      'Board-certified orthopedic surgeon specializing in hip and knee arthritis, total and partial joint replacement, and robotic/computer-assisted joint replacement surgery. Clinical professor at Washington State University, Elson S. Floyd College of Medicine.',
    education: [
      'Medical School — Northwestern University Feinberg School of Medicine, MD',
      'Residency — University of California San Diego',
      'Fellowship — Anderson Orthopaedic Clinic, Adult Reconstruction Surgery',
    ],
    experience: [
      'Specializes in hip and knee arthritis, total and partial joint replacement, and robotic/computer-assisted joint replacement surgery.',
      'Committed to helping patients become informed and confident about the range of treatments available for their arthritis, with a goal of providing world-class, cutting-edge treatment options.',
      'Clinical professor at Washington State University, Elson S. Floyd College of Medicine, where he provides clinical instruction for medical students in orthopedic surgery.',
    ],
  },
  'jean-louka': {
    photo: '/brand/jean-louka.png',
    summary:
      'Section Editor for Foot and Ankle Surgery at OSCRSJ. Triple-fellowship-trained orthopaedic surgeon currently completing a Foot & Ankle Surgery fellowship at MedStar Union Memorial Hospital, with prior fellowships in orthopaedic trauma and musculoskeletal oncology. Brings the breadth to manage complex reconstruction, limb salvage, and revision surgery where subspecialties intersect, and is pursuing an academic career focused on surgical education and advancing outcomes in complex foot & ankle care.',
    experience: [
      'Foot & Ankle Surgery Fellow, MedStar Union Memorial Hospital, Baltimore, Maryland (Aug 2025 – present).',
      'Orthopaedic Oncology Fellow, University of Miami, Miami, Florida (Aug 2024 – Jul 2025).',
      'Orthopaedic Trauma Fellow, University of Louisville, Louisville, Kentucky (Aug 2023 – Jul 2024).',
      'Orthopaedic Surgery Resident, Hôpital Simone Veil — Groupement hospitalier Eaubonne-Montmorency, Eaubonne, France (Nov 2019 – Oct 2021).',
    ],
    workLocation: 'Baltimore, Maryland, United States',
  },
  'sukhman-singh': {
    summary:
      'Associate Editor at OSCRSJ. Brings clinical expertise across foot and ankle reconstruction, deformity correction, and trauma to the journal’s peer-review process.',
  },
  'hiroki-okamura': {
    photo: '/brand/hiroki-okamura.png',
    summary:
      'Orthopedic surgeon at the Department of Orthopedic Surgery, Showa Medical University, with clinical and research interests focused on sports medicine and knee surgery — including ligament injuries, meniscal disorders, and degenerative knee conditions.',
    experience: [
      'Faculty appointment at the Department of Orthopedic Surgery, Showa Medical University.',
      'Subspecialty focus on sports medicine and knee surgery, with emphasis on ligament injuries, meniscal disorders, and degenerative knee conditions.',
      'Actively engaged in patient care and academic research, contributing to the advancement of orthopedic surgery through clinical practice and scholarly activities. Selected work includes "Circumferential Meniscal Reconstruction Using the Semitendinosus Tendon for a Medial" meniscal repair technique.',
    ],
    achievements: [
      '12 research works',
      '88 citations',
    ],
    workLocation: 'Tokyo, Japan',
  },
  'dheeraj-makkar': {
    photo: '/brand/dheeraj-makkar.png',
    summary:
      'Orthopaedic oncology fellow at Emory University with focused expertise in musculoskeletal tumor surgery, limb salvage, and complex reconstructions. Completed orthopaedic training in India and pursued advanced fellowship training in the United States.',
    experience: [
      'Orthopaedic Oncology Fellow, Emory University.',
      'Subspecialty focus on orthopaedic oncology, with particular emphasis on limb salvage and complex musculoskeletal reconstruction.',
      'Academic interests include translational oncology, surgical outcomes, and innovation in multidisciplinary musculoskeletal care.',
    ],
    workLocation: 'Atlanta, Georgia, United States',
  },
  'shreya-chaudhuri': {
    summary:
      'Section Editor for Orthopedic Microbiology and Infectious Diseases at OSCRSJ. Brings clinical expertise across periprosthetic joint infection, osteomyelitis, and infection-related reconstruction to the journal’s peer-review process.',
  },
  'sankalp-lal': {
    photo: '/brand/sankalp-lal.jpg',
    summary:
      'Orthopaedic surgeon with clinical and academic interests in sports medicine, hand and wrist surgery, and complex trauma. Senior Resident at the Sports Injury Centre, Vardhman Mahavir Medical College & Safdarjung Hospital, New Delhi. Active orthopaedic researcher with publications spanning trauma, spine, and sports-related conditions, including case reports and clinical studies — focused on evidence-based practice, surgical innovation, and academic collaboration within orthopaedics.',
    education: [
      'MBBS',
      'MS (Orthopaedics)',
      'DNB (Orthopaedics)',
    ],
    experience: [
      'Senior Resident, Sports Injury Centre, Vardhman Mahavir Medical College & Safdarjung Hospital, New Delhi.',
      'Subspecialty focus on sports medicine, hand and wrist surgery, and complex trauma.',
      'Active orthopaedic researcher with peer-reviewed publications across trauma, spine, and sports-related conditions, including case reports and clinical studies.',
    ],
    workLocation: 'New Delhi, India',
  },

  // ----- Associate Editors -----
  'vikash-raj': {
    photo: '/brand/vikash-raj.png',
    summary:
      'Additional Professor of Orthopedic Surgery at All India Institute of Medical Sciences, Deoghar, with a longstanding faculty tenure spanning Assistant Professor through Associate and Additional Professor appointments at AIIMS Deoghar since 2020.',
    experience: [
      'All India Institute of Medical Sciences, Deoghar — Additional Professor (Jun 2025 – present).',
      'All India Institute of Medical Sciences, Deoghar — Associate Professor (Jun 2022 – Jun 2025).',
      'All India Institute of Medical Sciences, Deoghar — Assistant Professor (Nov 2020 – Jun 2022).',
    ],
    achievements: [
      '83 publications',
      '5,405 reads',
      '169 citations',
    ],
    workLocation: 'Deoghar, Jharkhand, India',
  },
  'abhijit-jayan': {
    summary:
      'Associate Editor at OSCRSJ. Contributes to peer review and editorial decision-making across orthopedic case reports and series.',
  },
  'meghana-damarla': {
    photo: '/brand/meghana-damarla.png',
    summary:
      'Orthopaedic surgeon with clinical and academic interests in general orthopaedics and trauma. Senior Resident in the Department of Orthopaedics at ESIC Medical College and Hospital, Sanathnagar, Hyderabad, with prior postgraduate training at Dr. D.Y. Patil Medical College Hospital & Research Centre, Pimpri, Pune. Active in patient care, surgical training, and academic activities, with a focus on evidence-based orthopaedic practice, trauma management, and continuous medical education.',
    education: [
      'MBBS',
      'MS Orthopaedics — Dr. D.Y. Patil Medical College Hospital & Research Centre, Pimpri, Pune',
    ],
    experience: [
      'Senior Resident, Department of Orthopaedics, ESIC Medical College and Hospital, Sanathnagar, Hyderabad, Telangana — current.',
      'Postgraduate training in Orthopaedics at Dr. D.Y. Patil Medical College Hospital & Research Centre, Pimpri, Pune.',
      'Clinical and academic interests in general orthopaedics and trauma, with active involvement in patient care, surgical training, and academic activities.',
      'Focused on evidence-based orthopaedic practice, trauma management, and continuous medical education; ongoing interest in research and advancements in orthopaedic surgery.',
    ],
    workLocation: 'Hyderabad, Telangana, India',
  },
  'akshay-phupate': {
    summary:
      'Associate Editor at OSCRSJ. Contributes to peer review and editorial decision-making across orthopedic case reports and series.',
  },
  'yash-mehta': {
    photo: '/brand/yash-mehta.jpg',
    summary:
      'Orthopaedic surgeon with subspecialty interests in foot & ankle surgery and arthroplasty. Currently practicing as a Senior Fellow in the NHS at Royal Bolton Hospital NHS Trust, Manchester, UK while pursuing the MCh in Trauma & Orthopaedics. Indian-trained (MBBS, MS) with the MRCS and SICOT Diploma; brings four years of postgraduate orthopaedic training plus a robotic arthroplasty fellowship to clinical and research practice. Experienced across trauma and elective orthopaedic surgery, including arthroplasty and foot & ankle care, with strong operative and clinical decision-making skills. ATLS Instructor committed to patient safety and NHS values, aspiring to Higher Surgical Training via CESR and FRCS while advancing clinical, operative, and leadership expertise.',
    education: [
      'MBBS — Government Medical College, Surat, India (2018)',
      'MS Orthopaedics (Gold Medal) — Government Medical College, Surat, India (2022)',
      'MRCS — Royal College of Surgeons of England',
      'SICOT Diploma — Société Internationale de Chirurgie Orthopédique et de Traumatologie',
    ],
    experience: [
      'Senior Fellow in Trauma & Orthopaedics at Royal Bolton Hospital NHS Trust, Manchester, UK; concurrently pursuing the MCh in Trauma & Orthopaedics.',
      'Four years of postgraduate MS Orthopaedics training in India, followed by a Robotic Arthroplasty fellowship at Apollo Hospitals, Navi Mumbai.',
      'Subspecialty focus on foot & ankle surgery and arthroplasty, with clinical experience across trauma and elective orthopaedic surgery.',
      'ATLS Instructor (American College of Surgeons); committed to patient safety and NHS values.',
      'Aspiring to Higher Surgical Training via CESR and FRCS (Tr & Orth).',
    ],
    workLocation: 'Manchester, United Kingdom',
  },
  'adithyaa-sivaramakrishnan': {
    summary:
      'Associate Editor at OSCRSJ. Contributes to peer review and editorial decision-making across orthopedic case reports and series.',
  },

  // ----- Managing Editor -----
  'manvir-kaur': {
    photo: '/brand/manvir-kaur.png',
    summary:
      'Managing Editor of OSCRSJ. Leads day-to-day editorial operations across reviewer recruitment, peer-review coordination, manuscript workflow, and cross-functional program management. Brings a decade of strategy and program management leadership at Fortune 500 corporations to the operational backbone of an independent research journal.',
    education: [
      'Master of Science in Business Management — Portland State University',
      'Bachelor of Business Administration — University of Washington',
    ],
    experience: [
      'Managing Editor at OSCRSJ — leads reviewer recruitment, peer-review coordination, manuscript pipeline operations, editorial workflow design, and the journal’s cross-functional program management. Owns day-to-day operations during the launch phase.',
      'Cross-functional strategy and program management leadership at Nike, where she led program teams spanning product, supply chain, and operations.',
      'Strategy and program management at Nordstrom, with a focus on cross-functional program execution and organizational strategy.',
    ],
    achievements: [
      'Led cross-functional strategy and program management teams at two Fortune 500 corporations: Nike and Nordstrom',
      'Master of Science in Business Management (Portland State University) and Bachelor of Business Administration (University of Washington)',
    ],
    workLocation: 'Portland, Oregon, United States',
  },
}

export function buildEditorialBoardSchema(members: BoardMember[]) {
  // Thin-bio members are stripped from the aggregate @graph: with their
  // per-bio route returning 404 (no destination page), an entity-graph
  // Person node would point crawlers at a hollow entity. They still render
  // visually on the page. Auto-reverses when the slug leaves THIN_BIO_SLUGS.
  return {
    '@context': 'https://schema.org',
    '@graph': members
      .filter((m) => !(m.slug && THIN_BIO_SLUGS.has(m.slug)))
      .map((m) => ({
      '@type': 'Person',
      '@id': `https://www.oscrsj.com/editorial-board#${(m.familyName || m.givenName).toLowerCase()}`,
      name: m.name,
      givenName: m.givenName,
      ...(m.familyName && { familyName: m.familyName }),
      honorificSuffix: m.honorificSuffix,
      jobTitle: m.jobTitle,
      ...(m.medicalSpecialty && { medicalSpecialty: m.medicalSpecialty }),
      ...(m.affiliation && {
        affiliation: { '@type': 'Organization', name: m.affiliation },
      }),
      // Filter empty arrays — every member declares an explicit `sameAs: []`
      // when no ORCID has been collected yet (see top-of-file convention),
      // but emitting an empty `"sameAs": []` to JSON-LD is noise. Only emit
      // when at least one URL is present.
      ...(m.sameAs && m.sameAs.length > 0 && { sameAs: m.sameAs }),
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
    ...(member.medicalSpecialty && { medicalSpecialty: member.medicalSpecialty }),
    description: bio.summary,
    ...(bio.photo && { image: `https://www.oscrsj.com${bio.photo}` }),
    url: `https://www.oscrsj.com/editorial-board/${member.slug}`,
    ...(member.affiliation && {
      affiliation: { '@type': 'Organization', name: member.affiliation },
    }),
    ...(bio.workLocation && {
      workLocation: { '@type': 'Place', name: bio.workLocation },
    }),
    // Filter empty arrays per top-of-file convention — empty `sameAs: []`
    // declares "ORCID not yet collected" in source, but emitting an empty
    // array to JSON-LD is noise.
    ...(member.sameAs && member.sameAs.length > 0 && { sameAs: member.sameAs }),
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
