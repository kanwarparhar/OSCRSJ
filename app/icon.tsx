import { readFileSync } from 'fs'
import { join } from 'path'

export const size = { width: 461, height: 461 }
export const contentType = 'image/png'

// Favicon — serves the canonical OSCRSJ seal as a transparent-background
// circle (cream background outside the seal stripped 2026-04-23 so the
// favicon reads as a clean circular mark on browser-tab backgrounds of any
// color). Static file read so the actual seal PNG is delivered rather than
// a generated placeholder. Google Search picks this up on its next crawl
// (typically 1–3 weeks).
export default function Icon() {
  const imageBuffer = readFileSync(join(process.cwd(), 'public/favicon.png'))
  return new Response(imageBuffer, {
    headers: { 'Content-Type': 'image/png' },
  })
}
