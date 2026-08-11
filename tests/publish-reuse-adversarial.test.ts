// Adversarial harness for the Submission-Studio → publish-pipeline reuse
// (2026-07-26, pre-implementation session for the Revamp plan — see
// docs/2026-07-26-submission-studio-reuse-implementation-plan.md).
//
// PURPOSE. Phases 1–3 of the reuse plan call ingestDocx / parseReferences /
// verifyReferences / assertBodyImmutable SERVER-SIDE on author uploads at
// accept time. These tests attack exactly the surfaces that integration
// exposes: hostile/malformed .docx files, degraded LLM responses, budget
// misuse, marker-edit collisions, and rules-analysis edge cases. Everything
// here is deterministic (the DeepSeek "API" is a local mock server) and safe
// to run in CI. Live Crossref/PubMed probing lives in
// scripts/probe-references-live.mjs, NOT here.
//
// CONTRACT NOTES FOR THE INTEGRATION (each encoded as a test below):
//   [C1] parseReferences: OMIT budgetMs server-side. budgetMs: 0 parses
//        NOTHING and returns nextCursor=0 — a plausible-looking "no budget"
//        spelling that silently produces zero references.
//   [C2] parseReferences without DEEPSEEK_API_KEY degrades to the regex
//        fallback: count is preserved, DOIs/years are regex-recovered, and
//        degraded=true. The publish path must surface `degraded`, never
//        treat the fallback as parsed truth.
//   [C3] ingestDocx hazards are the acceptance gate: tracked changes,
//        comments, and <2 detected sections are fatal:true and must block
//        (or force manual override of) the publish-package build.
//   [C4] assertBodyImmutable's edit list is order-sensitive and
//        collision-safe only for bracketed `from` markers. Any post-accept
//        stage claiming to be non-destructive must pass it with edits=[].

import { test } from 'node:test'
import assert from 'node:assert'
import { createServer, type Server } from 'node:http'
import { AddressInfo } from 'node:net'
import { readFileSync } from 'node:fs'

import { ingestDocx, IngestError } from '../lib/formatting/ooxml/ingest'
import { emitDocx } from '../lib/formatting/ooxml/emit'
import {
  Docx,
  PART,
  createDocx,
  paraXml,
  extractBodyText,
} from '../lib/formatting/ooxml/docx'
import { assertBodyImmutable } from '../lib/formatting/pipeline/immutability'
import { analyze } from '../lib/formatting/pipeline/analyze'
import { parseReferences } from '../lib/formatting/references/parse'
import {
  titleSimilarity,
  normalizeDoi,
  normalizeTitle,
  pickBestCrossrefCandidate,
  isRetractedCrossrefWork,
  enrichFromCrossref,
  parseEsearchIds,
  parsePubmedSummary,
  type CrossrefWork,
} from '../lib/formatting/references/verify'
import { parseJournalRules } from '../lib/formatting'
import { validateMetadataForRender } from '../lib/publish/synthesize'
import oscrsjRules from '../lib/formatting/journals/oscrsj.json'

// ---------------------------------------------------------------------------
// Fixture builders
// ---------------------------------------------------------------------------

/** Paragraph carrying a real Word heading style. */
function headingPara(text: string): string {
  return (
    `<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr>` +
    `<w:r><w:t xml:space="preserve">${text}</w:t></w:r></w:p>`
  )
}

/** Paragraph whose only formatting is bold — the author-typed heading style. */
function boldPara(text: string): string {
  return (
    `<w:p><w:r><w:rPr><w:b/></w:rPr>` +
    `<w:t xml:space="preserve">${text}</w:t></w:r></w:p>`
  )
}

function bodyPara(text: string): string {
  return paraXml(text)
}

const CASE_BODY = {
  intro:
    'Carpal tunnel syndrome is the most common entrapment neuropathy of the upper extremity, affecting the median nerve at the wrist.',
  presentation:
    'A 47-year-old right-hand-dominant patient presented with 6 months of nocturnal paresthesias. Nerve conduction studies confirmed the diagnosis [1]. A cohort of 3 patients was reviewed for context [2].',
  discussion:
    'Endoscopic release shows comparable outcomes to open release in this setting [1,2].',
  conclusion: 'Early release produced full symptom resolution at 12 weeks.',
}

