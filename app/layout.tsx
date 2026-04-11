import type { Metadata } from 'next'
import './globals.css'
import Header from '@/components/Header'
import Footer from '@/components/Footer'

export const metadata: Metadata = {
  metadataBase: new URL('https://oscrsj.com'),
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
    url: 'https://oscrsj.com',
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
    google: 'REPLACE_WITH_VERIFICATION_CODE',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'OSCRSJ — Orthopedic Surgery Case Reports & Series Journal',
    url: 'https://oscrsj.com',
    description:
      'A peer-reviewed, open-access journal publishing orthopedic surgery case reports and case series.',
    publisher: {
      '@type': 'Organization',
      name: 'OSCRSJ',
      url: 'https://oscrsj.com',
    },
  }

  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col bg-cream">
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
