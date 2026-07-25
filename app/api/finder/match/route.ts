// POST /api/finder/match — score the journal registry against a manuscript's
// numbers (Sushant, Session 2). A row is logged to the "Finder Submissions" tab
// of the shared Google Sheet, and the scoring is fully deterministic
// (lib/finder/match.ts). Rate-limited 20/IP/day.
//
// 2026-07-25: no longer strictly stateless. One envelope row per query is now
// written to finder_queries (migration 029) so Studio metrics can report Finder
// demand at all — an append-only Sheet cannot be counted from the cron, and the
// Finder is half the product. NO email is collected here and none is stored;
// the row holds article type, word count, subspecialty, the top result and the
// bucket counts. Fire-and-forget: a DB failure must never fail a match.
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
import { createAdminClient } from '@/lib/supabase/server'

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
  // Countable demand signal (migration 029). Envelope only, never content.
  void (async () => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (createAdminClient().from('finder_queries') as any).insert({
        article_type: stats.articleType,
        word_count: stats.wordCount,
        subspecialty,
        top_journal: topName,
        counts: result.counts,
        supplied: [
          stats.wordCount,
          stats.abstractWordCount,
          stats.figureCount,
          stats.tableCount,
          stats.referenceCount,
        ].filter((v) => v !== null && v !== undefined).length,
        ip,
      })
    } catch (err) {
      console.error('[finder] query log failed:', err)
    }
  })()

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
