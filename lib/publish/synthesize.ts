'use server'

// Renderer payload synthesizer — Session 53 (2026-05-15).
//
// Joins the manuscripts row + manuscript_authors + manuscript_affiliations +
// manuscript_metadata + the corresponding author's `users` row into the
// Franklin v1.0 payload shape consumed by the OSCRSJ Renderer chain
// (~/Documents/oscrsj-renderer/lib/renderer/sanityTests.ts ArticlePayload).
//
// Scope decision (Kanwar, 2026-05-15):
//   - body: []    — body content comes from the renderer's cleanedHtml
//                   (Pandoc-on-.docx + editor cleanup), not from DB.
//   - references: [] — no manuscript_references table exists yet; ship
//                   migration 021 next session. PMC indexing blocked until
//                   refs land, but PDF/A-1b ships fine without them.
//
// Tracks Manvir handoff ^handoff-renderer-payload-synthesizer-2026-05-15.
// Source spec: vault `02 - OSCRSJ/Notes/2026-05-15 Renderer Payload
// Synthesizer - Manvir Brief for Sushant.md`.

import { createAdminClient } from '@/lib/supabase/server'
import type {
  ManuscriptRow,
  ManuscriptAuthorRow,
  ManuscriptAffiliationRow,
  ManuscriptType,
  UserRow,
} from '@/lib/types/database'

// ============================================================
// Type — mirrors the renderer's ArticlePayload (sanityTests.ts).
// Kept structurally compatible; renderer's sanity pass is the
// canonical contract.
// ============================================================

export interface RendererPayload {
  $schema: string
  article: {
    id: string
    type: string
    article_type_slug: string
    title: string
    running_title: string
    doi: string
    doi_url: string
    license: {
      code: string
      url: string
    }
  }
  issue: {
    journal_short: string
    journal_full: string
    issn_electronic: string
    year: number
    volume: number
    issue_number: number
    month_short: string
    issue_slug: string
    issue_cover_date: string
  }
  dates: {
    received: string
    accepted: string
    published: string
  }
  authors: Array<{
    ordinal: number
    given_name: string
    middle_initial: string | null
    family_name: string
    degrees: string
    display_name: string
    orcid: string | null
    orcid_url: string | null
    affiliation_refs: number[]
    is_corresponding: boolean
    is_equal_contribution: boolean
    credit_roles: string[]
  }>
  affiliations: Array<{
    number: number
    text: string
  }>
  corresponding_author: {
    display_name: string
    affiliation_address: string
    email: string
    orcid_url: string | null
  }
  equal_contribution: {
    present: boolean
    statement: string | null
  }
  abstract: {
    format: 'structured' | 'unstructured'
    sections?: Array<{ label: string; text: string }>
    text?: string
  }
  keywords: string[]
  body: never[]
  declarations: {
    funding: string
    conflicts_of_interest: string
    coi_short: string
    patient_consent: { variant: string; statement: string }
    irb_ethics: { branch: string; statement: string }
    data_availability: string
    credit_author_contributions: string
    ai_disclosure: {
      used: boolean
      statement: string
    }
    acknowledgments: string | null
  }
  references: never[]
  suggested_citation_html: string
  xmp_metadata: Record<string, unknown>
}

export interface SynthesizeResult {
  ok: boolean
  payload: RendererPayload | null
  warnings: string[]
  errors: string[]
}

// ============================================================
// Constants — renderer-side contract shape.
// ============================================================

const SCHEMA_URL = 'https://oscrsj.com/schema/article-payload/v1.0.json'
const LICENSE_CODE = 'CC BY 4.0'
const LICENSE_URL = 'https://creativecommons.org/licenses/by/4.0/'
const JOURNAL_SHORT = 'OSCRSJ'
const JOURNAL_FULL = 'Orthopedic Surgery Case Reports & Series Journal'
const ISSN_PLACEHOLDER = 'XXXX-XXXX'
const RUNNING_TITLE_MAX = 45

