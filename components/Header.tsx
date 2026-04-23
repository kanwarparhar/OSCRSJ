'use client'

import Link from 'next/link'
import { useState } from 'react'

const navItems = [
  { label: 'Home', href: '/', dropdown: null },
  {
    label: 'Articles',
    href: '/articles',
    dropdown: [
      { label: 'All Articles', href: '/articles' },
      { label: 'Articles in Press', href: '/articles/in-press' },
      { label: 'Current Issue', href: '/articles/current-issue' },
      { label: 'Archives', href: '/articles/past-issues' },
    ],
  },
  {
    label: 'Publish',
    href: '/submit',
    dropdown: [
      { label: 'Submit Article', href: '/submit' },
      { label: 'Guide for Authors', href: '/guide-for-authors' },
      { label: 'Article Types', href: '/article-types' },
      { label: 'Templates', href: '/templates' },
      { label: 'For Reviewers', href: '/for-reviewers' },
      { label: 'Author FAQ', href: '/faq' },
      { label: 'APC Fees', href: '/apc' },
    ],
  },
  {
    label: 'News',
    href: '/news',
    dropdown: [
      { label: 'All News', href: '/news' },
      { label: 'AI in Orthopedics', href: '/news/ai-in-orthopedics' },
    ],
  },
  {
    label: 'About',
    href: '/about',
    dropdown: [
      { label: 'Editorial Board', href: '/editorial-board' },
      { label: 'Aims & Scope', href: '/aims-scope' },
      { label: 'Abstracting & Indexing', href: '/indexing' },
      { label: 'Review Process', href: '/peer-review' },
      { label: 'Subscribe', href: '/subscribe' },
    ],
  },
  { label: 'Contact', href: '/contact', dropdown: null },
]

export default function Header() {
  const [openDropdown, setOpenDropdown] = useState<string | null>(null)
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <header className="w-full sticky top-0 z-50" style={{ backgroundColor: 'var(--dark)' }}>
      <div className="max-w-content mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
        {/* Logo */}
        <Link href="/" aria-label="OSCRSJ — Home" className="flex items-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/wordmark-peach.svg"
            alt="OSCRSJ — Orthopedic Surgery Case Reports & Series Journal"
            width={210}
            height={28}
            className="h-7 w-auto"
          />
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1">
          {navItems.map((item) => (
            <div
              key={item.label}
              className="relative"
              onMouseEnter={() => item.dropdown && setOpenDropdown(item.label)}
              onMouseLeave={() => setOpenDropdown(null)}
            >
              <Link
                href={item.href}
                className="flex items-center gap-1 px-4 py-2 text-peach/80 hover:text-peach transition-colors duration-150"
                style={{ fontSize: '13.5px', letterSpacing: '0.01em' }}
              >
                {item.label}
                {item.dropdown && (
                  <svg className="w-3 h-3 mt-0.5 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                )}
              </Link>
              {item.dropdown && (
                <div
                  className={`absolute top-full left-0 min-w-[200px] rounded-lg shadow-xl z-50 py-2 transition-all duration-[180ms] ${
                    openDropdown === item.label ? 'opacity-100 visible translate-y-0' : 'opacity-0 invisible -translate-y-1'
                  }`}
                  style={{ backgroundColor: '#2a180c', border: '1px solid rgba(255,219,187,0.15)' }}
                >
                  {item.dropdown.map((sub) => (
                    <Link
                      key={sub.label}
                      href={sub.href}
                      className="block px-4 py-2.5 text-sm text-peach/70 hover:text-peach hover:bg-white/5 transition-colors"
                    >
                      {sub.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ))}

          {/* SUBMIT button */}
          <Link
            href="/submit"
            className="ml-4 bg-peach text-brown font-semibold uppercase text-xs px-5 py-2 hover:brightness-95 transition-all duration-200"
            style={{ borderRadius: '100px', letterSpacing: '0.08em' }}
          >
            Submit
          </Link>
        </nav>

        {/* Mobile hamburger */}
        <button
          className="md:hidden p-2 text-peach/80"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={mobileOpen}
          aria-controls="mobile-menu"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            {mobileOpen
              ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />}
          </svg>
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div id="mobile-menu" className="md:hidden" style={{ backgroundColor: '#2a180c', borderTop: '1px solid rgba(255,219,187,0.1)' }}>
          {navItems.map((item) => (
            <div key={item.label}>
              <Link
                href={item.href}
                className="block px-6 py-3 text-sm font-medium text-peach/80 hover:text-peach"
                style={{ borderBottom: '1px solid rgba(255,219,187,0.08)' }}
                onClick={() => setMobileOpen(false)}
              >
                {item.label}
              </Link>
              {item.dropdown && (
                <div style={{ backgroundColor: 'rgba(0,0,0,0.15)' }}>
                  {item.dropdown.map((sub) => (
                    <Link
                      key={sub.label}
                      href={sub.href}
                      className="block px-10 py-2.5 text-xs text-peach/60 hover:text-peach"
                      onClick={() => setMobileOpen(false)}
                    >
                      {sub.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ))}
          <div className="px-6 py-4">
            <Link
              href="/submit"
              className="block text-center bg-peach text-brown font-semibold uppercase text-xs px-5 py-2.5"
              style={{ borderRadius: '100px', letterSpacing: '0.08em' }}
              onClick={() => setMobileOpen(false)}
            >
              Submit
            </Link>
          </div>
        </div>
      )}
    </header>
  )
}
