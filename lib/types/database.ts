// ============================================================
// OSCRSJ Database Types
// Manually written to match the Supabase schema (001_initial_schema.sql).
// These will be replaced by auto-generated types once `supabase gen types`
// is configured.
// ============================================================

// ---- Enum Types ----

export type UserRole = 'author' | 'reviewer' | 'editor' | 'admin'

export type ManuscriptType =
  | 'case_report'
  | 'case_series'
  | 'surgical_technique'
  | 'images_in_orthopedics'
  | 'letter_to_editor'
  | 'review_article'

export type ManuscriptStatus =
  | 'draft'
  | 'submitted'
  | 'desk_rejected'
  | 'rejected'
  | 'withdrawn'
  | 'under_review'
  | 'revision_requested'
  | 'revision_received'
  | 'accepted'
  | 'awaiting_payment'
  | 'in_production'
  | 'published'

export type FileType =
  | 'manuscript'
  | 'blinded_manuscript'
  | 'figure'
  | 'supplement'
  | 'cover_letter'
  | 'ethics_approval'
  | 'response_to_reviewers'
  | 'tracked_changes'
  | 'title_page'  // Session 19 (2026-04-25) — v1.1 multi-file submissions
  | 'tables'      // Session 19 (2026-04-25) — v1.1 multi-file submissions

export type WaiverType = 'none' | 'full' | 'trainee' | 'first_pub' | 'custom'

export type PaymentStatus = 'pending' | 'paid' | 'overdue' | 'waived' | 'refunded'

export type InvitationStatus = 'invited' | 'accepted' | 'declined' | 'submitted' | 'cancelled'

export type ReviewRecommendation = 'accept' | 'minor_revisions' | 'major_revisions' | 'reject'

export type EditorialDecisionType =
  | 'accept'
  | 'reject'
  | 'post_review_reject'
  | 'major_revisions'
  | 'minor_revisions'
  | 'desk_reject'

export type EmailDeliveryStatus =
  | 'sent'
  | 'delivered'
  | 'bounced'
  | 'complained'
  | 'failed'

export type CareerStage =
  | 'med_student'
  | 'resident'
  | 'fellow'
  | 'attending'
  | 'other'

export type ReviewerApplicationStatus =
  | 'pending'
  | 'approved'
  | 'active'
  | 'declined'
  | 'withdrawn'


// ---- Row Types (what you get back from a SELECT) ----

export interface UserRow {
  id: string
  email: string
  full_name: string
  orcid_id: string | null
  affiliation: string | null
  country: string | null
  degrees: string | null
  role: UserRole
  created_at: string
  updated_at: string
}

export interface ManuscriptRow {
  id: string
  submission_id: string
  corresponding_author_id: string
  title: string | null
  abstract: string | null
  keywords: string[] | null
  manuscript_type: ManuscriptType | null
  subspecialty: string | null
  status: ManuscriptStatus
  withdrawal_reason: string | null
  note_to_editor: string | null
  submission_date: string | null
  decision_date: string | null
  // Phase 4 publishing pipeline columns (migration 013). Nullable
  // because every pre-Phase-4 manuscript row predates these columns.
  elocation_id: string | null
  accepted_date: string | null
  published_date: string | null
  running_title: string | null
  published_pdf_storage_path: string | null
  render_report_storage_path: string | null
  doi: string | null
  created_at: string
  updated_at: string
}

// manuscript_affiliations row (migration 013). Normalises authors'
// free-text affiliations out of users.affiliation / manuscript_authors.affiliation
// and supports the PMC evidence packet (RoR IDs, department-level
// granularity, multi-affiliation authors, country-of-record).
export interface ManuscriptAffiliationRow {
  id: string
  manuscript_id: string
  author_id: string | null
  manuscript_author_id: string | null
  affiliation_order: number
  affiliation_name: string
  department: string | null
  city: string | null
  country: string | null
  ror_id: string | null
  created_at: string
  updated_at: string
}

