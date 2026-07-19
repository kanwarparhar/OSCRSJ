// Report copy shared between the server-side renderers (report.ts, which pulls
// in the OOXML builder) and the client results screen (FormatClient.tsx).
//
// This module exists so the client can render a report sentence WITHOUT
// importing report.ts and dragging the .docx builder into the browser bundle —
// the same client-safe split registry-meta got in Session 92. Keep it free of
// imports so it stays cheap to pull into a client component.

/**
 * Shown when the journal prescribes no manuscript layout at all (26 of 75
 * journals): the layout transform is a deliberate no-op and the author should
 * be told, not left wondering why "formatting" changed nothing.
 *
 * No em-dashes: this string renders inside the Studio UI, where the
 * no-em-dash convention applies.
 */
export const layoutNotPrescribedLine = (journal: string): string =>
  `${journal} does not prescribe manuscript layout (font, margins, spacing). ` +
  'Your formatting was preserved, and this report audits content rules instead.'
