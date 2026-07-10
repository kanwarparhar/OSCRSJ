// Golden-string tests for the deterministic reference renderers (Session B).
// Run: npx tsx --test tests/references-render.test.ts

import { test } from 'node:test'
import assert from 'node:assert'

import { renderReference, renderReferenceList } from '../lib/formatting/references/render'
import type { CslReference } from '../lib/formatting/types'
import type { JournalRules } from '../lib/formatting/rulesSchema'

type RefRules = JournalRules['references']

// The renderers read only rules.references, so tests build that block and wrap
// it in a JournalRules shell. The cast is intentional and keeps tests focused on
// the reference contract rather than every unrelated schema field.
const baseRefRules: RefRules = {
  style: 'nlm',
  in_text: 'superscript',
  in_text_punctuation: null,
  order: 'cited',
  journal_abbrev: 'nlm',
  include_doi: true,
  et_al_threshold: null,
  max_count: null,
}

function rules(overrides: Partial<RefRules>): JournalRules {
  return { references: { ...baseRefRules, ...overrides } } as unknown as JournalRules
}

// --- Fixtures --------------------------------------------------------------

// Two authors, full journal-article field set.
const kimSmith: CslReference = {
  id: 'ref1',
  type: 'article-journal',
  title: 'Outcomes of reverse shoulder arthroplasty in elderly patients',
  authors: [
    { family: 'Kim', given: 'David H' },
    { family: 'Smith', given: 'John A' },
  ],
  containerTitle: 'Journal of Bone and Joint Surgery',
  volume: '102',
  issue: '3',
  page: '210-215',
  year: '2020',
  doi: '10.2106/JBJS.19.00123',
  pmid: '31895123',
}

// Eight authors — exercises the et-al threshold and multi-word given names.
const eightAuthors: CslReference = {
  id: 'ref2',
  type: 'article-journal',
  title: 'Long-term survivorship of cementless total hip arthroplasty',
  authors: [
    { family: 'Kim', given: 'David H' },
    { family: 'Smith', given: 'John A' },
    { family: 'Johnson', given: 'Robert' },
    { family: 'Lee', given: 'Sang Hoon' },
    { family: 'Park', given: 'Ji Woo' },
    { family: 'Nguyen', given: 'Anh' },
    { family: 'Garcia', given: 'Maria Elena' },
    { family: 'Brown', given: 'Thomas R' },
  ],
  containerTitle: 'Clinical Orthopaedics and Related Research',
  volume: '478',
  issue: '9',
  page: '2011-2020',
  year: '2020',
  doi: '10.1097/CORR.0000000000001234',
  pmid: '32345678',
}

// Sparse reference: only year present among the publication-detail fields.
const sparse: CslReference = {
  id: 'ref3',
  type: 'article-journal',
  title: 'A note on distal radius fractures',
  authors: [{ family: 'Wong', given: 'K' }],
  containerTitle: 'Journal of Hand Surgery',
  volume: null,
  issue: null,
  page: null,
  year: '2019',
  doi: null,
  pmid: null,
}

// --- NLM -------------------------------------------------------------------

test('nlm: two authors, DOI on, NLM abbreviation', () => {
  assert.strictEqual(
    renderReference(kimSmith, rules({ style: 'nlm' })),
    'Kim DH, Smith JA. Outcomes of reverse shoulder arthroplasty in elderly patients. J Bone Joint Surg. 2020;102(3):210-215. doi:10.2106/JBJS.19.00123',
  )
})

test('nlm: include_doi false drops the DOI segment cleanly', () => {
  assert.strictEqual(
    renderReference(kimSmith, rules({ style: 'nlm', include_doi: false })),
    'Kim DH, Smith JA. Outcomes of reverse shoulder arthroplasty in elderly patients. J Bone Joint Surg. 2020;102(3):210-215.',
  )
})

test('nlm: journal_abbrev full keeps the container title verbatim', () => {
  assert.strictEqual(
    renderReference(kimSmith, rules({ style: 'nlm', journal_abbrev: 'full' })),
    'Kim DH, Smith JA. Outcomes of reverse shoulder arthroplasty in elderly patients. Journal of Bone and Joint Surgery. 2020;102(3):210-215. doi:10.2106/JBJS.19.00123',
  )
})

