import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

// Server-side guard for every /dashboard/admin/* route. The outer
// /dashboard layout has already confirmed the user is authenticated;
// here we enforce the editor/admin role. Every admin server action
// also re-checks this so a direct POST cannot bypass the UI gate.
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?redirect=/dashboard/admin/reviewer-applications')
  }

  const { data } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  const role = (data as { role?: string } | null)?.role
  if (role !== 'editor' && role !== 'admin') {
    redirect('/dashboard')
  }

  return <>{children}</>
}