const REFS = [
  'Smith J, Jones K. Outcomes of endoscopic carpal tunnel release. J Hand Surg Am. 2019;44(3):211-218. doi:10.1016/j.jhsa.2018.11.004',
  'Lee P, et al. Nerve conduction thresholds in compression neuropathy. Muscle Nerve. 2021;63(1):44-52.',
]

/** A structurally-normal case report; headings via pStyle or bold-only. */
function buildManuscript(style: 'pstyle' | 'bold'): Uint8Array {
  const h = style === 'pstyle' ? headingPara : boldPara
  const paras = [
    h('Abstract'),
    bodyPara('Introduction: Common problem. Case Presentation: One case. Discussion: Works. Conclusion: Fine.'),
    h('Keywords'),
    bodyPara('carpal tunnel; median nerve; endoscopic release'),
    h('Introduction'),
    bodyPara(CASE_BODY.intro),
    h('Case Presentation'),
    bodyPara(CASE_BODY.presentation),
    h('Discussion'),
    bodyPara(CASE_BODY.discussion),
    h('Conclusion'),
    bodyPara(CASE_BODY.conclusion),
    h('References'),
    bodyPara(`1. ${REFS[0]}`),
    bodyPara(`2. ${REFS[1]}`),
  ]
  return emitDocx(createDocx(paras))
}

/** Insert raw XML immediately after <w:body> of an emitted docx. */
function injectIntoBody(bytes: Uint8Array, xml: string): Uint8Array {
  const docx = new Docx(bytes)
  const doc = docx.part(PART.document)!
  docx.setPart(PART.document, doc.replace(/(<w:body\b[^>]*>)/, `$1${xml}`))
  return emitDocx(docx)
}

async function ingestHazardKinds(bytes: Uint8Array): Promise<Map<string, boolean>> {
  const { model } = await ingestDocx(bytes)
  return new Map(model.hazards.map((h) => [h.kind, h.fatal]))
}

// ---------------------------------------------------------------------------
// Ingest — hostile document handling
// ---------------------------------------------------------------------------

test('adversarial ingest: bold-only headings detect the same sections as styled headings', async () => {
  const a = await ingestDocx(buildManuscript('pstyle'))
  const b = await ingestDocx(buildManuscript('bold'))
  const keys = (m: typeof a) => m.model.detectedSections.map((s) => s.normalized)
  assert.deepEqual(keys(b), keys(a))
  assert.equal(b.model.articleTypeGuess, 'case_report')
  assert.equal(b.model.rawReferences.length, 2)
  // This equivalence is precisely what the renderer's Header-node walker
  // lacked (e0002 front-matter-only render). The publish package MUST come
  // from this ingest, not from a second, weaker heading detector.
})

test('adversarial ingest: tracked changes are a fatal hazard', async () => {
  const withIns = injectIntoBody(
    buildManuscript('pstyle'),
    `<w:p><w:ins w:id="1" w:author="X"><w:r><w:t>sneaky edit</w:t></w:r></w:ins></w:p>`,
  )
  const hazards = await ingestHazardKinds(withIns)
  assert.equal(hazards.get('tracked_changes'), true)
})

test('adversarial ingest: a comments part is a fatal hazard even with no comment references', async () => {
  const docx = new Docx(buildManuscript('pstyle'))
  docx.setPart(
    'word/comments.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:comments xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"/>`,
  )
  const hazards = await ingestHazardKinds(emitDocx(docx))
  assert.equal(hazards.get('comments'), true)
})

test('adversarial ingest: fewer than two detected sections is fatal', async () => {
  const bytes = emitDocx(
    createDocx([headingPara('Introduction'), bodyPara('Only one section here.')]),
  )
  const hazards = await ingestHazardKinds(bytes)
  assert.equal(hazards.get('no_detectable_sections'), true)
})

test('adversarial ingest: an empty document does not crash and is fatally flagged', async () => {
  const bytes = emitDocx(createDocx([]))
  const { model } = await ingestDocx(bytes)
  assert.equal(model.detectedSections.length, 0)
  assert.ok(model.hazards.some((h) => h.kind === 'no_detectable_sections' && h.fatal))
})

