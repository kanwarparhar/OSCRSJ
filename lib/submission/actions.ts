'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import type {
  ManuscriptRow,
  ManuscriptType,
  ManuscriptStatus,
  ManuscriptMetadataRow,
  ManuscriptFileRow,
  ManuscriptAuthorRow,
  UserRow,
  PreRevisionSnapshot,
} from '@/lib/types/database'
import { sendEmail } from '@/lib/email/resend'
import {
  renderSubmissionConfirmation,
  getSubmissionConfirmationSubject,
} from '@/lib/email/templates/submissionConfirmation'
import {
  renderCoAuthorNotification,
  getCoAuthorNotificationSubject,
} from '@/lib/email/templates/coAuthorNotification'
import {
  renderWithdrawalConfirmation,
  getWithdrawalSubject,
  type WithdrawalRecipientRole,
} from '@/lib/email/templates/withdrawalConfirmation'
import {
  renderRevisionReceivedAuthor,
  getRevisionReceivedAuthorSubject,
} from '@/lib/email/templates/revisionReceivedAuthor'
import {
  renderRevisionReceivedEditor,
  getRevisionReceivedEditorSubject,
} from '@/lib/email/templates/revisionReceivedEditor'
import {
  generateDisputeToken,
  buildDisputeUrl,
} from '@/lib/email/disputeTokens'

// Editorial inbox for system alerts. Routed to the journal's primary
// Gmail (`oscrsjournal@gmail.com`) until a proper editorial mailbox is
// provisioned (see commit f93bf5b — GoDaddy removed free forwarding for
// admin@oscrsj.com).
const EDITORIAL_NOTIFY_EMAIL = 'oscrsjournal@gmail.com'

// Statuses that allow author self-service withdrawal. Anything past
// an editorial decision (accepted, rejected, published, etc.) cannot
// be withdrawn by the author.
const WITHDRAWABLE_STATUSES = new Set<ManuscriptStatus>([
  'draft',
  'submitted',
  'under_review',
  'revision_requested',
  'revision_received',
])

// ---- Types for wizard state ----

export interface DraftData {
  manuscript: ManuscriptRow | null
  metadata: ManuscriptMetadataRow | null
  files: ManuscriptFileRow[]
  authors: ManuscriptAuthorRow[]
}

// ---- Create or update draft manuscript ----

