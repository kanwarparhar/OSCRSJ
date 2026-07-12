// Generator for lib/formatting/journalList.ts (Sushant, top-100 expansion,
// 2026-07-12). Hand-editing 100 static imports is error-prone, so the
// committed registry file is generated from docs/formatting-expansion/
// manifest.json (single source of truth for registry composition + order +
// abbreviations) plus the on-disk journal JSON files. The OUTPUT stays plain
// static TypeScript (Vercel-bundle safe — no runtime filesystem access).
//
//   npx tsx scripts/gen-journal-list.ts        # regenerate after adding files
//   npx tsx scripts/gen-journal-list.ts --check # verify it is up to date (CI)
//
// Ordering: OSCRSJ first, then every registry journal that (a) has a JSON file
// on disk and (b) a manifest row, sorted by SJR rank ascending; unranked
// extras last. A slug with a file but no manifest row is appended with a warn.

import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(here, '..')
const journalsDir = join(repoRoot, 'lib', 'formatting', 'journals')
const manifestPath = join(repoRoot, 'docs', 'formatting-expansion', 'manifest.json')
const outPath = join(repoRoot, 'lib', 'formatting', 'journalList.ts')
const metaPath = join(repoRoot, 'lib', 'formatting', 'registry-meta.ts')

interface ManifestRow {
  rank: number | null
  slug: string | null
  abbrev: string | null
  status: string
}

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
  journals: ManifestRow[]
}

// slug -> { rank, abbrev } from the manifest (encoded rows only)
const meta = new Map<string, { rank: number; abbrev: string }>()
for (const row of manifest.journals) {
  if (!row.slug || row.status !== 'encoded') continue
  meta.set(row.slug, {
    // unranked (OSCRSJ) / null-rank extras sort to the very end
    rank: row.rank ?? 100000,
    abbrev: row.abbrev ?? row.slug.toUpperCase(),
  })
}

// Files actually on disk (README.md and any non-slug files excluded).
const onDisk = readdirSync(journalsDir)
  .filter((f) => f.endsWith('.json'))
  .map((f) => f.replace(/\.json$/, ''))

// Order: OSCRSJ pinned first; then by SJR rank asc; unknown-to-manifest last.
const OSCRSJ = 'oscrsj'
const ordered = onDisk
  .filter((s) => s !== OSCRSJ)
  .sort((a, b) => {
    const ra = meta.get(a)?.rank ?? 99999
    const rb = meta.get(b)?.rank ?? 99999
    if (ra !== rb) return ra - rb
    return a.localeCompare(b)
  })
const finalSlugs = onDisk.includes(OSCRSJ) ? [OSCRSJ, ...ordered] : ordered

const orphans = onDisk.filter((s) => !meta.has(s))
if (orphans.length) {
  console.warn(`⚠ ${orphans.length} on-disk file(s) missing a manifest 'encoded' row: ${orphans.join(', ')}`)
}

// slug -> safe JS identifier for the import binding.
function ident(slug: string): string {
  const camel = slug.replace(/[^a-zA-Z0-9]+(.)?/g, (_, c: string | undefined) =>
    c ? c.toUpperCase() : '',
  )
  return /^[0-9]/.test(camel) ? `j_${camel}` : camel
}
const idents = new Map<string, string>()
const used = new Set<string>()
for (const slug of finalSlugs) {
  let id = ident(slug)
  while (used.has(id)) id += 'X'
  used.add(id)
  idents.set(slug, id)
}

const importLines = finalSlugs
  .map((s) => `import ${idents.get(s)} from './journals/${s}.json'`)
  .join('\n')

// RAW array wrapped at ~92 cols for readability.
const rawIdents = finalSlugs.map((s) => idents.get(s)!)
const rawLines: string[] = []
let line = '  '
for (const id of rawIdents) {
  const token = `${id}, `
  if ((line + token).length > 92) {
    rawLines.push(line.trimEnd())
    line = '  '
  }
  line += token
}
if (line.trim()) rawLines.push(line.trimEnd())
const rawBlock = rawLines.join('\n')

const abbrevLines = finalSlugs
  .map((s) => {
    const abbrev = meta.get(s)?.abbrev ?? s.toUpperCase()
    const key = /^[a-z][a-z0-9]*$/.test(s) ? s : `'${s}'`
    return `  ${key}: ${JSON.stringify(abbrev)},`
  })
  .join('\n')

// registry-meta.ts — CLIENT-SAFE metadata. Holds only rules-INDEPENDENT data
// (abbreviations, labels, the summary shape) with NO rule-JSON imports, so a
// client component ('use client') can import a journal label or abbreviation
// without dragging all ~100 rule files + zod into the browser bundle.
const metaFile = `// Client-safe registry metadata. GENERATED FILE — do not edit by hand.
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
${abbrevLines}
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
`

const file = `// Static journal registry. GENERATED FILE — do not edit by hand.
// Regenerate with: npx tsx scripts/gen-journal-list.ts
// Source of truth: docs/formatting-expansion/manifest.json (order + abbrevs) +
// the on-disk lib/formatting/journals/*.json rule files. Kept as static imports
// so the /format picker, the pipeline, and the freshness cron all read one
// validated list at build time — no runtime filesystem access (Vercel-safe).
//
// This module imports every rule JSON, so it must be imported ONLY from server /
// build code. Client components import the rules-free ./registry-meta instead,
// and receive JOURNAL_SUMMARIES as a prop from a server component. The
// client-safe metadata is re-exported here for back-compat with server callers.

import { journalRulesSchema, type JournalRules } from './rulesSchema'
import { journalAbbrev, type JournalSummary } from './registry-meta'

${importLines}

const RAW: unknown[] = [
${rawBlock}
]

/** All journal rules, validated against the schema, OSCRSJ first then by SJR rank. */
export const JOURNALS: JournalRules[] = RAW.map((r) => journalRulesSchema.parse(r))

export const JOURNALS_BY_SLUG: Record<string, JournalRules> = Object.fromEntries(
  JOURNALS.map((j) => [j.identity.slug, j]),
)

export function getJournal(slug: string): JournalRules | null {
  return JOURNALS_BY_SLUG[slug] ?? null
}

export const JOURNAL_SUMMARIES: JournalSummary[] = JOURNALS.map((j) => ({
  slug: j.identity.slug,
  name: j.identity.name,
  abbrev: journalAbbrev(j.identity.slug),
  publisher: j.identity.publisher,
  articleTypes: j.article_types,
  guidelinesUrl: j.identity.guidelines_url,
  verifiedDate: j.identity.verified_date,
}))

// Back-compat re-exports (server callers may still import these from here).
export { JOURNAL_ABBREVIATIONS, journalAbbrev, ARTICLE_TYPE_LABELS } from './registry-meta'
export type { JournalSummary } from './registry-meta'
`

const check = process.argv.includes('--check')
if (check) {
  let stale = false
  for (const [p, want, label] of [
    [outPath, file, 'journalList.ts'],
    [metaPath, metaFile, 'registry-meta.ts'],
  ] as const) {
    if (readFileSync(p, 'utf8') !== want) {
      console.error(`✗ ${label} is out of date. Run: npx tsx scripts/gen-journal-list.ts`)
      stale = true
    }
  }
  if (stale) process.exit(1)
  console.log(`✓ journalList.ts + registry-meta.ts up to date (${finalSlugs.length} journals).`)
} else {
  writeFileSync(metaPath, metaFile)
  writeFileSync(outPath, file)
  console.log(
    `✓ wrote registry-meta.ts + journalList.ts with ${finalSlugs.length} journals (OSCRSJ first, then by SJR rank).`,
  )
}
