// Report-only figure checks (Session 97, Part C).
// Run: npx tsx --test tests/analyze-figures.test.ts
//
// Figure uploads were accepted, stored, and read by nothing. These checks close
// that no-op WITHOUT touching a single image: no decoding, no conversion, no
// renaming. DPI checking is deliberately out of scope (needs sharp).

import { test } from 'node:test'
import assert from 'node:assert'
import { readFileSync } from 'node:fs'
import { analyzeFigures } from '../lib/formatting/pipeline/analyze'
import { parseJournalRules } from '../lib/formatting/index'
import type { JournalRules } from '../lib/formatting/rulesSchema'

function loadRules(slug: string): JournalRules {
  return parseJournalRules(JSON.parse(readFileSync(`lib/formatting/journals/${slug}.json`, 'utf8')))
}

/** Build a rules shell with just the fields analyzeFigures reads. */
function rules(over: {
  figuresMax?: number | null
  formats?: JournalRules['figures']['formats']
  name?: string
}): JournalRules {
  return {
    identity: { name: over.name ?? 'Test Journal' },
    word_limits: { case_report: { figures_max: over.figuresMax ?? null } },
    figures: { formats: over.formats ?? [] },
  } as unknown as JournalRules
}

const ARGS = { articleType: 'case_report' as const }

test('over the figure cap is action-required with the exact overage', () => {
  // The brief's acceptance case: 3 figures against a 2-figure case-report cap.
  const out = analyzeFigures({
    ...ARGS,
    rules: rules({ figuresMax: 2 }),
    figureCount: 3,
    figureFilenames: ['a.tif', 'b.tif', 'c.tif'],
  })
  const flag = out.find((s) => s.title.startsWith('Too many figures'))
  assert.ok(flag, 'should flag the over-count')
  assert.equal(flag!.severity, 'action-required')
  assert.match(flag!.title, /3 \/ max 2/)
  assert.match(flag!.detail, /Remove 1/)
})

test('a journal with no figure rules produces no figure flags', () => {
  const out = analyzeFigures({
    ...ARGS,
    rules: rules({ figuresMax: null, formats: [] }),
    figureCount: 8,
    figureFilenames: ['a.bmp', 'b.gif'],
  })
  assert.deepEqual(out, [], 'null doctrine: silence means no check, not a default cap')
})

test('at or under the cap is info, never action-required', () => {
  const out = analyzeFigures({
    ...ARGS,
    rules: rules({ figuresMax: 4 }),
    figureCount: 4,
    figureFilenames: ['a.tif'],
  })
  assert.ok(!out.some((s) => s.severity === 'action-required'))
  assert.ok(out.some((s) => /within the limit/i.test(s.title)))
})

test('disallowed figure formats are flagged by filename, listing the offenders', () => {
  const out = analyzeFigures({
    ...ARGS,
    rules: rules({ formats: ['tif', 'eps'] }),
    figureCount: 3,
    figureFilenames: ['fig1.tif', 'fig2.bmp', 'fig3.heic'],
  })
  const flag = out.find((s) => s.title.startsWith('Figure format not accepted'))
  assert.ok(flag)
  assert.equal(flag!.severity, 'action-required')
  assert.match(flag!.location!, /fig2\.bmp/)
  assert.match(flag!.location!, /fig3\.heic/)
  assert.doesNotMatch(flag!.location!, /fig1\.tif/)
})

test('tif/tiff and jpg/jpeg are treated as the same format', () => {
  const out = analyzeFigures({
    ...ARGS,
    rules: rules({ formats: ['tif', 'jpg'] }),
    figureCount: 2,
    figureFilenames: ['a.tiff', 'b.jpeg'],
  })
  assert.ok(!out.some((s) => s.title.startsWith('Figure format not accepted')))
})

test('format checking is case-insensitive and skips extensionless names', () => {
  const out = analyzeFigures({
    ...ARGS,
    rules: rules({ formats: ['tif'] }),
    figureCount: 2,
    figureFilenames: ['FIG1.TIF', 'scan-no-extension'],
  })
  assert.ok(!out.some((s) => s.title.startsWith('Figure format not accepted')),
    'uppercase matches, and a nameless extension is not guessed at')
})

test('a stated figure count with nothing attached is an info reminder', () => {
  const out = analyzeFigures({
    ...ARGS,
    rules: rules({ figuresMax: 5 }),
    figureCount: 3,
    figureFilenames: [],
  })
  const flag = out.find((s) => /separate files/i.test(s.title))
  assert.ok(flag)
  assert.equal(flag!.severity, 'info')
})

test('no figures at all produces nothing', () => {
  const out = analyzeFigures({
    ...ARGS,
    rules: rules({ figuresMax: 5, formats: ['tif'] }),
    figureCount: 0,
    figureFilenames: [],
  })
  assert.deepEqual(out, [])
})

test('runs against a real rule file without throwing', () => {
  const out = analyzeFigures({
    ...ARGS,
    rules: loadRules('ajsm'),
    figureCount: 2,
    figureFilenames: ['fig1.tif', 'fig2.tif'],
  })
  assert.ok(Array.isArray(out))
})
