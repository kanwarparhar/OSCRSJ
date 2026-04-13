import { createClient } from '@supabase/supabase-js'
import type {
  ManuscriptInsert,
  ManuscriptStatus,
  ManuscriptWithDetails,
  ManuscriptRow,
  ManuscriptAuthorRow,
  ManuscriptFileRow,
  ManuscriptMetadataRow,
} from '@/lib/types/database'

/**
 * Creates an untyped admin client for use in db helper functions.
 * Uses the service role key to bypass RLS.
 * We intentionally skip the Database generic here because these helpers
 * cast results to our own types. The typed client (in server.ts) is for
 * user-facing queries that go through RLS.
 */
function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
}

/**
 * Calls the database function to generate the next sequential submission ID.
 * Format: OSCRSJ-YYYY-NNNN
 */
export async function generateSubmissionId(): Promise<string> {
  const supabase = getAdminClient()
  const { data, error } = await supabase.rpc('generate_submission_id')

  if (error) {
    throw new Error(`Failed to generate submission ID: ${error.message}`)
  }

  return data as string
}

/**
 * Fetches a manuscript with its authors, files, and metadata.
 */
export async function getManuscriptWithDetails(
  manuscriptId: string
): Promise<ManuscriptWithDetails | null> {
  const supabase = getAdminClient()

  const { data: manuscript, error: msError } = await supabase
    .from('manuscripts')
    .select('*')
    .eq('id', manuscriptId)
    .single()

  if (msError || !manuscript) {
    return null
  }

  const ms = manuscript as ManuscriptRow

  // Fetch related data in parallel
  const [authorsResult, filesResult, metadataResult] = await Promise.all([
    supabase
      .from('manuscript_authors')
      .select('*')
      .eq('manuscript_id', manuscriptId)
      .order('author_order', { ascending: true }),
    supabase
      .from('manuscript_files')
      .select('*')
      .eq('manuscript_id', manuscriptId)
      .order('file_order', { ascending: true }),
    supabase
      .from('manuscript_metadata')
      .select('*')
      .eq('manuscript_id', manuscriptId)
      .single(),
  ])

  return {
    ...ms,
    authors: (authorsResult.data ?? []) as ManuscriptAuthorRow[],
    files: (filesResult.data ?? []) as ManuscriptFileRow[],
    metadata: (metadataResult.data as ManuscriptMetadataRow) ?? null,
  }
}

/**
 * Fetches all manuscripts for a given author (as corresponding author
 * or listed co-author). Returns manuscripts ordered by creation date.
 */
export async function getUserManuscripts(
  userId: string
): Promise<ManuscriptRow[]> {
  const supabase = getAdminClient()

  // Get manuscripts where user is corresponding author
  const { data: ownData } = await supabase
    .from('manuscripts')
    .select('*')
    .eq('corresponding_author_id', userId)
    .order('created_at', { ascending: false })

  const ownManuscripts = (ownData ?? []) as ManuscriptRow[]

  // Get manuscript IDs where user is a co-author
  const { data: coAuthorData } = await supabase
    .from('manuscript_authors')
    .select('manuscript_id')
    .eq('author_id', userId)

  const links = (coAuthorData ?? []) as Array<{ manuscript_id: string }>
  const coAuthorManuscriptIds = links
    .map((link) => link.manuscript_id)
    .filter((id) => !ownManuscripts.some((m) => m.id === id))

  let coAuthoredManuscripts: ManuscriptRow[] = []
  if (coAuthorManuscriptIds.length > 0) {
    const { data } = await supabase
      .from('manuscripts')
      .select('*')
      .in('id', coAuthorManuscriptIds)
      .order('created_at', { ascending: false })

    coAuthoredManuscripts = (data ?? []) as ManuscriptRow[]
  }

  // Merge and sort by created_at descending
  const all = [...ownManuscripts, ...coAuthoredManuscripts]
  all.sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )

  return all
}

/**
 * Creates a new manuscript draft. Sets status to 'draft' and assigns
 * the corresponding author.
 */
export async function createManuscript(
  data: ManuscriptInsert
): Promise<ManuscriptRow> {
  const supabase = getAdminClient()

  const { data: manuscript, error } = await supabase
    .from('manuscripts')
    .insert({
      ...data,
      status: 'draft' as const,
    })
    .select()
    .single()

  if (error || !manuscript) {
    throw new Error(`Failed to create manuscript: ${error?.message}`)
  }

  return manuscript as ManuscriptRow
}

/**
 * Updates a manuscript's status and logs the change to audit_logs.
 */
export async function updateManuscriptStatus(
  manuscriptId: string,
  newStatus: ManuscriptStatus,
  userId?: string,
  ipAddress?: string
): Promise<void> {
  const supabase = getAdminClient()

  const { error: updateError } = await supabase
    .from('manuscripts')
    .update({ status: newStatus })
    .eq('id', manuscriptId)

  if (updateError) {
    throw new Error(`Failed to update manuscript status: ${updateError.message}`)
  }

  // Log the status change
  await supabase.from('audit_logs').insert({
    user_id: userId ?? null,
    action: `status_changed_to_${newStatus}`,
    resource_type: 'manuscript',
    resource_id: manuscriptId,
    ip_address: ipAddress ?? null,
  })
}