// Ensures a row exists in public.users for the given auth user. Older
// signups (and any future signup where the admin-client profile insert
// silently fails) can end up with an auth.users row but no public.users
// row — which breaks every downstream insert that foreign-keys to
// users.id (manuscripts.corresponding_author_id, manuscript_authors,
// etc.). This backfill runs idempotently from signed-in server actions.
async function ensureUserProfile(userId: string): Promise<{ error?: string }> {
  const admin = createAdminClient()

  // Fast path: profile already exists.
  const { data: existing } = await admin
    .from('users')
    .select('id')
    .eq('id', userId)
    .maybeSingle()

  if (existing) return {}

  // Pull whatever metadata Supabase Auth has on record (full name,
  // affiliation, country, etc. are all stored in raw_user_meta_data
  // by the signUp action).
  const { data: authData, error: authErr } = await admin.auth.admin.getUserById(userId)
  if (authErr || !authData?.user) {
    return { error: `Could not load auth user: ${authErr?.message || 'unknown'}` }
  }

  const authUser = authData.user
  const meta = (authUser.user_metadata || {}) as Record<string, unknown>

  const fullName = (meta.full_name as string) || authUser.email?.split('@')[0] || 'Author'
  const affiliation = (meta.affiliation as string) || null
  const country = (meta.country as string) || null
  const degrees = (meta.degrees as string) || null
  const orcidId = (meta.orcid_id as string) || null

  const { error: insertErr } = await (admin.from('users') as any).insert({
    id: userId,
    email: authUser.email,
    full_name: fullName,
    affiliation,
    country,
    degrees,
    orcid_id: orcidId,
    role: 'author',
  })

  if (insertErr && !insertErr.message.includes('duplicate')) {
    return { error: `Failed to create user profile: ${insertErr.message}` }
  }

  return {}
}

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

  // Backfill the profile row if it's missing. Without this, the
  // manuscripts insert below will fail with a FK violation on
  // corresponding_author_id -> users(id).
  const profileResult = await ensureUserProfile(user.id)
  if (profileResult.error) return { error: profileResult.error }

  const { manuscriptId, manuscriptType, notUnderReview, notPreviouslyPublished, allAuthorsAgreed } = params

  // Use the admin client for writes. The RLS INSERT policy
  // "Authors can create manuscripts" (WITH CHECK corresponding_author_id
  // = auth.uid()) has been observed to reject valid inserts in the live
  // DB even when auth.uid() resolves correctly (SELECT/UPDATE pass, only
  // INSERT fails — policy likely missing/altered in prod). Since this
  // server action already authenticates the caller via auth.getUser()
  // above and always stamps corresponding_author_id = user.id, the admin
  // client is the safe path: we never trust an attacker-supplied id.
  // See migration 005 for the DB-side policy restoration.
  const admin = createAdminClient()

  if (manuscriptId) {
    // Update existing draft — scope update to rows the user owns so the
    // admin client can't be coerced into touching someone else's row.
    const { error } = await (admin.from('manuscripts') as any)
      .update({ manuscript_type: manuscriptType })
      .eq('id', manuscriptId)
      .eq('corresponding_author_id', user.id)

    if (error) return { error: `Failed to update draft: ${error.message}` }

    // Upsert metadata
    const { data: existingMeta } = await admin
      .from('manuscript_metadata')
      .select('id')
      .eq('manuscript_id', manuscriptId)
      .single()

    if (existingMeta) {
      await (admin.from('manuscript_metadata') as any)
        .update({
          not_under_review_elsewhere: notUnderReview,
          not_previously_published: notPreviouslyPublished,
          all_authors_agreed: allAuthorsAgreed,
        })
        .eq('manuscript_id', manuscriptId)
    } else {
      await (admin.from('manuscript_metadata') as any)
        .insert({
          manuscript_id: manuscriptId,
          not_under_review_elsewhere: notUnderReview,
          not_previously_published: notPreviouslyPublished,
          all_authors_agreed: allAuthorsAgreed,
        })
    }

    return { manuscriptId }
  }

  // Create new draft — corresponding_author_id is pinned to the
  // authenticated user's id, never a client-supplied value.
  const { data, error } = await (admin.from('manuscripts') as any)
    .insert({
      corresponding_author_id: user.id,
      manuscript_type: manuscriptType,
      status: 'draft',
    })
    .select('id, submission_id')
    .single()

  if (error || !data) {
    return { error: `Failed to create draft: ${error?.message || 'no row returned'}` }
  }

  const row = data as { id: string; submission_id: string }

  // Create metadata row
  const { error: metaError } = await (admin.from('manuscript_metadata') as any)
    .insert({
      manuscript_id: row.id,
      not_under_review_elsewhere: notUnderReview,
      not_previously_published: notPreviouslyPublished,
      all_authors_agreed: allAuthorsAgreed,
    })

  if (metaError) {
    return { error: `Failed to save confirmations: ${metaError.message}` }
  }

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

  const {
    manuscriptId,
    title,
    abstract,
    keywords,
    subspecialty,
    suggestedReviewers,
    nonPreferredReviewers,
    noteToEditor,
  } = params

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

  // Persist suggested + non-preferred reviewer arrays into
  // manuscript_metadata. Until migration 016 these were collected
  // in the UI but silently dropped server-side. We use the admin
  // client because RLS for manuscript_metadata follows the same
  // ownership pattern as saveDeclarations and we already verified
  // ownership above via the manuscripts UPDATE returning no error.
  if (suggestedReviewers !== undefined || nonPreferredReviewers !== undefined) {
    const admin = createAdminClient()

    // Confirm ownership before admin-client write (the manuscripts
    // UPDATE above proves it but be explicit for the metadata path).
    const { data: ownsMs } = await supabase
      .from('manuscripts')
      .select('id')
      .eq('id', manuscriptId)
      .eq('corresponding_author_id', user.id)
      .maybeSingle()
    if (!ownsMs) return { error: 'Manuscript not found' }

    const reviewerFields: Record<string, unknown> = {}
    if (suggestedReviewers !== undefined) {
      // Drop fully-empty rows defensively — the UI also filters but
      // belt + suspenders for any draft state that snuck through.
      reviewerFields.suggested_reviewers = suggestedReviewers.filter(
        r => r.name.trim() || r.email.trim() || r.expertise.trim()
      )
    }
    if (nonPreferredReviewers !== undefined) {
      reviewerFields.non_preferred_reviewers = nonPreferredReviewers.filter(
        r => r.name.trim() || r.reason.trim()
      )
    }

    const { data: existingMeta } = await admin
      .from('manuscript_metadata')
      .select('id')
      .eq('manuscript_id', manuscriptId)
      .maybeSingle()

    if (existingMeta) {
      await (admin.from('manuscript_metadata') as any)
        .update(reviewerFields)
        .eq('manuscript_id', manuscriptId)
    } else {
      await (admin.from('manuscript_metadata') as any)
        .insert({ manuscript_id: manuscriptId, ...reviewerFields })
    }
  }

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

  // Confirm caller owns the manuscript before recording a file against
  // it. We do this ourselves (via the RLS-enforced read) rather than
  // relying on the INSERT policy so the admin-client write below is
  // still scoped to rows the user legitimately owns.
  const { data: ownsMs } = await supabase
    .from('manuscripts')
    .select('id')
    .eq('id', manuscriptId)
    .eq('corresponding_author_id', user.id)
    .maybeSingle()
  if (!ownsMs) return { error: 'Manuscript not found' }

  const admin = createAdminClient()

  const { data, error } = await (admin.from('manuscript_files') as any)
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

  if (error) {
    // The Storage write already succeeded on the client side. If the DB
    // insert fails (most commonly: a file_type enum value that isn't
    // present in the DB yet — e.g. title_page / tables before migration
    // 014 was run), clean up the orphaned Storage object so the user's
    // retry doesn't 409 with "The resource already exists" and so we
    // don't accumulate dead bytes on the bucket. Best-effort: a cleanup
    // failure is logged but not re-surfaced — the UI shows the original
    // DB error which is the actionable one.
    try {
      await admin.storage.from('submissions').remove([storagePath])
    } catch (cleanupErr) {
      console.error(
        '[recordFile] Storage cleanup after DB insert failure failed:',
        cleanupErr
      )
    }
    return { error: `Failed to record file: ${error.message}` }
  }

  return { file: data as ManuscriptFileRow }
}

// ---- Delete a file record and its storage object ----

