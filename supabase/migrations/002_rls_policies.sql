-- ============================================================
-- OSCRSJ Submission Portal: Row-Level Security Policies
-- Created: 2026-04-13
-- Description: Enables RLS on all tables and creates access
--   policies based on user roles.
-- ============================================================

-- Helper function: check if the current user has a given role
CREATE OR REPLACE FUNCTION public.user_has_role(required_role user_role)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role = required_role
  );
$$;

-- Helper function: check if user is editor or admin
CREATE OR REPLACE FUNCTION public.is_editor_or_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('editor', 'admin')
  );
$$;

-- Helper function: check if user is an author on a manuscript
CREATE OR REPLACE FUNCTION public.is_manuscript_participant(ms_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.manuscripts
    WHERE id = ms_id AND corresponding_author_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM public.manuscript_authors
    WHERE manuscript_id = ms_id AND author_id = auth.uid()
  );
$$;


-- ============================================================
-- 1. USERS
-- ============================================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own profile"
  ON users FOR SELECT
  USING (id = auth.uid());

CREATE POLICY "Users can update own profile"
  ON users FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY "Users can insert own profile"
  ON users FOR INSERT
  WITH CHECK (id = auth.uid());

CREATE POLICY "Editors and admins can read all users"
  ON users FOR SELECT
  USING (is_editor_or_admin());


-- ============================================================
-- 2. MANUSCRIPTS
-- ============================================================
ALTER TABLE manuscripts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authors can read own manuscripts"
  ON manuscripts FOR SELECT
  USING (is_manuscript_participant(id));

CREATE POLICY "Editors and admins can read all manuscripts"
  ON manuscripts FOR SELECT
  USING (is_editor_or_admin());

CREATE POLICY "Authors can create manuscripts"
  ON manuscripts FOR INSERT
  WITH CHECK (corresponding_author_id = auth.uid());

CREATE POLICY "Authors can update own drafts"
  ON manuscripts FOR UPDATE
  USING (corresponding_author_id = auth.uid() AND status = 'draft')
  WITH CHECK (corresponding_author_id = auth.uid());

CREATE POLICY "Editors can update any manuscript"
  ON manuscripts FOR UPDATE
  USING (is_editor_or_admin());


-- ============================================================
-- 3. MANUSCRIPT_AUTHORS
-- ============================================================
ALTER TABLE manuscript_authors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authors can read co-authors on own manuscripts"
  ON manuscript_authors FOR SELECT
  USING (is_manuscript_participant(manuscript_id));

CREATE POLICY "Editors can read all manuscript authors"
  ON manuscript_authors FOR SELECT
  USING (is_editor_or_admin());

CREATE POLICY "Authors can add co-authors to own manuscripts"
  ON manuscript_authors FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM manuscripts
      WHERE id = manuscript_id
      AND corresponding_author_id = auth.uid()
      AND status = 'draft'
    )
  );

CREATE POLICY "Authors can update co-authors on own drafts"
  ON manuscript_authors FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM manuscripts
      WHERE id = manuscript_id
      AND corresponding_author_id = auth.uid()
      AND status = 'draft'
    )
  );

CREATE POLICY "Authors can remove co-authors from own drafts"
  ON manuscript_authors FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM manuscripts
      WHERE id = manuscript_id
      AND corresponding_author_id = auth.uid()
      AND status = 'draft'
    )
  );


-- ============================================================
-- 4. MANUSCRIPT_FILES
-- ============================================================
ALTER TABLE manuscript_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authors can read files on own manuscripts"
  ON manuscript_files FOR SELECT
  USING (is_manuscript_participant(manuscript_id));

CREATE POLICY "Editors can read all manuscript files"
  ON manuscript_files FOR SELECT
  USING (is_editor_or_admin());

CREATE POLICY "Authors can upload files to own drafts"
  ON manuscript_files FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM manuscripts
      WHERE id = manuscript_id
      AND corresponding_author_id = auth.uid()
      AND status IN ('draft', 'revision_requested')
    )
  );

CREATE POLICY "Authors can delete files from own drafts"
  ON manuscript_files FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM manuscripts
      WHERE id = manuscript_id
      AND corresponding_author_id = auth.uid()
      AND status IN ('draft', 'revision_requested')
    )
  );


