-- ============================================================
-- Migration 003: Resend integration columns on email_logs
-- ============================================================
-- Adds columns to track Resend message IDs and delivery webhook events,
-- and extends the email_delivery_status enum with 'delivered' and
-- 'complained' so the webhook handler can update logs accordingly.
--
-- Run this manually in the Supabase SQL Editor (consistent with prior
-- migrations).
-- ============================================================

ALTER TABLE email_logs
  ADD COLUMN IF NOT EXISTS resend_message_id text,
  ADD COLUMN IF NOT EXISTS bounce_reason text,
  ADD COLUMN IF NOT EXISTS delivered_at timestamptz,
  ADD COLUMN IF NOT EXISTS bounced_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_email_logs_resend_message_id
  ON email_logs(resend_message_id);

-- Extend email_delivery_status enum. ADD VALUE IF NOT EXISTS is required
-- because PostgreSQL enum modifications cannot run inside a transaction
-- block that also references the new value, and IF NOT EXISTS makes the
-- migration safely re-runnable.
ALTER TYPE email_delivery_status ADD VALUE IF NOT EXISTS 'delivered';
ALTER TYPE email_delivery_status ADD VALUE IF NOT EXISTS 'complained';
