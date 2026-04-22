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
        src: '/icon',
        sizes: '64x64',
        type: 'image/png',
      },
      {
        src: '/apple-icon',
        sizes: '180x180',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/brand/seal-cream.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any',
      },
      {
        src: '/brand/seal-dark.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'maskable',
      },
    ],
    categories: ['medical', 'education', 'science'],
  }
}
