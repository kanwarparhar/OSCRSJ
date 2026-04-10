import type { Metadata } from 'next'
import './globals.css'
import Header from '@/components/Header'
import Footer from '@/components/Footer'

export const metadata: Metadata = {
  title: {
    template: '%s | OSCRSJ',
    default: 'OSCRSJ — Orthopedic Surgery Case Reports & Series Journal',
  },
  description:
    'A peer-reviewed, open-access journal publishing orthopedic surgery case reports and case series. Serving medical students, residents, and fellows worldwide.',
  keywords: ['orthopedic surgery', 'case reports', 'open access', 'medical journal', 'orthopedics'],
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col bg-cream">
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  )
}
