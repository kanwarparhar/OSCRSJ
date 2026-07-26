// ============================================================
// Submission Studio -- Terms acceptance (single source of truth)
// ============================================================
// Kanwar directive, 2026-07-26. Replace the standalone marketing tick box with
// ONE mandatory box: agreement to the Submission Studio Terms. The Terms page
// is where the email and marketing use is spelled out, along with the free-run
// allowance, file retention, and the September 1 transition to paid.
//
// Same three guarantees as lib/studio/consent.ts, for the same reasons:
//   1. The words on the box, the words stored against the record, and the words
//      on /studio/terms are generated from one place.
//   2. Any wording change bumps STUDIO_TERMS_VERSION. Never edit an existing
//      version's text; add a new one. The stored version is the only thing that
//      answers "what exactly did this person agree to, and when".
//   3. It is an affirmative, unticked-by-default act with a timestamp.
//
// ---------------------------------------------------------------------------
// TWO BOXES, NOT ONE. This was reversed mid-build on 2026-07-26 and the reason
// is worth keeping, because the one-box version is the tempting one.
//
// Bundling marketing permission into terms acceptance is weaker consent. Under
// GDPR/UK GDPR and PECR, consent to marketing must be freely given and
// SEPARATE from acceptance of terms, and consent that is a condition of
// receiving the service is generally not valid consent at all. CASL is
// similar. For a US-only audience under CAN-SPAM the bundled version would
// have been fine, but the Studio is on the open web and orthopaedic authors
// are not a US-only population.
//
// So the split is:
//
//   * TERMS_CHECKBOX_*   -- required, blocks the run, no marketing language in
//                           the operative sentence.
//   * MARKETING_CHECKBOX_* -- optional, unticked, declining costs the user
//                           nothing and is not allowed to.
//
// The Terms page still DESCRIBES the mailing list, because a user deciding
// whether to tick the optional box deserves to read what it means. Describing
// it is not the same as conditioning service on it.
//
// If anyone is ever tempted to re-bundle these to lift signup numbers: the
// numbers you would lift are the ones you cannot lawfully mail in the EU/UK,
// so it buys a bigger list you can send less to.
// ---------------------------------------------------------------------------

/** Bump on ANY wording change to the Terms page or the box. Never edit a version. */
export const STUDIO_TERMS_VERSION = '2026-07-26.v1'

/** Where the Terms live. Used by the box, the footer, and the Terms page itself. */
export const STUDIO_TERMS_PATH = '/studio/terms'

export const STUDIO_TERMS_TITLE = 'Submission Studio Terms and Conditions'

export const STUDIO_TERMS_EFFECTIVE = 'July 26, 2026'

/**
 * The tick-box text. Rendered with {TERMS} replaced by a link to the Terms.
 * Split into three parts rather than dangerouslySetInnerHTML so the linked
 * words are a real Next.js <Link> and the string stays greppable.
 */
export const TERMS_CHECKBOX_BEFORE = 'I have read and agree to the '
export const TERMS_CHECKBOX_LINK = 'Submission Studio Terms and Conditions'
export const TERMS_CHECKBOX_AFTER = '.'

/** Plain-text equivalent, for the stored record and for any non-JSX context. */
export const TERMS_CHECKBOX_PLAIN =
  TERMS_CHECKBOX_BEFORE + TERMS_CHECKBOX_LINK + TERMS_CHECKBOX_AFTER

/** Shown under the box. Short on purpose: the detail is one click away. */
export const TERMS_CHECKBOX_DETAIL =
  'Required. Covers what we do with your manuscript, how long we keep it, and what the Studio does and does not promise.'

// ---------------------------------------------------------------------------
// The SEPARATE, OPTIONAL marketing box. See the note at the top of this file.
// ---------------------------------------------------------------------------

/**
 * Bump on ANY wording change to the marketing box. Tracked separately from the
 * Terms version on purpose: the two documents change for different reasons and
 * at different times, and a consent record has to name the wording the person
 * actually agreed to, not the wording of a neighbouring document that happened
 * to change the same week.
 */
export const MARKETING_CONSENT_VERSION = '2026-07-26.v2'

export const MARKETING_CHECKBOX_LABEL =
  'Email me about Submission Studio and OSCRSJ.'

export const MARKETING_CHECKBOX_DETAIL =
  'Optional. Occasional email about the Studio (new journals, new features, and pricing when it arrives) and about the journal (new issues and calls for papers). We do not sell your address, every email has one-click unsubscribe, and leaving this unticked does not affect your access to the Studio in any way.'

export interface TermsRecord {
  terms_version: string
  terms_accepted_at: string
}

export function currentTermsRecord(now: Date = new Date()): TermsRecord {
  return {
    terms_version: STUDIO_TERMS_VERSION,
    terms_accepted_at: now.toISOString(),
  }
}
