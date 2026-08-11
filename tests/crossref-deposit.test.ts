// Contract tests — Crossref DOI Integration Phase 3 (deposit generator,
// submission-log parser, record assembly helpers).
//
// WHY THESE ARE STRICT
// A Crossref DOI is permanent. It cannot be deleted or re-pointed; a bad
// deposit can only be superseded by a corrected FULL re-deposit of the same
// identifier. And because Crossref's re-deposit semantics null every field the
// incoming record omits, a partial record silently strips metadata from an
// already-registered DOI. So the generator's job is to refuse, loudly, rather
// than emit anything questionable.
//
// Entirely offline. No network, no database, no live Crossref.

import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildBatchId,
  buildDepositXml,
  buildTimestamp,
  xmlEscape,
  type DepositInput,
} from '../lib/publish/crossref/depositXml'
import { parseSubmissionLog } from '../lib/publish/crossref/depositClient'
import { extractReferencesFromJats, splitName } from '../lib/publish/crossref/parse'

// ── fixture ──────────────────────────────────────────────────────────────────

function fixture(over: Partial<DepositInput> = {}): DepositInput {
  return {
    doi: '10.67687/oscrsj.e0001',
    elocationId: 'e0001',
    title: 'Chronic Septic Arthritis of a Native Elbow',
    abstract: 'A case of Cutibacterium acnes elbow infection.',
    authors: [
      {
        givenName: 'Paul E',
        surname: 'Gerges',
        orcid: '0000-0002-1825-0097',
        affiliation: 'Department of Orthopaedics, Example Hospital',
        rorId: null,
      },
      { givenName: 'Jane', surname: 'Doe', orcid: null, affiliation: null },
    ],
    publishedDate: { year: 2026, month: 5, day: 21 },
    volume: 1,
    issue: 1,
    issn: null,
    canonicalUrl: 'https://www.oscrsj.com/articles/e0001',
    pdfUrl: 'https://www.oscrsj.com/articles/e0001/pdf',
    references: [
      { key: 'ref1', unstructured: 'Smith J. Elbow infections. J Bone Joint Surg. 2020;102:1-8.', doi: null },
      { key: 'ref2', unstructured: 'Jones A. Another paper.', doi: '10.1016/j.arthro.2020.02.027' },
    ],
    depositorEmail: 'editor@oscrsj.com',
    batchId: 'oscrsj-e0001-1786400000',
    timestamp: '20260811224000',
    ...over,
  }
}

/**
 * Minimal well-formedness check: every opened tag closes, in order.
 * Not a schema validation — that happens against Crossref's test system —
 * but it catches the class of bug that fails an entire batch.
 */
function assertWellFormed(xml: string) {
  const stack: string[] = []
  const tagRe = /<(\/?)([A-Za-z_][\w:.-]*)([^>]*?)(\/?)>/g
  let m: RegExpExecArray | null
  while ((m = tagRe.exec(xml)) !== null) {
    const [, closing, name, attrs, selfClose] = m
    if (attrs.trimEnd().endsWith('/') || selfClose === '/') continue
    if (closing) {
      const open = stack.pop()
      assert.equal(open, name, `mismatched close </${name}> (open was <${open}>)`)
    } else {
      stack.push(name)
    }
  }
  assert.deepEqual(stack, [], `unclosed tags: ${stack.join(', ')}`)
}

// ── C1 — the record contains what Crossref needs ─────────────────────────────

