'use server'

import sanitizeHtml from 'sanitize-html'
import { revalidatePath } from 'next/cache'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { sendEmail, type SendEmailAttachment } from '@/lib/email/resend'
import { buildReviewerFeedbackDocx } from '@/lib/reviewer-feedback/build'
import {
  renderEditorialDecisionAccept,
  getEditorialDecisionAcceptSubject,
} from '@/lib/email/templates/editorialDecisionAccept'
import {
  renderEditorialDecisionMinorRevisions,
  getEditorialDecisionMinorRevisionsSubject,
} from '@/lib/email/templates/editorialDecisionMinorRevisions'
import {
  renderEditorialDecisionMajorRevisions,
  getEditorialDecisionMajorRevisionsSubject,
} from '@/lib/email/templates/editorialDecisionMajorRevisions'
import {
  renderEditorialDecisionReject,
  getEditorialDecisionRejectSubject,
} from '@/lib/email/templates/editorialDecisionReject'
import {
  renderDecisionRescindedAuthor,
  getDecisionRescindedAuthorSubject,
} from '@/lib/email/templates/decisionRescindedAuthor'
import {
  renderReviewerInvitation,
  getReviewerInvitationSubject,
} from '@/lib/email/templates/reviewerInvitation'
import type {
  ManuscriptFileRow,
  ManuscriptRow,
  ManuscriptStatus,
  EditorialDecisionType,
  EditorialDecisionRow,
  UserRow,
  ManuscriptAuthorRow,
  ManuscriptMetadataRow,
  ReviewInvitationRow,
  PreRevisionSnapshot,
  SnapshotAuthor,
} from '@/lib/types/database'
import {
  validateMetadataForRender,
  type ManuscriptDraftOverlay,
  type ValidationRow,
} from '@/lib/publish/synthesize'

// Admin-scoped server actions. Every export here re-checks editor/admin
// role on the authenticated user before touching the admin (service-role)
// client. The UI layout at /dashboard/admin/* also gates on the same
// check — the re-check here closes the gap for direct POSTs bypassing
// the UI.

const SIGNED_URL_TTL_SECONDS = 30 * 60

// Rescind window — must match the UI gate in DecisionComposerPanel.
// Past 15 minutes a superseding decision is required (a second
// editorial_decisions row), not a rescind.
const RESCIND_WINDOW_MS = 15 * 60 * 1000

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

// Strict admin-only gate — editors do NOT pass. Used by Phase 4
// publishing-pipeline surfaces (render-report viewer, Renderer.app
// asset uploads) that are scoped to Kanwar + any future admin-role
// accounts. See Submission Portal Architecture Plan §6.1 decision 1
// ("Admin-only feature. Publishing pipeline surfaces are visible
// to the `admin` role only. Editors, authors, and reviewers do not
// see the render-status panel.").
async function requireAdminOnly(): Promise<
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
  if (role !== 'admin') {
    return { error: 'Admin role required.' }
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

// ============================================================
// Phase 4: published asset download (Session 16)
// ============================================================
// Published assets (the PDF + its render-report.json) are NOT
// rows in manuscript_files — their storage paths live directly
// on the manuscripts row (`published_pdf_storage_path`,
// `render_report_storage_path`). This action generates a
// short-lived signed URL keyed by (manuscriptId, which) so the
// admin-only Published PDF panel and /render-report viewer can
// offer downloads. Gated by requireAdminOnly per §6.1 decision 1.

// Sushant Session 19 (2026-05-06): 'jats' added alongside 'pdf' and
// 'report' to surface the JATS Publishing 1.3 XML artifact rendered
// by the OSCRSJ Renderer (manuscripts.jats_xml_storage_path,
// migration 020).
export type PublishedAssetKind = 'pdf' | 'report' | 'jats'

export interface GetPublishedAssetSignedUrlResult {
  signedUrl?: string
  fileName?: string
  error?: string
  notFound?: true
  forbidden?: true
}

export async function getPublishedAssetSignedUrl(
  manuscriptId: string,
  which: PublishedAssetKind
): Promise<GetPublishedAssetSignedUrlResult> {
  const gate = await requireAdminOnly()
  if ('error' in gate) return { forbidden: true, error: gate.error }

  if (!manuscriptId || typeof manuscriptId !== 'string') {
    return { notFound: true, error: 'Manuscript id is required.' }
  }
  if (which !== 'pdf' && which !== 'report' && which !== 'jats') {
    return { notFound: true, error: 'Unknown asset kind.' }
  }

  const admin = createAdminClient()

  const { data: mData, error: mErr } = await admin
    .from('manuscripts')
    .select(
      'id, submission_id, published_pdf_storage_path, render_report_storage_path, jats_xml_storage_path'
    )
    .eq('id', manuscriptId)
    .maybeSingle()

  if (mErr || !mData) {
    return { notFound: true, error: 'Manuscript not found.' }
  }

  const m = mData as {
    id: string
    submission_id: string
    published_pdf_storage_path: string | null
    render_report_storage_path: string | null
    jats_xml_storage_path: string | null
  }

  const storagePath =
    which === 'pdf'
      ? m.published_pdf_storage_path
      : which === 'report'
        ? m.render_report_storage_path
        : m.jats_xml_storage_path
  if (!storagePath) {
    return {
      notFound: true,
      error:
        which === 'pdf'
          ? 'No published PDF is attached to this manuscript yet.'
          : which === 'report'
            ? 'No render report is attached to this manuscript yet.'
            : 'No JATS XML artifact is attached to this manuscript yet.',
    }
  }

  const downloadName =
    which === 'pdf'
      ? `${m.submission_id}.pdf`
      : which === 'report'
        ? `${m.submission_id}_render-report.json`
        : `${m.submission_id}.xml`

  const { data: signed, error: signErr } = await admin.storage
    .from('submissions')
    .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS, {
      download: downloadName,
    })

  if (signErr || !signed) {
    return {
      error: `Failed to generate download link: ${
        signErr?.message || 'unknown error'
      }`,
    }
  }

  // Audit log — best-effort.
  try {
    await (admin.from('audit_logs') as any).insert({
      user_id: gate.userId,
      action: 'admin_published_asset_downloaded',
      resource_type: 'manuscript',
      resource_id: manuscriptId,
      details: {
        which,
        admin_id: gate.userId,
        manuscript_id: manuscriptId,
      },
    })
  } catch {
    // swallow
  }

  return { signedUrl: signed.signedUrl, fileName: downloadName }
}

// Server-side fetch of the render-report.json content. Used by the
// /render-report viewer route which needs to parse + render the
// JSON (not just offer a download). Returns the parsed object or
// an error; admin-only like the signed-URL action.
export interface FetchRenderReportResult {
  report?: unknown
  error?: string
  notFound?: true
  forbidden?: true
}

export async function fetchRenderReport(
  manuscriptId: string
): Promise<FetchRenderReportResult> {
  const gate = await requireAdminOnly()
  if ('error' in gate) return { forbidden: true, error: gate.error }

  const admin = createAdminClient()

  const { data: mData, error: mErr } = await admin
    .from('manuscripts')
    .select('id, render_report_storage_path')
    .eq('id', manuscriptId)
    .maybeSingle()

  if (mErr || !mData) {
    return { notFound: true, error: 'Manuscript not found.' }
  }
  const path = (mData as { render_report_storage_path: string | null })
    .render_report_storage_path
  if (!path) {
    return { notFound: true, error: 'No render report is attached.' }
  }

  const { data: blob, error: dlErr } = await admin.storage
    .from('submissions')
    .download(path)
  if (dlErr || !blob) {
    return {
      error: `Failed to read render report: ${dlErr?.message || 'unknown error'}`,
    }
  }

  try {
    const text = await blob.text()
    const report = JSON.parse(text)
    return { report }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Parse error'
    return { error: `Render report is not valid JSON: ${msg}` }
  }
}

// ============================================================
// Editorial decision composer (Session 12 + Session 13)
// ============================================================
// Gates: editor/admin role + manuscript status in DECIDABLE_STATUSES.
// Status mapping (Session 13 reject-enum split):
//   accept              → 'accepted'
//   minor_revisions     → 'revision_requested'
//   major_revisions     → 'revision_requested'
//   post_review_reject  → 'rejected'              (new in S13)
//   reject              → 'rejected'              (legacy alias —
//                                                   composer no longer
//                                                   emits this; kept
//                                                   for any rows
//                                                   inserted before
//                                                   the split landed)
//   desk_reject         → 'desk_rejected'
//
// DECIDABLE_STATUSES is local to this module — do not import it
// cross-module. Each gate stays close to the action that enforces it.

const DECIDABLE_STATUSES = [
  'submitted',
  'under_review',
  'revision_received',
] as const

const REVISION_DECISIONS = new Set<EditorialDecisionType>([
  'minor_revisions',
  'major_revisions',
])

const DECISION_TO_STATUS: Record<EditorialDecisionType, ManuscriptStatus> = {
  accept: 'accepted',
  minor_revisions: 'revision_requested',
  major_revisions: 'revision_requested',
  post_review_reject: 'rejected',
  reject: 'rejected',
  desk_reject: 'desk_rejected',
}

const MIN_DECISION_LETTER_LENGTH = 120
const MAX_DECISION_LETTER_LENGTH = 20_000

