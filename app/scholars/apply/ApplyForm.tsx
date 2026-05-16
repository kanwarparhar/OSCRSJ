'use client'

import { useState } from 'react'
import Link from 'next/link'
import { COUNTRIES } from '@/lib/constants'
import { submitCohortApplication } from '@/lib/scholars/actions'

type TrackValue = 'pre_med' | 'med_student' | 'img'
type TierValue =
  | 'pre_med_tier_1'
  | 'pre_med_tier_2'
  | 'med_student_tier_1'
  | 'med_student_tier_2'
  | 'img'

interface TrackOption {
  value: TrackValue
  label: string
  blurb: string
  tiers: Array<{
    value: TierValue
    label: string
    price: string
    summary: string
  }>
}

const TRACK_OPTIONS: TrackOption[] = [
  {
    value: 'pre_med',
    label: 'Pre-Med Scholar',
    blurb:
      'For pre-med students aiming at surgical-specialty competitiveness.',
    tiers: [
      {
        value: 'pre_med_tier_1',
        label: 'Tier 1 — 6-month program',
        price: '$499',
        summary:
          'Middle author on one database study supervised by a med student, abstract + manuscript writing, Zotero, monthly Q&A.',
      },
      {
        value: 'pre_med_tier_2',
        label: 'Tier 2 — 1-year program',
        price: '$999',
        summary:
          '2 projects (1 first-author or SR/MA co-author), conditional LOR on completion, mock interview, pre-med to residency roadmap.',
      },
    ],
  },
  {
    value: 'med_student',
    label: 'Med Student Scholar',
    blurb:
      'For medical students seeking structured research experience and ERAS-ready output.',
    tiers: [
      {
        value: 'med_student_tier_1',
        label: 'Tier 1 — 6-month program',
        price: '$499',
        summary:
          '2-3 research projects (1 first-author), abstract + manuscript writing, Zotero, monthly project meeting.',
      },
      {
        value: 'med_student_tier_2',
        label: 'Tier 2 — 1-year program',
        price: '$999',
        summary:
          '5-6 projects (2-3 first-author, mix of SR/MA + database studies), conference support, away rotation planning.',
      },
    ],
  },
  {
    value: 'img',
    label: 'IMG Scholar',
    blurb:
      'For international medical graduates seeking US research credentials and mentor connections.',
    tiers: [
      {
        value: 'img',
        label: '6-month program',
        price: '$299',
        summary:
          '2-3 first-author projects, abstract + manuscript writing, Zotero, mentorship from US-practicing orthopedic surgeons.',
      },
    ],
  },
]

interface ReferenceEntry {
  name: string
  email: string
  relationship: string
  institution: string
}

const EMPTY_REFERENCE: ReferenceEntry = {
  name: '',
  email: '',
  relationship: '',
  institution: '',
}

