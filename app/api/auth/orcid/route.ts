import { NextResponse } from 'next/server'
import { getOrcidAuthUrl } from '@/lib/auth/orcid'

/**
 * Redirects the user to ORCID's OAuth authorization page.
 * GET /api/auth/orcid
 */
export async function GET() {
  const url = await getOrcidAuthUrl()
  return NextResponse.redirect(url)
}
