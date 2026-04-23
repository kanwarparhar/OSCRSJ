import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'

/**
 * Auth callback handler.
 * Supabase redirects here after email verification, password reset,
 * magic link, and OAuth flows.
 *
 * Supports two confirmation flows:
 *   1. PKCE / OAuth — uses `?code=...` then exchangeCodeForSession()
 *   2. Email OTP (signup, magic link, recovery, email change) — uses
 *      `?token_hash=...&type=...` then verifyOtp()
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const next = searchParams.get('next') ?? '/dashboard'

  const code = searchParams.get('code')
  const tokenHash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null

  const supabase = await createClient()

  // Flow 1: PKCE / OAuth (Google, ORCID via Supabase, etc.)
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  // Flow 2: Email OTP (email confirmation, magic link, password recovery, email change)
  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    })
    if (!error) {
      // Password recovery lands on the reset-password page; everything else on dashboard.
      const destination = type === 'recovery' ? '/reset-password' : next
      return NextResponse.redirect(`${origin}${destination}`)
    }
  }

  // If verification fails, redirect to login with error
  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`)
}
