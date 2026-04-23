import { readFileSync } from 'fs'
import { join } from 'path'

export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

// Apple touch icon — shown on iOS home screens when users "Add to Home Screen"
// on oscrsj.com. Serves the full-detail seal (rings + diamond accents + OSCRSJ
// wordmark + 'ORTHOPEDIC SURGERY · CASE REPORTS · AND · SERIES · JOURNAL · MMXXVI'
// micro-text) rendered at 180×180 with a transparent background from
// public/favicon/favicon-full.svg.
export default function AppleIcon() {
  const imageBuffer = readFileSync(
    join(process.cwd(), 'public/favicon/favicon-mark-180.png')
  )
  return new Response(imageBuffer, {
    headers: { 'Content-Type': 'image/png' },
  })
}
