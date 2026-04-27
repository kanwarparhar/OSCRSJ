// ============================================================
// Shared email shell  (v2 — dark brown brand header, no cream)
// ============================================================
// Wraps body content in a branded HTML envelope that renders
// consistently across Gmail, Outlook, Apple Mail, and institutional
// webmail. Everything is inline-styled — most email clients strip
// <style> blocks or ignore external stylesheets.
//
// Design system (rolled out 2026-04-26):
//   - Outer canvas:  warm-neutral gray (#EDECE8) — no cream
//   - Card surface:  pure white (#FFFFFF)
//   - Header strip:  brown-dark (#3d2a18) carrying the peach wordmark
//                    + "Peer Reviewed · Open Access" eyebrow tagline
//   - Footer strip:  brown-dark (#3d2a18) with peach metadata + link
//   - Display heading: DM Serif Display (Georgia fallback for clients
//                      that strip web fonts)
//   - Body type:     Helvetica Neue / Arial — system-safe sans, mirrors
//                    the site's Inter body intent without web-font calls
//   - CTA:           brown-dark bg with peach label (inverted from v1's
//                    peach-on-cream)
//   - Details list:  faint warm gray (#F7F6F4) with brown-dark left
//                    accent border (no cream tone)
//
// Replaces the cream/peach shell that shipped 2026-04-13 with the
// auth-template family. Per Kanwar 2026-04-26: "Remove the cream
// color. Use a more professional font, use our dark brown color if
// needed instead. Also, use our new logos wherever necessary."
// ============================================================

const SITE_URL = 'https://www.oscrsj.com'
// 480×64 peach wordmark on transparent — sits cleanly on the dark
// brown header strip. Hotlinks Vercel-served public asset; alt text
// covers the image-blocked fallback path most institutional mail
// clients still default to.
const WORDMARK_URL = `${SITE_URL}/brand/wordmark-peach.png`

// Color tokens — kept in sync with tailwind.config.ts brand palette.
const COLOR = {
  brownDark: '#3d2a18', // headers, CTA bg, footer strip
  brown: '#664930', // metadata accents, fine print
  ink: '#1c0f05', // primary body text on white
  peach: '#FFDBBB', // CTA label, brand accent on dark surfaces
  peachMuted: 'rgba(255,219,187,0.72)',
  canvas: '#EDECE8', // outer warm-gray (NOT cream)
  white: '#FFFFFF', // card surface
  detailsBg: '#F7F6F4', // very faint warm gray, no cream warmth
} as const

// Email-safe font stacks. Most clients strip <link rel="stylesheet">
// and external @font-face calls, so we rely on system-resident faces.
// DM Serif Display rendering is best-effort — Georgia is the locked
// fallback and looks editorially correct on its own.
const FONT_DISPLAY = `'DM Serif Display', 'Playfair Display', Georgia, 'Times New Roman', serif`
const FONT_BODY = `-apple-system, BlinkMacSystemFont, 'Helvetica Neue', Helvetica, Arial, sans-serif`

export interface EmailShellParams {
  previewText: string // shown in inbox preview pane, hidden in body
  heading: string
  bodyHtml: string // already-rendered inner HTML (paragraphs, CTAs, etc.)
  footerNote?: string
}

export interface RenderedEmail {
  html: string
  text: string
}

const FOOTER_HTML = `
  <p style="margin: 0; font-family: ${FONT_BODY}; font-size: 13px; line-height: 20px; color: ${COLOR.peach}; font-weight: 600; letter-spacing: 0.01em;">
    OSCRSJ &mdash; Orthopedic Surgery Case Reports &amp; Series Journal
  </p>
  <p style="margin: 6px 0 0 0; font-family: ${FONT_BODY}; font-size: 12px; line-height: 18px; color: ${COLOR.peachMuted};">
    Editorial Office &middot; <a href="${SITE_URL}" style="color: ${COLOR.peach}; text-decoration: none;">oscrsj.com</a>
  </p>
`