test('adversarial ingest: random bytes reject as not_docx', async () => {
  const junk = new Uint8Array(4096)
  for (let i = 0; i < junk.length; i++) junk[i] = (i * 37) % 256
  await assert.rejects(ingestDocx(junk), (e: unknown) => {
    assert.ok(e instanceof IngestError)
    assert.equal(e.code, 'not_docx')
    return true
  })
})

test('adversarial ingest: a real zip that is not a Word package rejects as not_docx', async () => {
  const docx = new Docx()
  docx.setPart('hello.txt', 'not a manuscript')
  await assert.rejects(ingestDocx(emitDocx(docx)), (e: unknown) => {
    assert.ok(e instanceof IngestError)
    assert.equal(e.code, 'not_docx')
    return true
  })
})

test('adversarial ingest: oversized document.xml rejects as too_large (zip-bomb guard)', async () => {
  // 101 MB of document XML compresses to ~100 KB — the exact bomb shape the
  // declared-size pre-check exists for.
  const hugeText = 'a'.repeat(101 * 1024 * 1024)
  const docx = new Docx(buildManuscript('pstyle'))
  const doc = docx.part(PART.document)!
  docx.setPart(
    PART.document,
    doc.replace('</w:body>', `<w:p><w:r><w:t>${hugeText}</w:t></w:r></w:p></w:body>`),
  )
  const bytes = emitDocx(docx)
  assert.ok(bytes.length < 5 * 1024 * 1024, 'bomb is small on disk')
  await assert.rejects(ingestDocx(bytes), (e: unknown) => {
    assert.ok(e instanceof IngestError)
    assert.equal(e.code, 'too_large')
    return true
  })
})

test('adversarial ingest: heading heuristic rejects long and unbolded lookalikes', async () => {
  const bytes = emitDocx(
    createDocx([
      headingPara('Introduction'),
      bodyPara('Text.'),
      // bold but 9 words → not a heading
      boldPara('This bold sentence has exactly nine words in it'),
      // w:val="0" explicitly NOT bold → not a heading
      `<w:p><w:r><w:rPr><w:b w:val="0"/></w:rPr><w:t>Results</w:t></w:r></w:p>`,
      headingPara('Discussion'),
      bodyPara('More text.'),
    ]),
  )
  const { model } = await ingestDocx(bytes)
  assert.deepEqual(
    model.detectedSections.map((s) => s.normalized),
    ['introduction', 'discussion'],
  )
})

// KNOWN BUG (BUG-ING-1, found by this harness 2026-07-26): ingest.ts isHeading
// line ~139 reads `if (/[.?!,;]$/.test(t) && !/[.):]$/.test(normalizeHeading(t) + '.'))` —
// the appended '.' makes the second regex ALWAYS match, so the punctuation
// rejection NEVER fires. A short all-bold prose sentence ending in '.' is
// promoted to a section heading, fragmenting sections and corrupting word
// counts and the article-type guess. Fix (implementation plan F-ING-1):
// drop the broken second clause → `if (/[.?!,;]$/.test(t)) return false`,
// then remove { todo } here and this test becomes the regression gate.
test(
  'adversarial ingest: a short bold prose sentence ending in a period is NOT a heading',
  { todo: 'BUG-ING-1 — punctuation rejection in isHeading is dead code; fix per implementation plan' },
  async () => {
    const bytes = emitDocx(
      createDocx([
        headingPara('Introduction'),
        bodyPara('Text.'),
        boldPara('The patient improved dramatically.'),
        headingPara('Discussion'),
        bodyPara('More text.'),
      ]),
    )
    const { model } = await ingestDocx(bytes)
    assert.deepEqual(
      model.detectedSections.map((s) => s.normalized),
      ['introduction', 'discussion'],
    )
  },
)

test('adversarial ingest: numbered and aliased headings normalize', async () => {
  const bytes = emitDocx(
    createDocx([
      headingPara('1. Introduction'),
      bodyPara('One.'),
      headingPara('2) Case Report'),
      bodyPara('Two.'),
      headingPara('3: Materials and Methods'),
      bodyPara('Three.'),
      headingPara('CONCLUSIONS'),
      bodyPara('Four.'),
    ]),
  )
  const { model } = await ingestDocx(bytes)
  const keys = model.detectedSections.map((s) => s.normalized)
  assert.deepEqual(keys, ['introduction', 'case_presentation', 'methods', 'conclusion'])
  // case_presentation + methods → case_series
  assert.equal(model.articleTypeGuess, 'case_series')
})

