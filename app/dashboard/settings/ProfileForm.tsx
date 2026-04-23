'use client'

import { useState } from 'react'
import { updateProfile } from '@/lib/auth/actions'
import { COUNTRIES } from '@/lib/constants'

interface ProfileFormProps {
  initialData: {
    email: string
    fullName: string
    affiliation: string
    country: string
    degrees: string
    orcidId: string
  }
}

export default function ProfileForm({ initialData }: ProfileFormProps) {
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    setSuccess(false)
    setLoading(true)

    const formData = new FormData(e.currentTarget)
    const result = await updateProfile(formData)

    if (result.error) {
      setError(result.error)
    } else {
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    }
    setLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
          {error}
        </div>
      )}
      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 rounded-lg px-4 py-3 text-sm">
          Profile updated successfully.
        </div>
      )}

      <div className="bg-white border border-border rounded-xl p-6 space-y-4">
        {/* Email (read-only) */}
        <div>
          <label className="block text-sm font-medium text-ink mb-1">Email Address</label>
          <input
            type="email"
            value={initialData.email}
            disabled
            className="w-full border border-border rounded-lg px-4 py-2.5 text-sm text-brown bg-cream/50 cursor-not-allowed"
          />
          <p className="text-xs text-brown mt-1">Email cannot be changed. Contact support if you need to update it.</p>
        </div>

        <div>
          <label htmlFor="fullName" className="block text-sm font-medium text-ink mb-1">
            Full Name *
          </label>
          <input
            id="fullName"
            name="fullName"
            type="text"
            required
            defaultValue={initialData.fullName}
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
              defaultValue={initialData.affiliation}
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
              defaultValue={initialData.degrees}
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
            defaultValue={initialData.country}
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
              defaultValue={initialData.orcidId}
              placeholder="0000-0000-0000-0000"
              pattern="\d{4}-\d{4}-\d{4}-\d{3}[\dX]"
              className="flex-1 border border-border rounded-lg px-4 py-2.5 text-sm text-ink bg-white placeholder:text-brown/70 focus:outline-none focus:ring-2 focus:ring-peach-dark/50 focus:border-peach-dark transition-colors"
            />
          </div>
          <p className="text-xs text-brown mt-1">
            Optional but encouraged for indexing and discoverability.{' '}
            <a href="https://orcid.org/register" target="_blank" rel="noopener noreferrer" className="text-brown hover:underline">
              Get an ORCID iD
            </a>
          </p>
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="btn-primary-light disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? 'Saving...' : 'Save Changes'}
      </button>

      <div className="bg-white border border-border rounded-xl p-6 mt-8">
        <h2 className="font-serif text-lg text-brown-dark mb-2">
          Your data (GDPR)
        </h2>
        <p className="text-sm text-brown mb-4 max-w-prose">
          Download a JSON file of every record OSCRSJ stores for your
          account — profile, manuscripts, co-author entries, metadata,
          file listings, payments, and any reviewer application. File
          contents from storage are not embedded; contact{' '}
          <a
            href="mailto:editorial@oscrsj.com"
            className="underline underline-offset-2"
          >
            editorial@oscrsj.com
          </a>{' '}
          if you need raw file exports.
        </p>
        <a
          href="/api/dashboard/export"
          className="inline-flex items-center gap-2 text-sm px-4 py-2 border border-border rounded-lg text-ink bg-white hover:border-tan transition-colors"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5m0 0l5-5m-5 5V4"
            />
          </svg>
          Export my data
        </a>
      </div>
    </form>
  )
}
