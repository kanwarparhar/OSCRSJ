// Methodological quality grading — scoring math (2026-07-26).
//
// The contract these tests pin down:
//   1. The published maxima are the published maxima. MINORS comparative is 24,
//      non-comparative 16, NOS 9, CARE 13 — if the arithmetic here ever drifts,
//      the score stops being citable and the whole feature loses its point.
//   2. `not_assessable` NEVER costs an author points. It leaves both sides of
//      the fraction, so an unreadable manuscript scores over fewer items rather
//      than scoring badly over all of them.
//   3. Nothing assessable yields `normalized: null`, never 0. Zero is a claim
//      ("this study is bad"); null is the truth ("we could not tell").
//   4. RoB 2 and AMSTAR-2 produce judgements, not totals, and their published
//      algorithms are pessimistic in the specific ways they are pessimistic.
//   5. The scorer is deterministic — same verdicts, identical object, always.

import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  INSTRUMENTS,
  buildGaps,
  gradingErrorScore,
  pointsForVerdict,
  scoreAmstar2,
  scoreInstrument,
  scoreNone,
  scoreNumericInstrument,
  scoreRob2,
  selectInstrument,
} from '@/lib/quality'
import type { ItemVerdict, RawGradedItem, StudyDesign as QualityStudyDesign } from '@/lib/quality'
import { STUDY_DESIGNS, type StudyDesign as FinderStudyDesign } from '@/lib/finder/profileTypes'

/* -------------------------------------------------------------------------- */
/* Drift guard between the two StudyDesign unions                              */
/* -------------------------------------------------------------------------- */
//
// `lib/quality/` deliberately redeclares StudyDesign so it can be imported by
// OSCRSJ's future submission intake without dragging in the Finder. This test
// file is the one place allowed to see both, so it is where the duplicate is
// held honest: if either union gains or loses a member, one of these two aliases
// stops compiling and `npx tsc` fails.

type Assignable<A extends B, B> = true
type FinderAssignableToQuality = Assignable<FinderStudyDesign, QualityStudyDesign>
type QualityAssignableToFinder = Assignable<QualityStudyDesign, FinderStudyDesign>

test('the finder and quality StudyDesign unions have not drifted', () => {
  const forward: FinderAssignableToQuality = true
  const backward: QualityAssignableToFinder = true
  assert.equal(forward && backward, true)

  // Runtime half: every design the Finder can produce resolves to an
  // instrument, so a new design can never fall through to undefined.
  for (const design of STUDY_DESIGNS) {
    const def = selectInstrument(design, null)
    assert.ok(def, `no instrument resolved for ${design}`)
    assert.ok(def.id.length > 0)
  }
})

/* -------------------------------------------------------------------------- */
/* helpers                                                                     */
/* -------------------------------------------------------------------------- */

const all = (instrument: keyof typeof INSTRUMENTS, verdict: ItemVerdict): RawGradedItem[] =>
  INSTRUMENTS[instrument].items.map((i) => ({
    id: i.id,
    verdict,
    quote: verdict === 'not_assessable' ? null : `quote for ${i.id}`,
  }))

/* -------------------------------------------------------------------------- */
/* Instrument selection (§2.7)                                                 */
/* -------------------------------------------------------------------------- */

test('case_series selects non-comparative MINORS, max 16', () => {
  const def = selectInstrument('case_series', null)
  assert.equal(def.id, 'MINORS_NONCOMPARATIVE')
  assert.equal(def.numericMax, 16)
  assert.equal(def.items.length, 8)
})

test('retrospective_comparative selects comparative MINORS, max 24', () => {
  const def = selectInstrument('retrospective_comparative', null)
  assert.equal(def.id, 'MINORS_COMPARATIVE')
  assert.equal(def.numericMax, 24)
  assert.equal(def.items.length, 12)
})

test('narrative_review has no validated instrument, and says so', () => {
  const def = selectInstrument('narrative_review', null)
  assert.equal(def.id, 'NONE')
  assert.equal(def.items.length, 0)

  const score = scoreInstrument(def, [])
  assert.equal(score.noInstrument, true)
  assert.equal(score.normalized, null)
  assert.equal(score.gradingError, null)
  assert.equal(score.obtained, null)
})