test('nlm: et_al_threshold 6 truncates an 8-author list to "et al."', () => {
  assert.strictEqual(
    renderReference(eightAuthors, rules({ style: 'nlm', et_al_threshold: 6 })),
    'Kim DH, Smith JA, Johnson R, Lee SH, Park JW, Nguyen A, et al. Long-term survivorship of cementless total hip arthroplasty. Clin Orthop Relat Res. 2020;478(9):2011-2020. doi:10.1097/CORR.0000000000001234',
  )
})

test('nlm: null et_al_threshold lists all eight authors', () => {
  assert.strictEqual(
    renderReference(eightAuthors, rules({ style: 'nlm', et_al_threshold: null })),
    'Kim DH, Smith JA, Johnson R, Lee SH, Park JW, Nguyen A, Garcia ME, Brown TR. Long-term survivorship of cementless total hip arthroplasty. Clin Orthop Relat Res. 2020;478(9):2011-2020. doi:10.1097/CORR.0000000000001234',
  )
})

test('nlm: missing volume/issue/page/doi render without stray punctuation', () => {
  assert.strictEqual(
    renderReference(sparse, rules({ style: 'nlm' })),
    'Wong K. A note on distal radius fractures. J Hand Surg. 2019.',
  )
})

// --- Vancouver (same style family as NLM) ----------------------------------

test('vancouver: matches NLM for a standard journal article', () => {
  assert.strictEqual(
    renderReference(kimSmith, rules({ style: 'vancouver' })),
    'Kim DH, Smith JA. Outcomes of reverse shoulder arthroplasty in elderly patients. J Bone Joint Surg. 2020;102(3):210-215. doi:10.2106/JBJS.19.00123',
  )
})

test('vancouver: et_al_threshold 6 on the 8-author reference', () => {
  assert.strictEqual(
    renderReference(eightAuthors, rules({ style: 'vancouver', et_al_threshold: 6 })),
    'Kim DH, Smith JA, Johnson R, Lee SH, Park JW, Nguyen A, et al. Long-term survivorship of cementless total hip arthroplasty. Clin Orthop Relat Res. 2020;478(9):2011-2020. doi:10.1097/CORR.0000000000001234',
  )
})

// --- AMA 11th --------------------------------------------------------------

test('ama: two authors, DOI on (plain text coincides with NLM for a journal article)', () => {
  assert.strictEqual(
    renderReference(kimSmith, rules({ style: 'ama' })),
    'Kim DH, Smith JA. Outcomes of reverse shoulder arthroplasty in elderly patients. J Bone Joint Surg. 2020;102(3):210-215. doi:10.2106/JBJS.19.00123',
  )
})

test('ama: include_doi false drops the DOI segment', () => {
  assert.strictEqual(
    renderReference(kimSmith, rules({ style: 'ama', include_doi: false })),
    'Kim DH, Smith JA. Outcomes of reverse shoulder arthroplasty in elderly patients. J Bone Joint Surg. 2020;102(3):210-215.',
  )
})

test('ama: et_al_threshold 6 truncates the 8-author list', () => {
  assert.strictEqual(
    renderReference(eightAuthors, rules({ style: 'ama', et_al_threshold: 6 })),
    'Kim DH, Smith JA, Johnson R, Lee SH, Park JW, Nguyen A, et al. Long-term survivorship of cementless total hip arthroplasty. Clin Orthop Relat Res. 2020;478(9):2011-2020. doi:10.1097/CORR.0000000000001234',
  )
})

// --- custom falls back to NLM ----------------------------------------------

test('custom: falls back to the NLM renderer', () => {
  assert.strictEqual(
    renderReference(kimSmith, rules({ style: 'custom' })),
    renderReference(kimSmith, rules({ style: 'nlm' })),
  )
})

// --- Title terminal punctuation --------------------------------------------

test('nlm: a title ending in "?" is not given a second terminator', () => {
  const q: CslReference = { ...sparse, title: 'Is early mobilization safe?' }
  assert.strictEqual(
    renderReference(q, rules({ style: 'nlm' })),
    'Wong K. Is early mobilization safe? J Hand Surg. 2019.',
  )
})

// --- List renderer ---------------------------------------------------------

test('renderReferenceList maps each reference in the given order', () => {
  const out = renderReferenceList([kimSmith, sparse], rules({ style: 'nlm', et_al_threshold: 6 }))
  assert.deepStrictEqual(out, [
    'Kim DH, Smith JA. Outcomes of reverse shoulder arthroplasty in elderly patients. J Bone Joint Surg. 2020;102(3):210-215. doi:10.2106/JBJS.19.00123',
    'Wong K. A note on distal radius fractures. J Hand Surg. 2019.',
  ])
})