// ------------------------------------------------------------
// Migration 012 — pre-revision snapshot capture
// ------------------------------------------------------------
// Called by submitEditorialDecision when the decision is
// Minor/Major Revisions. Reads the current manuscripts row +
// manuscript_authors list and returns a PreRevisionSnapshot
// ready to persist as jsonb on the editorial_decisions row.
//
// Why here (not at revision submit): the revising wizard writes
// live to the production tables via saveManuscriptInfo +
// saveAuthors, so by the time submitRevision fires the
// pre-revision state is gone. The editor's decision-issue moment
// is the only reliable capture point upstream of those live
// writes. See migration 012 header comment for the full rationale.
async function buildPreRevisionSnapshot(
  admin: ReturnType<typeof createAdminClient>,
  manuscript: ManuscriptRow
): Promise<PreRevisionSnapshot> {
  const { data: authorRows } = await admin
    .from('manuscript_authors')
    .select('*')
    .eq('manuscript_id', manuscript.id)
    .order('author_order', { ascending: true })

  const authors = ((authorRows as ManuscriptAuthorRow[] | null) || []).map(
    (row): SnapshotAuthor => ({
      author_order: row.author_order,
      full_name: row.full_name,
      email: row.email,
      affiliation: row.affiliation,
      orcid_id: row.orcid_id,
      degrees: row.degrees,
      contribution: row.contribution,
      is_corresponding: row.is_corresponding,
    })
  )

  return {
    title: manuscript.title ?? null,
    abstract: manuscript.abstract ?? null,
    keywords: Array.isArray(manuscript.keywords) ? manuscript.keywords : null,
    subspecialty: manuscript.subspecialty ?? null,
    authors,
  }
}

function siteUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    'https://www.oscrsj.com'
  return raw.replace(/\/$/, '')
}

function formatDeadlineLabel(iso: string | null): string {
  if (!iso) return 'Not specified'
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  } catch {
    return iso
  }
}

export interface SubmitEditorialDecisionArgs {
  manuscriptId: string
  decision: EditorialDecisionType
  decisionLetter: string
  revisionDeadline?: string | null
  // Session 13 — when true and decision === 'major_revisions',
  // enumerates reviewers who completed round 1 and seeds fresh
  // 'invited' review_invitations rows for round 2. Best-effort:
  // a re-invite failure does NOT roll back the decision.
  reInviteOriginalReviewers?: boolean
  // Session 51 — when set on a Minor/Major Revisions decision,
  // the editor has downloaded the auto-generated reviewer-feedback
  // .docx, edited it in Word, and uploaded the edited version. This
  // overrides the auto-generated attachment. Ignored for non-
  // revision decisions. `contentBase64` is the raw .docx bytes
  // base64-encoded; capped at 22 MB raw (matches Resend payload).
  reviewerFeedbackOverride?: {
    filename: string
    contentBase64: string
  } | null
}

// Resend caps total payload at ~40 MB; base64 inflates ~33%, so the
// safe raw-byte ceiling for a single attachment is ~22 MB. Surfaced
// in both resolveReviewerFeedbackAttachment (server) and the
// DecisionComposerPanel client-side override-upload guard.
const REVIEWER_FEEDBACK_MAX_BYTES = 22 * 1024 * 1024

export interface ResolvedReviewerFeedbackAttachment {
  // The Resend-ready attachment, or null when no attachment ships.
  attachment: SendEmailAttachment | null
  // Convenience flag matching the `hasReviewerFeedbackAttachment`
  // prop on the Minor/Major Revisions email templates.
  hasAttachment: boolean
  // For audit logging / debugging — which path produced the
  // attachment (or 'none' if there is no attachment to send).
  source: 'override' | 'auto' | 'none'
  // Reviewer count from the auto-build path. Zero when the editor
  // supplied an override (we don't crack open the .docx).
  reviewerCount: number
  // Populated on hard failures (override decode error, oversize,
  // DB error). Decision send proceeds without attachment on error.
  error: string | null
}

// Resolves the reviewer-feedback .docx attachment to ship with a
// Minor/Major Revisions decision email. Exported so other paths
// (resend, regenerate-on-demand, future bulk-decision flows) can
// reuse the same override-vs-auto logic + 22 MB cap.
export async function resolveReviewerFeedbackAttachment(
  manuscriptId: string,
  override?: { filename: string; contentBase64: string } | null,
): Promise<ResolvedReviewerFeedbackAttachment> {
  // Override path: editor uploaded an edited version.
  if (override && override.contentBase64) {
    try {
      const buffer = Buffer.from(override.contentBase64, 'base64')
      if (buffer.byteLength === 0) {
        return {
          attachment: null,
          hasAttachment: false,
          source: 'override',
          reviewerCount: 0,
          error: 'Override file decoded to zero bytes.',
        }
      }
      if (buffer.byteLength > REVIEWER_FEEDBACK_MAX_BYTES) {
        return {
          attachment: null,
          hasAttachment: false,
          source: 'override',
          reviewerCount: 0,
          error: `Override exceeds ${Math.floor(
            REVIEWER_FEEDBACK_MAX_BYTES / (1024 * 1024),
          )} MB cap.`,
        }
      }
      return {
        attachment: {
          filename: override.filename || 'reviewer-feedback.docx',
          content: buffer,
          contentType:
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        },
        hasAttachment: true,
        source: 'override',
        reviewerCount: 0,
        error: null,
      }
    } catch (err) {
      return {
        attachment: null,
        hasAttachment: false,
        source: 'override',
        reviewerCount: 0,
        error:
          err instanceof Error
            ? err.message
            : 'Override base64 decode failed.',
      }
    }
  }

  // Auto path: build from `reviews.comments_to_author`.
  const build = await buildReviewerFeedbackDocx({ manuscriptId })
  if (!build.ok) {
    return {
      attachment: null,
      hasAttachment: false,
      source: 'auto',
      reviewerCount: 0,
      error: build.error,
    }
  }
  if (build.empty || !build.content || !build.filename) {
    // No author-facing comments yet — ship the decision email
    // without attachment. The templates' default copy still reads
    // cleanly because `hasReviewerFeedbackAttachment` is false.
    return {
      attachment: null,
      hasAttachment: false,
      source: 'none',
      reviewerCount: 0,
      error: null,
    }
  }
  if (build.content.byteLength > REVIEWER_FEEDBACK_MAX_BYTES) {
    return {
      attachment: null,
      hasAttachment: false,
      source: 'auto',
      reviewerCount: build.reviewerCount,
      error: `Auto-generated reviewer feedback exceeds ${Math.floor(
        REVIEWER_FEEDBACK_MAX_BYTES / (1024 * 1024),
      )} MB cap.`,
    }
  }
  return {
    attachment: {
      filename: build.filename,
      content: build.content,
      contentType:
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    },
    hasAttachment: true,
    source: 'auto',
    reviewerCount: build.reviewerCount,
    error: null,
  }
}

export interface PreviewReviewerFeedbackArgs {
  manuscriptId: string
}

export interface PreviewReviewerFeedbackResult {
  ok: boolean
  error?: string
  forbidden?: true
  // Set when ok && !empty.
  filename?: string | null
  // Base64-encoded .docx bytes — the client decodes and triggers
  // an in-browser download. Set when ok && !empty.
  contentBase64?: string | null
  // From the auto-build path.
  reviewerCount?: number
  // True when no reviewer has submitted author-facing comments
  // yet. The UI surfaces a "nothing to preview" message and the
  // decision email will be sent without an attachment.
  empty?: boolean
}

// Server action invoked by DecisionComposerPanel's Preview button.
// Builds the reviewer-feedback .docx from current DB state and
// returns it as base64 so the editor can review (and optionally
// edit) it before submitting the decision.
export async function previewReviewerFeedback(
  args: PreviewReviewerFeedbackArgs,
): Promise<PreviewReviewerFeedbackResult> {
  const gate = await requireEditorOrAdmin()
  if ('error' in gate) {
    return { ok: false, forbidden: true, error: gate.error }
  }
  if (!args.manuscriptId || typeof args.manuscriptId !== 'string') {
    return { ok: false, error: 'Manuscript id is required.' }
  }
  const build = await buildReviewerFeedbackDocx({
    manuscriptId: args.manuscriptId,
  })
  if (!build.ok) {
    return {
      ok: false,
      error: build.error || 'Failed to build reviewer feedback preview.',
    }
  }
  if (build.empty || !build.content || !build.filename) {
    return {
      ok: true,
      empty: true,
      filename: null,
      contentBase64: null,
      reviewerCount: 0,
    }
  }
  return {
    ok: true,
    empty: false,
    filename: build.filename,
    contentBase64: build.content.toString('base64'),
    reviewerCount: build.reviewerCount,
  }
}

export interface SubmitEditorialDecisionResult {
  ok: boolean
  decisionId?: string
  error?: string
  forbidden?: true
  notFound?: true
  invalidState?: true
  // Session 13 — populated when reInviteOriginalReviewers was true.
  reInvited?: number
  reInviteSkipped?: number
  reInviteFailed?: number
}

