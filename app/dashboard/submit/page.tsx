import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { ManuscriptRow, ManuscriptMetadataRow, ManuscriptFileRow } from '@/lib/types/database'
import SubmissionWizard from './SubmissionWizard'

export const metadata: Metadata = { title: 'New Submission — OSCRSJ' }

export default async function SubmitPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?redirect=/dashboard/submit')
  }

  // Load existing draft (most recent)
  let manuscript: ManuscriptRow | null = null
  let metadata: ManuscriptMetadataRow | null = null
  let files: ManuscriptFileRow[] = []

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
  }

  return (
    <SubmissionWizard
      draft={{ manuscript, metadata, files }}
    />
  )
}
