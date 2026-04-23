'use client'

import { useState, useTransition } from 'react'
import { inviteReviewer } from '@/lib/reviewer/actions'

interface Props {
  manuscriptId: string
  manuscriptStatus: string
}

const INVITABLE_STATUSES = ['submitted', 'under_review', 'revision_received']

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function defaultDeadline(): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + 21)
  return d.toISOString().slice(0, 10)
}

export default function InviteByEmailPanel({
  manuscriptId,
  manuscriptStatus,
}: Props) {
  const invitable = INVITABLE_STATUSES.includes(manuscriptStatus)

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [deadline, setDeadline] = useState(defaultDeadline())
  const [note, setNote] = useState('')
  const [isPending, startTransition] = useTransition()
  const [message, setMessage] = useState<string | null>(null)
  const [isError, setIsError] = useState(false)

  function flash(msg: string, err = false) {
    setMessage(msg)
    setIsError(err)
    setTimeout(() => setMessage(null), 5000)
  }

  function onSubmit() {
    const trimmedFirst = firstName.trim()
    const trimmedLast = lastName.trim()
    const trimmedEmail = email.trim().toLowerCase()

    if (!trimmedFirst) return flash('First name is required.', true)
    if (!trimmedLast) return flash('Last name is required.', true)
    if (!EMAIL_REGEX.test(trimmedEmail))
      return flash('Enter a valid email address.', true)

    startTransition(async () => {
      const result = await inviteReviewer({
        mode: 'email',
        manuscriptId,
        reviewerEmail: trimmedEmail,
        reviewerFirstName: trimmedFirst,
        reviewerLastName: trimmedLast,
        deadline: deadline
          ? new Date(`${deadline}T00:00:00Z`).toISOString()
          : undefined,
        editorNote: note || null,
      })
      if (result.error) {
        flash(result.error, true)
        return
      }
      if (result.alreadyInvited) {
        flash(
          'This email already has an active invitation for this manuscript.'
        )
        return
      }
      flash('Invitation sent.')
      setFirstName('')
      setLastName('')
      setEmail('')
      setNote('')
      setDeadline(defaultDeadline())
    })
  }

  return (
    <section className="bg-white border border-border rounded-xl p-6 space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="font-serif text-lg text-brown-dark">
            Invite a reviewer by email
          </h2>
          <p className="text-xs text-brown mt-1 max-w-xl">
            Send an invitation to someone outside the approved reviewer pool.
            They'll receive the same Accept / Decline email and the same
            double-blind review workflow. No OSCRSJ account required.
          </p>
        </div>
        {!invitable && (
          <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 px-2 py-1 rounded">
            Manuscript status “{manuscriptStatus.replace(/_/g, ' ')}” —
            invitations disabled.
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-[11px] uppercase tracking-widest text-brown mb-1">
            First name
          </label>
          <input
            type="text"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            disabled={!invitable || isPending}
            maxLength={120}
            className="w-full border border-border rounded-lg px-3 py-1.5 text-sm text-ink bg-white focus:outline-none focus:ring-2 focus:ring-peach-dark/50 focus:border-peach-dark disabled:opacity-50"
          />
        </div>
        <div>
          <label className="block text-[11px] uppercase tracking-widest text-brown mb-1">
            Last name
          </label>
          <input
            type="text"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            disabled={!invitable || isPending}
            maxLength={120}
            className="w-full border border-border rounded-lg px-3 py-1.5 text-sm text-ink bg-white focus:outline-none focus:ring-2 focus:ring-peach-dark/50 focus:border-peach-dark disabled:opacity-50"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-[11px] uppercase tracking-widest text-brown mb-1">
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={!invitable || isPending}
            maxLength={254}
            placeholder="reviewer@university.edu"
            className="w-full border border-border rounded-lg px-3 py-1.5 text-sm text-ink bg-white focus:outline-none focus:ring-2 focus:ring-peach-dark/50 focus:border-peach-dark disabled:opacity-50"
          />
        </div>
        <div>
          <label className="block text-[11px] uppercase tracking-widest text-brown mb-1">
            Response deadline
          </label>
          <input
            type="date"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
            disabled={!invitable || isPending}
            className="border border-border rounded-lg px-3 py-1.5 text-sm text-ink bg-white focus:outline-none focus:ring-2 focus:ring-peach-dark/50 focus:border-peach-dark disabled:opacity-50"
          />
        </div>
      </div>

      <div>
        <label className="block text-[11px] uppercase tracking-widest text-brown mb-1">
          Note to reviewer (optional)
        </label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          disabled={!invitable || isPending}
          rows={3}
          maxLength={500}
          placeholder="Optional personal note included in the invitation email."
          className="w-full border border-border rounded-lg px-3 py-2 text-sm text-ink bg-white focus:outline-none focus:ring-2 focus:ring-peach-dark/50 focus:border-peach-dark disabled:opacity-50"
        />
        <p className="text-[11px] text-brown mt-1">{note.length}/500</p>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <button
          type="button"
          onClick={onSubmit}
          disabled={!invitable || isPending}
          className="text-sm px-3 py-1.5 rounded-lg border border-brown bg-peach-dark text-ink hover:bg-peach disabled:opacity-50"
        >
          {isPending ? 'Sending…' : 'Send invitation'}
        </button>
        {message && (
          <p
            className={`text-sm ${isError ? 'text-red-700' : 'text-green-700'}`}
          >
            {message}
          </p>
        )}
      </div>
    </section>
  )
}