export async function submitEditorialDecision(
  args: SubmitEditorialDecisionArgs
): Promise<SubmitEditorialDecisionResult> {
  const gate = await requireEditorOrAdmin()
  if ('error' in gate) return { ok: false, forbidden: true, error: gate.error }

  if (!args.manuscriptId || typeof args.manuscriptId !== 'string') {
    return { ok: false, error: 'Manuscript id is required.' }
  }

  const validDecisions: EditorialDecisionType[] = [
    'accept',
    'minor_revisions',
    'major_revisions',
    'post_review_reject',
    'reject',
    'desk_reject',
  ]
  if (!validDecisions.includes(args.decision)) {
    return { ok: false, error: 'Invalid decision type.' }
  }

  const letter =
    typeof args.decisionLetter === 'string' ? args.decisionLetter.trim() : ''
  if (letter.length < MIN_DECISION_LETTER_LENGTH) {
    return {
      ok: false,
      error: `Decision letter must be at least ${MIN_DECISION_LETTER_LENGTH} characters.`,
    }
  }
  if (letter.length > MAX_DECISION_LETTER_LENGTH) {
    return {
      ok: false,
      error: `Decision letter exceeds maximum length (${MAX_DECISION_LETTER_LENGTH} characters).`,
    }
  }

  let deadlineIso: string | null = null
  if (REVISION_DECISIONS.has(args.decision)) {
    if (!args.revisionDeadline || typeof args.revisionDeadline !== 'string') {
      return {
        ok: false,
        error: 'A revision deadline is required for revision decisions.',
      }
    }
    const parsed = new Date(args.revisionDeadline)
    if (Number.isNaN(parsed.getTime())) {
      return { ok: false, error: 'Revision deadline is not a valid date.' }
    }
    if (parsed.getTime() <= Date.now()) {
      return { ok: false, error: 'Revision deadline must be in the future.' }
    }
    deadlineIso = parsed.toISOString()
  }

  const admin = createAdminClient()

  // Load manuscript + gate on decidable status.
  const { data: mData, error: mErr } = await admin
    .from('manuscripts')
    .select('*')
    .eq('id', args.manuscriptId)
    .maybeSingle()

  if (mErr || !mData) {
    return { ok: false, notFound: true, error: 'Manuscript not found.' }
  }
  const manuscript = mData as ManuscriptRow

  if (!(DECIDABLE_STATUSES as readonly string[]).includes(manuscript.status)) {
    return {
      ok: false,
      invalidState: true,
      error: `Manuscripts in status "${manuscript.status}" cannot receive a new editorial decision.`,
    }
  }

  // Desk reject is only valid from 'submitted'.
  if (args.decision === 'desk_reject' && manuscript.status !== 'submitted') {
    return {
      ok: false,
      invalidState: true,
      error: 'Desk reject is only available on manuscripts in "submitted" status.',
    }
  }

  const nowIso = new Date().toISOString()
  const targetStatus = DECISION_TO_STATUS[args.decision]

  // Migration 012 — capture the pre-revision snapshot at this moment.
  // Only populated for Minor/Major Revisions decisions; NULL for accept/
  // reject/desk_reject. Authors are read via the admin client so RLS
  // doesn't block; the editor-role gate above already authorised this call.
  let preRevisionSnapshot: PreRevisionSnapshot | null = null
  if (REVISION_DECISIONS.has(args.decision)) {
    try {
      preRevisionSnapshot = await buildPreRevisionSnapshot(admin, manuscript)
    } catch (err) {
      // Snapshot failure is non-fatal — the decision itself is the primary
      // durable record. The future diff UI will honestly surface a null
      // snapshot rather than block the editor from shipping a decision.
      console.error('pre_revision_snapshot capture failed', err)
      preRevisionSnapshot = null
    }
  }

  // 1. Insert decision row.
  const { data: inserted, error: insertErr } = await (
    admin.from('editorial_decisions') as any
  )
    .insert({
      manuscript_id: args.manuscriptId,
      editor_id: gate.userId,
      decision: args.decision,
      decision_letter: letter,
      revision_deadline: deadlineIso,
      decision_date: nowIso,
      pre_revision_snapshot: preRevisionSnapshot,
    })
    .select('id')
    .single()

  if (insertErr || !inserted) {
    return {
      ok: false,
      error: `Failed to record decision: ${
        insertErr?.message || 'unknown error'
      }`,
    }
  }
  const decisionId = (inserted as { id: string }).id

  // 2. Flip manuscript status + stamp decision_date.
  const manuscriptStatusUpdate: Record<string, unknown> = {
    status: targetStatus,
    decision_date: nowIso,
  }

  // On acceptance, assign the next sequential elocation_id (e0002, e0003…)
  // if one hasn't been assigned yet. The renderer otherwise defaults every
  // manuscript to 'e0001' (synthesize.ts §article), and the placeholder DOI is
  // derived from that elocation — so without this, every accepted article would
  // publish with a duplicate identity. idx_manuscripts_elocation_id_unique
  // (migration 026) is the backstop if two accepts ever race to the same number.
  if (targetStatus === 'accepted' && !manuscript.elocation_id) {
    try {
      const { data: maxRow } = await admin
        .from('manuscripts')
        .select('elocation_id')
        .not('elocation_id', 'is', null)
        .order('elocation_id', { ascending: false })
        .limit(1)
        .maybeSingle()
      const lastId =
        (maxRow as { elocation_id: string | null } | null)?.elocation_id ?? null
      const lastNum = lastId ? parseInt(lastId.replace(/^e/i, ''), 10) : 0
      const nextNum = Number.isFinite(lastNum) && lastNum > 0 ? lastNum + 1 : 1
      manuscriptStatusUpdate.elocation_id = `e${String(nextNum).padStart(4, '0')}`
    } catch (err) {
      // Non-fatal: if assignment fails, the editor can still set it before
      // publish. Don't block the acceptance decision on an elocation lookup.
      console.error('elocation_id auto-assign failed', err)
    }
  }

  const { error: updErr } = await (admin.from('manuscripts') as any)
    .update(manuscriptStatusUpdate)
    .eq('id', args.manuscriptId)

  if (updErr) {
    return {
      ok: false,
      error: `Decision recorded but status update failed: ${updErr.message}`,
    }
  }

  // 3. Audit log.
  try {
    await (admin.from('audit_logs') as any).insert({
      user_id: gate.userId,
      action: 'editorial_decision_issued',
      resource_type: 'editorial_decision',
      resource_id: decisionId,
      details: {
        decision_id: decisionId,
        manuscript_id: args.manuscriptId,
        decision: args.decision,
        from_status: manuscript.status,
        to_status: targetStatus,
        revision_deadline: deadlineIso,
        letter_length: letter.length,
      },
    })
  } catch {
    // swallow
  }

  // 4. Fire-and-forget decision-letter email.
  try {
    // Load corresponding author identity + email. Prefer
    // manuscript_authors.is_corresponding (the snapshot on the
    // submission) then fall back to the users row.
    const { data: authorsData } = await admin
      .from('manuscript_authors')
      .select('*')
      .eq('manuscript_id', args.manuscriptId)
      .order('author_order', { ascending: true })
    const authors = (authorsData as ManuscriptAuthorRow[] | null) || []

    const { data: userData } = await admin
      .from('users')
      .select('*')
      .eq('id', manuscript.corresponding_author_id)
      .maybeSingle()
    const user = (userData as UserRow | null) || null

    const correspondingAuthor =
      authors.find((a) => a.is_corresponding) ||
      authors.find((a) => a.author_id === manuscript.corresponding_author_id) ||
      null

    const authorName =
      correspondingAuthor?.full_name || user?.full_name || 'Author'
    const authorEmail =
      correspondingAuthor?.email || user?.email || null

    if (authorEmail) {
      const base = siteUrl()
      const title = manuscript.title || '(untitled manuscript)'
      const submissionId = manuscript.submission_id

      if (args.decision === 'accept') {
        const { html, text } = renderEditorialDecisionAccept({
          authorName,
          submissionId,
          title,
          decisionLetter: letter,
          dashboardUrl: `${base}/dashboard`,
        })
        await sendEmail({
          to: authorEmail,
          subject: getEditorialDecisionAcceptSubject(submissionId),
          html,
          text,
          emailType: 'editorial_decision_accept',
          manuscriptId: args.manuscriptId,
        })
      } else if (args.decision === 'minor_revisions') {
        // Resolve reviewer-feedback .docx attachment (override OR
        // auto-build). Failure to build is non-fatal — the email
        // still sends with the default no-attachment copy.
        const resolved = await resolveReviewerFeedbackAttachment(
          args.manuscriptId,
          args.reviewerFeedbackOverride || null,
        )
        const { html, text } = renderEditorialDecisionMinorRevisions({
          authorName,
          submissionId,
          title,
          decisionLetter: letter,
          deadlineLabel: formatDeadlineLabel(deadlineIso),
          revisingUrl: `${base}/dashboard/submit?revising=${args.manuscriptId}`,
          hasReviewerFeedbackAttachment: resolved.hasAttachment,
        })
        await sendEmail({
          to: authorEmail,
          subject: getEditorialDecisionMinorRevisionsSubject(submissionId),
          html,
          text,
          emailType: 'editorial_decision_minor_revisions',
          manuscriptId: args.manuscriptId,
          ...(resolved.attachment
            ? { attachments: [resolved.attachment] }
            : {}),
        })
        try {
          await (admin.from('audit_logs') as any).insert({
            action: 'reviewer_feedback_attachment_resolved',
            resource_type: 'editorial_decision',
            resource_id: args.manuscriptId,
            details: {
              decision: args.decision,
              source: resolved.source,
              has_attachment: resolved.hasAttachment,
              reviewer_count: resolved.reviewerCount,
              error: resolved.error,
            },
          })
        } catch {
          // swallow — audit failure must not break the send
        }
      } else if (args.decision === 'major_revisions') {
        const resolved = await resolveReviewerFeedbackAttachment(
          args.manuscriptId,
          args.reviewerFeedbackOverride || null,
        )
        const { html, text } = renderEditorialDecisionMajorRevisions({
          authorName,
          submissionId,
          title,
          decisionLetter: letter,
          deadlineLabel: formatDeadlineLabel(deadlineIso),
          revisingUrl: `${base}/dashboard/submit?revising=${args.manuscriptId}`,
          hasReviewerFeedbackAttachment: resolved.hasAttachment,
        })
        await sendEmail({
          to: authorEmail,
          subject: getEditorialDecisionMajorRevisionsSubject(submissionId),
          html,
          text,
          emailType: 'editorial_decision_major_revisions',
          manuscriptId: args.manuscriptId,
          ...(resolved.attachment
            ? { attachments: [resolved.attachment] }
            : {}),
        })
        try {
          await (admin.from('audit_logs') as any).insert({
            action: 'reviewer_feedback_attachment_resolved',
            resource_type: 'editorial_decision',
            resource_id: args.manuscriptId,
            details: {
              decision: args.decision,
              source: resolved.source,
              has_attachment: resolved.hasAttachment,
              reviewer_count: resolved.reviewerCount,
              error: resolved.error,
            },
          })
        } catch {
          // swallow — audit failure must not break the send
        }
      } else {
        // post_review_reject (Session 13), legacy reject, or desk_reject
        const isDeskReject = args.decision === 'desk_reject'
        const { html, text } = renderEditorialDecisionReject({
          authorName,
          submissionId,
          title,
          decisionLetter: letter,
          isDeskReject,
        })
        await sendEmail({
          to: authorEmail,
          subject: getEditorialDecisionRejectSubject(submissionId, isDeskReject),
          html,
          text,
          emailType: isDeskReject
            ? 'editorial_decision_desk_reject'
            : args.decision === 'post_review_reject'
              ? 'editorial_decision_post_review_reject'
              : 'editorial_decision_reject',
          manuscriptId: args.manuscriptId,
        })
      }
    }
  } catch {
    // fire-and-forget
  }

  // 5. Optional: re-invite original reviewers on Major Revisions.
  let reInvited = 0
  let reInviteSkipped = 0
  let reInviteFailed = 0
  if (
    args.reInviteOriginalReviewers &&
    args.decision === 'major_revisions'
  ) {
    const result = await reInviteOriginalReviewers({
      admin,
      manuscriptId: args.manuscriptId,
      decisionDateIso: nowIso,
      manuscript,
    })
    reInvited = result.invited
    reInviteSkipped = result.skipped
    reInviteFailed = result.failed
  }

  revalidatePath(`/dashboard/admin/manuscripts/${args.manuscriptId}`)
  return {
    ok: true,
    decisionId,
    reInvited,
    reInviteSkipped,
    reInviteFailed,
  }
}

