// Parse-stage budget/cursor/cap (2026-07-22, Part D). The DeepSeek-backed
// happy path needs a live key and is covered by the post-deploy battery; these
// tests pin the pure pieces — the reference cap, the budget-exhaustion cursor,
// and resume slicing — which are exactly the paths a killed function exercises.

import { test } from 'node:test'
import assert from 'node:assert'
import { capReferences, MAX_RAW_REFERENCES, progressFor } from '../lib/formatting/pipeline/api'
import { parseReferences } from '../lib/formatting/references/parse'

const refs = (n: number) => Array.from({ length: n }, (_, i) => `Author ${i + 1}. Title. J Example. 2020;1:1-5.`)

/* ------------------------------- the cap ------------------------------- */

test('capReferences: at or under the cap passes through with no note', () => {
  const under = refs(MAX_RAW_REFERENCES)
  const { refs: out, note } = capReferences(under)
  assert.equal(out.length, MAX_RAW_REFERENCES)
  assert.equal(note, null)
})

test('capReferences: over the cap keeps the first 150 and says so honestly', () => {
  const { refs: out, note } = capReferences(refs(300))
  assert.equal(out.length, MAX_RAW_REFERENCES)
  assert.equal(out[0], `Author 1. Title. J Example. 2020;1:1-5.`)
  assert.ok(note, 'a degraded note is produced — no silent truncation')
  assert.match(note!, /300/, 'note states how many were found')
  assert.match(note!, new RegExp(String(MAX_RAW_REFERENCES)), 'note states how many were processed')
})

/* --------------------------- budget + cursor --------------------------- */

test('parse: exhausted budget returns a cursor, never degrades the un-attempted tail', async () => {
  // budgetMs 0 exhausts before the first batch — nothing is attempted, no
  // network is touched (a real API key is irrelevant), and the cursor points
  // at the resume position instead of the tail being fallback-degraded.
  const result = await parseReferences(refs(50), { apiKey: 'test-key', budgetMs: 0 })
  assert.equal(result.nextCursor, 0, 'resume from the start')
  assert.equal(result.references.length, 0, 'nothing parsed')
  assert.equal(result.degraded, false, 'not degraded — just out of time')
})

test('parse: exhausted budget mid-list resumes from startIndex', async () => {
  const result = await parseReferences(refs(50), { apiKey: 'test-key', budgetMs: 0, startIndex: 40 })
  assert.equal(result.nextCursor, 40, 'cursor preserved at the resume position')
  assert.equal(result.references.length, 0)
})

test('parse: startIndex slices the work — only the remaining refs are returned', async () => {
  // No API key → deterministic fallback path, which must honor startIndex the
  // same way the live path does.
  const result = await parseReferences(refs(5), { apiKey: '', startIndex: 3 })
  assert.equal(result.nextCursor, null, 'list is done')
  assert.equal(result.references.length, 2, 'only refs 4 and 5')
  assert.equal(result.references[0].id, '4', 'global 1-based indices preserved')
  assert.equal(result.references[1].id, '5')
  assert.equal(result.degraded, true, 'no-key fallback is degraded and says so')
})

test('parse: empty list completes immediately with no cursor', async () => {
  const result = await parseReferences([], { apiKey: '', budgetMs: 40_000 })
  assert.equal(result.nextCursor, null)
  assert.deepEqual(result.references, [])
})

/* ------------------------- progress interpolation ------------------------- */

test('progressFor: parsed-stage cursor interpolates the 0.25-0.4 band with a count', () => {
  const mid = progressFor('parsed', { references_parsed: 75, parse_total: 150 })
  assert.ok(mid.progress > 0.25 && mid.progress < 0.4, `in band, got ${mid.progress}`)
  assert.match(mid.label, /75 of 150/)
  // no cursor → the static band start, unchanged behavior
  const bare = progressFor('parsed')
  assert.equal(bare.progress, 0.25)
})
