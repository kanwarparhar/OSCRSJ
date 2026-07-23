// Formatting-bucket retention partition logic (2026-07-22, Part E). The cron
// route applies these decisions; the storage/DB side is exercised by the
// post-deploy battery (cron dry-run against the live table).

import { test } from 'node:test'
import assert from 'node:assert'
import {
  retentionActionFor,
  hasArtifacts,
  FORMATTING_RETENTION_DAYS,
  STALE_JOB_HOURS,
  type RetentionJobView,
} from '../lib/formatting/pipeline/retention'

const NOW = Date.parse('2026-07-22T12:00:00.000Z')
const daysAgo = (d: number) => new Date(NOW - d * 24 * 60 * 60 * 1000).toISOString()
const hoursAgo = (h: number) => new Date(NOW - h * 60 * 60 * 1000).toISOString()

const job = (overrides: Partial<RetentionJobView>): RetentionJobView => ({
  status: 'complete',
  updated_at: daysAgo(0),
  input_path: 'abc/input/manuscript.docx',
  output_paths: { manuscript: 'abc/output/manuscript-formatted.docx' },
  figure_paths: null,
  ...overrides,
})

test('terminal job older than 7 days with artifacts → purge', () => {
  assert.equal(retentionActionFor(job({ status: 'complete', updated_at: daysAgo(8) }), NOW), 'purge')
  assert.equal(retentionActionFor(job({ status: 'failed', updated_at: daysAgo(8) }), NOW), 'purge')
})

test('terminal job inside the 7-day window → none', () => {
  assert.equal(retentionActionFor(job({ status: 'complete', updated_at: daysAgo(FORMATTING_RETENTION_DAYS - 1) }), NOW), 'none')
})

test('already-purged terminal job never re-purges', () => {
  const purged = job({
    status: 'complete',
    updated_at: daysAgo(30),
    input_path: null,
    output_paths: null,
    figure_paths: null,
  })
  assert.equal(hasArtifacts(purged), false)
  assert.equal(retentionActionFor(purged, NOW), 'none')
})

test('non-terminal job idle past 24h → expire (regardless of stage)', () => {
  for (const status of ['uploaded', 'parsed', 'extracted', 'verified', 'rendered'] as const) {
    assert.equal(retentionActionFor(job({ status, updated_at: hoursAgo(STALE_JOB_HOURS + 1) }), NOW), 'expire', status)
  }
})

test('non-terminal job still fresh → none', () => {
  assert.equal(retentionActionFor(job({ status: 'parsed', updated_at: hoursAgo(2) }), NOW), 'none')
})

test('non-terminal jobs never purge directly — expire first, purge on the 7-day clock', () => {
  // Even a months-old abandoned job expires (to failed) rather than purging in
  // the same tick; the terminal rule picks it up 7 days after the expiry write.
  assert.equal(retentionActionFor(job({ status: 'uploaded', updated_at: daysAgo(60) }), NOW), 'expire')
})

test('unparseable updated_at is never reaped', () => {
  assert.equal(retentionActionFor(job({ updated_at: 'not-a-date' }), NOW), 'none')
})

test('figure-only artifacts still count as purgeable bytes', () => {
  const figOnly = job({ input_path: null, output_paths: null, figure_paths: ['abc/input/figure-1.img'] })
  assert.equal(hasArtifacts(figOnly), true)
  assert.equal(retentionActionFor({ ...figOnly, status: 'failed', updated_at: daysAgo(10) }, NOW), 'purge')
})