// ============================================================
// Bulk decision initiation audit-log (Session 14)
// ============================================================
// Records editor intent at the start of a bulk decision run so
// the audit trail captures the batch even if the editor navigates
// away mid-run. Per-manuscript audit rows are still written by
// submitEditorialDecision as each decision commits.

export interface LogBulkDecisionInitiatedArgs {
  manuscriptIds: string[]
  decision: EditorialDecisionType
  letterLength: number
}

export async function logBulkDecisionInitiated(
  args: LogBulkDecisionInitiatedArgs
): Promise<{ ok: boolean; error?: string }> {
  const gate = await requireEditorOrAdmin()
  if ('error' in gate) return { ok: false, error: gate.error }
  if (!Array.isArray(args.manuscriptIds) || args.manuscriptIds.length === 0) {
    return { ok: false, error: 'No manuscripts selected.' }
  }
  const admin = createAdminClient()
  try {
    await (admin.from('audit_logs') as any).insert({
      user_id: gate.userId,
      action: 'editorial_decision_bulk_initiated',
      resource_type: 'manuscript',
      resource_id: null,
      details: {
        manuscript_ids: args.manuscriptIds,
        count: args.manuscriptIds.length,
        decision: args.decision,
        letter_length: args.letterLength,
      },
    })
  } catch {
    // swallow — don't block the batch on a log failure
  }
  return { ok: true }
}

// ============================================================
// Decision rescind 15-min window (Session 13)
// ============================================================
// Editor-only undo of an editorial decision they themselves issued
// within the last 15 minutes. Beyond 15 min a superseding decision
// is required (a second editorial_decisions row), not a rescind.
// Desk-rejects ARE rescindable under the same 15-min window.
//
// On success:
//   1. editorial_decisions.rescinded_at + rescinded_reason set
//   2. manuscripts.status reverted to its pre-decision state
//      (see deriveRestoredStatus)
//   3. audit log: editorial_decision_rescinded
//   4. fire-and-forget apologetic email to corresponding author

export interface RescindEditorialDecisionArgs {
  decisionId: string
  reason: string
}

export interface RescindEditorialDecisionResult {
  ok: boolean
  error?: string
  forbidden?: true
  notFound?: true
  tooLate?: true
  alreadyRescinded?: true
  restoredStatus?: ManuscriptStatus
}

const MIN_RESCIND_REASON_LENGTH = 50
const MAX_RESCIND_REASON_LENGTH = 1000

async function deriveRestoredStatus(
  admin: ReturnType<typeof createAdminClient>,
  manuscriptId: string,
  rescindingDecisionId: string
): Promise<ManuscriptStatus> {
  // Look at all prior non-rescinded decisions on this manuscript,
  // EXCLUDING the one being rescinded. Most-recent first.
  const { data: priorDecisionsData } = await admin
    .from('editorial_decisions')
    .select('*')
    .eq('manuscript_id', manuscriptId)
    .is('rescinded_at', null)
    .neq('id', rescindingDecisionId)
    .order('decision_date', { ascending: false })

  const priorDecisions =
    (priorDecisionsData as EditorialDecisionRow[] | null) || []

  if (priorDecisions.length > 0) {
    // Most recent prior non-rescinded decision wins.
    const priorMapped = DECISION_TO_STATUS[priorDecisions[0].decision]
    if (priorMapped) return priorMapped
  }

  // No prior decisions. Did the manuscript ever receive a revision?
  const { data: revisionsData } = await admin
    .from('manuscript_revisions')
    .select('id')
    .eq('manuscript_id', manuscriptId)
    .limit(1)
  if (Array.isArray(revisionsData) && revisionsData.length > 0) {
    return 'revision_received'
  }

  // No revisions either. If any non-draft review exists, the
  // manuscript was already under review when the decision was
  // issued — restore to under_review. Otherwise, restore to
  // submitted.
  const { count } = await admin
    .from('reviews')
    .select('id', { count: 'exact', head: true })
    .eq('manuscript_id', manuscriptId)
    .eq('is_draft', false)

  if ((count || 0) > 0) return 'under_review'
  return 'submitted'
}

export async function rescindEditorialDecision(
  args: RescindEditorialDecisionArgs
): Promise<RescindEditorialDecisionResult> {
  const gate = await requireEditorOrAdmin()
  if ('error' in gate) return { ok: false, forbidden: true, error: gate.error }

  if (!args.decisionId || typeof args.decisionId !== 'string') {
    return { ok: false, error: 'Decision id is required.' }
  }
  const reason =
    typeof args.reason === 'string' ? args.reason.trim() : ''
  if (reason.length < MIN_RESCIND_REASON_LENGTH) {
    return {
      ok: false,
      error: `A reason of at least ${MIN_RESCIND_REASON_LENGTH} characters is required so the author understands why the decision is being undone.`,
    }
  }
  const truncatedReason = reason.slice(0, MAX_RESCIND_REASON_LENGTH)

  const admin = createAdminClient()

  const { data: dData, error: dErr } = await admin
    .from('editorial_decisions')
    .select('*')
    .eq('id', args.decisionId)
    .maybeSingle()
  if (dErr || !dData) {
    return { ok: false, notFound: true, error: 'Decision not found.' }
  }
  const decision = dData as EditorialDecisionRow

  // Ownership: only the issuing editor may rescind. Prevents one
  // editor undoing another's decision during the 15-min window.
  if (decision.editor_id !== gate.userId) {
    return {
      ok: false,
      forbidden: true,
      error: 'Only the editor who issued this decision may rescind it.',
    }
  }

  if (decision.rescinded_at) {
    return {
      ok: false,
      alreadyRescinded: true,
      error: 'This decision has already been rescinded.',
    }
  }

  const issuedAt = new Date(decision.decision_date).getTime()
  const elapsed = Date.now() - issuedAt
  if (elapsed > RESCIND_WINDOW_MS) {
    return {
      ok: false,
      tooLate: true,
      error: `The 15-minute rescind window has passed. To override this decision, issue a superseding decision instead.`,
    }
  }

  const restoredStatus = await deriveRestoredStatus(
    admin,
    decision.manuscript_id,
    decision.id
  )

  const nowIso = new Date().toISOString()

  // 1. Stamp rescinded_at + reason.
  const { error: updateDecErr } = await (
    admin.from('editorial_decisions') as any
  )
    .update({ rescinded_at: nowIso, rescinded_reason: truncatedReason })
    .eq('id', decision.id)
  if (updateDecErr) {
    return {
      ok: false,
      error: `Failed to rescind decision: ${updateDecErr.message}`,
    }
  }

  // 2. Revert manuscript status.
  const { error: updateMsErr } = await (admin.from('manuscripts') as any)
    .update({ status: restoredStatus, decision_date: null })
    .eq('id', decision.manuscript_id)
  if (updateMsErr) {
    // The rescind landed on the decision but status revert failed.
    // Surface as an error so the editor sees it; the audit-log
    // event below still fires for traceability.
    try {
      await (admin.from('audit_logs') as any).insert({
        user_id: gate.userId,
        action: 'editorial_decision_rescind_status_revert_failed',
        resource_type: 'editorial_decision',
        resource_id: decision.id,
        details: {
          decision_id: decision.id,
          manuscript_id: decision.manuscript_id,
          attempted_status: restoredStatus,
          error: updateMsErr.message,
        },
      })
    } catch {
      // swallow
    }
    return {
      ok: false,
      error: `Decision rescinded but status revert failed: ${updateMsErr.message}`,
    }
  }

  // 3. Audit log.
  const elapsedMinutes = Math.round(elapsed / 60000)
  try {
    await (admin.from('audit_logs') as any).insert({
      user_id: gate.userId,
      action: 'editorial_decision_rescinded',
      resource_type: 'editorial_decision',
      resource_id: decision.id,
      details: {
        decision_id: decision.id,
        manuscript_id: decision.manuscript_id,
        reason: truncatedReason,
        restored_status: restoredStatus,
        rescinded_minutes_after_issue: elapsedMinutes,
      },
    })
  } catch {
    // swallow
  }

  // 4. Fire-and-forget apology email.
  try {
    const { data: mData } = await admin
      .from('manuscripts')
      .select('*')
      .eq('id', decision.manuscript_id)
      .maybeSingle()
    const manuscript = (mData as ManuscriptRow | null) || null

    if (manuscript) {
      const { data: authorsData } = await admin
        .from('manuscript_authors')
        .select('*')
        .eq('manuscript_id', decision.manuscript_id)
        .order('author_order', { ascending: true })
      const authors = (authorsData as ManuscriptAuthorRow[] | null) || []
      const { data: userData } = await admin
        .from('users')
        .select('*')
        .eq('id', manuscript.corresponding_author_id)
        .maybeSingle()
      const user = (userData as UserRow | null) || null
      const corresponding =
        authors.find((a) => a.is_corresponding) ||
        authors.find(
          (a) => a.author_id === manuscript.corresponding_author_id
        ) ||
        null
      const authorName =
        corresponding?.full_name || user?.full_name || 'Author'
      const authorEmail = corresponding?.email || user?.email || null

      if (authorEmail) {
        const base = siteUrl()
        const { html, text } = renderDecisionRescindedAuthor({
          authorName,
          submissionId: manuscript.submission_id,
          manuscriptTitle: manuscript.title || '(untitled manuscript)',
          rescindedReason: truncatedReason,
          dashboardUrl: `${base}/dashboard`,
        })
        await sendEmail({
          to: authorEmail,
          subject: getDecisionRescindedAuthorSubject(manuscript.submission_id),
          html,
          text,
          emailType: 'editorial_decision_rescinded',
          manuscriptId: decision.manuscript_id,
        })
      }
    }
  } catch {
    // fire-and-forget
  }

  revalidatePath(`/dashboard/admin/manuscripts/${decision.manuscript_id}`)
  return { ok: true, restoredStatus }
}

