// POST /api/finder/match — score the journal registry against a manuscript's
// numbers (Sushant, Session 2). Stateless: nothing is written to the DB. A row
// is logged to the "Finder Submissions" tab of the shared Google Sheet, and the
// scoring is fully deterministic (lib/finder/match.ts). Rate-limited 20/IP/day.
// Runs on Node because journalList pulls in the rule registry at import time.

import { NextRequest, NextResponse } from 'next/server'
import { JOURNALS, journalAbbrev } from '@/lib/formatting/journalList'
import { ARTICLE_TYPES, type ArticleType } from '@/lib/formatting/rulesSchema'
import { getJournalMeta } from '@/lib/finder/journalMeta'
import { scoreJournals } from '@/lib/finder/match'
import { attachExplanations } from '@/lib/finder/explain'
import { checkFinderRateLimit } from '@/lib/finder/rateLimit'
import { SCOPE_TAGS, type ManuscriptStats, type MatchableJournal, type ScopeTag, type SortKey } from '@/lib/finder/types'
import { appendRowToSheet } from '@/lib/integrations/googleSheets'
import { ARTICLE_TYPE_LABELS } from '@/lib/formatting/registry-meta'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Tab in the shared "OSCRSJ Form Submissions" Google Sheet. */
const FINDER_SHEET_TAB = 'Finder Submissions'

const SORT_KEYS: SortKey[] = ['fit', 'indexing', 'review_speed', 'apc_asc']

function clientIp(req: NextRequest): string | null {
  const xff = req.headers.get('x-forwarded-for')
  return xff ? xff.split(',')[0].trim() : req.headers.get('x-real-ip')
}

/** Coerce an incoming count to a non-negative integer, or null. */
function count(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  if (!Number.isFinite(n) || n < 0) return null
  return Math.floor(n)
}

function buildMatchable(articleType: ArticleType): MatchableJournal[] {
  return JOURNALS.map((j) => ({
    slug: j.identity.slug,
    name: j.identity.name,
    abbrev: journalAbbrev(j.identity.slug),
    publisher: j.identity.publisher,
    guidelinesUrl: j.identity.guidelines_url,
    verifiedDate: j.identity.verified_date,
    isSelf: j.identity.slug === 'oscrsj',
    articleTypes: j.article_types,
    limits: j.word_limits[articleType] ?? null,
    meta: getJournalMeta(j.identity.slug, j.article_types),
  }))
}

export async function POST(req: NextRequest) {
  const ip = clientIp(req)
  const rl = checkFinderRateLimit(ip)
  if (!rl.ok) {
    return NextResponse.json({ error: rl.reason }, { status: 429 })
  }

  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }
  const rawStats = (body as { stats?: unknown }).stats
  if (!rawStats || typeof rawStats !== 'object') {
    return NextResponse.json({ error: 'Missing manuscript details.' }, { status: 400 })
  }
  const s = rawStats as Record<string, unknown>

  const articleType = s.articleType
  if (typeof articleType !== 'string' || !(ARTICLE_TYPES as readonly string[]).includes(articleType)) {
    return NextResponse.json({ error: 'Select a valid article type.' }, { status: 400 })
  }

  const subspecialty =
    typeof s.subspecialty === 'string' && (SCOPE_TAGS as readonly string[]).includes(s.subspecialty)
      ? (s.subspecialty as ScopeTag)
      : null

  const sortByRaw = (body as { sortBy?: unknown }).sortBy
  const sortBy: SortKey =
    typeof sortByRaw === 'string' && (SORT_KEYS as string[]).includes(sortByRaw)
      ? (sortByRaw as SortKey)
      : 'fit'

  const stats: ManuscriptStats = {
    articleType: articleType as ArticleType,
    wordCount: count(s.wordCount),
    abstractWordCount: count(s.abstractWordCount),
    figureCount: count(s.figureCount),
    tableCount: count(s.tableCount),
    referenceCount: count(s.referenceCount),
    subspecialty,
  }

  const result = scoreJournals(stats, { sortBy }, buildMatchable(stats.articleType))
  // Optional "why this fits" lines — off unless explicitly enabled; never blocks.
  await attachExplanations(stats, result.results).catch(() => undefined)

  // Running log → "Finder Submissions" tab. Fire-and-forget; never blocks or
  // throws. Column order must match docs/google-sheets-apps-script.gs.
  const topName = result.topResult
    ? result.results.find((r) => r.slug === result.topResult)?.name ?? result.topResult
    : '(no fit)'
  void appendRowToSheet({
    sheetName: FINDER_SHEET_TAB,
    row: [
      new Date().toISOString(),
      ARTICLE_TYPE_LABELS[stats.articleType] ?? stats.articleType,
      stats.wordCount ?? '',
      subspecialty ?? '',
      topName,
      `${result.counts.fits} fit / ${result.counts.near_fit} near / ${result.counts.needs_work} needs work`,
      ip ?? '',
    ],
  })

  return NextResponse.json(result)
}
