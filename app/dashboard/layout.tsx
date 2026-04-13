import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import DashboardShell from './DashboardShell'
import type { UserRow } from '@/lib/types/database'

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
