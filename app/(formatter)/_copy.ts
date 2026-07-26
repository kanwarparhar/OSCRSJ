/**
 * Submission Studio copy deck (Session 95 rebrand).
 *
 * Shared across the four Studio routes so a wording change lands everywhere at
 * once. Two house rules, both Kanwar directives (2026-07-15):
 *
 *   1. NO EM-DASHES in any user-facing string in this file.
 *   2. No "free during beta" framing. The tool is free; say so plainly.
 *
 * The data-handling copy is deliberately scoped to what OSCRSJ itself does and
 * can stand behind. See the note on DATA_HANDLING below before loosening any of
 * it into an absolute.
 */

export const STUDIO_NAME = 'Submission Studio'

export const HOW_IT_WORKS = [
  {
    step: '1',
    title: 'Upload your manuscript',
    body: 'Drop in your blinded manuscript as a Word .docx. Optionally attach figures as separate high-resolution files. Nothing is published. Your files only produce your output.',
  },
  {
    step: '2',
    title: 'Pick a journal and article type',
    body: "Choose your target orthopedic journal and article type. The Studio loads that journal's exact requirements, encoded from its published Guide for Authors.",
  },
  {
    step: '3',
    title: 'Download and review',
    body: 'Get your journal-formatted manuscript and compliance report on the page, with references verified and renumbered. Apply anything flagged, and submit with confidence.',
  },
]

// The four "It never…" guarantees: the product's spine (brief §3).
export const NEVER_DOES = [
  {
    title: 'Never rewrites your science',
    body: 'Content immutability is guaranteed. An automated gate compares your text before and after. If anything but a citation marker moved, it refuses to ship.',
  },
  {
    title: 'AI reads structure only',
    body: 'A language model recognizes which lines are the title, authors, and references. It never writes, paraphrases, or "improves" your prose. All formatting is applied by deterministic code.',
  },
  {
    title: 'Never upscales your figures',
    body: "Figures are checked against the journal's requirements and flagged honestly if they fall short. They are never re-rendered, upsampled, or artificially sharpened.",
  },
  {
    title: 'Never invents a requirement',
    body: "Where a journal's guide is silent, your original choice is preserved and noted in the report, not overwritten by a guess.",
  },
]

/**
 * Confidentiality copy (Kanwar directive item 4, 2026-07-15).
 *
 * IMPORTANT for whoever edits this next: every claim here is scoped to what
 * OSCRSJ itself does, because the pipeline calls a third-party model API to read
 * document structure (lib/formatting/pipeline/extract.ts, references/parse.ts).
 * That is why this says "we do not train on your manuscript" and NOT "your
 * manuscript is never shared with anyone" or "never used for training" as an
 * absolute. Those absolutes are not true today and are trivially disprovable from
 * a network tab. If the pipeline ever moves fully in-house, revisit this block.
 */
export const DATA_HANDLING = [
  {
    // "End to end" is a term of art (endpoint-to-endpoint, provider can't
    // read) that does not describe this pipeline; the body copy was already
    // accurate. Trivially-disprovable overclaims are exactly what this file's
    // top comment polices (2026-07-22, Part F).
    title: 'Encrypted in transit and at rest',
    // The 7-day deletion claim became true on the same deploy that added it:
    // the cleanup cron's formatting phase (Part E, 2026-07-22) purges every
    // job's uploads and outputs after FORMATTING_RETENTION_DAYS = 7.
    body: 'Your upload travels over TLS and is stored encrypted at rest. Your download links are signed and expire about an hour after your job finishes, and your uploads and outputs are deleted from our storage after 7 days.',
  },
  {
    title: 'Never published, never indexed',
    body: 'Your manuscript exists to produce your output and nothing else. It is never published, never indexed, and never shown to another author or to any journal.',
  },
  {
    // REWRITTEN 2026-07-25. The previous body said the address was used "only
    // to prevent abuse" and was not shared. That stopped being true the moment
    // consent to marketing became a condition of using the Studio, and a
    // data-handling card that has quietly gone false is worse than no card at
    // all. It now says plainly what the address is for. Do not soften this
    // back toward the old wording while the consent box is on the form.
    title: 'We never sell your work, and we never train on it',
    body: 'OSCRSJ does not sell your manuscript and does not train models on it. Your email address is a different thing and we are direct about it: using the Studio adds you to the OSCRSJ mailing list, covering the Studio and the journal. We do not sell or share your address, and every email carries a one-click unsubscribe.',
  },
  {
    title: 'Using the Studio is not submitting to us',
    body: 'Formatting a manuscript here gives OSCRSJ no claim over your work and no visibility into where you send it. Format for a competing journal. That is what this is for.',
  },
]

