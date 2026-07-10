// Tests for lib/formatting/references/verify.ts
//
// Offline (default): pure string math + response-parsing helpers against small
// inline JSON fixtures — deterministic, no network.
// Live (opt-in): set RUN_LIVE_VERIFY=1 to exercise verifyReferences() against
// real Crossref/PubMed for a well-known orthopaedic paper. Skipped by default
// so `npm test` stays offline/deterministic.
//
//   npx tsx --test tests/references-verify.test.ts                (offline)
//   RUN_LIVE_VERIFY=1 npx tsx --test tests/references-verify.test.ts   (live)

import test from 'node:test'
import assert from 'node:assert/strict'

import type { CslReference } from '../lib/formatting/types'
import {
  titleSimilarity,
  normalizeTitle,
  levenshtein,
  buildQuery,
  pickBestCrossrefCandidate,
  crossrefYear,
  crossrefAuthors,
  isRetractedCrossrefWork,
  parseEsearchIds,
  parsePubmedSummary,
  normalizeDoi,
  enrichFromCrossref,
  enrichFromPubmed,
  verifyReferences,
  type CrossrefWork,
} from '../lib/formatting/references/verify'

// ---------------------------------------------------------------------------
// titleSimilarity + normalization
// ---------------------------------------------------------------------------

test('levenshtein: basic distances', () => {
  assert.equal(levenshtein('', ''), 0)
  assert.equal(levenshtein('abc', 'abc'), 0)
  assert.equal(levenshtein('abc', 'abd'), 1)
  assert.equal(levenshtein('kitten', 'sitting'), 3)
  assert.equal(levenshtein('abc', ''), 3)
})

test('normalizeTitle: lowercases, strips punctuation, collapses spaces', () => {
  assert.equal(
    normalizeTitle('Total   Knee  Arthroplasty: A  Review!'),
    'total knee arthroplasty a review',
  )
  // accent folding (é → e); apostrophe is punctuation → collapses to a space
  assert.equal(normalizeTitle('Ménière’s Lésion'), 'meniere s lesion')
})

test('titleSimilarity: identical → 1.0', () => {
  assert.equal(titleSimilarity('Total knee arthroplasty', 'Total knee arthroplasty'), 1)
})

test('titleSimilarity: differs only by case/punctuation → 1.0', () => {
  assert.equal(
    titleSimilarity('Total Knee Arthroplasty.', '  total knee arthroplasty '),
    1,
  )
})

test('titleSimilarity: disjoint → ~0 (well below the 0.85 gate)', () => {
  const s = titleSimilarity('orthopedic surgery outcomes', 'quantum chromodynamics lattice')
  assert.ok(s < 0.3, `expected ~0, got ${s}`)
})

test('titleSimilarity: near-match (one word / typo) → > 0.85 but < 1.0', () => {
  const s = titleSimilarity(
    'Arthroscopic partial meniscectomy versus physical therapy',
    'Arthroscopic partial meniscectomy vs physical therapy',
  )
  assert.ok(s > 0.85, `expected > 0.85, got ${s}`)
  assert.ok(s < 1, `expected < 1, got ${s}`)
})

test('titleSimilarity: empty input → 0', () => {
  assert.equal(titleSimilarity('', ''), 0)
  assert.equal(titleSimilarity('anything', ''), 0)
})

// ---------------------------------------------------------------------------
// buildQuery
// ---------------------------------------------------------------------------

test('buildQuery: composes title + author families + year + container', () => {
  const ref: CslReference = {
    id: '1',
    type: 'article-journal',
    title: 'Projections of primary and revision hip and knee arthroplasty',
    authors: [
      { family: 'Kurtz', given: 'Steven' },
      { family: 'Ong', given: 'Kevin' },
    ],
    containerTitle: 'J Bone Joint Surg Am',
    volume: null,
    issue: null,
    page: null,
    year: '2007',
    doi: null,
    pmid: null,
  }
  assert.equal(
    buildQuery(ref),
    'Projections of primary and revision hip and knee arthroplasty Kurtz Ong 2007 J Bone Joint Surg Am',
  )
})

test('buildQuery: tolerates missing fields', () => {
  const ref: CslReference = {
    id: '2',
    type: 'article-journal',
    title: 'A title',
    authors: [],
    containerTitle: null,
    volume: null,
    issue: null,
    page: null,
    year: null,
    doi: null,
    pmid: null,
  }
  assert.equal(buildQuery(ref), 'A title')
})

// ---------------------------------------------------------------------------
// Crossref response parsing
// ---------------------------------------------------------------------------

const crossrefFixture = {
  message: {
    items: [
      {
        DOI: '10.9999/wrong',
        title: ['Something completely unrelated about cats'],
        'container-title': ['Feline Journal'],
      },
      {
        DOI: '10.2106/JBJS.F.00222',
        title: [
          'Projections of primary and revision hip and knee arthroplasty in the United States from 2005 to 2030',
        ],
        'container-title': ['The Journal of Bone and Joint Surgery-American Volume'],
        volume: '89',
        issue: '4',
        page: '780-785',
        author: [
          { family: 'Kurtz', given: 'Steven' },
          { family: 'Ong', given: 'Kevin' },
        ],
        issued: { 'date-parts': [[2007, 4]] },
        type: 'journal-article',
      },
    ],
  },
}