// ============================================================
// Major-Revisions reviewer auto-re-invite (Session 13)
// ============================================================
// Helper invoked from submitEditorialDecision when
// reInviteOriginalReviewers === true and decision === 'major_revisions'.
// Enumerates reviewers who completed round 1 (non-draft reviews
// on this manuscript) and seeds fresh review_invitations rows for
// round 2, with the editor note pre-filled. Idempotent — skips
// reviewers who already have an invitation created AFTER this
// decision's date (defends against double-submits + cron retries).

const ROUND_2_DEADLINE_DAYS = 21
const ROUND_2_NOTE = `Round 2: this is a revised manuscript following major revisions. The original reviewer reports are accessible via your review dashboard.`

interface ReInviteContext {
  admin: ReturnType<typeof createAdminClient>
  manuscriptId: string
  decisionDateIso: string
  manuscript: ManuscriptRow
}

interface ReInviteResult {
  invited: number
  skipped: number
  failed: number
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

function teaseAbstract(abstract: string | null, maxLength = 900): string {
  const trimmed = (abstract || '').trim()
  if (!trimmed) return 'No abstract provided.'
  if (trimmed.length <= maxLength) return trimmed
  return `${trimmed.slice(0, maxLength).trimEnd()}…`
}

async function reInviteOriginalReviewers(
  ctx: ReInviteContext
): Promise<ReInviteResult> {
  const { admin, manuscriptId, decisionDateIso, manuscript } = ctx
  const out: ReInviteResult = { invited: 0, skipped: 0, failed: 0 }

  // Find invitations whose reviewer submitted a non-draft review.
  const { data: invData } = await admin
    .from('review_invitations')
    .select('*')
    .eq('manuscript_id', manuscriptId)
    .in('status', ['accepted', 'submitted'])

  const allInvitations =
    (invData as ReviewInvitationRow[] | null) || []
  if (allInvitations.length === 0) return out

  const { data: reviewsData } = await admin
    .from('reviews')
    .select('review_invitation_id')
    .eq('manuscript_id', manuscriptId)
    .eq('is_draft', false)

  const submittedInvitationIds = new Set<string>(
    ((reviewsData as { review_invitation_id: string }[] | null) || []).map(
      (r) => r.review_invitation_id
    )
  )

  // Dedupe by reviewer email — same human shouldn't be re-invited
  // twice if they happened to have multiple round-1 invitations.
  const seenEmails = new Set<string>()
  const round1Reviewers: ReviewInvitationRow[] = []
  for (const inv of allInvitations) {
    if (!submittedInvitationIds.has(inv.id)) continue
    const email = (inv.reviewer_email || '').toLowerCase()
    if (!email) continue
    if (seenEmails.has(email)) continue
    seenEmails.add(email)
    round1Reviewers.push(inv)
  }

  if (round1Reviewers.length === 0) return out

  // Idempotency — find any invitations CREATED AFTER decisionDateIso.
  // If a reviewer already has one, skip them.
  const { data: postDecisionInvitations } = await admin
    .from('review_invitations')
    .select('reviewer_email, status, created_at')
    .eq('manuscript_id', manuscriptId)
    .gt('created_at', decisionDateIso)

  const alreadyReInvited = new Set<string>(
    (
      (postDecisionInvitations as
        | { reviewer_email: string | null; status: string }[]
        | null) || []
    )
      .filter(
        (r) =>
          r.reviewer_email &&
          ['invited', 'accepted', 'submitted'].includes(r.status)
      )
      .map((r) => (r.reviewer_email as string).toLowerCase())
  )

  const base = siteUrl()
  const deadlineDate = new Date(decisionDateIso)
  deadlineDate.setUTCDate(deadlineDate.getUTCDate() + ROUND_2_DEADLINE_DAYS)
  const deadlineIso = deadlineDate.toISOString()

  for (const prior of round1Reviewers) {
    const email = (prior.reviewer_email || '').toLowerCase()
    if (alreadyReInvited.has(email)) {
      out.skipped += 1
      continue
    }

    const insertPayload: Record<string, unknown> = {
      manuscript_id: manuscriptId,
      reviewer_id: prior.reviewer_id,
      reviewer_application_id: prior.reviewer_application_id,
      reviewer_email: prior.reviewer_email,
      reviewer_first_name: prior.reviewer_first_name,
      reviewer_last_name: prior.reviewer_last_name,
      deadline: deadlineIso,
      // status defaults to 'invited' per schema
    }

    const { data: inserted, error: insertErr } = await (
      admin.from('review_invitations') as any
    )
      .insert(insertPayload)
      .select('id, review_token')
      .single()

    if (insertErr || !inserted) {
      out.failed += 1
      try {
        await (admin.from('audit_logs') as any).insert({
          action: 'reviewer_re_invite_failed',
          resource_type: 'review_invitation',
          resource_id: prior.id,
          details: {
            prior_review_invitation_id: prior.id,
            manuscript_id: manuscriptId,
            reviewer_email: prior.reviewer_email,
            error: insertErr?.message || 'unknown',
          },
        })
      } catch {
        // swallow
      }
      continue
    }

    const newInv = inserted as { id: string; review_token: string }

    // Fire reviewer-invitation email with Round 2 note.
    try {
      const acceptUrl = `${base}/review/${newInv.review_token}?action=accept`
      const declineUrl = `${base}/review/${newInv.review_token}?action=decline`
      const { html, text } = renderReviewerInvitation({
        firstName: prior.reviewer_first_name || 'Reviewer',
        manuscriptTitle: manuscript.title || '(untitled manuscript)',
        manuscriptType:
          MANUSCRIPT_TYPE_LABELS[manuscript.manuscript_type || ''] ||
          manuscript.manuscript_type ||
          'Not specified',
        subspecialty: manuscript.subspecialty || 'Not specified',
        abstractTeaser: teaseAbstract(manuscript.abstract),
        deadlineLabel: new Date(deadlineIso).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        }),
        editorNote: ROUND_2_NOTE,
        acceptUrl,
        declineUrl,
      })
      await sendEmail({
        to: prior.reviewer_email!,
        subject: getReviewerInvitationSubject(
          manuscript.title || '(untitled manuscript)'
        ),
        html,
        text,
        emailType: 'reviewer_invitation_round_2',
        manuscriptId,
      })
    } catch {
      // swallow — invitation row is the source of truth
    }

    try {
      await (admin.from('audit_logs') as any).insert({
        action: 'reviewer_re_invited',
        resource_type: 'review_invitation',
        resource_id: newInv.id,
        details: {
          prior_review_invitation_id: prior.id,
          new_review_invitation_id: newInv.id,
          manuscript_id: manuscriptId,
          reviewer_email: prior.reviewer_email,
          round: 2,
        },
      })
    } catch {
      // swallow
    }

    out.invited += 1
  }

  return out
}

