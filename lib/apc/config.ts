// ---------------------------------------------------------------
// OSCRSJ Article Processing Charge — single source of truth.
//
// Every author-facing surface (the /apc page, /publication-agreement,
// the submission wizard's agreement step, the FAQ, Terms of Service,
// and the Journal Finder metadata block) reads its numbers from this
// file. Changing the fee should mean changing APC_AMOUNT_USD and
// bumping APC_AGREEMENT_VERSION — nothing else.
//
// History:
//   2026-04 → 2026-07-31  Launch-window full waiver ($0). Retired.
//   2026-08-01 →          Flat $399 USD per accepted manuscript.
// ---------------------------------------------------------------

/** Flat APC in whole US dollars, charged once per accepted manuscript. */
export const APC_AMOUNT_USD = 399

/** Same figure in cents, for Stripe / the payments table. */
export const APC_AMOUNT_CENTS = APC_AMOUNT_USD * 100

export const APC_CURRENCY = 'USD'

/** Pre-formatted for display, e.g. "$399 USD". */
export const APC_DISPLAY = `$${APC_AMOUNT_USD}`
export const APC_DISPLAY_WITH_CURRENCY = `$${APC_AMOUNT_USD} ${APC_CURRENCY}`

/**
 * First day the standard APC applies. Manuscripts whose initial
 * submission timestamp falls strictly before this date were submitted
 * under the retired launch-window waiver and are published free of
 * charge — see APC_GRANDFATHER_NOTE.
 */
export const APC_EFFECTIVE_DATE = '2026-08-01'
export const APC_EFFECTIVE_DATE_LABEL = 'August 1, 2026'

export const APC_GRANDFATHER_NOTE =
  'Manuscripts first submitted on or before July 31, 2026 are honored under the terms in effect at the time of submission and carry no article processing charge, whatever their decision date.'

/**
 * Version stamp recorded alongside each author's acceptance of the
 * publication agreement. Bump on any substantive change to the
 * agreement text or the fee, so historical acceptances stay
 * attributable to the terms the author actually saw.
 */
export const APC_AGREEMENT_VERSION = '2026-08-01'

/** Days from the acceptance invoice to payment due. */
export const APC_PAYMENT_TERMS_DAYS = 30

/**
 * The three statements an author must affirm on the Publication
 * Agreement step of the submission wizard. Kept here so the wizard,
 * the /publication-agreement page, and any future PDF receipt render
 * identical wording.
 */
export const APC_AGREEMENT_CLAUSES = {
  fee: `I understand that if this manuscript is accepted for publication, the corresponding author is responsible for a one-time article processing charge of ${APC_DISPLAY_WITH_CURRENCY}. The charge applies once per accepted manuscript, regardless of the number of authors, revisions, or figures. Nothing is payable if the manuscript is rejected or withdrawn before acceptance.`,
  license: `I confirm that all authors agree to publication under a Creative Commons Attribution 4.0 International (CC BY 4.0) license, that the authors retain copyright, and that I am authorized by my co-authors to enter into this agreement on their behalf.`,
  warranties: `I confirm the manuscript is original, is not under consideration elsewhere, contains no material that infringes another party's rights, and that all required patient consent and ethics approvals have been obtained and can be produced on request.`,
} as const

/** Full ordered list, for iterating in the UI. */
export const APC_AGREEMENT_CLAUSE_LIST = [
  { key: 'fee' as const, label: 'Article processing charge', text: APC_AGREEMENT_CLAUSES.fee },
  { key: 'license' as const, label: 'Licensing and copyright', text: APC_AGREEMENT_CLAUSES.license },
  { key: 'warranties' as const, label: 'Author warranties', text: APC_AGREEMENT_CLAUSES.warranties },
]