test('pickBestCrossrefCandidate: picks the highest-similarity item', () => {
  const title =
    'Projections of primary and revision hip and knee arthroplasty in the United States from 2005 to 2030'
  const { item, similarity } = pickBestCrossrefCandidate(crossrefFixture, title)
  assert.ok(item)
  assert.equal(item?.DOI, '10.2106/JBJS.F.00222')
  assert.ok(similarity > 0.99, `expected ~1.0, got ${similarity}`)
})

test('pickBestCrossrefCandidate: empty/malformed → no match', () => {
  assert.deepEqual(pickBestCrossrefCandidate({}, 'x'), { item: null, similarity: 0 })
  assert.deepEqual(pickBestCrossrefCandidate({ message: { items: [] } }, 'x'), {
    item: null,
    similarity: 0,
  })
})

test('crossrefYear: prefers issued, falls back through date fields', () => {
  assert.equal(crossrefYear({ issued: { 'date-parts': [[2007, 4]] } }), '2007')
  assert.equal(crossrefYear({ 'published-print': { 'date-parts': [[2019]] } }), '2019')
  assert.equal(crossrefYear({}), null)
})

test('crossrefAuthors: normalizes to {family, given}, drops empties, keeps orgs', () => {
  const item: CrossrefWork = {
    author: [
      { family: 'Kurtz', given: 'Steven' },
      { given: 'Nofamily' },
      { name: 'The Study Group' },
    ],
  }
  assert.deepEqual(crossrefAuthors(item), [
    { family: 'Kurtz', given: 'Steven' },
    { family: 'The Study Group', given: '' },
  ])
})

// ---------------------------------------------------------------------------
// Retraction detection
// ---------------------------------------------------------------------------

test('isRetractedCrossrefWork: clean article → false', () => {
  assert.equal(isRetractedCrossrefWork(crossrefFixture.message.items[1]), false)
  assert.equal(isRetractedCrossrefWork(null), false)
  assert.equal(isRetractedCrossrefWork(undefined), false)
})

test('isRetractedCrossrefWork: relation.is-retracted-by → true', () => {
  assert.equal(
    isRetractedCrossrefWork({
      relation: { 'is-retracted-by': [{ id: '10.x/retraction', 'id-type': 'doi' }] },
    }),
    true,
  )
})

test('isRetractedCrossrefWork: update-to/updated-by with retraction type → true', () => {
  assert.equal(
    isRetractedCrossrefWork({ 'update-to': [{ type: 'retraction' }] }),
    true,
  )
  assert.equal(
    isRetractedCrossrefWork({ 'updated-by': [{ type: 'Retraction' }] }),
    true,
  )
})

test('isRetractedCrossrefWork: type retracted-article → true', () => {
  assert.equal(isRetractedCrossrefWork({ type: 'retracted-article' }), true)
})

// ---------------------------------------------------------------------------
// PubMed response parsing
// ---------------------------------------------------------------------------

test('parseEsearchIds: extracts idlist, tolerates garbage', () => {
  assert.deepEqual(
    parseEsearchIds({ esearchresult: { idlist: ['17403800', '12345'] } }),
    ['17403800', '12345'],
  )
  assert.deepEqual(parseEsearchIds({}), [])
  assert.deepEqual(parseEsearchIds({ esearchresult: { idlist: 'nope' } }), [])
})

test('parsePubmedSummary: extracts title + doi from articleids', () => {
  const fixture = {
    result: {
      uids: ['17403800'],
      '17403800': {
        title:
          'Projections of primary and revision hip and knee arthroplasty in the United States from 2005 to 2030.',
        articleids: [
          { idtype: 'pubmed', value: '17403800' },
          { idtype: 'doi', value: '10.2106/JBJS.F.00222' },
        ],
      },
    },
  }
  const summary = parsePubmedSummary(fixture, '17403800')
  assert.ok(summary)
  assert.equal(summary?.pmid, '17403800')
  assert.equal(summary?.doi, '10.2106/jbjs.f.00222')
  assert.ok(summary?.title.startsWith('Projections of primary'))
})

test('parsePubmedSummary: missing record → null; no doi → null doi', () => {
  assert.equal(parsePubmedSummary({ result: {} }, '999'), null)
  const s = parsePubmedSummary(
    { result: { '1': { title: 'T', articleids: [{ idtype: 'pubmed', value: '1' }] } } },
    '1',
  )
  assert.equal(s?.doi, null)
})

test('normalizeDoi: strips url/doi prefixes and lowercases', () => {
  assert.equal(normalizeDoi('https://doi.org/10.2106/JBJS.F.00222'), '10.2106/jbjs.f.00222')
  assert.equal(normalizeDoi('doi: 10.1/AbC'), '10.1/abc')
  assert.equal(normalizeDoi(null), null)
  assert.equal(normalizeDoi('  '), null)
})

