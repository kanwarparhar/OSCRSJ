// Build-time validation gate for journal rule files (Sushant, Session 87).
//
//   npm run validate:rules
//
// Loads every lib/formatting/journals/*.json and validates it against
// journalRulesSchema. Exits non-zero if any file fails — wire this into CI so
// a malformed or drifted rules file can never reach production.

import { readdirSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { journalRulesSchema, SCHEMA_VERSION } from '../lib/formatting/rulesSchema'

const here = dirname(fileURLToPath(import.meta.url))
const journalsDir = join(here, '..', 'lib', 'formatting', 'journals')

const files = readdirSync(journalsDir)
  .filter((f) => f.endsWith('.json'))
  .sort()

if (files.length === 0) {
  console.error(`No journal rule files found in ${journalsDir}`)
  process.exit(1)
}

let failed = 0

for (const file of files) {
  const slug = file.replace(/\.json$/, '')
  const path = join(journalsDir, file)

  let data: unknown
  try {
    data = JSON.parse(readFileSync(path, 'utf8'))
  } catch (err) {
    failed++
    console.error(`✗ ${file}: invalid JSON — ${(err as Error).message}`)
    continue
  }

  const result = journalRulesSchema.safeParse(data)
  if (!result.success) {
    failed++
    console.error(`✗ ${file}`)
    for (const issue of result.error.issues) {
      const at = issue.path.length ? issue.path.join('.') : '(root)'
      console.error(`    ${at}: ${issue.message}`)
    }
    continue
  }

  if (result.data.identity.slug !== slug) {
    failed++
    console.error(
      `✗ ${file}: identity.slug "${result.data.identity.slug}" must match filename "${slug}"`,
    )
    continue
  }

  const types = result.data.article_types.length
  console.log(`✓ ${file.padEnd(28)} ${result.data.identity.name}  [${types} article types]`)
}

console.log('')
if (failed > 0) {
  console.error(`${failed} of ${files.length} journal rule file(s) FAILED validation.`)
  process.exit(1)
}
console.log(`All ${files.length} journal rule file(s) valid (schema v${SCHEMA_VERSION}).`)
