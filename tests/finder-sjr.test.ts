// Finder v2 Phase 1 — the SJR data channel.
//
// These tests defend the provenance rule, not the numbers themselves: the numbers
// come from a generator reading a verified manifest, so what can actually break is
// (a) a registry journal losing its standing row, (b) a generator bug producing a
// partial row, (c) the merge into getJournalMeta silently dropping the channel.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync } from 'node:fs'
import { join } from 'node:path'

import { SJR_DATA, SJR_CATEGORY, SJR_CATEGORY_SIZE } from '../lib/finder/sjrData'
import { getJournalMeta } from '../lib/finder/journalMeta'

const REGISTRY_SLUGS = readdirSync(join(process.cwd(), 'lib/formatting/journals'))
  .filter((f) => f.endsWith('.json'))
  .map((f) => f.replace(/\.json$/, ''))

test('every registry journal has an SJR_DATA entry', () => {
  assert.ok(REGISTRY_SLUGS.length >= 75, `expected >=75 registry journals, saw ${REGISTRY_SLUGS.length}`)
  const missing = REGISTRY_SLUGS.filter((slug) => !(slug in SJR_DATA))
  assert.deepEqual(missing, [], `slugs with no SJR standing: ${missing.join(', ')}`)
})

test('spot rows match the verified Scimago manifest', () => {
  // Six rows transcribed from the build brief's pre-verified cross-check table.
  // A mismatch means the generator is wrong, not this table.
  assert.equal(SJR_DATA['bjsm'].categoryRank, 1)
  assert.equal(SJR_DATA['bjsm'].sjr, 4.847)
  assert.equal(SJR_DATA['bjsm'].quartile, 'Q1')

  assert.equal(SJR_DATA['jbjs'].categoryRank, 31)
  assert.equal(SJR_DATA['jbjs'].sjr, 1.422)
  assert.equal(SJR_DATA['jbjs'].quartile, 'Q1')

  // The registry's only Q2 journal — proves the quartile field is copied, not assumed.
  assert.equal(SJR_DATA['injury'].categoryRank, 106)
  assert.equal(SJR_DATA['injury'].sjr, 0.773)
  assert.equal(SJR_DATA['injury'].quartile, 'Q2')

  assert.equal(SJR_DATA['jot'].categoryRank, 76)
  assert.equal(SJR_DATA['jot'].sjr, 0.923)
  assert.equal(SJR_DATA['jot'].quartile, 'Q1')

  // Unranked by policy, not by oversight: jocr sits outside the top-100 capture,
  // oscrsj is new. Both stay ladder-eligible for the safety slot (see ladder.ts).
  for (const slug of ['jocr', 'oscrsj']) {
    assert.equal(SJR_DATA[slug].categoryRank, null, `${slug} rank`)
    assert.equal(SJR_DATA[slug].sjr, null, `${slug} sjr`)
    assert.equal(SJR_DATA[slug].quartile, null, `${slug} quartile`)
    assert.equal(SJR_DATA[slug].year, null, `${slug} year`)
  }
})

test('no partial rows: an sjr score never survives without a rank', () => {
  for (const [slug, standing] of Object.entries(SJR_DATA)) {
    if (standing.categoryRank === null) {
      assert.equal(standing.sjr, null, `${slug} has an sjr but no rank — corrupt row`)
      assert.equal(standing.quartile, null, `${slug} has a quartile but no rank — corrupt row`)
    } else {
      assert.equal(typeof standing.sjr, 'number', `${slug} is ranked but has no sjr`)
      assert.equal(standing.year, 2025, `${slug} year should come from the manifest`)
    }
    assert.ok(standing.source.length > 0, `${slug} has no provenance string`)
  }
})

test('getJournalMeta merges the SJR channel', () => {
  assert.equal(getJournalMeta('bjsm', ['original_research']).sjr.categoryRank, 1)
  assert.equal(getJournalMeta('bjsm', ['original_research']).sjr.source, 'scimago-manifest-2026-07-12')
  // An unknown slug degrades to a null standing rather than throwing.
  assert.equal(getJournalMeta('not-a-real-journal', []).sjr.categoryRank, null)
})

test('category constants describe the Scimago pull we actually used', () => {
  assert.equal(SJR_CATEGORY, 'Orthopedics and Sports Medicine')
  assert.equal(SJR_CATEGORY_SIZE, 341)
})
