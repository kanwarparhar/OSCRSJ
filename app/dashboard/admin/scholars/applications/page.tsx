import Link from 'next/link'
import { listCohortApplications } from '@/lib/scholars/actions'
import {
  TRACK_LABELS,
  TIER_LABELS,
  type CohortApplicationStatus,
  type CohortTrack,
} from '@/lib/scholars/types'

export const dynamic = 'force-dynamic'

const STATUS_OPTIONS: ReadonlyArray<CohortApplicationStatus | 'all'> = [
  'all',
  'submitted',
  'under_review',
  'accepted',
  'waitlisted',
  'rejected',
  'withdrawn',
] as const

const TRACK_OPTIONS: ReadonlyArray<CohortTrack | 'all'> = [
  'all',
  'pre_med',
  'med_student',
  'img',
] as const

const STATUS_LABELS: Record<CohortApplicationStatus | 'all', string> = {
  all: 'All',
  submitted: 'Submitted',
  under_review: 'Under review',
  accepted: 'Accepted',
  waitlisted: 'Waitlisted',
  rejected: 'Rejected',
  withdrawn: 'Withdrawn',
}

const STATUS_STYLES: Record<CohortApplicationStatus, string> = {
  submitted: 'bg-amber-100 text-amber-800 border-amber-200',
  under_review: 'bg-blue-100 text-blue-800 border-blue-200',
  accepted: 'bg-green-100 text-green-800 border-green-200',
  waitlisted: 'bg-purple-100 text-purple-800 border-purple-200',
  rejected: 'bg-gray-200 text-gray-700 border-gray-300',
  withdrawn: 'bg-neutral-100 text-neutral-700 border-neutral-300',
}

const TRACK_FILTER_LABELS: Record<CohortTrack | 'all', string> = {
  all: 'All tracks',
  pre_med: 'Pre-Med',
  med_student: 'Med Student',
  img: 'IMG',
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

export default async function AdminCohortApplicationsPage({
  searchParams,
}: {
  searchParams?: { status?: string; track?: string }
}) {
  const rawStatus = searchParams?.status
  const rawTrack = searchParams?.track
  const status: CohortApplicationStatus | 'all' =
    rawStatus && (STATUS_OPTIONS as readonly string[]).includes(rawStatus)
      ? (rawStatus as CohortApplicationStatus | 'all')
      : 'all'
  const track: CohortTrack | 'all' =
    rawTrack && (TRACK_OPTIONS as readonly string[]).includes(rawTrack)
      ? (rawTrack as CohortTrack | 'all')
      : 'all'

  const { applications, error } = await listCohortApplications({
    status,
    track,
  })

  return (
    <div className="max-w-content mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="mb-8">
        <h1 className="font-serif text-3xl text-brown-dark mb-2">
          Research Scholars — Applications
        </h1>
        <p className="text-sm text-brown">
          {applications?.length ?? 0} application
          {applications?.length === 1 ? '' : 's'}
          {status !== 'all' && ` (${STATUS_LABELS[status]})`}
          {track !== 'all' && ` · ${TRACK_FILTER_LABELS[track]}`}
        </p>
      </div>

      {/* Filters */}
      <div className="bg-white border border-border rounded-xl p-4 mb-6 space-y-4">
        <div>
          <p className="text-xs uppercase tracking-wider text-brown font-medium mb-2">
            Status
          </p>
          <div className="flex flex-wrap gap-2">
            {STATUS_OPTIONS.map((s) => (
              <Link
                key={s}
                href={{
                  pathname: '/dashboard/admin/scholars/applications',
                  query: { status: s, ...(track !== 'all' && { track }) },
                }}
                className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                  status === s
                    ? 'bg-brown-dark text-peach border-brown-dark'
                    : 'border-border text-ink hover:bg-cream-alt'
                }`}
              >
                {STATUS_LABELS[s]}
              </Link>
            ))}
          </div>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wider text-brown font-medium mb-2">
            Track
          </p>
          <div className="flex flex-wrap gap-2">
            {TRACK_OPTIONS.map((t) => (
              <Link
                key={t}
                href={{
                  pathname: '/dashboard/admin/scholars/applications',
                  query: { track: t, ...(status !== 'all' && { status }) },
                }}
                className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                  track === t
                    ? 'bg-brown-dark text-peach border-brown-dark'
                    : 'border-border text-ink hover:bg-cream-alt'
                }`}
              >
                {TRACK_FILTER_LABELS[t]}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm mb-4">
          {error}
        </div>
      )}

      {(applications?.length ?? 0) === 0 ? (
        <div className="bg-white border border-border rounded-xl p-8 text-center text-sm text-brown">
          No applications match the current filters.
        </div>
      ) : (
        <div className="space-y-3">
          {applications!.map((app) => (
            <Link
              key={app.id}
              href={`/dashboard/admin/scholars/applications/${app.id}`}
              className="block bg-white border border-border rounded-xl p-5 hover:border-tan hover:shadow-sm transition-all"
            >
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex-1 min-w-[200px]">
                  <div className="font-serif text-lg text-brown-dark">
                    {app.first_name} {app.last_name}
                  </div>
                  <div className="text-xs text-brown mt-1">
                    {app.email} · {app.country_of_residence}
                  </div>
                  <div className="text-xs text-ink mt-2">
                    <strong>{TRACK_LABELS[app.preferred_track]}</strong> —{' '}
                    {TIER_LABELS[app.preferred_tier]}
                  </div>
                  <div className="text-xs text-brown mt-1">
                    {app.school} · {app.year_in_school}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span
                    className={`inline-block text-xs px-2.5 py-1 rounded-full border ${
                      STATUS_STYLES[app.status]
                    }`}
                  >
                    {STATUS_LABELS[app.status]}
                  </span>
                  <span className="text-xs text-brown">
                    {formatRelative(app.created_at)}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
