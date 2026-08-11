/**
 * Assembles a COMPLETE Crossref deposit record from the database.
 *
 * Always complete, never a diff: Crossref's re-deposit semantics null every
 * field the incoming record omits, so "just update the title" would silently
 * strip the abstract, ORCIDs and licence from a registered DOI.
 *
 * Refuses to build unless the article is genuinely registrable: published,
 * a valid OSCRSJ DOI, and a real publication date. Those are Crossref member
 * obligations, not our preferences — a DOI must resolve to a live landing
 * page carrying the metadata we asserted.
 */

import { createAdminClient } from '@/lib/supabase/server'
import { isValidOscrsjDoi } from '../doi'
import {
  CURRENT_ISSUE,
  ISSN,
  articlePdfUrl,
  canonicalArticleUrl,
  volumeForYear,
} from '../journal'
import { buildBatchId, buildTimestamp } from './depositXml'
import type { DepositAuthor, DepositInput, DepositReference } from './depositXml'
import { extractReferencesFromJats, splitName } from './parse'

// Re-exported so the historical import surface keeps working.
export { extractReferencesFromJats, splitName }
import type {
  ManuscriptAffiliationRow,
  ManuscriptAuthorRow,
  ManuscriptRow,
} from '@/lib/types/database'

export interface BuildInputResult {
  ok: boolean
  input: DepositInput | null
  error?: string
}

export async function buildDepositInput(
  manuscriptId: string,
  opts: { now?: Date; depositorEmail?: string } = {}
): Promise<BuildInputResult> {
  const admin = createAdminClient()
  const now = opts.now ?? new Date()
  const depositorEmail =
    opts.depositorEmail || process.env.CROSSREF_DEPOSITOR_EMAIL || ''
  if (!depositorEmail) {
    return { ok: false, input: null, error: 'CROSSREF_DEPOSITOR_EMAIL is not configured.' }
  }

  const { data: mRow, error: mErr } = await admin
    .from('manuscripts')
    .select('*')
    .eq('id', manuscriptId)
    .single()
  if (mErr || !mRow) {
    return { ok: false, input: null, error: `Manuscript ${manuscriptId} not found.` }
  }
  const m = mRow as ManuscriptRow

  // ---- Registrability gates ----
  if (m.status !== 'published') {
    return {
      ok: false,
      input: null,
      error: `Refusing to deposit ${m.elocation_id || manuscriptId}: status is "${m.status}", not "published". A DOI must resolve to a live landing page.`,
    }
  }
  if (!m.elocation_id) {
    return { ok: false, input: null, error: 'Manuscript has no elocation_id.' }
  }
  if (!isValidOscrsjDoi(m.doi)) {
    return {
      ok: false,
      input: null,
      error: `Manuscript DOI "${m.doi}" is not a valid OSCRSJ DOI. Registration is permanent — refusing.`,
    }
  }
  if (!m.published_date) {
    return {
      ok: false,
      input: null,
      error: 'Manuscript has no published_date; the deposit asserts it as public record.',
    }
  }

  const pub = new Date(m.published_date)
  if (Number.isNaN(pub.getTime())) {
    return { ok: false, input: null, error: `Unparseable published_date "${m.published_date}".` }
  }

  const [{ data: aData }, { data: affData }] = await Promise.all([
    admin
      .from('manuscript_authors')
      .select('*')
      .eq('manuscript_id', manuscriptId)
      .order('author_order', { ascending: true }),
    admin
      .from('manuscript_affiliations')
      .select('*')
      .eq('manuscript_id', manuscriptId)
      .order('affiliation_order', { ascending: true }),
  ])

  const authorRows = (aData as ManuscriptAuthorRow[] | null) || []
  const affRows = (affData as ManuscriptAffiliationRow[] | null) || []
  if (authorRows.length === 0) {
    return { ok: false, input: null, error: 'Manuscript has no authors.' }
  }

  const affByAuthor = new Map<string, ManuscriptAffiliationRow>()
  for (const aff of affRows) {
    if (aff.manuscript_author_id && !affByAuthor.has(aff.manuscript_author_id)) {
      affByAuthor.set(aff.manuscript_author_id, aff)
    }
  }

  const authors: DepositAuthor[] = authorRows.map((a) => {
    const { givenName, surname } = splitName(a.full_name || '')
    const linked = affByAuthor.get(a.id)
    const affName =
      a.affiliation ||
      (linked
        ? [linked.department, linked.affiliation_name, linked.city, linked.country]
            .filter(Boolean)
            .join(', ')
        : null)
    return {
      givenName,
      surname,
      orcid: a.orcid_id,
      affiliation: affName,
      rorId: linked?.ror_id ?? null,
    }
  })

  // References from stored JATS. Absence is tolerated — a deposit without a
  // citation_list is valid; a deposit that failed to build is not.
  let references: DepositReference[] = []
  if (m.jats_xml_storage_path) {
    try {
      const { data: blob } = await admin.storage
        .from('submissions')
        .download(m.jats_xml_storage_path)
      if (blob) references = extractReferencesFromJats(await blob.text())
    } catch {
      references = []
    }
  }

  const year = pub.getUTCFullYear()

  return {
    ok: true,
    input: {
      doi: m.doi as string,
      elocationId: m.elocation_id,
      title: m.title || '',
      abstract: m.abstract,
      authors,
      publishedDate: {
        year,
        month: pub.getUTCMonth() + 1,
        day: pub.getUTCDate(),
      },
      volume: volumeForYear(year),
      issue: CURRENT_ISSUE,
      issn: ISSN,
      canonicalUrl: canonicalArticleUrl(m.elocation_id),
      pdfUrl: articlePdfUrl(m.elocation_id),
      references,
      depositorEmail,
      batchId: buildBatchId(m.elocation_id, Math.floor(now.getTime() / 1000)),
      timestamp: buildTimestamp(now),
    },
  }
}
