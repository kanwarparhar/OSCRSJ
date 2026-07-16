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
    title: 'Encrypted end to end',
    body: 'Your upload travels over TLS and is stored encrypted at rest. Your download links are signed and expire about an hour after your job finishes.',
  },
  {
    title: 'Never published, never indexed',
    body: 'Your manuscript exists to produce your output and nothing else. It is never published, never indexed, and never shown to another author or to any journal.',
  },
  {
    title: 'We never sell it, and we never train on it',
    body: 'OSCRSJ does not sell your work and does not train models on your manuscript. We ask for your email only to prevent abuse of a free tool, and we do not share your address.',
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
