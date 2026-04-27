// ============================================================
// Reviewer manuscript-package build pipeline
// ============================================================
// Builds a single combined Word document from a manuscript's
// blinded source files (blinded_manuscript.docx + tables.docx
// + figure image files), uploads it to Supabase Storage, and
// caches the result on `manuscript_metadata` so subsequent
// reviewers of the same manuscript-version reuse the cache.
//
// Strategy
// --------
// .docx files are zip archives. We open the blinded manuscript
// with pizzip, splice the body content of tables.docx into it
// (everything between <w:body> and the trailing <w:sectPr>),
// then append a page-break + figure-image paragraph for each
// figure. Image binaries land in word/media/, relationships
// land in word/_rels/document.xml.rels, and PNG/JPEG content
// types are merged into [Content_Types].xml if they aren't
// already declared. TIFFs are passed through with a
// fallback-dim caveat (Word's TIFF rendering is inconsistent
// across Mac vs. Windows; we still embed it because some
// reviewers will open in LibreOffice / Preview / online
// readers that handle TIFF cleanly).
//
// Cache contract
// --------------
// The cache key is (manuscript_id, current_version) where
// current_version = max(manuscript_revisions.revision_number) + 1
// (or 1 for a never-revised manuscript). When a revision is
// submitted, the version bumps and the cache is naturally
// invalidated; the next reviewer to accept on the new version
// triggers a fresh build.
//
// Concurrency: the first caller to enter the build path writes
// `reviewer_package_built_at` as an in-progress sentinel before
// downloading anything. Callers that observe a recent sentinel
// (within 90s) and no path yet treat the cache as in-progress
// and return a "building" status; the acceptance handler turns
// that into a fallback link in the email.
//
// Failure mode: if any step throws, the function returns
// { ok: false, error }. The caller logs the error and sends a
// fallback-mode email pointing the reviewer at the per-file
// download page (/review/[token]/manuscript). Reviewer never
// loses access; they just don't get the combined .docx.
// ============================================================

import PizZip from 'pizzip'
import { createAdminClient } from '@/lib/supabase/server'
import type {
  ManuscriptFileRow,
  ManuscriptMetadataRow,
} from '@/lib/types/database'

// ---- Types ----

export interface ReviewerPackageInput {
  manuscriptId: string
}

export type ReviewerPackageResult =
  | {
      ok: true
      cached: boolean
      storagePath: string
      bytes: number
      version: number
      figureCount: number
      hasTables: boolean
    }
  | {
      ok: false
      error: string
      buildInProgress?: boolean
    }

// 90s sentinel window. If a build started < 90s ago, a parallel
// caller treats the cache as in-progress instead of competing.
const BUILD_SENTINEL_WINDOW_MS = 90 * 1000

const STORAGE_BUCKET = 'submissions'
const PACKAGE_FILENAME = 'reviewer-package.docx'

// Word page-area target for embedded figures: 6 inches wide
// (914400 EMU = 1 inch). Aspect-preserving scaling fits the
// figure inside Word's default printable column without
// shoving tall portraits past the bottom margin.
const FIGURE_TARGET_WIDTH_EMU = 6 * 914400 // 5,486,400
const FIGURE_FALLBACK_HEIGHT_EMU = 4 * 914400 // 4 inches when dims unknown

// Image extensions Word handles natively. TIFF embeds work in
// Windows Word; macOS Word renders TIFF inconsistently. We pass
// it through anyway because the alternative — losing the
// figure entirely — is worse.
const IMAGE_EXTENSIONS_NEEDING_CT = ['png', 'jpeg', 'jpg', 'gif', 'tiff', 'tif'] as const

const CONTENT_TYPE_BY_EXT: Record<string, string> = {
  png: 'image/png',
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg',
  gif: 'image/gif',
  tiff: 'image/tiff',
  tif: 'image/tiff',
}

// ---- Public entry point ----

