import { readFileSync } from 'fs'
import { join } from 'path'

export const size = { width: 32, height: 32 }
export const contentType = 'image/png'

// Favicon — serves the simplified OSCRSJ mark (transparent background, brown
// "OSCRSJ" inside a peach-brown ring). Rendered from public/favicon/favicon-mark.svg
// at 32×32 for browser-tab legibility. The full-detail seal with micro-text is
// served at 180×180 via app/apple-icon.tsx for iOS home-screen pins. Google
// Search picks this up on its next crawl (typically 1–3 weeks).
export default function Icon() {
  const imageBuffer = readFileSync(
    join(process.cwd(), 'public/favicon/favicon-mark-32.png')
  )
  return new Response(imageBuffer, {
    headers: { 'Content-Type': 'image/png' },
  })
}
