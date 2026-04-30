import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import DashboardShell from './DashboardShell'
import type { UserRow } from '@/lib/types/database'

// Dashboard noindex defense-in-depth (per John's 2026-04-24 canonical sweep).
// Every /dashboard/* route — including /dashboard/admin/* via transitive
// layout inheritance — picks this up automatically. Cleaner than per-route
// edits across the 11+ dashboard page files. The middleware already
// redirects unauth visitors to /login, so Googlebot rarely lands here, but
// this layer makes the intent explicit and survives any future routing
// changes that might briefly expose a dashboard URL.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?redirect=/dashboard')
  }

  // Fetch user profile
  const { data } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .single()

  const profile = data as UserRow | null

  const userName = profile?.full_name || user.user_metadata?.full_name || user.email || 'Author'
  const userEmail = user.email || ''
  const userRole = profile?.role || 'author'

  return (
    <DashboardShell
      userName={userName}
      userEmail={userEmail}
      userRole={userRole}
    >
      {children}
    </DashboardShell>
  )
}