export async function buildReviewerPackage(
  input: ReviewerPackageInput
): Promise<ReviewerPackageResult> {
  const { manuscriptId } = input
  if (!manuscriptId || typeof manuscriptId !== 'string') {
    return { ok: false, error: 'manuscriptId is required' }
  }

  const admin = createAdminClient()

  // ---- Resolve current version ----
  const currentVersion = await resolveCurrentVersion(admin, manuscriptId)
  if (currentVersion === null) {
    return { ok: false, error: 'Failed to resolve manuscript version' }
  }

  // ---- Cache check ----
  const meta = await loadMetadata(admin, manuscriptId)
  if (!meta) {
    return { ok: false, error: 'Manuscript metadata row not found' }
  }

  if (
    meta.reviewer_package_storage_path &&
    meta.reviewer_package_version === currentVersion
  ) {
    // Hit. Return without rebuilding.
    return {
      ok: true,
      cached: true,
      storagePath: meta.reviewer_package_storage_path,
      bytes: 0, // bytes unknown on a cache hit; caller can stat if needed
      version: currentVersion,
      figureCount: 0, // not re-computed on cache hit
      hasTables: false,
    }
  }

  // ---- In-progress sentinel check ----
  if (
    meta.reviewer_package_built_at &&
    !meta.reviewer_package_storage_path &&
    Date.now() - new Date(meta.reviewer_package_built_at).getTime() <
      BUILD_SENTINEL_WINDOW_MS
  ) {
    return { ok: false, error: 'Build already in progress', buildInProgress: true }
  }

  // ---- Claim sentinel ----
  // We write `built_at` BEFORE doing any work so concurrent callers
  // bail. If our build fails, we leave the sentinel; the next call
  // will see it as stale (>90s old) and retry.
  const sentinelIso = new Date().toISOString()
  await (admin.from('manuscript_metadata') as any)
    .update({ reviewer_package_built_at: sentinelIso })
    .eq('id', meta.id)

  // ---- Fetch source files ----
  const sourceFiles = await loadSourceFiles(admin, manuscriptId, currentVersion)
  const blinded = sourceFiles.find((f) => f.file_type === 'blinded_manuscript')
  if (!blinded) {
    return {
      ok: false,
      error: 'No blinded manuscript file is attached to this submission yet',
    }
  }
  const tables = sourceFiles.find((f) => f.file_type === 'tables')
  const figures = sourceFiles.filter((f) => f.file_type === 'figure')

  // ---- Download sources ----
  const blindedBytes = await downloadFromStorage(admin, blinded.storage_path)
  if (!blindedBytes) {
    return { ok: false, error: 'Failed to download blinded manuscript' }
  }

  let tablesBytes: Buffer | null = null
  if (tables) {
    tablesBytes = await downloadFromStorage(admin, tables.storage_path)
    if (!tablesBytes) {
      // Non-fatal — proceed without tables, log the gap.
      console.warn(
        '[reviewer-package] tables.docx exists in DB but could not be downloaded',
        { manuscriptId, storagePath: tables.storage_path }
      )
    }
  }

  const figureBlobs: Array<{ file: ManuscriptFileRow; bytes: Buffer }> = []
  for (const fig of figures) {
    const bytes = await downloadFromStorage(admin, fig.storage_path)
    if (bytes) figureBlobs.push({ file: fig, bytes })
  }

  // ---- Build the combined .docx ----
  let combined: Buffer
  try {
    combined = mergeIntoDocx({
      baseDocx: blindedBytes,
      tablesDocx: tablesBytes,
      figures: figureBlobs,
    })
  } catch (err) {
    return {
      ok: false,
      error: `Build failed: ${err instanceof Error ? err.message : 'unknown error'}`,
    }
  }

  // ---- Upload to Storage ----
  const storagePath = `${manuscriptId}/v${currentVersion}/${PACKAGE_FILENAME}`
  const { error: uploadErr } = await admin.storage
    .from(STORAGE_BUCKET)
    .upload(storagePath, combined, {
      contentType:
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      upsert: true,
    })
  if (uploadErr) {
    return {
      ok: false,
      error: `Failed to upload combined package: ${uploadErr.message}`,
    }
  }

  // ---- Update cache columns ----
  await (admin.from('manuscript_metadata') as any)
    .update({
      reviewer_package_storage_path: storagePath,
      reviewer_package_built_at: new Date().toISOString(),
      reviewer_package_version: currentVersion,
    })
    .eq('id', meta.id)

  return {
    ok: true,
    cached: false,
    storagePath,
    bytes: combined.length,
    version: currentVersion,
    figureCount: figureBlobs.length,
    hasTables: Boolean(tablesBytes),
  }
}

