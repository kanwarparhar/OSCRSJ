-- Migration 024 — Phase 2 HTML body editor (Sushant Session 64, 2026-05-19).
--
-- Adds the `manuscript_body_cleaned_html` column to `manuscripts` so the
-- new OSCRSJ admin BodyEditor (TipTap MVP) has a place to persist
-- editor-cleaned body HTML alongside the existing metadata. The column
-- is nullable: when populated, preview/publish endpoints pass the value
-- as `cleanedHtml` to the renderer; when null, the renderer's
-- extractBody fallback (shipped Session 62) auto-extracts from the
-- accepted-manuscript .docx.
--
-- Closes `^handoff-sushant-html-body-editor-phase-2` and Kanwar's
-- 2026-05-18 directive ("shouldn't there be an HTML text editor for me
-- to make changes to formatting, images, tables and so on if needed?").
--
-- Coexistence with the renderer-side cleanup pane (`/render/[id]`):
-- both surfaces persist into the same payload field. The OSCRSJ admin
-- editor is the new canonical entry point; the cleanup pane remains
-- functional as fallback until the Phase 2 build has 2-3 publishes of
-- production confidence behind it (per the explicit Coexist UX choice
-- locked at session start).
--
-- IMPORTANT: NOTIFY pgrst at the bottom is required per CLAUDE.md
-- Convention §"PostgREST schema cache". Without it the schema cache
-- waits ~10 minutes before picking up the new column and writes to
-- the new column will fail with "Could not find the
-- 'manuscript_body_cleaned_html' column in the schema cache" until
-- that timer fires.

-- ============================================================
-- manuscripts — 1 new column
-- ============================================================

ALTER TABLE manuscripts
  ADD COLUMN IF NOT EXISTS manuscript_body_cleaned_html TEXT;

COMMENT ON COLUMN manuscripts.manuscript_body_cleaned_html IS
  'Editor-cleaned body HTML produced by the OSCRSJ admin BodyEditor (Phase 2 MVP, Sushant Session 64). When non-null, the preview/publish endpoints pass this verbatim to the renderer as `cleanedHtml`; the renderer skips its extractBody auto-extraction path and renders the editor-curated HTML instead. When null, the Session 62 auto-extraction pathway (Pandoc -> structured payload.body[] + tier-2 zip-media + tier-3 Storage-fetch) takes over. Sanitized server-side at write time via sanitize-html to strip <script>/<iframe>/event-handlers; the editor itself emits TipTap-shape HTML which is already conservatively filtered.';

-- ============================================================
-- PostgREST schema-cache refresh — mandatory per Convention §3.
-- ============================================================

NOTIFY pgrst, 'reload schema';