test('an unknown design never guesses an instrument', () => {
  const def = selectInstrument(null, true)
  assert.equal(def.id, 'NONE')
  assert.equal(scoreInstrument(def, []).noInstrument, true)
})

test('the remaining design mappings are the published ones', () => {
  const expected: Record<QualityStudyDesign, string> = {
    rct: 'ROB2',
    prospective_cohort: 'NOS',
    case_control: 'NOS',
    retrospective_comparative: 'MINORS_COMPARATIVE',
    case_series: 'MINORS_NONCOMPARATIVE',
    case_report: 'CARE',
    systematic_review: 'AMSTAR2',
    meta_analysis: 'AMSTAR2',
    narrative_review: 'NONE',
    technical_note: 'NONE',
    basic_science: 'NONE',
    other: 'NONE',
  }
  for (const [design, id] of Object.entries(expected)) {
    assert.equal(selectInstrument(design as QualityStudyDesign, null).id, id, `design ${design}`)
  }
})

test('the comparative flag does not silently reroute case_control', () => {
  // Both readings must land on NOS: the same manuscript cannot be gradeable two
  // different ways depending on a flag the model inferred.
  assert.equal(selectInstrument('case_control', true).id, 'NOS')
  assert.equal(selectInstrument('case_control', false).id, 'NOS')
  assert.equal(selectInstrument('case_control', null).id, 'NOS')
})

/* -------------------------------------------------------------------------- */
/* Numeric scoring                                                             */
/* -------------------------------------------------------------------------- */

test('a fully met comparative MINORS is 24/24 and normalizes to 1', () => {
  const def = INSTRUMENTS.MINORS_COMPARATIVE
  const score = scoreNumericInstrument(def, all('MINORS_COMPARATIVE', 'met'))

  assert.equal(score.obtained, 24)
  assert.equal(score.applicableMax, 24)
  assert.equal(score.normalized, 1)
  assert.equal(score.overallRating, null)
  assert.equal(score.gaps.length, 0)
  assert.equal(score.noInstrument, false)
  assert.equal(score.items.length, 12)
})

test('the published maxima hold for every numeric instrument', () => {
  for (const id of ['MINORS_NONCOMPARATIVE', 'MINORS_COMPARATIVE', 'NOS', 'CARE'] as const) {
    const def = INSTRUMENTS[id]
    const score = scoreNumericInstrument(def, all(id, 'met'))
    assert.equal(score.applicableMax, def.numericMax, `${id} applicableMax`)
    assert.equal(score.obtained, def.numericMax, `${id} obtained`)
    assert.equal(score.normalized, 1, `${id} normalized`)
  }
})

test('not_assessable items leave the denominator instead of scoring zero', () => {
  const def = INSTRUMENTS.MINORS_COMPARATIVE
  const raw = all('MINORS_COMPARATIVE', 'met')
  for (const id of ['min3_prospective', 'min5_unbiased_assessment', 'min8_prospective_size']) {
    const item = raw.find((r) => r.id === id)!
    item.verdict = 'not_assessable'
    item.quote = null
  }

  const score = scoreNumericInstrument(def, raw)

  // Three 2-point items left the instrument: 24 - 6 = 18 on both sides.
  assert.equal(score.applicableMax, 18)
  assert.equal(score.obtained, 18)
  // The ratio of what WAS met is untouched — this is the whole design.
  assert.equal(score.normalized, 1)
  // They are still shown to the author, as gaps rather than as failures.
  assert.equal(score.items.length, 12)
  assert.equal(score.gaps.length, 3)
  assert.ok(score.gaps.every((g) => g.verdict === 'not_assessable'))
})

test('nothing assessable is null, never zero', () => {
  const score = scoreNumericInstrument(INSTRUMENTS.CARE, all('CARE', 'not_assessable'))
  assert.equal(score.normalized, null)
  assert.equal(score.applicableMax, 0)
  assert.equal(score.obtained, 0)
  assert.equal(score.gaps.length, 13)
})

test('a genuinely weak study does score low — the escape hatch is not a free pass', () => {
  const score = scoreNumericInstrument(INSTRUMENTS.MINORS_COMPARATIVE, all('MINORS_COMPARATIVE', 'not_met'))
  assert.equal(score.obtained, 0)
  assert.equal(score.applicableMax, 24)
  assert.equal(score.normalized, 0)
  assert.equal(score.gaps.length, 12)
})

