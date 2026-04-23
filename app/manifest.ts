import type { MetadataRoute } from 'next'

// Web App Manifest — controls "Add to Home Screen" behaviour on Android/iOS
// and surfaces brand colors to the browser chrome. Referenced automatically
// by Next.js via app/manifest.ts (no explicit <link> needed in layout.tsx).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'OSCRSJ — Orthopedic Surgery Case Reports & Series Journal',
    short_name: 'OSCRSJ',
    description:
      'An independent, peer-reviewed, open-access orthopedic journal publishing case reports, case series, surgical techniques, and images in orthopedics for trainees worldwide.',
    start_url: '/',
    display: 'standalone',
    background_color: '#FDFBF8',
    theme_color: '#3d2a18',
    orientation: 'portrait',
    icons: [
      {
        src: '/favicon/favicon-mark-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/favicon/favicon-mark-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/favicon/favicon-mark-180.png',
        sizes: '180x180',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/favicon/favicon-mark.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any',
      },
    ],
    categories: ['medical', 'education', 'science'],
  }
}
