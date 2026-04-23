import { readFileSync } from 'fs'
import { join } from 'path'

export const size = { width: 486, height: 478 }
export const contentType = 'image/png'

// Favicon — serves the canonical OSCRSJ seal (cream background).
// Using a static file read so the actual seal PNG is delivered
// rather than a generated placeholder. Google Search picks this up
// as the site favicon within a few crawl cycles.
export default function Icon() {
  const imageBuffer = readFileSync(join(process.cwd(), 'public/favicon.png'))
  return new Response(imageBuffer, {
    headers: { 'Content-Type': 'image/png' },
  })
}
