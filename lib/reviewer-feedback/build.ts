// ============================================================
// Reviewer feedback Word-doc builder
// ============================================================
// Builds a clean, blinded Word document containing the
// `comments_to_author` text from every non-draft review of a
// manuscript, in `submitted_date` order, labelled "Reviewer 1",
// "Reviewer 2", etc. The output is the attachment that ships
// with Minor Revisions and Major Revisions decision emails so
// the corresponding author has the full reviewer feedback
// alongside the editor's decision letter.
//
// Design notes
// ------------
// * No external docx library — pizzip-only. We hand-assemble
//   the minimal .docx zip (Content_Types + rels + document.xml
//   + styles.xml). The document is structurally simple
//   (heading + paragraphs), so generating from scratch keeps
//   the dependency footprint identical to the existing
//   reviewer-package build pipeline and avoids shipping a
//   template asset that has to live in /public.
// * Fully blinded. Only `comments_to_author` is included.
//   Numeric scores, comments_to_editor, recommendation,
//   reviewer name/ORCID/affiliation never enter the output.
// * Reviewers are ordered by `submitted_date` ASC so that if a
//   reviewer is re-invited for a round 2 their relative
//   position (Reviewer 1 / Reviewer 2) stays stable from the
//   author's perspective across rounds.
// * Reviews where `comments_to_author` is null or whitespace
//   are silently skipped. If every review is empty, the
//   function returns `empty: true` and the caller skips the
//   attachment entirely (the decision email still sends; the
//   author just doesn't get an empty placeholder).
// ============================================================

import PizZip from 'pizzip'
import { createAdminClient } from '@/lib/supabase/server'

export interface BuildReviewerFeedbackInput {
  manuscriptId: string
}

export interface BuildReviewerFeedbackResult {
  ok: boolean
  // .docx bytes when ok && !empty. null when empty or on error.
  content: Buffer | null
  // e.g. "OSCRSJ-2026-001-reviewer-feedback.docx"
  filename: string | null
  // Count of reviews with non-empty `comments_to_author`.
  reviewerCount: number
  // True when no reviews carried any author-facing comments.
  // Callers should NOT attach anything to the email in this case.
  empty: boolean
  // Populated on hard failures (DB error, manuscript not found).
  error: string | null
}

const STYLES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults>
    <w:rPrDefault>
      <w:rPr>
        <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/>
        <w:sz w:val="22"/>
        <w:szCs w:val="22"/>
      </w:rPr>
    </w:rPrDefault>
    <w:pPrDefault>
      <w:pPr>
        <w:spacing w:after="160" w:line="288" w:lineRule="auto"/>
      </w:pPr>
    </w:pPrDefault>
  </w:docDefaults>
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal">
    <w:name w:val="Normal"/>
    <w:qFormat/>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Title">
    <w:name w:val="Title"/>
    <w:basedOn w:val="Normal"/>
    <w:qFormat/>
    <w:pPr>
      <w:spacing w:before="0" w:after="240"/>
    </w:pPr>
    <w:rPr>
      <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/>
      <w:b/>
      <w:sz w:val="48"/>
      <w:szCs w:val="48"/>
      <w:color w:val="3D2A18"/>
    </w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading1">
    <w:name w:val="Heading 1"/>
    <w:basedOn w:val="Normal"/>
    <w:qFormat/>
    <w:pPr>
      <w:spacing w:before="360" w:after="120"/>
    </w:pPr>
    <w:rPr>
      <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/>
      <w:b/>
      <w:sz w:val="32"/>
      <w:szCs w:val="32"/>
      <w:color w:val="3D2A18"/>
    </w:rPr>
  </w:style>
</w:styles>`

const CONTENT_TYPES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`

const ROOT_RELS_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`

const DOC_RELS_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`

