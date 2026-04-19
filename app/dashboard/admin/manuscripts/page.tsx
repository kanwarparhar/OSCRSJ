import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/server'
import type { ManuscriptRow, ManuscriptStatus } from '@/lib/types/database'

export const dynamic = 'force-dynamic'

const LISTABLE_STATUSES: ManuscriptStatus[] = [
  'submitted',
  'under_review',
  'revision_received',
  'revision_requested',
  'accepted',
  'awaiting_payment',
  'in_production',
  'published',
  'desk_rejected',
  'rejected',
  'withdrawn',
]

const STATUS_STYLES: Record<string, string> = {
  submitted: 'bg-amber-100 text-amber-800 border-amber-200',
  under_review: 'bg-blue-100 text-blue-800 border-blue-200',
  revision_requested: 'bg-orange-100 text-orange-800 border-orange-200',
  revision_received: 'bg-amber-100 text-amber-800 border-amber-200',
  accepted: 'bg-green-100 text-green-800 border-green-200',
  awaiting_payment: 'bg-purple-100 text-purple-800 border-purple-200',
  in_production: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  published: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  desk_rejected: 'bg-red-100 text-red-800 border-red-200',
  rejected: 'bg-red-100 text-red-800 border-red-200',
  withdrawn: 'bg-neutral-200 text-neutral-700 border-neutral-300',
  draft: 'bg-gray-100 text-gray-700 border-gray-200',
}

const TYPE_LABELS: Record<string, string> = {
  case_report: 'Case Report',
  case_series: 'Case Series',
  surgical_technique: 'Surgical Technique',
  images_in_orthopedics: 'Images in Orthopedics',
  letter_to_editor: 'Letter to the Editor',
  review_article: 'Review Article',
}

interface ManuscriptWithAuthor extends ManuscriptRow {
  corresponding_author: { full_name: string; email: string } | null
}

export default async function AdminManuscriptsPage() {
  const admin = createAdminClient()

  const { data, error } = await admin
    .from('manuscripts')
    .select('*')
    .in('status', LISTABLE_STATUSES as unknown as string[])
    .order('submission_date', { ascending: false, nullsFirst: false })

  const rows = (data as ManuscriptRow[] | null) || []

  // Hydrate corresponding author names in a single round-trip
  const authorIds = Array.from(
    new Set(rows.map((r) => r.corresponding_author_id).filter(Boolean))
  )
  let authorsMap = new Map<string, { full_name: string; email: string }>()
  if (authorIds.length > 0) {
    const { data: users } = await admin
      .from('users')
      .select('id, full_name, email')
      .in('id', authorIds as string[])
    for (const u of (users as any[]) || []) {
      authorsMap.set(u.id, { full_name: u.full_name, email: u.email })
    }
  }

  const hydrated: ManuscriptWithAuthor[] = rows.map((r) => ({
    ...r,
    corresponding_author:
      authorsMap.get(r.corresponding_author_id) || null,
  }))

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-widest text-brown mb-1">
          Admin
        </p>
        <h1 className="font-serif text-3xl text-brown-dark">Manuscripts</h1>
        <p className="text-sm text-brown mt-2 max-w-2xl">
          All submitted manuscripts. Open a row to view the manuscript
          metadata and invite reviewers from the active reviewer pool.
        </p>
      </div>

      {error ? (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
          {error.message}
        </div>
      ) : hydrated.length === 0 ? (
        <div className="bg-white border border-border rounded-xl p-8 text-center text-sm text-brown">
          No submitted manuscripts yet.
        </div>
      ) : (
        <div className="bg-white border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-cream/40 border-b border-border">
                <tr className="text-left">
                  <th className="px-4 py-3 text-[11px] uppercase tracking-widest text-brown font-medium">
                    Submission ID
                  </th>
                  <th className="px-4 py-3 text-[11px] uppercase tracking-widest text-brown font-medium">
                    Title
                  </th>
                  <th className="px-4 py-3 text-[11px] uppercase tracking-widest text-brown font-medium">
                    Type
                  </th>
                  <th className="px-4 py-3 text-[11px] uppercase tracking-widest text-brown font-medium">
                    Subspecialty
                  </th>
                  <th className="px-4 py-3 text-[11px] uppercase tracking-widest text-brown font-medium">
                    Status
                  </th>
                  <th className="px-4 py-3 text-[11px] uppercase tracking-widest text-brown font-medium">
                    Corresponding
                  </th>
                  <th className="px-4 py-3 text-[11px] uppercase tracking-widest text-brown font-medium">
                    Submitted
                  </th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {hydrated.map((m) => (
                  <tr
                    key={m.id}
                    className="border-t border-border hover:bg-cream/30"
                  >
                    <td className="px-4 py-3 font-mono text-xs text-ink">
                      {m.submission_id}
                    </td>
                    <td className="px-4 py-3 text-ink max-w-sm truncate">
                      {m.title || (
                        <span className="text-brown italic">
                          (untitled)
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-ink">
                      {TYPE_LABELS[m.manuscript_type || ''] ||
                        m.manuscript_type ||
                        '—'}
                    </td>
                    <td className="px-4 py-3 text-ink">
                      {m.subspecialty || '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-[11px] uppercase tracking-widest font-semibold px-2 py-0.5 rounded-full border ${STATUS_STYLES[m.status] || 'bg-gray-100 text-gray-700 border-gray-200'}`}
                      >
                        {m.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-ink">
                      {m.corresponding_author?.full_name || '—'}
                    </td>
                    <td className="px-4 py-3 text-xs text-brown">
                      {m.submission_date
                        ? new Date(m.submission_date).toLocaleDateString()
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/dashboard/admin/manuscripts/${m.id}`}
                        className="text-sm text-ink underline underline-offset-2 hover:text-brown"
                      >
                        View →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