// ============================================================
// Phase 4: publish go-live / unpublish (Session 53, 2026-05-15)
// ============================================================
// Manual go-live gate per Manvir's 2026-05-15 decision: the renderer
// produces PDF + JATS + render-report and writes their storage paths
// to `manuscripts`, but STATUS stays at 'accepted' until an admin
// explicitly clicks "Publish (go live)". That seam lets Kanwar
// review the rendered PDF + send author proof before the article
// shows up on /articles. UnpublishManuscript reverses the flip for
// emergency retraction (extra-friction confirm in the UI).

export interface PublishGoLiveResult {
  ok?: true
  error?: string
  forbidden?: true
  notFound?: true
}

export async function publishGoLive(
  manuscriptId: string
): Promise<PublishGoLiveResult> {
  const gate = await requireAdminOnly()
  if ('error' in gate) return { forbidden: true, error: gate.error }

  if (!manuscriptId || typeof manuscriptId !== 'string') {
    return { notFound: true, error: 'Manuscript id is required.' }
  }

  const admin = createAdminClient()

  const { data: mData, error: mErr } = await admin
    .from('manuscripts')
    .select('id, status, published_pdf_storage_path, published_date')
    .eq('id', manuscriptId)
    .maybeSingle()

  if (mErr || !mData) {
    return { notFound: true, error: 'Manuscript not found.' }
  }
  const m = mData as Pick<
    ManuscriptRow,
    'id' | 'status' | 'published_pdf_storage_path' | 'published_date'
  >

  if (m.status === 'published') {
    // Idempotent — already public, no-op.
    return { ok: true }
  }

  if (m.status !== 'accepted') {
    return {
      error: `Cannot publish a manuscript in status "${m.status}". Required: "accepted".`,
    }
  }

  if (!m.published_pdf_storage_path) {
    return {
      error:
        'Cannot publish: no published_pdf_storage_path on this manuscript. Run the renderer first.',
    }
  }

  // Use the existing published_date set by the renderer; only stamp
  // it here if for some reason the renderer didn't (defensive).
  const updatePayload: Record<string, unknown> = { status: 'published' }
  if (!m.published_date) {
    updatePayload.published_date = new Date().toISOString()
  }

  const { error: updErr } = await admin
    .from('manuscripts')
    .update(updatePayload as never)
    .eq('id', manuscriptId)

  if (updErr) {
    return { error: `Update failed: ${updErr.message}` }
  }

  try {
    await (admin.from('audit_logs') as any).insert({
      user_id: gate.userId,
      action: 'publish_go_live',
      resource_type: 'manuscript',
      resource_id: manuscriptId,
      details: {
        manuscript_id: manuscriptId,
        prior_status: m.status,
      },
    })
  } catch {
    // swallow
  }

  revalidatePath(`/dashboard/admin/manuscripts/${manuscriptId}`)
  revalidatePath('/articles')
  revalidatePath('/articles/in-press')

  return { ok: true }
}

export interface UnpublishManuscriptResult {
  ok?: true
  error?: string
  forbidden?: true
  notFound?: true
}

// Emergency retract — flips `published` → `accepted`. The PDF + JATS
// artifacts remain in Supabase Storage (we never delete those); only
// the public visibility flips. Standard practice in editorial
// workflows even though it's rarely used.
export async function unpublishManuscript(
  manuscriptId: string,
  reason: string
): Promise<UnpublishManuscriptResult> {
  const gate = await requireAdminOnly()
  if ('error' in gate) return { forbidden: true, error: gate.error }

  if (!manuscriptId || typeof manuscriptId !== 'string') {
    return { notFound: true, error: 'Manuscript id is required.' }
  }
  const trimmedReason = (reason || '').trim()
  if (trimmedReason.length < 10) {
    return {
      error:
        'A retraction reason of at least 10 characters is required. Logged in audit_logs for the editorial record.',
    }
  }

  const admin = createAdminClient()

  const { data: mData, error: mErr } = await admin
    .from('manuscripts')
    .select('id, status, submission_id')
    .eq('id', manuscriptId)
    .maybeSingle()

  if (mErr || !mData) {
    return { notFound: true, error: 'Manuscript not found.' }
  }
  const m = mData as Pick<ManuscriptRow, 'id' | 'status' | 'submission_id'>

  if (m.status !== 'published') {
    return {
      error: `Cannot unpublish a manuscript in status "${m.status}". Required: "published".`,
    }
  }

  const { error: updErr } = await admin
    .from('manuscripts')
    .update({ status: 'accepted' } as never)
    .eq('id', manuscriptId)

  if (updErr) {
    return { error: `Update failed: ${updErr.message}` }
  }

  try {
    await (admin.from('audit_logs') as any).insert({
      user_id: gate.userId,
      action: 'publish_unpublish',
      resource_type: 'manuscript',
      resource_id: manuscriptId,
      details: {
        manuscript_id: manuscriptId,
        submission_id: m.submission_id,
        reason: trimmedReason,
      },
    })
  } catch {
    // swallow
  }

  revalidatePath(`/dashboard/admin/manuscripts/${manuscriptId}`)
  revalidatePath('/articles')
  revalidatePath('/articles/in-press')

  return { ok: true }
}

// Renderer-launch helper: returns the URL of the local renderer's
// /render/[id] page given a manuscript id. Centralized so the UI
// doesn't hard-code the path. Falls back to the documented dev
// default localhost:3001 when NEXT_PUBLIC_RENDERER_URL is unset.
export async function getRendererLaunchUrl(
  manuscriptId: string
): Promise<{ url?: string; error?: string }> {
  const gate = await requireAdminOnly()
  if ('error' in gate) return { error: gate.error }

  const base =
    process.env.NEXT_PUBLIC_RENDERER_URL ||
    process.env.RENDERER_URL ||
    'http://localhost:3001'
  // strip trailing slash defensively
  const trimmed = base.replace(/\/+$/, '')
  return { url: `${trimmed}/render/${manuscriptId}` }
}

// ============================================================
// Pre-Render Metadata Editor (Sushant Session 57, Phase 1.B).
// Tracks Sushant Build Brief §2 "Three new server actions".
// (Imports already at top of file.)
// ============================================================

export interface PreviewMetadataValidationResult {
  ok?: true
  errors?: ValidationRow[]
  warnings?: ValidationRow[]
  forbidden?: true
  notFound?: true
  serverError?: string
}

// previewMetadataValidation — debounced 500ms from the editor form;
// runs the validator against the in-memory draft overlay WITHOUT
// writing to DB. Returns the §5 Validation Summary rows for the
// three-tier display per Franklin §5 wireframe.
export async function previewMetadataValidation(
  manuscriptId: string,
  draft: ManuscriptDraftOverlay
): Promise<PreviewMetadataValidationResult> {
  const gate = await requireAdminOnly()
  if ('error' in gate) return { forbidden: true, serverError: gate.error }

  if (!manuscriptId || typeof manuscriptId !== 'string') {
    return { notFound: true, serverError: 'Manuscript id is required.' }
  }

  const admin = createAdminClient()

  // Fetch the read-side data we need to merge with the draft.
  const [mRes, aRes, metaRes, affCountRes, figCountRes] = await Promise.all([
    admin
      .from('manuscripts')
      .select(
        'id, title, running_title, doi, manuscript_type, keywords, abstract, submission_date, manuscript_body_cleaned_html'
      )
      .eq('id', manuscriptId)
      .maybeSingle(),
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
      .from('manuscript_affiliations')
      .select('id', { count: 'exact', head: true })
      .eq('manuscript_id', manuscriptId),
    // Session 80 — figure count for the §5 body-structural checks.
    admin
      .from('manuscript_files')
      .select('id', { count: 'exact', head: true })
      .eq('manuscript_id', manuscriptId)
      .eq('file_type', 'figure'),
  ])

  if (!mRes.data) return { notFound: true, serverError: 'Manuscript not found.' }

  type ManuscriptHead = {
    id: string
    title: string | null
    running_title: string | null
    doi: string | null
    manuscript_type: import('@/lib/types/database').ManuscriptType | null
    keywords: string[] | null
    abstract: string | null
    submission_date: string | null
    manuscript_body_cleaned_html: string | null
  }
  const m = mRes.data as unknown as ManuscriptHead
  const dbAuthors = (aRes.data as ManuscriptAuthorRow[] | null) ?? []
  const meta = (metaRes.data as ManuscriptMetadataRow | null) ?? null
  const affCount = affCountRes.count ?? 0
  const figCount = figCountRes.count ?? 0

  // Overlay draft onto DB rows
  const title = draft.title ?? m.title ?? ''
  const running_title = draft.running_title ?? m.running_title ?? ''
  const doi = draft.doi ?? m.doi ?? ''
  const keywords = draft.keywords ?? m.keywords ?? []
  const abstract = draft.abstract ?? m.abstract ?? ''

  // Authors overlay: if draft.authors present, use it; otherwise fall
  // back to DB rows.
  const mergedAuthors = (draft.authors ?? dbAuthors).map((a, idx) => {
    if ('id' in a && a.id) {
      const dbRow = dbAuthors.find((d) => d.id === a.id)
      return {
        full_name: (a.full_name ?? dbRow?.full_name) || '',
        email: (a.email ?? dbRow?.email) || '',
        affiliation: (a.affiliation ?? dbRow?.affiliation) || '',
        orcid_id: (a.orcid_id ?? dbRow?.orcid_id) || '',
        contribution: (a.contribution ?? dbRow?.contribution) || '',
        is_corresponding: a.is_corresponding ?? dbRow?.is_corresponding ?? false,
        is_equal_contribution:
          a.is_equal_contribution ?? dbRow?.is_equal_contribution ?? false,
      }
    }
    // No id — treat as draft-only author (e.g., DB row order or full overlay)
    const fallback = dbAuthors[idx]
    return {
      full_name: (a.full_name ?? fallback?.full_name) || '',
      email: (a.email ?? fallback?.email) || '',
      affiliation: (a.affiliation ?? fallback?.affiliation) || '',
      orcid_id: (a.orcid_id ?? fallback?.orcid_id) || '',
      contribution: (a.contribution ?? fallback?.contribution) || '',
      is_corresponding: a.is_corresponding ?? fallback?.is_corresponding ?? false,
      is_equal_contribution:
        a.is_equal_contribution ?? fallback?.is_equal_contribution ?? false,
    }
  })

  const merged = {
    manuscript_type: m.manuscript_type,
    title,
    running_title,
    doi,
    keywords,
    abstract,
    submission_date: m.submission_date,
    authors: mergedAuthors,
    conflict_of_interest:
      (draft.conflict_of_interest ?? meta?.conflict_of_interest) || '',
    funding_sources:
      (draft.funding_sources ?? meta?.funding_sources) || [],
    data_availability_statement:
      (draft.data_availability_statement ?? meta?.data_availability_statement) || '',
    ai_tools_used:
      draft.ai_tools_used !== undefined ? draft.ai_tools_used : meta?.ai_tools_used ?? null,
    ai_tools_details:
      (draft.ai_tools_details ?? meta?.ai_tools_details) || '',
    patient_consent_variant:
      (draft.patient_consent_variant !== undefined
        ? draft.patient_consent_variant
        : meta?.patient_consent_variant) ?? null,
    patient_consent_statement:
      (draft.patient_consent_statement ?? meta?.patient_consent_statement) || '',
    patient_consent_irb_institution:
      (draft.patient_consent_irb_institution ?? meta?.patient_consent_irb_institution) || '',
    patient_consent_irb_protocol:
      (draft.patient_consent_irb_protocol ?? meta?.patient_consent_irb_protocol) || '',
    equal_contribution_statement:
      (draft.equal_contribution_statement ?? meta?.equal_contribution_statement) || '',
    has_affiliations_table_data: affCount > 0,
    // Session 80 — body-structural inputs. Body HTML is not editable in
    // this form (BodyEditor owns it), so no draft overlay applies.
    body_html: m.manuscript_body_cleaned_html,
    figure_count: figCount,
  }

  const result = await validateMetadataForRender(merged)
  return { ok: true, errors: result.errors, warnings: result.warnings }
}

