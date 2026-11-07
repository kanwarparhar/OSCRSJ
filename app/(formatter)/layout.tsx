import type { Metadata } from 'next'
import './formatter.css'
import './fonts.css'
import IntroTransition from './_components/IntroTransition'

// The exact production font files are vendored locally so builds do not
// depend on Google Fonts returning extension-bearing URLs.

export const metadata: Metadata = {
  title: {
    template: '%s | Submission Studio',
    default: 'Submission Studio by OSCRSJ',
  },
}

export default function FormatterLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <link rel="preload" href="/fonts/studio/103fc5fac08dcb15-s.p.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
      <link rel="preload" href="/fonts/studio/558ca1a6aa3cb55e-s.p.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
      <link rel="preload" href="/fonts/studio/e4af272ccee01ff0-s.p.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
      <link rel="preload" href="/fonts/studio/fa3e259cafa8f47e-s.p.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
      <div className="fmt-root fmt-fonts flex-1">
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
    </>
  )
}