function xmlEscape(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

// Title-style paragraph: 24pt bold brown.
function titleParagraph(text: string): string {
  return `<w:p><w:pPr><w:pStyle w:val="Title"/></w:pPr><w:r><w:t xml:space="preserve">${xmlEscape(text)}</w:t></w:r></w:p>`
}

// Heading-1 paragraph: 16pt bold brown.
function heading1Paragraph(text: string): string {
  return `<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t xml:space="preserve">${xmlEscape(text)}</w:t></w:r></w:p>`
}

// Body paragraph with optional inline run-property formatting.
function bodyParagraph(
  text: string,
  opts: { bold?: boolean; italic?: boolean; color?: string } = {}
): string {
  if (text.length === 0) {
    // Empty paragraph as visual spacer.
    return '<w:p/>'
  }
  const rPrParts: string[] = []
  if (opts.bold) rPrParts.push('<w:b/>')
  if (opts.italic) rPrParts.push('<w:i/>')
  if (opts.color) rPrParts.push(`<w:color w:val="${opts.color}"/>`)
  const rPr = rPrParts.length > 0 ? `<w:rPr>${rPrParts.join('')}</w:rPr>` : ''
  return `<w:p><w:r>${rPr}<w:t xml:space="preserve">${xmlEscape(text)}</w:t></w:r></w:p>`
}

// Paragraph with multiple lines separated by soft line-breaks.
// Used when a reviewer's single comment block contains \n
// linebreaks that should stay visually together (no extra
// paragraph spacing between them).
function softBreakParagraph(lines: string[]): string {
  if (lines.length === 0) return '<w:p/>'
  const runs = lines
    .map((line, i) => {
      const escaped = xmlEscape(line)
      const tElement = `<w:t xml:space="preserve">${escaped}</w:t>`
      // First line: plain run. Subsequent lines: prefix with <w:br/>.
      return i === 0
        ? `<w:r>${tElement}</w:r>`
        : `<w:r><w:br/>${tElement}</w:r>`
    })
    .join('')
  return `<w:p>${runs}</w:p>`
}

// Convert a reviewer's `comments_to_author` blob to a list of
// docx paragraph XML strings. Splits on blank lines (one or
// more empty lines) into separate paragraphs; within each
// paragraph, single \n becomes a soft line break.
function commentsToParagraphs(comments: string): string[] {
  // Normalise line endings.
  const normalised = comments.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  // Split on blank-line boundaries (\n followed by optional whitespace + \n).
  const blocks = normalised.split(/\n[ \t]*\n+/)
  const out: string[] = []
  for (const rawBlock of blocks) {
    const block = rawBlock.trim()
    if (block.length === 0) continue
    const lines = block.split('\n')
    out.push(softBreakParagraph(lines))
  }
  return out
}

function buildDocumentXml(input: {
  submissionId: string
  title: string
  reviewerComments: string[]
}): string {
  const dateLabel = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  const paragraphs: string[] = []

  // Title.
  paragraphs.push(titleParagraph('OSCRSJ Reviewer Feedback'))

  // Metadata block.
  paragraphs.push(bodyParagraph(`Submission ID: ${input.submissionId}`, { bold: true }))
  paragraphs.push(
    bodyParagraph(input.title, { italic: true, color: '3D2A18' })
  )
  paragraphs.push(bodyParagraph(`Issued: ${dateLabel}`))
  paragraphs.push(bodyParagraph(''))

  // Author-facing note.
  paragraphs.push(
    bodyParagraph(
      'The following comments were provided by the peer reviewers of your manuscript. Reviewer identities are kept confidential as part of OSCRSJ’s double-blind review process. Please address each comment point-by-point in your Response to Reviewers letter using the Revision Response Template available at oscrsj.com/templates.',
      { italic: true, color: '5C4A3A' }
    )
  )
  paragraphs.push(bodyParagraph(''))

  // Per-reviewer sections.
  input.reviewerComments.forEach((comments, idx) => {
    paragraphs.push(heading1Paragraph(`Reviewer ${idx + 1}`))
    const bodyParagraphs = commentsToParagraphs(comments)
    if (bodyParagraphs.length === 0) {
      paragraphs.push(bodyParagraph('(No comments provided.)', { italic: true }))
    } else {
      for (const p of bodyParagraphs) paragraphs.push(p)
    }
    paragraphs.push(bodyParagraph(''))
  })

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${paragraphs.join('\n    ')}
    <w:sectPr>
      <w:pgSz w:w="12240" w:h="15840"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/>
    </w:sectPr>
  </w:body>
</w:document>`
}

// Slugify a submission id into a filesystem-safe filename
// fragment. Submission ids are already ASCII-safe in practice
// (OSCRSJ-YYYY-NNN), but this guards against future format
// changes that include spaces or punctuation.
function slugifyForFilename(submissionId: string): string {
  return submissionId.replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '')
}

export async function buildReviewerFeedbackDocx(
  input: BuildReviewerFeedbackInput
): Promise<BuildReviewerFeedbackResult> {
  const empty = {
    ok: true as const,
    content: null,
    filename: null,
    reviewerCount: 0,
    empty: true,
    error: null,
  }
  if (!input.manuscriptId || typeof input.manuscriptId !== 'string') {
    return {
      ok: false,
      content: null,
      filename: null,
      reviewerCount: 0,
      empty: true,
      error: 'Manuscript id is required.',
    }
  }

  const admin = createAdminClient()

  // Fetch manuscript identity (for the filename + title header).
  const { data: mData, error: mErr } = await admin
    .from('manuscripts')
    .select('id, submission_id, title')
    .eq('id', input.manuscriptId)
    .maybeSingle()

  if (mErr || !mData) {
    return {
      ok: false,
      content: null,
      filename: null,
      reviewerCount: 0,
      empty: true,
      error: mErr?.message || 'Manuscript not found.',
    }
  }
  const manuscript = mData as {
    id: string
    submission_id: string
    title: string | null
  }

  // Fetch every non-draft review's author-facing comment.
  // Ordering: submitted_date ASC keeps Reviewer 1 / Reviewer 2
  // labels stable across re-invites.
  const { data: rData, error: rErr } = await admin
    .from('reviews')
    .select('id, comments_to_author, submitted_date, created_at')
    .eq('manuscript_id', input.manuscriptId)
    .eq('is_draft', false)
    .order('submitted_date', { ascending: true })
    .order('created_at', { ascending: true })

  if (rErr) {
    return {
      ok: false,
      content: null,
      filename: null,
      reviewerCount: 0,
      empty: true,
      error: rErr.message,
    }
  }

  const rows =
    (rData as Array<{
      id: string
      comments_to_author: string | null
      submitted_date: string | null
      created_at: string
    }> | null) || []

  const reviewerComments = rows
    .map((r) => (r.comments_to_author || '').trim())
    .filter((c) => c.length > 0)

  if (reviewerComments.length === 0) {
    return empty
  }

  // Hand-assemble the .docx zip.
  const zip = new PizZip()
  zip.file('[Content_Types].xml', CONTENT_TYPES_XML)
  zip.file('_rels/.rels', ROOT_RELS_XML)
  zip.file('word/_rels/document.xml.rels', DOC_RELS_XML)
  zip.file('word/styles.xml', STYLES_XML)
  zip.file(
    'word/document.xml',
    buildDocumentXml({
      submissionId: manuscript.submission_id,
      title: manuscript.title || '(untitled manuscript)',
      reviewerComments,
    })
  )

  const buffer = zip.generate({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  }) as Buffer

  const filename = `${slugifyForFilename(manuscript.submission_id)}-reviewer-feedback.docx`

  return {
    ok: true,
    content: buffer,
    filename,
    reviewerCount: reviewerComments.length,
    empty: false,
    error: null,
  }
}
