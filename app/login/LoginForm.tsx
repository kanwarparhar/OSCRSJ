'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { signIn } from '@/lib/auth/actions'

export default function LoginForm() {
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirect') || '/dashboard'
  const callbackError = searchParams.get('error')

  const orcidError = callbackError === 'orcid_denied'
    ? 'ORCID authorization was cancelled.'
    : callbackError === 'orcid_exchange_failed'
    ? 'Failed to connect to ORCID. Please try again.'
    : null

  const orcidVerified = searchParams.get('orcid_verified') === 'true'
  const orcidEmail = searchParams.get('email')

  const [error, setError] = useState(
    callbackError === 'auth_callback_failed'
      ? 'Email verification failed. Please try again or request a new verification link.'
      : orcidError || ''
  )
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const formData = new FormData(e.currentTarget)
    formData.set('redirect', redirectTo)

    const result = await signIn(formData)

    // signIn redirects on success, so we only reach here on error
    if (result?.error) {
      setError(result.error)
    }
    setLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {/* ORCID verified message */}
      {orcidVerified && orcidEmail && (
        <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm text-green-700">
          ORCID account verified. Please enter your password to sign in.
        </div>
      )}

      <div className="bg-white border border-border rounded-xl p-6 space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-ink mb-1">
            Email Address
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            defaultValue={orcidEmail || ''}
            placeholder="you@institution.edu"
            className="w-full border border-border rounded-lg px-4 py-2.5 text-sm text-ink bg-white placeholder:text-tan/60 focus:outline-none focus:ring-2 focus:ring-peach-dark/50 focus:border-peach-dark transition-colors"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label htmlFor="password" className="block text-sm font-medium text-ink">
              Password
            </label>
            <Link href="/forgot-password" className="text-xs text-brown hover:underline">
              Forgot password?
            </Link>
          </div>
          <input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
            className="w-full border border-border rounded-lg px-4 py-2.5 text-sm text-ink bg-white placeholder:text-tan/60 focus:outline-none focus:ring-2 focus:ring-peach-dark/50 focus:border-peach-dark transition-colors"
          />
        </div>
      </div>

      <div className="flex flex-col items-center gap-4">
        <button
          type="submit"
          disabled={loading}
          className="btn-primary-light w-full justify-center disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <>
              <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Signing In...
            </>
          ) : (
            'Sign In'
          )}
        </button>

        {/* Divider */}
        <div className="flex items-center gap-3 w-full">
          <div className="flex-1 h-px bg-border" />
          <span className="text-xs text-brown">or</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        {/* ORCID login */}
        <a
          href="/api/auth/orcid"
          className="inline-flex items-center justify-center gap-2 w-full bg-[#A6CE39] text-white font-semibold px-5 py-2.5 rounded-full text-sm hover:brightness-95 transition-all"
        >
          <svg className="w-5 h-5" viewBox="0 0 256 256" fill="currentColor">
            <path d="M256 128c0 70.7-57.3 128-128 128S0 198.7 0 128 57.3 0 128 0s128 57.3 128 128z" fill="#A6CE39"/>
            <path d="M86.3 186.2H70.9V79.1h15.4v107.1zM78.6 53.8c-5.5 0-10 4.5-10 10s4.5 10 10 10 10-4.5 10-10-4.5-10-10-10z" fill="white"/>
            <path d="M108.9 79.1h41.6c39.6 0 57 28.3 57 53.6 0 27.5-21.5 53.6-56.8 53.6h-41.8V79.1zm15.4 93.3h24.5c34.9 0 42.9-26.5 42.9-39.7 0-21.5-13.7-39.7-43.7-39.7h-23.7v79.4z" fill="white"/>
          </svg>
          Sign in with ORCID
        </a>

        <p className="text-sm text-brown">
          Don&apos;t have an account?{' '}
          <Link href="/register" className="text-brown hover:underline font-medium">
            Create one
          </Link>
        </p>
      </div>
    </form>
  )
}
