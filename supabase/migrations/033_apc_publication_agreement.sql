-- ============================================================
-- 033_apc_publication_agreement.sql
--
-- The launch-window APC waiver expired 2026-07-31. From
-- 2026-08-01 every accepted manuscript carries a flat $399 USD
-- article processing charge, and the corresponding author must
-- explicitly accept the Author Publication Agreement as a
-- required step in the submission wizard before the manuscript
-- can be submitted.
--
-- We record the acceptance itself, the moment it happened, the
-- version of the agreement that was on screen, and the fee
-- amount quoted at that moment. Snapshotting the amount matters:
-- a later price change must never retroactively alter what an
-- author agreed to pay, and clause 13 of the agreement promises
-- exactly that.
--
-- Existing rows default to false. That is correct and deliberate
-- — everything already in the table was submitted under the
-- waiver and is grandfathered, so it neither has nor needs an
-- acceptance record. Grandfathering is decided by submission
-- date, not by this column.
-- ============================================================

ALTER TABLE manuscript_metadata
  ADD COLUMN IF NOT EXISTS apc_agreement_accepted boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS apc_agreement_accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS apc_agreement_version text,
  ADD COLUMN IF NOT EXISTS apc_agreement_amount_cents integer;

COMMENT ON COLUMN manuscript_metadata.apc_agreement_accepted IS
  'True once the corresponding author ticked all clauses of the Author Publication Agreement in the submission wizard. False on pre-2026-08-01 rows, which are grandfathered under the retired launch-window waiver.';

COMMENT ON COLUMN manuscript_metadata.apc_agreement_accepted_at IS
  'UTC timestamp of the acceptance. Set once and never overwritten on subsequent draft saves.';

COMMENT ON COLUMN manuscript_metadata.apc_agreement_version IS
  'Version stamp of the agreement text the author actually saw (APC_AGREEMENT_VERSION in lib/apc/config.ts).';

COMMENT ON COLUMN manuscript_metadata.apc_agreement_amount_cents IS
  'The APC in cents as quoted to the author at acceptance time. Authoritative for invoicing; a later price change does not apply retroactively.';

-- Lets the finance side pull every submission awaiting an
-- acceptance invoice without scanning the whole table.
CREATE INDEX IF NOT EXISTS idx_manuscript_metadata_apc_agreement
  ON manuscript_metadata(apc_agreement_accepted)
  WHERE apc_agreement_accepted = true;

-- PostgREST schema cache reload (Convention: every schema-changing migration
-- referenced by application code ends with this). Without it the submission
-- wizard's first write hits "Could not find the 'apc_agreement_accepted'
-- column in the schema cache" until PostgREST's ~10-minute auto-refresh.
notify pgrst, 'reload schema';