export interface ManuscriptAuthorRow {
  id: string
  manuscript_id: string
  author_id: string | null
  author_order: number
  full_name: string
  email: string
  affiliation: string | null
  orcid_id: string | null
  degrees: string | null
  contribution: string | null
  is_corresponding: boolean
  created_at: string
}

export interface ManuscriptFileRow {
  id: string
  manuscript_id: string
  original_filename: string
  file_name: string
  file_type: FileType
  storage_path: string
  file_size_bytes: number
  file_order: number
  version: number
  upload_date: string
}

export interface ManuscriptMetadataRow {
  id: string
  manuscript_id: string
  conflict_of_interest: string | null
  funding_sources: string[] | null
  data_availability_statement: string | null
  ethics_approval_number: string | null
  clinical_trial_id: string | null
  author_consent_certified: boolean
  not_under_review_elsewhere: boolean
  not_previously_published: boolean
  all_authors_agreed: boolean
  co_author_disputes: CoAuthorDispute[]
  ai_tools_used: boolean
  ai_tools_details: string | null
  all_reviews_notified_at: string | null
  revision_reminder_sent_at: string | null
  created_at: string
  updated_at: string
}

export interface CoAuthorDispute {
  email: string
  disputed_at: string
}

export interface PaymentRow {
  id: string
  manuscript_id: string
  stripe_invoice_id: string | null
  stripe_payment_intent_id: string | null
  amount_cents: number
  currency: string
  waiver_type: WaiverType
  waiver_percentage: number
  status: PaymentStatus
  invoice_sent_date: string | null
  payment_date: string | null
  reminder_sent_date: string | null
  created_at: string
  updated_at: string
}

export interface ReviewInvitationRow {
  id: string
  manuscript_id: string
  reviewer_id: string | null
  reviewer_application_id: string | null
  reviewer_email: string | null
  reviewer_first_name: string | null
  reviewer_last_name: string | null
  invited_date: string
  deadline: string | null
  status: InvitationStatus
  response_date: string | null
  declined_reason: string | null
  review_token: string
  reminder_ten_day_sent_at: string | null
  reminder_five_day_sent_at: string | null
  reminder_overdue_sent_at: string | null
  suggested_alternative_name: string | null
  suggested_alternative_email: string | null
  suggested_alternative_reason: string | null
  created_at: string
  updated_at: string
}

export interface ReviewRow {
  id: string
  review_invitation_id: string
  manuscript_id: string
  reviewer_id: string | null
  recommendation: ReviewRecommendation | null
  quality_score: number | null
  novelty_score: number | null
  rigor_score: number | null
  data_score: number | null
  clarity_score: number | null
  scope_score: number | null
  comments_to_author: string | null
  comments_to_editor: string | null
  conflict_of_interest: string | null
  is_draft: boolean
  review_invitation_id_snapshot_email: string | null
  submitted_date: string | null
  created_at: string
}

// Author-record shape captured inside pre_revision_snapshot (and
// mirrored into manuscript_revisions.snapshot_authors jsonb).
// Matches the manuscript_authors columns relevant to a diff.
export interface SnapshotAuthor {
  author_order: number
  full_name: string
  email: string
  affiliation: string | null
  orcid_id: string | null
  degrees: string | null
  contribution: string | null
  is_corresponding: boolean
}

// Snapshot payload persisted as jsonb in editorial_decisions.pre_revision_snapshot
// when a Minor/Major Revisions decision is issued (migration 012). Mirrored
// into manuscript_revisions snapshot_* columns when submitRevision runs.
export interface PreRevisionSnapshot {
  title: string | null
  abstract: string | null
  keywords: string[] | null
  subspecialty: string | null
  authors: SnapshotAuthor[]
}

// ----------------------------------------------------------------
// Phase 4: published PDF render-report.json (Submission Portal
// Architecture Plan §6.11). One JSON file ships alongside every
// published PDF in Supabase Storage; the admin /render-report
// viewer parses it and displays it collapsibly. Janine attaches
// this file (or subset) to ISSN / Crossref / DOAJ / PMC
// applications as technical-conformance provenance.
// ----------------------------------------------------------------

