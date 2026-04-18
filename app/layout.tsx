import type { Metadata } from 'next'
import Script from 'next/script'
import './globals.css'
import Header from '@/components/Header'
import Footer from '@/components/Footer'

export const metadata: Metadata = {
  metadataBase: new URL('https://www.oscrsj.com'),
  title: {
    template: '%s | OSCRSJ',
    default: 'OSCRSJ — Orthopedic Surgery Case Reports & Series Journal',
  },
  description:
    'A peer-reviewed, open-access journal publishing orthopedic surgery case reports and case series. Serving medical students, residents, and fellows worldwide.',
  keywords: ['orthopedic surgery', 'case reports', 'open access', 'medical journal', 'orthopedics'],
  openGraph: {
    title: 'OSCRSJ — Orthopedic Surgery Case Reports & Series Journal',
    description:
      'A peer-reviewed, open-access journal publishing orthopedic surgery case reports and case series. Serving medical students, residents, and fellows worldwide.',
    url: 'https://www.oscrsj.com',
    siteName: 'OSCRSJ',
    type: 'website',
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'OSCRSJ — Orthopedic Surgery Case Reports & Series Journal',
    description:
      'A peer-reviewed, open-access journal publishing orthopedic surgery case reports and case series. Serving medical students, residents, and fellows worldwide.',
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
          'A peer-reviewed, open-access journal publishing orthopedic surgery case reports and case series.',
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
          'Independent, peer-reviewed, open-access journal publishing orthopedic surgery case reports and case series. Serves medical students, residents, and fellows worldwide.',
        // sameAs: [] — populate as social accounts launch (Arjun handoff)
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
      </body>
    </html>
  )
}