// ---- Signed-URL helper used by the email + reviewer page ----

export async function getReviewerPackageSignedUrl(
  manuscriptId: string,
  storagePath: string,
  ttlSeconds: number
): Promise<{ signedUrl: string | null; error: string | null }> {
  const admin = createAdminClient()
  const { data, error } = await admin.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(storagePath, ttlSeconds, {
      download: `OSCRSJ-${manuscriptId.slice(0, 8)}-${PACKAGE_FILENAME}`,
    })
  if (error || !data) {
    return { signedUrl: null, error: error?.message || 'unknown error' }
  }
  return { signedUrl: data.signedUrl, error: null }
}

// ============================================================
// Internal helpers
// ============================================================

type AdminClient = ReturnType<typeof createAdminClient>

async function resolveCurrentVersion(
  admin: AdminClient,
  manuscriptId: string
): Promise<number | null> {
  // current_version = (latest revision_number) + 1, or 1 if no revisions yet.
  const { data, error } = await admin
    .from('manuscript_revisions')
    .select('revision_number')
    .eq('manuscript_id', manuscriptId)
    .order('revision_number', { ascending: false })
    .limit(1)

  if (error) return null
  const rows = data as { revision_number: number }[] | null
  if (!rows || rows.length === 0) return 1
  return (rows[0].revision_number || 0) + 1
}

async function loadMetadata(
  admin: AdminClient,
  manuscriptId: string
): Promise<ManuscriptMetadataRow | null> {
  const { data, error } = await admin
    .from('manuscript_metadata')
    .select('*')
    .eq('manuscript_id', manuscriptId)
    .maybeSingle()
  if (error || !data) return null
  return data as ManuscriptMetadataRow
}

async function loadSourceFiles(
  admin: AdminClient,
  manuscriptId: string,
  version: number
): Promise<ManuscriptFileRow[]> {
  const { data, error } = await admin
    .from('manuscript_files')
    .select('*')
    .eq('manuscript_id', manuscriptId)
    .eq('version', version)
    .in('file_type', ['blinded_manuscript', 'tables', 'figure'])
    .order('file_type', { ascending: true })
    .order('file_order', { ascending: true })
  if (error || !data) return []
  return data as ManuscriptFileRow[]
}

async function downloadFromStorage(
  admin: AdminClient,
  storagePath: string
): Promise<Buffer | null> {
  const { data, error } = await admin.storage
    .from(STORAGE_BUCKET)
    .download(storagePath)
  if (error || !data) return null
  const arrayBuffer = await data.arrayBuffer()
  return Buffer.from(arrayBuffer)
}

// ============================================================
// .docx merge
// ============================================================
// The blinded_manuscript.docx is the chassis. We splice the
// body content of tables.docx into it (preserving table XML),
// then append figure-image paragraphs at the end. We do NOT
// merge style/numbering/font definitions — Word renders
// unrecognized style refs with default formatting, which is
// acceptable for reviewer reading. Custom numbering or
// footnotes from tables.docx may render as plain text; that's
// the trade-off vs. shipping nothing.

interface MergeInput {
  baseDocx: Buffer
  tablesDocx: Buffer | null
  figures: Array<{ file: ManuscriptFileRow; bytes: Buffer }>
}

