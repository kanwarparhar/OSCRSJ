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

test('nlm: null et_al_threshold falls back to the style default (6, then et al.)', () => {
  // 2026-07-22 doctrine fix: null = guide silent → the style's own default,
  // never full-list-by-default (which fabricated a rule out of silence).
  assert.strictEqual(
    renderReference(eightAuthors, rules({ style: 'nlm', et_al_threshold: null })),
    'Kim DH, Smith JA, Johnson R, Lee SH, Park JW, Nguyen A, et al. Long-term survivorship of cementless total hip arthroplasty. Clin Orthop Relat Res. 2020;478(9):2011-2020. doi:10.1097/CORR.0000000000001234',
  )
})

test("'all' et_al_threshold lists all eight authors (explicit journal requirement)", () => {
  assert.strictEqual(
    renderReference(eightAuthors, rules({ style: 'nlm', et_al_threshold: 'all' })),
    'Kim DH, Smith JA, Johnson R, Lee SH, Park JW, Nguyen A, Garcia ME, Brown TR. Long-term survivorship of cementless total hip arthroplasty. Clin Orthop Relat Res. 2020;478(9):2011-2020. doi:10.1097/CORR.0000000000001234',
  )
})

test('custom: null et_al_threshold lists every author (no manual to consult)', () => {
  assert.strictEqual(
    renderReference(eightAuthors, rules({ style: 'custom', et_al_threshold: null })),
    'Kim DH, Smith JA, Johnson R, Lee SH, Park JW, Nguyen A, Garcia ME, Brown TR. Long-term survivorship of cementless total hip arthroplasty. Clin Orthop Relat Res. 2020;478(9):2011-2020. doi:10.1097/CORR.0000000000001234',
  )
})

test('vancouver: null et_al_threshold truncates at the Vancouver default of 6', () => {
  assert.match(
    renderReference(eightAuthors, rules({ style: 'vancouver', et_al_threshold: null })),
    /Nguyen A, et al\./,
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

/* ---- Session 97 post-deploy: Crossref data hygiene on the emit path ------- */
//
// verify.ts substitutes Crossref's author record for the author's own, and
// Crossref metadata is inconsistently cased and dashed. These normalizations
// are deterministic string work in the renderer — correctness must NOT depend
// on which model sits behind the parse step.

test('shouted Crossref family names are cased down to NLM style', () => {
  // Observed live (job 2efc02ee): the manuscript said "Skaggs DL"; Crossref's
  // JBJS record said "SKAGGS DL", and enrichment made the output worse.
  const shouted: CslReference = {
    ...kimSmith,
    authors: [
      { family: 'SKAGGS', given: 'D L' },
      { family: 'CLUCK', given: 'M W' },
    ],
  }
  const out = renderReference(shouted, rules({}))
  assert.match(out, /^Skaggs DL, Cluck MW\./)
  assert.doesNotMatch(out, /SKAGGS|CLUCK/)
})

test('a name carrying any lowercase is NEVER rewritten', () => {
  // The safety property. Correctly-cased names must survive untouched.
  for (const family of ['McKee', 'MacDonald', 'van der Berg', "d'Auvergne", 'Smith-Jones', 'de la Cruz']) {
    const r: CslReference = { ...kimSmith, authors: [{ family, given: 'A B' }] }
    assert.match(renderReference(r, rules({})), new RegExp(`^${family.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} AB\\.`))
  }
})

test('shouted names keep their separators and handle Mc', () => {
  const cases: [string, string][] = [
    ["O'BRIEN", "O'Brien"],
    ['SMITH-JONES', 'Smith-Jones'],
    ['VAN DER BERG', 'Van Der Berg'],
    ['MCKEE', 'McKee'],
    ['MCDONALD', 'McDonald'],
    // Mac is deliberately left alone: MacDonald vs Macon is ambiguous, and
    // "Macdonald" is an accepted NLM rendering.
    ['MACON', 'Macon'],
    ['KAY', 'Kay'],
  ]
  for (const [input, expected] of cases) {
    const r: CslReference = { ...kimSmith, authors: [{ family: input, given: 'A' }] }
    assert.match(renderReference(r, rules({})), new RegExp(`^${expected.replace(/'/g, "'")} A\\.`), `${input} → ${expected}`)
  }
})

test('typographic dashes in page ranges become plain hyphens', () => {
  const enDash: CslReference = { ...kimSmith, page: '702–707' }
  assert.match(renderReference(enDash, rules({})), /:702-707\./)
  const emDash: CslReference = { ...kimSmith, page: '702—707' }
  assert.match(renderReference(emDash, rules({})), /:702-707\./)
})

test('page normalization leaves non-range page strings intact', () => {
  for (const [page, expect] of [['e51', 'e51'], ['S12-S18', 'S12-S18'], ['1234', '1234']] as [string, string][]) {
    const r: CslReference = { ...kimSmith, page }
    assert.match(renderReference(r, rules({})), new RegExp(`:${expect}\\.`))
  }
})

test('an already-abbreviated given name keeps every initial', () => {
  // The structurer turns "Skaggs DL" into given "DL". Taking only the first
  // character would drop an initial from the author's own citation.
  const r: CslReference = { ...kimSmith, authors: [{ family: 'Skaggs', given: 'DL' }] }
  assert.match(renderReference(r, rules({})), /^Skaggs DL\./)
})

test('a shouted three-letter given name still reduces to one initial', () => {
  for (const given of ['ANN', 'AMY']) {
    const r: CslReference = { ...kimSmith, authors: [{ family: 'Smith', given }] }
    assert.match(renderReference(r, rules({})), new RegExp(`^Smith ${given[0]}\\.`), given)
  }
})

test('ordinary given names still reduce to initials', () => {
  const r: CslReference = { ...kimSmith, authors: [{ family: 'Kim', given: 'David H' }] }
  assert.match(renderReference(r, rules({})), /^Kim DH\./)
})