/**
 * Fable mention (Kanwar directive item 5, 2026-07-15).
 *
 * Kanwar builds this system with Claude (Fable) and asked for the association on
 * the page without specifics. Worded as a build credit because that is the claim
 * that is true. Do NOT extend this into "your manuscript is processed by Fable"
 * (it is not) or "we trained our own model" (there is no such model). Both were
 * raised and neither is shippable.
 */
export const BUILT_WITH = {
  title: 'Built with Fable',
  body: 'Submission Studio is built with Claude (Fable), the most capable model available today. What reaches your manuscript is deterministic code and the structural reading described above, never a rewrite.',
}

// Legally worded. Keep the substance; em-dashes removed per the 2026-07-15 sweep.
export const DISCLAIMER =
  'This tool applies formatting rules encoded from each journal’s published Guide for Authors, verified as of the date shown on every journal card. Journal requirements change without notice. Always confirm your manuscript against the journal’s current Guide for Authors before you submit. Submission Studio is provided by OSCRSJ free of charge on an as-is basis. It does not guarantee acceptance, and it is not affiliated with, sponsored by, or endorsed by any of the journals listed.'

export const SOURCES_LINE =
  '1. LeBlanc et al. PLOS ONE 2019;14(9):e0223116 · 2. Jiang et al. PLOS ONE 2019;14(10):e0223976 · 3. Zotero Style Repository · 4. Clotworthy et al. BMC Medicine 2023;21:155 · 5. aje.com/services/formatting'

/* -------------------------------------------------------------------------- */
/*  Journal Finder v2 — manuscript profile + reach/target/safety ladder        */
/*  (2026-07-25, per docs/2026-07-25-finder-v2-ladder-build-brief.md §4.2)     */
/*                                                                            */
/*  These strings are LOAD-BEARING. Two of them do the honesty work the whole  */
/*  feature depends on: LADDER_DISCLAIMER (we do not predict acceptance) and   */
/*  OSCRSJ_CARD.body (our own journal is not here on merit we assessed). Do    */
/*  not soften either, and do not introduce probability language anywhere in   */
/*  this block. House rule still applies: no em dashes.                        */
/* -------------------------------------------------------------------------- */

