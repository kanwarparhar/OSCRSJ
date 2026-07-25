import type { Metadata } from 'next'
import { DM_Serif_Display, Inter, Inter_Tight, JetBrains_Mono } from 'next/font/google'
import './formatter.css'
import IntroTransition from './_components/IntroTransition'

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
// The OSCRSJ masthead face. Scoped to the Studio wordmark so the journal signs
// the product without disturbing the Studio's own type language.
const dmSerif = DM_Serif_Display({
  subsets: ['latin'],
  weight: ['400'],
  variable: '--fmt-font-brand',
  display: 'swap',
})

export const metadata: Metadata = {
  title: {
    template: '%s | Submission Studio',
    default: 'Submission Studio by OSCRSJ',
  },
}

export default function FormatterLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={`fmt-root flex-1 ${interBody.variable} ${interTight.variable} ${jetBrainsMono.variable} ${dmSerif.variable}`}
    >
      {/* Scroll reveals are JS-driven, so without JS every .reveal would stay at
          opacity 0 and the Studio would render as chrome around empty space.
          The content is server-rendered and crawlable; this makes it visible
          too. Franklin, 2026-07-25. */}
      <noscript>
        <style
          dangerouslySetInnerHTML={{
            __html: '.fmt-root .reveal{opacity:1 !important;transform:none !important}',
          }}
        />
      </noscript>
      <IntroTransition />
      {children}
    </div>
  )
}