export interface RenderReport {
  schemaVersion: string
  manuscriptId: string
  submissionId: string
  renderedAt: string
  pipelineVersion: string
  toolVersions: Record<string, string>
  input: {
    sourceDocxSha256: string
    sourceDocxBytes: number
    splitReferencesCount: number
  }
  cleanupPass: {
    durationSeconds: number
    diffSummary: {
      linesAdded: number
      linesRemoved: number
      charactersChanged: number
    }
    diffPatch?: string
  }
  verapdf: {
    conformance: string
    result: 'pass' | 'fail' | 'warn'
    warnings: string[]
    failures: string[]
    rawOutput?: string
  }
  fontEmbedCheck: {
    allFontsEmbedded: boolean
    fonts: Array<{
      family: string
      subset?: boolean
      embedded?: boolean
      rasterized?: boolean
      note?: string
    }>
  }
  sanityTests: Record<string, boolean | number>
  xmpPacket?: string
  output: {
    pdfSha256: string
    pdfBytes: number
    pdfStoragePath: string
  }
  wallclockSeconds: number
}

export interface EditorialDecisionRow {
  id: string
  manuscript_id: string
  editor_id: string
  decision: EditorialDecisionType
  decision_letter: string | null
  revision_deadline: string | null
  decision_date: string
  rescinded_at: string | null
  rescinded_reason: string | null
  pre_revision_snapshot: PreRevisionSnapshot | null
  created_at: string
}

export interface ManuscriptRevisionRow {
  id: string
  manuscript_id: string
  revision_number: number
  response_to_reviewers: string | null
  note_to_editor: string | null
  submitted_date: string
  // Migration 012: per-field mirrors of editorial_decisions.pre_revision_snapshot
  // captured at the moment the Minor/Major Revisions decision was issued.
  // NULL on revisions that predate migration 012 or revisions triggered by a
  // decision that predates it (no retroactive backfill).
  snapshot_title: string | null
  snapshot_abstract: string | null
  snapshot_keywords: string[] | null
  snapshot_subspecialty: string | null
  snapshot_authors: SnapshotAuthor[] | null
  snapshot_source: 'editorial_decision' | null
  snapshot_captured_at: string | null
  created_at: string
}

export interface EmailLogRow {
  id: string
  sender: string
  recipient: string
  subject: string
  email_type: string
  manuscript_id: string | null
  sent_date: string
  delivery_status: EmailDeliveryStatus
  resend_message_id: string | null
  bounce_reason: string | null
  delivered_at: string | null
  bounced_at: string | null
  created_at: string
}

export interface ReviewerApplicationRow {
  id: string
  created_at: string
  first_name: string
  last_name: string
  email: string
  orcid_id: string | null
  affiliation: string
  country: string
  career_stage: CareerStage
  subspecialty_interests: string[]
  writing_sample_url: string | null
  heard_about: string | null
  status: ReviewerApplicationStatus
  reviewed_by: string | null
  reviewed_at: string | null
  admin_notes: string | null
}

export interface ReviewerApplicationInsert {
  first_name: string
  last_name: string
  email: string
  orcid_id?: string | null
  affiliation: string
  country: string
  career_stage: CareerStage
  subspecialty_interests?: string[]
  writing_sample_url?: string | null
  heard_about?: string | null
  status?: ReviewerApplicationStatus
}

export type ReviewerApplicationUpdate = Partial<
  Omit<ReviewerApplicationInsert, 'email'>
> & {
  reviewed_by?: string | null
  reviewed_at?: string | null
  admin_notes?: string | null
}

export interface AuditLogRow {
  id: string
  user_id: string | null
  action: string
  resource_type: string
  resource_id: string | null
  ip_address: string | null
  details: Record<string, unknown> | null
  timestamp: string
}