export interface UpdateManuscriptMetadataResult {
  ok?: true
  error?: string
  forbidden?: true
  notFound?: true
  fieldsChanged?: string[]
}

// updateManuscriptMetadata — transactional save across 3 tables:
// manuscripts, manuscript_authors, manuscript_metadata. Audit log
// row metadata_edit written on success. Gates: requireAdminOnly +
// status ∈ {'accepted', 'published'} per Janine §10 (post-acceptance
// edit only).
//
// Phase 1.B caveat: Supabase JS client has no .transaction() — writes
// are sequential. On partial failure, surface the error + the field
// list that did persist. Production rollback is not implemented; the
// editor can retry the save. Per §7 Risk #5 in the build brief.
export async function updateManuscriptMetadata(
  manuscriptId: string,
  patch: ManuscriptDraftOverlay & {
    authors_full?: Array<{
      id?: string | null
      full_name: string
      degrees: string | null
      email: string
      affiliation: string | null
      orcid_id: string | null
      contribution: string | null
      is_corresponding: boolean
      is_equal_contribution: boolean
      author_order: number
    }>
    handling_editor_id?: string | null
  }
): Promise<UpdateManuscriptMetadataResult> {
  const gate = await requireAdminOnly()
  if ('error' in gate) return { forbidden: true, error: gate.error }

  if (!manuscriptId || typeof manuscriptId !== 'string') {
    return { notFound: true, error: 'Manuscript id is required.' }
  }

  const admin = createAdminClient()

  const { data: mData } = await admin
    .from('manuscripts')
    .select('id, status')
    .eq('id', manuscriptId)
    .maybeSingle()

  const m = mData as { id: string; status: ManuscriptStatus } | null
  if (!m) return { notFound: true, error: 'Manuscript not found.' }
  if (m.status !== 'accepted' && m.status !== 'published') {
    return {
      error: `Cannot edit metadata for manuscript in status "${m.status}". Required: "accepted" or "published".`,
    }
  }

  const fieldsChanged: string[] = []

  // ---- Update manuscripts row ----
  const manuscriptUpdate: Record<string, unknown> = {}
  if (patch.title !== undefined) {
    manuscriptUpdate.title = patch.title
    fieldsChanged.push('title')
  }
  if (patch.running_title !== undefined) {
    manuscriptUpdate.running_title = patch.running_title
    fieldsChanged.push('running_title')
  }
  if (patch.doi !== undefined) {
    // The DOI field in the editor is display-only/auto-generated. A blank DB
    // value surfaces as '' in the form and would be re-written as '' here.
    // Because idx_manuscripts_doi_unique is a partial index over non-NULL doi,
    // two empty strings collide (empty string is NOT NULL). Normalize blank/
    // whitespace to NULL so placeholder DOIs never collide across manuscripts.
    const trimmedDoi = (patch.doi ?? '').trim()
    manuscriptUpdate.doi = trimmedDoi === '' ? null : trimmedDoi
    fieldsChanged.push('doi')
  }
  if (patch.keywords !== undefined) {
    manuscriptUpdate.keywords = patch.keywords
    fieldsChanged.push('keywords')
  }
  if (patch.abstract !== undefined) {
    manuscriptUpdate.abstract = patch.abstract
    fieldsChanged.push('abstract')
  }

  if (Object.keys(manuscriptUpdate).length > 0) {
    const { error: mErr } = await admin
      .from('manuscripts')
      .update(manuscriptUpdate as never)
      .eq('id', manuscriptId)
    if (mErr) {
      return { error: `manuscripts update failed: ${mErr.message}` }
    }
  }

  // ---- Update manuscript_metadata ----
  // Ensure a row exists; insert blank if missing.
  let metaRowId: string | null = null
  const { data: metaProbe } = await admin
    .from('manuscript_metadata')
    .select('id')
    .eq('manuscript_id', manuscriptId)
    .maybeSingle()
  metaRowId = (metaProbe as { id: string } | null)?.id ?? null

  if (!metaRowId) {
    const { data: ins, error: insErr } = await admin
      .from('manuscript_metadata')
      .insert({ manuscript_id: manuscriptId } as never)
      .select('id')
      .single()
    if (insErr) {
      return {
        error: `manuscript_metadata insert failed: ${insErr.message}`,
      }
    }
    metaRowId = (ins as { id: string }).id
  }

  const metaUpdate: Record<string, unknown> = {}
  const metaPatchFields: Array<keyof ManuscriptDraftOverlay> = [
    'conflict_of_interest',
    'funding_sources',
    'data_availability_statement',
    'ethics_approval_number',
    'ai_tools_used',
    'ai_tools_details',
    'patient_consent_variant',
    'patient_consent_statement',
    'patient_consent_irb_institution',
    'patient_consent_irb_protocol',
    'acknowledgments',
    'equal_contribution_statement',
  ]
  for (const f of metaPatchFields) {
    if (patch[f] !== undefined) {
      metaUpdate[f] = patch[f]
      fieldsChanged.push(`metadata.${f}`)
    }
  }

  if (Object.keys(metaUpdate).length > 0) {
    const { error: mUpdErr } = await admin
      .from('manuscript_metadata')
      .update(metaUpdate as never)
      .eq('manuscript_id', manuscriptId)
    if (mUpdErr) {
      return {
        error: `manuscript_metadata update failed (${fieldsChanged.length} prior fields persisted): ${mUpdErr.message}`,
      }
    }
  }

  // ---- Replace manuscript_authors (delete + bulk insert) ----
  // Authors are full-array overlay because reordering changes
  // author_order on every row and per-author CRediT/equal-contrib
  // flags are independent. Insert order matches editor display.
  if (patch.authors_full && patch.authors_full.length > 0) {
    const { error: delErr } = await admin
      .from('manuscript_authors')
      .delete()
      .eq('manuscript_id', manuscriptId)
    if (delErr) {
      return {
        error: `manuscript_authors delete failed (${fieldsChanged.length} prior fields persisted): ${delErr.message}`,
      }
    }

    const inserts = patch.authors_full.map((a) => ({
      manuscript_id: manuscriptId,
      author_order: a.author_order,
      full_name: a.full_name,
      degrees: a.degrees,
      email: a.email,
      affiliation: a.affiliation,
      orcid_id: a.orcid_id,
      contribution: a.contribution,
      is_corresponding: a.is_corresponding,
      is_equal_contribution: a.is_equal_contribution,
    }))

    const { error: insErr } = await admin
      .from('manuscript_authors')
      .insert(inserts as never)
    if (insErr) {
      return {
        error: `manuscript_authors insert failed (authors deleted!): ${insErr.message}. Recovery required — contact Sushant.`,
      }
    }
    fieldsChanged.push(`authors (${inserts.length})`)
  }

  // ---- Audit log ----
  try {
    await (admin.from('audit_logs') as any).insert({
      user_id: gate.userId,
      action: 'metadata_edit',
      resource_type: 'manuscript',
      resource_id: manuscriptId,
      details: {
        manuscript_id: manuscriptId,
        fields_changed: fieldsChanged,
      },
    })
  } catch {
    // swallow
  }

  revalidatePath(`/dashboard/admin/manuscripts/${manuscriptId}`)
  return { ok: true, fieldsChanged }
}