test('adversarial ingest: unicode and XML entities survive the round trip byte-for-byte', async () => {
  const tricky =
    'Dosage was 5 µg × 3, β-blocker naïve — “curly quotes”, café & <tags> ≥ 45°.'
  const bytes = emitDocx(
    createDocx([
      headingPara('Introduction'),
      bodyPara(tricky),
      headingPara('Discussion'),
      bodyPara('Plain.'),
    ]),
  )
  const { docx, model } = await ingestDocx(bytes)
  assert.ok(model.bodyText.includes(tricky), 'decoded body text contains the exact string')
  const reopened = new Docx(emitDocx(docx))
  const after = extractBodyText(reopened.part(PART.document)!)
  const verdict = assertBodyImmutable(model.bodyText, after, [])
  assert.equal(verdict.ok, true, verdict.diffExcerpt)
})

test('adversarial ingest: reference numbering variants are stripped', async () => {
  const bytes = emitDocx(
    createDocx([
      headingPara('Introduction'),
      bodyPara('X.'),
      headingPara('Discussion'),
      bodyPara('Y.'),
      headingPara('References'),
      bodyPara('1. First ref. J One. 2020.'),
      bodyPara('12) Twelfth ref. J Two. 2021.'),
      bodyPara('3: Third ref. J Three. 2022.'),
    ]),
  )
  const { model } = await ingestDocx(bytes)
  assert.deepEqual(model.rawReferences, [
    'First ref. J One. 2020.',
    'Twelfth ref. J Two. 2021.',
    'Third ref. J Three. 2022.',
  ])
})

test('adversarial ingest: a 4000-paragraph manuscript ingests quickly and counts words', async () => {
  const paras: string[] = [headingPara('Introduction')]
  for (let i = 0; i < 4000; i++) paras.push(bodyPara(`Paragraph ${i} has exactly six words here.`))
  paras.push(headingPara('Discussion'), bodyPara('Done.'))
  const t0 = Date.now()
  const { model } = await ingestDocx(emitDocx(createDocx(paras)))
  const elapsed = Date.now() - t0
  assert.ok(elapsed < 15_000, `ingest took ${elapsed}ms`)
  const intro = model.detectedSections.find((s) => s.normalized === 'introduction')!
  assert.equal(intro.wordCount, 4000 * 7)
})

// ---------------------------------------------------------------------------
// Immutability gate — the trust asset the publish path inherits
// ---------------------------------------------------------------------------

test('immutability: whitespace-only drift passes; a single changed digit fails', () => {
  assert.equal(assertBodyImmutable('a  b\nc', 'a b c', []).ok, true)
  const r = assertBodyImmutable('dose was 5 mg daily', 'dose was 50 mg daily', [])
  assert.equal(r.ok, false)
  assert.ok(r.diffExcerpt && r.diffExcerpt.includes('≠'))
})

test('immutability: prefix-colliding bracketed markers resolve in document order', () => {
  const before = 'First claim [1]. Second claim [1,2]. Third claim [1].'
  const after = 'First claim [3]. Second claim [3,4]. Third claim [3].'
  const r = assertBodyImmutable(before, after, [
    { from: '[1]', to: '[3]' },
    { from: '[1,2]', to: '[3,4]' },
    { from: '[1]', to: '[3]' },
  ])
  assert.equal(r.ok, true, r.diffExcerpt)
})

test('immutability: bare-digit replacement markers do not collide with prose digits', () => {
  // superscript journals: "[12]" → "12". The prose "a cohort of 12 patients"
  // must not confuse the gate (the 2026-07-22 collision class).
  const before = 'A cohort of 12 patients was studied [12].'
  const after = 'A cohort of 12 patients was studied 12.'
  const r = assertBodyImmutable(before, after, [{ from: '[12]', to: '12' }])
  assert.equal(r.ok, true, r.diffExcerpt)
})

