import type { Metadata } from 'next'
import Script from 'next/script'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import { SOCIAL_CHANNELS } from '@/lib/social'

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
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        '@id': 'https://www.oscrsj.com/#website',
        name: 'OSCRSJ — Orthopedic Surgery Case Reports & Series Journal',
        url: 'https://www.oscrsj.com',
        description:
          'A peer-reviewed, open-access journal publishing orthopedic case reports, case series, systematic reviews and meta-analyses, surgical techniques, images in orthopedics, and letters to the editor.',
        publisher: { '@id': 'https://www.oscrsj.com/#organization' },
        inLanguage: 'en-US',
      },
      {
        '@type': 'Organization',
        '@id': 'https://www.oscrsj.com/#organization',
        name: 'OSCRSJ — Orthopedic Surgery Case Reports & Series Journal',
        alternateName: 'OSCRSJ',
        url: 'https://www.oscrsj.com',
        logo: {
          '@type': 'ImageObject',
          url: 'https://www.oscrsj.com/logo.svg',
        },
        foundingDate: '2026',
        description:
          'Independent, peer-reviewed, open-access orthopedic journal publishing case reports, case series, systematic reviews and meta-analyses, surgical techniques, images in orthopedics, and letters to the editor for the global orthopedic surgery community.',
        // sameAs: Knowledge Graph entity disambiguation — when Google sees these URLs in
        // Organization JSON-LD, it links the OSCRSJ entity to the social profiles, strengthening
        // the brand SERP panel and AI-citation surface presence (ChatGPT, Claude, Perplexity, etc.).
        // URLs are sourced from lib/social.ts so footer + contact + press-kit + JSON-LD never drift.
        sameAs: SOCIAL_CHANNELS.map((c) => c.url),
      },
      {
        '@type': 'Periodical',
        '@id': 'https://www.oscrsj.com/#periodical',
        name: 'Orthopedic Surgery Case Reports and Series Journal',
        alternateName: 'OSCRSJ',
        url: 'https://www.oscrsj.com',
        publisher: { '@id': 'https://www.oscrsj.com/#organization' },
        inLanguage: 'en-US',
        // issn: '' — populate once Janine lands ISSN (Gate 1, post-5-articles)
      },
    ],
  }

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
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
        <Analytics />
      </body>
    </html>
  )
}
