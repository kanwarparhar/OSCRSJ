// Methodological quality grading — scoring math (2026-07-26).
//
// PURE, AND THAT IS THE POINT. The model is asked only to judge each item and
// point at the sentence behind the judgement. Every number an author sees is
// computed here, from data, by arithmetic — no Date, no Math.random, no network,
// no I/O. The same verdicts always produce the same MethodologyScore, which is
// what lets the Finder promise that a manuscript yields the same ladder twice.
//
// THE DENOMINATOR IS THE WHOLE ETHICAL DESIGN. An item the manuscript does not
// let us judge is `not_assessable`, and such items are removed from BOTH sides
// of the fraction. They never score zero. A short paper is therefore reported as
// "8/10 on the ten items its text can answer", never punished down to "8/24" for
// the sin of being unreadable to a language model. The alternative — counting
// unknowns as failures — would make the score a measure of our extraction
// quality rather than of the study.

import { INSTRUMENTS } from './instruments'
import type {
  InstrumentDef,
  ItemVerdict,
  MethodologyScore,
  RawGradedItem,
  ScoredItem,
  StudyDesign,
} from './types'

/** Round to 4dp so a score is a stable, comparable number across runs. */
const round4 = (n: number) => Math.round(n * 10_000) / 10_000

/* -------------------------------------------------------------------------- */
/* Instrument selection                                                        */
/* -------------------------------------------------------------------------- */

/**
 * The authoritative design -> instrument map.
 *
 * A design absent from this map, or a null design, yields NONE. That is not a
 * degraded path: it is the correct answer for a narrative review, and guessing
 * an instrument for one would produce a citable-looking score that the cited
 * instrument's authors never intended to apply.
 */
