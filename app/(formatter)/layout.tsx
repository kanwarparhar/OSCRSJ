import type { Metadata } from 'next'
import { Inter, Inter_Tight, JetBrains_Mono } from 'next/font/google'
import './formatter.css'

// Self-hosted (via next/font) so the standalone formatter world makes no external
// font request and scopes its type to this route group only. First use of next/font
// in the repo — deliberate; the OSCRSJ site keeps its globals.css @import fonts.
const interBody = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--fmt-font-body',
  display: 'swap',
})
const interTight = Inter_Tight({
  subsets: ['latin'],
  weight: ['600', '700'],
  variable: '--fmt-font-display',
  display: 'swap',
})
const jetBrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--fmt-font-mono',
  display: 'swap',
})

export const metadata: Metadata = {
  title: {
    template: '%s | Journal Formatter',
    default: 'Journal Formatter — by OSCRSJ',
  },
}

export default function FormatterLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={`fmt-root flex-1 ${interBody.variable} ${interTight.variable} ${jetBrainsMono.variable}`}
    >
      {children}
    </div>
  )
}
