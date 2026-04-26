'use client'

import { FormEvent, useState, useTransition } from 'react'
import {
  submitContactMessage,
  CONTACT_SUBJECT_LABELS,
} from '@/lib/inquiry/actions'

export default function ContactForm() {
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [subjectLabel, setSubjectLabel] = useState(CONTACT_SUBJECT_LABELS[0])
  const [message, setMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [isPending, startTransition] = useTransition()

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setErrorMessage(null)

    startTransition(async () => {
      const result = await submitContactMessage({
        firstName,
        lastName,
        email,
        subjectLabel,
        message,
      })

      if (result.error) {
        setErrorMessage(result.error)
        return
      }
      setSuccess(true)
    })
  }

  if (success) {
    return (
      <div className="bg-white border border-border rounded-2xl p-8">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 mx-auto bg-peach/30 rounded-full flex items-center justify-center">
            <svg className="w-6 h-6 text-brown-dark" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h3 className="font-serif text-xl text-brown-dark">Message received</h3>
          <p className="text-sm text-ink leading-relaxed max-w-md mx-auto">
            Thank you. A confirmation email is on its way to <strong>{email}</strong>, and a member of the editorial office will respond within 2 business days.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white border border-border rounded-2xl p-8">
      <span className="section-label">Message</span>
      <h2 className="section-heading mb-6">Send a Message</h2>
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
          <label className="block text-xs font-semibold text-brown mb-1.5">Subject</label>
          <select
            value={subjectLabel}
            onChange={(e) => setSubjectLabel(e.target.value)}
            className="w-full text-sm px-4 py-2.5 bg-white border border-border rounded-lg focus:outline-none focus:border-peach focus:ring-1 focus:ring-peach/40 text-brown-dark"
          >
            {CONTACT_SUBJECT_LABELS.map((label) => (
              <option key={label} value={label}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-brown mb-1.5">Message</label>
          <textarea
            rows={5}
            required
            minLength={10}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="w-full text-sm px-4 py-2.5 bg-white border border-border rounded-lg focus:outline-none focus:border-peach focus:ring-1 focus:ring-peach/40 resize-none"
            placeholder="How can we help?"
          />
        </div>

        {errorMessage && (
          <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {errorMessage}
          </p>
        )}

        <button
          type="submit"
          disabled={isPending}
          className="btn-primary-light w-full justify-center disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isPending ? 'Sending…' : 'Send Message'}
        </button>
      </form>
    </div>
  )
}