// ---------------------------------------------------------------------------
// Enrichment
// ---------------------------------------------------------------------------

const bareRef = (): CslReference => ({
  id: 'r',
  type: 'article-journal',
  title: 'Projections of primary and revision hip and knee arthroplasty',
  authors: [],
  containerTitle: null,
  volume: null,
  issue: null,
  page: null,
  year: null,
  doi: null,
  pmid: null,
})

test('enrichFromCrossref: fills missing fields + normalizes authors → changed', () => {
  const { reference, changed } = enrichFromCrossref(
    bareRef(),
    crossrefFixture.message.items[1] as CrossrefWork,
  )
  assert.equal(changed, true)
  assert.equal(reference.doi, '10.2106/jbjs.f.00222')
  assert.equal(reference.containerTitle, 'The Journal of Bone and Joint Surgery-American Volume')
  assert.equal(reference.volume, '89')
  assert.equal(reference.issue, '4')
  assert.equal(reference.page, '780-785')
  assert.equal(reference.year, '2007')
  assert.deepEqual(reference.authors, [
    { family: 'Kurtz', given: 'Steven' },
    { family: 'Ong', given: 'Kevin' },
  ])
})

test('enrichFromCrossref: fully-correct input is unchanged → changed=false', () => {
  const complete: CslReference = {
    id: 'r',
    type: 'article-journal',
    title: 'Projections of primary and revision hip and knee arthroplasty',
    authors: [
      { family: 'Kurtz', given: 'Steven' },
      { family: 'Ong', given: 'Kevin' },
    ],
    containerTitle: 'The Journal of Bone and Joint Surgery-American Volume',
    volume: '89',
    issue: '4',
    page: '780-785',
    year: '2007',
    doi: '10.2106/jbjs.f.00222',
    pmid: null,
  }
  const { reference, changed } = enrichFromCrossref(
    complete,
    crossrefFixture.message.items[1] as CrossrefWork,
  )
  assert.equal(changed, false)
  assert.deepEqual(reference, complete)
})

test('enrichFromPubmed: fills pmid + doi when missing', () => {
  const { reference, changed } = enrichFromPubmed(bareRef(), {
    pmid: '17403800',
    title: 'x',
    doi: '10.2106/jbjs.f.00222',
  })
  assert.equal(changed, true)
  assert.equal(reference.pmid, '17403800')
  assert.equal(reference.doi, '10.2106/jbjs.f.00222')
})

// ---------------------------------------------------------------------------
// verifyReferences: cursor / budget behaviour (offline — empty input, no net)
// ---------------------------------------------------------------------------

test('verifyReferences: empty list → nextCursor null, no work', async () => {
  const res = await verifyReferences([], 0)
  assert.deepEqual(res, { verified: [], nextCursor: null })
})

test('verifyReferences: startCursor past end → nextCursor null', async () => {
  const res = await verifyReferences([bareRef()], 5)
  assert.deepEqual(res, { verified: [], nextCursor: null })
})

// ---------------------------------------------------------------------------
// LIVE smoke test (opt-in) — hits real Crossref/PubMed
// ---------------------------------------------------------------------------

test(
  'live: enriches a well-known orthopaedic paper end-to-end',
  { skip: process.env.RUN_LIVE_VERIFY ? false : 'set RUN_LIVE_VERIFY=1 to run' },
  async () => {
    const refs: CslReference[] = [
      {
        // Kurtz et al., JBJS Am 2007 — DOI 10.2106/JBJS.F.00222, PMID 17403800.
        id: 'live-1',
        type: 'article-journal',
        title:
          'Projections of primary and revision hip and knee arthroplasty in the United States from 2005 to 2030',
        authors: [
          { family: 'Kurtz', given: 'Steven' },
          { family: 'Ong', given: 'Kevin' },
          { family: 'Lau', given: 'Edmund' },
        ],
        containerTitle: 'The Journal of Bone and Joint Surgery. American Volume',
        volume: null,
        issue: null,
        page: null,
        year: '2007',
        doi: null,
        pmid: null,
      },
    ]

    const res = await verifyReferences(refs, 0)
    assert.equal(res.nextCursor, null)
    assert.equal(res.verified.length, 1)

    const v = res.verified[0]
    // eslint-disable-next-line no-console
    console.log('LIVE verify result:', JSON.stringify(v, null, 2))

    assert.ok(
      v.status === 'verified' || v.status === 'corrected' || v.status === 'possibly-retracted',
      `unexpected status ${v.status}`,
    )
    assert.ok(v.source === 'crossref' || v.source === 'pubmed', `unexpected source ${v.source}`)
    assert.ok(v.matchConfidence >= 0.85, `low confidence ${v.matchConfidence}`)
    assert.ok(v.reference.doi != null, 'expected a DOI to be enriched')
  },
)