test('immutability: declared edits do not license OTHER mutations', () => {
  const before = 'Dose 5 mg [1]. Outcome good.'
  const after = 'Dose 50 mg [2]. Outcome good.'
  const r = assertBodyImmutable(before, after, [{ from: '[1]', to: '[2]' }])
  assert.equal(r.ok, false)
})

test('immutability: a missing declared marker fails loudly', () => {
  const r = assertBodyImmutable('No markers here.', 'No markers here.', [
    { from: '[9]', to: '[1]' },
  ])
  assert.equal(r.ok, false)
  assert.ok(r.diffExcerpt!.includes('citation markers'))
})

// ---------------------------------------------------------------------------
// parseReferences — degraded-LLM and budget behavior (mock DeepSeek)
// ---------------------------------------------------------------------------

interface MockPlan {
  /** Response factory per request (in order). Falls back to last entry. */
  responses: Array<(bodyJson: any) => { status: number; body: string }>
}

async function withMockDeepseek<T>(
  plan: MockPlan,
  fn: (baseUrl: string, calls: any[]) => Promise<T>,
): Promise<T> {
  const calls: any[] = []
  const server: Server = createServer((req, res) => {
    let raw = ''
    req.on('data', (c) => (raw += c))
    req.on('end', () => {
      const bodyJson = JSON.parse(raw)
      calls.push(bodyJson)
      const factory = plan.responses[Math.min(calls.length - 1, plan.responses.length - 1)]
      const { status, body } = factory(bodyJson)
      res.writeHead(status, { 'Content-Type': 'application/json' })
      res.end(body)
    })
  })
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
  const port = (server.address() as AddressInfo).port
  try {
    return await fn(`http://127.0.0.1:${port}`, calls)
  } finally {
    server.close()
  }
}

/** Extract the numbered reference lines the client sent, as {index,text}. */
function sentRefs(bodyJson: any): { index: number; text: string }[] {
  const user = bodyJson.messages.find((m: any) => m.role === 'user').content as string
  return user
    .split('\n')
    .map((l: string) => l.match(/^(\d+)\.\s(.*)$/))
    .filter(Boolean)
    .map((m: any) => ({ index: Number(m[1]), text: m[2] }))
}

function okResponse(refs: any[]): { status: number; body: string } {
  return {
    status: 200,
    body: JSON.stringify({
      choices: [{ message: { content: JSON.stringify({ references: refs }) } }],
      usage: { prompt_tokens: 100, completion_tokens: 100 },
    }),
  }
}

test('[C2] parseReferences without an API key degrades but preserves every reference', async () => {
  const saved = process.env.DEEPSEEK_API_KEY
  delete process.env.DEEPSEEK_API_KEY
  try {
    const raw = [
      'Smith J. Endoscopic release. J Hand Surg. 2019. doi:10.1016/j.jhsa.2018.11.004',
      'No metadata at all in this one',
    ]
    const r = await parseReferences(raw, {})
    assert.equal(r.degraded, true)
    assert.equal(r.references.length, 2)
    assert.equal(r.references[0].doi, '10.1016/j.jhsa.2018.11.004')
    assert.equal(r.references[0].year, '2019')
    assert.equal(r.references[0].title, raw[0], 'raw string preserved as title — nothing dropped')
    assert.equal(r.nextCursor, null)
  } finally {
    if (saved !== undefined) process.env.DEEPSEEK_API_KEY = saved
  }
})

test('parseReferences: malformed model output retries once then falls back — never drops refs', async () => {
  await withMockDeepseek(
    { responses: [() => ({ status: 200, body: JSON.stringify({ choices: [{ message: { content: 'NOT JSON {{{' } }] }) })] },
    async (baseUrl, calls) => {
      const r = await parseReferences(['Ref A. 2020.', 'Ref B. 2021.'], {
        apiKey: 'test',
        baseUrl,
      })
      assert.equal(calls.length, 2, 'exactly one retry')
      assert.equal(r.degraded, true)
      assert.equal(r.references.length, 2)
      assert.ok(r.error && r.error.includes('validation failed'))
    },
  )
})