export default function ApplyForm() {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)

  // Identity
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [orcidId, setOrcidId] = useState('')
  const [countryOfResidence, setCountryOfResidence] = useState('')

  // School
  const [school, setSchool] = useState('')
  const [yearInSchool, setYearInSchool] = useState('')

  // Track + tier
  const [preferredTrack, setPreferredTrack] = useState<TrackValue | ''>('')
  const [preferredTier, setPreferredTier] = useState<TierValue | ''>('')

  // Essays
  const [personalStatement, setPersonalStatement] = useState('')
  const [researchExperience, setResearchExperience] = useState('')
  const [whyOscrsj, setWhyOscrsj] = useState('')

  // References + CV
  const [references, setReferences] = useState<ReferenceEntry[]>([
    { ...EMPTY_REFERENCE },
  ])
  const [cv, setCv] = useState<File | null>(null)

  // Disclosures
  const [aiDisclosureAck, setAiDisclosureAck] = useState(false)
  const [participantAgreementAck, setParticipantAgreementAck] = useState(false)

  const handleTrackChange = (track: TrackValue) => {
    setPreferredTrack(track)
    // Auto-select if the track has only one tier (IMG)
    const trackDef = TRACK_OPTIONS.find((t) => t.value === track)
    if (trackDef && trackDef.tiers.length === 1) {
      setPreferredTier(trackDef.tiers[0].value)
    } else {
      setPreferredTier('')
    }
  }

  const handleReferenceChange = (
    index: number,
    field: keyof ReferenceEntry,
    value: string
  ) => {
    setReferences((prev) => {
      const next = [...prev]
      next[index] = { ...next[index], [field]: value }
      return next
    })
  }

  const addReference = () => {
    if (references.length >= 3) return
    setReferences((prev) => [...prev, { ...EMPTY_REFERENCE }])
  }

  const removeReference = (index: number) => {
    if (references.length <= 1) return
    setReferences((prev) => prev.filter((_, i) => i !== index))
  }

  const handleCvChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null
    setCv(file)
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)

    if (!preferredTrack || !preferredTier) {
      setError('Please select a track and tier.')
      setSubmitting(false)
      return
    }

    const fd = new FormData()
    fd.set('firstName', firstName)
    fd.set('lastName', lastName)
    fd.set('email', email)
    fd.set('orcidId', orcidId)
    fd.set('countryOfResidence', countryOfResidence)
    fd.set('school', school)
    fd.set('yearInSchool', yearInSchool)
    fd.set('preferredTrack', preferredTrack)
    fd.set('preferredTier', preferredTier)
    fd.set('personalStatement', personalStatement)
    fd.set('researchExperience', researchExperience)
    fd.set('whyOscrsj', whyOscrsj)
    fd.set('referencesJson', JSON.stringify(references))
    fd.set('aiDisclosureAck', aiDisclosureAck ? 'true' : 'false')
    fd.set(
      'participantAgreementAck',
      participantAgreementAck ? 'true' : 'false'
    )
    if (cv) {
      fd.set('cv', cv)
    }

    const result = await submitCohortApplication(fd)
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
          Thank you for applying to OSCRSJ Research Scholars. We have sent a
          confirmation to your email and will respond within 2-3 weeks.
        </p>
        <Link href="/scholars" className="btn-primary-light">
          Back to program overview
        </Link>
      </div>
    )
  }

  const selectedTrack = TRACK_OPTIONS.find((t) => t.value === preferredTrack)

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
              Email *
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
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
              Optional but encouraged.{' '}
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
              htmlFor="countryOfResidence"
              className="block text-sm font-medium text-ink mb-1"
            >
              Country of permanent residence *
            </label>
            <select
              id="countryOfResidence"
              required
              value={countryOfResidence}
              onChange={(e) => setCountryOfResidence(e.target.value)}
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

      {/* School */}
      <div className="bg-white border border-border rounded-xl p-6">
        <h2 className="font-serif text-xl text-brown-dark mb-1">
          School &amp; Program
        </h2>
        <p className="text-sm text-brown mb-5">
          Where you currently study, and your current year.
        </p>

        <div className="space-y-4">
          <div>
            <label
              htmlFor="school"
              className="block text-sm font-medium text-ink mb-1"
            >
              School / institution *
            </label>
            <input
              id="school"
              type="text"
              required
              value={school}
              onChange={(e) => setSchool(e.target.value)}
              placeholder="e.g., Harvard Medical School, Aga Khan University"
              className="w-full border border-border rounded-lg px-4 py-2.5 text-sm text-ink bg-white placeholder:text-brown/70 focus:outline-none focus:ring-2 focus:ring-peach-dark/50 focus:border-peach-dark transition-colors"
            />
          </div>
          <div>
            <label
              htmlFor="yearInSchool"
              className="block text-sm font-medium text-ink mb-1"
            >
              Current year *
            </label>
            <input
              id="yearInSchool"
              type="text"
              required
              value={yearInSchool}
              onChange={(e) => setYearInSchool(e.target.value)}
              placeholder="e.g., MS2, Pre-med sophomore, Final-year MBBS, Recently graduated MD (IMG)"
              className="w-full border border-border rounded-lg px-4 py-2.5 text-sm text-ink bg-white placeholder:text-brown/70 focus:outline-none focus:ring-2 focus:ring-peach-dark/50 focus:border-peach-dark transition-colors"
            />
          </div>
        </div>
      </div>

      {/* Track + tier */}
      <div className="bg-white border border-border rounded-xl p-6">
        <h2 className="font-serif text-xl text-brown-dark mb-1">
          Track &amp; Tier
        </h2>
        <p className="text-sm text-brown mb-5">
          Pick the track that fits your career stage. You can change your
          selection in conversation with us after you apply.
        </p>

        <fieldset>
          <legend className="sr-only">Select a track</legend>
          <div className="space-y-3">
            {TRACK_OPTIONS.map((track) => {
              const selected = preferredTrack === track.value
              return (
                <label
                  key={track.value}
                  className={`block border rounded-lg p-4 cursor-pointer transition-colors ${
                    selected
                      ? 'bg-peach-dark/20 border-brown'
                      : 'border-border hover:bg-cream-alt'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="radio"
                      name="preferredTrack"
                      value={track.value}
                      checked={selected}
                      onChange={() => handleTrackChange(track.value)}
                      className="mt-1 accent-brown w-4 h-4"
                      required
                    />
                    <div className="flex-1">
                      <div className="font-serif text-base text-brown-dark">
                        {track.label}
                      </div>
                      <p className="text-sm text-ink mt-1 leading-relaxed">
                        {track.blurb}
                      </p>
                    </div>
                  </div>
                </label>
              )
            })}
          </div>
        </fieldset>

        {selectedTrack && selectedTrack.tiers.length > 1 && (
          <fieldset className="mt-6">
            <legend className="block text-sm font-medium text-ink mb-2">
              Tier *
            </legend>
            <div className="space-y-2">
              {selectedTrack.tiers.map((tier) => {
                const tierSelected = preferredTier === tier.value
                return (
                  <label
                    key={tier.value}
                    className={`block border rounded-lg p-3 cursor-pointer transition-colors ${
                      tierSelected
                        ? 'bg-peach-dark/20 border-brown'
                        : 'border-border hover:bg-cream-alt'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="radio"
                        name="preferredTier"
                        value={tier.value}
                        checked={tierSelected}
                        onChange={(e) =>
                          setPreferredTier(e.target.value as TierValue)
                        }
                        className="mt-1 accent-brown w-4 h-4"
                        required
                      />
                      <div className="flex-1">
                        <div className="flex flex-wrap items-baseline gap-x-2">
                          <span className="text-sm font-medium text-ink">
                            {tier.label}
                          </span>
                          <span className="text-sm font-semibold text-brown-dark">
                            {tier.price}
                          </span>
                        </div>
                        <p className="text-xs text-brown mt-1 leading-relaxed">
                          {tier.summary}
                        </p>
                      </div>
                    </div>
                  </label>
                )
              })}
            </div>
          </fieldset>
        )}

        {selectedTrack && selectedTrack.tiers.length === 1 && (
          <div className="mt-4 bg-cream-alt border border-border rounded-lg p-3">
            <div className="flex items-baseline gap-2">
              <span className="text-sm font-medium text-ink">
                {selectedTrack.tiers[0].label}
              </span>
              <span className="text-sm font-semibold text-brown-dark">
                {selectedTrack.tiers[0].price}
              </span>
            </div>
            <p className="text-xs text-brown mt-1">
              {selectedTrack.tiers[0].summary}
            </p>
          </div>
        )}
      </div>

      {/* Essays */}
      <div className="bg-white border border-border rounded-xl p-6">
        <h2 className="font-serif text-xl text-brown-dark mb-1">
          Tell us about yourself
        </h2>
        <p className="text-sm text-brown mb-5">
          Short responses are fine. Write the way you would speak.
        </p>

        <div className="space-y-5">
          <div>
            <label
              htmlFor="personalStatement"
              className="block text-sm font-medium text-ink mb-1"
            >
              Why do you want to join this program? *
            </label>
            <textarea
              id="personalStatement"
              required
              rows={5}
              value={personalStatement}
              onChange={(e) => setPersonalStatement(e.target.value)}
              placeholder="Your goals, what you're hoping to learn, and what success in the program looks like for you."
              className="w-full border border-border rounded-lg px-4 py-2.5 text-sm text-ink bg-white placeholder:text-brown/70 focus:outline-none focus:ring-2 focus:ring-peach-dark/50 focus:border-peach-dark transition-colors leading-relaxed"
            />
            <p className="text-xs text-brown mt-1">
              {personalStatement.length} / 5000 characters (min 100)
            </p>
          </div>

          <div>
            <label
              htmlFor="researchExperience"
              className="block text-sm font-medium text-ink mb-1"
            >
              Research experience to date *
            </label>
            <textarea
              id="researchExperience"
              required
              rows={4}
              value={researchExperience}
              onChange={(e) => setResearchExperience(e.target.value)}
              placeholder="Projects you've worked on, your role on each (first author, contributor, data entry), and current status (published, in review, ongoing). It's fine to say 'none yet'."
              className="w-full border border-border rounded-lg px-4 py-2.5 text-sm text-ink bg-white placeholder:text-brown/70 focus:outline-none focus:ring-2 focus:ring-peach-dark/50 focus:border-peach-dark transition-colors leading-relaxed"
            />
            <p className="text-xs text-brown mt-1">
              {researchExperience.length} / 5000 characters (min 50)
            </p>
          </div>

          <div>
            <label
              htmlFor="whyOscrsj"
              className="block text-sm font-medium text-ink mb-1"
            >
              Why OSCRSJ specifically? *
            </label>
            <textarea
              id="whyOscrsj"
              required
              rows={3}
              value={whyOscrsj}
              onChange={(e) => setWhyOscrsj(e.target.value)}
              placeholder="What drew you to OSCRSJ rather than a generic research-prep program."
              className="w-full border border-border rounded-lg px-4 py-2.5 text-sm text-ink bg-white placeholder:text-brown/70 focus:outline-none focus:ring-2 focus:ring-peach-dark/50 focus:border-peach-dark transition-colors leading-relaxed"
            />
            <p className="text-xs text-brown mt-1">
              {whyOscrsj.length} / 5000 characters (min 50)
            </p>
          </div>
        </div>
      </div>

      {/* CV upload */}
      <div className="bg-white border border-border rounded-xl p-6">
        <h2 className="font-serif text-xl text-brown-dark mb-1">CV</h2>
        <p className="text-sm text-brown mb-5">
          PDF or Word document, up to 10 MB. Optional but strongly encouraged.
        </p>
        <input
          id="cv"
          type="file"
          accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          onChange={handleCvChange}
          className="block w-full text-sm text-ink file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-peach-dark/20 file:text-brown-dark hover:file:bg-peach-dark/30 file:cursor-pointer"
        />
        {cv && (
          <p className="text-xs text-brown mt-2">
            Selected: {cv.name} ({(cv.size / 1024).toFixed(0)} KB)
          </p>
        )}
      </div>

      {/* References */}
      <div className="bg-white border border-border rounded-xl p-6">
        <h2 className="font-serif text-xl text-brown-dark mb-1">References</h2>
        <p className="text-sm text-brown mb-5">
          Up to three people we can reach out to. Optional but helpful.
        </p>

        <div className="space-y-5">
          {references.map((ref, index) => (
            <div
              key={index}
              className="border border-border rounded-lg p-4 bg-cream-alt"
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-brown-dark">
                  Reference {index + 1}
                </h3>
                {references.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeReference(index)}
                    className="text-xs text-brown hover:text-brown-dark hover:underline"
                  >
                    Remove
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  type="text"
                  placeholder="Name"
                  value={ref.name}
                  onChange={(e) =>
                    handleReferenceChange(index, 'name', e.target.value)
                  }
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm text-ink bg-white placeholder:text-brown/70 focus:outline-none focus:ring-2 focus:ring-peach-dark/50 focus:border-peach-dark transition-colors"
                />
                <input
                  type="email"
                  placeholder="Email"
                  value={ref.email}
                  onChange={(e) =>
                    handleReferenceChange(index, 'email', e.target.value)
                  }
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm text-ink bg-white placeholder:text-brown/70 focus:outline-none focus:ring-2 focus:ring-peach-dark/50 focus:border-peach-dark transition-colors"
                />
                <input
                  type="text"
                  placeholder="Relationship (e.g., mentor, professor)"
                  value={ref.relationship}
                  onChange={(e) =>
                    handleReferenceChange(
                      index,
                      'relationship',
                      e.target.value
                    )
                  }
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm text-ink bg-white placeholder:text-brown/70 focus:outline-none focus:ring-2 focus:ring-peach-dark/50 focus:border-peach-dark transition-colors"
                />
                <input
                  type="text"
                  placeholder="Institution"
                  value={ref.institution}
                  onChange={(e) =>
                    handleReferenceChange(
                      index,
                      'institution',
                      e.target.value
                    )
                  }
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm text-ink bg-white placeholder:text-brown/70 focus:outline-none focus:ring-2 focus:ring-peach-dark/50 focus:border-peach-dark transition-colors"
                />
              </div>
            </div>
          ))}
          {references.length < 3 && (
            <button
              type="button"
              onClick={addReference}
              className="text-sm text-brown hover:text-brown-dark hover:underline"
            >
              + Add another reference
            </button>
          )}
        </div>
      </div>

      {/* Disclosures */}
      <div className="bg-white border border-border rounded-xl p-6">
        <h2 className="font-serif text-xl text-brown-dark mb-1">
          Acknowledgments
        </h2>
        <p className="text-sm text-brown mb-5">
          Both required.
        </p>

        <div className="space-y-4">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              required
              checked={aiDisclosureAck}
              onChange={(e) => setAiDisclosureAck(e.target.checked)}
              className="mt-1 accent-brown w-4 h-4"
            />
            <span className="text-sm text-ink leading-relaxed">
              I have read and agree to OSCRSJ&apos;s AI-use policy: AI is a
              writing and statistics assistant, not a substitute for learning
              the material. I will not use AI to generate citations or to
              write the introduction / background sections of my manuscripts.
              I will disclose AI use in methods sections as required.
            </span>
          </label>

          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              required
              checked={participantAgreementAck}
              onChange={(e) =>
                setParticipantAgreementAck(e.target.checked)
              }
              className="mt-1 accent-brown w-4 h-4"
            />
            <span className="text-sm text-ink leading-relaxed">
              I understand that the program promises training, mentorship,
              and structured project opportunities — not a guarantee of
              publication. Publication of any work I submit to OSCRSJ is
              conditional on independent peer review through the journal&apos;s
              standard editorial pipeline. If I am accepted to the program, I
              will be asked to sign a formal participant agreement before
              starting.
            </span>
          </label>
        </div>
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
          We will respond within 2-3 weeks. If you do not hear from us, please
          email oscrsjournal@gmail.com.
        </p>
      </div>
    </form>
  )
}