test('partial earns the published middle value on a 0-2 item', () => {
  const score = scoreNumericInstrument(INSTRUMENTS.MINORS_NONCOMPARATIVE, all('MINORS_NONCOMPARATIVE', 'partial'))
  assert.equal(score.obtained, 8) // 8 items x 1
  assert.equal(score.applicableMax, 16)
  assert.equal(score.normalized, 0.5)
})

test('NOS comparability is the two-star item, and partial is one star', () => {
  const raw = all('NOS', 'not_met')
  raw.find((r) => r.id === 'nos_c1_comparability')!.verdict = 'partial'
  const score = scoreNumericInstrument(INSTRUMENTS.NOS, raw)
  assert.equal(score.obtained, 1)
  assert.equal(score.applicableMax, 9)
})

test('a partial on a binary item scores zero but is still labelled partial', () => {
  const raw = all('CARE', 'not_met')
  raw.find((r) => r.id === 'care5_timeline')!.verdict = 'partial'
  const score = scoreNumericInstrument(INSTRUMENTS.CARE, raw)

  assert.equal(score.obtained, 0)
  const timeline = score.items.find((i) => i.id === 'care5_timeline')!
  assert.equal(timeline.verdict, 'partial')
  assert.equal(timeline.points, 0)
  // Truthful about what was found: it is not a "not reported" gap.
  assert.ok(!score.gaps.some((g) => g.id === 'care5_timeline'))
})

test('pointsForVerdict is the whole per-item rule, in one place', () => {
  assert.equal(pointsForVerdict('met', 2), 2)
  assert.equal(pointsForVerdict('partial', 2), 1)
  assert.equal(pointsForVerdict('not_met', 2), 0)
  assert.equal(pointsForVerdict('not_assessable', 2), null)
  assert.equal(pointsForVerdict('met', 1), 1)
  assert.equal(pointsForVerdict('partial', 1), 0)
})

/* -------------------------------------------------------------------------- */
/* Item assembly hygiene                                                       */
/* -------------------------------------------------------------------------- */

test('an item the model omitted becomes not_assessable, not missing', () => {
  const raw = all('CARE', 'met').filter((r) => r.id !== 'care10_patient_perspective')
  const score = scoreNumericInstrument(INSTRUMENTS.CARE, raw)

  assert.equal(score.items.length, 13)
  const omitted = score.items.find((i) => i.id === 'care10_patient_perspective')!
  assert.equal(omitted.verdict, 'not_assessable')
  assert.equal(omitted.quote, null)
  assert.equal(omitted.points, null)
  assert.equal(score.applicableMax, 12)
})

test('a not_assessable item never carries a quote', () => {
  const raw: RawGradedItem[] = [{ id: 'care1_title_casereport', verdict: 'not_assessable', quote: 'a stray quote' }]
  const score = scoreNumericInstrument(INSTRUMENTS.CARE, raw)
  assert.equal(score.items[0].quote, null)
})

test('a duplicated item id cannot overwrite the first verdict', () => {
  const raw: RawGradedItem[] = [
    { id: 'care1_title_casereport', verdict: 'met', quote: 'a case report of' },
    { id: 'care1_title_casereport', verdict: 'not_met', quote: null },
  ]
  const score = scoreNumericInstrument(INSTRUMENTS.CARE, raw)
  assert.equal(score.items[0].verdict, 'met')
})

test('an unknown item id is ignored rather than scored', () => {
  const raw: RawGradedItem[] = [
    ...all('CARE', 'met'),
    { id: 'care99_invented', verdict: 'met', quote: 'nope' },
  ]
  const score = scoreNumericInstrument(INSTRUMENTS.CARE, raw)
  assert.equal(score.items.length, 13)
  assert.equal(score.obtained, 13)
})

test('items and gaps keep instrument order, not_met before not_assessable', () => {
  const raw = all('CARE', 'met')
  raw.find((r) => r.id === 'care2_keywords')!.verdict = 'not_assessable'
  raw.find((r) => r.id === 'care4_clinical_findings')!.verdict = 'not_met'
  raw.find((r) => r.id === 'care11_informed_consent')!.verdict = 'not_met'

  const gaps = buildGaps(scoreNumericInstrument(INSTRUMENTS.CARE, raw).items)
  assert.deepEqual(
    gaps.map((g) => g.id),
    ['care4_clinical_findings', 'care11_informed_consent', 'care2_keywords'],
  )
})

