// ============================================================
// Public constants used by both /apc + /contact form clients
// ============================================================
// Lives outside `actions.ts` because `actions.ts` is a 'use server'
// module — Next.js 14 only allows async-function exports from server
// action files, so non-function constants like CONTACT_SUBJECT_LABELS
// must be hoisted out.
// ============================================================

export const CONTACT_SUBJECT_LABELS: readonly string[] = [
  'General Inquiry',
  'Manuscript Submission',
  'Editorial Board Interest',
  'APC Waiver Request',
  'Other',
] as const
