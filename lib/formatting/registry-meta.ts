// Client-safe registry metadata. GENERATED FILE — do not edit by hand.
// Regenerate with: npx tsx scripts/gen-journal-list.ts
// This module deliberately imports NO rule JSON files, so it is safe to import
// from client components. The full validated rules live in ./journalList.ts
// (server/build only). Source of truth: docs/formatting-expansion/manifest.json.

import type { ArticleType } from './rulesSchema'

/**
 * Filename-safe short abbreviation per journal — used to suffix output
 * filenames ("My Case Report_JBJS.docx") and as a search token in the picker.
 * Falls back to the upcased slug for any journal added without an entry.
 */
export const JOURNAL_ABBREVIATIONS: Record<string, string> = {
  oscrsj: "OSCRSJ",
  bjsm: "BJSM",
  'sports-medicine': "SportsMed",
  jshs: "JSHS",
  jcsm: "JCSM",
  'osteoarthritis-cartilage': "OAC",
  jbmr: "JBMR",
  ajsm: "AJSM",
  arthroscopy: "Arthroscopy",
  'sports-medicine-open': "SMO",
  kssta: "KSSTA",
  'biology-of-sport': "BiolSport",
  'journal-of-orthopaedic-translation': "JOrthTransl",
  'journal-of-arthroplasty': "JOA",
  jses: "JSES",
  bjj: "BJJ",
  jbjs: "JBJS",
  spine: "Spine",
  fai: "FAI",
  corr: "CORR",
  jhs: "JHS",
  jot: "JOT",
  injury: "Injury",
  jocr: "JOCR",
}

export function journalAbbrev(slug: string): string {
  return JOURNAL_ABBREVIATIONS[slug] ?? slug.replace(/[^a-z0-9]+/gi, '').toUpperCase()
}

/** Lightweight shape for the picker + marketing list (no engine internals). */
export interface JournalSummary {
  slug: string
  name: string
  abbrev: string
  publisher: string | null
  articleTypes: ArticleType[]
  guidelinesUrl: string
  verifiedDate: string
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
