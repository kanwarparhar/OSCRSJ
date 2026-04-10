import Link from 'next/link'

export default function Footer() {
  return (
    <footer className="bg-charcoal text-white mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
          {/* Brand */}
          <div className="md:col-span-1">
            <h2 className="font-serif text-lg font-semibold text-white mb-3 leading-snug">
              Orthopedic Surgery Case Reports &amp; Series Journal
            </h2>
            <p className="text-sm text-white/60 leading-relaxed">
              An independent, peer-reviewed, open-access journal advancing orthopedic education and research for trainees worldwide.
            </p>
            <p className="mt-4 text-xs text-white/40 font-medium tracking-widest uppercase">
              OSCRSJ · Est. 2026
            </p>
          </div>

          {/* Articles */}
          <div>
            <h3 className="text-xs font-semibold text-white/50 uppercase tracking-widest mb-4">Articles</h3>
            <ul className="space-y-2.5">
              {[
                { label: 'Current Issue', href: '/articles/current-issue' },
                { label: 'Past Issues', href: '/articles/past-issues' },
                { label: 'Articles in Press', href: '/articles/in-press' },
                { label: 'Most Read', href: '/articles/most-read' },
                { label: 'Browse by Topic', href: '/topics' },
              ].map((l) => (
                <li key={l.label}>
                  <Link href={l.href} className="text-sm text-white/60 hover:text-coral transition-colors">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Authors */}
          <div>
            <h3 className="text-xs font-semibold text-white/50 uppercase tracking-widest mb-4">For Authors</h3>
            <ul className="space-y-2.5">
              {[
                { label: 'Submit a Manuscript', href: '/submit' },
                { label: 'Guide for Authors', href: '/guide-for-authors' },
                { label: 'APC & Fees', href: '/apc' },
                { label: 'Peer Review Policy', href: '/peer-review' },
                { label: 'Editorial Policies', href: '/editorial-policies' },
              ].map((l) => (
                <li key={l.label}>
                  <Link href={l.href} className="text-sm text-white/60 hover:text-coral transition-colors">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* About */}
          <div>
            <h3 className="text-xs font-semibold text-white/50 uppercase tracking-widest mb-4">About</h3>
            <ul className="space-y-2.5">
              {[
                { label: 'About OSCRSJ', href: '/about' },
                { label: 'Aims & Scope', href: '/aims-scope' },
                { label: 'Editorial Board', href: '/editorial-board' },
                { label: 'Indexing & Metrics', href: '/indexing' },
                { label: 'Contact Us', href: '/contact' },
              ].map((l) => (
                <li key={l.label}>
                  <Link href={l.href} className="text-sm text-white/60 hover:text-coral transition-colors">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-white/40">
            © {new Date().getFullYear()} OSCRSJ — Orthopedic Surgery Case Reports &amp; Series Journal. All rights reserved.
          </p>
          <div className="flex items-center gap-5">
            <Link href="/privacy" className="text-xs text-white/40 hover:text-white/70 transition-colors">Privacy Policy</Link>
            <Link href="/terms" className="text-xs text-white/40 hover:text-white/70 transition-colors">Terms of Use</Link>
            <Link href="/sitemap" className="text-xs text-white/40 hover:text-white/70 transition-colors">Sitemap</Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
