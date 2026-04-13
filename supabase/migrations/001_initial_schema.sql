-- ============================================================
-- OSCRSJ Submission Portal: Initial Schema Migration
-- Created: 2026-04-13
-- Description: Creates all 12 Phase 1 tables, enums, sequences,
--   submission ID generator, and updated_at trigger.
-- ============================================================

-- ============================================================
-- 1. CUSTOM ENUM TYPES
-- ============================================================

CREATE TYPE user_role AS ENUM ('author', 'reviewer', 'editor', 'admin');

CREATE TYPE manuscript_type AS ENUM (
  'case_report',
  'case_series',
  'surgical_technique',
  'images_in_orthopedics',
  'letter_to_editor',
  'review_article'
);

CREATE TYPE manuscript_status AS ENUM (
  'draft',
  'submitted',
  'desk_rejected',
  'withdrawn',
  'under_review',
  'revision_requested',
  'revision_received',
  'accepted',
  'awaiting_payment',
  'in_production',
  'published'
);

CREATE TYPE file_type AS ENUM (
  'manuscript',
  'blinded_manuscript',
  'figure',
  'supplement',
  'cover_letter',
  'ethics_approval',
  'response_to_reviewers',
  'tracked_changes'
);

CREATE TYPE waiver_type AS ENUM ('none', 'full', 'trainee', 'first_pub', 'custom');

CREATE TYPE payment_status AS ENUM ('pending', 'paid', 'overdue', 'waived', 'refunded');

CREATE TYPE invitation_status AS ENUM ('invited', 'accepted', 'declined', 'submitted', 'cancelled');

CREATE TYPE review_recommendation AS ENUM ('accept', 'minor_revisions', 'major_revisions', 'reject');

CREATE TYPE editorial_decision_type AS ENUM ('accept', 'reject', 'major_revisions', 'minor_revisions', 'desk_reject');

CREATE TYPE email_delivery_status AS ENUM ('sent', 'bounced', 'failed');


-- ============================================================
-- 2. SUBMISSION ID SEQUENCE AND GENERATOR FUNCTION
-- ============================================================

CREATE SEQUENCE submission_id_seq START WITH 1 INCREMENT BY 1;

-- Returns IDs in the format OSCRSJ-YYYY-NNNN using the current year
-- and a zero-padded sequence number.
CREATE OR REPLACE FUNCTION generate_submission_id()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  seq_val integer;
  current_year text;
BEGIN
  seq_val := nextval('submission_id_seq');
  current_year := to_char(now(), 'YYYY');
  RETURN 'OSCRSJ-' || current_year || '-' || lpad(seq_val::text, 4, '0');
END;
$$;


-- ============================================================
-- 3. UPDATED_AT TRIGGER FUNCTION
-- ============================================================

-- Automatically sets updated_at to the current timestamp on row modification.
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


-- ============================================================
-- 4. TABLES
-- ============================================================

-- 4.1 users
-- Extends Supabase auth.users with profile data.
CREATE TABLE users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL UNIQUE,
  full_name text NOT NULL,
  orcid_id text,
  affiliation text,
  country text,
  degrees text,
  role user_role NOT NULL DEFAULT 'author',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- 4.2 manuscripts
CREATE TABLE manuscripts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id text UNIQUE DEFAULT generate_submission_id(),
  corresponding_author_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  title text,
  abstract text,
  keywords text[],
  manuscript_type manuscript_type,
  subspecialty text,
  status manuscript_status NOT NULL DEFAULT 'draft',
  withdrawal_reason text,
  note_to_editor text,
  submission_date timestamptz,
  decision_date timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_manuscripts_author ON manuscripts(corresponding_author_id);
CREATE INDEX idx_manuscripts_status ON manuscripts(status);
CREATE INDEX idx_manuscripts_submission_id ON manuscripts(submission_id);

CREATE TRIGGER manuscripts_updated_at
  BEFORE UPDATE ON manuscripts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- 4.3 manuscript_authors
CREATE TABLE manuscript_authors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  manuscript_id uuid NOT NULL REFERENCES manuscripts(id) ON DELETE CASCADE,
  author_id uuid REFERENCES users(id) ON DELETE SET NULL,
  author_order integer NOT NULL,
  full_name text NOT NULL,
  email text NOT NULL,
  affiliation text,
  orcid_id text,
  degrees text,
  contribution text,
  is_corresponding boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_manuscript_authors_manuscript ON manuscript_authors(manuscript_id);
CREATE INDEX idx_manuscript_authors_author ON manuscript_authors(author_id);


-- 4.4 manuscript_files
CREATE TABLE manuscript_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  manuscript_id uuid NOT NULL REFERENCES manuscripts(id) ON DELETE CASCADE,
  original_filename text NOT NULL,
  file_name text NOT NULL,
  file_type file_type NOT NULL,
  storage_path text NOT NULL,
  file_size_bytes bigint NOT NULL,
  file_order integer NOT NULL DEFAULT 0,
  version integer NOT NULL DEFAULT 1,
  upload_date timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_manuscript_files_manuscript ON manuscript_files(manuscript_id);


