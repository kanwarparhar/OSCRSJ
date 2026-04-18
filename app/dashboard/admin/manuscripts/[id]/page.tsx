import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/server'
import { listReviewerApplications } from '@/lib/reviewer/actions'
import type {
  ManuscriptRow,
  ManuscriptAuthorRow,
  ManuscriptFileRow,
  ManuscriptMetadataRow,
} from '@/lib/types/database'
import InviteReviewerPanel from './InviteReviewerPanel'

export const dynamic = 'force-dynamic'

const TYPE_LABELS: Record<string, string> = {
  case_report: 'Case Report',
  case_series: 'Case Series',
  surgical_technique: 'Surgical Technique',
  images_in_orthopedics: 'Images in Orthopedics',
  letter_to_editor: 'Letter to the Editor',
  review_article: 'Review Article',
}

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
  withdrawn: 'bg-neutral-200 text-neutral-700 border-neutral-300',
  draft: 'bg-gray-100 text-gray-700 border-gray-200',
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export default async function AdminManuscriptDetailPage({
  params,
}: {
  params: { id: string }
}) {
  const admin = createAdminClient()

  const { data: mData } = await admin
    .from('manuscripts')
    .select('*')
    .eq('id', params.id)
    .single()
  const manuscript = (mData as ManuscriptRow | null) || null
  if (!manuscript) notFound()

  const [authorsRes, filesRes, metadataRes, invitationsRes, appsRes] =
    await Promise.all([
      admin
        .from('manuscript_authors')
        .select('*')
        .eq('manuscript_id', params.id)
        .order('author_order', { ascending: true }),
      admin
        .from('manuscript_files')
        .select('*')
        .eq('manuscript_id', params.id)
        .order('file_order', { ascending: true }),
      admin
        .from('manuscript_metadata')
        .select('*')
        .eq('manuscript_id', params.id)
        .maybeSingle(),
      admin
        .from('review_invitations')
        .select('*')
        .eq('manuscript_id', params.id)
        .order('invited_date', { ascending: false }),
      listReviewerApplications({ status: 'active' }),
    ])

  const authors = (authorsRes.data as ManuscriptAuthorRow[] | null) || []
  const files = (filesRes.data as ManuscriptFileRow[] | null) || []
  const metadata = (metadataRes.data as ManuscriptMetadataRow | null) || null
  const invitations = (invitationsRes.data as any[]) || []
  const activeApplications = appsRes.applications || []

  // Map submitted reviews to their invitation so the invitations table
  // can render a "View review" link only on rows that have one.
  const { data: reviewsRows } = await admin
    .from('reviews')
    .select('id, review_invitation_id, is_draft')
    .eq('manuscript_id', params.id)
    .eq('is_draft', false)
  const reviewByInvitation = new Map<string, string>()
  for (const r of (reviewsRows as
    | { id: string; review_invitation_id: string; is_draft: boolean }[]
    | null) || []) {
    reviewByInvitation.set(r.review_invitation_id, r.id)
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/dashboard/admin/manuscripts"
          className="text-xs text-brown hover:text-ink underline underline-offset-2"
        >
          ← All manuscripts
        </Link>
      </div>

      <div className="bg-white border border-border rounded-xl p-6 space-y-4">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div className="min-w-0 flex-1">
            <p className="font-mono text-xs text-brown mb-1">
              {manuscript.submission_id}
            </p>
            <h1 className="font-serif text-2xl text-brown-dark leading-snug">
              {manuscript.title || '(untitled manuscript)'}
            </h1>
          </div>
          <span
            className={`text-[11px] uppercase tracking-widest font-semibold px-2.5 py-1 rounded-full border ${STATUS_STYLES[manuscript.status] || 'bg-gray-100 text-gray-700 border-gray-200'}`}
          >
            {manuscript.status.replace(/_/g, ' ')}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-[11px] uppercase tracking-widest text-brown mb-0.5">
              Type
            </p>
            <p className="text-ink">
              {TYPE_LABELS[manuscript.manuscript_type || ''] ||
                manuscript.manuscript_type ||
                '—'}
            </p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-widest text-brown mb-0.5">
              Subspecialty
            </p>
            <p className="text-ink">{manuscript.subspecialty || '—'}</p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-widest text-brown mb-0.5">
              Submitted
            </p>
            <p className="text-ink">
              {manuscript.submission_date
                ? new Date(manuscript.submission_date).toLocaleString()
                : '—'}
            </p>
          </div>
        </div>

        {manuscript.keywords && manuscript.keywords.length > 0 && (
          <div>
            <p className="text-[11px] uppercase tracking-widest text-brown mb-1">
              Keywords
            </p>
            <div className="flex flex-wrap gap-1.5">
              {manuscript.keywords.map((k) => (
                <span
                  key={k}
                  className="text-xs px-2 py-0.5 bg-cream text-ink rounded-full border border-border"
                >
                  {k}
                </span>
              ))}
            </div>
          </div>
        )}

        {manuscript.abstract && (
          <div>
            <p className="text-[11px] uppercase tracking-widest text-brown mb-1">
              Abstract
            </p>
            <p className="text-sm text-ink whitespace-pre-wrap leading-relaxed">
              {manuscript.abstract}
            </p>
          </div>
        )}
      </div>

      <div className="bg-white border border-border rounded-xl p-6 space-y-3">
        <h2 className="font-serif text-lg text-brown-dark">
          Authors ({authors.length})
        </h2>
        {authors.length === 0 ? (
          <p className="text-sm text-brown">No authors recorded.</p>
        ) : (
          <ul className="space-y-3 text-sm">
            {authors.map((a) => (
              <li
                key={a.id}
                className="border-b border-border pb-2 last:border-b-0 last:pb-0"
              >
                <p className="text-ink font-medium">
                  {a.full_name}
                  {a.is_corresponding && (
                    <span className="ml-2 text-[10px] uppercase tracking-widest bg-peach-dark/30 text-ink px-1.5 py-0.5 rounded">
                      Corresponding
                    </span>
                  )}
                </p>
                <p className="text-xs text-brown">
                  {a.email} {a.affiliation ? `· ${a.affiliation}` : ''}{' '}
                  {a.orcid_id ? `· ORCID ${a.orcid_id}` : ''}
                </p>
                {a.contribution && (
                  <p className="text-xs text-brown mt-1">
                    Contribution: {a.contribution}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="bg-white border border-border rounded-xl p-6 space-y-3">
        <h2 className="font-serif text-lg text-brown-dark">
          Files ({files.length})
        </h2>
        {files.length === 0 ? (
          <p className="text-sm text-brown">No files uploaded.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {files.map((f) => (
              <li
                key={f.id}
                className="flex items-center justify-between gap-3 text-ink"
              >
                <span className="truncate flex-1">{f.original_filename}</span>
                <span className="text-xs uppercase tracking-widest text-brown whitespace-nowrap">
                  {f.file_type.replace(/_/g, ' ')}
                </span>
                <span className="text-xs text-brown whitespace-nowrap">
                  {formatBytes(f.file_size_bytes)}
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-brown pt-2 border-t border-border">
          File download is deferred to Session 10 (signed URLs for blinded
          manuscript review).
        </p>
      </div>

      {metadata && (
        <div className="bg-white border border-border rounded-xl p-6 space-y-3">
          <h2 className="font-serif text-lg text-brown-dark">Declarations</h2>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-[11px] uppercase tracking-widest text-brown">
                Conflict of interest
              </dt>
              <dd className="text-ink">
                {metadata.conflict_of_interest || 'None declared'}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-widest text-brown">
                Funding
              </dt>
              <dd className="text-ink">
                {metadata.funding_sources && metadata.funding_sources.length > 0
                  ? metadata.funding_sources.join(', ')
                  : 'None'}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-widest text-brown">
                AI tools used
              </dt>
              <dd className="text-ink">
                {metadata.ai_tools_used
                  ? metadata.ai_tools_details || 'Yes (no detail)'
                  : 'No'}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-widest text-brown">
                Ethics approval
              </dt>
              <dd className="text-ink">
                {metadata.ethics_approval_number || '—'}
              </dd>
            </div>
          </dl>
        </div>
      )}

      <InviteReviewerPanel
        manuscriptId={manuscript.id}
        manuscriptSubspecialty={manuscript.subspecialty}
        manuscriptStatus={manuscript.status}
        invitations={invitations}
        activeApplications={activeApplications}
        reviewByInvitation={Object.fromEntries(reviewByInvitation)}
      />

      <DeclinedSuggestionsPanel invitations={invitations} />
    </div>
  )
}

function DeclinedSuggestionsPanel({
  invitations,
}: {
  invitations: any[]
}) {
  const withSuggestions = invitations.filter(
    (inv) =>
      inv.status === 'declined' &&
      (inv.suggested_alternative_name ||
        inv.suggested_alternative_email ||
        inv.suggested_alternative_reason)
  )
  if (withSuggestions.length === 0) return null

  return (
    <section className="bg-white border border-border rounded-xl p-6 space-y-4">
      <div>
        <h2 className="font-serif text-lg text-brown-dark">
          Alternative reviewers suggested on decline ({withSuggestions.length})
        </h2>
        <p className="text-xs text-brown mt-1">
          Advisory only. Verify the identity and credentials before issuing an
          invitation through the Active reviewer pool above.
        </p>
      </div>
      <ul className="space-y-3 text-sm">
        {withSuggestions.map((inv) => (
          <li
            key={inv.id}
            className="border border-border rounded-lg p-3 bg-cream/30"
          >
            <p className="text-[11px] uppercase tracking-widest text-brown">
              Suggested by{' '}
              {[inv.reviewer_first_name, inv.reviewer_last_name]
                .filter(Boolean)
                .join(' ') || inv.reviewer_email}
            </p>
            <p className="text-ink font-medium mt-1">
              {inv.suggested_alternative_name || '(no name provided)'}
            </p>
            <p className="text-xs text-brown">
              {inv.suggested_alternative_email || '(no email provided)'}
            </p>
            {inv.suggested_alternative_reason && (
              <p className="text-sm text-ink mt-2 italic">
                "{inv.suggested_alternative_reason}"
              </p>
            )}
            {inv.declined_reason && (
              <p className="text-xs text-brown mt-2">
                Decline reason: {inv.declined_reason}
              </p>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
