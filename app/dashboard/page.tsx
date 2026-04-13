import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import type { ManuscriptStatus, ManuscriptRow } from '@/lib/types/database'

export const metadata: Metadata = { title: 'Dashboard — OSCRSJ' }

const STATUS_BADGES: Record<ManuscriptStatus, { label: string; className: string }> = {
  draft: { label: 'Draft', className: 'bg-gray-100 text-gray-700' },
  submitted: { label: 'Submitted', className: 'bg-blue-100 text-blue-700' },
  desk_rejected: { label: 'Desk Rejected', className: 'bg-red-100 text-red-700' },
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

  return (
    <div>
      {/* Page header with action */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="font-serif text-2xl text-brown-dark">My Submissions</h1>
          <p className="text-sm text-tan mt-1">
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
                <tr className="bg-cream-alt/50 border-b border-border">
                  <th className="text-left px-4 py-3 font-medium text-tan text-xs uppercase tracking-wider">ID</th>
                  <th className="text-left px-4 py-3 font-medium text-tan text-xs uppercase tracking-wider">Title</th>
                  <th className="text-left px-4 py-3 font-medium text-tan text-xs uppercase tracking-wider">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-tan text-xs uppercase tracking-wider">Submitted</th>
                  <th className="text-left px-4 py-3 font-medium text-tan text-xs uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {manuscripts.map((ms) => {
                  const badge = STATUS_BADGES[ms.status as ManuscriptStatus] || { label: ms.status, className: 'bg-gray-100 text-gray-700' }
                  const dateStr = ms.submission_date || ms.created_at
                  const date = dateStr ? new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '-'

                  return (
                    <tr key={ms.id} className="border-b border-border last:border-0 hover:bg-cream/50 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs text-brown whitespace-nowrap">
                        {ms.submission_id || '-'}
                      </td>
                      <td className="px-4 py-3 text-brown-dark max-w-xs truncate">
                        {ms.title || 'Untitled manuscript'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${badge.className}`}>
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-tan whitespace-nowrap">{date}</td>
                      <td className="px-4 py-3">
                        {ms.status === 'draft' ? (
                          <Link
                            href={`/dashboard/submit?draft=${ms.id}`}
                            className="text-brown hover:underline text-xs font-medium"
                          >
                            Resume
                          </Link>
                        ) : (
                          <Link
                            href={`/dashboard/submission/${ms.id}`}
                            className="text-brown hover:underline text-xs font-medium"
                          >
                            View
                          </Link>
                        )}
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
          <div className="w-16 h-16 bg-cream-alt rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-tan" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h2 className="font-serif text-xl text-brown-dark mb-2">No Submissions Yet</h2>
          <p className="text-sm text-tan max-w-sm mx-auto mb-6">
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
              <div key={card.title} className="bg-cream/50 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-brown-dark mb-1">{card.title}</h3>
                <p className="text-xs text-tan mb-2">{card.desc}</p>
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
