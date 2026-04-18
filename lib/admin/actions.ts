'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import type { ManuscriptFileRow } from '@/lib/types/database'

// Admin-scoped server actions. Every export here re-checks editor/admin
// role on the authenticated user before touching the admin (service-role)
// client. The UI layout at /dashboard/admin/* also gates on the same
// check — the re-check here closes the gap for direct POSTs bypassing
// the UI.

const SIGNED_URL_TTL_SECONDS = 30 * 60

async function requireEditorOrAdmin(): Promise<
  { userId: string } | { error: string }
> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  const { data, error } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (error || !data) return { error: 'Profile not found.' }
  const role = (data as { role: string }).role
  if (role !== 'editor' && role !== 'admin') {
    return { error: 'Editor or admin role required.' }
  }
  return { userId: user.id }
}

export interface GetAdminFileSignedUrlResult {
  signedUrl?: string
  fileName?: string
  error?: string
  notFound?: true
  forbidden?: true
}

// Editor-only file-download signed URL. Unlike the reviewer variant in
// lib/reviewer/actions.ts, this one has no double-blind allowlist —
// editors may download every file type (cover letter, un-blinded
// manuscript, figures, ethics approval, response-to-reviewers,
// tracked-changes, supplements).
export async function getAdminFileSignedUrl(
  fileId: string
): Promise<GetAdminFileSignedUrlResult> {
  const gate = await requireEditorOrAdmin()
  if ('error' in gate) return { forbidden: true, error: gate.error }

  if (!fileId || typeof fileId !== 'string') {
    return { notFound: true, error: 'File id is required.' }
  }

  const admin = createAdminClient()

  const { data: fData, error: fErr } = await admin
    .from('manuscript_files')
    .select('*')
    .eq('id', fileId)
    .maybeSingle()

  if (fErr || !fData) return { notFound: true, error: 'File not found.' }
  const file = fData as ManuscriptFileRow

  const { data: signed, error: signErr } = await admin.storage
    .from('submissions')
    .createSignedUrl(file.storage_path, SIGNED_URL_TTL_SECONDS, {
      download: file.original_filename || file.file_name,
    })

  if (signErr || !signed) {
    return {
      error: `Failed to generate download link: ${
        signErr?.message || 'unknown error'
      }`,
    }
  }

  // Audit log — required per brief acceptance criteria. Best-effort;
  // never fail the download on a log error.
  try {
    await (admin.from('audit_logs') as any).insert({
      user_id: gate.userId,
      action: 'editor_file_downloaded',
      resource_type: 'manuscript_file',
      resource_id: file.id,
      details: {
        file_id: file.id,
        manuscript_id: file.manuscript_id,
        file_type: file.file_type,
        editor_id: gate.userId,
      },
    })
  } catch {
    // swallow
  }

  return {
    signedUrl: signed.signedUrl,
    fileName: file.original_filename || file.file_name,
  }
}
