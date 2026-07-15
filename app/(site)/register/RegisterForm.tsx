'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { signUp } from '@/lib/auth/actions'
import { COUNTRIES } from '@/lib/constants'
// import Turnstile from '@/components/Turnstile' // Disabled until Cloudflare config is resolved

function getOrcidPrefill(): { orcid_id?: string; full_name?: string; affiliation?: string; country?: string } | null {
  if (typeof document === 'undefined') return null
  try {
    const cookie = document.cookie.split('; ').find(c => c.startsWith('orcid_prefill='))
    if (!cookie) return null
    const value = decodeURIComponent(cookie.split('=').slice(1).join('='))
    // Clear the cookie after reading
    document.cookie = 'orcid_prefill=; max-age=0; path=/'
    return JSON.parse(value)
  } catch { return null }
}

export default function RegisterForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const orcidConnected = searchParams.get('orcid') === 'connected'
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [emailSent, setEmailSent] = useState(false)
  const [turnstileToken] = useState('')  // Turnstile disabled for now
  const [orcidPrefill, setOrcidPrefill] = useState<ReturnType<typeof getOrcidPrefill>>(null)
  const [passwordHints, setPasswordHints] = useState({
    length: false,
    uppercase: false,
    number: false,
    special: false,
  })

  useEffect(() => {
    if (orcidConnected) {
      const data = getOrcidPrefill()
      if (data) setOrcidPrefill(data)
    }
  }, [orcidConnected])

  function handlePasswordChange(e: React.ChangeEvent<HTMLInputElement>) {
    const pw = e.target.value
    setPasswordHints({
      length: pw.length >= 8,
      uppercase: /[A-Z]/.test(pw),
      number: /[0-9]/.test(pw),
      special: /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(pw),
    })
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const formData = new FormData(e.currentTarget)
    formData.set('turnstileToken', turnstileToken)
    const result = await signUp(formData)

    if (result.error) {
      setError(result.error)
      setLoading(false)
      return
    }

    if (result.emailSent) {
      setEmailSent(true)
    }
    setLoading(false)
  }

  // Success state: email verification sent
  if (emailSent) {
    return (
      <div className="bg-white border border-border rounded-xl p-8 text-center">
        <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>
        <h2 className="font-serif text-2xl text-brown-dark mb-3">Check Your Email</h2>
        <p className="text-ink leading-relaxed mb-6">
          We have sent a verification link to your email address. Please click the link to confirm your account and start submitting manuscripts.
        </p>
        <p className="text-sm text-brown mb-6">
          Did not receive the email? Check your spam folder or try registering again.
        </p>
        <Link href="/login" className="btn-primary-light">
          Go to Login
        </Link>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* ORCID Quick Register */}
      {!orcidPrefill && (
        <div className="bg-white border border-border rounded-xl p-6 text-center">
          <p className="text-sm text-ink mb-3">Speed up registration by connecting your ORCID account:</p>
          <a
            href={`/api/auth/orcid`}
            className="inline-flex items-center gap-2 bg-[#A6CE39] text-white font-semibold px-5 py-2.5 rounded-full text-sm hover:brightness-95 transition-all"
          >
            <svg className="w-5 h-5" viewBox="0 0 256 256" fill="currentColor">
              <path d="M256 128c0 70.7-57.3 128-128 128S0 198.7 0 128 57.3 0 128 0s128 57.3 128 128z" fill="#A6CE39"/>
              <path d="M86.3 186.2H70.9V79.1h15.4v107.1zM78.6 53.8c-5.5 0-10 4.5-10 10s4.5 10 10 10 10-4.5 10-10-4.5-10-10-10z" fill="white"/>
              <path d="M108.9 79.1h41.6c39.6 0 57 28.3 57 53.6 0 27.5-21.5 53.6-56.8 53.6h-41.8V79.1zm15.4 93.3h24.5c34.9 0 42.9-26.5 42.9-39.7 0-21.5-13.7-39.7-43.7-39.7h-23.7v79.4z" fill="white"/>
            </svg>
            Register with ORCID
          </a>
          <p className="text-xs text-brown mt-2">Your name, affiliation, and ORCID iD will be auto-filled.</p>
        </div>
      )}

      {/* ORCID connected badge */}
      {orcidPrefill && (
        <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 flex items-center gap-3">
          <svg className="w-5 h-5 text-green-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <div className="text-sm">
            <span className="font-medium text-green-800">ORCID connected:</span>{' '}
            <span className="text-green-700">{orcidPrefill.orcid_id}</span>
            <span className="text-green-600 ml-1">Fields below have been pre-filled from your ORCID profile.</span>
          </div>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {/* Personal Information */}
      <div className="bg-white border border-border rounded-xl p-6">
        <h2 className="font-serif text-xl text-brown-dark mb-1">Personal Information</h2>
        <p className="text-sm text-brown mb-5">Fields marked with * are required.</p>

        <div className="space-y-4">
          <div>
            <label htmlFor="fullName" className="block text-sm font-medium text-ink mb-1">
              Full Name *
            </label>
            <input
              id="fullName"
              name="fullName"
              type="text"
              required
              autoComplete="name"
              defaultValue={orcidPrefill?.full_name || ''}
              placeholder="e.g., John A. Smith"
              className="w-full border border-border rounded-lg px-4 py-2.5 text-sm text-ink bg-white placeholder:text-brown/70 focus:outline-none focus:ring-2 focus:ring-peach-dark/50 focus:border-peach-dark transition-colors"
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-ink mb-1">
              Email Address *
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder="you@institution.edu"
              className="w-full border border-border rounded-lg px-4 py-2.5 text-sm text-ink bg-white placeholder:text-brown/70 focus:outline-none focus:ring-2 focus:ring-peach-dark/50 focus:border-peach-dark transition-colors"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="affiliation" className="block text-sm font-medium text-ink mb-1">
                Affiliation / Institution *
              </label>
              <input
                id="affiliation"
                name="affiliation"
                type="text"
                required
                defaultValue={orcidPrefill?.affiliation || ''}
                placeholder="e.g., Massachusetts General Hospital"
                className="w-full border border-border rounded-lg px-4 py-2.5 text-sm text-ink bg-white placeholder:text-brown/70 focus:outline-none focus:ring-2 focus:ring-peach-dark/50 focus:border-peach-dark transition-colors"
              />
            </div>

            <div>
              <label htmlFor="degrees" className="block text-sm font-medium text-ink mb-1">
                Degree(s)
              </label>
              <input
                id="degrees"
                name="degrees"
                type="text"
                placeholder="e.g., MD, PhD"
                className="w-full border border-border rounded-lg px-4 py-2.5 text-sm text-ink bg-white placeholder:text-brown/70 focus:outline-none focus:ring-2 focus:ring-peach-dark/50 focus:border-peach-dark transition-colors"
              />
            </div>
          </div>

          <div>
            <label htmlFor="country" className="block text-sm font-medium text-ink mb-1">
              Country *
            </label>
            <select
              id="country"
              name="country"
              required
              defaultValue={orcidPrefill?.country || ''}
              className="w-full border border-border rounded-lg px-4 py-2.5 text-sm text-ink bg-white focus:outline-none focus:ring-2 focus:ring-peach-dark/50 focus:border-peach-dark transition-colors"
            >
              <option value="">Select your country</option>
              {COUNTRIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="orcidId" className="block text-sm font-medium text-ink mb-1">
              ORCID iD
            </label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-brown flex-shrink-0">https://orcid.org/</span>
              <input
                id="orcidId"
                name="orcidId"
                type="text"
                defaultValue={orcidPrefill?.orcid_id || ''}
                readOnly={!!orcidPrefill?.orcid_id}
                placeholder="0000-0000-0000-0000"
                pattern="\d{4}-\d{4}-\d{4}-\d{3}[\dX]"
                className="flex-1 border border-border rounded-lg px-4 py-2.5 text-sm text-ink bg-white placeholder:text-brown/70 focus:outline-none focus:ring-2 focus:ring-peach-dark/50 focus:border-peach-dark transition-colors"
              />
            </div>
            <p className="text-xs text-brown mt-1">
              Optional but encouraged.{' '}
              <a href="https://orcid.org/register" target="_blank" rel="noopener noreferrer" className="text-brown hover:underline">
                Get an ORCID iD
              </a>
            </p>
          </div>
        </div>
      </div>

      {/* Password */}
      <div className="bg-white border border-border rounded-xl p-6">
        <h2 className="font-serif text-xl text-brown-dark mb-1">Set Your Password</h2>
        <p className="text-sm text-brown mb-5">Must be at least 8 characters with one uppercase letter, one number, and one special character.</p>

        <div className="space-y-4">
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-ink mb-1">
              Password *
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="new-password"
              onChange={handlePasswordChange}
              className="w-full border border-border rounded-lg px-4 py-2.5 text-sm text-ink bg-white placeholder:text-brown/70 focus:outline-none focus:ring-2 focus:ring-peach-dark/50 focus:border-peach-dark transition-colors"
            />
            <div className="mt-2 grid grid-cols-2 gap-1">
              {[
                { key: 'length', label: '8+ characters' },
                { key: 'uppercase', label: 'Uppercase letter' },
                { key: 'number', label: 'Number' },
                { key: 'special', label: 'Special character' },
              ].map(({ key, label }) => (
                <div key={key} className="flex items-center gap-1.5 text-xs">
                  <div className={`w-3.5 h-3.5 rounded-full flex items-center justify-center ${passwordHints[key as keyof typeof passwordHints] ? 'bg-green-100' : 'bg-cream-alt'}`}>
                    {passwordHints[key as keyof typeof passwordHints] ? (
                      <svg className="w-2.5 h-2.5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : null}
                  </div>
                  <span className={passwordHints[key as keyof typeof passwordHints] ? 'text-green-700' : 'text-brown'}>{label}</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-ink mb-1">
              Confirm Password *
            </label>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              required
              autoComplete="new-password"
              className="w-full border border-border rounded-lg px-4 py-2.5 text-sm text-ink bg-white placeholder:text-brown/70 focus:outline-none focus:ring-2 focus:ring-peach-dark/50 focus:border-peach-dark transition-colors"
            />
          </div>
        </div>
      </div>

      {/* Submit */}
      <div className="flex flex-col items-center gap-4">
        <button
          type="submit"
          disabled={loading}
          className="btn-primary-light w-full sm:w-auto justify-center min-w-[200px] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <>
              <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Creating Account...
            </>
          ) : (
            'Create Account'
          )}
        </button>

        <p className="text-sm text-brown">
          Already have an account?{' '}
          <Link href="/login" className="text-brown hover:underline font-medium">
            Log in
          </Link>
        </p>

        <p className="text-xs text-brown text-center max-w-md">
          By creating an account, you agree to our{' '}
          <Link href="/terms" className="text-brown hover:underline">Terms of Use</Link>{' '}
          and{' '}
          <Link href="/privacy" className="text-brown hover:underline">Privacy Policy</Link>.
        </p>
      </div>
    </form>
  )
}
