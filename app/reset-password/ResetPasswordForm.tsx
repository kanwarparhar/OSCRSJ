'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { resetPassword } from '@/lib/auth/actions'

export default function ResetPasswordForm() {
  const router = useRouter()
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const formData = new FormData(e.currentTarget)
    const result = await resetPassword(formData)

    if (result.error) {
      setError(result.error)
      setLoading(false)
      return
    }

    setSuccess(true)
    setLoading(false)

    // Redirect to dashboard after 2 seconds
    setTimeout(() => router.push('/dashboard'), 2000)
  }

  if (success) {
    return (
      <div className="bg-white border border-border rounded-xl p-8 text-center">
        <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="font-serif text-2xl text-brown-dark mb-3">Password Updated</h2>
        <p className="text-ink leading-relaxed">
          Your password has been reset successfully. Redirecting you to your dashboard...
        </p>
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

      <div className="bg-white border border-border rounded-xl p-6 space-y-4">
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-ink mb-1">
            New Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="new-password"
            className="w-full border border-border rounded-lg px-4 py-2.5 text-sm text-ink bg-white placeholder:text-tan/60 focus:outline-none focus:ring-2 focus:ring-peach-dark/50 focus:border-peach-dark transition-colors"
          />
          <p className="text-xs text-brown mt-1">At least 8 characters with one uppercase letter, one number, and one special character.</p>
        </div>

        <div>
          <label htmlFor="confirmPassword" className="block text-sm font-medium text-ink mb-1">
            Confirm New Password
          </label>
          <input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            required
            autoComplete="new-password"
            className="w-full border border-border rounded-lg px-4 py-2.5 text-sm text-ink bg-white placeholder:text-tan/60 focus:outline-none focus:ring-2 focus:ring-peach-dark/50 focus:border-peach-dark transition-colors"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="btn-primary-light w-full justify-center disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? 'Updating...' : 'Update Password'}
      </button>
    </form>
  )
}