// ManuscriptType → display string (matches sample-payload.json `type` values).
const TYPE_DISPLAY: Record<ManuscriptType, string> = {
  case_report: 'Case Report',
  case_series: 'Case Series',
  surgical_technique: 'Surgical Technique',
  images_in_orthopedics: 'Images in Orthopedics',
  letter_to_editor: 'Letter to the Editor',
  // DB enum kept as 'review_article' per Session 50 architecture
  // decision (changing it would require migration + data migration);
  // display label is the canonical SR/MA wording.
  review_article: 'Review Article',
}

// ManuscriptType → URL fragment matching /guide-for-authors anchors.
const TYPE_SLUG: Record<ManuscriptType, string> = {
  case_report: 'case-report',
  case_series: 'case-series',
  surgical_technique: 'surgical-technique',
  images_in_orthopedics: 'images-in-orthopedics',
  letter_to_editor: 'letter-to-the-editor',
  review_article: 'systematic-review-meta-analysis',
}

// Expected abstract section count by article type. Matches
// renderer's STRUCTURED_ABSTRACT_SECTION_COUNT (sanityTests.ts).
const STRUCTURED_ABSTRACT_COUNT: Partial<Record<ManuscriptType, number>> = {
  case_report: 4,
  case_series: 5,
  review_article: 4,
}
const UNSTRUCTURED_TYPES = new Set<ManuscriptType>(['surgical_technique'])
const NO_ABSTRACT_TYPES = new Set<ManuscriptType>([
  'letter_to_editor',
  'images_in_orthopedics',
])

const MONTH_SHORT = [
  'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN',
  'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC',
]

// ============================================================
// Main entry point.
// ============================================================

