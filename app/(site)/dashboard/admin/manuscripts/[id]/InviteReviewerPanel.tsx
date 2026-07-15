'use client'

import { useMemo, useState, useTransition } from 'react'
import { inviteReviewer } from '@/lib/reviewer/actions'
import type {
  ReviewInvitationRow,
  InvitationStatus,
} from '@/lib/types/database'

// Shape derived from the unified reviewer roster (Session 32) plus the
// side-loaded reviewer_applications subspecialty interests. The page-level
// server component performs the filter + merge and hands us a flat list.
export interface ReviewerPoolEntry {
  email: string
  firstName: string
  lastName: string
  affiliation: string | null
  country: string | null
  orcidId: string | null
  applicationId: string | null
  bucket: 'applicant' | 'pending' | 'approved' | 'active' | 'declined' | 'withdrawn'
  subspecialtyInterests: string[]
  careerStage: string | null
  reviewsSubmitted: number
  latestInvitationDate: string | null
}

interface Props {
  manuscriptId: string
  manuscriptSubspecialty: string | null
  manuscriptStatus: string
  invitations: ReviewInvitationRow[]
  reviewerPool: ReviewerPoolEntry[]
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

const BUCKET_PILL_STYLES: Record<ReviewerPoolEntry['bucket'], string> = {
  active: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  approved: 'bg-green-100 text-green-800 border-green-200',
  pending: 'bg-amber-100 text-amber-800 border-amber-200',
  applicant: 'bg-blue-100 text-blue-800 border-blue-200',
  declined: 'bg-red-100 text-red-800 border-red-200',
  withdrawn: 'bg-neutral-100 text-neutral-700 border-neutral-300',
}

const BUCKET_PRIORITY: Record<ReviewerPoolEntry['bucket'], number> = {
  active: 0,
  approved: 1,
  pending: 2,
  applicant: 3,
  declined: 4,
  withdrawn: 5,
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
  reviewerPool,
  reviewByInvitation,
}: Props) {
  const invitable = INVITABLE_STATUSES.includes(manuscriptStatus)

  // Dedupe by lowercased email so we cover BOTH the application path
  // (reviewer_application_id snapshot) and the direct-email path (no
  // application row). An invitation in invited / accepted / submitted
  // status disqualifies the reviewer from being invited again on this
  // manuscript.
  const invitedEmails = useMemo(() => {
    const set = new Set<string>()
    for (const inv of invitations) {
      if (
        (inv.status === 'invited' ||
          inv.status === 'accepted' ||
          inv.status === 'submitted') &&
        inv.reviewer_email
      ) {
        set.add(inv.reviewer_email.toLowerCase())
      }
    }
    return set
  }, [invitations])

  const ranked = useMemo(() => {
    const normalizedSub = (manuscriptSubspecialty || '').trim().toLowerCase()
    return [...reviewerPool].sort((a, b) => {
      const aMatch =
        normalizedSub.length > 0 &&
        a.subspecialtyInterests.some((s) => s.toLowerCase() === normalizedSub)
      const bMatch =
        normalizedSub.length > 0 &&
        b.subspecialtyInterests.some((s) => s.toLowerCase() === normalizedSub)
      if (aMatch !== bMatch) return aMatch ? -1 : 1
      // Prefer proven reviewers (active) over engaged (approved) over pending
      // over applicant — reviewers earn higher rank by completing reviews.
      const bucketDelta =
        BUCKET_PRIORITY[a.bucket] - BUCKET_PRIORITY[b.bucket]
      if (bucketDelta !== 0) return bucketDelta
      return a.lastName.localeCompare(b.lastName)
    })
  }, [reviewerPool, manuscriptSubspecialty])

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
          <div>
            <h2 className="font-serif text-lg text-brown-dark">
              Reviewer pool ({ranked.length})
            </h2>
            <p className="text-xs text-brown mt-1">
              Sourced from the unified reviewer roster — proven reviewers,
              accepted invitees, applicants from{' '}
              <a
                href="/for-reviewers/apply"
                className="underline underline-offset-2"
              >
                /for-reviewers/apply
              </a>
              , and direct-email invitees from prior manuscripts. Ranked by
              subspecialty match, then track record.
            </p>
          </div>
          {!invitable && (
            <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 px-2 py-1 rounded">
              Manuscript status “{manuscriptStatus.replace(/_/g, ' ')}” — invitations disabled.
            </span>
          )}
        </div>
        {ranked.length === 0 ? (
          <p className="text-sm text-brown">
            No reviewers in the pool yet. Use the “Invite by email” panel below
            to invite a reviewer directly, or wait for applications via{' '}
            <a
              href="/for-reviewers/apply"
              className="underline underline-offset-2"
            >
              /for-reviewers/apply
            </a>
            .
          </p>
        ) : (
          <div className="space-y-3">
            {ranked.map((entry) => (
              <PoolRow
                key={`${entry.applicationId ?? 'email'}-${entry.email}`}
                entry={entry}
                manuscriptId={manuscriptId}
                manuscriptSubspecialty={manuscriptSubspecialty}
                alreadyInvited={invitedEmails.has(entry.email.toLowerCase())}
                disabled={!invitable}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

function PoolRow({
  entry,
  manuscriptId,
  manuscriptSubspecialty,
  alreadyInvited,
  disabled,
}: {
  entry: ReviewerPoolEntry
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

  const match =
    manuscriptSubspecialty && entry.subspecialtyInterests.length > 0
      ? entry.subspecialtyInterests.some(
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
      const deadlineIso = deadline
        ? new Date(`${deadline}T00:00:00Z`).toISOString()
        : undefined
      const editorNote = note || null

      // Application-mode dispatch when we have an applicationId; otherwise
      // fall back to email-mode (direct-email reviewers from prior
      // manuscripts have no application row by construction).
      const result = entry.applicationId
        ? await inviteReviewer({
            mode: 'application',
            manuscriptId,
            reviewerApplicationId: entry.applicationId,
            deadline: deadlineIso,
            editorNote,
          })
        : await inviteReviewer({
            mode: 'email',
            manuscriptId,
            reviewerEmail: entry.email,
            reviewerFirstName: entry.firstName,
            reviewerLastName: entry.lastName,
            deadline: deadlineIso,
            editorNote,
          })

      if (result.error) flash(result.error, true)
      else if (result.alreadyInvited)
        flash('Reviewer was already invited for this manuscript.')
      else flash('Invitation sent.')
      setOpen(false)
    })
  }

  const fullName =
    [entry.firstName, entry.lastName].filter(Boolean).join(' ') || entry.email
  const metaBits: string[] = []
  if (entry.careerStage)
    metaBits.push(entry.careerStage.replace(/_/g, ' '))
  if (entry.country) metaBits.push(entry.country)
  if (entry.affiliation) metaBits.push(entry.affiliation)

  return (
    <div className="border border-border rounded-lg p-4 space-y-2">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-ink font-medium">{fullName}</p>
            <span
              className={`text-[10px] uppercase tracking-widest px-1.5 py-0.5 rounded border ${BUCKET_PILL_STYLES[entry.bucket]}`}
            >
              {entry.bucket}
            </span>
            {match && (
              <span className="text-[10px] uppercase tracking-widest bg-green-100 text-green-800 border border-green-200 px-1.5 py-0.5 rounded">
                Subspecialty match
              </span>
            )}
            {entry.reviewsSubmitted > 0 && (
              <span className="text-[10px] uppercase tracking-widest text-brown">
                {entry.reviewsSubmitted} review
                {entry.reviewsSubmitted === 1 ? '' : 's'} submitted
              </span>
            )}
          </div>
          <p className="text-xs text-brown mt-0.5">
            {entry.email}
            {metaBits.length > 0 && ` · ${metaBits.join(' · ')}`}
          </p>
          {entry.subspecialtyInterests.length > 0 && (
            <p className="text-xs text-brown mt-1">
              Subspecialties: {entry.subspecialtyInterests.join(', ')}
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
