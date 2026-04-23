'use client'

import { useState } from 'react'
import Link from 'next/link'
import { COUNTRIES, SUBSPECIALTIES } from '@/lib/constants'
import { submitReviewerApplication } from '@/lib/reviewer/actions'

const CAREER_STAGE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'med_student', label: 'Medical Student' },
  { value: 'resident', label: 'Resident' },
  { value: 'fellow', label: 'Fellow' },
  { value: 'attending', label: 'Attending' },
  { value: 'other', label: 'Other' },
]

export default function ApplyForm() {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [orcidId, setOrcidId] = useState('')
  const [affiliation, setAffiliation] = useState('')
  const [country, setCountry] = useState('')
  const [careerStage, setCareerStage] = useState('')
  const [subspecialties, setSubspecialties] = useState<string[]>([])
  const [writingSampleUrl, setWritingSampleUrl] = useState('')
  const [heardAbout, setHeardAbout] = useState('')
  const [consent, setConsent] = useState(false)

  const toggleSubspecialty = (slug: string) => {
    setSubspecialties((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]
    )
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)

    const stage = careerStage as
      | 'med_student'
      | 'resident'
      | 'fellow'
      | 'attending'
      | 'other'

    const result = await submitReviewerApplication({
      firstName,
      lastName,
      email,
      orcidId: orcidId.trim() || null,
      affiliation,
      country,
      careerStage: stage,
      subspecialtyInterests: subspecialties,
      writingSampleUrl: writingSampleUrl.trim() || null,
      heardAbout: heardAbout.trim() || null,
      consentAccepted: consent,
    })

    if (result.error) {
      setError(result.error)
      setSubmitting(false)
      return
    }

    setSubmitted(true)
    setSubmitting(false)
  }

  if (submitted) {
    return (
      <div className="bg-white border border-border rounded-xl p-8 text-center">
        <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg
            className="w-8 h-8 text-green-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>
        <h2 className="font-serif text-2xl text-brown-dark mb-3">
          Application received
        </h2>
        <p className="text-ink leading-relaxed mb-6">
          Thank you for your interest in reviewing for OSCRSJ. We have sent a
          confirmation to your email and a member of the editorial office will
          respond within 14 days.
        </p>
        <Link href="/for-reviewers" className="btn-primary-light">
          Back to Reviewer Guidelines
        </Link>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {/* Personal information */}
      <div className="bg-white border border-border rounded-xl p-6">
        <h2 className="font-serif text-xl text-brown-dark mb-1">
          Personal Information
        </h2>
        <p className="text-sm text-brown mb-5">
          Fields marked with * are required.
        </p>

        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="firstName"
                className="block text-sm font-medium text-ink mb-1"
              >
                First Name *
              </label>
              <input
                id="firstName"
                type="text"
                required
                autoComplete="given-name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full border border-border rounded-lg px-4 py-2.5 text-sm text-ink bg-white placeholder:text-brown/70 focus:outline-none focus:ring-2 focus:ring-peach-dark/50 focus:border-peach-dark transition-colors"
              />
            </div>
            <div>
              <label
                htmlFor="lastName"
                className="block text-sm font-medium text-ink mb-1"
              >
                Last Name *
              </label>
              <input
                id="lastName"
                type="text"
                required
                autoComplete="family-name"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="w-full border border-border rounded-lg px-4 py-2.5 text-sm text-ink bg-white placeholder:text-brown/70 focus:outline-none focus:ring-2 focus:ring-peach-dark/50 focus:border-peach-dark transition-colors"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-ink mb-1"
            >
              Professional Email *
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@institution.edu"
              className="w-full border border-border rounded-lg px-4 py-2.5 text-sm text-ink bg-white placeholder:text-brown/70 focus:outline-none focus:ring-2 focus:ring-peach-dark/50 focus:border-peach-dark transition-colors"
            />
          </div>

          <div>
            <label
              htmlFor="orcidId"
              className="block text-sm font-medium text-ink mb-1"
            >
              ORCID iD
            </label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-brown flex-shrink-0">
                https://orcid.org/
              </span>
              <input
                id="orcidId"
                type="text"
                value={orcidId}
                onChange={(e) => setOrcidId(e.target.value)}
                placeholder="0000-0000-0000-0000"
                pattern="\d{4}-\d{4}-\d{4}-\d{3}[\dX]"
                className="flex-1 border border-border rounded-lg px-4 py-2.5 text-sm text-ink bg-white placeholder:text-brown/70 focus:outline-none focus:ring-2 focus:ring-peach-dark/50 focus:border-peach-dark transition-colors"
              />
            </div>
            <p className="text-xs text-brown mt-1">
              Optional but strongly encouraged.{' '}
              <a
                href="https://orcid.org/register"
                target="_blank"
                rel="noopener noreferrer"
                className="text-brown hover:underline"
              >
                Get an ORCID iD
              </a>
            </p>
          </div>

          <div>
            <label
              htmlFor="affiliation"
              className="block text-sm font-medium text-ink mb-1"
            >
              Institutional Affiliation *
            </label>
            <input
              id="affiliation"
              type="text"
              required
              value={affiliation}
              onChange={(e) => setAffiliation(e.target.value)}
              placeholder="e.g., Massachusetts General Hospital"
              className="w-full border border-border rounded-lg px-4 py-2.5 text-sm text-ink bg-white placeholder:text-brown/70 focus:outline-none focus:ring-2 focus:ring-peach-dark/50 focus:border-peach-dark transition-colors"
            />
          </div>

          <div>
            <label
              htmlFor="country"
              className="block text-sm font-medium text-ink mb-1"
            >
              Country *
            </label>
            <select
              id="country"
              required
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              className="w-full border border-border rounded-lg px-4 py-2.5 text-sm text-ink bg-white focus:outline-none focus:ring-2 focus:ring-peach-dark/50 focus:border-peach-dark transition-colors"
            >
              <option value="">Select your country</option>
              {COUNTRIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Career + expertise */}
      <div className="bg-white border border-border rounded-xl p-6">
        <h2 className="font-serif text-xl text-brown-dark mb-1">
          Career &amp; Expertise
        </h2>
        <p className="text-sm text-brown mb-5">
          We match reviewers to manuscripts using these fields.
        </p>

        <div className="space-y-5">
          <fieldset>
            <legend className="block text-sm font-medium text-ink mb-2">
              Career Stage *
            </legend>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {CAREER_STAGE_OPTIONS.map((opt) => (
                <label
                  key={opt.value}
                  className={`flex items-center justify-center gap-2 px-3 py-2 border rounded-lg text-sm cursor-pointer transition-colors ${
                    careerStage === opt.value
                      ? 'bg-peach-dark/30 border-brown text-ink'
                      : 'border-border text-ink hover:bg-cream'
                  }`}
                >
                  <input
                    type="radio"
                    name="careerStage"
                    value={opt.value}
                    checked={careerStage === opt.value}
                    onChange={(e) => setCareerStage(e.target.value)}
                    className="sr-only"
                    required
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="block text-sm font-medium text-ink mb-2">
              Subspecialty Interests *
            </legend>
            <p className="text-xs text-brown mb-2">
              Select at least one. You may pick multiple.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {SUBSPECIALTIES.map((sub) => {
                const checked = subspecialties.includes(sub.slug)
                return (
                  <label
                    key={sub.slug}
                    className={`flex items-start gap-2 px-3 py-2 border rounded-lg text-sm cursor-pointer transition-colors ${
                      checked
                        ? 'bg-peach-dark/30 border-brown text-ink'
                        : 'border-border text-ink hover:bg-cream'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleSubspecialty(sub.slug)}
                      className="mt-0.5 accent-brown w-4 h-4"
                    />
                    <span>{sub.name}</span>
                  </label>
                )
              })}
            </div>
          </fieldset>

          <div>
            <label
              htmlFor="writingSampleUrl"
              className="block text-sm font-medium text-ink mb-1"
            >
              Sample review or writing sample URL
            </label>
            <input
              id="writingSampleUrl"
              type="url"
              value={writingSampleUrl}
              onChange={(e) => setWritingSampleUrl(e.target.value)}
              placeholder="https://…"
              className="w-full border border-border rounded-lg px-4 py-2.5 text-sm text-ink bg-white placeholder:text-brown/70 focus:outline-none focus:ring-2 focus:ring-peach-dark/50 focus:border-peach-dark transition-colors"
            />
            <p className="text-xs text-brown mt-1">
              Optional. Link to a published review, blog post, PubPeer comment,
              or other writing that demonstrates your scholarly voice.
            </p>
          </div>

          <div>
            <label
              htmlFor="heardAbout"
              className="block text-sm font-medium text-ink mb-1"
            >
              How did you hear about OSCRSJ?
            </label>
            <input
              id="heardAbout"
              type="text"
              value={heardAbout}
              onChange={(e) => setHeardAbout(e.target.value)}
              placeholder="Optional — colleague, conference, LinkedIn, etc."
              className="w-full border border-border rounded-lg px-4 py-2.5 text-sm text-ink bg-white placeholder:text-brown/70 focus:outline-none focus:ring-2 focus:ring-peach-dark/50 focus:border-peach-dark transition-colors"
            />
          </div>
        </div>
      </div>

      {/* Consent */}
      <div className="bg-white border border-border rounded-xl p-6">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            required
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            className="mt-1 accent-brown w-4 h-4"
          />
          <span className="text-sm text-ink leading-relaxed">
            I consent to OSCRSJ contacting me about reviewer opportunities and
            storing the information I have provided as described in the{' '}
            <Link
              href="/privacy/outreach"
              className="text-brown hover:underline"
            >
              outreach privacy notice
            </Link>
            . I understand I can withdraw at any time by replying to any
            message from the editorial office.
          </span>
        </label>
      </div>

      <div className="flex flex-col items-center gap-4">
        <button
          type="submit"
          disabled={submitting}
          className="btn-primary-light w-full sm:w-auto justify-center min-w-[200px] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? 'Submitting…' : 'Submit Application'}
        </button>
        <p className="text-xs text-brown text-center max-w-md">
          We will respond within 14 days. If you do not hear from us, please
          reply directly to editorial@oscrsj.com.
        </p>
      </div>
    </form>
  )
}
