// Methodological quality grading — public surface (2026-07-26).
//
// The Journal Finder, the Manuscript Formatter and (later) the journal's own
// submission intake all import from HERE and nowhere deeper. Keeping the surface
// in one file is what makes the eventual move into OSCRSJ's intake a one-line
// import change rather than an archaeology exercise.
//
// Nothing in this library may import from `app/`, `lib/finder/` or
// `lib/formatting/`. See the note at the top of types.ts for why that constraint
// is load-bearing rather than tidy.

export type {
  InstrumentDef,
  InstrumentId,
  InstrumentItem,
  ItemVerdict,
  MethodologyScore,
  RawGradedItem,
  ScoredItem,
  StudyDesign,
} from './types'

export { INSTRUMENTS, AMSTAR2_CRITICAL_IDS } from './instruments'

export {
  buildGaps,
  gradingErrorScore,
  pointsForVerdict,
  scoreAmstar2,
  scoreInstrument,
  scoreNone,
  scoreNumericInstrument,
  scoreRob2,
  selectInstrument,
} from './score'
