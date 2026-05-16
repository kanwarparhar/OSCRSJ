-- Migration 022 — Pre-Render Metadata Editor columns (Sushant Session 57, 2026-05-15).
--
-- Adds the column shape Janine signed off on at
-- [[Pre-Render Editor Compliance Spec]] §4 to back the
-- Pre-Render Metadata Editor & PDF Preview project.
--
-- Six new columns on manuscript_metadata + one new column on
-- manuscript_authors + one index on the consent-variant column
-- for future audit queries. The 7-variant patient_consent_variant
-- vocabulary is enforced via a CHECK constraint (not an ENUM —
-- Janine §4 reason: cheaper to extend later if a future variant
-- emerges such as `genomic_data_special_consent`).
--
-- Closes Janine inbound handoff
--   ^handoff-metadata-editor-compliance-spec-signed-off
-- Closes Franklin inbound handoff
--   ^handoff-metadata-editor-ux-design-2026-05-15
-- Tracks Manvir build-brief
--   02 - OSCRSJ/Projects/Pre-Render Metadata Editor — Sushant Build Brief.md §5
--
-- IMPORTANT: NOTIFY pgrst at the bottom is required per CLAUDE.md
-- Convention §"PostgREST schema cache". Without it the schema cache
-- waits ~10 minutes before picking up the new columns and writes to
-- the new columns will fail with "Could not find the 'X' column in
-- the schema cache" until that timer fires.

-- ============================================================
-- manuscript_metadata — 6 new columns
-- ============================================================

ALTER TABLE manuscript_metadata
  ADD COLUMN IF NOT EXISTS patient_consent_variant TEXT
    CHECK (patient_consent_variant IS NULL OR patient_consent_variant IN (
      'adult_living',
      'pediatric_minor',
      'deceased_next_of_kin',
      'deceased_irb_waiver',
      'incapacitated_irb_waiver',
      'deidentified_no_consent_required',
      'not_applicable'
    )),
  ADD COLUMN IF NOT EXISTS patient_consent_statement TEXT,
  ADD COLUMN IF NOT EXISTS patient_consent_irb_institution TEXT,
  ADD COLUMN IF NOT EXISTS patient_consent_irb_protocol TEXT,
  ADD COLUMN IF NOT EXISTS acknowledgments TEXT,
  ADD COLUMN IF NOT EXISTS equal_contribution_statement TEXT;

COMMENT ON COLUMN manuscript_metadata.patient_consent_variant IS
  '7-value Janine §3 taxonomy. NULL on rows that predate migration 022; the metadata editor surfaces a 🚨 RED error until the editor selects a variant. Waiver branches (deceased_irb_waiver, incapacitated_irb_waiver) require institution + protocol below.';

COMMENT ON COLUMN manuscript_metadata.patient_consent_statement IS
  'Verbatim consent statement rendered in the PDF/JATS post-references block. Pre-filled from the variant default on selection (Janine §3 table); editor may free-edit.';

COMMENT ON COLUMN manuscript_metadata.patient_consent_irb_institution IS
  'IRB institution name. Populated only when patient_consent_variant ∈ {deceased_irb_waiver, incapacitated_irb_waiver}; NULL otherwise per Franklin §4 conditional-reveal-block contract.';

COMMENT ON COLUMN manuscript_metadata.patient_consent_irb_protocol IS
  'IRB protocol number. Populated only when patient_consent_variant ∈ {deceased_irb_waiver, incapacitated_irb_waiver}; NULL otherwise.';

COMMENT ON COLUMN manuscript_metadata.acknowledgments IS
  'Optional non-author thanks block. ICMJE reminder: thanked persons need written permission. Rendered as a separate <ack> in JATS and as the trailing acknowledgments paragraph in the PDF.';

COMMENT ON COLUMN manuscript_metadata.equal_contribution_statement IS
  'Statement surfaced when ≥2 authors are flagged manuscript_authors.is_equal_contribution=true. Pre-filled from Janine §7.2.b verbatim default; editor may free-edit. NULL when fewer than 2 equal-contribution authors are flagged.';

-- ============================================================
-- manuscript_authors — 1 new column
-- ============================================================

ALTER TABLE manuscript_authors
  ADD COLUMN IF NOT EXISTS is_equal_contribution BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN manuscript_authors.is_equal_contribution IS
  'Per-author equal-first-authorship flag. When ≥2 authors flagged + equal_contribution_statement non-null on the manuscript_metadata row, the synthesizer derives equal_contribution.present=true and the JATS emitter writes <contrib equal-contrib="yes"> + <author-notes><fn fn-type="equal">. Per Janine §7.2.b.';

-- ============================================================
-- Index for future audit queries — "how many published case reports
-- used IRB waivers?" — per Janine §4 (low-cost, future-proofs the
-- compliance audit workflow).
-- ============================================================

CREATE INDEX IF NOT EXISTS manuscript_metadata_consent_variant_idx
  ON manuscript_metadata (patient_consent_variant);

-- ============================================================
-- PostgREST schema-cache refresh — mandatory per Convention.
-- ============================================================

NOTIFY pgrst, 'reload schema';
