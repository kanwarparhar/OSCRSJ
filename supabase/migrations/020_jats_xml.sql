-- Migration 020 — JATS XML storage path on manuscripts.
--
-- Sushant Session 19 (2026-05-06). Adds the JATS Publishing 1.3 XML
-- artifact slot to the publishing-lifecycle column set landed in
-- Migration 013. Single column add, idempotent. No data migration —
-- pre-launch, no published rows exist in prod, so every existing row
-- legitimately has jats_xml_storage_path = NULL.
--
-- Storage path convention (per lib/renderer/storage.ts in
-- ~/Documents/oscrsj-renderer/): jats_xml/{manuscript_id}.xml inside
-- the existing 'manuscripts' Supabase Storage bucket. Path is stable
-- per manuscript_id; re-publishing overwrites the slot (one published
-- JATS artifact per manuscript, mirrors the PDF/render-report.json
-- pattern).
--
-- Tracks Manvir handoff
-- ^handoff-jats-xml-implementation-2026-05-05 (P0 — gates Gate 5
-- PMC application path; every article published without JATS
-- becomes retroactive technical debt).
--
-- Trailing NOTIFY pgrst, 'reload schema' per CLAUDE.md §Conventions
-- (PostgREST schema-cache convention) — without it, application
-- writes hit "Could not find the 'jats_xml_storage_path' column in
-- the schema cache" until PostgREST's ~10-minute auto-refresh fires.

ALTER TABLE manuscripts
ADD COLUMN IF NOT EXISTS jats_xml_storage_path TEXT;

COMMENT ON COLUMN manuscripts.jats_xml_storage_path IS
  'Supabase Storage path (within manuscripts bucket) of the rendered JATS Publishing 1.3 XML. Populated by the OSCRSJ Renderer publish chain (lib/renderer/storage.ts). NULL until first published. Format: jats_xml/{manuscript_id}.xml. Sushant Session 19 (2026-05-06). Tracks PMC indexing prerequisite per Manvir handoff ^handoff-jats-xml-implementation-2026-05-05.';

-- Force PostgREST to re-read the schema so application writes see
-- jats_xml_storage_path immediately, not after the ~10-min cache
-- expiry. Safe to repeat if the migration is re-run.
NOTIFY pgrst, 'reload schema';
