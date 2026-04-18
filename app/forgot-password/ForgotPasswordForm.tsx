'use client'

import { useState } from 'react'
import Link from 'next/link'
import { resetPasswordRequest } from '@/lib/auth/actions'

export default function ForgotPasswordForm() {
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const formData = new FormData(e.currentTarget)
    const result = await resetPasswordRequest(formData)

    if (result.error) {
      setError(result.error)
      setLoading(false)
      return
    }

    setSent(true)
    setLoading(false)
  }

  if (sent) {
    return (
      <div className="bg-white border border-border rounded-xl p-8 text-center">
        <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>
        <h2 className="font-serif text-2xl text-brown-dark mb-3">Check Your Email</h2>
        <p className="text-ink leading-relaxed mb-6">
          If an account exists with that email address, we have sent a password reset link. The link will expire in 24 hours.
        </p>
        <Link href="/login" className="btn-primary-light">
          Back to Login
        </Link>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
          {error}
        </div>
      )}

      <div className="bg-white border border-border rounded-xl p-6">
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
            placeholder="you@institution.edu"
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
          {loading ? 'Sending...' : 'Send Reset Link'}
        </button>

        <Link href="/login" className="text-sm text-brown hover:underline">
          Back to Login
        </Link>
      </div>
    </form>
  )
}
