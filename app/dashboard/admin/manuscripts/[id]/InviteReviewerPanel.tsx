'use client'

import { useMemo, useState, useTransition } from 'react'
import { inviteReviewer } from '@/lib/reviewer/actions'
import type {
  ReviewInvitationRow,
  ReviewerApplicationRow,
  InvitationStatus,
} from '@/lib/types/database'

interface Props {
  manuscriptId: string
  manuscriptSubspecialty: string | null
  manuscriptStatus: string
  invitations: ReviewInvitationRow[]
  activeApplications: ReviewerApplicationRow[]
  /** Map of review_invitations.id → reviews.id for submitted (non-draft) reviews. */
  reviewByInvitation: Record<string, string>
}

const INVITATION_STATUS_STYLES: Record<InvitationStatus, string> = {
  invited: 'bg-amber-100 text-amber-800 border-amber-200',
  accepted: 'bg-green-100 text-green-800 border-green-200',
  declined: 'bg-red-100 text-red-800 border-red-200',
  submitted: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  cancelled: 'bg-neutral-100 text-neutral-700 border-neutral-300',
}

const INVITABLE_STATUSES = ['submitted', 'under_review', 'revision_received']

function defaultDeadline(): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + 21)
  return d.toISOString().slice(0, 10)
}

export default function InviteReviewerPanel({
  manuscriptId,
  manuscriptSubspecialty,
  manuscriptStatus,
  invitations,
  activeApplications,
  reviewByInvitation,
}: Props) {
  const invitable = INVITABLE_STATUSES.includes(manuscriptStatus)
  const invitedApplicationIds = useMemo(() => {
    const ids = new Set<string>()
    for (const inv of invitations) {
      if (
        inv.reviewer_application_id &&
        (inv.status === 'invited' || inv.status === 'accepted')
      ) {
        ids.add(inv.reviewer_application_id)
      }
    }
    return ids
  }, [invitations])

  const ranked = useMemo(() => {
    const normalizedSub = (manuscriptSubspecialty || '').trim().toLowerCase()
    return [...activeApplications].sort((a, b) => {
      const aMatch = a.subspecialty_interests?.some(
        (s) => s.toLowerCase() === normalizedSub
      )
      const bMatch = b.subspecialty_interests?.some(
        (s) => s.toLowerCase() === normalizedSub
      )
      if (aMatch === bMatch) return a.last_name.localeCompare(b.last_name)
      return aMatch ? -1 : 1
    })
  }, [activeApplications, manuscriptSubspecialty])

  return (
    <section className="space-y-6">
      <div className="bg-white border border-border rounded-xl p-6 space-y-3">
        <h2 className="font-serif text-lg text-brown-dark">
          Current invitations ({invitations.length})
        </h2>
        {invitations.length === 0 ? (
          <p className="text-sm text-brown">
            No reviewers invited yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b border-border">
                  <th className="px-2 py-2 text-[11px] uppercase tracking-widest text-brown font-medium">
                    Reviewer
                  </th>
                  <th className="px-2 py-2 text-[11px] uppercase tracking-widest text-brown font-medium">
                    Email
                  </th>
                  <th className="px-2 py-2 text-[11px] uppercase tracking-widest text-brown font-medium">
                    Status
                  </th>
                  <th className="px-2 py-2 text-[11px] uppercase tracking-widest text-brown font-medium">
                    Invited
                  </th>
                  <th className="px-2 py-2 text-[11px] uppercase tracking-widest text-brown font-medium">
                    Deadline
                  </th>
                  <th className="px-2 py-2 text-[11px] uppercase tracking-widest text-brown font-medium">
                    Responded
                  </th>
                  <th className="px-2 py-2 text-[11px] uppercase tracking-widest text-brown font-medium">
                    Review
                  </th>
                </tr>
              </thead>
              <tbody>
                {invitations.map((inv) => {
                  const reviewId = reviewByInvitation[inv.id]
                  return (
                    <tr key={inv.id} className="border-b border-border/60">
                      <td className="px-2 py-2 text-ink">
                        {[inv.reviewer_first_name, inv.reviewer_last_name]
                          .filter(Boolean)
                          .join(' ') || '—'}
                      </td>
                      <td className="px-2 py-2 text-ink">
                        {inv.reviewer_email || '—'}
                      </td>
                      <td className="px-2 py-2">
                        <span
                          className={`text-[11px] uppercase tracking-widest px-2 py-0.5 rounded-full border ${INVITATION_STATUS_STYLES[inv.status]}`}
                        >
                          {inv.status}
                        </span>
                        {inv.status === 'declined' && inv.declined_reason && (
                          <p className="text-xs text-brown mt-1">
                            “{inv.declined_reason}”
                          </p>
                        )}
                      </td>
                      <td className="px-2 py-2 text-xs text-brown">
                        {new Date(inv.invited_date).toLocaleDateString()}
                      </td>
                      <td className="px-2 py-2 text-xs text-brown">
                        {inv.deadline
                          ? new Date(inv.deadline).toLocaleDateString()
                          : '—'}
                      </td>
                      <td className="px-2 py-2 text-xs text-brown">
                        {inv.response_date
                          ? new Date(inv.response_date).toLocaleDateString()
                          : '—'}
                      </td>
                      <td className="px-2 py-2 text-xs">
                        {reviewId ? (
                          <a
                            href={`/dashboard/admin/manuscripts/${manuscriptId}/reviews/${reviewId}`}
                            className="text-ink underline underline-offset-2 hover:text-brown-dark"
                          >
                            View review
                          </a>
                        ) : (
                          <span className="text-brown">—</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="bg-white border border-border rounded-xl p-6 space-y-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <h2 className="font-serif text-lg text-brown-dark">
            Active reviewer pool ({ranked.length})
          </h2>
          {!invitable && (
            <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 px-2 py-1 rounded">
              Manuscript status “{manuscriptStatus.replace(/_/g, ' ')}” — invitations disabled.
            </span>
          )}
        </div>
        {ranked.length === 0 ? (
          <p className="text-sm text-brown">
            No reviewer applications have been marked “active” yet. Promote
            applicants from{' '}
            <a
              href="/dashboard/admin/reviewer-applications?status=approved"
              className="underline underline-offset-2"
            >
              the approved pool
            </a>
            .
          </p>
        ) : (
          <div className="space-y-3">
            {ranked.map((app) => (
              <ApplicantRow
                key={app.id}
                app={app}
                manuscriptId={manuscriptId}
                manuscriptSubspecialty={manuscriptSubspecialty}
                alreadyInvited={invitedApplicationIds.has(app.id)}
                disabled={!invitable}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

function ApplicantRow({
  app,
  manuscriptId,
  manuscriptSubspecialty,
  alreadyInvited,
  disabled,
}: {
  app: ReviewerApplicationRow
  manuscriptId: string
  manuscriptSubspecialty: string | null
  alreadyInvited: boolean
  disabled: boolean
}) {
  const [open, setOpen] = useState(false)
  const [deadline, setDeadline] = useState(defaultDeadline())
  const [note, setNote] = useState('')
  const [isPending, startTransition] = useTransition()
  const [message, setMessage] = useState<string | null>(null)
  const [isError, setIsError] = useState(false)

  const match = manuscriptSubspecialty
    ? app.subspecialty_interests?.some(
        (s) => s.toLowerCase() === manuscriptSubspecialty.toLowerCase()
      )
    : false

  function flash(msg: string, err = false) {
    setMessage(msg)
    setIsError(err)
    setTimeout(() => setMessage(null), 4000)
  }

  function onSubmit() {
    startTransition(async () => {
      const result = await inviteReviewer({
        mode: 'application',
        manuscriptId,
        reviewerApplicationId: app.id,
        deadline: deadline
          ? new Date(`${deadline}T00:00:00Z`).toISOString()
          : undefined,
        editorNote: note || null,
      })
      if (result.error) flash(result.error, true)
      else if (result.alreadyInvited)
        flash('Reviewer was already invited for this manuscript.')
      else flash('Invitation sent.')
      setOpen(false)
    })
  }

  return (
    <div className="border border-border rounded-lg p-4 space-y-2">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-ink font-medium">
              {app.first_name} {app.last_name}
            </p>
            {match && (
              <span className="text-[10px] uppercase tracking-widest bg-green-100 text-green-800 border border-green-200 px-1.5 py-0.5 rounded">
                Subspecialty match
              </span>
            )}
          </div>
          <p className="text-xs text-brown mt-0.5">
            {app.email} · {app.career_stage.replace('_', ' ')} ·{' '}
            {app.country} · {app.affiliation}
          </p>
          {app.subspecialty_interests.length > 0 && (
            <p className="text-xs text-brown mt-1">
              Subspecialties: {app.subspecialty_interests.join(', ')}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {alreadyInvited ? (
            <span className="text-xs text-brown bg-cream border border-border px-2 py-1 rounded">
              Already invited
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              disabled={disabled || isPending}
              className="text-sm px-3 py-1.5 rounded-lg border border-brown bg-peach-dark text-ink hover:bg-peach disabled:opacity-50"
            >
              {open ? 'Cancel' : 'Invite to review'}
            </button>
          )}
        </div>
      </div>

      {open && (
        <div className="space-y-3 pt-3 border-t border-border">
          <div>
            <label className="block text-[11px] uppercase tracking-widest text-brown mb-1">
              Response deadline
            </label>
            <input
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="border border-border rounded-lg px-3 py-1.5 text-sm text-ink bg-white focus:outline-none focus:ring-2 focus:ring-peach-dark/50 focus:border-peach-dark"
            />
          </div>
          <div>
            <label className="block text-[11px] uppercase tracking-widest text-brown mb-1">
              Note to reviewer (optional)
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              maxLength={500}
              placeholder="Optional personal note included in the invitation email."
              className="w-full border border-border rounded-lg px-3 py-2 text-sm text-ink bg-white focus:outline-none focus:ring-2 focus:ring-peach-dark/50 focus:border-peach-dark"
            />
            <p className="text-[11px] text-brown mt-1">
              {note.length}/500
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onSubmit}
              disabled={isPending}
              className="text-sm px-3 py-1.5 rounded-lg border border-brown bg-peach-dark text-ink hover:bg-peach disabled:opacity-50"
            >
              {isPending ? 'Sending…' : 'Send invitation'}
            </button>
          </div>
        </div>
      )}

      {message && (
        <p
          className={`text-sm ${isError ? 'text-red-700' : 'text-green-700'}`}
        >
          {message}
        </p>
      )}
    </div>
  )
}
