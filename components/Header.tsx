'use client'

import Link from 'next/link'
import { useState } from 'react'
import Logo from './Logo'

const navItems = [
  {
    label: 'Articles',
    href: '/articles',
    dropdown: [
      { label: 'Current Issue', href: '/articles/current-issue' },
      { label: 'Past Issues', href: '/articles/past-issues' },
      { label: 'Articles in Press', href: '/articles/in-press' },
      { label: 'Most Read', href: '/articles/most-read' },
      { label: 'Most Cited', href: '/articles/most-cited' },
    ],
  },
  {
    label: 'Submit',
    href: '/submit',
    dropdown: [
      { label: 'Submit a Manuscript', href: '/submit' },
      { label: 'Guide for Authors', href: '/guide-for-authors' },
      { label: 'APC & Fees', href: '/apc' },
      { label: 'Peer Review Policy', href: '/peer-review' },
      { label: 'Editorial Policies', href: '/editorial-policies' },
    ],
  },
  {
    label: 'Topics',
    href: '/topics',
    dropdown: [
      { label: 'Trauma & Fractures', href: '/topics/trauma' },
      { label: 'Sports Medicine', href: '/topics/sports' },
      { label: 'Spine', href: '/topics/spine' },
      { label: 'Arthroplasty', href: '/topics/arthroplasty' },
      { label: 'Pediatric Orthopedics', href: '/topics/pediatrics' },
      { label: 'Hand & Wrist', href: '/topics/hand' },
      { label: 'Foot & Ankle', href: '/topics/foot-ankle' },
      { label: 'Tumor & Oncology', href: '/topics/tumor' },
    ],
  },
  {
    label: 'About',
    href: '/about',
    dropdown: [
      { label: 'About the Journal', href: '/about' },
      { label: 'Aims & Scope', href: '/aims-scope' },
      { label: 'Editorial Board', href: '/editorial-board' },
      { label: 'Indexing & Metrics', href: '/indexing' },
      { label: 'Open Access Policy', href: '/open-access' },
    ],
  },
  { label: 'Contact', href: '/contact', dropdown: null },
  { label: 'Subscribe', href: '/subscribe', dropdown: null },
]

export default function Header() {
  const [openDropdown, setOpenDropdown] = useState<string | null>(null)
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <header className="w-full border-b border-border bg-cream sticky top-0 z-50">
      {/* Top bar */}
      <div className="border-b border-border/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-10">
          <span className="text-xs text-charcoal-muted">
            Peer-reviewed · Open Access · US-based
          </span>
          <div className="flex items-center gap-4 text-sm">
            <Link href="/submit" className="text-charcoal-muted hover:text-coral transition-colors font-medium text-xs">
              Submit
            </Link>
            <span className="text-border">|</span>
            <Link href="/login" className="text-charcoal-muted hover:text-coral transition-colors font-medium text-xs">
              Log in
            </Link>
            <span className="text-border">|</span>
            <Link href="/register" className="text-charcoal-muted hover:text-coral transition-colors font-medium text-xs">
              Register
            </Link>
          </div>
        </div>
      </div>

      {/* Brand */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center py-5 gap-1.5">
          <Logo size="md" showTagline={false} />
          <p className="text-xs text-charcoal-muted tracking-wide font-medium">
            Orthopedic Surgery Case Reports &amp; Series Journal
          </p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="border-t border-border/60 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
          {/* Desktop nav */}
          <div className="hidden md:flex items-center">
            {navItems.map((item) => (
              <div
                key={item.label}
                className="relative"
                onMouseEnter={() => item.dropdown && setOpenDropdown(item.label)}
                onMouseLeave={() => setOpenDropdown(null)}
              >
                <Link
                  href={item.href}
                  className="flex items-center gap-1 px-4 py-3.5 text-sm font-medium text-charcoal-muted hover:text-charcoal border-b-2 border-transparent hover:border-coral transition-all duration-150"
                >
                  {item.label}
                  {item.dropdown && (
                    <svg className="w-3 h-3 mt-0.5 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  )}
                </Link>
                {item.dropdown && openDropdown === item.label && (
                  <div className="absolute top-full left-0 min-w-[220px] bg-white border border-border rounded-b-xl shadow-lg z-50 py-1">
                    {item.dropdown.map((sub) => (
                      <Link
                        key={sub.label}
                        href={sub.href}
                        className="block px-4 py-2.5 text-sm text-charcoal-muted hover:text-charcoal hover:bg-sand transition-colors"
                      >
                        {sub.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Search */}
          <div className="hidden md:flex items-center gap-2 py-2">
            <div className="relative">
              <input
                type="text"
                placeholder="Search articles…"
                className="w-56 text-sm pl-9 pr-4 py-2 bg-sand border border-border rounded-lg focus:outline-none focus:border-coral focus:ring-1 focus:ring-coral/30 placeholder:text-charcoal-light transition"
              />
              <svg className="absolute left-3 top-2.5 w-4 h-4 text-charcoal-light" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>

          {/* Mobile hamburger */}
          <button
            className="md:hidden p-2 text-charcoal-muted"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              {mobileOpen
                ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />}
            </svg>
          </button>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="md:hidden border-t border-border bg-white">
            {navItems.map((item) => (
              <div key={item.label}>
                <Link
                  href={item.href}
                  className="block px-6 py-3 text-sm font-medium text-charcoal-muted hover:text-charcoal hover:bg-sand border-b border-border/40"
                  onClick={() => setMobileOpen(false)}
                >
                  {item.label}
                </Link>
                {item.dropdown && (
                  <div className="bg-sand/50">
                    {item.dropdown.map((sub) => (
                      <Link
                        key={sub.label}
                        href={sub.href}
                        className="block px-10 py-2.5 text-xs text-charcoal-muted hover:text-charcoal"
                        onClick={() => setMobileOpen(false)}
                      >
                        {sub.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </nav>
    </header>
  )
}
