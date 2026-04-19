import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Page Not Found',
  robots: { index: false, follow: false },
}

export default function NotFound() {
  return (
    <div className="bg-white">
      <section
        className="flex items-center justify-center text-center"
        style={{
          background: 'radial-gradient(ellipse at 50% 40%, var(--brown) 0%, var(--dark) 70%)',
          minHeight: '520px',
          padding: '96px 24px',
        }}
      >
        <div className="max-w-content mx-auto">
          <div className="flex justify-center mb-8">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/brand/seal-dark.svg"
              alt="OSCRSJ journal seal"
              width={160}
              height={160}
              className="w-[140px] h-[140px] md:w-[160px] md:h-[160px]"
              style={{ opacity: 0.9 }}
            />
          </div>
          <p
            className="text-peach-dark mb-4"
            style={{
              fontSize: '13px',
              letterSpacing: '0.4em',
              fontWeight: 600,
              textTransform: 'uppercase',
            }}
          >
            404 · Page Not Found
          </p>
          <h1
            className="font-serif text-peach leading-none mb-5"
            style={{ fontSize: 'clamp(48px, 8vw, 96px)', letterSpacing: '-0.04em' }}
          >
            Lost in the Stacks
          </h1>
          <p className="text-peach/70 text-base max-w-xl mx-auto mb-10 leading-relaxed">
            The page you&rsquo;re looking for has been withdrawn, moved, or never existed. The journal, however, is still open.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/" className="btn-primary">
              Back to Home
            </Link>
            <Link href="/articles" className="btn-ghost">
              Browse Articles
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </Link>
          </div>
        </div>
      </section>

      <section className="max-w-content mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <span className="section-label">Looking for something specific?</span>
        <h2 className="section-heading mb-6">Popular Destinations</h2>
        <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
          {[
            { label: 'Submit a Manuscript', href: '/submit' },
            { label: 'Guide for Authors', href: '/guide-for-authors' },
            { label: 'Current Issue', href: '/articles/current-issue' },
            { label: 'Editorial Board', href: '/editorial-board' },
            { label: 'Peer Review Process', href: '/peer-review' },
            { label: 'Contact', href: '/contact' },
          ].map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="block bg-white border border-border rounded-xl px-5 py-4 hover:border-tan hover:shadow-sm transition-all text-ink font-medium"
            >
              {l.label}
              <span className="float-right text-brown">→</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  )
}