function mergeIntoDocx(input: MergeInput): Buffer {
  const { baseDocx, tablesDocx, figures } = input

  const zip = new PizZip(baseDocx)

  // ---- 1. Read base document.xml ----
  const docXml = zip.file('word/document.xml')?.asText()
  if (!docXml) {
    throw new Error('Base manuscript .docx is missing word/document.xml')
  }

  // ---- 2. Splice tables body if present ----
  let mergedDocXml = docXml
  if (tablesDocx) {
    try {
      const tablesZip = new PizZip(tablesDocx)
      const tablesXml = tablesZip.file('word/document.xml')?.asText()
      if (tablesXml) {
        const tablesBodyContent = extractBodyContent(tablesXml)
        if (tablesBodyContent) {
          mergedDocXml = injectBeforeBodyClose(
            mergedDocXml,
            buildSeparatorParagraph('TABLES') + tablesBodyContent
          )
        }
      }
    } catch (err) {
      // Non-fatal — proceed without tables.
      console.warn('[reviewer-package] failed to splice tables.docx', err)
    }
  }

  // ---- 3. Read existing relationships ----
  const relsPath = 'word/_rels/document.xml.rels'
  const relsXml =
    zip.file(relsPath)?.asText() ||
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>`

  // ---- 4. Pick a starting rId that won't collide ----
  let nextRid = computeNextRid(relsXml)
  let nextDocPrId = computeNextDocPrId(mergedDocXml)

  // ---- 5. Append each figure ----
  const newRels: string[] = []
  const figureExtensions = new Set<string>()

  figures.forEach(({ file, bytes }, idx) => {
    const ext = inferImageExtension(file)
    const safeExt = ext.toLowerCase()
    figureExtensions.add(safeExt)

    const mediaName = `image_review_${nextRid}.${safeExt}`
    const mediaPath = `word/media/${mediaName}`
    zip.file(mediaPath, bytes, { binary: true })

    const ridName = `rId${nextRid}`
    nextRid += 1
    newRels.push(
      `<Relationship Id="${ridName}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${mediaName}"/>`
    )

    const dims = readImageDimensionsEmu(bytes, safeExt)
    const captionLabel = `Figure ${idx + 1} — ${
      file.original_filename || file.file_name
    }`
    const figureBlock = buildFigureBlock(
      ridName,
      nextDocPrId,
      dims.cx,
      dims.cy,
      captionLabel
    )
    nextDocPrId += 2 // blip + paragraph each consume an id slot

    mergedDocXml = injectBeforeBodyClose(mergedDocXml, figureBlock)
  })

  // ---- 6. Write document.xml back ----
  zip.file('word/document.xml', mergedDocXml)

  // ---- 7. Update relationships file ----
  if (newRels.length > 0) {
    const updatedRels = injectRelationships(relsXml, newRels.join(''))
    zip.file(relsPath, updatedRels)
  }

  // ---- 8. Ensure [Content_Types].xml declares all image types ----
  if (figures.length > 0) {
    const ctPath = '[Content_Types].xml'
    const ctXml = zip.file(ctPath)?.asText()
    if (ctXml) {
      const updatedCt = ensureContentTypeDefaults(ctXml, figureExtensions)
      zip.file(ctPath, updatedCt)
    }
  }

  // ---- 9. Generate ----
  return zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' }) as Buffer
}

// ---- XML splicing helpers ----

function extractBodyContent(docXml: string): string | null {
  // Strip everything outside <w:body>, then drop the trailing
  // <w:sectPr> if present (we keep the base manuscript's section
  // properties; merging two sectPr blocks corrupts the layout).
  const bodyMatch = docXml.match(/<w:body\b[^>]*>([\s\S]*?)<\/w:body>/)
  if (!bodyMatch) return null
  let body = bodyMatch[1]
  // Drop the final sectPr — usually wrapped in its own tags at the very end.
  body = body.replace(/<w:sectPr\b[\s\S]*?<\/w:sectPr>\s*$/, '')
  return body
}

function injectBeforeBodyClose(docXml: string, snippet: string): string {
  // Prefer to insert before the final <w:sectPr> so layout properties
  // stay at the very end. Fall back to before </w:body>.
  const sectPrMatch = docXml.match(/<w:sectPr\b[\s\S]*?<\/w:sectPr>\s*<\/w:body>/)
  if (sectPrMatch && sectPrMatch.index !== undefined) {
    const insertAt = sectPrMatch.index
    return docXml.slice(0, insertAt) + snippet + docXml.slice(insertAt)
  }
  return docXml.replace(/<\/w:body>/, snippet + '</w:body>')
}

function buildSeparatorParagraph(label: string): string {
  // Page-break + bold heading paragraph between sections.
  // Uses inline run properties (no style ref) so it renders the same
  // regardless of the base manuscript's style definitions.
  const safeLabel = escapeXml(label)
  return (
    `<w:p>` +
    `<w:r><w:br w:type="page"/></w:r>` +
    `</w:p>` +
    `<w:p>` +
    `<w:pPr><w:spacing w:before="240" w:after="240"/></w:pPr>` +
    `<w:r>` +
    `<w:rPr><w:b/><w:sz w:val="32"/></w:rPr>` +
    `<w:t xml:space="preserve">${safeLabel}</w:t>` +
    `</w:r>` +
    `</w:p>`
  )
}

function buildFigureBlock(
  rId: string,
  startDocPrId: number,
  cxEmu: number,
  cyEmu: number,
  caption: string
): string {
  // Page break + image paragraph + caption paragraph.
  const captionEsc = escapeXml(caption)
  const blipDocPrId = startDocPrId
  return (
    `<w:p>` +
    `<w:r><w:br w:type="page"/></w:r>` +
    `</w:p>` +
    `<w:p>` +
    `<w:pPr><w:jc w:val="center"/></w:pPr>` +
    `<w:r>` +
    `<w:drawing>` +
    `<wp:inline xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" distT="0" distB="0" distL="0" distR="0">` +
    `<wp:extent cx="${cxEmu}" cy="${cyEmu}"/>` +
    `<wp:effectExtent l="0" t="0" r="0" b="0"/>` +
    `<wp:docPr id="${blipDocPrId}" name="Figure"/>` +
    `<wp:cNvGraphicFramePr><a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/></wp:cNvGraphicFramePr>` +
    `<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">` +
    `<a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">` +
    `<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">` +
    `<pic:nvPicPr>` +
    `<pic:cNvPr id="${blipDocPrId}" name="Figure"/>` +
    `<pic:cNvPicPr/>` +
    `</pic:nvPicPr>` +
    `<pic:blipFill>` +
    `<a:blip xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:embed="${rId}"/>` +
    `<a:stretch><a:fillRect/></a:stretch>` +
    `</pic:blipFill>` +
    `<pic:spPr>` +
    `<a:xfrm><a:off x="0" y="0"/><a:ext cx="${cxEmu}" cy="${cyEmu}"/></a:xfrm>` +
    `<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>` +
    `</pic:spPr>` +
    `</pic:pic>` +
    `</a:graphicData>` +
    `</a:graphic>` +
    `</wp:inline>` +
    `</w:drawing>` +
    `</w:r>` +
    `</w:p>` +
    `<w:p>` +
    `<w:pPr><w:jc w:val="center"/><w:spacing w:before="120"/></w:pPr>` +
    `<w:r>` +
    `<w:rPr><w:i/><w:sz w:val="20"/></w:rPr>` +
    `<w:t xml:space="preserve">${captionEsc}</w:t>` +
    `</w:r>` +
    `</w:p>`
  )
}