export const FINDER_V2 = {
  heroTitle: 'Find where your manuscript actually belongs.',
  heroSub:
    'Upload your manuscript. We build a verifiable profile of what it shows, you tell us what you are aiming for, and we lay out five journals: two worth reaching for, two aligned targets, and one to fall back on.',
  manualLink: 'No upload? Answer a few questions instead.',

  profileHeading: 'What we could verify from your manuscript',
  profileNull: 'Not stated in the text we read.',
  profileRejected: 'We could not verify this against the text, so it is not used.',
  confidenceHigh: 'verified',
  confidenceLow: 'read with interpretation',
  truncationNote: 'Long manuscript: we read the first ~9,000 and last ~1,500 words.',
  selfReportedBanner: 'Self-reported profile. Nothing here was verified against a manuscript.',

  questionsIntro:
    'Two questions about your own read, one about your goals. Your answers can nudge the ladder by one band at most; they never override what the text shows.',
  q1: 'How novel is this work, in your honest view?',
  q1Options: [
    { value: 'first_reported', label: 'First reported, to my knowledge' },
    { value: 'uncommon_variant', label: 'Uncommon variant of a known entity' },
    { value: 'adds_to_known', label: 'Adds to established literature' },
  ],
  q2: 'How strong are the findings?',
  q2Options: [
    { value: 'definitive_or_comparative', label: 'Definitive, or shows a comparative advantage' },
    { value: 'suggestive_descriptive', label: 'Suggestive or descriptive' },
    { value: 'negative_or_confirmatory', label: 'Negative or confirmatory' },
  ],
  q3: 'What matters most to you? (pick up to two)',
  q3Options: [
    { value: 'prestige', label: 'Prestige and readership' },
    { value: 'speed', label: 'Speed to a decision' },
    { value: 'cost', label: 'Low or no cost' },
    { value: 'oa_visibility', label: 'Open-access visibility' },
  ],

  bandLabels: { reach: 'REACH', target: 'TARGET', safety: 'SAFETY' },
  bandSubtitles: {
    reach: 'Shoot your shot',
    target: 'Aligned with your tier',
    safety: 'A dependable fallback',
  },
  reachExpectation:
    'Top-tier journals often desk-reject without reviewer feedback. Budget one to three weeks before cascading down.',

  ladderDisclaimer:
    "This ladder reflects alignment between your manuscript's verifiable characteristics and each journal's SJR standing among the journals eligible for it. It is not a prediction of acceptance, and no honest tool can offer one.",

  notRankedChip: 'Not SJR-ranked',
  buildLadderCta: 'Build my ladder',

  /* ---- Waiting screen (staged progress) ---- */
  waitTitle: 'Reading your manuscript',
  waitSub: 'Please keep this tab open. Closing it will not lose your place — we can pick the job back up.',
  waitSlowNote: 'This is taking longer than usual. We are still working; nothing has failed.',

  /* ---- Profile card, editing ---- */
  profileSub:
    'Every value below is either quoted from your text or marked as unverified. Correct anything we got wrong — your correction is used and labelled as yours.',
  editCta: 'Correct',
  editSaveCta: 'Save',
  editCancelCta: 'Cancel',
  editClearCta: 'Clear to unknown',
  authorEditedChip: 'you corrected this',
  authorEditedNote: 'Your value. We are no longer claiming your text says this.',
  noveltyReadOnlyNote:
    'This row reports the manuscript’s own novelty sentence, so it cannot be typed in here. If it is blank and your work is genuinely first-of-its-kind, the fix is to say so in the paper — which is also what an editor will look for.',
  verifiedCountLabel: (verified: number, total: number) => `${verified} of ${total} verified against your text`,

  /* ---- Journal stat row ---- */
  statSjr: 'SJR',
  statQuartile: 'Quartile',
  statApc: 'APC',
  statSpeed: 'Decision time',
  statIndexing: 'Indexed in',
  statUnknown: '—',
  statUnknownHint: 'Not verified from the journal’s own pages. Check its site before you rely on it.',
  noImpactFactorNote:
    'We show SJR rather than Journal Impact Factor: the Impact Factor is Clarivate-proprietary and cannot be republished here.',
} as const

/** Waiting-screen steps, mapped from the job status the API already reports. */
export const FINDER_STAGES = [
  { key: 'uploaded', label: 'Uploading your manuscript', detail: 'Sending the file over an encrypted link.' },
  { key: 'parsed', label: 'Opening the document', detail: 'Reading the .docx structure and pulling out the text.' },
  {
    key: 'extracted',
    label: 'Reading the study characteristics',
    detail: 'The long step. We look for design, sample size, follow-up and reported statistics.',
  },
  {
    key: 'verified',
    label: 'Checking every value against your text',
    detail: 'Anything we cannot quote from your manuscript is dropped, then the ladder is built.',
  },
] as const

export type FinderStageKey = (typeof FINDER_STAGES)[number]['key']

/** Disagreement line. {field} is the author's own word for what they rated. */
export function finderDisagreementLine(field: string): string {
  return `Your self-assessment rates ${field} higher than what we could verify in the text. The ladder uses the verified profile, nudged one band at most.`
}

/**
 * The OSCRSJ card. It exists BECAUSE we cannot honestly put our own journal in a
 * ladder we generated. The body says so in plain words; keep it that way.
 */
export const FINDER_OSCRSJ_CARD = {
  title: 'From the makers of this tool',
  body: (articleTypePhrase: string) =>
    `OSCRSJ, the Orthopedic Surgery Case Reports and Series Journal, accepts ${articleTypePhrase}. It is our own journal. It is not ranked by this tool, and its appearance here is not based on your manuscript's assessment.`,
  action: "Read OSCRSJ's Guide for Authors ↗",
}

export function finderAllEligibleLabel(n: number): string {
  return `All ${n} eligible journals, with formatting fit`
}

export function finderProvenanceLine(year: number | null, category: string): string {
  return `Journal standings: SJR ${year ?? 'year not recorded'}, Scimago category ${category}. Unknown values render as a dash; we do not guess.`
}
