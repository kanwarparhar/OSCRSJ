import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import type { UserRow } from '@/lib/types/database'
import ProfileForm from './ProfileForm'

export const metadata: Metadata = { title: 'Profile Settings — OSCRSJ' }

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Fetch profile
  const { data } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .single()

  const profile = data as UserRow | null

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-serif text-2xl text-brown-dark">Profile Settings</h1>
        <p className="text-sm text-brown mt-1">
          Update your personal information. This data is used when you submit manuscripts.
        </p>
      </div>

      <ProfileForm
        initialData={{
          email: user.email || '',
          fullName: profile?.full_name || user.user_metadata?.full_name || '',
          affiliation: profile?.affiliation || user.user_metadata?.affiliation || '',
          country: profile?.country || user.user_metadata?.country || '',
          degrees: profile?.degrees || user.user_metadata?.degrees || '',
          orcidId: profile?.orcid_id || user.user_metadata?.orcid_id || '',
        }}
      />
    </div>
  )
}
