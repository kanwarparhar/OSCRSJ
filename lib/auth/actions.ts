'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { UserRow } from '@/lib/types/database'

// ---- Turnstile verification ----
async function verifyTurnstile(token: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY
  if (!secret) return true // Skip verification if not configured

  try {
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ secret, response: token }),
    })
    const data = await response.json()
    return data.success === true
  } catch {
    return false
  }
}

// ---- Password validation ----
export async function validatePassword(password: string): Promise<string | null> {
  if (password.length < 8) return 'Password must be at least 8 characters'
  if (!/[A-Z]/.test(password)) return 'Password must contain at least one uppercase letter'
  if (!/[0-9]/.test(password)) return 'Password must contain at least one number'
  if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) return 'Password must contain at least one special character'
  return null
}

// ---- Registration ----
export async function signUp(formData: FormData) {
  const supabase = await createClient()

  const email = (formData.get('email') as string)?.trim().toLowerCase()
  const password = formData.get('password') as string
  const confirmPassword = formData.get('confirmPassword') as string
  const fullName = (formData.get('fullName') as string)?.trim()
  const affiliation = (formData.get('affiliation') as string)?.trim()
  const country = formData.get('country') as string
  const degrees = (formData.get('degrees') as string)?.trim() || null
  const orcidId = (formData.get('orcidId') as string)?.trim() || null
  const turnstileToken = formData.get('turnstileToken') as string

  // Turnstile verification — only enforce when both keys are configured
  const turnstileConfigured = process.env.TURNSTILE_SECRET_KEY && process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
  if (turnstileToken) {
    const valid = await verifyTurnstile(turnstileToken)
    if (!valid) {
      return { error: 'CAPTCHA verification failed. Please try again.' }
    }
  } else if (turnstileConfigured) {
    return { error: 'Please complete the CAPTCHA verification.' }
  }

  // Validation
  if (!email || !password || !fullName || !affiliation || !country) {
    return { error: 'Please fill in all required fields.' }
  }

  if (password !== confirmPassword) {
    return { error: 'Passwords do not match.' }
  }

  const passwordError = await validatePassword(password)
  if (passwordError) {
    return { error: passwordError }
  }

  // ORCID format validation (if provided)
  if (orcidId && !/^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/.test(orcidId)) {
    return { error: 'ORCID iD must be in the format 0000-0000-0000-0000.' }
  }

  // Sign up with Supabase Auth
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`,
      data: {
        full_name: fullName,
        affiliation,
        country,
        degrees,
        orcid_id: orcidId,
      },
    },
  })

  if (error) {
    if (error.message.includes('already registered')) {
      return { error: 'An account with this email already exists. Please log in instead.' }
    }
    return { error: error.message }
  }

  // Create the user profile in our users table using admin client
  if (data.user) {
    const admin = createAdminClient()

    const { error: profileError } = await (admin
      .from('users') as any)
      .insert({
        id: data.user.id,
        email,
        full_name: fullName,
        affiliation,
        country,
        degrees,
        orcid_id: orcidId,
        role: 'author',
      })

    if (profileError && !profileError.message.includes('duplicate')) {
      console.error('Failed to create user profile:', profileError)
      // Non-fatal: auth user exists, profile can be created later
    }
  }

  return { success: true, emailSent: true }
}

// ---- Login ----
export async function signIn(formData: FormData) {
  const supabase = await createClient()

  const email = (formData.get('email') as string)?.trim().toLowerCase()
  const password = formData.get('password') as string
  const redirectTo = (formData.get('redirect') as string) || '/dashboard'

  if (!email || !password) {
    return { error: 'Please enter your email and password.' }
  }

  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    if (error.message.includes('Invalid login')) {
      return { error: 'Invalid email or password. Please try again.' }
    }
    if (error.message.includes('Email not confirmed')) {
      return { error: 'Please confirm your email address before logging in. Check your inbox for the verification link.' }
    }
    return { error: error.message }
  }

  redirect(redirectTo)
}

// ---- Logout ----
export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}

// ---- Forgot password ----
export async function resetPasswordRequest(formData: FormData) {
  const supabase = await createClient()

  const email = (formData.get('email') as string)?.trim().toLowerCase()

  if (!email) {
    return { error: 'Please enter your email address.' }
  }

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/reset-password`,
  })

  if (error) {
    return { error: error.message }
  }

  // Always return success to prevent email enumeration
  return { success: true }
}

// ---- Reset password (with token) ----
export async function resetPassword(formData: FormData) {
  const supabase = await createClient()

  const password = formData.get('password') as string
  const confirmPassword = formData.get('confirmPassword') as string

  if (!password || !confirmPassword) {
    return { error: 'Please enter your new password.' }
  }

  if (password !== confirmPassword) {
    return { error: 'Passwords do not match.' }
  }

  const passwordError = await validatePassword(password)
  if (passwordError) {
    return { error: passwordError }
  }

  const { error } = await supabase.auth.updateUser({ password })

  if (error) {
    return { error: error.message }
  }

  return { success: true }
}

// ---- Update profile ----
export async function updateProfile(formData: FormData) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'You must be logged in to update your profile.' }
  }

  const fullName = (formData.get('fullName') as string)?.trim()
  const affiliation = (formData.get('affiliation') as string)?.trim()
  const country = formData.get('country') as string
  const degrees = (formData.get('degrees') as string)?.trim() || null
  const orcidId = (formData.get('orcidId') as string)?.trim() || null

  if (!fullName || !affiliation || !country) {
    return { error: 'Name, affiliation, and country are required.' }
  }

  if (orcidId && !/^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/.test(orcidId)) {
    return { error: 'ORCID iD must be in the format 0000-0000-0000-0000.' }
  }

  const { error } = await (supabase
    .from('users') as any)
    .update({
      full_name: fullName,
      affiliation,
      country,
      degrees,
      orcid_id: orcidId,
    })
    .eq('id', user.id)

  if (error) {
    return { error: 'Failed to update profile. Please try again.' }
  }

  // Also update the auth user metadata so it stays in sync
  await supabase.auth.updateUser({
    data: {
      full_name: fullName,
      affiliation,
      country,
      degrees,
      orcid_id: orcidId,
    },
  })

  return { success: true }
}

// ---- Get current user profile ----
export async function getUserProfile() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .single()

  return data as UserRow | null
}