export async function synthesizeRendererPayload(
  manuscriptId: string
): Promise<SynthesizeResult> {
  const warnings: string[] = []
  const errors: string[] = []
  const admin = createAdminClient()

  // ---- Fetch manuscripts row ----
  const { data: mData, error: mErr } = await admin
    .from('manuscripts')
    .select('*')
    .eq('id', manuscriptId)
    .maybeSingle()

  if (mErr) {
    return { ok: false, payload: null, warnings, errors: [`Manuscript fetch failed: ${mErr.message}`] }
  }
  if (!mData) {
    return { ok: false, payload: null, warnings, errors: ['Manuscript not found.'] }
  }
  const manuscript = mData as ManuscriptRow

  if (!manuscript.manuscript_type) {
    errors.push('Manuscript has no manuscript_type. Cannot synthesize payload.')
  }
  if (!manuscript.title || manuscript.title.trim().length === 0) {
    errors.push('Manuscript title is empty.')
  }

  // ---- Fetch authors ordered by author_order ----
  const { data: aData } = await admin
    .from('manuscript_authors')
    .select('*')
    .eq('manuscript_id', manuscriptId)
    .order('author_order', { ascending: true })

  const authors = (aData as ManuscriptAuthorRow[] | null) ?? []
  if (authors.length === 0) {
    errors.push('Manuscript has no authors.')
  }

  // ---- Fetch affiliations (often empty — table exists but submission
  //      wizard does not populate it yet). Synthesize from
  //      manuscript_authors.affiliation strings when empty.
  const { data: affData } = await admin
    .from('manuscript_affiliations')
    .select('*')
    .eq('manuscript_id', manuscriptId)
    .order('affiliation_order', { ascending: true })

  const dbAffiliations =
    (affData as ManuscriptAffiliationRow[] | null) ?? []

  // ---- Fetch metadata (CoI, funding, ethics, data availability,
  //      AI disclosure, consent flags).
  const { data: metaData } = await admin
    .from('manuscript_metadata')
    .select('*')
    .eq('manuscript_id', manuscriptId)
    .maybeSingle()

  const meta = (metaData as Record<string, unknown> | null) ?? {}

  // ---- Fetch corresponding author profile (email, ORCID).
  const { data: cuData } = await admin
    .from('users')
    .select('*')
    .eq('id', manuscript.corresponding_author_id)
    .maybeSingle()

  const correspondingUser = cuData as UserRow | null

  // ============================================================
  // Build the payload sections.
  // ============================================================

  const type = manuscript.manuscript_type
  const typeDisplay = type ? TYPE_DISPLAY[type] : ''
  const typeSlug = type ? TYPE_SLUG[type] : ''

  // ---- article ----
  const elocationId = manuscript.elocation_id || 'e0001'
  const doi = manuscript.doi || `10.XXXXX/oscrsj.${new Date().getUTCFullYear()}.${elocationId.replace(/^e/, '').padStart(4, '0')}`
  const doiUrl = `https://doi.org/${doi}`

  let runningTitle = (manuscript.running_title || manuscript.title || '').trim()
  if (runningTitle.length === 0) {
    errors.push('Both running_title and title are empty.')
  } else if (runningTitle.length > RUNNING_TITLE_MAX) {
    warnings.push(
      `running_title is ${runningTitle.length} chars (max ${RUNNING_TITLE_MAX}). Editor must shorten before render.`
    )
    runningTitle = runningTitle.slice(0, RUNNING_TITLE_MAX)
  }

  const article = {
    id: elocationId,
    type: typeDisplay,
    article_type_slug: typeSlug,
    title: (manuscript.title || '').trim(),
    running_title: runningTitle,
    doi,
    doi_url: doiUrl,
    license: { code: LICENSE_CODE, url: LICENSE_URL },
  }

  // ---- issue + dates ----
  const acceptedAt = manuscript.accepted_date || manuscript.decision_date || new Date().toISOString()
  const submittedAt = manuscript.submission_date || acceptedAt
  const publishedAt = manuscript.published_date || acceptedAt
  const publishedDt = new Date(publishedAt)

  const issue = {
    journal_short: JOURNAL_SHORT,
    journal_full: JOURNAL_FULL,
    issn_electronic: ISSN_PLACEHOLDER,
    year: publishedDt.getUTCFullYear(),
    volume: 1,
    issue_number: 1,
    month_short: MONTH_SHORT[publishedDt.getUTCMonth()],
    issue_slug: '1-1',
    issue_cover_date: publishedDt.toISOString().slice(0, 10),
  }

  const dates = {
    received: submittedAt.slice(0, 10),
    accepted: acceptedAt.slice(0, 10),
    published: publishedAt.slice(0, 10),
  }

  // ---- affiliations + authors ----
  const affiliations: RendererPayload['affiliations'] = []
  const authorAffMap: Map<string, number[]> = new Map() // manuscript_author_id → affiliation numbers

  if (dbAffiliations.length > 0) {
    // Structured affiliations exist — use them.
    const idToNumber = new Map<string, number>()
    dbAffiliations.forEach((aff, idx) => {
      const number = idx + 1
      idToNumber.set(aff.id, number)
      const parts = [
        aff.department,
        aff.affiliation_name,
        aff.city,
        aff.country,
      ].filter((p): p is string => !!p && p.trim().length > 0)
      affiliations.push({ number, text: parts.join(', ') })
    })
    // Group by manuscript_author_id.
    for (const aff of dbAffiliations) {
      if (!aff.manuscript_author_id) continue
      const number = idToNumber.get(aff.id)
      if (!number) continue
      const list = authorAffMap.get(aff.manuscript_author_id) ?? []
      list.push(number)
      authorAffMap.set(aff.manuscript_author_id, list)
    }
  } else {
    // No structured affiliations — synthesize from each author's
    // free-text affiliation string. De-duplicate on exact match.
    warnings.push(
      'manuscript_affiliations table is empty; synthesizing affiliations from manuscript_authors.affiliation free-text strings. Multi-affiliation authors will appear as single-affiliation. Backfill manually if needed.'
    )
    const seen = new Map<string, number>()
    for (const a of authors) {
      const aff = (a.affiliation || '').trim()
      if (!aff) continue
      if (!seen.has(aff)) {
        const number = seen.size + 1
        seen.set(aff, number)
        affiliations.push({ number, text: aff })
      }
      authorAffMap.set(a.id, [seen.get(aff)!])
    }
  }

  if (affiliations.length === 0) {
    errors.push('No affiliations could be synthesized. At least one author needs an affiliation.')
  }

  // ---- authors ----
  const payloadAuthors: RendererPayload['authors'] = authors.map((a, idx) => {
    const nameParts = (a.full_name || '').trim().split(/\s+/)
    const givenName = nameParts[0] || ''
    const familyName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : ''
    const middle = nameParts.length > 2 ? nameParts.slice(1, -1).join(' ') : ''
    const middleInitial = middle
      ? middle.split(/\s+/).map((m) => m.charAt(0).toUpperCase() + '.').join(' ')
      : null

    const degrees = (a.degrees || '').trim()
    const displayName = degrees
      ? `${a.full_name.trim()}, ${degrees}`
      : a.full_name.trim()

    const orcid = (a.orcid_id || '').trim() || null
    const orcidUrl = orcid
      ? (orcid.startsWith('http') ? orcid : `https://orcid.org/${orcid}`)
      : null

    const credit = (a.contribution || '').trim()
    const creditRoles = credit
      ? credit.split(/[;,]/).map((s) => s.trim()).filter(Boolean)
      : []

    const affRefs = authorAffMap.get(a.id) ?? []
    if (affRefs.length === 0 && affiliations.length > 0) {
      warnings.push(
        `Author "${displayName}" has no resolvable affiliation — defaulting to affiliation #1.`
      )
      affRefs.push(1)
    }

    return {
      ordinal: idx + 1,
      given_name: givenName,
      middle_initial: middleInitial,
      family_name: familyName,
      degrees,
      display_name: displayName,
      orcid,
      orcid_url: orcidUrl,
      affiliation_refs: affRefs,
      is_corresponding: a.is_corresponding,
      is_equal_contribution: false,
      credit_roles: creditRoles,
    }
  })

  // ---- corresponding_author ----
  const correspondingDbAuthor = authors.find((a) => a.is_corresponding)
  if (!correspondingDbAuthor) {
    errors.push('No author flagged is_corresponding=true.')
  }
  const correspondingDisplayName = correspondingDbAuthor
    ? (() => {
        const degs = (correspondingDbAuthor.degrees || '').trim()
        return degs
          ? `${correspondingDbAuthor.full_name.trim()}, ${degs}`
          : correspondingDbAuthor.full_name.trim()
      })()
    : ''

  const correspondingAffText = correspondingDbAuthor
    ? (correspondingDbAuthor.affiliation || correspondingUser?.affiliation || '').trim()
    : ''

  const correspondingAuthor = {
    display_name: correspondingDisplayName,
    affiliation_address: correspondingAffText,
    email: correspondingDbAuthor?.email || correspondingUser?.email || '',
    orcid_url: correspondingDbAuthor
      ? (correspondingDbAuthor.orcid_id
          ? (correspondingDbAuthor.orcid_id.startsWith('http')
              ? correspondingDbAuthor.orcid_id
              : `https://orcid.org/${correspondingDbAuthor.orcid_id}`)
          : null)
      : null,
  }

  // ---- equal_contribution ----
  const equalContribution = { present: false, statement: null }

  // ---- abstract ----
  const abstract = parseAbstract(
    manuscript.abstract || '',
    type,
    warnings,
    errors
  )

  // ---- keywords ----
  const keywords = (manuscript.keywords || []).filter(
    (k) => typeof k === 'string' && k.trim().length > 0
  )
  if (keywords.length < 3 || keywords.length > 5) {
    warnings.push(
      `keywords cardinality is ${keywords.length} (renderer sanity test requires 3-5).`
    )
  }

  // ---- declarations ----
  const coi = ((meta.conflict_of_interest as string | null) || '').trim()
  const fundingArr =
    (meta.funding_sources as string[] | null) ?? []
  const funding = fundingArr.length === 0
    ? 'No external funding was received for this work.'
    : fundingArr.join('; ')

  const dataAvail = ((meta.data_availability_statement as string | null) || '').trim()
    || 'All data supporting the findings of this report are contained within the article.'

  const ethicsBranch = manuscript.manuscript_type === 'case_report' ? 'exempt' : 'not_required'
  const ethicsNum = ((meta.ethics_approval_number as string | null) || '').trim()
  const ethicsStatement = ethicsNum
    ? `Institutional Review Board approval: ${ethicsNum}.`
    : 'Institutional Review Board approval was not required for this report per institutional policy.'

  const aiUsed = (meta.ai_tools_used as boolean | null) || false
  const aiDetails = ((meta.ai_tools_details as string | null) || '').trim()
  const aiStatement = aiUsed
    ? (aiDetails || 'Generative AI was used in the preparation of this manuscript. The authors verified all content.')
    : 'The authors did not use generative AI tools in the conception, drafting, or revision of this manuscript.'

  // CoI short — first sentence of the longer statement, or fallback.
  const coiSentences = coi.split(/(?<=[.!?])\s+/).filter(Boolean)
  let coiShort = coiSentences[0] || 'The authors declare no conflicts of interest.'
  if (!coiShort.endsWith('.')) coiShort = coiShort + '.'
  const coiLong = coi || 'The authors declare no conflicts of interest. The full disclosure of potential conflicts of interest is provided with the online version of this article.'

  // CRediT contributions — join from authors.
  const creditLines = authors
    .filter((a) => (a.contribution || '').trim().length > 0)
    .map((a) => {
      const initials = a.full_name
        .trim()
        .split(/\s+/)
        .map((p) => p.charAt(0).toUpperCase())
        .join('.')
      return `${initials}. — ${(a.contribution || '').trim()}`
    })
    .join('; ')

  const declarations = {
    funding,
    conflicts_of_interest: coiLong,
    coi_short: coiShort,
    patient_consent: {
      variant: 'adult_living',
      statement:
        'Written informed consent was obtained from the patient for publication of this case report and any accompanying images. A copy of the consent form is available on request.',
    },
    irb_ethics: {
      branch: ethicsBranch,
      statement: ethicsStatement,
    },
    data_availability: dataAvail,
    credit_author_contributions:
      creditLines || authors.map((a) => `${a.full_name.trim()} — contributed to the manuscript.`).join('; '),
    ai_disclosure: { used: aiUsed, statement: aiStatement },
    acknowledgments: null,
  }

  // ---- suggested_citation_html ----
  const familyNames = authors.map((a) => {
    const parts = (a.full_name || '').trim().split(/\s+/)
    const family = parts.length > 1 ? parts[parts.length - 1] : parts[0]
    const initialsFromGivens = parts.length > 1
      ? parts.slice(0, -1).map((p) => p.charAt(0).toUpperCase()).join('')
      : ''
    return `${family}${initialsFromGivens ? ' ' + initialsFromGivens : ''}`
  })
  const authorCitation =
    familyNames.length <= 6
      ? familyNames.join(', ')
      : familyNames.slice(0, 6).join(', ') + ', et al'
  const titleCitation = (manuscript.title || '').replace(/\.+$/, '').trim().toLowerCase()
  const suggestedCitation = `${authorCitation}. ${titleCitation}. <em>${JOURNAL_SHORT}</em>. ${issue.year};${issue.volume}(${issue.issue_number}):${elocationId}.`

  // ---- xmp_metadata ----
  const xmpMetadata = {
    dc_title: manuscript.title || '',
    dc_creator: authors.map((a) => a.full_name.trim()),
    dc_subject: keywords,
    dc_description: (manuscript.abstract || '').trim().slice(0, 500),
    dc_rights: `© ${issue.year} The Author(s). Licensed under ${LICENSE_CODE}.`,
    dc_identifier: `doi:${doi}`,
    prism_publicationName: JOURNAL_FULL,
    prism_issn: ISSN_PLACEHOLDER,
    prism_volume: String(issue.volume),
    prism_number: String(issue.issue_number),
    prism_doi: doi,
    xmp_CreatorTool: 'OSCRSJ Render Pipeline v1.0 (WeasyPrint 68.1)',
    pdfaid_part: '1',
    pdfaid_conformance: 'B',
  }

  const payload: RendererPayload = {
    $schema: SCHEMA_URL,
    article,
    issue,
    dates,
    authors: payloadAuthors,
    affiliations,
    corresponding_author: correspondingAuthor,
    equal_contribution: equalContribution,
    abstract,
    keywords,
    body: [],
    declarations,
    references: [],
    suggested_citation_html: suggestedCitation,
    xmp_metadata: xmpMetadata,
  }

  return {
    ok: errors.length === 0,
    payload,
    warnings,
    errors,
  }
}

