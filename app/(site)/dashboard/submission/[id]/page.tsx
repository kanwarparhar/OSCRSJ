import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import type {
  ManuscriptRow,
  ManuscriptAuthorRow,
  ManuscriptFileRow,
  ManuscriptStatus,
  EditorialDecisionRow,
} from '@/lib/types/database'
import FileDownloadButton from './FileDownloadButton'
import WithdrawButton from '../../WithdrawButton'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Submission — OSCRSJ',
  robots: { index: false, follow: false },
}

const WITHDRAWABLE_STATUSES: ReadonlySet<ManuscriptStatus> = new Set<ManuscriptStatus>([
  'draft',
  'submitted',
  'under_review',
  'revision_requested',
  'revision_received',
])

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

const STATUS_EXPLAINER: Record<ManuscriptStatus, string> = {
  draft: 'This submission has not been sent to the editorial office yet. Resume it to finish and submit.',
  submitted: 'Received by the editorial office. It is awaiting an initial editorial check before peer review.',
  desk_rejected: 'The editors have decided not to send this manuscript for external peer review. See the decision letter below.',
  rejected: 'Following peer review, this manuscript was not accepted. See the decision letter below.',
  withdrawn: 'This submission has been withdrawn.',
  under_review: 'Currently with peer reviewers. You will be notified by email when a decision is made.',
  revision_requested: 'The editors have requested revisions. Use the "Submit revision" button to respond.',
  revision_received: 'Your revision has been received and is being reviewed.',
  accepted: 'Congratulations — this manuscript has been accepted for publication.',
  awaiting_payment: 'Accepted. Awaiting the article processing charge before production.',
  in_production: 'Accepted and being prepared for publication.',
  published: 'This article has been published.',
}

const MANUSCRIPT_TYPE_LABELS: Record<string, string> = {
  case_report: 'Case Report',
  case_series: 'Case Series',
  surgical_technique: 'Surgical Technique',
  images_in_orthopedics: 'Images in Orthopedics',
  letter_to_editor: 'Letter to the Editor',
  review_article: 'Systematic Review & Meta-Analysis',
  narrative_review: 'Narrative Review',
}

const FILE_TYPE_LABELS: Record<string, string> = {
  manuscript: 'Manuscript',
  blinded_manuscript: 'Blinded Manuscript',
  title_page: 'Title Page',
  tables: 'Tables',
  figure: 'Figure',
  supplement: 'Supplementary Material',
  cover_letter: 'Cover Letter',
  ethics_approval: 'Ethics Approval',
  care_checklist: 'CARE Checklist',
  sanra_self_rating: 'SANRA Self-Rating',
  prisma_checklist: 'PRISMA 2020 Checklist',
  jbi_case_series_checklist: 'JBI Case Series Checklist',
  tracked_changes: 'Tracked Changes',
  response_to_reviewers: 'Response to Reviewers',
}

// Decisions whose letter is appropriate to surface to the author. Revision
// requests carry their own dedicated flow (the "Submit revision" button +
// the emailed letter), so they are intentionally not duplicated here.
const AUTHOR_VISIBLE_DECISIONS: ReadonlySet<string> = new Set([
  'accept',
  'reject',
  'post_review_reject',
  'desk_reject',
])