// resolveOrcid — server-side proxy for the public ORCID API. Used
// by the §3 Authors "Resolve from ORCID ↗" button. Server-side to
// dodge any browser CORS quirks; the public-record API does allow
// CORS but proxying it through our server lets us log usage in
// audit_logs for rate-tracking + retry-on-429 (Franklin Risk #3).
export interface ResolveOrcidResult {
  ok?: true
  given_name?: string
  family_name?: string
  current_affiliation?: string | null
  error?: string
  forbidden?: true
}

export async function resolveOrcid(orcidId: string): Promise<ResolveOrcidResult> {
  const gate = await requireAdminOnly()
  if ('error' in gate) return { forbidden: true, error: gate.error }

  const trimmed = (orcidId || '').trim()
  const m = trimmed.match(/^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/)
  if (!m) {
    return { error: 'ORCID format must be XXXX-XXXX-XXXX-XXXX (16 chars, hyphens, last char digit or X).' }
  }

  try {
    const resp = await fetch(`https://pub.orcid.org/v3.0/${trimmed}/person`, {
      headers: { Accept: 'application/json' },
      // 429 retry handled by caller; one shot here.
    })
    if (resp.status === 429) {
      return { error: 'ORCID rate-limited (429). Wait a few seconds and try again.' }
    }
    if (resp.status === 404) {
      return { error: `ORCID iD ${trimmed} not found in the public registry.` }
    }
    if (!resp.ok) {
      return { error: `ORCID API returned ${resp.status} ${resp.statusText}.` }
    }
    const json = (await resp.json()) as Record<string, unknown>
    const name = (json.name as Record<string, unknown> | undefined) ?? {}
    const given = ((name['given-names'] as Record<string, unknown> | undefined) ?? {})['value'] as string | undefined
    const family = ((name['family-name'] as Record<string, unknown> | undefined) ?? {})['value'] as string | undefined

    // current affiliation is exposed via /employments not /person;
    // for Phase 1 we surface name only. Affiliation lookup adds a
    // second request — defer to Phase 1.B+ if time permits.
    return {
      ok: true,
      given_name: given,
      family_name: family,
      current_affiliation: null,
    }
  } catch (err) {
    return { error: `ORCID fetch failed: ${err instanceof Error ? err.message : String(err)}` }
  }
}

// listEditorialBoardMembers — for the handling-editor override
// dropdown. Sources from lib/schema/editorialBoard.ts so the
// editor pool matches what's on /editorial-board.
export interface BoardMemberOption {
  user_id: string | null
  name: string
  role: string | null
}

export async function listAvailableEditors(): Promise<BoardMemberOption[]> {
  const gate = await requireAdminOnly()
  if ('error' in gate) return []

  const admin = createAdminClient()
  const { data } = await admin
    .from('users')
    .select('id, full_name, role')
    .in('role', ['editor', 'admin'])
    .order('full_name', { ascending: true })

  type EditorRow = { id: string; full_name: string; role: string }
  const rows = (data as EditorRow[] | null) ?? []
  return rows.map((r) => ({
    user_id: r.id,
    name: r.full_name,
    role: r.role,
  }))
}

// ============================================================
// Phase 2 HTML body editor — Sushant Session 64 (2026-05-19).
// ============================================================
// Persist editor-cleaned body HTML to
// `manuscripts.manuscript_body_cleaned_html` (migration 024). The
// renderer's preview + publish endpoints read this column and pass
// it verbatim as `cleanedHtml` when non-null; when null/empty they
// fall through to the Session 62 extractBody auto-extraction path.
//
// Status-gated to manuscript.status ∈ {accepted, published} mirroring
// the metadata-editor gate above. Gates: requireAdminOnly per §6.1.
// Audit log row `body_cleaned_html_saved` written on success.
//
// HTML SANITIZATION: TipTap's emitted HTML is already conservative
// (no scripts, no event-handlers, only the extensions we configured),
// but we re-sanitize server-side as defense-in-depth — a compromised
// browser could ship arbitrary HTML directly to the server action.
// The allowlist below mirrors the TipTap extension set + the table
// tags the existing renderer cleanedHtml pathway tolerates (the
// renderer's body extraction already emits <table>/<thead>/<tbody>/
// <tr>/<th>/<td>; we accept them here for paste-from-renderer flows).

export interface SaveManuscriptBodyCleanedHtmlResult {
  ok: boolean
  forbidden?: true
  notFound?: true
  error?: string
}

// Cap the persisted HTML at 2 MB. Word documents with embedded
// base64 images can balloon HTML output; this catches accidental
// 50-MB-of-base64 paste-from-renderer scenarios before they hit the
// database column. Plenty of headroom for a normal case report
// (~10-30 KB of HTML).
const MAX_BODY_HTML_BYTES = 2 * 1024 * 1024

export async function saveManuscriptBodyCleanedHtml(
  manuscriptId: string,
  html: string
): Promise<SaveManuscriptBodyCleanedHtmlResult> {
  const gate = await requireAdminOnly()
  if ('error' in gate) return { ok: false, forbidden: true, error: gate.error }

  if (!manuscriptId || typeof manuscriptId !== 'string') {
    return { ok: false, notFound: true, error: 'Manuscript id is required.' }
  }
  if (typeof html !== 'string') {
    return { ok: false, error: 'Body HTML must be a string.' }
  }

  // Trim + byte-cap before sanitization (cheap pre-check).
  const incoming = html.trim()
  if (Buffer.byteLength(incoming, 'utf8') > MAX_BODY_HTML_BYTES) {
    return {
      ok: false,
      error: `Body HTML exceeds the ${Math.round(MAX_BODY_HTML_BYTES / 1024)} KB limit. Reduce embedded base64 images or split into a leaner body.`,
    }
  }

  // Sanitize. Empty string passes through as empty (null in DB ->
  // renderer auto-extract fallback path).
  const cleaned =
    incoming === ''
      ? ''
      : sanitizeHtml(incoming, {
          allowedTags: [
            // Block-level
            'p',
            'h1',
            'h2',
            'h3',
            'h4',
            'h5',
            'h6',
            'blockquote',
            'pre',
            'hr',
            'div',
            'section',
            'figure',
            'figcaption',
            // Lists
            'ul',
            'ol',
            'li',
            // Inline
            'strong',
            'em',
            'b',
            'i',
            'u',
            's',
            'sub',
            'sup',
            'span',
            'code',
            'br',
            'a',
            // Tables (read-only in MVP toolbar; preserved on paste from
            // renderer cleanup pane)
            'table',
            'thead',
            'tbody',
            'tfoot',
            'tr',
            'th',
            'td',
            'caption',
            // Images
            'img',
          ],
          allowedAttributes: {
            a: ['href', 'name', 'target', 'rel', 'title'],
            img: ['src', 'alt', 'title', 'width', 'height'],
            // Table cells often carry rowspan/colspan from Pandoc.
            th: ['colspan', 'rowspan', 'scope', 'align'],
            td: ['colspan', 'rowspan', 'align'],
            // Keep generic class hooks the renderer's Jinja template
            // may use (e.g., 'figure-caption').
            '*': ['class', 'id'],
          },
          // Permit data: URLs for inline images (TipTap allows base64
          // images via setImage). https:// + relative URLs also OK.
          allowedSchemes: ['http', 'https', 'mailto', 'tel', 'data'],
          allowedSchemesByTag: {
            img: ['http', 'https', 'data'],
          },
          // Drop comments, script, style, iframe, object, embed
          // implicitly (not on the allowlist).
          disallowedTagsMode: 'discard',
          // Preserve text inside disallowed tags rather than dropping
          // the content along with the tag.
          allowedSchemesAppliedToAttributes: ['href', 'src'],
        })

  const admin = createAdminClient()

  const { data: mData } = await admin
    .from('manuscripts')
    .select('id, status')
    .eq('id', manuscriptId)
    .maybeSingle()

  const m = mData as { id: string; status: ManuscriptStatus } | null
  if (!m) return { ok: false, notFound: true, error: 'Manuscript not found.' }
  if (m.status !== 'accepted' && m.status !== 'published') {
    return {
      ok: false,
      error: `Cannot edit body HTML for manuscript in status "${m.status}". Required: "accepted" or "published".`,
    }
  }

  // Persist. Empty string becomes NULL so the precedence chain in
  // preview/publish endpoints can branch cleanly on null-vs-non-null
  // without also having to check for empty.
  const persistedValue: string | null = cleaned === '' ? null : cleaned

  const { error: updateErr } = await admin
    .from('manuscripts')
    .update({ manuscript_body_cleaned_html: persistedValue } as never)
    .eq('id', manuscriptId)

  if (updateErr) {
    return {
      ok: false,
      error: `Save failed: ${updateErr.message}`,
    }
  }

  // Best-effort audit-log.
  try {
    await (admin.from('audit_logs') as any).insert({
      user_id: gate.userId,
      action: 'body_cleaned_html_saved',
      resource_type: 'manuscript',
      resource_id: manuscriptId,
      details: {
        manuscript_id: manuscriptId,
        bytes_persisted: Buffer.byteLength(cleaned, 'utf8'),
        cleared: persistedValue === null,
      },
    })
  } catch {
    // swallow
  }

  // Revalidate the admin manuscript detail page so the editor surface
  // re-renders with the saved state on next navigation. The TipTap
  // editor itself already shows the saved state via local state.
  revalidatePath(`/dashboard/admin/manuscripts/${manuscriptId}`)

  return { ok: true }
}