// ---- Insert Types (what you send to create a row) ----

export interface UserInsert {
  id: string
  email: string
  full_name: string
  orcid_id?: string | null
  affiliation?: string | null
  country?: string | null
  degrees?: string | null
  role?: UserRole
}

export interface ManuscriptInsert {
  corresponding_author_id: string
  title?: string | null
  abstract?: string | null
  keywords?: string[] | null
  manuscript_type?: ManuscriptType | null
  subspecialty?: string | null
  status?: ManuscriptStatus
  withdrawal_reason?: string | null
  note_to_editor?: string | null
  submission_date?: string | null
}

export interface ManuscriptAuthorInsert {
  manuscript_id: string
  author_id?: string | null
  author_order: number
  full_name: string
  email: string
  affiliation?: string | null
  orcid_id?: string | null
  degrees?: string | null
  contribution?: string | null
  is_corresponding?: boolean
}

export interface ManuscriptFileInsert {
  manuscript_id: string
  original_filename: string
  file_name: string
  file_type: FileType
  storage_path: string
  file_size_bytes: number
  file_order?: number
  version?: number
}

export interface ManuscriptMetadataInsert {
  manuscript_id: string
  conflict_of_interest?: string | null
  funding_sources?: string[] | null
  data_availability_statement?: string | null
  ethics_approval_number?: string | null
  clinical_trial_id?: string | null
  author_consent_certified?: boolean
  not_under_review_elsewhere?: boolean
  not_previously_published?: boolean
  all_authors_agreed?: boolean
  ai_tools_used?: boolean
  ai_tools_details?: string | null
}

export interface PaymentInsert {
  manuscript_id: string
  stripe_invoice_id?: string | null
  stripe_payment_intent_id?: string | null
  amount_cents?: number
  currency?: string
  waiver_type?: WaiverType
  waiver_percentage?: number
  status?: PaymentStatus
  invoice_sent_date?: string | null
  payment_date?: string | null
}

export interface ReviewInvitationInsert {
  manuscript_id: string
  reviewer_id?: string | null
  reviewer_application_id?: string | null
  reviewer_email?: string | null
  reviewer_first_name?: string | null
  reviewer_last_name?: string | null
  deadline?: string | null
  status?: InvitationStatus
  declined_reason?: string | null
  suggested_alternative_name?: string | null
  suggested_alternative_email?: string | null
  suggested_alternative_reason?: string | null
}

export interface ReviewInsert {
  review_invitation_id: string
  manuscript_id: string
  reviewer_id?: string | null
  recommendation?: ReviewRecommendation | null
  quality_score?: number | null
  novelty_score?: number | null
  rigor_score?: number | null
  data_score?: number | null
  clarity_score?: number | null
  scope_score?: number | null
  comments_to_author?: string | null
  comments_to_editor?: string | null
  conflict_of_interest?: string | null
  is_draft?: boolean
  review_invitation_id_snapshot_email?: string | null
  submitted_date?: string | null
}

export interface EditorialDecisionInsert {
  manuscript_id: string
  editor_id: string
  decision: EditorialDecisionType
  decision_letter?: string | null
  revision_deadline?: string | null
  decision_date?: string
}

export interface ManuscriptRevisionInsert {
  manuscript_id: string
  revision_number: number
  response_to_reviewers?: string | null
  note_to_editor?: string | null
}

export interface EmailLogInsert {
  sender: string
  recipient: string
  subject: string
  email_type: string
  manuscript_id?: string | null
  delivery_status?: EmailDeliveryStatus
  resend_message_id?: string | null
  bounce_reason?: string | null
  delivered_at?: string | null
  bounced_at?: string | null
}

export interface AuditLogInsert {
  user_id?: string | null
  action: string
  resource_type: string
  resource_id?: string | null
  ip_address?: string | null
  details?: Record<string, unknown> | null
}


// ---- Update Types (partial, for updates) ----

