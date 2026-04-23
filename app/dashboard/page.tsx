import { createClient, createAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import type { ManuscriptStatus, ManuscriptRow } from '@/lib/types/database'
import WithdrawButton from './WithdrawButton'

const WITHDRAWABLE_STATUSES: ReadonlySet<ManuscriptStatus> = new Set<ManuscriptStatus>([
  'draft',
  'submitted',
  'under_review',
  'revision_requested',
  'revision_received',
])

export const metadata: Metadata = { title: 'Dashboard — OSCRSJ' }

const STATUS_BADGES: Record<ManuscriptStatus, { label: string; className: string }> = {
  draft: { label: 'Draft', className: 'bg-gray-100 text-gray-700' },
  submitted: { label: 'Submitted', className: 'bg-blue-100 text-blue-700' },
  desk_rejected: { label: 'Desk Rejected', className: 'bg-red-100 text-red-700' },
  rejected: { label: 'Rejected', className: 'bg-red-100 text-red-700' },
  withdrawn: { label: 'Withdrawn', className: 'bg-gray-100 text-gray-500' },
  under_review: { label: 'Under Review', className: 'bg-yellow-100 text-yellow-800' },
  revision_requested: { label: 'Revisions Requested', className: 'bg-orange-100 text-orange-700' },
  revision_received: { label: 'Revision Received', className: 'bg-blue-100 text-blue-700' },
  accepted: { label: 'Accepted', className: 'bg-green-100 text-green-700' },
  awaiting_payment: { label: 'Awaiting Payment', className: 'bg-amber-100 text-amber-700' },
  in_production: { label: 'In Production', className: 'bg-purple-100 text-purple-700' },
  published: { label: 'Published', className: 'bg-green-100 text-green-800' },
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Fetch user's manuscripts (as corresponding author)
  const { data: rawManuscripts } = await supabase
    .from('manuscripts')
    .select('id, submission_id, title, status, manuscript_type, created_at, submission_date, updated_at')
    .eq('corresponding_author_id', user.id)
    .order('created_at', { ascending: false })

  const manuscripts = (rawManuscripts ?? []) as Pick<ManuscriptRow, 'id' | 'submission_id' | 'title' | 'status' | 'manuscript_type' | 'created_at' | 'submission_date' | 'updated_at'>[]

  const hasManuscripts = manuscripts.length > 0

  // Fetch latest revision deadline for each manuscript in
  // revision_requested state. Admin client is required because
  // editorial_decisions is editor-RLS-only for SELECT from the
  // author's session; the deadline is the author's own data
  // (they received it in an email) so surfacing it here is safe.
  const revisionRequestedIds = manuscripts
    .filter((m) => m.status === 'revision_requested')
    .map((m) => m.id)
  const deadlineByManuscript = new Map<string, string>()
  if (revisionRequestedIds.length > 0) {
    const admin = createAdminClient()
    const { data: latestDecisions } = await admin
      .from('editorial_decisions')
      .select('manuscript_id, revision_deadline, decision_date')
      .in('manuscript_id', revisionRequestedIds)
      .not('revision_deadline', 'is', null)
      .order('decision_date', { ascending: false })
    const rows =
      (latestDecisions as
        | { manuscript_id: string; revision_deadline: string | null }[]
        | null) || []
    for (const r of rows) {
      // First hit wins because we ordered by decision_date desc.
      if (r.revision_deadline && !deadlineByManuscript.has(r.manuscript_id)) {
        deadlineByManuscript.set(r.manuscript_id, r.revision_deadline)
      }
    }
  }

  return (
    <div>
      {/* Page header with action */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="font-serif text-2xl text-brown-dark">My Submissions</h1>
          <p className="text-sm text-brown mt-1">
            {hasManuscripts
              ? `${manuscripts.length} submission${manuscripts.length === 1 ? '' : 's'}`
              : 'You have not submitted any manuscripts yet.'
            }
          </p>
        </div>
        <Link href="/dashboard/submit" className="btn-primary-light flex-shrink-0">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Submission
        </Link>
      </div>

      {hasManuscripts ? (
        /* Submissions table */
        <div className="bg-white border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-cream/50 border-b border-border">
                  <th className="text-left px-4 py-3 font-medium text-brown text-xs uppercase tracking-wider">ID</th>
                  <th className="text-left px-4 py-3 font-medium text-brown text-xs uppercase tracking-wider">Title</th>
                  <th className="text-left px-4 py-3 font-medium text-brown text-xs uppercase tracking-wider">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-brown text-xs uppercase tracking-wider">Submitted</th>
                  <th className="text-left px-4 py-3 font-medium text-brown text-xs uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {manuscripts.map((ms) => {
                  const badge = STATUS_BADGES[ms.status as ManuscriptStatus] || { label: ms.status, className: 'bg-gray-100 text-gray-700' }
                  const dateStr = ms.submission_date || ms.created_at
                  const date = dateStr ? new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '-'
                  const deadlineIso =
                    ms.status === 'revision_requested'
                      ? deadlineByManuscript.get(ms.id) || null
                      : null
                  const daysLeft = deadlineIso
                    ? Math.ceil(
                        (new Date(deadlineIso).getTime() - Date.now()) /
                          (1000 * 60 * 60 * 24)
                      )
                    : null
                  const deadlineLabel = deadlineIso
                    ? new Date(deadlineIso).toLocaleDateString('en-US', {
                        month: 'long',
                        day: 'numeric',
                        year: 'numeric',
                      })
                    : null
                  const urgentBanner = daysLeft !== null && daysLeft < 10

                  return (
                    <tr key={ms.id} className="border-b border-border last:border-0 hover:bg-white/50 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs text-brown whitespace-nowrap">
                        {ms.submission_id || '-'}
                      </td>
                      <td className="px-4 py-3 text-ink max-w-xs">
                        <div className="truncate">
                          {ms.title || 'Untitled manuscript'}
                        </div>
                        {ms.status === 'revision_requested' && (
                          <div
                            className={`mt-1.5 text-[11px] border rounded px-2 py-1 inline-flex items-center gap-2 ${
                              urgentBanner
                                ? 'bg-red-50 border-red-200 text-red-800'
                                : 'bg-amber-50 border-amber-200 text-amber-800'
                            }`}
                          >
                            <svg
                              className="w-3.5 h-3.5"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M12 8v4m0 4h.01M12 2a10 10 0 100 20 10 10 0 000-20z"
                              />
                            </svg>
                            <span>
                              Revision requested
                              {deadlineLabel
                                ? ` — respond by ${deadlineLabel}`
                                : ''}
                              {daysLeft !== null && daysLeft >= 0
                                ? ` (${daysLeft}d left)`
                                : ''}
                            </span>
                            <Link
                              href={`/dashboard/submit?revising=${ms.id}`}
                              className="font-semibold underline underline-offset-2"
                            >
                              Submit revision →
                            </Link>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${badge.className}`}>
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-brown whitespace-nowrap">{date}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {ms.status === 'draft' ? (
                            <Link
                              href={`/dashboard/submit?draft=${ms.id}`}
                              className="text-brown hover:underline text-xs font-medium"
                            >
                              Resume
                            </Link>
                          ) : ms.status === 'revision_requested' ? (
                            <Link
                              href={`/dashboard/submit?revising=${ms.id}`}
                              className="text-brown hover:underline text-xs font-medium"
                            >
                              Submit revision
                            </Link>
                          ) : (
                            <Link
                              href={`/dashboard/submission/${ms.id}`}
                              className="text-brown hover:underline text-xs font-medium"
                            >
                              View
                            </Link>
                          )}
                          {WITHDRAWABLE_STATUSES.has(ms.status as ManuscriptStatus) && (
                            <WithdrawButton
                              manuscriptId={ms.id}
                              submissionId={ms.submission_id}
                              title={ms.title}
                            />
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Empty state */
        <div className="bg-white border border-border rounded-xl p-12 text-center">
          <div className="w-16 h-16 bg-cream rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-brown" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h2 className="font-serif text-xl text-brown-dark mb-2">No Submissions Yet</h2>
          <p className="text-sm text-brown max-w-sm mx-auto mb-6">
            Ready to share your research? Start a new manuscript submission and our editorial team will guide you through the peer review process.
          </p>
          <Link href="/dashboard/submit" className="btn-primary-light">
            Start Your First Submission
          </Link>

          <div className="mt-8 pt-6 border-t border-border grid grid-cols-1 sm:grid-cols-3 gap-4 text-left">
            {[
              {
                title: 'Prepare Your Manuscript',
                desc: 'Review our Guide for Authors for formatting requirements, word limits, and required checklists.',
                link: '/guide-for-authors',
                linkText: 'Guide for Authors',
              },
              {
                title: 'Download Templates',
                desc: 'Use our manuscript templates to ensure your submission meets all formatting standards.',
                link: '/templates',
                linkText: 'View Templates',
              },
              {
                title: 'Understand Peer Review',
                desc: 'Learn about our double-blind review process, timelines, and what to expect.',
                link: '/peer-review',
                linkText: 'Peer Review Process',
              },
            ].map((card) => (
              <div key={card.title} className="bg-white/50 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-ink mb-1">{card.title}</h3>
                <p className="text-xs text-brown mb-2">{card.desc}</p>
                <Link href={card.link} className="text-xs text-brown hover:underline font-medium">
                  {card.linkText} &rarr;
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
