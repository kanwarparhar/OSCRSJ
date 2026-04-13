'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import type {
  ManuscriptRow,
  ManuscriptType,
  ManuscriptMetadataRow,
  ManuscriptFileRow,
  ManuscriptAuthorRow,
} from '@/lib/types/database'

// ---- Types for wizard state ----

export interface DraftData {
  manuscript: ManuscriptRow | null
  metadata: ManuscriptMetadataRow | null
  files: ManuscriptFileRow[]
  authors: ManuscriptAuthorRow[]
}

// ---- Create or update draft manuscript ----

export async function createOrUpdateDraft(params: {
  manuscriptId?: string | null
  manuscriptType: ManuscriptType
  notUnderReview: boolean
  notPreviouslyPublished: boolean
  allAuthorsAgreed: boolean
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { manuscriptId, manuscriptType, notUnderReview, notPreviouslyPublished, allAuthorsAgreed } = params

  if (manuscriptId) {
    // Update existing draft
    const { error } = await (supabase.from('manuscripts') as any)
      .update({ manuscript_type: manuscriptType })
      .eq('id', manuscriptId)
      .eq('corresponding_author_id', user.id)

    if (error) return { error: 'Failed to update draft' }

    // Upsert metadata
    const { data: existingMeta } = await supabase
      .from('manuscript_metadata')
      .select('id')
      .eq('manuscript_id', manuscriptId)
      .single()

    if (existingMeta) {
      await (supabase.from('manuscript_metadata') as any)
        .update({
          not_under_review_elsewhere: notUnderReview,
          not_previously_published: notPreviouslyPublished,
          all_authors_agreed: allAuthorsAgreed,
        })
        .eq('manuscript_id', manuscriptId)
    } else {
      await (supabase.from('manuscript_metadata') as any)
        .insert({
          manuscript_id: manuscriptId,
          not_under_review_elsewhere: notUnderReview,
          not_previously_published: notPreviouslyPublished,
          all_authors_agreed: allAuthorsAgreed,
        })
    }

    return { manuscriptId }
  }

  // Create new draft
  const { data, error } = await (supabase.from('manuscripts') as any)
    .insert({
      corresponding_author_id: user.id,
      manuscript_type: manuscriptType,
      status: 'draft',
    })
    .select('id, submission_id')
    .single()

  if (error || !data) return { error: 'Failed to create draft' }

  const row = data as { id: string; submission_id: string }

  // Create metadata row
  await (supabase.from('manuscript_metadata') as any)
    .insert({
      manuscript_id: row.id,
      not_under_review_elsewhere: notUnderReview,
      not_previously_published: notPreviouslyPublished,
      all_authors_agreed: allAuthorsAgreed,
    })

  return { manuscriptId: row.id, submissionId: row.submission_id }
}

// ---- Save Step 3 data ----

export async function saveManuscriptInfo(params: {
  manuscriptId: string
  title: string
  abstract: string
  keywords: string[]
  subspecialty: string
  suggestedReviewers?: { name: string; email: string; expertise: string }[]
  nonPreferredReviewers?: { name: string; reason: string }[]
  noteToEditor?: string
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { manuscriptId, title, abstract, keywords, subspecialty, noteToEditor } = params

  const { error } = await (supabase.from('manuscripts') as any)
    .update({
      title,
      abstract,
      keywords,
      subspecialty,
      note_to_editor: noteToEditor || null,
    })
    .eq('id', manuscriptId)
    .eq('corresponding_author_id', user.id)

  if (error) return { error: 'Failed to save manuscript info' }

  return { success: true }
}

// ---- Load existing draft ----

export async function loadDraft(): Promise<DraftData> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { manuscript: null, metadata: null, files: [], authors: [] }

  // Find the most recent draft
  const { data: manuscripts } = await supabase
    .from('manuscripts')
    .select('*')
    .eq('corresponding_author_id', user.id)
    .eq('status', 'draft')
    .order('created_at', { ascending: false })
    .limit(1)

  const rows = manuscripts as ManuscriptRow[] | null
  if (!rows || rows.length === 0) {
    return { manuscript: null, metadata: null, files: [], authors: [] }
  }

  const manuscript = rows[0]

  // Load metadata
  const { data: metaData } = await supabase
    .from('manuscript_metadata')
    .select('*')
    .eq('manuscript_id', manuscript.id)
    .single()

  const metadata = metaData as ManuscriptMetadataRow | null

  // Load files
  const { data: fileData } = await supabase
    .from('manuscript_files')
    .select('*')
    .eq('manuscript_id', manuscript.id)
    .order('file_order', { ascending: true })

  const files = (fileData as ManuscriptFileRow[] | null) || []

  // Load authors
  const { data: authorData } = await supabase
    .from('manuscript_authors')
    .select('*')
    .eq('manuscript_id', manuscript.id)
    .order('author_order', { ascending: true })

  const authors = (authorData as ManuscriptAuthorRow[] | null) || []

  return { manuscript, metadata, files, authors }
}

// ---- Record a file in the database ----

export async function recordFile(params: {
  manuscriptId: string
  originalFilename: string
  fileName: string
  fileType: string
  storagePath: string
  fileSizeBytes: number
  fileOrder: number
  version: number
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { manuscriptId, originalFilename, fileName, fileType, storagePath, fileSizeBytes, fileOrder, version } = params

  const { data, error } = await (supabase.from('manuscript_files') as any)
    .insert({
      manuscript_id: manuscriptId,
      original_filename: originalFilename,
      file_name: fileName,
      file_type: fileType,
      storage_path: storagePath,
      file_size_bytes: fileSizeBytes,
      file_order: fileOrder,
      version,
    })
    .select('*')
    .single()

  if (error) return { error: 'Failed to record file' }

  return { file: data as ManuscriptFileRow }
}

// ---- Delete a file record and its storage object ----

export async function deleteFile(fileId: string, storagePath: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  // Delete from storage
  await supabase.storage.from('submissions').remove([storagePath])

  // Delete the DB record
  const { error } = await (supabase.from('manuscript_files') as any)
    .delete()
    .eq('id', fileId)

  if (error) return { error: 'Failed to delete file record' }

  return { success: true }
}

// ---- Get a signed download URL ----

export async function getFileDownloadUrl(storagePath: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data, error } = await supabase.storage
    .from('submissions')
    .createSignedUrl(storagePath, 60)

  if (error || !data) return { error: 'Failed to generate download URL' }

  return { url: data.signedUrl }
}

// ---- Save authors (Step 4) ----

export async function saveAuthors(params: {
  manuscriptId: string
  authors: {
    full_name: string
    email: string
    affiliation: string
    orcid_id: string
    degrees: string
    contribution: string
    is_corresponding: boolean
    author_order: number
  }[]
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { manuscriptId, authors } = params

  // Delete all existing authors for this manuscript
  await (supabase.from('manuscript_authors') as any)
    .delete()
    .eq('manuscript_id', manuscriptId)

  // Insert new author list
  if (authors.length > 0) {
    const rows = authors.map(a => ({
      manuscript_id: manuscriptId,
      full_name: a.full_name,
      email: a.email,
      affiliation: a.affiliation || null,
      orcid_id: a.orcid_id || null,
      degrees: a.degrees || null,
      contribution: a.contribution || null,
      is_corresponding: a.is_corresponding,
      author_order: a.author_order,
      author_id: a.is_corresponding ? user.id : null,
    }))

    const { error } = await (supabase.from('manuscript_authors') as any)
      .insert(rows)

    if (error) return { error: 'Failed to save authors' }
  }

  return { success: true }
}

// ---- Save declarations (Step 5) ----

export async function saveDeclarations(params: {
  manuscriptId: string
  conflictOfInterest: string | null
  fundingSources: string[]
  dataAvailabilityStatement: string | null
  ethicsApprovalNumber: string | null
  clinicalTrialId: string | null
  authorConsentCertified: boolean
  noteToEditor: string | null
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const {
    manuscriptId,
    conflictOfInterest,
    fundingSources,
    dataAvailabilityStatement,
    ethicsApprovalNumber,
    clinicalTrialId,
    authorConsentCertified,
    noteToEditor,
  } = params

  // Upsert manuscript_metadata
  const { data: existingMeta } = await supabase
    .from('manuscript_metadata')
    .select('id')
    .eq('manuscript_id', manuscriptId)
    .single()

  const metaFields = {
    conflict_of_interest: conflictOfInterest,
    funding_sources: fundingSources.length > 0 ? fundingSources : null,
    data_availability_statement: dataAvailabilityStatement,
    ethics_approval_number: ethicsApprovalNumber,
    clinical_trial_id: clinicalTrialId,
    author_consent_certified: authorConsentCertified,
  }

  if (existingMeta) {
    await (supabase.from('manuscript_metadata') as any)
      .update(metaFields)
      .eq('manuscript_id', manuscriptId)
  } else {
    await (supabase.from('manuscript_metadata') as any)
      .insert({ manuscript_id: manuscriptId, ...metaFields })
  }

  // Update note_to_editor on the manuscripts table
  await (supabase.from('manuscripts') as any)
    .update({ note_to_editor: noteToEditor || null })
    .eq('id', manuscriptId)
    .eq('corresponding_author_id', user.id)

  return { success: true }
}

// ---- Submit manuscript ----

export async function submitManuscript(manuscriptId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  // Load manuscript
  const { data: manuscript } = await supabase
    .from('manuscripts')
    .select('*')
    .eq('id', manuscriptId)
    .eq('corresponding_author_id', user.id)
    .single()

  const m = manuscript as ManuscriptRow | null
  if (!m) return { error: 'Manuscript not found' }
  if (m.status !== 'draft') return { error: 'Only drafts can be submitted' }

  // Validate required fields
  if (!m.manuscript_type) return { error: 'Manuscript type is required' }
  if (!m.title) return { error: 'Title is required' }
  if (!m.abstract) return { error: 'Abstract is required' }
  if (!m.keywords || m.keywords.length < 3) return { error: 'At least 3 keywords are required' }
  if (!m.subspecialty) return { error: 'Subspecialty is required' }

  // Check files
  const { data: fileData } = await supabase
    .from('manuscript_files')
    .select('file_type')
    .eq('manuscript_id', manuscriptId)

  const fileTypes = (fileData as { file_type: string }[] | null) || []
  if (!fileTypes.some(f => f.file_type === 'manuscript')) return { error: 'Main manuscript file is required' }
  if (!fileTypes.some(f => f.file_type === 'blinded_manuscript')) return { error: 'Blinded manuscript file is required' }

  // Check authors
  const { data: authorData } = await supabase
    .from('manuscript_authors')
    .select('id')
    .eq('manuscript_id', manuscriptId)

  if (!authorData || authorData.length === 0) return { error: 'At least one author is required' }

  // Check metadata
  const { data: metaData } = await supabase
    .from('manuscript_metadata')
    .select('*')
    .eq('manuscript_id', manuscriptId)
    .single()

  const meta = metaData as ManuscriptMetadataRow | null
  if (!meta) return { error: 'Declarations are required' }
  if (!meta.author_consent_certified) return { error: 'Author certification is required' }

  // All validations passed — update status
  const { error } = await (supabase.from('manuscripts') as any)
    .update({
      status: 'submitted',
      submission_date: new Date().toISOString(),
    })
    .eq('id', manuscriptId)
    .eq('corresponding_author_id', user.id)

  if (error) return { error: 'Failed to submit manuscript' }

  return { success: true, submissionId: m.submission_id }
}