export type UserUpdate = Partial<Omit<UserInsert, 'id'>>

export type ManuscriptUpdate = Partial<ManuscriptInsert>

export type ManuscriptAuthorUpdate = Partial<Omit<ManuscriptAuthorInsert, 'manuscript_id'>>

export type ManuscriptFileUpdate = Partial<Omit<ManuscriptFileInsert, 'manuscript_id'>>

export type ManuscriptMetadataUpdate = Partial<Omit<ManuscriptMetadataInsert, 'manuscript_id'>>

export type PaymentUpdate = Partial<Omit<PaymentInsert, 'manuscript_id'>>

export type ReviewInvitationUpdate = Partial<Omit<ReviewInvitationInsert, 'manuscript_id'>> & {
  response_date?: string | null
}

export type ReviewUpdate = Partial<Omit<ReviewInsert, 'review_invitation_id' | 'manuscript_id' | 'reviewer_id'>>

export type EditorialDecisionUpdate = Partial<Omit<EditorialDecisionInsert, 'manuscript_id' | 'editor_id'>>


// ---- Composite Types (for queries that join tables) ----

export interface ManuscriptWithDetails extends ManuscriptRow {
  authors: ManuscriptAuthorRow[]
  files: ManuscriptFileRow[]
  metadata: ManuscriptMetadataRow | null
}


// ---- Supabase Database Type (for typed client) ----

export interface Database {
  public: {
    Tables: {
      users: {
        Row: UserRow
        Insert: UserInsert
        Update: UserUpdate
      }
      manuscripts: {
        Row: ManuscriptRow
        Insert: ManuscriptInsert
        Update: ManuscriptUpdate
      }
      manuscript_authors: {
        Row: ManuscriptAuthorRow
        Insert: ManuscriptAuthorInsert
        Update: ManuscriptAuthorUpdate
      }
      manuscript_files: {
        Row: ManuscriptFileRow
        Insert: ManuscriptFileInsert
        Update: ManuscriptFileUpdate
      }
      manuscript_metadata: {
        Row: ManuscriptMetadataRow
        Insert: ManuscriptMetadataInsert
        Update: ManuscriptMetadataUpdate
      }
      payments: {
        Row: PaymentRow
        Insert: PaymentInsert
        Update: PaymentUpdate
      }
      review_invitations: {
        Row: ReviewInvitationRow
        Insert: ReviewInvitationInsert
        Update: ReviewInvitationUpdate
      }
      reviews: {
        Row: ReviewRow
        Insert: ReviewInsert
        Update: ReviewUpdate
      }
      editorial_decisions: {
        Row: EditorialDecisionRow
        Insert: EditorialDecisionInsert
        Update: EditorialDecisionUpdate
      }
      manuscript_revisions: {
        Row: ManuscriptRevisionRow
        Insert: ManuscriptRevisionInsert
        Update: Partial<ManuscriptRevisionInsert>
      }
      email_logs: {
        Row: EmailLogRow
        Insert: EmailLogInsert
        Update: Partial<EmailLogInsert>
      }
      audit_logs: {
        Row: AuditLogRow
        Insert: AuditLogInsert
        Update: Partial<AuditLogInsert>
      }
      reviewer_applications: {
        Row: ReviewerApplicationRow
        Insert: ReviewerApplicationInsert
        Update: ReviewerApplicationUpdate
      }
    }
    Functions: {
      generate_submission_id: {
        Args: Record<string, never>
        Returns: string
      }
    }
    Enums: {
      user_role: UserRole
      manuscript_type: ManuscriptType
      manuscript_status: ManuscriptStatus
      file_type: FileType
      waiver_type: WaiverType
      payment_status: PaymentStatus
      invitation_status: InvitationStatus
      review_recommendation: ReviewRecommendation
      editorial_decision_type: EditorialDecisionType
      email_delivery_status: EmailDeliveryStatus
      career_stage: CareerStage
      reviewer_application_status: ReviewerApplicationStatus
    }
  }
}
