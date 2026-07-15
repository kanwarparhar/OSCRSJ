import { createAdminClient } from '@/lib/supabase/server'
import type { ManuscriptRow, ManuscriptStatus } from '@/lib/types/database'
import ManuscriptsListClient, {
  type AdminManuscriptRow,
} from './ManuscriptsListClient'

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

  const hydrated: AdminManuscriptRow[] = rows.map((r) => ({
    id: r.id,
    submissionId: r.submission_id,
    title: r.title || '',
    status: r.status,
    correspondingAuthorName:
      authorsMap.get(r.corresponding_author_id)?.full_name || null,
    manuscriptType: r.manuscript_type,
    subspecialty: r.subspecialty,
    submissionDate: r.submission_date,
  }))

  return (
    <div className="space-y-6 pb-24">
      <div>
        <p className="text-xs uppercase tracking-widest text-brown mb-1">
          Admin
        </p>
        <h1 className="font-serif text-3xl text-brown-dark">Manuscripts</h1>
        <p className="text-sm text-brown mt-2 max-w-2xl">
          All submitted manuscripts. Open a row to view the manuscript
          metadata and invite reviewers from the active reviewer pool. Select
          multiple rows to issue the same decision across a batch &mdash;
          typically used for desk-reject sweeps after a call for papers.
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
        <ManuscriptsListClient rows={hydrated} />
      )}
    </div>
  )
}