test('[C1] a full record is well-formed and carries every required element', () => {
  const xml = buildDepositXml(fixture())
  assertWellFormed(xml)

  assert.ok(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>'))
  assert.ok(xml.includes('version="5.5.0"'))
  assert.ok(xml.includes('<doi>10.67687/oscrsj.e0001</doi>'))
  assert.ok(xml.includes('<resource>https://www.oscrsj.com/articles/e0001</resource>'))
  assert.ok(xml.includes('<ORCID>https://orcid.org/0000-0002-1825-0097</ORCID>'))
  assert.ok(xml.includes('<ai:license_ref applies_to="vor">https://creativecommons.org/licenses/by/4.0/</ai:license_ref>'))
  assert.ok(xml.includes('<ai:free_to_read/>'))
  assert.ok(xml.includes('<jats:abstract>'))
  assert.ok(xml.includes('<unstructured_citation>'))
  assert.ok(xml.includes('<doi>10.1016/j.arthro.2020.02.027</doi>'))
  assert.ok(xml.includes('<depositor_name>OSCRSJ LLC</depositor_name>'))
  assert.ok(xml.includes('<registrant>OSCRSJ LLC</registrant>'))
  // Publisher name must never regress to the April placeholder.
  assert.ok(!xml.includes('TBD'))
})

test('[C1] the eLocator is an item_number, never first_page', () => {
  const xml = buildDepositXml(fixture())
  assert.ok(
    xml.includes('<item_number item_number_type="article_number">e0001</item_number>'),
    'eLocator must be deposited as an article_number'
  )
  // OSCRSJ publishes continuously with no page numbers. Declaring the eLocator
  // as a page would make every downstream citation to us structurally wrong.
  assert.ok(!xml.includes('<first_page>'))
  assert.ok(!xml.includes('<last_page>'))
})

test('[C1] the Similarity Check crawler uses Crossref’s vocabulary value', () => {
  const xml = buildDepositXml(fixture())
  // The schema's `crawler` attribute is a fixed enum; the Similarity Check
  // value is "iParadigms". "similarity-check" is not a valid value and fails
  // the whole batch at schema validation.
  assert.ok(xml.includes('<item crawler="iParadigms">'))
  assert.ok(!xml.includes('crawler="similarity-check"'))
  assert.ok(xml.includes('<collection property="crawler-based">'))
  assert.ok(xml.includes('https://www.oscrsj.com/articles/e0001/pdf'))
})

test('[C1] the ORIGINAL publication date is asserted, zero-padded', () => {
  const xml = buildDepositXml(fixture({ publishedDate: { year: 2026, month: 5, day: 21 } }))
  assert.ok(xml.includes('<month>05</month>'))
  assert.ok(xml.includes('<day>21</day>'))
  assert.ok(xml.includes('<year>2026</year>'))
})

test('[C1] the first contributor is sequence="first" and the rest additional', () => {
  const xml = buildDepositXml(fixture())
  const firsts = xml.match(/sequence="first"/g) || []
  const additional = xml.match(/sequence="additional"/g) || []
  assert.equal(firsts.length, 1)
  assert.equal(additional.length, 1)
})

// ── C2 — ISSN ────────────────────────────────────────────────────────────────

test('[C2] no ISSN element at all while the LOC application is open', () => {
  const xml = buildDepositXml(fixture({ issn: null }))
  assert.ok(!xml.includes('<issn'))
  // A syntactically valid fake is worse than absence: it reads as a real
  // identifier for a different journal.
  assert.ok(!xml.includes('XXXX-XXXX'))
  assert.ok(!xml.includes('0000-0000'))
})

test('[C2] the ISSN appears as electronic media once assigned', () => {
  const xml = buildDepositXml(fixture({ issn: '3067-1234' }))
  assert.ok(xml.includes('<issn media_type="electronic">3067-1234</issn>'))
})

// ── C3 — escaping ────────────────────────────────────────────────────────────

test('[C3] markup-hostile characters survive without breaking the document', () => {
  const xml = buildDepositXml(
    fixture({
      title: 'Ankle <fracture> & "outcomes" in Sjögren’s — a report',
      abstract: 'CRP <5 mg/L & ESR >40; naïve café.',
      authors: [{ givenName: 'José', surname: "O'Brien & Sons", orcid: null, affiliation: 'A & B <Hospital>' }],
    })
  )
  assertWellFormed(xml)
  assert.ok(xml.includes('&amp;'))
  assert.ok(xml.includes('&lt;fracture&gt;'))
  // Non-ASCII is legal in a UTF-8 document and must NOT be entity-mangled.
  assert.ok(xml.includes('Sjögren'))
  assert.ok(xml.includes('José'))
  assert.ok(xml.includes('naïve café'))
})

test('[C3] clinical prose that merely LOOKS like markup is preserved verbatim', () => {
  // The regression this locks: a naive /<[^>]+>/g strip deletes "<5 mg/L & ESR >"
  // and deposits "CRP 40" as permanent public record. Numbers must survive.
  const xml = buildDepositXml(
    fixture({
      title: 'Reduction achieved at <2 mm displacement',
      abstract: 'CRP <5 mg/L & ESR >40 at presentation; flexion <30 degrees.',
    })
  )
  assertWellFormed(xml)
  assert.ok(xml.includes('&lt;2 mm displacement'), 'title threshold must survive')
  assert.ok(xml.includes('CRP &lt;5 mg/L &amp; ESR &gt;40'), 'abstract values must survive')
  assert.ok(xml.includes('flexion &lt;30 degrees'))
})

test('[C3] face markup in titles is flattened, not shipped as raw fragments', () => {
  const xml = buildDepositXml(fixture({ title: 'Infection with <em>C. acnes</em> in the elbow' }))
  assertWellFormed(xml)
  assert.ok(xml.includes('<title>Infection with C. acnes in the elbow</title>'))
})

test('[C3] xmlEscape leaves quotes alone in text nodes', () => {
  assert.equal(xmlEscape('a & b < c > d'), 'a &amp; b &lt; c &gt; d')
})

// ── C4 — refusals ────────────────────────────────────────────────────────────

test('[C4] a placeholder or foreign DOI is refused outright', () => {
  for (const doi of [
    '10.XXXXX/oscrsj.2026.0001',
    '10.1234/oscrsj.e0001',
    '10.67687/oscrsj.2026.0001',
    'e0001',
    '',
  ]) {
    assert.throws(
      () => buildDepositXml(fixture({ doi })),
      /invalid DOI|permanent/i,
      `expected refusal for ${JSON.stringify(doi)}`
    )
  }
})

test('[C4] an incomplete publication date is refused', () => {
  assert.throws(
    () => buildDepositXml(fixture({ publishedDate: { year: 2026, month: 0, day: 21 } })),
    /publication date/i
  )
})

test('[C4] an empty title or a record with no contributors is refused', () => {
  assert.throws(() => buildDepositXml(fixture({ title: '   ' })), /title/i)
  assert.throws(() => buildDepositXml(fixture({ title: '<em> </em>' })), /title/i)
  assert.throws(() => buildDepositXml(fixture({ authors: [] })), /contributors/i)
})

test('[C4] a malformed timestamp or non-https resource is refused', () => {
  assert.throws(() => buildDepositXml(fixture({ timestamp: '2026-08-11' })), /YYYYMMDDHHMMSS/)
  assert.throws(
    () => buildDepositXml(fixture({ canonicalUrl: 'http://www.oscrsj.com/articles/e0001' })),
    /absolute https/i
  )
})

test('[C4] a malformed ORCID is dropped rather than failing the batch', () => {
  const xml = buildDepositXml(
    fixture({ authors: [{ givenName: 'A', surname: 'B', orcid: 'not-an-orcid' }] })
  )
  assertWellFormed(xml)
  assert.ok(!xml.includes('<ORCID>'))
})

// ── C5 — submission-log parser ───────────────────────────────────────────────

test('[C5] a clean log reads as success', () => {
  const log = `<?xml version="1.0"?>
<doi_batch_diagnostic status="completed" sp="ds5">
  <record_diagnostic status="Success">
    <doi>10.67687/oscrsj.e0001</doi>
    <msg>Successfully added</msg>
  </record_diagnostic>
</doi_batch_diagnostic>`
  const r = parseSubmissionLog(log)
  assert.equal(r.state, 'success')
  assert.deepEqual(r.diagnostics, ['Successfully added'])
})

test('[C5] any failure record fails the whole batch, with the reason kept', () => {
  const log = `<doi_batch_diagnostic status="completed">
  <record_diagnostic status="Success"><msg>ok</msg></record_diagnostic>
  <record_diagnostic status="Failure"><msg>Record not processed because submitted version is less or equal to previously submitted version</msg></record_diagnostic>
</doi_batch_diagnostic>`
  const r = parseSubmissionLog(log)
  assert.equal(r.state, 'failure')
  assert.ok(r.diagnostics.some((d) => /previously submitted version/.test(d)))
})

test('[C5] an in-process batch stays pending', () => {
  const r = parseSubmissionLog('<doi_batch_diagnostic status="in_process"/>')
  assert.equal(r.state, 'pending')
})

test('[C5] garbage NEVER reads as success', () => {
  // The cardinal rule: an unparseable log must not confirm a registration.
  for (const raw of ['', 'not xml at all', '<html><body>502 Bad Gateway</body></html>', '{}']) {
    assert.equal(parseSubmissionLog(raw).state, 'pending', `for: ${raw}`)
  }
})

test('[C5] a completed batch with no records is a failure, not a success', () => {
  const r = parseSubmissionLog('<doi_batch_diagnostic status="completed"></doi_batch_diagnostic>')
  assert.equal(r.state, 'failure')
})

test('[C5] warnings alone still count as registered', () => {
  const log = `<doi_batch_diagnostic status="completed">
  <record_diagnostic status="Warning"><msg>Added with warning</msg></record_diagnostic>
</doi_batch_diagnostic>`
  assert.equal(parseSubmissionLog(log).state, 'success')
})

// ── C6 — record assembly helpers ─────────────────────────────────────────────

test('[C6] names split into given/surname, keeping particles and suffixes attached', () => {
  assert.deepEqual(splitName('Paul E Gerges'), { givenName: 'Paul E', surname: 'Gerges' })
  assert.deepEqual(splitName('Victor Fontes Pacheco'), {
    givenName: 'Victor Fontes',
    surname: 'Pacheco',
  })
  assert.deepEqual(splitName('Ludwig van Beethoven'), {
    givenName: 'Ludwig',
    surname: 'van Beethoven',
  })
  assert.deepEqual(splitName('John Smith Jr'), { givenName: 'John', surname: 'Smith Jr' })
  assert.deepEqual(splitName('Prince'), { givenName: null, surname: 'Prince' })
  assert.deepEqual(splitName('  '), { givenName: null, surname: '' })
})

test('[C6] JATS references become citations, with DOIs when the author gave one', () => {
  const jats = `<ref-list>
    <ref id="R1"><mixed-citation>Smith J. Elbow infections. JBJS. 2020;102:1-8.</mixed-citation></ref>
    <ref id="R2"><mixed-citation>Jones A. Paper. <pub-id pub-id-type="doi">10.1016/j.arthro.2020.02.027</pub-id></mixed-citation></ref>
    <ref><mixed-citation>No id here.</mixed-citation></ref>
  </ref-list>`
  const refs = extractReferencesFromJats(jats)
  assert.equal(refs.length, 3)
  assert.equal(refs[0].key, 'R1')
  assert.equal(refs[0].doi, null)
  assert.ok(refs[0].unstructured?.includes('Elbow infections'))
  assert.equal(refs[1].doi, '10.1016/j.arthro.2020.02.027')
  assert.equal(refs[2].key, 'ref3', 'a ref without an id still gets a stable key')
})

test('[C6] no references simply means no citation_list — not a failed deposit', () => {
  assert.deepEqual(extractReferencesFromJats('<article/>'), [])
  const xml = buildDepositXml(fixture({ references: [] }))
  assertWellFormed(xml)
  assert.ok(!xml.includes('<citation_list>'))
})

test('[C6] batch id and timestamp are deterministic from their inputs', () => {
  assert.equal(buildBatchId('e0001', 1786400000), 'oscrsj-e0001-1786400000')
  assert.equal(buildTimestamp(new Date('2026-08-11T22:40:00Z')), '20260811224000')
  // Higher timestamp = more recent, which is how Crossref orders re-deposits.
  const a = buildTimestamp(new Date('2026-08-11T22:40:00Z'))
  const b = buildTimestamp(new Date('2026-08-11T22:41:00Z'))
  assert.ok(Number(b) > Number(a))
})