/* -------------------------------------------------------------------------- */
/* RoB 2                                                                       */
/* -------------------------------------------------------------------------- */

test('one high-risk domain makes the whole trial high risk', () => {
  const raw = all('ROB2', 'met')
  raw.find((r) => r.id === 'rob_d3_missing_outcome')!.verdict = 'not_met'

  const score = scoreRob2(INSTRUMENTS.ROB2, raw)
  assert.equal(score.overallRating, 'high')
  // No total is ever produced for RoB 2.
  assert.equal(score.obtained, null)
  assert.equal(score.applicableMax, null)
  assert.equal(score.normalized, 0.8) // (1+1+0+1+1)/5
})

test('some concerns only downgrades when no domain is high risk', () => {
  const raw = all('ROB2', 'met')
  raw.find((r) => r.id === 'rob_d2_deviations')!.verdict = 'partial'
  assert.equal(scoreRob2(INSTRUMENTS.ROB2, raw).overallRating, 'some_concerns')
})

test('all domains low risk is low risk overall', () => {
  const score = scoreRob2(INSTRUMENTS.ROB2, all('ROB2', 'met'))
  assert.equal(score.overallRating, 'low')
  assert.equal(score.normalized, 1)
})

test('RoB 2 with nothing assessable makes no judgement at all', () => {
  const score = scoreRob2(INSTRUMENTS.ROB2, all('ROB2', 'not_assessable'))
  assert.equal(score.overallRating, null)
  assert.equal(score.normalized, null)
})

test('RoB 2 averages only over the domains it could judge', () => {
  const raw = all('ROB2', 'not_assessable')
  raw.find((r) => r.id === 'rob_d1_randomization')!.verdict = 'met'
  raw.find((r) => r.id === 'rob_d1_randomization')!.quote = 'randomly allocated using a computer-generated sequence'
  raw.find((r) => r.id === 'rob_d4_measurement')!.verdict = 'partial'

  const score = scoreRob2(INSTRUMENTS.ROB2, raw)
  assert.equal(score.overallRating, 'some_concerns')
  assert.equal(score.normalized, 0.75) // (1 + 0.5) / 2
})

/* -------------------------------------------------------------------------- */
/* AMSTAR-2                                                                    */
/* -------------------------------------------------------------------------- */

test('the seven AMSTAR-2 critical domains are the published seven', () => {
  const critical = INSTRUMENTS.AMSTAR2.items.filter((i) => i.critical).map((i) => i.id)
  assert.deepEqual(critical, ['amstar2', 'amstar4', 'amstar7', 'amstar9', 'amstar11', 'amstar13', 'amstar15'])
  assert.equal(INSTRUMENTS.AMSTAR2.items.length, 16)
})

test('no flaws is high confidence', () => {
  const score = scoreAmstar2(INSTRUMENTS.AMSTAR2, all('AMSTAR2', 'met'))
  assert.equal(score.overallRating, 'high')
  assert.equal(score.normalized, 0.9)
  assert.equal(score.obtained, null)
})

test('one critical flaw sinks the review below any number of passes', () => {
  const raw = all('AMSTAR2', 'met')
  raw.find((r) => r.id === 'amstar9')!.verdict = 'not_met'
  const score = scoreAmstar2(INSTRUMENTS.AMSTAR2, raw)
  assert.equal(score.overallRating, 'low')
  assert.equal(score.normalized, 0.4)
})

test('two critical flaws are critically low', () => {
  const raw = all('AMSTAR2', 'met')
  raw.find((r) => r.id === 'amstar4')!.verdict = 'not_met'
  raw.find((r) => r.id === 'amstar15')!.verdict = 'not_met'
  assert.equal(scoreAmstar2(INSTRUMENTS.AMSTAR2, raw).overallRating, 'critically_low')
})