function formatFileSize(bytes: number): string {
  if (!bytes || bytes < 0) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

export default async function SubmissionDetailPage({
  params,
}: {
  params: { id: string }
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(`/login?redirect=/dashboard/submission/${params.id}`)

  // RLS scopes this to manuscripts the caller participates in, so an author
  // can never load someone else's submission — a wrong/foreign id 404s.
  const { data: msData } = await supabase
    .from('manuscripts')
    .select(
      'id, submission_id, title, abstract, keywords, manuscript_type, subspecialty, status, note_to_editor, submission_date, decision_date, created_at, updated_at'
    )
    .eq('id', params.id)
    .maybeSingle()

  if (!msData) notFound()
  const ms = msData as Pick<
    ManuscriptRow,
    | 'id'
    | 'submission_id'
    | 'title'
    | 'abstract'
    | 'keywords'
    | 'manuscript_type'
    | 'subspecialty'
    | 'status'
    | 'note_to_editor'
    | 'submission_date'
    | 'decision_date'
    | 'created_at'
    | 'updated_at'
  >

  // A draft has no detail view — send the author back to the wizard to finish it.
  if (ms.status === 'draft') {
    redirect(`/dashboard/submit?draft=${ms.id}`)
  }

  const [{ data: authorData }, { data: fileData }, { data: decisionData }] =
    await Promise.all([
      supabase
        .from('manuscript_authors')
        .select('id, author_order, full_name, affiliation, is_corresponding')
        .eq('manuscript_id', ms.id)
        .order('author_order', { ascending: true }),
      supabase
        .from('manuscript_files')
        .select(
          'id, original_filename, file_name, file_type, file_size_bytes, file_order, version, upload_date'
        )
        .eq('manuscript_id', ms.id)
        .order('version', { ascending: true })
        .order('file_order', { ascending: true }),
      supabase
        .from('editorial_decisions')
        .select('id, decision, decision_letter, decision_date, rescinded_at')
        .eq('manuscript_id', ms.id)
        .is('rescinded_at', null)
        .order('decision_date', { ascending: false }),
    ])

  const authors = (authorData ?? []) as Pick<
    ManuscriptAuthorRow,
    'id' | 'author_order' | 'full_name' | 'affiliation' | 'is_corresponding'
  >[]
  const files = (fileData ?? []) as Pick<
    ManuscriptFileRow,
    | 'id'
    | 'original_filename'
    | 'file_name'
    | 'file_type'
    | 'file_size_bytes'
    | 'file_order'
    | 'version'
    | 'upload_date'
  >[]
  const decisions = ((decisionData ?? []) as Pick<
    EditorialDecisionRow,
    'id' | 'decision' | 'decision_letter' | 'decision_date' | 'rescinded_at'
  >[]).filter(
    (d) => AUTHOR_VISIBLE_DECISIONS.has(d.decision) && d.decision_letter
  )

  const badge = STATUS_BADGES[ms.status] || {
    label: ms.status,
    className: 'bg-gray-100 text-gray-700',
  }
  const typeLabel = ms.manuscript_type
    ? MANUSCRIPT_TYPE_LABELS[ms.manuscript_type] || ms.manuscript_type
    : '—'

  // Group files by version so multi-round submissions read as
  // "Original Submission" / "Revision 1" etc.
  const filesByVersion = new Map<number, typeof files>()
  for (const f of files) {
    const v = f.version ?? 1
    if (!filesByVersion.has(v)) filesByVersion.set(v, [])
    filesByVersion.get(v)!.push(f)
  }
  const versions = Array.from(filesByVersion.keys()).sort((a, b) => a - b)
  const versionLabel = (v: number) =>
    v <= 1 ? 'Original Submission' : `Revision ${v - 1}`

  return (
    <div className="max-w-3xl">
      {/* Breadcrumb */}
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1.5 text-xs text-brown hover:text-ink mb-4"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to My Submissions
      </Link>

      {/* Header */}
      <div className="bg-white border border-border rounded-xl p-6 mb-6">
        <div className="flex flex-wrap items-center gap-3 mb-3">
          <span
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${badge.className}`}
          >
            {badge.label}
          </span>
          {ms.submission_id && (
            <span className="font-mono text-xs text-brown">{ms.submission_id}</span>
          )}
        </div>
        <h1 className="font-serif text-2xl text-brown-dark leading-snug">
          {ms.title || 'Untitled manuscript'}
        </h1>
        <p className="text-sm text-brown mt-3">{STATUS_EXPLAINER[ms.status]}</p>

        {ms.status === 'revision_requested' && (
          <Link
            href={`/dashboard/submit?revising=${ms.id}`}
            className="btn-primary-light mt-4 inline-flex"
          >
            Submit revision →
          </Link>
        )}

        {WITHDRAWABLE_STATUSES.has(ms.status) && (
          <div className="mt-4">
            <WithdrawButton
              manuscriptId={ms.id}
              submissionId={ms.submission_id}
              title={ms.title}
            />
          </div>
        )}
      </div>

      {/* Details */}
      <section className="bg-white border border-border rounded-xl p-6 mb-6">
        <h2 className="section-heading text-lg mb-4">Details</h2>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 text-sm">
          <div>
            <dt className="text-xs uppercase tracking-wider text-brown mb-1">Article Type</dt>
            <dd className="text-ink">{typeLabel}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wider text-brown mb-1">Subspecialty</dt>
            <dd className="text-ink">{ms.subspecialty || '—'}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wider text-brown mb-1">Submitted</dt>
            <dd className="text-ink">{formatDate(ms.submission_date || ms.created_at)}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wider text-brown mb-1">Last Updated</dt>
            <dd className="text-ink">{formatDate(ms.updated_at)}</dd>
          </div>
          {ms.keywords && ms.keywords.length > 0 && (
            <div className="sm:col-span-2">
              <dt className="text-xs uppercase tracking-wider text-brown mb-1">Keywords</dt>
              <dd className="flex flex-wrap gap-1.5">
                {ms.keywords.map((kw) => (
                  <span
                    key={kw}
                    className="inline-flex items-center px-2 py-0.5 rounded-full bg-cream-alt text-xs text-brown"
                  >
                    {kw}
                  </span>
                ))}
              </dd>
            </div>
          )}
        </dl>
        {ms.abstract && (
          <div className="mt-5 pt-5 border-t border-border">
            <dt className="text-xs uppercase tracking-wider text-brown mb-1.5">Abstract</dt>
            <p className="text-sm text-ink leading-relaxed whitespace-pre-line">{ms.abstract}</p>
          </div>
        )}
      </section>

      {/* Authors */}
      {authors.length > 0 && (
        <section className="bg-white border border-border rounded-xl p-6 mb-6">
          <h2 className="section-heading text-lg mb-4">Authors</h2>
          <ol className="space-y-2 text-sm">
            {authors.map((a) => (
              <li key={a.id} className="flex flex-wrap items-baseline gap-x-2">
                <span className="text-ink font-medium">{a.full_name}</span>
                {a.is_corresponding && (
                  <span className="text-[11px] text-brown">(Corresponding)</span>
                )}
                {a.affiliation && (
                  <span className="text-xs text-brown">— {a.affiliation}</span>
                )}
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* Files */}
      <section className="bg-white border border-border rounded-xl p-6 mb-6">
        <h2 className="section-heading text-lg mb-4">Files</h2>
        {files.length === 0 ? (
          <p className="text-sm text-brown">No files are attached to this submission.</p>
        ) : (
          <div className="space-y-5">
            {versions.map((v) => (
              <div key={v}>
                {versions.length > 1 && (
                  <h3 className="text-xs uppercase tracking-wider text-brown font-semibold border-b border-border pb-1.5 mb-2">
                    {versionLabel(v)} ({filesByVersion.get(v)!.length})
                  </h3>
                )}
                <ul className="divide-y divide-border">
                  {filesByVersion.get(v)!.map((f) => (
                    <li key={f.id} className="flex items-center justify-between gap-3 py-2.5">
                      <div className="min-w-0">
                        <div className="text-sm text-ink truncate">
                          {f.original_filename || f.file_name}
                        </div>
                        <div className="text-[11px] text-brown mt-0.5">
                          {FILE_TYPE_LABELS[f.file_type] || f.file_type} ·{' '}
                          {formatFileSize(f.file_size_bytes)}
                        </div>
                      </div>
                      <FileDownloadButton fileId={f.id} />
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Decision letters */}
      {decisions.length > 0 && (
        <section className="bg-white border border-border rounded-xl p-6 mb-6">
          <h2 className="section-heading text-lg mb-4">Editorial Decision</h2>
          <div className="space-y-5">
            {decisions.map((d) => (
              <div key={d.id}>
                <div className="text-xs text-brown mb-2">{formatDate(d.decision_date)}</div>
                <div className="bg-cream-alt rounded-lg p-4 text-sm text-ink leading-relaxed whitespace-pre-line">
                  {d.decision_letter}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <p className="text-xs text-brown">
        Questions about this submission? Email{' '}
        <a href="mailto:oscrsjournal@gmail.com" className="underline hover:text-ink">
          oscrsjournal@gmail.com
        </a>
        .
      </p>
    </div>
  )
}