// ============================================================
// Helpers.
// ============================================================

// Parse a single-TEXT abstract field into structured sections based
// on the article type's expected label set. Falls back to single-block
// unstructured form when no anchors detected; emits a warning so the
// editor knows to fix it before render.
function parseAbstract(
  abstractText: string,
  type: ManuscriptType | null,
  warnings: string[],
  errors: string[]
): RendererPayload['abstract'] {
  const text = (abstractText || '').trim()

  if (!type) {
    if (text) return { format: 'unstructured', text }
    return { format: 'unstructured', text: '' }
  }

  if (NO_ABSTRACT_TYPES.has(type)) {
    return { format: 'unstructured', text: text || '' }
  }

  if (UNSTRUCTURED_TYPES.has(type)) {
    if (!text) errors.push(`${TYPE_DISPLAY[type]} requires an abstract; field is empty.`)
    return { format: 'unstructured', text }
  }

  // Structured types — try to parse subheadings.
  const expectedCount = STRUCTURED_ABSTRACT_COUNT[type]
  if (!expectedCount) {
    return { format: 'unstructured', text }
  }

  if (!text) {
    errors.push(`${TYPE_DISPLAY[type]} requires a structured abstract; field is empty.`)
    return { format: 'structured', sections: [] }
  }

  // Anchor regex matches lines (or inline) like "Introduction:" "Case Presentation:"
  // "Discussion:" "Conclusion:" "Background:" "Methods:" "Results:". Case-insensitive.
  // We capture the label and split the text into segments after each match.
  const ANCHORS = [
    'Introduction', 'Background', 'Case Presentation', 'Methods', 'Results',
    'Discussion', 'Conclusion', 'Conclusions',
  ]
  const anchorRe = new RegExp(
    `(^|\\n|\\.\\s+|\\;\\s+|\\s)\\s*(${ANCHORS.join('|')})\\s*[:\\.]\\s*`,
    'gi'
  )

  const matches: Array<{ index: number; label: string }> = []
  let m: RegExpExecArray | null
  while ((m = anchorRe.exec(text)) !== null) {
    matches.push({
      index: m.index + (m[1]?.length ?? 0),
      label: m[2].replace(/conclusions/i, 'Conclusion'),
    })
  }

  if (matches.length < expectedCount) {
    warnings.push(
      `Abstract for ${TYPE_DISPLAY[type]} expects ${expectedCount} labeled sections; found ${matches.length} anchor(s) ("${matches.map((x) => x.label).join('", "')}"). Editor must add labels (Introduction:/Case Presentation:/Discussion:/Conclusion: etc.) to the abstract text before render OR the sanity test will fail. Falling back to unstructured.`
    )
    return { format: 'unstructured', text }
  }

  // Slice text segments between matches.
  const sections: Array<{ label: string; text: string }> = []
  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].index
    const end = i + 1 < matches.length ? matches[i + 1].index : text.length
    const segment = text.slice(start, end)
    // Strip leading "Label:" + whitespace
    const sectionText = segment.replace(
      new RegExp(`^\\s*${matches[i].label}\\s*[:\\.]\\s*`, 'i'),
      ''
    ).trim()
    sections.push({
      label: matches[i].label.charAt(0).toUpperCase() + matches[i].label.slice(1),
      text: sectionText,
    })
  }

  if (sections.length !== expectedCount) {
    warnings.push(
      `Abstract parsed into ${sections.length} sections but ${TYPE_DISPLAY[type]} expects ${expectedCount}. Sanity test will fail unless editor cleans up before render.`
    )
  }

  return { format: 'structured', sections }
}
