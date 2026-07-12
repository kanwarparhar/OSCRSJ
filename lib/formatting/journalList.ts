// Static journal registry (Sushant, Session C). The 14 rule files are imported
// at build time so the /format picker, the pipeline, and the freshness cron all
// read one validated list — no runtime filesystem access (Vercel-bundle safe).

import { journalRulesSchema, type JournalRules, type ArticleType } from './rulesSchema'

import oscrsj from './journals/oscrsj.json'
import jbjs from './journals/jbjs.json'
import bjj from './journals/bjj.json'
import corr from './journals/corr.json'
import ajsm from './journals/ajsm.json'
import jses from './journals/jses.json'
import journalOfArthroplasty from './journals/journal-of-arthroplasty.json'
import arthroscopy from './journals/arthroscopy.json'
import injury from './journals/injury.json'
import jot from './journals/jot.json'
import spine from './journals/spine.json'
import fai from './journals/fai.json'
import jhs from './journals/jhs.json'
import jocr from './journals/jocr.json'

const RAW: unknown[] = [
  oscrsj, jbjs, bjj, corr, ajsm, jses, journalOfArthroplasty, arthroscopy,
  injury, jot, spine, fai, jhs, jocr,
]

/** All journal rules, validated against the schema, OSCRSJ first. */
export const JOURNALS: JournalRules[] = RAW.map((r) => journalRulesSchema.parse(r))

export const JOURNALS_BY_SLUG: Record<string, JournalRules> = Object.fromEntries(
  JOURNALS.map((j) => [j.identity.slug, j]),
)

export function getJournal(slug: string): JournalRules | null {
  return JOURNALS_BY_SLUG[slug] ?? null
}

/** Lightweight shape for the picker + marketing list (no engine internals). */
export interface JournalSummary {
  slug: string
  name: string
  publisher: string | null
  articleTypes: ArticleType[]
  guidelinesUrl: string
  verifiedDate: string
}

export const JOURNAL_SUMMARIES: JournalSummary[] = JOURNALS.map((j) => ({
  slug: j.identity.slug,
  name: j.identity.name,
  publisher: j.identity.publisher,
  articleTypes: j.article_types,
  guidelinesUrl: j.identity.guidelines_url,
  verifiedDate: j.identity.verified_date,
}))

/**
 * Filename-safe short abbreviation per journal — used to suffix output
 * filenames ("My Case Report_JBJS.docx"). Falls back to the upcased slug for
 * any journal added without an entry.
 */
export const JOURNAL_ABBREVIATIONS: Record<string, string> = {
  oscrsj: 'OSCRSJ',
  jbjs: 'JBJS',
  bjj: 'BJJ',
  corr: 'CORR',
  ajsm: 'AJSM',
  jses: 'JSES',
  'journal-of-arthroplasty': 'JOA',
  arthroscopy: 'Arthroscopy',
  injury: 'Injury',
  jot: 'JOT',
  spine: 'Spine',
  fai: 'FAI',
  jhs: 'JHS',
  jocr: 'JOCR',
}

export function journalAbbrev(slug: string): string {
  return JOURNAL_ABBREVIATIONS[slug] ?? slug.replace(/[^a-z0-9]+/gi, '').toUpperCase()
}

/** Human labels for article-type enum values (picker + report). */
export const ARTICLE_TYPE_LABELS: Record<ArticleType, string> = {
  case_report: 'Case Report',
  case_series: 'Case Series',
  original_research: 'Original Research',
  review: 'Review',
  systematic_review: 'Systematic Review / Meta-Analysis',
  narrative_review: 'Narrative Review',
  technical_note: 'Technical Note / Surgical Technique',
  letter: 'Letter to the Editor',
  editorial: 'Editorial',
}