test('parseReferences: indices the model omits are backfilled deterministically', async () => {
  await withMockDeepseek(
    {
      responses: [
        (body) => {
          const refs = sentRefs(body)
          // "forget" every even index
          const kept = refs
            .filter((x) => x.index % 2 === 1)
            .map((x) => ({
              index: x.index,
              type: 'article-journal',
              title: `Parsed ${x.index}`,
              authors: [],
              containerTitle: null,
              volume: null,
              issue: null,
              page: null,
              year: '2020',
              doi: null,
              pmid: null,
            }))
          return okResponse(kept)
        },
      ],
    },
    async (baseUrl) => {
      const raw = ['One. 2020.', 'Two. 2021.', 'Three. 2022.', 'Four. 2023.']
      const r = await parseReferences(raw, { apiKey: 'test', baseUrl })
      assert.equal(r.references.length, 4)
      assert.equal(r.references[0].title, 'Parsed 1')
      assert.equal(r.references[1].title, 'Two. 2021.', 'omitted index kept as raw fallback')
      assert.equal(r.references[3].year, '2023', 'fallback regex-recovers the year')
    },
  )
})

test('parseReferences: DOI URL prefixes are normalized off model output', async () => {
  await withMockDeepseek(
    {
      responses: [
        (body) =>
          okResponse(
            sentRefs(body).map((x) => ({
              index: x.index,
              type: 'article-journal',
              title: `T${x.index}`,
              authors: [{ family: 'Smith', given: 'J' }],
              containerTitle: 'J',
              volume: null,
              issue: null,
              page: null,
              year: '2020',
              doi: 'https://doi.org/10.1000/xyz',
              pmid: null,
            })),
          ),
      ],
    },
    async (baseUrl) => {
      const r = await parseReferences(['Ref. 2020.'], { apiKey: 'test', baseUrl })
      assert.equal(r.references[0].doi, '10.1000/xyz')
    },
  )
})

test('parseReferences: >20 references batch into multiple calls; indices stay global', async () => {
  await withMockDeepseek(
    { responses: [(body) => okResponse(sentRefs(body).map((x) => ({ index: x.index, type: 'article-journal', title: `P${x.index}`, authors: [], containerTitle: null, volume: null, issue: null, page: null, year: null, doi: null, pmid: null })))] },
    async (baseUrl, calls) => {
      const raw = Array.from({ length: 25 }, (_, i) => `Ref ${i + 1}. 2020.`)
      const r = await parseReferences(raw, { apiKey: 'test', baseUrl })
      assert.equal(calls.length, 2)
      assert.equal(r.references.length, 25)
      assert.equal(r.references[24].title, 'P25')
    },
  )
})

test('[C1] parseReferences with budgetMs: 0 parses NOTHING — server-side callers must omit budgetMs', async () => {
  await withMockDeepseek(
    { responses: [() => okResponse([])] },
    async (baseUrl, calls) => {
      const r = await parseReferences(['Ref. 2020.'], { apiKey: 'test', baseUrl, budgetMs: 0 })
      assert.equal(calls.length, 0, 'no model call is ever made')
      assert.equal(r.references.length, 0)
      assert.equal(r.nextCursor, 0, 'cursor points at the start — the whole list is unprocessed')
      // The trap: ok:true + degraded:false + empty references. Treating this
      // result as "parsed, zero references" ships an empty ref-list.
      assert.equal(r.ok, true)
      assert.equal(r.degraded, false)
    },
  )
})

test('parseReferences: startIndex resumes mid-list with global indices', async () => {
  await withMockDeepseek(
    { responses: [(body) => okResponse(sentRefs(body).map((x) => ({ index: x.index, type: 'article-journal', title: `P${x.index}`, authors: [], containerTitle: null, volume: null, issue: null, page: null, year: null, doi: null, pmid: null })))] },
    async (baseUrl, calls) => {
      const raw = ['One. 2020.', 'Two. 2021.', 'Three. 2022.']
      const r = await parseReferences(raw, { apiKey: 'test', baseUrl, startIndex: 2 })
      assert.equal(r.references.length, 1)
      assert.equal(r.references[0].id, '3', 'indices are global over the full list')
      assert.equal(sentRefs(calls[0])[0].index, 3)
    },
  )
})

// ---------------------------------------------------------------------------
// Reference verification — pure helpers under hostile input
// ---------------------------------------------------------------------------

