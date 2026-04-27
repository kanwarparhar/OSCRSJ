import type { Metadata } from 'next'
import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/server'
import type {
  ManuscriptRow,
  ManuscriptFileRow,
  ManuscriptMetadataRow,
  ReviewInvitationRow,
} from '@/lib/types/database'
import { getReviewerPackageSignedUrl } from '@/lib/reviewer-package/build'
import ReviewerFileDownloadButton from './ReviewerFileDownloadButton'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Blinded manuscript — OSCRSJ',
  robots: { index: false, follow: false },
}

const INVITATION_EXPIRY_DAYS = 60

const TYPE_LABELS: Record<string, string> = {
  case_report: 'Case Report',
  case_series: 'Case Series',
  surgical_technique: 'Surgical Technique',
  images_in_orthopedics: 'Images in Orthopedics',
  letter_to_editor: 'Letter to the Editor',
  review_article: 'Review Article',
}

const FILE_TYPE_LABELS: Record<string, string> = {
  blinded_manuscript: 'Blinded manuscript',
  tables: 'Tables',
  figure: 'Figure',
  supplement: 'Supplementary file',
}

function isExpired(invitedDate: string): boolean {
  try {
    const invited = new Date(invitedDate).getTime()
    return Date.now() - invited > INVITATION_EXPIRY_DAYS * 24 * 60 * 60 * 1000
  } catch {
    return false
  }
}