export async function deleteFile(fileId: string, storagePath: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const admin = createAdminClient()

  // Look up the file via admin client (bypasses RLS) so we can
  // distinguish a row that genuinely no longer exists from a row
  // whose RLS read got blocked. Without this distinction, deleteFile
  // was returning "File not found" when an earlier call (e.g. an
  // accidental double-click on Remove, or a stale tile in the
  // wizard's client state) had already deleted the row — the early
  // return then prevented the client from removing the file from
  // state.files, leaving the tile visible, the slot marked as full
  // (max 1 for blinded_manuscript / title_page / etc.), and the
  // Upload button hidden behind the !isFull gate. The user couldn't
  // re-upload without a hard refresh. (Session 43, Kanwar bug report
  // 2026-05-04.)
  const { data: fileRow } = await admin
    .from('manuscript_files')
    .select('id, manuscript_id, storage_path')
    .eq('id', fileId)
    .maybeSingle()
  const file = fileRow as
    | { id: string; manuscript_id: string; storage_path: string }
    | null

  // Idempotent path: the row is genuinely gone, so the deletion is
  // already achieved. Best-effort: also clear the storage object the
  // caller passed in case it's still around (orphan from a prior
  // partial-failure upload). This can't accidentally clobber another
  // user's file because storage paths are UUID-namespaced
  // (manuscripts/{ms_id}/v{n}/...) and a caller would need to know
  // the exact path to abuse it.
  if (!file) {
    try {
      await admin.storage.from('submissions').remove([storagePath])
    } catch {
      // best-effort cleanup; deletion is already achieved
    }
    return { success: true }
  }

  // Row exists — ownership gate is mandatory. Use the admin client
  // here too so a stale cookie session in a server action can't
  // false-fail the gate on a legitimately-owned row.
  const { data: ownsMs } = await admin
    .from('manuscripts')
    .select('id')
    .eq('id', file.manuscript_id)
    .eq('corresponding_author_id', user.id)
    .maybeSingle()
  if (!ownsMs) return { error: 'Not authorized to delete this file' }

  // Use the row's own storage_path defensively in case the client
  // passed a stale value.
  await admin.storage.from('submissions').remove([file.storage_path])

  const { error } = await (admin.from('manuscript_files') as any)
    .delete()
    .eq('id', fileId)

  if (error) return { error: `Failed to delete file record: ${error.message}` }

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

// ---- Author-scoped signed download URL (by file id) ----

/**
 * Signed download URL for a file on a manuscript the caller participates in.
 *
 * Deliberately takes a FILE ID, not a storage path. The `submissions` bucket's
 * storage.objects policies gate only on `bucket_id = 'submissions'` for the
 * `authenticated` role (migration 015 + the original INSERT/SELECT/DELETE
 * policies), so any authenticated user can sign any path they can name. The
 * authorization that matters therefore has to happen on the ROW, not the path:
 * the lookup below runs through the caller's own RLS session, where
 * "Authors can read files on own manuscripts" (migration 002) resolves
 * `is_manuscript_participant(manuscript_id)`. A file belonging to someone
 * else's manuscript returns no row and this returns notFound.
 *
 * Only the final signing step uses the admin client, and only for a
 * storage_path already proven to belong to the caller — that's what lets us
 * attach the original filename to the download without widening access.
 */
export async function getAuthorFileSignedUrl(
  fileId: string
): Promise<{ signedUrl?: string; fileName?: string; error?: string }> {
  if (!fileId || typeof fileId !== 'string') {
    return { error: 'File id is required.' }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  // RLS-scoped read — this is the authorization check.
  const { data: fData, error: fErr } = await supabase
    .from('manuscript_files')
    .select('id, storage_path, original_filename, file_name')
    .eq('id', fileId)
    .maybeSingle()

  if (fErr || !fData) return { error: 'File not found.' }
  const file = fData as Pick<
    ManuscriptFileRow,
    'id' | 'storage_path' | 'original_filename' | 'file_name'
  >

  const admin = createAdminClient()
  const { data: signed, error: signErr } = await admin.storage
    .from('submissions')
    .createSignedUrl(file.storage_path, 60 * 5, {
      download: file.original_filename || file.file_name,
    })

  if (signErr || !signed) {
    return { error: 'Failed to generate download link.' }
  }

  return {
    signedUrl: signed.signedUrl,
    fileName: file.original_filename || file.file_name,
  }
}

/**
 * Author-facing signed URL for the reviewer-feedback document attached to an
 * editorial decision (persisted by submitEditorialDecision — the editor's
 * uploaded combined document or the auto-generated per-reviewer file).
 *
 * Authorization mirrors getAuthorFileSignedUrl: the decision row is read
 * through the caller's own RLS session, where "Authors can read decisions on
 * own manuscripts" (migration 002) resolves is_manuscript_participant. A
 * decision on someone else's manuscript returns no row and this returns an
 * error. Only the final signing step uses the admin client, and only for a
 * storage path already proven to belong to the caller.
 */
export async function getReviewerFeedbackSignedUrl(
  decisionId: string
): Promise<{ signedUrl?: string; fileName?: string; error?: string }> {
  if (!decisionId || typeof decisionId !== 'string') {
    return { error: 'Decision id is required.' }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  // RLS-scoped read — this is the authorization check.
  const { data: dData, error: dErr } = await supabase
    .from('editorial_decisions')
    .select('id, reviewer_feedback_path, reviewer_feedback_filename, rescinded_at')
    .eq('id', decisionId)
    .maybeSingle()

  if (dErr || !dData) return { error: 'Reviewer feedback not found.' }
  const decision = dData as {
    id: string
    reviewer_feedback_path: string | null
    reviewer_feedback_filename: string | null
    rescinded_at: string | null
  }

  if (decision.rescinded_at) {
    return { error: 'This decision has been withdrawn.' }
  }
  if (!decision.reviewer_feedback_path) {
    return { error: 'No reviewer feedback document is attached to this decision.' }
  }

  const downloadName =
    decision.reviewer_feedback_filename || 'reviewer-feedback.docx'

  const admin = createAdminClient()
  const { data: signed, error: signErr } = await admin.storage
    .from('submissions')
    .createSignedUrl(decision.reviewer_feedback_path, 60 * 5, {
      download: downloadName,
    })

  if (signErr || !signed) {
    return { error: 'Failed to generate download link.' }
  }

  return { signedUrl: signed.signedUrl, fileName: downloadName }
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

  // Confirm ownership via RLS-protected read before any writes.
  const { data: ownsMs } = await supabase
    .from('manuscripts')
    .select('id')
    .eq('id', manuscriptId)
    .eq('corresponding_author_id', user.id)
    .maybeSingle()
  if (!ownsMs) return { error: 'Manuscript not found' }

  const admin = createAdminClient()

  // Delete all existing authors for this manuscript
  await (admin.from('manuscript_authors') as any)
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

    const { error } = await (admin.from('manuscript_authors') as any)
      .insert(rows)

    if (error) return { error: `Failed to save authors: ${error.message}` }
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
  // null = author has not yet picked the AI disclosure radio. We
  // deliberately skip the ai_tools_used + ai_tools_details writes
  // when null so the column's NOT NULL DEFAULT false doesn't get
  // mistaken for an explicit "no" on subsequent draft loads.
  aiToolsUsed: boolean | null
  aiToolsDetails: string | null
  noteToEditor?: string | null
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
    aiToolsUsed,
    aiToolsDetails,
    noteToEditor,
  } = params

  // Confirm ownership via RLS-protected read before any writes.
  const { data: ownsMs } = await supabase
    .from('manuscripts')
    .select('id')
    .eq('id', manuscriptId)
    .eq('corresponding_author_id', user.id)
    .maybeSingle()
  if (!ownsMs) return { error: 'Manuscript not found' }

  const admin = createAdminClient()

  // Upsert manuscript_metadata
  const { data: existingMeta } = await admin
    .from('manuscript_metadata')
    .select('id')
    .eq('manuscript_id', manuscriptId)
    .single()

  const metaFields: Record<string, unknown> = {
    conflict_of_interest: conflictOfInterest,
    funding_sources: fundingSources.length > 0 ? fundingSources : null,
    data_availability_statement: dataAvailabilityStatement,
    ethics_approval_number: ethicsApprovalNumber,
    clinical_trial_id: clinicalTrialId,
    author_consent_certified: authorConsentCertified,
  }
  // Only persist AI disclosure when the author has explicitly
  // answered. Null means "not yet answered" — leave the column at
  // its current value (default false on a fresh row).
  if (aiToolsUsed !== null) {
    metaFields.ai_tools_used = aiToolsUsed
    metaFields.ai_tools_details = aiToolsUsed ? aiToolsDetails : null
  }

  if (existingMeta) {
    await (admin.from('manuscript_metadata') as any)
      .update(metaFields)
      .eq('manuscript_id', manuscriptId)
  } else {
    await (admin.from('manuscript_metadata') as any)
      .insert({ manuscript_id: manuscriptId, ...metaFields })
  }

  // Update note_to_editor on the manuscripts table only when the
  // caller supplied it. In revising mode the wizard omits this
  // field so the original submission's note_to_editor stays intact
  // and the revision's note is written separately to
  // manuscript_revisions.note_to_editor via submitRevision.
  if (noteToEditor !== undefined) {
    await (admin.from('manuscripts') as any)
      .update({ note_to_editor: noteToEditor || null })
      .eq('id', manuscriptId)
      .eq('corresponding_author_id', user.id)
  }

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
  if (!fileTypes.some(f => f.file_type === 'blinded_manuscript')) return { error: 'Blinded manuscript file is required' }
  // Reporting-checklist server gates (Session 78, 2026-06-10) \u2014 the
  // Step 2 wizard renders these as required slots, but client gates are
  // bypassable; the site states both as mandatory, so enforce here too.
  if (m.manuscript_type === 'narrative_review' && !fileTypes.some(f => f.file_type === 'sanra_self_rating')) {
    return { error: 'SANRA Self-Rating is required for Narrative Review submissions. Upload it in Step 2 before submitting.' }
  }
  if (m.manuscript_type === 'review_article' && !fileTypes.some(f => f.file_type === 'prisma_checklist')) {
    return { error: 'A completed PRISMA 2020 checklist is required for Systematic Review & Meta-Analysis submissions. Upload it in Step 2 before submitting.' }
  }
  // CARE + JBI server gates (Session 80, 2026-06-10) — closes the Session 43
  // client-only gap: these two were enforced in the wizard since migration 019
  // but never server-side, so a crafted request could bypass them.
  if (m.manuscript_type === 'case_report' && !fileTypes.some(f => f.file_type === 'care_checklist')) {
    return { error: 'A completed CARE checklist is required for Case Report submissions. Upload it in Step 2 before submitting.' }
  }
  if (m.manuscript_type === 'case_series' && !fileTypes.some(f => f.file_type === 'jbi_case_series_checklist')) {
    return { error: 'A completed JBI Case Series checklist is required for Case Series submissions. Upload it in Step 2 before submitting.' }
  }

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

  // ---- Fire transactional emails ----
  // Critical: anything below this line is best-effort. The submission
  // is already committed to the database; an email failure must not
  // surface as a submission failure to the user. All errors are
  // collected into emailWarnings for the UI to surface non-blockingly.
  const emailWarnings: string[] = []

  try {
    // Load the full author list (server actions run as the user; RLS
    // already lets the corresponding author read their own authors).
    const { data: authorsList } = await supabase
      .from('manuscript_authors')
      .select('*')
      .eq('manuscript_id', manuscriptId)
      .order('author_order', { ascending: true })

    const allAuthors = (authorsList as ManuscriptAuthorRow[] | null) || []

    // Load corresponding author profile for the salutation
    const { data: profileData } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single()
    const profile = profileData as UserRow | null

    const correspondingAuthor =
      allAuthors.find((a) => a.is_corresponding) ||
      allAuthors.find((a) => a.author_id === user.id) ||
      null

    const correspondingName =
      correspondingAuthor?.full_name ||
      profile?.full_name ||
      'Author'
    const correspondingEmail =
      correspondingAuthor?.email || profile?.email || user.email || null

    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      'https://www.oscrsj.com'

    // 1. Submission confirmation to corresponding author
    if (correspondingEmail) {
      const { html, text } = renderSubmissionConfirmation({
        authorName: correspondingName,
        submissionId: m.submission_id,
        title: m.title || '(untitled)',
        manuscriptType: m.manuscript_type!,
        dashboardUrl: `${siteUrl.replace(/\/$/, '')}/dashboard`,
      })
      const result = await sendEmail({
        to: correspondingEmail,
        subject: getSubmissionConfirmationSubject(m.submission_id),
        html,
        text,
        emailType: 'submission_confirmation',
        manuscriptId,
      })
      if (result.error) {
        emailWarnings.push(
          `Confirmation email to ${correspondingEmail} failed: ${result.error}`
        )
      }
    } else {
      emailWarnings.push(
        'No email address available for the corresponding author'
      )
    }

    // 2. Co-author notifications (everyone except corresponding author)
    const coAuthors = allAuthors.filter(
      (a) => !a.is_corresponding && a.email
    )
    for (const coAuthor of coAuthors) {
      try {
        const token = await generateDisputeToken(manuscriptId, coAuthor.email)
        const disputeUrl = buildDisputeUrl(manuscriptId, token, siteUrl)
        const { html, text } = renderCoAuthorNotification({
          coAuthorName: coAuthor.full_name || 'Co-author',
          correspondingAuthorName: correspondingName,
          submissionId: m.submission_id,
          title: m.title || '(untitled)',
          disputeUrl,
        })
        const result = await sendEmail({
          to: coAuthor.email,
          subject: getCoAuthorNotificationSubject(m.submission_id),
          html,
          text,
          emailType: 'co_author_notification',
          manuscriptId,
        })
        if (result.error) {
          emailWarnings.push(
            `Co-author email to ${coAuthor.email} failed: ${result.error}`
          )
        }
      } catch (err) {
        emailWarnings.push(
          `Co-author email to ${coAuthor.email} threw: ${err instanceof Error ? err.message : 'unknown error'}`
        )
      }
    }
  } catch (err) {
    emailWarnings.push(
      `Email pipeline error: ${err instanceof Error ? err.message : 'unknown error'}`
    )
  }

  return {
    success: true,
    submissionId: m.submission_id,
    ...(emailWarnings.length > 0 ? { emailWarnings } : {}),
  }
}

// ---- Withdraw manuscript ----
//
// Author self-service withdrawal for pre-decision manuscripts. Flips
// status to 'withdrawn', records the optional reason + timestamp,
// cancels any active reviewer invitations, and fires three classes of
// email (author confirmation, editorial alert, reviewer notices). All
// email sends are fire-and-forget: a mail failure must not roll back
// the withdrawal.

export async function withdrawManuscript(params: {
  manuscriptId: string
  reason?: string | null
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { manuscriptId, reason } = params

  // Load manuscript + confirm caller owns it.
  const { data: manuscriptData } = await supabase
    .from('manuscripts')
    .select('*')
    .eq('id', manuscriptId)
    .eq('corresponding_author_id', user.id)
    .single()

  const m = manuscriptData as ManuscriptRow | null
  if (!m) return { error: 'Manuscript not found' }

  if (!WITHDRAWABLE_STATUSES.has(m.status)) {
    return {
      error: `Manuscripts with status "${m.status}" cannot be withdrawn.`,
    }
  }

  const trimmedReason = reason?.trim() || null
  const withdrawnAt = new Date().toISOString()

  // Flip status.
  const { error: updateError } = await (supabase.from('manuscripts') as any)
    .update({
      status: 'withdrawn',
      withdrawal_reason: trimmedReason,
      decision_date: withdrawnAt,
    })
    .eq('id', manuscriptId)
    .eq('corresponding_author_id', user.id)

  if (updateError) return { error: 'Failed to withdraw manuscript' }

  // Cancel any active reviewer invitations. Use the admin client so
  // we can also read reviewer profiles (RLS scopes invitation access
  // to reviewers themselves otherwise).
  const admin = createAdminClient()

  const { data: invitationData } = await admin
    .from('review_invitations')
    .select('id, reviewer_id, status')
    .eq('manuscript_id', manuscriptId)
    .in('status', ['invited', 'accepted'])

  const activeInvitations =
    (invitationData as { id: string; reviewer_id: string; status: string }[] | null) || []

  if (activeInvitations.length > 0) {
    await (admin.from('review_invitations') as any)
      .update({ status: 'cancelled', response_date: withdrawnAt })
      .in(
        'id',
        activeInvitations.map((i) => i.id)
      )
  }

  // Audit log.
  try {
    await (admin.from('audit_logs') as any).insert({
      user_id: user.id,
      action: 'manuscript_withdrawn',
      resource_type: 'manuscript',
      resource_id: manuscriptId,
      details: {
        submission_id: m.submission_id,
        reason: trimmedReason,
        cancelled_invitation_count: activeInvitations.length,
      },
    })
  } catch {
    // Audit log is best-effort; don't fail the withdrawal.
  }

  // ---- Fire transactional emails (fire-and-forget) ----
  const emailWarnings: string[] = []

  try {
    // Load author list + corresponding author profile.
    const { data: authorsList } = await supabase
      .from('manuscript_authors')
      .select('*')
      .eq('manuscript_id', manuscriptId)
      .order('author_order', { ascending: true })
    const allAuthors = (authorsList as ManuscriptAuthorRow[] | null) || []

    const { data: profileData } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single()
    const profile = profileData as UserRow | null

    const correspondingAuthor =
      allAuthors.find((a) => a.is_corresponding) ||
      allAuthors.find((a) => a.author_id === user.id) ||
      null

    const correspondingName =
      correspondingAuthor?.full_name || profile?.full_name || 'Author'
    const correspondingEmail =
      correspondingAuthor?.email || profile?.email || user.email || null

    const sendWithdrawalEmail = async (
      to: string,
      recipientName: string,
      role: WithdrawalRecipientRole
    ) => {
      const { html, text } = renderWithdrawalConfirmation({
        recipientName,
        recipientRole: role,
        correspondingAuthorName: correspondingName,
        submissionId: m.submission_id,
        title: m.title || '(untitled)',
        withdrawnAt,
        reason: trimmedReason,
      })
      const result = await sendEmail({
        to,
        subject: getWithdrawalSubject(m.submission_id, role),
        html,
        text,
        emailType: `withdrawal_${role}`,
        manuscriptId,
      })
      if (result.error) {
        emailWarnings.push(
          `Withdrawal email (${role}) to ${to} failed: ${result.error}`
        )
      }
    }

    // 1. Corresponding author confirmation.
    if (correspondingEmail) {
      await sendWithdrawalEmail(correspondingEmail, correspondingName, 'author')
    }

    // 2. Editorial office alert.
    await sendWithdrawalEmail(
      EDITORIAL_NOTIFY_EMAIL,
      'Editorial Office',
      'editor'
    )

    // 3. Active reviewers — look up profile by reviewer_id.
    if (activeInvitations.length > 0) {
      const reviewerIds = Array.from(
        new Set(activeInvitations.map((i) => i.reviewer_id))
      )
      const { data: reviewerData } = await admin
        .from('users')
        .select('id, email, full_name')
        .in('id', reviewerIds)
      const reviewers =
        (reviewerData as { id: string; email: string; full_name: string }[] | null) || []

      for (const reviewer of reviewers) {
        if (!reviewer.email) continue
        try {
          await sendWithdrawalEmail(
            reviewer.email,
            reviewer.full_name || 'Reviewer',
            'reviewer'
          )
        } catch (err) {
          emailWarnings.push(
            `Reviewer email to ${reviewer.email} threw: ${err instanceof Error ? err.message : 'unknown error'}`
          )
        }
      }
    }
  } catch (err) {
    emailWarnings.push(
      `Withdrawal email pipeline error: ${err instanceof Error ? err.message : 'unknown error'}`
    )
  }

  return {
    success: true,
    submissionId: m.submission_id,
    cancelledInvitations: activeInvitations.length,
    ...(emailWarnings.length > 0 ? { emailWarnings } : {}),
  }
}

// ---- AI disclosure getter (published-article surface) ----
//
// Returns the AI-assisted-writing disclosure for a given manuscript so
// that the published-article template can reproduce it alongside the
// COI and funding statements per `/editorial-policies`. Reads via the
// admin client because published-article rendering runs outside the
// author's RLS scope (reviewers, anonymous readers, search crawlers).

export interface ManuscriptAiDisclosure {
  aiToolsUsed: boolean
  aiToolsDetails: string | null
}

export async function getManuscriptAiDisclosure(
  manuscriptId: string
): Promise<ManuscriptAiDisclosure | null> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('manuscript_metadata')
    .select('ai_tools_used, ai_tools_details')
    .eq('manuscript_id', manuscriptId)
    .maybeSingle()

  if (!data) return null

  const row = data as { ai_tools_used: boolean | null; ai_tools_details: string | null }
  return {
    aiToolsUsed: !!row.ai_tools_used,
    aiToolsDetails: row.ai_tools_details,
  }
}

// ============================================================
// Revision submission (Session 12)
// ============================================================
// Author-side flow triggered from /dashboard/submit?revising={id}.
// Writes a manuscript_revisions row, flips the manuscript status
// from 'revision_requested' → 'revision_received', re-saves
// mutable manuscript fields (title/abstract/keywords), and fires
// two fire-and-forget emails (author receipt + editorial office).
//
// Files, authors, and declarations are expected to have been
// persisted already via the existing recordFile / saveAuthors /
// saveDeclarations server actions during the revising wizard.
// Those actions all route through the admin client and accept
// non-draft manuscripts.

export interface SubmitRevisionArgs {
  manuscriptId: string
  title: string
  abstract: string
  keywords: string[]
  responseToReviewers: string
  noteToEditor: string | null
}

export interface SubmitRevisionResult {
  success?: true
  revisionNumber?: number
  error?: string
  emailWarnings?: string[]
}

export async function submitRevision(
  args: SubmitRevisionArgs
): Promise<SubmitRevisionResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { manuscriptId } = args

  // Load manuscript + confirm ownership + gate on status.
  const { data: manuscriptData } = await supabase
    .from('manuscripts')
    .select('*')
    .eq('id', manuscriptId)
    .eq('corresponding_author_id', user.id)
    .maybeSingle()

  const m = manuscriptData as ManuscriptRow | null
  if (!m) return { error: 'Manuscript not found' }
  if (m.status !== 'revision_requested') {
    return {
      error: `Revisions can only be submitted on manuscripts in "revision_requested" status (current: "${m.status}").`,
    }
  }

  const title = (args.title || '').trim()
  const abstract = (args.abstract || '').trim()
  const keywords = Array.isArray(args.keywords)
    ? args.keywords.map((k) => (k || '').trim()).filter(Boolean)
    : []
  const response = (args.responseToReviewers || '').trim()
  const noteToEditor = (args.noteToEditor || '').trim() || null

  if (!title) return { error: 'Title is required.' }
  if (!abstract) return { error: 'Abstract is required.' }
  if (keywords.length < 3) {
    return { error: 'At least 3 keywords are required.' }
  }
  if (response.length < 50) {
    return {
      error:
        'A short response summarising how the reviewer comments were addressed is required (minimum 50 characters).',
    }
  }

  const admin = createAdminClient()

  // Validate revised files are present. The admin client bypasses
  // RLS for read; the policy would allow the author to see these
  // anyway.
  const { data: fileData } = await admin
    .from('manuscript_files')
    .select('file_type')
    .eq('manuscript_id', manuscriptId)

  const fileTypes = (fileData as { file_type: string }[] | null) || []
  const hasFileType = (t: string) => fileTypes.some((f) => f.file_type === t)
  if (!hasFileType('blinded_manuscript')) {
    return { error: 'Revised blinded manuscript file is required.' }
  }
  if (!hasFileType('tracked_changes')) {
    return {
      error:
        'A tracked-changes file is required so the editor can see every edit.',
    }
  }
  if (!hasFileType('response_to_reviewers')) {
    return {
      error:
        'A response-to-reviewers letter (uploaded as a file) is required.',
    }
  }

  // Compute revision_number = count(prior revisions) + 1.
  // Race-mitigation: compute inside the same write window. A UNIQUE
  // constraint on (manuscript_id, revision_number) is a Phase 3.5
  // add.
  const { data: priorRevisionsData } = await admin
    .from('manuscript_revisions')
    .select('id')
    .eq('manuscript_id', manuscriptId)
  const priorCount = Array.isArray(priorRevisionsData)
    ? priorRevisionsData.length
    : 0
  const revisionNumber = priorCount + 1

  // Migration 012 — pull forward the pre-revision snapshot captured
  // on the triggering editorial_decisions row (the most-recent
  // non-rescinded decision with decision IN (minor_revisions,
  // major_revisions)). If no snapshot exists (legacy decision issued
  // before migration 012, or snapshot capture silently failed), the
  // snapshot_* columns stay NULL and the future diff UI surfaces
  // "snapshot unavailable" for this revision.
  let snapshot: PreRevisionSnapshot | null = null
  let snapshotCapturedAt: string | null = null
  try {
    const { data: decisionRow } = await admin
      .from('editorial_decisions')
      .select('pre_revision_snapshot, decision_date')
      .eq('manuscript_id', manuscriptId)
      .in('decision', ['minor_revisions', 'major_revisions'])
      .is('rescinded_at', null)
      .order('decision_date', { ascending: false })
      .limit(1)
      .maybeSingle()

    const decision = decisionRow as
      | {
          pre_revision_snapshot: PreRevisionSnapshot | null
          decision_date: string | null
        }
      | null
    if (decision?.pre_revision_snapshot) {
      snapshot = decision.pre_revision_snapshot
      snapshotCapturedAt = decision.decision_date ?? null
    }
  } catch {
    // Non-fatal — revisions still write without a snapshot.
  }

  // Insert the manuscript_revisions row.
  const { error: insertErr } = await (
    admin.from('manuscript_revisions') as any
  ).insert({
    manuscript_id: manuscriptId,
    revision_number: revisionNumber,
    response_to_reviewers: response,
    note_to_editor: noteToEditor,
    snapshot_title: snapshot?.title ?? null,
    snapshot_abstract: snapshot?.abstract ?? null,
    snapshot_keywords: snapshot?.keywords ?? null,
    snapshot_subspecialty: snapshot?.subspecialty ?? null,
    snapshot_authors: snapshot?.authors ?? null,
    snapshot_source: snapshot ? 'editorial_decision' : null,
    snapshot_captured_at: snapshotCapturedAt,
  })

  if (insertErr) {
    return { error: `Failed to record revision: ${insertErr.message}` }
  }

  // Update the manuscript: re-save mutable fields + flip status.
  const { error: updErr } = await (admin.from('manuscripts') as any)
    .update({
      title,
      abstract,
      keywords,
      status: 'revision_received',
    })
    .eq('id', manuscriptId)

  if (updErr) {
    return {
      error: `Revision recorded but manuscript update failed: ${updErr.message}`,
    }
  }

  // Audit log.
  try {
    await (admin.from('audit_logs') as any).insert({
      user_id: user.id,
      action: 'revision_submitted',
      resource_type: 'manuscript_revision',
      resource_id: manuscriptId,
      details: {
        manuscript_id: manuscriptId,
        submission_id: m.submission_id,
        revision_number: revisionNumber,
        response_length: response.length,
        file_count: fileTypes.length,
      },
    })
  } catch {
    // swallow
  }

  // Fire-and-forget emails.
  const emailWarnings: string[] = []
  try {
    const { data: authorsList } = await admin
      .from('manuscript_authors')
      .select('*')
      .eq('manuscript_id', manuscriptId)
      .order('author_order', { ascending: true })
    const allAuthors = (authorsList as ManuscriptAuthorRow[] | null) || []

    const { data: profileData } = await admin
      .from('users')
      .select('*')
      .eq('id', user.id)
      .maybeSingle()
    const profile = profileData as UserRow | null

    const correspondingAuthor =
      allAuthors.find((a) => a.is_corresponding) ||
      allAuthors.find((a) => a.author_id === user.id) ||
      null

    const correspondingName =
      correspondingAuthor?.full_name || profile?.full_name || 'Author'
    const correspondingEmail =
      correspondingAuthor?.email || profile?.email || user.email || null

    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      'https://www.oscrsj.com'
    const base = siteUrl.replace(/\/$/, '')

    // 1. Author confirmation.
    if (correspondingEmail) {
      const { html, text } = renderRevisionReceivedAuthor({
        authorName: correspondingName,
        submissionId: m.submission_id,
        title,
        revisionNumber,
        dashboardUrl: `${base}/dashboard`,
      })
      const result = await sendEmail({
        to: correspondingEmail,
        subject: getRevisionReceivedAuthorSubject(
          m.submission_id,
          revisionNumber
        ),
        html,
        text,
        emailType: 'revision_received_author',
        manuscriptId,
      })
      if (result.error) {
        emailWarnings.push(
          `Author confirmation to ${correspondingEmail} failed: ${result.error}`
        )
      }
    }

    // 2. Editorial office notification.
    const { html, text } = renderRevisionReceivedEditor({
      correspondingAuthorName: correspondingName,
      correspondingAuthorEmail: correspondingEmail || '(unknown)',
      submissionId: m.submission_id,
      title,
      revisionNumber,
      adminUrl: `${base}/dashboard/admin/manuscripts/${manuscriptId}`,
      noteToEditor,
    })
    const editorResult = await sendEmail({
      to: EDITORIAL_NOTIFY_EMAIL,
      subject: getRevisionReceivedEditorSubject(
        m.submission_id,
        revisionNumber
      ),
      html,
      text,
      emailType: 'revision_received_editor',
      manuscriptId,
    })
    if (editorResult.error) {
      emailWarnings.push(
        `Editor notification to ${EDITORIAL_NOTIFY_EMAIL} failed: ${editorResult.error}`
      )
    }
  } catch (err) {
    emailWarnings.push(
      `Revision email pipeline error: ${
        err instanceof Error ? err.message : 'unknown error'
      }`
    )
  }

  return {
    success: true,
    revisionNumber,
    ...(emailWarnings.length > 0 ? { emailWarnings } : {}),
  }
}

// ---- Load revision context (for the revising wizard) ----
//
// Returns the manuscript, its latest editorial decision, and all
// submitted (non-draft) reviews — with reviewer identities
// stripped. Reviews are returned as ordered "Reviewer A / B /..."
// slots so the author-facing Step 0 cannot leak reviewer names or
// emails. Filter happens here (server-side), not in the client, to
// satisfy the brief's double-blind accountability rule (§12, risk
// #4).

export interface AnonymisedReview {
  label: string
  recommendation: string | null
  comments_to_author: string | null
  submitted_date: string | null
}

export interface RevisionContext {
  manuscript: ManuscriptRow
  authors: ManuscriptAuthorRow[]
  metadata: ManuscriptMetadataRow | null
  files: ManuscriptFileRow[]
  revisionNumber: number
  decisionLetter: string | null
  decisionType: string | null
  decisionDate: string | null
  revisionDeadline: string | null
  reviews: AnonymisedReview[]
}

export async function loadRevisionContext(
  manuscriptId: string
): Promise<RevisionContext | { error: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const admin = createAdminClient()

  const { data: mData } = await admin
    .from('manuscripts')
    .select('*')
    .eq('id', manuscriptId)
    .eq('corresponding_author_id', user.id)
    .maybeSingle()
  const manuscript = (mData as ManuscriptRow | null) || null
  if (!manuscript) return { error: 'Manuscript not found' }
  if (manuscript.status !== 'revision_requested') {
    return {
      error: `Revisions can only be submitted on manuscripts in "revision_requested" status (current: "${manuscript.status}").`,
    }
  }

  const [authorsRes, metadataRes, filesRes, priorRevRes, decisionsRes, reviewsRes] =
    await Promise.all([
      admin
        .from('manuscript_authors')
        .select('*')
        .eq('manuscript_id', manuscriptId)
        .order('author_order', { ascending: true }),
      admin
        .from('manuscript_metadata')
        .select('*')
        .eq('manuscript_id', manuscriptId)
        .maybeSingle(),
      admin
        .from('manuscript_files')
        .select('*')
        .eq('manuscript_id', manuscriptId)
        .order('file_order', { ascending: true }),
      admin
        .from('manuscript_revisions')
        .select('id')
        .eq('manuscript_id', manuscriptId),
      admin
        .from('editorial_decisions')
        .select('*')
        .eq('manuscript_id', manuscriptId)
        .order('decision_date', { ascending: false })
        .limit(1),
      admin
        .from('reviews')
        .select(
          'id, recommendation, comments_to_author, submitted_date, is_draft'
        )
        .eq('manuscript_id', manuscriptId)
        .eq('is_draft', false)
        .order('submitted_date', { ascending: true }),
    ])

  const authors = (authorsRes.data as ManuscriptAuthorRow[] | null) || []
  const metadata = (metadataRes.data as ManuscriptMetadataRow | null) || null
  const files = (filesRes.data as ManuscriptFileRow[] | null) || []
  const priorCount = Array.isArray(priorRevRes.data)
    ? priorRevRes.data.length
    : 0

  const latestDecisionRow =
    Array.isArray(decisionsRes.data) && decisionsRes.data.length > 0
      ? (decisionsRes.data[0] as {
          decision: string
          decision_letter: string | null
          decision_date: string
          revision_deadline: string | null
        })
      : null

  const rawReviews = Array.isArray(reviewsRes.data) ? reviewsRes.data : []
  const reviews: AnonymisedReview[] = rawReviews.map((r: any, idx: number) => ({
    label: `Reviewer ${String.fromCharCode(65 + idx)}`,
    recommendation: r.recommendation,
    comments_to_author: r.comments_to_author,
    submitted_date: r.submitted_date,
  }))

  return {
    manuscript,
    authors,
    metadata,
    files,
    revisionNumber: priorCount + 1,
    decisionLetter: latestDecisionRow?.decision_letter || null,
    decisionType: latestDecisionRow?.decision || null,
    decisionDate: latestDecisionRow?.decision_date || null,
    revisionDeadline: latestDecisionRow?.revision_deadline || null,
    reviews,
  }
}
