'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'

/**
 * Shared Submission Studio chrome (Session 95).
 *
 * The Studio was one long /format page until Session 95 split it into four routes.
 * Nav + footer live here so all four stay identical and the active tab is derived
 * from the pathname rather than hand-passed by each page. Client component solely
 * for `usePathname`; it renders on the server too, so the nav is in the initial
 * HTML and stays crawlable.
 *
 * Wordmark uses the journal's masthead face (--brand / DM Serif Display) per the
 * 2026-07-15 rebrand — the Studio's only piece of OSCRSJ type.
 */

const TABS = [
  { href: '/studio/format', label: 'Format a manuscript' },
  { href: '/studio/find', label: 'Find a journal' },
  { href: '/studio/journals', label: 'Supported journals' },
]

export function StudioNav() {
  const pathname = usePathname()

  return (
    <nav className="fmt-nav">
      <div className="wrap">
        <span className="wordmark">
          <Link href="/studio" style={{ color: 'inherit' }}>
            Submission Studio
          </Link>
          <a className="by" href="https://www.oscrsj.com">
            by OSCRSJ
          </a>
        </span>
        <span className="links">
          {TABS.map((t) => (
            <Link
              key={t.href}
              href={t.href}
              aria-current={pathname === t.href ? 'page' : undefined}
              className={pathname === t.href ? 'on' : undefined}
            >
              {t.label}
            </Link>
          ))}
          <Link className="btn btn-primary" href="/studio/format">
            Format a manuscript
          </Link>
        </span>
      </div>
    </nav>
  )
}

export function StudioFooter() {
  return (
    <footer className="fmt-footer">
      <div className="wrap">
        <span>
          Submission Studio, free tools from the{' '}
          <a href="https://www.oscrsj.com">Orthopedic Surgery Case Reports &amp; Series Journal</a>
        </span>
        <span>
          <Link href="/studio/journals">Supported journals</Link> · <a href="/terms">Terms</a> ·{' '}
          <a href="/privacy">Privacy</a> · <a href="/contact">Contact</a>
        </span>
      </div>
    </footer>
  )
}