-- 4.5 manuscript_metadata
CREATE TABLE manuscript_metadata (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  manuscript_id uuid NOT NULL UNIQUE REFERENCES manuscripts(id) ON DELETE CASCADE,
  conflict_of_interest text,
  funding_sources text[],
  data_availability_statement text,
  ethics_approval_number text,
  clinical_trial_id text,
  author_consent_certified boolean NOT NULL DEFAULT false,
  not_under_review_elsewhere boolean NOT NULL DEFAULT false,
  not_previously_published boolean NOT NULL DEFAULT false,
  all_authors_agreed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER manuscript_metadata_updated_at
  BEFORE UPDATE ON manuscript_metadata
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- 4.6 payments
CREATE TABLE payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  manuscript_id uuid NOT NULL REFERENCES manuscripts(id) ON DELETE RESTRICT,
  stripe_invoice_id text,
  stripe_payment_intent_id text,
  amount_cents integer NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'usd',
  waiver_type waiver_type NOT NULL DEFAULT 'none',
  waiver_percentage integer NOT NULL DEFAULT 0 CHECK (waiver_percentage >= 0 AND waiver_percentage <= 100),
  status payment_status NOT NULL DEFAULT 'pending',
  invoice_sent_date timestamptz,
  payment_date timestamptz,
  reminder_sent_date timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_payments_manuscript ON payments(manuscript_id);

CREATE TRIGGER payments_updated_at
  BEFORE UPDATE ON payments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- 4.7 review_invitations
CREATE TABLE review_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  manuscript_id uuid NOT NULL REFERENCES manuscripts(id) ON DELETE CASCADE,
  reviewer_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  invited_date timestamptz NOT NULL DEFAULT now(),
  deadline timestamptz,
  status invitation_status NOT NULL DEFAULT 'invited',
  response_date timestamptz,
  review_token text UNIQUE DEFAULT gen_random_uuid()::text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_review_invitations_manuscript ON review_invitations(manuscript_id);
CREATE INDEX idx_review_invitations_reviewer ON review_invitations(reviewer_id);
CREATE INDEX idx_review_invitations_token ON review_invitations(review_token);

CREATE TRIGGER review_invitations_updated_at
  BEFORE UPDATE ON review_invitations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- 4.8 reviews
CREATE TABLE reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_invitation_id uuid NOT NULL REFERENCES review_invitations(id) ON DELETE CASCADE,
  manuscript_id uuid NOT NULL REFERENCES manuscripts(id) ON DELETE CASCADE,
  reviewer_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  recommendation review_recommendation,
  quality_score integer CHECK (quality_score >= 1 AND quality_score <= 5),
  novelty_score integer CHECK (novelty_score >= 1 AND novelty_score <= 5),
  rigor_score integer CHECK (rigor_score >= 1 AND rigor_score <= 5),
  data_score integer CHECK (data_score >= 1 AND data_score <= 5),
  clarity_score integer CHECK (clarity_score >= 1 AND clarity_score <= 5),
  scope_score integer CHECK (scope_score >= 1 AND scope_score <= 5),
  comments_to_author text,
  comments_to_editor text,
  conflict_of_interest text,
  submitted_date timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_reviews_manuscript ON reviews(manuscript_id);
CREATE INDEX idx_reviews_reviewer ON reviews(reviewer_id);
CREATE INDEX idx_reviews_invitation ON reviews(review_invitation_id);


-- 4.9 editorial_decisions
CREATE TABLE editorial_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  manuscript_id uuid NOT NULL REFERENCES manuscripts(id) ON DELETE CASCADE,
  editor_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  decision editorial_decision_type NOT NULL,
  decision_letter text,
  revision_deadline timestamptz,
  decision_date timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_editorial_decisions_manuscript ON editorial_decisions(manuscript_id);


-- 4.10 manuscript_revisions
CREATE TABLE manuscript_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  manuscript_id uuid NOT NULL REFERENCES manuscripts(id) ON DELETE CASCADE,
  revision_number integer NOT NULL,
  response_to_reviewers text,
  note_to_editor text,
  submitted_date timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_manuscript_revisions_manuscript ON manuscript_revisions(manuscript_id);


-- 4.11 email_logs
CREATE TABLE email_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender text NOT NULL,
  recipient text NOT NULL,
  subject text NOT NULL,
  email_type text NOT NULL,
  manuscript_id uuid REFERENCES manuscripts(id) ON DELETE SET NULL,
  sent_date timestamptz NOT NULL DEFAULT now(),
  delivery_status email_delivery_status NOT NULL DEFAULT 'sent',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_email_logs_manuscript ON email_logs(manuscript_id);
CREATE INDEX idx_email_logs_recipient ON email_logs(recipient);


-- 4.12 audit_logs
CREATE TABLE audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  action text NOT NULL,
  resource_type text NOT NULL,
  resource_id text,
  ip_address text,
  timestamp timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX idx_audit_logs_timestamp ON audit_logs(timestamp);
