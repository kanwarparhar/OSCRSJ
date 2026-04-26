'use client'

import { FormEvent, useState } from 'react'

const CAREER_STAGES = [
  'Medical student',
  'Resident',
  'Fellow',
  'Attending / consultant',
  'Researcher',
  'Other',
]

export default function DiscountInquiryForm() {
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [country, setCountry] = useState('')
  const [careerStage, setCareerStage] = useState(CAREER_STAGES[0])
  const [affiliation, setAffiliation] = useState('')
  const [submissionId, setSubmissionId] = useState('')
  const [message, setMessage] = useState('')
  const [sent, setSent] = useState(false)

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const subject = `Discount inquiry — ${firstName} ${lastName}`.trim()
    const body = [
      `Name: ${firstName} ${lastName}`,
      `Email: ${email}`,
      `Country: ${country}`,
      `Career stage: ${careerStage}`,
      `Affiliation: ${affiliation || '—'}`,
      `Submission ID (if any): ${submissionId || '—'}`,
      '',
      'Reason for request:',
      message,
    ].join('\n')

    const mailto = `mailto:waivers@oscrsj.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
    window.location.href = mailto
    setSent(true)
  }

  return (
    <div className="bg-white border border-border rounded-2xl p-8">
      <form className="space-y-5" onSubmit={handleSubmit}>
        <div className="grid sm:grid-cols-2 gap-5">
          <div>
            <label className="block text-xs font-semibold text-brown mb-1.5">First Name</label>
            <input
              type="text"
              required
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="w-full text-sm px-4 py-2.5 bg-white border border-border rounded-lg focus:outline-none focus:border-peach focus:ring-1 focus:ring-peach/40"
              placeholder="First name"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-brown mb-1.5">Last Name</label>
            <input
              type="text"
              required
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="w-full text-sm px-4 py-2.5 bg-white border border-border rounded-lg focus:outline-none focus:border-peach focus:ring-1 focus:ring-peach/40"
              placeholder="Last name"
            />
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-5">
          <div>
            <label className="block text-xs font-semibold text-brown mb-1.5">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full text-sm px-4 py-2.5 bg-white border border-border rounded-lg focus:outline-none focus:border-peach focus:ring-1 focus:ring-peach/40"
              placeholder="your@email.com"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-brown mb-1.5">Country</label>
            <input
              type="text"
              required
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              className="w-full text-sm px-4 py-2.5 bg-white border border-border rounded-lg focus:outline-none focus:border-peach focus:ring-1 focus:ring-peach/40"
              placeholder="Country of residence"
            />
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-5">
          <div>
            <label className="block text-xs font-semibold text-brown mb-1.5">Career Stage</label>
            <select
              value={careerStage}
              onChange={(e) => setCareerStage(e.target.value)}
              className="w-full text-sm px-4 py-2.5 bg-white border border-border rounded-lg focus:outline-none focus:border-peach focus:ring-1 focus:ring-peach/40 text-brown-dark"
            >
              {CAREER_STAGES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-brown mb-1.5">
              Submission ID <span className="font-normal text-brown/70">(optional)</span>
            </label>
            <input
              type="text"
              value={submissionId}
              onChange={(e) => setSubmissionId(e.target.value)}
              className="w-full text-sm px-4 py-2.5 bg-white border border-border rounded-lg focus:outline-none focus:border-peach focus:ring-1 focus:ring-peach/40"
              placeholder="e.g. OSCRSJ-2026-0042"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-brown mb-1.5">
            Affiliation <span className="font-normal text-brown/70">(institution, hospital, or program)</span>
          </label>
          <input
            type="text"
            value={affiliation}
            onChange={(e) => setAffiliation(e.target.value)}
            className="w-full text-sm px-4 py-2.5 bg-white border border-border rounded-lg focus:outline-none focus:border-peach focus:ring-1 focus:ring-peach/40"
            placeholder="Where you study, train, or practice"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-brown mb-1.5">Tell us about your situation</label>
          <textarea
            rows={5}
            required
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="w-full text-sm px-4 py-2.5 bg-white border border-border rounded-lg focus:outline-none focus:border-peach focus:ring-1 focus:ring-peach/40 resize-none"
            placeholder="Briefly describe why a discount would help — e.g. medical student funding their first publication, trainee from a lower-income country, etc. We will reply within 2 business days."
          />
        </div>

        <button type="submit" className="btn-primary-light w-full justify-center">
          Send Discount Inquiry
        </button>

        {sent && (
          <p className="text-xs text-brown text-center mt-2">
            Your email client should now be open with your message ready to send. If nothing happened, write to{' '}
            <a href="mailto:waivers@oscrsj.com" className="underline">waivers@oscrsj.com</a> directly.
          </p>
        )}

        <p className="text-xs text-brown/80 text-center">
          Or email us directly at{' '}
          <a href="mailto:waivers@oscrsj.com" className="underline">waivers@oscrsj.com</a>.
        </p>
      </form>
    </div>
  )
}
