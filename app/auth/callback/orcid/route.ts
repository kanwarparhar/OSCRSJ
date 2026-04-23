import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { exchangeOrcidCode, fetchOrcidProfile } from '@/lib/auth/orcid'
import { cookies } from 'next/headers'

/**
 * ORCID OAuth callback handler.
 *
 * Flow:
 * 1. User returns from ORCID with ?code=xxx
 * 2. Exchange code for access token + ORCID iD
 * 3. Fetch public profile from ORCID
 * 4. Check if a Supabase user with this ORCID exists
 * 5a. If exists: sign them in
 * 5b. If not: store ORCID data in a cookie and redirect to /register with prefilled fields
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const error = searchParams.get('error')

  // User denied access
  if (error) {
    return NextResponse.redirect(`${origin}/login?error=orcid_denied`)
  }

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=orcid_no_code`)
  }

  // Exchange code for token + ORCID iD
  const tokenResult = await exchangeOrcidCode(code)
  if (!tokenResult) {
    return NextResponse.redirect(`${origin}/login?error=orcid_exchange_failed`)
  }

  const { accessToken, orcidId } = tokenResult

  // Fetch public profile
  const profile = await fetchOrcidProfile(orcidId, accessToken)

  // Check if user with this ORCID already exists in our users table
  const admin = createAdminClient()
  const { data: existingUser } = await (admin
    .from('users') as any)
    .select('id, email')
    .eq('orcid_id', orcidId)
    .single()

  if (existingUser?.email) {
    // User exists. We can't directly sign them in without a password
    // via the Public API. Redirect to login with ORCID pre-filled.
    return NextResponse.redirect(
      `${origin}/login?orcid_verified=true&email=${encodeURIComponent(existingUser.email)}`
    )
  }

  // New user: store profile data in a cookie and redirect to register
  // The register form will read this and prefill the fields
  const orcidData = {
    orcid_id: orcidId,
    full_name: profile.fullName || '',
    affiliation: profile.affiliation || '',
    country: profile.country || '',
  }

  const cookieStore = cookies()
  cookieStore.set('orcid_prefill', JSON.stringify(orcidData), {
    httpOnly: false, // Client-side form needs to read this
    secure: true,
    sameSite: 'lax',
    maxAge: 600, // 10 minutes, just for the registration flow
    path: '/',
  })

  return NextResponse.redirect(`${origin}/register?orcid=connected`)
}
