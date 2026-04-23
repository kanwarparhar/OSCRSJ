import type { Metadata } from 'next'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { ManuscriptRow, ManuscriptMetadataRow, ManuscriptFileRow, ManuscriptAuthorRow, UserRow } from '@/lib/types/database'
import { loadRevisionContext } from '@/lib/submission/actions'
import SubmissionWizard from './SubmissionWizard'

export const metadata: Metadata = { title: 'New Submission — OSCRSJ' }

export default async function SubmitPage({
  searchParams,
}: {
  searchParams?: { revising?: string }
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    const redirectTarget = searchParams?.revising
      ? `/dashboard/submit?revising=${encodeURIComponent(searchParams.revising)}`
      : '/dashboard/submit'
    redirect(`/login?redirect=${encodeURIComponent(redirectTarget)}`)
  }

  // Load user profile for pre-filling corresponding author
  const { data: profileData } = await supabase
    .from('users')
    .select('full_name, email, affiliation, orcid_id, degrees')
    .eq('id', user.id)
    .single()

  const userProfile = profileData as Pick<UserRow, 'full_name' | 'email' | 'affiliation' | 'orcid_id' | 'degrees'> | null

  // ---- Revising mode ----
  // When /dashboard/submit?revising={id} is present, load the
  // original manuscript + latest editorial decision + anonymised
  // reviews and render the wizard in revision mode. Authors are
  // always the manuscript owners because loadRevisionContext gates
  // on corresponding_author_id = auth.uid() server-side.
  const revisingId = searchParams?.revising
  if (revisingId) {
    const ctx = await loadRevisionContext(revisingId)
    if ('error' in ctx) {
      return (
        <div className="max-w-xl bg-white border border-border rounded-xl p-6 space-y-3">
          <h1 className="font-serif text-2xl text-brown-dark">
            Can&rsquo;t open this revision
          </h1>
          <p className="text-sm text-ink">{ctx.error}</p>
          <Link
            href="/dashboard"
            className="text-sm text-brown underline underline-offset-2 hover:text-ink"
          >
            Return to dashboard
          </Link>
        </div>
      )
    }

    return (
      <SubmissionWizard
        draft={{
          manuscript: ctx.manuscript,
          metadata: ctx.metadata,
          files: ctx.files,
          authors: ctx.authors,
        }}
        userProfile={userProfile}
        revisionContext={{
          revisionNumber: ctx.revisionNumber,
          decisionLetter: ctx.decisionLetter,
          decisionType: ctx.decisionType,
          decisionDate: ctx.decisionDate,
          revisionDeadline: ctx.revisionDeadline,
          reviews: ctx.reviews,
        }}
      />
    )
  }

  // Load existing draft (most recent)
  let manuscript: ManuscriptRow | null = null
  let metadata: ManuscriptMetadataRow | null = null
  let files: ManuscriptFileRow[] = []
  let authors: ManuscriptAuthorRow[] = []

  const { data: manuscripts } = await supabase
    .from('manuscripts')
    .select('*')
    .eq('corresponding_author_id', user.id)
    .eq('status', 'draft')
    .order('created_at', { ascending: false })
    .limit(1)

  const rows = manuscripts as ManuscriptRow[] | null
  if (rows && rows.length > 0) {
    manuscript = rows[0]

    // Load metadata
    const { data: metaData } = await supabase
      .from('manuscript_metadata')
      .select('*')
      .eq('manuscript_id', manuscript.id)
      .single()
    metadata = metaData as ManuscriptMetadataRow | null

    // Load files
    const { data: fileData } = await supabase
      .from('manuscript_files')
      .select('*')
      .eq('manuscript_id', manuscript.id)
      .order('file_order', { ascending: true })
    files = (fileData as ManuscriptFileRow[] | null) || []

    // Load authors
    const { data: authorData } = await supabase
      .from('manuscript_authors')
      .select('*')
      .eq('manuscript_id', manuscript.id)
      .order('author_order', { ascending: true })
    authors = (authorData as ManuscriptAuthorRow[] | null) || []
  }

  return (
    <SubmissionWizard
      draft={{ manuscript, metadata, files, authors }}
      userProfile={userProfile}
    />
  )
}