test('verify helpers: titleSimilarity edge cases', () => {
  assert.equal(titleSimilarity('Same Title', 'Same Title'), 1)
  assert.equal(titleSimilarity('', ''), 0)
  assert.equal(titleSimilarity('anything', ''), 0)
  assert.ok(titleSimilarity('Café-associated osteomyelitis', 'Cafe associated osteomyelitis!') > 0.95, 'accents+punctuation folded')
  // precision bias: a strict substring scores LOW — documents why short/partial
  // titles come back "unverified" rather than wrongly enriched.
  assert.ok(titleSimilarity('Release', 'Endoscopic carpal tunnel release outcomes at one year') < 0.85)
})

test('verify helpers: pickBestCrossrefCandidate survives junk payloads', () => {
  assert.deepEqual(pickBestCrossrefCandidate(null, 'x'), { item: null, similarity: 0 })
  assert.deepEqual(pickBestCrossrefCandidate({ message: {} }, 'x'), { item: null, similarity: 0 })
  assert.deepEqual(pickBestCrossrefCandidate('garbage', 'x'), { item: null, similarity: 0 })
  const best = pickBestCrossrefCandidate(
    { message: { items: [{ title: ['Wrong thing entirely'] }, { title: ['Right title'] }] } },
    'Right title',
  )
  assert.equal((best.item as CrossrefWork).title?.[0], 'Right title')
  assert.equal(best.similarity, 1)
})

test('verify helpers: retraction detection across the three Crossref signal shapes', () => {
  assert.equal(isRetractedCrossrefWork(null), false)
  assert.equal(isRetractedCrossrefWork({}), false)
  assert.equal(isRetractedCrossrefWork({ relation: { 'is-retracted-by': [{}] } }), true)
  assert.equal(isRetractedCrossrefWork({ 'update-to': [{ type: 'Retraction' }] }), true)
  assert.equal(isRetractedCrossrefWork({ 'updated-by': [{ type: 'partial_retraction' }] }), true)
  assert.equal(isRetractedCrossrefWork({ type: 'retracted-article' }), true)
  assert.equal(isRetractedCrossrefWork({ 'update-to': [{ type: 'correction' }] }), false)
})

test('verify helpers: enrichment fills missing fields ONLY — author-typed values never overwritten', () => {
  const ref = {
    id: '1', type: 'article-journal', title: 'T', authors: [{ family: 'Smith', given: 'J' }],
    containerTitle: 'Author Journal', volume: '9', issue: null, page: null, year: '2019',
    doi: null, pmid: null,
  }
  const work: CrossrefWork = {
    DOI: '10.1000/ABC', 'container-title': ['Crossref Journal'], volume: '99', issue: '4',
    page: '1-10', issued: { 'date-parts': [[2021]] },
    author: [{ family: 'Smith', given: 'J' }],
  }
  const { reference, changed } = enrichFromCrossref(ref, work)
  assert.equal(changed, true)
  assert.equal(reference.doi, '10.1000/abc', 'DOI filled + lowercased')
  assert.equal(reference.issue, '4', 'missing issue filled')
  assert.equal(reference.page, '1-10', 'missing page filled')
  assert.equal(reference.containerTitle, 'Author Journal', 'existing journal NOT overwritten')
  assert.equal(reference.volume, '9', 'existing volume NOT overwritten')
  assert.equal(reference.year, '2019', 'existing year NOT overwritten')
})

test('verify helpers: DOI + PubMed response normalization under junk', () => {
  assert.equal(normalizeDoi('https://dx.doi.org/10.1000/X'), '10.1000/x')
  assert.equal(normalizeDoi('doi: 10.1000/y'), '10.1000/y')
  assert.equal(normalizeDoi('   '), null)
  assert.equal(normalizeDoi(null), null)
  assert.deepEqual(parseEsearchIds(null), [])
  assert.deepEqual(parseEsearchIds({ esearchresult: { idlist: ['1', 2, '3'] } }), ['1', '3'])
  assert.equal(parsePubmedSummary({}, '123'), null)
  assert.deepEqual(parsePubmedSummary({ result: { '123': { title: 'T', articleids: [{ idtype: 'DOI', value: 'https://doi.org/10.1/z' }] } } }, '123'), { pmid: '123', title: 'T', doi: '10.1/z' })
  assert.equal(normalizeTitle('  Naïve—Title!!  '), 'naive title')
})

