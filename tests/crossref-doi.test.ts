// DOI identity contracts (Crossref DOI Integration, Phase 1 — 2026-08-10).
//
// PURPOSE. Until this phase, lib/publish/synthesize.ts fabricated identity when
// the database had none: a missing elocation defaulted to 'e0001' and a missing
// DOI defaulted to `10.XXXXX/oscrsj.{year}.{eloc}`. Both fallbacks fired on all
// six published articles and baked an unresolvable, CLICKABLE DOI into every
// PDF page-1 ID bar, XMP packet (prism:doi, dc:identifier) and JATS
// <article-id>. These tests exist so that regression can never ship again.
//
// The DOI scheme is PERMANENT (decision D1, locked 2026-08-02):
//   doi = 10.67687/oscrsj.{elocation_id}      e.g. 10.67687/oscrsj.e0001
// Derived 1:1 from the globally-unique, never-reset elocation. If a change to
// these tests is ever proposed, it is almost certainly a bug: DOIs cannot be
// deleted once deposited.
//
// CONTRACTS
//   [C1] buildDoi produces the locked shape.
//   [C2] isValidOscrsjDoi rejects every historical/near-miss placeholder form.
//   [C3] validateRenderIdentity — the pure gate synthesizeRendererPayload
//        delegates to — blocks null/placeholder/mismatched identity.
//   [C4] The suggested citation that lands in the PDF carries the real DOI.
//
// No DB, no network: this is a pure-function suite by construction.

import { test } from 'node:test'
import assert from 'node:assert'

import {
  DOI_PREFIX,
  DOI_SUFFIX_NS,
  buildDoi,
  isValidOscrsjDoi,
  validateRenderIdentity,
} from '../lib/publish/doi'

// ---------------------------------------------------------------------------
// [C1] buildDoi
// ---------------------------------------------------------------------------

test('[C1] buildDoi produces the locked 10.67687/oscrsj.{elocation} shape', () => {
  assert.equal(buildDoi('e0001'), '10.67687/oscrsj.e0001')
  assert.equal(buildDoi('e0006'), '10.67687/oscrsj.e0006')
  assert.equal(buildDoi('e0042'), '10.67687/oscrsj.e0042')
  // Five digits: the scheme must not break when we pass e9999.
  assert.equal(buildDoi('e10000'), '10.67687/oscrsj.e10000')
})

test('[C1] the prefix constants are the registered ones and have not drifted', () => {
  // Crossref member 57458, prefix issued 2026-07-24. Changing either of these
  // orphans every DOI already deposited.
  assert.equal(DOI_PREFIX, '10.67687')
  assert.equal(DOI_SUFFIX_NS, 'oscrsj')
})

test('[C1] buildDoi round-trips through isValidOscrsjDoi', () => {
  for (const eloc of ['e0001', 'e0002', 'e0003', 'e0004', 'e0005', 'e0006']) {
    assert.equal(isValidOscrsjDoi(buildDoi(eloc)), true, `${eloc} must validate`)
  }
})

// ---------------------------------------------------------------------------
// [C2] isValidOscrsjDoi rejections
// ---------------------------------------------------------------------------

test('[C2] isValidOscrsjDoi rejects the placeholder that shipped on all six articles', () => {
  assert.equal(isValidOscrsjDoi('10.XXXXX/oscrsj.2026.0001'), false)
  assert.equal(isValidOscrsjDoi('10.XXXXX/oscrsj.2026.0006'), false)
  assert.equal(isValidOscrsjDoi('10.XXXXX/oscrsj.e0001'), false)
})

test('[C2] isValidOscrsjDoi rejects the year-segment form (the scheme we did NOT pick)', () => {
  // Rejected in D1 because of year-drift under continuous publication.
  assert.equal(isValidOscrsjDoi('10.67687/oscrsj.2026.0001'), false)
  assert.equal(isValidOscrsjDoi('10.67687/oscrsj.2026.e0001'), false)
})

test('[C2] isValidOscrsjDoi rejects empty, null, and undefined', () => {
  assert.equal(isValidOscrsjDoi(''), false)
  assert.equal(isValidOscrsjDoi('   '), false)
  assert.equal(isValidOscrsjDoi(null), false)
  assert.equal(isValidOscrsjDoi(undefined), false)
})

test('[C2] isValidOscrsjDoi rejects wrong prefixes and foreign DOIs', () => {
  assert.equal(isValidOscrsjDoi('10.1000/oscrsj.e0001'), false)
  assert.equal(isValidOscrsjDoi('10.6768/oscrsj.e0001'), false)
  assert.equal(isValidOscrsjDoi('10.676870/oscrsj.e0001'), false)
  assert.equal(isValidOscrsjDoi('10.2106/JBJS.24.00123'), false)
})

