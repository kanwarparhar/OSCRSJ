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

export type WaiverType = 'none' | 'full' | 'trainee' | 'first_pub' | 'custom'

export type PaymentStatus = 'pending' | 'paid' | 'overdue' | 'waived' | 'refunded'

export type InvitationStatus = 'invited' | 'accepted' | 'declined' | 'submitted' | 'cancelled'

export type ReviewRecommendation = 'accept' | 'minor_revisions' | 'major_revisions' | 'reject'

export type EditorialDecisionType = 'accept' | 'reject' | 'major_revisions' | 'minor_revisions' | 'desk_reject'

export type EmailDeliveryStatus = 'sent' | 'bounced' | 'failed'


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
  created_at: string
  updated_at: string
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
  reviewer_id: string
  invited_date: string
  deadline: string | null
  status: InvitationStatus
  response_date: string | null
  review_token: string
  created_at: string
  updated_at: string
}

export interface ReviewRow {
  id: string
  review_invitation_id: string
  manuscript_id: string
  reviewer_id: string
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
  submitted_date: string | null
  created_at: string
}

export interface EditorialDecisionRow {
  id: string
  manuscript_id: string
  editor_id: string
  decision: EditorialDecisionType
  decision_letter: string | null
  revision_deadline: string | null
  decision_date: string
  created_at: string
}

export interface ManuscriptRevisionRow {
  id: string
  manuscript_id: string
  revision_number: number
  response_to_reviewers: string | null
  note_to_editor: string | null
  submitted_date: string
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
  created_at: string
}

export interface AuditLogRow {
  id: string
  user_id: string | null
  action: string
  resource_type: string
  resource_id: string | null
  ip_address: string | null
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
  reviewer_id: string
  deadline?: string | null
  status?: InvitationStatus
}

export interface ReviewInsert {
  review_invitation_id: string
  manuscript_id: string
  reviewer_id: string
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
}

export interface AuditLogInsert {
  user_id?: string | null
  action: string
  resource_type: string
  resource_id?: string | null
  ip_address?: string | null
}


// ---- Update Types (partial, for updates) ----

export type UserUpdate = Partial<Omit<UserInsert, 'id'>>

export type ManuscriptUpdate = Partial<ManuscriptInsert>

export type ManuscriptAuthorUpdate = Partial<Omit<ManuscriptAuthorInsert, 'manuscript_id'>>

export type ManuscriptFileUpdate = Partial<Omit<ManuscriptFileInsert, 'manuscript_id'>>

export type ManuscriptMetadataUpdate = Partial<Omit<ManuscriptMetadataInsert, 'manuscript_id'>>

export type PaymentUpdate = Partial<Omit<PaymentInsert, 'manuscript_id'>>

export type ReviewInvitationUpdate = Partial<Omit<ReviewInvitationInsert, 'manuscript_id' | 'reviewer_id'>>

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
    }
  }
}