const INSTRUMENT_BY_DESIGN: Record<StudyDesign, InstrumentDef['id']> = {
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

/**
 * Pick the instrument for a design.
 *
 * `comparative` is accepted because the profile carries it and a future revision
 * may need it, but it deliberately does NOT redirect anything today. The brief's
 * prose floats the idea of routing a comparative `case_control` to MINORS, while
 * its authoritative map sends every `case_control` to NOS; the authoritative map
 * wins, because a case-control study is what NOS was built for and swapping
 * instruments on a flag the model inferred would make the same manuscript
 * gradeable two different ways.
 */
export function selectInstrument(
  design: StudyDesign | null,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  comparative: boolean | null,
): InstrumentDef {
  if (design === null) return INSTRUMENTS.NONE
  return INSTRUMENTS[INSTRUMENT_BY_DESIGN[design] ?? 'NONE'] ?? INSTRUMENTS.NONE
}

/* -------------------------------------------------------------------------- */
/* Item assembly                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Points a verdict earns on a numeric instrument.
 *
 * The `partial` rule reads oddly in the abstract but is exactly right on both
 * scales it meets. On MINORS' 0-2 items it is the published middle value,
 * "reported but inadequate" = 1. On the Newcastle-Ottawa comparability item
 * (maxPoints 2) it is the one star earned for controlling the key confounder
 * without the second. On a binary item there is no half — CARE asks whether an
 * element is present, and "sort of present" earns the same 0 as absent while
 * still being LABELLED partial to the author, so the card stays truthful about
 * what was found even though the arithmetic cannot reward it.
 */
export function pointsForVerdict(verdict: ItemVerdict, maxPoints: number): number | null {
  if (verdict === 'not_assessable') return null
  if (verdict === 'met') return maxPoints
  if (verdict === 'partial') return maxPoints >= 2 ? Math.floor(maxPoints / 2) : 0
  return 0
}

/**
 * Align raw verdicts to the instrument's own item list, in the instrument's
 * order. An item the model omitted is `not_assessable` rather than absent: the
 * author sees every item the instrument contains, including the ones we could
 * not answer, which is the difference between a checklist and a highlight reel.
 */
function assembleItems(def: InstrumentDef, rawItems: RawGradedItem[], numeric: boolean): ScoredItem[] {
  const byId = new Map<string, RawGradedItem>()
  for (const r of rawItems) {
    // First wins: a duplicated id from a confused model must not silently
    // overwrite an already-verified verdict.
    if (!byId.has(r.id)) byId.set(r.id, r)
  }

  return def.items.map((item) => {
    const raw = byId.get(item.id)
    const verdict: ItemVerdict = raw?.verdict ?? 'not_assessable'
    const quote = verdict === 'not_assessable' ? null : (raw?.quote ?? null)
    return {
      id: item.id,
      criterion: item.criterion,
      verdict,
      points: numeric ? pointsForVerdict(verdict, item.maxPoints) : null,
      quote,
    }
  })
}

/**
 * The "what would strengthen this study" source: what the manuscript does not
 * report, then what it does not report clearly enough to judge. Order matters —
 * a `not_met` is a concrete missing element the author can add, whereas a
 * `not_assessable` is usually a clarity problem, so the actionable half leads.
 */
export function buildGaps(items: ScoredItem[]): ScoredItem[] {
  return [
    ...items.filter((i) => i.verdict === 'not_met'),
    ...items.filter((i) => i.verdict === 'not_assessable'),
  ]
}

/* -------------------------------------------------------------------------- */
/* Scorers                                                                     */
/* -------------------------------------------------------------------------- */

/** MINORS and CARE and NOS: sum points over the items the text could answer. */
export function scoreNumericInstrument(def: InstrumentDef, rawItems: RawGradedItem[]): MethodologyScore {
  const items = assembleItems(def, rawItems, true)
  const assessable = items.filter((i) => i.verdict !== 'not_assessable')

  const obtained = assessable.reduce((sum, i) => sum + (i.points ?? 0), 0)
  const applicableMax = def.items
    .filter((item) => assessable.some((i) => i.id === item.id))
    .reduce((sum, item) => sum + item.maxPoints, 0)

  return {
    instrumentId: def.id,
    instrumentName: def.name,
    citation: def.citation,
    items,
    obtained,
    applicableMax,
    overallRating: null,
    normalized: applicableMax > 0 ? round4(obtained / applicableMax) : null,
    gaps: buildGaps(items),
    noInstrument: false,
    gradingError: null,
  }
}

/** Weight of a domain judgement when averaging RoB 2 into an anchor input. */
const ROB2_WEIGHT: Record<ItemVerdict, number> = {
  met: 1, // low risk
  partial: 0.5, // some concerns
  not_met: 0, // high risk
  not_assessable: 0, // never reached — excluded before averaging
}

/**
 * Cochrane RoB 2. No total is produced, by design.
 *
 * The overall judgement follows the published algorithm and is deliberately
 * pessimistic: a single high-risk domain makes the whole trial high risk, and no
 * number of low-risk domains offsets it. The separate `normalized` mean exists
 * only to give the ladder anchor a continuous input; it is never shown to an
 * author as a score, because "0.7 of a RoB 2" is not a thing that exists.
 */
export function scoreRob2(def: InstrumentDef, rawItems: RawGradedItem[]): MethodologyScore {
  const items = assembleItems(def, rawItems, false)
  const assessable = items.filter((i) => i.verdict !== 'not_assessable')

  let overallRating: string | null = null
  let normalized: number | null = null

  if (assessable.length > 0) {
    overallRating = assessable.some((i) => i.verdict === 'not_met')
      ? 'high'
      : assessable.some((i) => i.verdict === 'partial')
        ? 'some_concerns'
        : 'low'
    normalized = round4(
      assessable.reduce((sum, i) => sum + ROB2_WEIGHT[i.verdict], 0) / assessable.length,
    )
  }

  return {
    instrumentId: def.id,
    instrumentName: def.name,
    citation: def.citation,
    items,
    obtained: null,
    applicableMax: null,
    overallRating,
    normalized,
    gaps: buildGaps(items),
    noInstrument: false,
    gradingError: null,
  }
}

/** Anchor input per AMSTAR-2 confidence rating. */
const AMSTAR2_NORMALIZED: Record<string, number> = {
  high: 0.9,
  moderate: 0.7,
  low: 0.4,
  critically_low: 0.2,
}

/**
 * AMSTAR-2. A confidence rating, not a sum.
 *
 * Critical flaws dominate: one sinks the review to `low` and two or more to
 * `critically_low`, however many non-critical items pass. A "weakness" is a No
 * answer, per the published rules — a Partial Yes is partial adherence and is
 * not counted as a weakness. That is the instrument's own arithmetic and is not
 * ours to tighten or loosen.
 */
export function scoreAmstar2(def: InstrumentDef, rawItems: RawGradedItem[]): MethodologyScore {
  const items = assembleItems(def, rawItems, false)
  const assessable = items.filter((i) => i.verdict !== 'not_assessable')
  const criticalById = new Map(def.items.map((i) => [i.id, i.critical === true]))

  let overallRating: string | null = null
  let normalized: number | null = null

  if (assessable.length > 0) {
    const failed = assessable.filter((i) => i.verdict === 'not_met')
    const criticalFlaws = failed.filter((i) => criticalById.get(i.id) === true).length
    const nonCriticalWeaknesses = failed.length - criticalFlaws

    overallRating =
      criticalFlaws > 1
        ? 'critically_low'
        : criticalFlaws === 1
          ? 'low'
          : nonCriticalWeaknesses > 1
            ? 'moderate'
            : 'high'
    normalized = AMSTAR2_NORMALIZED[overallRating] ?? null
  }

  return {
    instrumentId: def.id,
    instrumentName: def.name,
    citation: def.citation,
    items,
    obtained: null,
    applicableMax: null,
    overallRating,
    normalized,
    gaps: buildGaps(items),
    noInstrument: false,
    gradingError: null,
  }
}

/**
 * The honest empty result for a design with no validated instrument.
 * `normalized: null` means the ladder anchor is untouched (see
 * deriveInstrumentAdjustment) — a narrative review is neither rewarded nor
 * penalised for being ungradeable.
 */
export function scoreNone(): MethodologyScore {
  const def = INSTRUMENTS.NONE
  return {
    instrumentId: def.id,
    instrumentName: def.name,
    citation: def.citation,
    items: [],
    obtained: null,
    applicableMax: null,
    overallRating: null,
    normalized: null,
    gaps: [],
    noInstrument: true,
    gradingError: null,
  }
}

/**
 * Grading was attempted and failed. Structurally identical to a no-instrument
 * result, so every consumer already handles it, but it carries the reason and
 * reports `noInstrument: false` — the design HAS an instrument, we simply could
 * not apply it, and conflating the two would tell an author their study design
 * is unappraisable when it is not.
 */
export function gradingErrorScore(def: InstrumentDef, message: string): MethodologyScore {
  return {
    instrumentId: def.id,
    instrumentName: def.name,
    citation: def.citation,
    items: [],
    obtained: null,
    applicableMax: null,
    overallRating: null,
    normalized: null,
    gaps: [],
    noInstrument: false,
    gradingError: message,
  }
}

/** Dispatch to the right scorer for an instrument's scale. */
export function scoreInstrument(def: InstrumentDef, rawItems: RawGradedItem[]): MethodologyScore {
  if (def.id === 'NONE') return scoreNone()
  switch (def.scaleKind) {
    case 'domain_rob2':
      return scoreRob2(def, rawItems)
    case 'rating_amstar2':
      return scoreAmstar2(def, rawItems)
    default:
      return scoreNumericInstrument(def, rawItems)
  }
}
