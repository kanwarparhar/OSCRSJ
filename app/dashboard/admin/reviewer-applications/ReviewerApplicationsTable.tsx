'use client'

import { useState, useTransition } from 'react'
import {
  updateReviewerApplicationStatus,
  updateReviewerApplicationAdminNotes,
} from '@/lib/reviewer/actions'
import type {
  ReviewerApplicationRow,
  ReviewerApplicationStatus,
} from '@/lib/types/database'

interface Props {
  applications: ReviewerApplicationRow[]
  activeFilter: ReviewerApplicationStatus | 'all'
}

const STATUS_STYLES: Record<ReviewerApplicationStatus, string> = {
  pending: 'bg-amber-100 text-amber-800 border-amber-200',
  approved: 'bg-blue-100 text-blue-800 border-blue-200',
  active: 'bg-green-100 text-green-800 border-green-200',
  declined: 'bg-gray-200 text-gray-700 border-gray-300',
  withdrawn: 'bg-neutral-100 text-neutral-700 border-neutral-300',
}

const STAGE_LABELS: Record<string, string> = {
  med_student: 'Med student',
  resident: 'Resident',
  fellow: 'Fellow',
  attending: 'Attending',
  other: 'Other',
}

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime()
  const now = Date.now()
  const diffMs = now - then
  const mins = Math.floor(diffMs / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months}mo ago`
  return `${Math.floor(months / 12)}y ago`
}

export default function ReviewerApplicationsTable({
  applications,
  activeFilter,
}: Props) {
  if (applications.length === 0) {
    return (
      <div className="bg-white border border-border rounded-xl p-8 text-center text-sm text-brown">
        No applications found
        {activeFilter !== 'all' ? ` with status "${activeFilter}"` : ''}.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {applications.map((app) => (
        <ApplicationRow key={app.id} app={app} />
      ))}
    </div>
  )
}

function ApplicationRow({ app }: { app: ReviewerApplicationRow }) {
  const [expanded, setExpanded] = useState(false)
  const [notes, setNotes] = useState(app.admin_notes || '')
  const [message, setMessage] = useState<string | null>(null)
  const [isError, setIsError] = useState(false)
  const [isPending, startTransition] = useTransition()

  function showMessage(text: string, err = false) {
    setMessage(text)
    setIsError(err)
    setTimeout(() => setMessage(null), 3500)
  }

  function onTransition(newStatus: ReviewerApplicationStatus) {
    startTransition(async () => {
      const result = await updateReviewerApplicationStatus({
        applicationId: app.id,
        newStatus,
        adminNotes: notes !== (app.admin_notes || '') ? notes : undefined,
      })
      if (result.error) showMessage(result.error, true)
      else showMessage(`Status → ${newStatus}`)
    })
  }

  function onSaveNotes() {
    startTransition(async () => {
      const result = await updateReviewerApplicationAdminNotes({
        applicationId: app.id,
        notes,
      })
      if (result.error) showMessage(result.error, true)
      else showMessage('Notes saved')
    })
  }

  const next = allowedTransitions(app.status)
  const fullName = `${app.first_name} ${app.last_name}`.trim()

  return (
    <div className="bg-white border border-border rounded-xl overflow-hidden">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full text-left p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 hover:bg-cream-alt/40 transition-colors"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span
              className={`text-[11px] uppercase tracking-widest font-semibold px-2 py-0.5 rounded-full border ${STATUS_STYLES[app.status]}`}
            >
              {app.status}
            </span>
            <span className="text-xs text-brown">
              {formatRelative(app.created_at)}
            </span>
          </div>
          <p className="font-serif text-lg text-brown-dark truncate">
            {fullName}
          </p>
          <p className="text-xs text-brown truncate">
            {app.email} · {STAGE_LABELS[app.career_stage] || app.career_stage}{' '}
            · {app.country} · {app.affiliation}
          </p>
          {app.subspecialty_interests.length > 0 && (
            <p className="text-xs text-brown mt-1 truncate">
              Subspecialties: {app.subspecialty_interests.join(', ')}
            </p>
          )}
        </div>
        <span className="text-xs text-brown flex-shrink-0">
          {expanded ? 'Collapse ▴' : 'Expand ▾'}
        </span>
      </button>

      {expanded && (
        <div className="border-t border-border p-5 space-y-5 bg-cream-alt/30">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <DetailField label="Email" value={app.email} />
            <DetailField
              label="Career stage"
              value={STAGE_LABELS[app.career_stage] || app.career_stage}
            />
            <DetailField label="Affiliation" value={app.affiliation} />
            <DetailField label="Country" value={app.country} />
            <DetailField
              label="ORCID iD"
              value={
                app.orcid_id ? (
                  <a
                    href={`https://orcid.org/${app.orcid_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline underline-offset-2"
                  >
                    {app.orcid_id}
                  </a>
                ) : (
                  <span className="text-brown">—</span>
                )
              }
            />
            <DetailField
              label="Writing sample"
              value={
                app.writing_sample_url ? (
                  <a
                    href={app.writing_sample_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline underline-offset-2 break-all"
                  >
                    {app.writing_sample_url}
                  </a>
                ) : (
                  <span className="text-brown">—</span>
                )
              }
            />
            <DetailField
              label="Subspecialty interests"
              value={app.subspecialty_interests.join(', ') || '—'}
              wide
            />
            <DetailField
              label="How they heard"
              value={app.heard_about || '—'}
              wide
            />
            <DetailField
              label="Submitted"
              value={new Date(app.created_at).toLocaleString()}
            />
            <DetailField
              label="Last reviewed"
              value={
                app.reviewed_at
                  ? new Date(app.reviewed_at).toLocaleString()
                  : '—'
              }
            />
          </div>

          <div>
            <label
              htmlFor={`notes-${app.id}`}
              className="block text-sm font-medium text-brown-dark mb-1"
            >
              Admin notes (editor-only)
            </label>
            <textarea
              id={`notes-${app.id}`}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              maxLength={4000}
              placeholder="Internal triage notes — never shown to applicant."
              className="w-full border border-border rounded-lg px-3 py-2 text-sm text-brown-dark bg-white focus:outline-none focus:ring-2 focus:ring-peach-dark/50 focus:border-peach-dark transition-colors"
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={onSaveNotes}
              disabled={isPending}
              className="text-sm px-3 py-1.5 border border-border rounded-lg text-brown-dark bg-white hover:border-tan disabled:opacity-50"
            >
              Save notes
            </button>
            {next.map((ns) => (
              <button
                key={ns}
                type="button"
                onClick={() => onTransition(ns)}
                disabled={isPending}
                className={`text-sm px-3 py-1.5 rounded-lg border disabled:opacity-50 ${TRANSITION_BUTTON_STYLES[ns]}`}
              >
                Mark {ns}
              </button>
            ))}
          </div>

          {message && (
            <p
              className={`text-sm ${isError ? 'text-red-700' : 'text-green-700'}`}
            >
              {message}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

function DetailField({
  label,
  value,
  wide = false,
}: {
  label: string
  value: React.ReactNode
  wide?: boolean
}) {
  return (
    <div className={wide ? 'sm:col-span-2' : ''}>
      <p className="text-[11px] uppercase tracking-widest text-brown mb-0.5">
        {label}
      </p>
      <div className="text-sm text-brown-dark break-words">{value}</div>
    </div>
  )
}

const TRANSITION_BUTTON_STYLES: Record<ReviewerApplicationStatus, string> = {
  pending: 'bg-amber-50 text-amber-900 border-amber-200 hover:bg-amber-100',
  approved: 'bg-blue-50 text-blue-900 border-blue-200 hover:bg-blue-100',
  active: 'bg-green-50 text-green-900 border-green-200 hover:bg-green-100',
  declined: 'bg-gray-50 text-gray-900 border-gray-200 hover:bg-gray-100',
  withdrawn:
    'bg-neutral-50 text-neutral-900 border-neutral-200 hover:bg-neutral-100',
}

// Suggested workflow transitions. The server action allows any
// admin to set any status — this just reduces click-throughs in the
// common path.
function allowedTransitions(
  status: ReviewerApplicationStatus
): ReviewerApplicationStatus[] {
  switch (status) {
    case 'pending':
      return ['approved', 'declined']
    case 'approved':
      return ['active', 'declined', 'withdrawn']
    case 'active':
      return ['withdrawn']
    case 'declined':
      return ['pending']
    case 'withdrawn':
      return ['pending', 'active']
    default:
      return []
  }
}