function formatFileSize(bytes: number): string {
  if (!bytes) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default async function ReviewerManuscriptPage({
  params,
}: {
  params: { token: string }
}) {
  const admin = createAdminClient()
  const { data: invData } = await admin
    .from('review_invitations')
    .select('*')
    .eq('review_token', params.token)
    .maybeSingle()

  const invitation = (invData as ReviewInvitationRow | null) || null

  if (!invitation) {
    return (
      <StaticMessage
        heading="This manuscript link is invalid"
        body="We could not locate the invitation associated with this link. If you received it from the OSCRSJ editorial office and believe this is a mistake, please reply to the original email."
      />
    )
  }

  if (invitation.status === 'cancelled') {
    return (
      <StaticMessage
        heading="This invitation has been cancelled"
        body="The manuscript this invitation referred to is no longer under review."
      />
    )
  }

  if (invitation.status === 'invited') {
    return (
      <StaticMessage
        heading="Please accept the invitation first"
        body="You have not yet accepted the invitation. The blinded manuscript becomes available once you accept."
        linkHref={`/review/${params.token}`}
        linkLabel="Go to invitation"
      />
    )
  }

  if (invitation.status === 'declined') {
    return (
      <StaticMessage
        heading="You have declined this invitation"
        body="The manuscript is no longer accessible. If you would like to reconsider, please reply to the original invitation email."
      />
    )
  }

  if (
    invitation.status !== 'accepted' &&
    invitation.status !== 'submitted'
  ) {
    return (
      <StaticMessage
        heading="This manuscript is not available"
        body="The invitation is not in a state that permits manuscript access."
      />
    )
  }

  if (isExpired(invitation.invited_date)) {
    return (
      <StaticMessage
        heading="This invitation has expired"
        body="Invitations are active for 60 days. Please contact the editorial office if you still wish to review this manuscript."
      />
    )
  }

  const { data: mData } = await admin
    .from('manuscripts')
    .select('title, abstract, manuscript_type, subspecialty')
    .eq('id', invitation.manuscript_id)
    .maybeSingle()
  const manuscript = (mData as Partial<ManuscriptRow> | null) || null

  const { data: fData } = await admin
    .from('manuscript_files')
    .select('*')
    .eq('manuscript_id', invitation.manuscript_id)
    .in('file_type', ['blinded_manuscript', 'tables', 'figure', 'supplement'])
    .order('file_type', { ascending: true })
    .order('file_order', { ascending: true })

  const files = (fData as ManuscriptFileRow[] | null) || []

  // ---- Combined package status (Session 31, 2026-04-26) ----
  // If the package has been built for the current manuscript-version,
  // surface a one-click signed URL at the top of the page. We don't
  // trigger a build from this page — that only happens on reviewer
  // acceptance (acceptReviewInvitation). If the cache is empty here,
  // the reviewer either hasn't checked their email for the package
  // delivery yet OR the build is still in progress for the first
  // reviewer; in both cases we show a "preparing" notice.
  const { data: metaData } = await admin
    .from('manuscript_metadata')
    .select(
      'reviewer_package_storage_path, reviewer_package_built_at, reviewer_package_version'
    )
    .eq('manuscript_id', invitation.manuscript_id)
    .maybeSingle()
  const meta = (metaData as Pick<
    ManuscriptMetadataRow,
    | 'reviewer_package_storage_path'
    | 'reviewer_package_built_at'
    | 'reviewer_package_version'
  > | null) || null

  let packageDownloadUrl: string | null = null
  let packageSizeBytes: number | null = null
  if (meta?.reviewer_package_storage_path) {
    const { signedUrl } = await getReviewerPackageSignedUrl(
      invitation.manuscript_id,
      meta.reviewer_package_storage_path,
      30 * 60 // 30-minute signed URL on the per-page render
    )
    packageDownloadUrl = signedUrl
    // Best-effort size lookup for the label.
    try {
      const { data: blob } = await admin.storage
        .from('submissions')
        .download(meta.reviewer_package_storage_path)
      if (blob) packageSizeBytes = (await blob.arrayBuffer()).byteLength
    } catch {
      // size is optional; the download still works without it
    }
  }
  const packageInProgress = !meta?.reviewer_package_storage_path

  return (
    <div className="min-h-screen bg-white py-12 px-4">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="bg-white border border-border rounded-xl p-8 space-y-4">
          <p className="text-[11px] uppercase tracking-widest text-brown">
            OSCRSJ Editorial Office · Reviewer access
          </p>
          <h1 className="font-serif text-3xl text-brown-dark">
            {manuscript?.title || '(untitled manuscript)'}
          </h1>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-[11px] uppercase tracking-widest text-brown">
                Type
              </p>
              <p className="text-ink">
                {TYPE_LABELS[manuscript?.manuscript_type || ''] ||
                  manuscript?.manuscript_type ||
                  '—'}
              </p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-widest text-brown">
                Subspecialty
              </p>
              <p className="text-ink">{manuscript?.subspecialty || '—'}</p>
            </div>
          </div>
          {manuscript?.abstract && (
            <div>
              <p className="text-[11px] uppercase tracking-widest text-brown mb-1">
                Abstract
              </p>
              <p className="text-sm text-ink whitespace-pre-wrap leading-relaxed">
                {manuscript.abstract}
              </p>
            </div>
          )}
          <div className="border-t border-border pt-3 text-xs text-brown">
            Author names, affiliations, and acknowledgments have been removed
            from this view per double-blind policy. Identifying information
            is visible only to the editor.
          </div>
        </div>

        {packageDownloadUrl ? (
          <div className="bg-cream-alt border border-border rounded-xl p-8 space-y-4">
            <p className="text-[11px] uppercase tracking-widest text-brown">
              Combined manuscript package
            </p>
            <h2 className="font-serif text-xl text-brown-dark">
              One Word document, end-to-end
            </h2>
            <p className="text-sm text-ink leading-relaxed">
              The blinded manuscript, tables, and figures (one figure per page
              with its filename) are merged into a single .docx so you can read
              start to finish without juggling separate files. We&rsquo;ve also
              emailed it to you when you accepted the invitation.
            </p>
            <a
              href={packageDownloadUrl}
              className="inline-block bg-brown-dark text-peach px-5 py-3 rounded text-xs uppercase tracking-widest font-bold hover:bg-ink transition"
            >
              Download package{packageSizeBytes ? ` (${formatFileSize(packageSizeBytes)})` : ''}
            </a>
            <p className="text-xs text-brown">
              Link valid for 30 minutes. Refresh the page if it expires.
            </p>
          </div>
        ) : packageInProgress ? (
          <div className="bg-cream-alt border border-border rounded-xl p-8 space-y-3">
            <p className="text-[11px] uppercase tracking-widest text-brown">
              Combined manuscript package
            </p>
            <h2 className="font-serif text-xl text-brown-dark">
              Your package is being prepared
            </h2>
            <p className="text-sm text-ink leading-relaxed">
              We&rsquo;re assembling the blinded manuscript, tables, and figures
              into a single Word document and will email it to you shortly. In
              the meantime you can download the individual files below.
            </p>
          </div>
        ) : null}

        <div className="bg-white border border-border rounded-xl p-8 space-y-4">
          <h2 className="font-serif text-xl text-brown-dark">
            {packageDownloadUrl
              ? 'Individual files (fallback)'
              : 'Review files'}
          </h2>
          {files.length === 0 ? (
            <p className="text-sm text-brown">
              No blinded manuscript, figures, or supplements have been posted
              for this invitation. Please contact the editorial office.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {files.map((file) => (
                <li
                  key={file.id}
                  className="flex items-center justify-between gap-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm text-ink truncate">
                      {file.original_filename || file.file_name}
                    </p>
                    <p className="text-xs text-brown">
                      {FILE_TYPE_LABELS[file.file_type] || file.file_type} ·{' '}
                      {formatFileSize(file.file_size_bytes)}
                    </p>
                  </div>
                  <ReviewerFileDownloadButton
                    token={params.token}
                    fileId={file.id}
                  />
                </li>
              ))}
            </ul>
          )}
          <p className="text-xs text-brown pt-2 border-t border-border">
            Download links expire after 30 minutes. Click again from this
            page if a link stops working.
          </p>
        </div>

        <p className="text-sm text-brown text-center">
          Ready to submit your review?{' '}
          <Link
            href={`/review/${params.token}/form`}
            className="underline hover:text-ink"
          >
            Open the structured review form.
          </Link>
        </p>
      </div>
    </div>
  )
}

function StaticMessage({
  heading,
  body,
  linkHref,
  linkLabel,
}: {
  heading: string
  body: string
  linkHref?: string
  linkLabel?: string
}) {
  return (
    <div className="min-h-screen bg-white py-12 px-4">
      <div className="max-w-xl mx-auto bg-white border border-border rounded-xl p-8 space-y-4">
        <p className="text-[11px] uppercase tracking-widest text-brown">
          OSCRSJ Editorial Office
        </p>
        <h1 className="font-serif text-2xl text-brown-dark">{heading}</h1>
        <p className="text-sm text-ink leading-relaxed">{body}</p>
        {linkHref && linkLabel && (
          <Link
            href={linkHref}
            className="inline-block text-sm text-brown underline hover:text-ink"
          >
            {linkLabel}
          </Link>
        )}
        <p className="text-xs text-brown pt-4 border-t border-border">
          Questions? Reply to the original invitation email.
        </p>
      </div>
    </div>
  )
}
