'use server'

/**
 * ORCID OAuth utilities for the Public API.
 *
 * Flow:
 * 1. User clicks "Sign in with ORCID" -> redirect to ORCID authorize URL
 * 2. User authorizes on ORCID -> redirected back to /auth/callback/orcid with auth code
 * 3. We exchange the code for an access token + ORCID iD
 * 4. We fetch the user's public profile from the ORCID API
 * 5. We create/link the Supabase account
 */

const ORCID_BASE = 'https://orcid.org'
const ORCID_API = 'https://pub.orcid.org/v3.0'

/**
 * Build the ORCID authorization URL.
 * The user is redirected here to authorize OSCRSJ to read their public profile.
 */
export function getOrcidAuthUrl(): string {
  const clientId = process.env.NEXT_PUBLIC_ORCID_CLIENT_ID
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback/orcid`

  const params = new URLSearchParams({
    client_id: clientId!,
    response_type: 'code',
    scope: '/authenticate',
    redirect_uri: redirectUri,
  })

  return `${ORCID_BASE}/oauth/authorize?${params.toString()}`
}

/**
 * Exchange an authorization code for an access token and ORCID iD.
 */
export async function exchangeOrcidCode(code: string): Promise<{
  accessToken: string
  orcidId: string
  name: string | null
} | null> {
  const clientId = process.env.NEXT_PUBLIC_ORCID_CLIENT_ID
  const clientSecret = process.env.ORCID_CLIENT_SECRET
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback/orcid`

  try {
    const response = await fetch(`${ORCID_BASE}/oauth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: new URLSearchParams({
        client_id: clientId!,
        client_secret: clientSecret!,
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
      }),
    })

    if (!response.ok) {
      console.error('ORCID token exchange failed:', response.status)
      return null
    }

    const data = await response.json()

    return {
      accessToken: data.access_token,
      orcidId: data.orcid,
      name: data.name || null,
    }
  } catch (error) {
    console.error('ORCID token exchange error:', error)
    return null
  }
}

/**
 * Fetch the user's public profile from the ORCID API.
 * Returns name, affiliation, and other public data.
 */
export async function fetchOrcidProfile(orcidId: string, accessToken: string): Promise<{
  firstName: string | null
  lastName: string | null
  fullName: string | null
  affiliation: string | null
  country: string | null
  degrees: string | null
}> {
  const defaults = {
    firstName: null,
    lastName: null,
    fullName: null,
    affiliation: null,
    country: null,
    degrees: null,
  }

  try {
    const response = await fetch(`${ORCID_API}/${orcidId}/person`, {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
    })

    if (!response.ok) return defaults

    const data = await response.json()

    // Extract name
    const nameData = data?.name
    const firstName = nameData?.['given-names']?.value || null
    const lastName = nameData?.['family-name']?.value || null
    const fullName = [firstName, lastName].filter(Boolean).join(' ') || null

    // Extract affiliation from employments or educations
    let affiliation: string | null = null
    const employments = data?.['activities-summary']?.employments?.['affiliation-group']
    if (employments?.length > 0) {
      const org = employments[0]?.summaries?.[0]?.['employment-summary']?.organization
      affiliation = org?.name || null
    }

    // Extract country from addresses
    let country: string | null = null
    const addresses = data?.addresses?.address
    if (addresses?.length > 0) {
      country = addresses[0]?.country?.value || null
    }

    return { firstName, lastName, fullName, affiliation, country, degrees: null }
  } catch (error) {
    console.error('ORCID profile fetch error:', error)
    return defaults
  }
}
