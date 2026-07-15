import type { Metadata } from 'next'
import Script from 'next/script'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'

export const metadata: Metadata = {
  metadataBase: new URL('https://www.oscrsj.com'),
  title: {
    template: '%s | OSCRSJ',
    default: 'OSCRSJ — Orthopedic Surgery Case Reports & Series Journal',
  },
  description:
    'A peer-reviewed, open-access orthopedic journal publishing case reports, case series, systematic reviews and meta-analyses, surgical techniques, images in orthopedics, and letters to the editor for the global orthopedic surgery community.',
  keywords: ['orthopedic surgery', 'case reports', 'case series', 'systematic review', 'meta-analysis', 'open access', 'medical journal', 'orthopedics'],
  openGraph: {
    title: 'OSCRSJ — Orthopedic Surgery Case Reports & Series Journal',
    description:
      'A peer-reviewed, open-access orthopedic journal publishing case reports, case series, systematic reviews and meta-analyses, surgical techniques, images in orthopedics, and letters to the editor for the global orthopedic surgery community.',
    url: 'https://www.oscrsj.com',
    siteName: 'OSCRSJ',
    type: 'website',
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'OSCRSJ — Orthopedic Surgery Case Reports & Series Journal',
    description:
      'A peer-reviewed, open-access orthopedic journal publishing case reports, case series, systematic reviews and meta-analyses, surgical techniques, images in orthopedics, and letters to the editor for the global orthopedic surgery community.',
  },
  icons: {
    icon: '/favicon.png',
    apple: '/apple-icon',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
    },
  },
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_VERIFICATION ?? '',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // Site chrome (Header/Footer) and the journal-level JSON-LD @graph live in the
  // (site) route-group layout, so the (formatter) group can present a standalone
  // design world at /format with no OSCRSJ nav/footer. This root layout only owns
  // the html/body shell, global analytics, and the shared metadata template.
  return (
    <html lang="en">
      <head>
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-BTXMY8RWEW"
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-BTXMY8RWEW');
          `}
        </Script>
      </head>
      <body className="min-h-screen flex flex-col bg-white">
        {children}
        <Analytics />
      </body>
    </html>
  )
}
