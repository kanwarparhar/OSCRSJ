import Link from 'next/link'
import { SOCIAL_CHANNELS } from '@/lib/social'
import SocialIcon from '@/components/SocialIcon'

export default function Footer() {
  return (
    <footer style={{ backgroundColor: 'var(--dark)' }}>
      <div className="max-w-content mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
          {/* About */}
          <div>
            <Link href="/" aria-label="OSCRSJ — Home" className="inline-block mb-5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/brand/wordmark-peach.svg"
                alt="OSCRSJ — Orthopedic Surgery Case Reports & Series Journal"
                width={240}
                height={32}
                className="h-8 w-auto"
              />
            </Link>
            <p className="text-sm text-peach/50 leading-relaxed">
              An independent, peer-reviewed, open-access journal advancing orthopedic education and research for the global orthopedic surgery community.
            </p>
            <p className="mt-4 text-xs text-peach/30 font-medium tracking-widest uppercase">
              Est. 2026
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-xs font-medium text-peach/60 uppercase tracking-widest mb-4" style={{ letterSpacing: '0.12em' }}>
              Quick Links
            </h3>
            <ul className="space-y-2.5">
              {[
                { label: 'Current Issue', href: '/articles/current-issue' },
                { label: 'Submit a Manuscript', href: '/submit' },
                { label: 'Guide for Authors', href: '/guide-for-authors' },
                { label: 'Editorial Board', href: '/editorial-board' },
                { label: 'Aims & Scope', href: '/aims-scope' },
                { label: 'Contact', href: '/contact' },
                { label: 'Follow Us', href: '/media' },
              ].map((l) => (
                <li key={l.label}>
                  <Link href={l.href} className="text-sm text-peach/50 hover:text-peach transition-colors">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h3 className="text-xs font-medium text-peach/60 uppercase tracking-widest mb-4" style={{ letterSpacing: '0.12em' }}>
              Legal
            </h3>
            <ul className="space-y-2.5">
              {[
                { label: 'Privacy Policy', href: '/privacy' },
                { label: 'Terms of Use', href: '/terms' },
                { label: 'Open Access Policy', href: '/open-access' },
                { label: 'Editorial Policies', href: '/editorial-policies' },
                { label: 'APC & Fees', href: '/apc' },
              ].map((l) => (
                <li key={l.label}>
                  <Link href={l.href} className="text-sm text-peach/50 hover:text-peach transition-colors">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Social links */}
        <div className="mt-14 flex justify-center gap-3" aria-label="Follow OSCRSJ on social media">
          {SOCIAL_CHANNELS.map(({ name, url, ariaLabel }) => (
            <a
              key={name}
              href={url}
              target="_blank"
              rel="me noopener noreferrer"
              aria-label={ariaLabel}
              className="w-10 h-10 rounded-full flex items-center justify-center text-peach/60 hover:text-peach hover:border-peach/40 transition-colors"
              style={{ border: '1px solid rgba(255,219,187,0.18)' }}
            >
              <SocialIcon name={name} className="w-4 h-4" />
            </a>
          ))}
        </div>

        {/* Copyright bar */}
        <div className="mt-8 pt-8" style={{ borderTop: '1px solid rgba(255,219,187,0.1)' }}>
          <p className="text-xs text-peach/30 text-center">
            &copy; {new Date().getFullYear()} OSCRSJ &mdash; Orthopedic Surgery Case Reports &amp; Series Journal. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  )
}