test('one non-critical weakness is still high; two make it moderate', () => {
  const one = all('AMSTAR2', 'met')
  one.find((r) => r.id === 'amstar5')!.verdict = 'not_met'
  assert.equal(scoreAmstar2(INSTRUMENTS.AMSTAR2, one).overallRating, 'high')

  const two = all('AMSTAR2', 'met')
  two.find((r) => r.id === 'amstar5')!.verdict = 'not_met'
  two.find((r) => r.id === 'amstar6')!.verdict = 'not_met'
  assert.equal(scoreAmstar2(INSTRUMENTS.AMSTAR2, two).overallRating, 'moderate')
})

test('a critical flaw outranks any pile of non-critical weaknesses', () => {
  const raw = all('AMSTAR2', 'not_met')
  for (const r of raw) if (r.id === 'amstar2') r.verdict = 'not_met'
  // Everything failed: 7 critical flaws.
  assert.equal(scoreAmstar2(INSTRUMENTS.AMSTAR2, raw).overallRating, 'critically_low')
})

test('partial yes is partial adherence, not a weakness', () => {
  const raw = all('AMSTAR2', 'met')
  raw.find((r) => r.id === 'amstar5')!.verdict = 'partial'
  raw.find((r) => r.id === 'amstar6')!.verdict = 'partial'
  raw.find((r) => r.id === 'amstar9')!.verdict = 'partial'
  assert.equal(scoreAmstar2(INSTRUMENTS.AMSTAR2, raw).overallRating, 'high')
})

test('AMSTAR-2 with nothing assessable makes no judgement', () => {
  const score = scoreAmstar2(INSTRUMENTS.AMSTAR2, all('AMSTAR2', 'not_assessable'))
  assert.equal(score.overallRating, null)
  assert.equal(score.normalized, null)
})

/* -------------------------------------------------------------------------- */
/* Degradation and determinism                                                 */
/* -------------------------------------------------------------------------- */

test('a grading failure is disclosed and is not a no-instrument result', () => {
  const score = gradingErrorScore(INSTRUMENTS.CARE, 'DeepSeek HTTP 500')
  assert.equal(score.gradingError, 'DeepSeek HTTP 500')
  assert.equal(score.normalized, null)
  // The design HAS an instrument; we just could not apply it. Conflating the two
  // would tell an author their case report is unappraisable, which is false.
  assert.equal(score.noInstrument, false)
  assert.equal(score.instrumentName, INSTRUMENTS.CARE.name)
  assert.equal(score.gaps.length, 0)
})

test('scoreNone carries no citation to display and no items', () => {
  const score = scoreNone()
  assert.equal(score.instrumentId, 'NONE')
  assert.equal(score.noInstrument, true)
  assert.equal(score.items.length, 0)
  assert.equal(score.citation, '')
})

test('the dispatcher routes each scale to its own scorer', () => {
  assert.equal(scoreInstrument(INSTRUMENTS.ROB2, all('ROB2', 'met')).overallRating, 'low')
  assert.equal(scoreInstrument(INSTRUMENTS.AMSTAR2, all('AMSTAR2', 'met')).overallRating, 'high')
  assert.equal(scoreInstrument(INSTRUMENTS.CARE, all('CARE', 'met')).obtained, 13)
  assert.equal(scoreInstrument(INSTRUMENTS.NONE, []).noInstrument, true)
})

test('the same verdicts always produce an identical score object', () => {
  const raw = all('MINORS_COMPARATIVE', 'met')
  raw.find((r) => r.id === 'min7_loss_below_5pct')!.verdict = 'partial'
  raw.find((r) => r.id === 'min3_prospective')!.verdict = 'not_assessable'

  const a = scoreInstrument(INSTRUMENTS.MINORS_COMPARATIVE, raw)
  const b = scoreInstrument(INSTRUMENTS.MINORS_COMPARATIVE, raw)
  assert.deepEqual(a, b)
  // 21 of 22 applicable points, rounded to 4dp and stable.
  assert.equal(a.obtained, 21)
  assert.equal(a.applicableMax, 22)
  assert.equal(a.normalized, 0.9545)
})

test('every instrument carries a citation the author can look up', () => {
  for (const def of Object.values(INSTRUMENTS)) {
    if (def.id === 'NONE') continue
    assert.ok(def.citation.length > 40, `${def.id} citation too short to be real`)
    assert.ok(def.name.length > 0)
  }
})