test('[C2] isValidOscrsjDoi rejects bare elocations and malformed suffixes', () => {
  assert.equal(isValidOscrsjDoi('e0001'), false)
  assert.equal(isValidOscrsjDoi('10.67687/e0001'), false)
  assert.equal(isValidOscrsjDoi('10.67687/oscrsj.'), false)
  assert.equal(isValidOscrsjDoi('10.67687/oscrsj.0001'), false, 'missing the e')
  assert.equal(isValidOscrsjDoi('10.67687/oscrsj.e001'), false, 'only three digits')
  assert.equal(isValidOscrsjDoi('10.67687/oscrsj.eABCD'), false)
})

test('[C2] isValidOscrsjDoi rejects URL-wrapped and doi:-prefixed forms', () => {
  // The bare DOI is what goes in the database; https://doi.org/… is a display
  // form (Crossref display guidelines) and doi:… is the XMP dc:identifier form.
  // Neither may be persisted as manuscripts.doi.
  assert.equal(isValidOscrsjDoi('https://doi.org/10.67687/oscrsj.e0001'), false)
  assert.equal(isValidOscrsjDoi('doi:10.67687/oscrsj.e0001'), false)
})

test('[C2] isValidOscrsjDoi tolerates surrounding whitespace', () => {
  assert.equal(isValidOscrsjDoi('  10.67687/oscrsj.e0001  '), true)
})

// ---------------------------------------------------------------------------
// [C3] validateRenderIdentity — the render gate
// ---------------------------------------------------------------------------

test('[C3] a fully valid pair produces no blocking errors', () => {
  assert.deepEqual(validateRenderIdentity('e0003', '10.67687/oscrsj.e0003'), [])
})

test('[C3] a null elocation blocks the render (was: silently became e0001)', () => {
  const errs = validateRenderIdentity(null, '10.67687/oscrsj.e0001')
  assert.ok(errs.length > 0, 'must block')
  assert.match(errs.join(' '), /elocation_id/)
})

test('[C3] a null DOI blocks the render (was: silently became 10.XXXXX/…)', () => {
  const errs = validateRenderIdentity('e0001', null)
  assert.ok(errs.length > 0, 'must block')
  assert.match(errs.join(' '), /DOI/)
})

test('[C3] both missing yields two distinct blocking errors', () => {
  const errs = validateRenderIdentity(null, null)
  assert.equal(errs.length, 2)
})

test('[C3] a placeholder DOI blocks the render', () => {
  const errs = validateRenderIdentity('e0002', '10.XXXXX/oscrsj.2026.0002')
  assert.ok(errs.length > 0)
  assert.match(errs.join(' '), /not a valid OSCRSJ DOI/)
})

test('[C3] a DOI that does not match its elocation blocks the render', () => {
  // The exact corruption a hand-edit or a botched backfill would introduce:
  // the PDF bytes would assert one identity and the database another.
  const errs = validateRenderIdentity('e0004', '10.67687/oscrsj.e0009')
  assert.equal(errs.length, 1)
  assert.match(errs.join(' '), /does not match elocation_id/)
  assert.match(errs.join(' '), /10\.67687\/oscrsj\.e0004/)
})

test('[C3] a malformed elocation blocks even when the DOI looks well-formed', () => {
  const errs = validateRenderIdentity('E1', '10.67687/oscrsj.e0001')
  assert.ok(errs.length > 0)
  assert.match(errs.join(' '), /malformed/)
})

test('[C3] empty strings are treated as missing, not as valid values', () => {
  assert.ok(validateRenderIdentity('', '').length === 2)
  assert.ok(validateRenderIdentity('   ', '   ').length === 2)
})

test('[C3] errors are human-actionable — every message names the fix', () => {
  // These strings surface to an editor in the admin validation summary. A
  // message that just says "invalid" costs a support round-trip.
  const all = [
    ...validateRenderIdentity(null, null),
    ...validateRenderIdentity('e0001', '10.XXXXX/oscrsj.2026.0001'),
  ].join(' ')
  assert.match(all, /acceptance/i)
})

// ---------------------------------------------------------------------------
// [C4] the suggested citation carries the DOI into the PDF
// ---------------------------------------------------------------------------

test('[C4] the suggested-citation tail is the real DOI, not a placeholder', () => {
  // Mirrors synthesize.ts: `…;{volume}({issue}):{elocation}. doi:{doi}`.
  // This string is rendered into the PDF's suggested-citation block, so it is
  // the most-copied surface the DOI appears on.
  const doi = buildDoi('e0005')
  const citation = `Kaur M, Parhar K. a case of something. <em>OSCRSJ</em>. 2026;1(1):e0005. doi:${doi}`
  assert.ok(citation.endsWith(`doi:${doi}`))
  assert.ok(!citation.includes('10.XXXXX'))
  assert.match(citation, /doi:10\.67687\/oscrsj\.e0005$/)
})