-- ============================================================
-- 5. MANUSCRIPT_METADATA
-- ============================================================
ALTER TABLE manuscript_metadata ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authors can read metadata on own manuscripts"
  ON manuscript_metadata FOR SELECT
  USING (is_manuscript_participant(manuscript_id));

CREATE POLICY "Editors can read all metadata"
  ON manuscript_metadata FOR SELECT
  USING (is_editor_or_admin());

CREATE POLICY "Authors can insert metadata for own manuscripts"
  ON manuscript_metadata FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM manuscripts
      WHERE id = manuscript_id
      AND corresponding_author_id = auth.uid()
    )
  );

CREATE POLICY "Authors can update metadata on own drafts"
  ON manuscript_metadata FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM manuscripts
      WHERE id = manuscript_id
      AND corresponding_author_id = auth.uid()
      AND status = 'draft'
    )
  );


-- ============================================================
-- 6. PAYMENTS
-- ============================================================
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authors can read own payments"
  ON payments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM manuscripts
      WHERE id = manuscript_id
      AND corresponding_author_id = auth.uid()
    )
  );

CREATE POLICY "Editors and admins can read all payments"
  ON payments FOR SELECT
  USING (is_editor_or_admin());

-- Insert and update for payments is service-role only (Stripe webhooks).
-- No user-facing policies for INSERT/UPDATE.


-- ============================================================
-- 7. REVIEW_INVITATIONS
-- ============================================================
ALTER TABLE review_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Reviewers can read own invitations"
  ON review_invitations FOR SELECT
  USING (reviewer_id = auth.uid());

CREATE POLICY "Editors can read all invitations"
  ON review_invitations FOR SELECT
  USING (is_editor_or_admin());

CREATE POLICY "Reviewers can update own invitation status"
  ON review_invitations FOR UPDATE
  USING (reviewer_id = auth.uid())
  WITH CHECK (reviewer_id = auth.uid());


-- ============================================================
-- 8. REVIEWS
-- ============================================================
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Reviewers can read own reviews"
  ON reviews FOR SELECT
  USING (reviewer_id = auth.uid());

CREATE POLICY "Editors can read all reviews"
  ON reviews FOR SELECT
  USING (is_editor_or_admin());

CREATE POLICY "Reviewers can insert own reviews"
  ON reviews FOR INSERT
  WITH CHECK (reviewer_id = auth.uid());

CREATE POLICY "Reviewers can update own reviews"
  ON reviews FOR UPDATE
  USING (reviewer_id = auth.uid())
  WITH CHECK (reviewer_id = auth.uid());


-- ============================================================
-- 9. EDITORIAL_DECISIONS
-- ============================================================
ALTER TABLE editorial_decisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authors can read decisions on own manuscripts"
  ON editorial_decisions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM manuscripts
      WHERE id = manuscript_id
      AND is_manuscript_participant(manuscripts.id)
    )
  );

CREATE POLICY "Editors can read all decisions"
  ON editorial_decisions FOR SELECT
  USING (is_editor_or_admin());

CREATE POLICY "Editors can create decisions"
  ON editorial_decisions FOR INSERT
  WITH CHECK (is_editor_or_admin());


-- ============================================================
-- 10. MANUSCRIPT_REVISIONS
-- ============================================================
ALTER TABLE manuscript_revisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authors can read own revisions"
  ON manuscript_revisions FOR SELECT
  USING (is_manuscript_participant(manuscript_id));

CREATE POLICY "Authors can submit revisions"
  ON manuscript_revisions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM manuscripts
      WHERE id = manuscript_id
      AND corresponding_author_id = auth.uid()
      AND status = 'revision_requested'
    )
  );

CREATE POLICY "Editors can read all revisions"
  ON manuscript_revisions FOR SELECT
  USING (is_editor_or_admin());


-- ============================================================
-- 11. EMAIL_LOGS
-- ============================================================
ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only admins can read email logs"
  ON email_logs FOR SELECT
  USING (user_has_role('admin'));

-- Insert is service-role only (email sending code).


-- ============================================================
-- 12. AUDIT_LOGS
-- ============================================================
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only admins can read audit logs"
  ON audit_logs FOR SELECT
  USING (user_has_role('admin'));

-- Insert is service-role only (triggered by server-side code).