export function renderEmailShell(params: EmailShellParams): string {
  const { previewText, heading, bodyHtml, footerNote } = params

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="x-apple-disable-message-reformatting" />
    <meta name="color-scheme" content="light" />
    <meta name="supported-color-schemes" content="light" />
    <title>${escapeHtml(heading)}</title>
  </head>
  <body style="margin: 0; padding: 0; background-color: ${COLOR.canvas}; font-family: ${FONT_BODY}; color: ${COLOR.ink};">
    <span style="display: none !important; visibility: hidden; mso-hide: all; opacity: 0; color: transparent; height: 0; width: 0; overflow: hidden;">
      ${escapeHtml(previewText)}
    </span>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: ${COLOR.canvas};">
      <tr>
        <td align="center" style="padding: 40px 16px;">
          <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="max-width: 560px; width: 100%; background-color: ${COLOR.white};">
            <!-- Brand header strip -->
            <tr>
              <td align="center" style="background-color: ${COLOR.brownDark}; padding: 30px 40px 26px 40px;">
                <a href="${SITE_URL}" target="_blank" rel="noopener" style="text-decoration: none; border: 0; outline: none; color: ${COLOR.peach};">
                  <img src="${WORDMARK_URL}" alt="OSCRSJ" width="210" height="28" style="display: block; height: 28px; width: auto; max-height: 28px; max-width: 210px; border: 0; outline: none; text-decoration: none;" />
                </a>
                <p style="margin: 12px 0 0 0; font-family: ${FONT_BODY}; font-size: 10px; line-height: 14px; letter-spacing: 0.24em; text-transform: uppercase; color: ${COLOR.peachMuted}; font-weight: 600;">
                  Peer Reviewed &middot; Open Access
                </p>
              </td>
            </tr>
            <!-- Heading -->
            <tr>
              <td style="padding: 38px 40px 6px 40px;">
                <h1 style="margin: 0; font-family: ${FONT_DISPLAY}; font-size: 28px; line-height: 36px; font-weight: 400; color: ${COLOR.brownDark}; letter-spacing: -0.005em;">
                  ${escapeHtml(heading)}
                </h1>
              </td>
            </tr>
            <!-- Body -->
            <tr>
              <td style="padding: 22px 40px 36px 40px; font-family: ${FONT_BODY}; font-size: 15px; line-height: 25px; color: ${COLOR.ink};">
                ${bodyHtml}
              </td>
            </tr>
            <!-- Footer strip -->
            <tr>
              <td style="background-color: ${COLOR.brownDark}; padding: 22px 40px 26px 40px;">
                ${footerNote ? `<p style="margin: 0 0 14px 0; font-family: ${FONT_BODY}; font-size: 12px; line-height: 18px; color: ${COLOR.peachMuted}; letter-spacing: 0.04em;">${footerNote}</p>` : ''}
                ${FOOTER_HTML}
              </td>
            </tr>
          </table>
          <p style="margin: 18px 0 0 0; font-family: ${FONT_BODY}; font-size: 11px; line-height: 16px; color: ${COLOR.brown}; max-width: 560px;">
            You are receiving this email because of activity on your OSCRSJ account.
          </p>
        </td>
      </tr>
    </table>
  </body>
</html>`
}

// ---- Reusable snippet helpers ----

export function paragraph(content: string): string {
  return `<p style="margin: 0 0 16px 0; font-family: ${FONT_BODY}; font-size: 15px; line-height: 25px; color: ${COLOR.ink};">${content}</p>`
}

export function cta(href: string, label: string): string {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin: 8px 0 24px 0;">
      <tr>
        <td style="background-color: ${COLOR.brownDark}; border-radius: 2px;">
          <a href="${href}" target="_blank" rel="noopener" style="display: inline-block; padding: 14px 30px; font-family: ${FONT_BODY}; font-size: 12px; letter-spacing: 0.16em; text-transform: uppercase; color: ${COLOR.peach}; text-decoration: none; font-weight: 700;">
            ${escapeHtml(label)}
          </a>
        </td>
      </tr>
    </table>
  `
}

export function detailsList(items: Array<[string, string]>): string {
  const rows = items
    .map(
      ([label, value]) => `
      <tr>
        <td style="padding: 8px 18px 8px 0; font-family: ${FONT_BODY}; font-size: 11px; line-height: 16px; color: ${COLOR.brown}; text-transform: uppercase; letter-spacing: 0.12em; vertical-align: top; white-space: nowrap; font-weight: 700;">
          ${escapeHtml(label)}
        </td>
        <td style="padding: 8px 0; font-family: ${FONT_BODY}; font-size: 15px; line-height: 22px; color: ${COLOR.ink}; vertical-align: top;">
          ${escapeHtml(value)}
        </td>
      </tr>
    `
    )
    .join('')

  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin: 4px 0 24px 0; padding: 18px 20px; background-color: ${COLOR.detailsBg}; border-left: 3px solid ${COLOR.brownDark}; width: 100%;">
      ${rows}
    </table>
  `
}

export function plainTextFooter(): string {
  return `\n\n--\nOSCRSJ — Orthopedic Surgery Case Reports & Series Journal\nEditorial Office · https://www.oscrsj.com\n`
}

// Minimal HTML escaping (covers the unsafe characters; email content is
// first-party so we don't need a full sanitizer).
export function escapeHtml(input: string): string {
  return String(input)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
