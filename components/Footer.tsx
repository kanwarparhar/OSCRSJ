import Link from 'next/link'

export default function Footer() {
  return (
    <footer style={{ backgroundColor: 'var(--dark)' }}>
      <div className="max-w-content mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
          {/* About */}
          <div>
            <h2 className="font-serif text-lg text-peach mb-4">OSCRSJ</h2>
            <p className="text-sm text-peach/50 leading-relaxed">
              An independent, peer-reviewed, open-access journal advancing orthopedic education and research for trainees worldwide.
            </p>
            <p className="mt-4 text-xs text-peach/30 font-medium tracking-widest uppercase">
              Est. 2026
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-xs font-medium text-tan uppercase tracking-widest mb-4" style={{ letterSpacing: '0.12em' }}>
              Quick Links
            </h3>
            <ul className="space-y-2.5">
              {[
                { label: 'Current Issue', href: '/articles/current-issue' },
                { label: 'Submit a Manuscript', href: '/submit' },
                { label: 'Guide for Authors', href: '/guide-for-authors' },
                { label: 'Editorial Board', href: '/editorial-board' },
                { label: 'About', href: '/about' },
                { label: 'Contact', href: '/contact' },
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
            <h3 className="text-xs font-medium text-tan uppercase tracking-widest mb-4" style={{ letterSpacing: '0.12em' }}>
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

        {/* Copyright bar */}
        <div className="mt-14 pt-8" style={{ borderTop: '1px solid rgba(255,219,187,0.1)' }}>
          <p className="text-xs text-peach/30 text-center">
            &copy; {new Date().getFullYear()} OSCRSJ &mdash; Orthopedic Surgery Case Reports &amp; Series Journal. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  )
}