function injectRelationships(relsXml: string, snippet: string): string {
  if (relsXml.includes('</Relationships>')) {
    return relsXml.replace('</Relationships>', snippet + '</Relationships>')
  }
  // Defensive: if the file is somehow malformed, build a fresh shell.
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${snippet}</Relationships>`
}

function ensureContentTypeDefaults(
  ctXml: string,
  extensions: Set<string>
): string {
  let updated = ctXml
  for (const ext of Array.from(extensions)) {
    if (!IMAGE_EXTENSIONS_NEEDING_CT.includes(ext as any)) continue
    const contentType = CONTENT_TYPE_BY_EXT[ext]
    if (!contentType) continue
    // Skip if already declared.
    const declarationRegex = new RegExp(
      `<Default[^>]*Extension="${ext}"`,
      'i'
    )
    if (declarationRegex.test(updated)) continue
    const def = `<Default Extension="${ext}" ContentType="${contentType}"/>`
    if (updated.includes('</Types>')) {
      updated = updated.replace('</Types>', def + '</Types>')
    } else {
      updated += def
    }
  }
  return updated
}

// ---- rId / docPr id allocation ----

function computeNextRid(relsXml: string): number {
  const ids = Array.from(relsXml.matchAll(/Id="rId(\d+)"/g))
    .map((m) => parseInt(m[1], 10))
    .filter((n) => Number.isFinite(n))
  const max = ids.length > 0 ? Math.max(...ids) : 0
  return max + 1
}

function computeNextDocPrId(docXml: string): number {
  const ids = Array.from(docXml.matchAll(/<wp:docPr\s+id="(\d+)"/g))
    .map((m) => parseInt(m[1], 10))
    .filter((n) => Number.isFinite(n))
  const max = ids.length > 0 ? Math.max(...ids) : 0
  return max + 1
}

// ---- Image extension + dimensions ----

function inferImageExtension(file: ManuscriptFileRow): string {
  const candidates = [file.original_filename, file.file_name, file.storage_path]
  for (const c of candidates) {
    if (!c) continue
    const m = /\.([a-zA-Z0-9]{2,5})(?:\?|#|$)/.exec(c)
    if (m) {
      const ext = m[1].toLowerCase()
      if (IMAGE_EXTENSIONS_NEEDING_CT.includes(ext as any)) return ext
    }
  }
  return 'png'
}

function readImageDimensionsEmu(
  bytes: Buffer,
  ext: string
): { cx: number; cy: number } {
  // Returns EMU dims targeting FIGURE_TARGET_WIDTH_EMU (6 inches).
  // If pixel dims are unreadable, falls back to the 4-inch tall default.

  const pixelDims = readPixelDimensions(bytes, ext)
  if (!pixelDims) {
    return { cx: FIGURE_TARGET_WIDTH_EMU, cy: FIGURE_FALLBACK_HEIGHT_EMU }
  }

  // Aspect-preserve to fit the 6" target width.
  const aspect = pixelDims.height / pixelDims.width
  const cx = FIGURE_TARGET_WIDTH_EMU
  let cy = Math.round(cx * aspect)
  // Clamp very tall portraits at 8" so they don't exceed page height.
  const maxCy = 8 * 914400
  if (cy > maxCy) cy = maxCy
  return { cx, cy }
}

function readPixelDimensions(
  bytes: Buffer,
  ext: string
): { width: number; height: number } | null {
  try {
    if (ext === 'png') return readPngDimensions(bytes)
    if (ext === 'jpeg' || ext === 'jpg') return readJpegDimensions(bytes)
    if (ext === 'gif') return readGifDimensions(bytes)
  } catch {
    return null
  }
  // TIFF / other — fall back to default sizing.
  return null
}

function readPngDimensions(
  bytes: Buffer
): { width: number; height: number } | null {
  // Signature 89 50 4E 47 0D 0A 1A 0A, IHDR chunk at offset 8.
  if (bytes.length < 24) return null
  if (
    bytes[0] !== 0x89 ||
    bytes[1] !== 0x50 ||
    bytes[2] !== 0x4e ||
    bytes[3] !== 0x47
  ) {
    return null
  }
  const width = bytes.readUInt32BE(16)
  const height = bytes.readUInt32BE(20)
  if (!width || !height) return null
  return { width, height }
}

function readJpegDimensions(
  bytes: Buffer
): { width: number; height: number } | null {
  if (bytes.length < 4) return null
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return null
  let i = 2
  while (i < bytes.length - 8) {
    if (bytes[i] !== 0xff) {
      i += 1
      continue
    }
    const marker = bytes[i + 1]
    // SOF markers (FF C0–FF CF, excluding C4 / C8 / CC) carry dimensions.
    if (
      marker >= 0xc0 &&
      marker <= 0xcf &&
      marker !== 0xc4 &&
      marker !== 0xc8 &&
      marker !== 0xcc
    ) {
      // Skip the 2-byte segment length + 1-byte precision; height (2B), width (2B).
      const height = bytes.readUInt16BE(i + 5)
      const width = bytes.readUInt16BE(i + 7)
      if (!width || !height) return null
      return { width, height }
    }
    // Otherwise advance past this segment: length is 2 bytes following marker.
    const segLen = bytes.readUInt16BE(i + 2)
    i += 2 + segLen
  }
  return null
}

function readGifDimensions(
  bytes: Buffer
): { width: number; height: number } | null {
  if (bytes.length < 10) return null
  // GIF87a / GIF89a header + LSD: width little-endian at offset 6.
  if (bytes[0] !== 0x47 || bytes[1] !== 0x49 || bytes[2] !== 0x46) return null
  const width = bytes.readUInt16LE(6)
  const height = bytes.readUInt16LE(8)
  if (!width || !height) return null
  return { width, height }
}

// ---- XML escape ----

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}
