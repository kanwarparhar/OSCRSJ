import Link from 'next/link'
import {
  buildReviewerRoster,
  listReviewerApplications,
  type ReviewerRosterEntry,
} from '@/lib/reviewer/actions'
import ReviewerRosterTable, {
  type RosterTab,
} from './ReviewerRosterTable'
import ReviewerApplicationsTable from './ReviewerApplicationsTable'
import RosterPagination from './RosterPagination'

const VALID_TABS: ReadonlyArray<RosterTab> = [
  'all',
  'applicants',
  'pending',
  'approved',
  'active',
  'declined',
] as const

const TAB_LABELS: Record<RosterTab, string> = {
  all: 'All',
  applicants: 'Applicants',
  pending: 'Pending',
  approved: 'Approved',
  active: 'Active',
  declined: 'Declined',
}

const PAGE_SIZE = 25

export const dynamic = 'force-dynamic'

export default async function AdminReviewerApplicationsPage({
  searchParams,
}: {
  searchParams?: { tab?: string; status?: string; page?: string }
}) {
  // Back-compat: the old page used ?status=<application-status>.
  // Map legacy ?status=... to the new tab where it makes sense so
  // existing bookmarks don't 404.
  const rawTab = searchParams?.tab
  const rawStatus = searchParams?.status
  let tab: RosterTab = 'all'
  if (rawTab && (VALID_TABS as readonly string[]).includes(rawTab)) {
    tab = rawTab as RosterTab
  } else if (rawStatus) {
    if (rawStatus === 'pending') tab = 'applicants'
    else if (
      ['approved', 'active', 'declined'].includes(rawStatus)
    )
      tab = rawStatus as RosterTab
    else if (rawStatus === 'withdrawn') tab = 'declined'
  }

  // Parse + clamp page. Defaults to 1; non-numeric falls through.
  const rawPage = Number.parseInt(searchParams?.page ?? '', 10)
  const requestedPage =
    Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1

  const { roster, error } = await buildReviewerRoster()

  // The Applicants tab uses the existing inline-triage component
  // (ReviewerApplicationsTable) so editor approval/decline still
  // works. Load only the rows whose status is 'pending' for that
  // tab — applicants who've been approved/active/declined live in
  // the unified bucket logic of buildReviewerRoster instead.
  const { applications: pendingApplications } = await listReviewerApplications({
    status: 'pending',
  })

  // ---- Compute the page slice for the active tab ---------------
  const pendingApps = pendingApplications || []
  const filtered: ReviewerRosterEntry[] = roster
    ? filterRoster(roster, tab)
    : []

  const totalRows =
    tab === 'applicants' ? pendingApps.length : filtered.length
  const totalPages = Math.max(1, Math.ceil(totalRows / PAGE_SIZE))
  const currentPage = Math.min(requestedPage, totalPages)
  const sliceStart = (currentPage - 1) * PAGE_SIZE
  const sliceEnd = sliceStart + PAGE_SIZE

  const pagedRoster = filtered.slice(sliceStart, sliceEnd)
  const pagedApplicants = pendingApps.slice(sliceStart, sliceEnd)

  function buildHref(targetTab: RosterTab, page: number): string {
    const params: string[] = []
    if (targetTab !== 'all') params.push(`tab=${targetTab}`)
    if (page > 1) params.push(`page=${page}`)
    const qs = params.length ? `?${params.join('&')}` : ''
    return `/dashboard/admin/reviewer-applications${qs}`
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-brown mb-1">
            Admin
          </p>
          <h1 className="font-serif text-3xl text-brown-dark">
            Reviewer roster
          </h1>
          <p className="text-sm text-brown mt-2 max-w-2xl">
            Every reviewer who has been invited to review for OSCRSJ —
            grouped by bucket below. The{' '}
            <span className="font-semibold">Applicants</span> tab still
            holds public applicants from{' '}
            <Link
              href="/for-reviewers/apply"
              className="underline underline-offset-2"
            >
              /for-reviewers/apply
            </Link>{' '}
            who are awaiting editor triage.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap border-b border-border pb-3">
        {VALID_TABS.map((t) => {
          const active = t === tab
          const count = countForTab(roster || [], pendingApps, t)
          return (
            <Link
              key={t}
              href={buildHref(t, 1)}
              className={`text-xs uppercase tracking-widest px-3 py-1.5 rounded-full border transition-colors flex items-center gap-1.5 ${
                active
                  ? 'bg-brown-dark text-cream border-brown-dark'
                  : 'bg-white text-brown border-border hover:border-tan'
              }`}
            >
              <span>{TAB_LABELS[t]}</span>
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                  active
                    ? 'bg-cream text-brown-dark'
                    : 'bg-cream-alt text-brown'
                }`}
              >
                {count}
              </span>
            </Link>
          )
        })}
      </div>

      {error ? (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
          {error}
        </div>
      ) : tab === 'applicants' ? (
        <>
          <ReviewerApplicationsTable
            applications={pagedApplicants}
            activeFilter="pending"
          />
          <RosterPagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalRows={totalRows}
            pageSize={PAGE_SIZE}
            hrefForPage={(p) => buildHref(tab, p)}
          />
        </>
      ) : (
        <>
          <ReviewerRosterTable
            roster={pagedRoster}
            activeTab={tab}
            emptyMessage={emptyMessageForTab(tab)}
          />
          <RosterPagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalRows={totalRows}
            pageSize={PAGE_SIZE}
            hrefForPage={(p) => buildHref(tab, p)}
          />
        </>
      )}
    </div>
  )
}

function filterRoster(
  roster: ReviewerRosterEntry[],
  tab: RosterTab
): ReviewerRosterEntry[] {
  switch (tab) {
    case 'all':
      // Everyone except pure applicants — those live in the
      // Applicants tab.
      return roster.filter((r) => r.bucket !== 'applicant')
    case 'applicants':
      return roster.filter((r) => r.bucket === 'applicant')
    case 'pending':
      return roster.filter((r) => r.bucket === 'pending')
    case 'approved':
      return roster.filter((r) => r.bucket === 'approved')
    case 'active':
      return roster.filter((r) => r.bucket === 'active')
    case 'declined':
      // Per Kanwar: declined-invitations and withdrawn-from-pool
      // share the Declined tab. Bucket pill on the row keeps them
      // visually distinct.
      return roster.filter(
        (r) => r.bucket === 'declined' || r.bucket === 'withdrawn'
      )
    default:
      return roster
  }
}

function countForTab(
  roster: ReviewerRosterEntry[],
  pendingApplications: { id: string }[],
  tab: RosterTab
): number {
  if (tab === 'applicants') return pendingApplications.length
  return filterRoster(roster, tab).length
}

function emptyMessageForTab(tab: RosterTab): string {
  switch (tab) {
    case 'all':
      return 'No reviewers have been invited yet.'
    case 'pending':
      return 'No reviewers are awaiting an invitation response.'
    case 'approved':
      return 'No reviewers are currently in the approved (accepted, no review submitted yet) state.'
    case 'active':
      return 'No reviewers have completed at least one review yet.'
    case 'declined':
      return 'No reviewers have declined or been withdrawn from the pool.'
    default:
      return 'No reviewers found.'
  }
}
