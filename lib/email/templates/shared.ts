// ============================================================
// Shared email shell
// ============================================================
// Wraps body content in a branded HTML envelope that renders
// consistently across Gmail, Outlook, Apple Mail, and institutional
// webmail. Everything is inline-styled — most email clients strip
// <style> blocks or ignore external stylesheets.
//
// Matches the five Supabase auth templates wired up on 2026-04-13:
//   - cream background (#FFF5EB)
//   - DM Serif display headings (with Georgia fallback for email)
//   - peach CTA (#F0C49A) with brown border (#664930)
//   - editorial footer citing the journal and editorial office
// ============================================================

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
  <p style="margin: 16px 0 0 0; font-family: Georgia, 'Times New Roman', serif; font-size: 13px; line-height: 20px; color: #997E67;">
    OSCRSJ &mdash; Orthopedic Surgery Case Reports &amp; Series Journal
  </p>
  <p style="margin: 4px 0 0 0; font-family: Georgia, 'Times New Roman', serif; font-size: 13px; line-height: 20px; color: #997E67;">
    Editorial Office &middot; <a href="https://oscrsj.com" style="color: #664930; text-decoration: none;">oscrsj.com</a>
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
    <title>${escapeHtml(heading)}</title>
  </head>
  <body style="margin: 0; padding: 0; background-color: #FFF5EB; font-family: Georgia, 'Times New Roman', serif; color: #3d2a18;">
    <span style="display: none !important; visibility: hidden; mso-hide: all; opacity: 0; color: transparent; height: 0; width: 0; overflow: hidden;">
      ${escapeHtml(previewText)}
    </span>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #FFF5EB;">
      <tr>
        <td align="center" style="padding: 40px 16px;">
          <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="max-width: 560px; width: 100%; background-color: #FFFFFF; border: 1px solid rgba(153,126,103,0.18); border-radius: 6px;">
            <tr>
              <td style="padding: 32px 40px 8px 40px; border-bottom: 1px solid rgba(153,126,103,0.12);">
                <p style="margin: 0; font-family: Georgia, 'Times New Roman', serif; font-size: 12px; letter-spacing: 2px; text-transform: uppercase; color: #997E67;">
                  OSCRSJ Editorial Office
                </p>
                <h1 style="margin: 12px 0 20px 0; font-family: 'DM Serif Display', Georgia, 'Times New Roman', serif; font-size: 26px; line-height: 32px; font-weight: 400; color: #1c0f05;">
                  ${escapeHtml(heading)}
                </h1>
              </td>
            </tr>
            <tr>
              <td style="padding: 24px 40px 32px 40px; font-family: Georgia, 'Times New Roman', serif; font-size: 15px; line-height: 24px; color: #3d2a18;">
                ${bodyHtml}
              </td>
            </tr>
            <tr>
              <td style="padding: 20px 40px 32px 40px; border-top: 1px solid rgba(153,126,103,0.12); background-color: #F5EAE0; border-radius: 0 0 6px 6px;">
                ${footerNote ? `<p style="margin: 0 0 12px 0; font-family: Georgia, 'Times New Roman', serif; font-size: 13px; line-height: 20px; color: #664930;">${footerNote}</p>` : ''}
                ${FOOTER_HTML}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`
}

// ---- Reusable snippet helpers ----

export function paragraph(content: string): string {
  return `<p style="margin: 0 0 16px 0; font-family: Georgia, 'Times New Roman', serif; font-size: 15px; line-height: 24px; color: #3d2a18;">${content}</p>`
}

export function cta(href: string, label: string): string {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin: 8px 0 24px 0;">
      <tr>
        <td style="border-radius: 4px; background-color: #F0C49A; border: 1px solid #664930;">
          <a href="${href}" target="_blank" rel="noopener" style="display: inline-block; padding: 12px 24px; font-family: Georgia, 'Times New Roman', serif; font-size: 14px; letter-spacing: 1px; text-transform: uppercase; color: #1c0f05; text-decoration: none; font-weight: 600;">
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
        <td style="padding: 6px 16px 6px 0; font-family: Georgia, 'Times New Roman', serif; font-size: 13px; line-height: 20px; color: #997E67; text-transform: uppercase; letter-spacing: 1px; vertical-align: top; white-space: nowrap;">
          ${escapeHtml(label)}
        </td>
        <td style="padding: 6px 0; font-family: Georgia, 'Times New Roman', serif; font-size: 15px; line-height: 22px; color: #3d2a18; vertical-align: top;">
          ${escapeHtml(value)}
        </td>
      </tr>
    `
    )
    .join('')

  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin: 4px 0 24px 0; padding: 16px; background-color: #FFF5EB; border: 1px solid rgba(153,126,103,0.18); border-radius: 4px; width: 100%;">
      ${rows}
    </table>
  `
}

export function plainTextFooter(): string {
  return `\n\n--\nOSCRSJ — Orthopedic Surgery Case Reports & Series Journal\nEditorial Office · https://oscrsj.com\n`
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