// ---------------------------------------------------------------------------
// Rules analysis against oscrsj.json — the intake gate's engine
// ---------------------------------------------------------------------------

test('intake gate: analyze flags word limit, missing sections, and reference overage for OSCRSJ', async () => {
  const rules = parseJournalRules(oscrsjRules)
  const paras: string[] = [
    headingPara('Introduction'),
    ...Array.from({ length: 60 }, (_, i) => bodyPara(`Sentence ${i} pads the body with exactly eight words.`)),
    headingPara('Case Presentation'),
    ...Array.from({ length: 240 }, (_, i) => bodyPara(`More content ${i} to push far past the limit.`)),
    headingPara('References'),
    ...Array.from({ length: 30 }, (_, i) => bodyPara(`${i + 1}. Ref ${i + 1}. J. 2020. et al.`)),
  ]
  const { model } = await ingestDocx(emitDocx(createDocx(paras)))
  const { suggestions, checklist } = analyze({ model, rules, articleType: 'case_report', keywordCount: 2 })
  const titles = suggestions.map((s) => s.title)
  assert.ok(titles.some((t) => t.includes('2000-word limit')), `word limit flagged: ${titles}`)
  assert.ok(titles.some((t) => t.startsWith('Missing required section')), 'missing sections flagged')
  assert.ok(titles.some((t) => t.includes('Too many references')), 'reference overage flagged')
  assert.ok(titles.some((t) => t.includes('Keyword count')), 'keyword count flagged')
  // et_al_threshold is null for OSCRSJ → guide silence must NOT fabricate a violation
  assert.ok(!titles.some((t) => t.includes('et al')), 'no et-al flag on null threshold')
  assert.ok(checklist.length > 0)
})

// ---------------------------------------------------------------------------
// validateMetadataForRender — current contract (W0 baseline)
// ---------------------------------------------------------------------------

function mergedFixture(overrides: Partial<Parameters<typeof validateMetadataForRender>[0]> = {}) {
  return {
    manuscript_type: 'case_report' as const,
    title: 'Bilateral compartment syndrome after exertion',
    running_title: 'Bilateral compartment syndrome',
    doi: '',
    keywords: ['a', 'b', 'c'],
    abstract:
      'Introduction: X. Case Presentation: Y. Discussion: Z. Conclusion: W.',
    submission_date: '2026-06-01T00:00:00Z',
    authors: [
      {
        full_name: 'Jane Smith', email: 'j@x.com', affiliation: 'X University',
        orcid_id: '0000-0002-1825-0097', contribution: 'Conceptualization',
        is_corresponding: true, is_equal_contribution: false,
      },
    ],
    conflict_of_interest: 'None', funding_sources: [], data_availability_statement: '',
    ai_tools_used: false, ai_tools_details: '',
    patient_consent_variant: 'adult_living' as const,
    patient_consent_statement: 'Written informed consent was obtained.',
    patient_consent_irb_institution: '', patient_consent_irb_protocol: '',
    equal_contribution_statement: '', has_affiliations_table_data: false,
    ...overrides,
  }
}

test('render validator: trailing title period and missing consent are hard errors', async () => {
  const bad = await validateMetadataForRender(
    mergedFixture({ title: 'A title with a period.', patient_consent_variant: null }),
  )
  const rules = bad.errors.map((e) => e.rule)
  assert.ok(rules.includes('janine-8.2-title-trailing-period'))
  assert.ok(rules.includes('patient-consent-variant-required'))
})

test('render validator: the references-table-empty warning is currently UNCONDITIONAL (dead green path)', async () => {
  // W1 (manuscript_references) must make this warning conditional on the
  // table actually being empty for the manuscript. When that lands, THIS
  // TEST is the one to update: assert the warning is ABSENT when structured
  // references exist. Until then it documents the standing amber.
  const clean = await validateMetadataForRender(mergedFixture())
  assert.ok(clean.warnings.some((w) => w.rule === 'references-table-empty'))
  assert.equal(clean.errors.length, 0, JSON.stringify(clean.errors))
})
