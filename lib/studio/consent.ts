// ============================================================
// Submission Studio -- marketing consent (single source of truth)
// ============================================================
// Kanwar directive, 2026-07-25: consent to receive email about the Studio AND
// about the journal is REQUIRED to use the free Studio, on one combined list.
//
// Three things this file exists to guarantee:
//
//   1. The words shown to the user, the words stored against their record, and
//      the words on /privacy are literally the same string. A consent record
//      that says "v1" while nobody can say what v1 said is worthless.
//   2. Every wording change bumps CONSENT_VERSION. NEVER edit the text of an
//      existing version -- add a new one. The stored version is the only thing
//      that lets you answer "what exactly did this person agree to, and when?"
//   3. CONSENT_SCOPE is stored per row rather than assumed globally. Today it
//      is 'studio_and_journal' for everyone. It is a column, not a constant,
//      so that journal manuscript-solicitation sends can later be narrowed to
//      a subset WITHOUT re-collecting consent from anyone -- which matters
//      because DOAJ's predatory-practice review looks specifically at whether
//      a journal solicits submissions from people who handed it unpublished
//      work. Keeping the scope addressable is the cheap insurance.
//
// Implementation note on "required": this is implemented as a tick box the
// user must actively check, not as a passive notice. The capture rate is
// identical (nobody completes a job without it), but an affirmative act with a
// timestamp is the version that survives a GDPR/CASL question, and a passive
// notice is not consent in the EU/UK at all.
// ============================================================

/** Bump on ANY wording change below. Never edit an existing version's text. */
export const CONSENT_VERSION = '2026-07-25.v1'

/** What the address is signed up for. Stored per row; see note above. */
export type ConsentScope = 'studio_only' | 'studio_and_journal'
export const CONSENT_SCOPE: ConsentScope = 'studio_and_journal'

/** The tick-box label. Shown verbatim next to the checkbox. */
export const CONSENT_LABEL =
  'Email me about Submission Studio and OSCRSJ. This is required to use the free Studio.'

/** The explanatory sentence under the box. Shown verbatim, and on /privacy. */
export const CONSENT_DETAIL =
  'Using the Studio adds your address to the OSCRSJ mailing list. We send occasional email about the Studio itself (new journals, new features, and pricing when it arrives) and about the journal (new issues and calls for papers). We do not sell your address, and every email carries a one-click unsubscribe. Formatting a manuscript here still gives OSCRSJ no claim over your work.'

/** Machine-readable record written alongside each job. */
export interface ConsentRecord {
  marketing_consent: boolean
  consent_version: string
  consent_scope: ConsentScope
  consent_at: string
}

export function currentConsentRecord(now: Date = new Date()): ConsentRecord {
  return {
    marketing_consent: true,
    consent_version: CONSENT_VERSION,
    consent_scope: CONSENT_SCOPE,
    consent_at: now.toISOString(),
  }
}
