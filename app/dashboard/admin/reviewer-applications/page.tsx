import Link from 'next/link'
import { listReviewerApplications } from '@/lib/reviewer/actions'
import type { ReviewerApplicationStatus } from '@/lib/types/database'
import ReviewerApplicationsTable from './ReviewerApplicationsTable'

const VALID_FILTERS: ReadonlyArray<ReviewerApplicationStatus | 'all'> = [
  'all',
  'pending',
  'approved',
  'active',
  'declined',
  'withdrawn',
] as const

export const dynamic = 'force-dynamic'

export default async function AdminReviewerApplicationsPage({
  searchParams,
}: {
  searchParams?: { status?: string }
}) {
  const raw = searchParams?.status
  const status = (
    raw && (VALID_FILTERS as readonly string[]).includes(raw)
      ? raw
      : 'all'
  ) as ReviewerApplicationStatus | 'all'

  const { applications, error } = await listReviewerApplications({ status })

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-brown mb-1">
            Admin
          </p>
          <h1 className="font-serif text-3xl text-brown-dark">
            Reviewer applications
          </h1>
          <p className="text-sm text-brown mt-2 max-w-2xl">
            Incoming applications from the public{' '}
            <Link
              href="/for-reviewers/apply"
              className="underline underline-offset-2"
            >
              /for-reviewers/apply
            </Link>{' '}
            form. Set status, leave admin-only notes, and track who
            triaged the application.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap border-b border-border pb-3">
        {VALID_FILTERS.map((f) => {
          const active = f === status
          const href =
            f === 'all'
              ? '/dashboard/admin/reviewer-applications'
              : `/dashboard/admin/reviewer-applications?status=${f}`
          return (
            <Link
              key={f}
              href={href}
              className={`text-xs uppercase tracking-widest px-3 py-1.5 rounded-full border transition-colors ${
                active
                  ? 'bg-brown-dark text-cream border-brown-dark'
                  : 'bg-white text-brown border-border hover:border-tan'
              }`}
            >
              {f}
            </Link>
          )
        })}
      </div>

      {error ? (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
          {error}
        </div>
      ) : (
        <ReviewerApplicationsTable
          applications={applications || []}
          activeFilter={status}
        />
      )}
    </div>
  )
}
