'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from '@/lib/auth/actions'

interface DashboardShellProps {
  userName: string
  userEmail: string
  userRole: string
  children: React.ReactNode
}

const NAV_ITEMS = [
  {
    label: 'My Submissions',
    href: '/dashboard',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
  {
    label: 'New Submission',
    href: '/dashboard/submit',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
      </svg>
    ),
  },
  {
    label: 'Profile Settings',
    href: '/dashboard/settings',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    ),
  },
]

export default function DashboardShell({ userName, userEmail, userRole, children }: DashboardShellProps) {
  const pathname = usePathname()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard'
    return pathname.startsWith(href)
  }

  return (
    <div className="min-h-screen bg-cream">
      {/* Dashboard header bar */}
      <div className="bg-white border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Left: Dashboard title + mobile menu toggle */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="lg:hidden p-2 text-brown-dark hover:bg-cream-alt rounded-lg"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={mobileMenuOpen ? 'M6 18L18 6M6 6l12 12' : 'M4 6h16M4 12h16M4 18h16'} />
                </svg>
              </button>
              <Link href="/dashboard" className="font-serif text-xl text-brown-dark">
                Author Dashboard
              </Link>
            </div>

            {/* Right: User info + sign out */}
            <div className="flex items-center gap-4">
              <div className="hidden sm:block text-right">
                <p className="text-sm font-medium text-brown-dark">{userName}</p>
                <p className="text-xs text-brown">{userRole.charAt(0).toUpperCase() + userRole.slice(1)}</p>
              </div>
              <div className="w-9 h-9 bg-peach-dark rounded-full flex items-center justify-center text-brown font-semibold text-sm">
                {userName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
              </div>
              <form action={signOut}>
                <button
                  type="submit"
                  className="text-sm text-brown hover:text-brown-dark transition-colors"
                >
                  Sign Out
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex gap-6">
          {/* Sidebar - desktop */}
          <aside className="hidden lg:block w-60 flex-shrink-0">
            <nav className="space-y-1">
              {NAV_ITEMS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive(item.href)
                      ? 'bg-peach-dark/20 text-brown-dark'
                      : 'text-tan hover:bg-cream-alt hover:text-brown-dark'
                  }`}
                >
                  {item.icon}
                  {item.label}
                </Link>
              ))}
            </nav>

            <div className="mt-8 border-t border-border pt-4">
              <Link
                href="/"
                className="flex items-center gap-3 px-4 py-2.5 text-sm text-brown hover:text-brown-dark transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Back to OSCRSJ
              </Link>
            </div>
          </aside>

          {/* Mobile sidebar */}
          {mobileMenuOpen && (
            <div className="lg:hidden fixed inset-0 z-50 bg-black/20" onClick={() => setMobileMenuOpen(false)}>
              <div className="bg-white w-64 h-full p-4 shadow-lg" onClick={(e) => e.stopPropagation()}>
                <div className="mb-4 pb-4 border-b border-border">
                  <p className="text-sm font-medium text-brown-dark">{userName}</p>
                  <p className="text-xs text-brown">{userEmail}</p>
                </div>
                <nav className="space-y-1">
                  {NAV_ITEMS.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                        isActive(item.href)
                          ? 'bg-peach-dark/20 text-brown-dark'
                          : 'text-tan hover:bg-cream-alt hover:text-brown-dark'
                      }`}
                    >
                      {item.icon}
                      {item.label}
                    </Link>
                  ))}
                </nav>
                <div className="mt-6 border-t border-border pt-4">
                  <Link
                    href="/"
                    className="flex items-center gap-3 px-4 py-2.5 text-sm text-brown hover:text-brown-dark"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                    </svg>
                    Back to OSCRSJ
                  </Link>
                </div>
              </div>
            </div>
          )}

          {/* Main content */}
          <main className="flex-1 min-w-0">
            {children}
          </main>
        </div>
      </div>
    </div>
  )
}
