// Methodological quality grading — instrument data (2026-07-26).
//
// CANONICAL DATA. Every item, every points scale and every max below is
// transcribed from the published instrument. They are not tunable product
// parameters and must not be "improved": an editor at the receiving journal
// recognises MINORS 18/24 precisely because 24 is MINORS' number and not ours.
// If code computes a max that disagrees with `numericMax` here, the code is
// wrong. Adding, removing or reweighting an item makes the score uncitable and
// forfeits the entire reason this feature is defensible.

import type { InstrumentDef, InstrumentId, InstrumentItem } from './types'

/* -------------------------------------------------------------------------- */
/* MINORS — Slim et al. 2003                                                   */
/* -------------------------------------------------------------------------- */

const MINORS_CITATION =
  'Slim K, Nini E, Forestier D, Kwiatkowski F, Panis Y, Chipponi J. Methodological index for non-randomized studies (MINORS): development and validation of a new instrument. ANZ J Surg. 2003;73(9):712-716.'

/** Items 1-8, scored 0 (not reported) / 1 (reported but inadequate) / 2 (reported and adequate). */
const MINORS_CORE_ITEMS: InstrumentItem[] = [
  { id: 'min1_aim', criterion: 'A clearly stated aim / research question', maxPoints: 2 },
  { id: 'min2_consecutive', criterion: 'Consecutive inclusion of patients', maxPoints: 2 },
  { id: 'min3_prospective', criterion: 'Prospective collection of data (a priori protocol)', maxPoints: 2 },
  { id: 'min4_endpoint_appropriate', criterion: 'Endpoints appropriate to the study aim', maxPoints: 2 },
  { id: 'min5_unbiased_assessment', criterion: 'Unbiased/blinded assessment of endpoints', maxPoints: 2 },
  { id: 'min6_followup_adequate', criterion: 'Follow-up period appropriate to the aim', maxPoints: 2 },
  { id: 'min7_loss_below_5pct', criterion: 'Loss to follow-up under 5%', maxPoints: 2 },
  { id: 'min8_prospective_size', criterion: 'Prospective calculation of study size (power analysis)', maxPoints: 2 },
]

/** Items 9-12, applied only to comparative studies. */
const MINORS_COMPARATIVE_ITEMS: InstrumentItem[] = [
  { id: 'min9_control_adequate', criterion: 'An adequate control group (gold-standard / accepted comparator)', maxPoints: 2 },
  { id: 'min10_groups_contemporary', criterion: 'Contemporary groups (managed over the same period)', maxPoints: 2 },
  { id: 'min11_baseline_equivalent', criterion: 'Baseline equivalence of groups', maxPoints: 2 },
  { id: 'min12_stats_adequate', criterion: 'Statistical analyses appropriate to the study', maxPoints: 2 },
]

const MINORS_NONCOMPARATIVE: InstrumentDef = {
  id: 'MINORS_NONCOMPARATIVE',
  name: 'MINORS (non-comparative)',
  citation: MINORS_CITATION,
  scaleKind: 'numeric',
  numericMax: 16,
  items: MINORS_CORE_ITEMS,
}

const MINORS_COMPARATIVE: InstrumentDef = {
  id: 'MINORS_COMPARATIVE',
  name: 'MINORS (comparative)',
  citation: MINORS_CITATION,
  scaleKind: 'numeric',
  numericMax: 24,
  items: [...MINORS_CORE_ITEMS, ...MINORS_COMPARATIVE_ITEMS],
}

/* -------------------------------------------------------------------------- */
/* Newcastle-Ottawa Scale — Wells et al.                                       */
/* -------------------------------------------------------------------------- */

/**
 * Star system: Selection 4, Comparability 2, Outcome 3 = 9.
 *
 * Comparability is the one two-star item, and the half-credit is meaningful
 * rather than arithmetic: `partial` earns one star for controlling the single
 * most important confounder, `met` earns the second for controlling additional
 * ones. That is the published intent of the item, which is why the generic
 * partial rule in score.ts lands on exactly the right number here.
 */
const NOS: InstrumentDef = {
  id: 'NOS',
  name: 'Newcastle-Ottawa Scale',
  citation:
    'Wells GA, Shea B, O’Connell D, Peterson J, Welch V, Losos M, Tugwell P. The Newcastle-Ottawa Scale (NOS) for assessing the quality of nonrandomised studies in meta-analyses. Ottawa Hospital Research Institute.',
  scaleKind: 'numeric',
  numericMax: 9,
  items: [
    { id: 'nos_s1_representative', criterion: 'Selection: representativeness of the exposed cohort', maxPoints: 1 },
    { id: 'nos_s2_selection_nonexposed', criterion: 'Selection: selection of the non-exposed cohort from the same source', maxPoints: 1 },
    { id: 'nos_s3_exposure_ascertain', criterion: 'Selection: secure ascertainment of exposure', maxPoints: 1 },
    { id: 'nos_s4_outcome_absent_start', criterion: 'Selection: outcome of interest not present at start of study', maxPoints: 1 },
    {
      id: 'nos_c1_comparability',
      criterion:
        'Comparability: comparability of cohorts on the basis of design or analysis (one star for controlling the key confounder, a second for controlling additional confounders)',
      maxPoints: 2,
    },
    { id: 'nos_o1_outcome_assessment', criterion: 'Outcome: independent or blinded outcome assessment, or record linkage', maxPoints: 1 },
    { id: 'nos_o2_followup_long_enough', criterion: 'Outcome: follow-up long enough for outcomes to occur', maxPoints: 1 },
    { id: 'nos_o3_followup_adequate', criterion: 'Outcome: adequacy of follow-up of cohorts (loss to follow-up accounted for)', maxPoints: 1 },
  ],
}

/* -------------------------------------------------------------------------- */
/* Cochrane RoB 2 — Sterne et al. 2019                                         */
/* -------------------------------------------------------------------------- */

/**
 * RoB 2 yields a domain risk profile, never a total. Summing five domains into
 * "3/5" would misrepresent the instrument and is the exact kind of invented
 * number this feature exists to avoid, so every item carries maxPoints 0 and
 * numericMax is null. The surfaced judgement is the standard algorithm's
 * overall rating (see scoreRob2).
 */
const ROB2: InstrumentDef = {
  id: 'ROB2',
  name: 'Cochrane Risk of Bias 2 (RoB 2)',
  citation:
    'Sterne JAC, Savović J, Page MJ, et al. RoB 2: a revised tool for assessing risk of bias in randomised trials. BMJ. 2019;366:l4898.',
  scaleKind: 'domain_rob2',
  numericMax: null,
  items: [
    { id: 'rob_d1_randomization', criterion: 'Bias arising from the randomization process', maxPoints: 0 },
    { id: 'rob_d2_deviations', criterion: 'Bias due to deviations from intended interventions', maxPoints: 0 },
    { id: 'rob_d3_missing_outcome', criterion: 'Bias due to missing outcome data', maxPoints: 0 },
    { id: 'rob_d4_measurement', criterion: 'Bias in measurement of the outcome', maxPoints: 0 },
    { id: 'rob_d5_selection_reported', criterion: 'Bias in selection of the reported result', maxPoints: 0 },
  ],
}

/* -------------------------------------------------------------------------- */
/* CARE — Gagnier et al. 2013                                                  */
/* -------------------------------------------------------------------------- */

/** Completeness checklist: 13 binary elements, 1 point each. */
const CARE: InstrumentDef = {
  id: 'CARE',
  name: 'CARE case report checklist',
  citation:
    'Gagnier JJ, Kienle G, Altman DG, Moher D, Sox H, Riley D; CARE Group. The CARE guidelines: consensus-based clinical case report guideline development. Glob Adv Health Med. 2013;2(5):38-43.',
  scaleKind: 'numeric',
  numericMax: 13,
  items: [
    { id: 'care1_title_casereport', criterion: 'The title identifies the article as a case report', maxPoints: 1 },
    { id: 'care2_keywords', criterion: 'Key words are given', maxPoints: 1 },
    { id: 'care3_patient_info', criterion: 'De-identified patient demographics and presenting concerns', maxPoints: 1 },
    { id: 'care4_clinical_findings', criterion: 'Clinical findings are described', maxPoints: 1 },
    { id: 'care5_timeline', criterion: 'A timeline of the episode of care is given', maxPoints: 1 },
    { id: 'care6_diagnostic', criterion: 'Diagnostic methods and their results are reported', maxPoints: 1 },
    { id: 'care7_intervention', criterion: 'The therapeutic intervention is described', maxPoints: 1 },
    { id: 'care8_followup_outcomes', criterion: 'Follow-up and outcomes are reported', maxPoints: 1 },
    { id: 'care9_discussion_lit', criterion: 'The discussion sets the case against the relevant literature', maxPoints: 1 },
    { id: 'care10_patient_perspective', criterion: 'The patient perspective is given (where appropriate)', maxPoints: 1 },
    { id: 'care11_informed_consent', criterion: 'An informed consent statement is present', maxPoints: 1 },
    { id: 'care12_novelty_rationale', criterion: 'A rationale for why the case is reportable is given', maxPoints: 1 },
    { id: 'care13_limitations', criterion: 'Limitations or lessons are stated', maxPoints: 1 },
  ],
}

/* -------------------------------------------------------------------------- */
/* AMSTAR-2 — Shea et al. 2017                                                 */
/* -------------------------------------------------------------------------- */

/**
 * 16 items, of which 7 are critical domains. AMSTAR-2 yields a confidence
 * rating, not a sum, so items carry maxPoints 0 and numericMax is null.
 * Item wording follows the published checklist; the critical set is items
 * 2, 4, 7, 9, 11, 13 and 15.
 */
const AMSTAR2: InstrumentDef = {
  id: 'AMSTAR2',
  name: 'AMSTAR 2',
  citation:
    'Shea BJ, Reeves BC, Wells G, et al. AMSTAR 2: a critical appraisal tool for systematic reviews that include randomised or non-randomised studies of healthcare interventions, or both. BMJ. 2017;358:j4008.',
  scaleKind: 'rating_amstar2',
  numericMax: null,
  items: [
    {
      id: 'amstar1',
      criterion: 'Did the research questions and inclusion criteria for the review include the components of PICO?',
      maxPoints: 0,
    },
    {
      id: 'amstar2',
      criterion:
        'Did the report of the review contain an explicit statement that the review methods were established prior to the conduct of the review and did the report justify any significant deviations from the protocol?',
      maxPoints: 0,
      critical: true,
    },
    {
      id: 'amstar3',
      criterion: 'Did the review authors explain their selection of the study designs for inclusion in the review?',
      maxPoints: 0,
    },
    {
      id: 'amstar4',
      criterion: 'Did the review authors use a comprehensive literature search strategy?',
      maxPoints: 0,
      critical: true,
    },
    { id: 'amstar5', criterion: 'Did the review authors perform study selection in duplicate?', maxPoints: 0 },
    { id: 'amstar6', criterion: 'Did the review authors perform data extraction in duplicate?', maxPoints: 0 },
    {
      id: 'amstar7',
      criterion: 'Did the review authors provide a list of excluded studies and justify the exclusions?',
      maxPoints: 0,
      critical: true,
    },
    { id: 'amstar8', criterion: 'Did the review authors describe the included studies in adequate detail?', maxPoints: 0 },
    {
      id: 'amstar9',
      criterion:
        'Did the review authors use a satisfactory technique for assessing the risk of bias in individual studies that were included in the review?',
      maxPoints: 0,
      critical: true,
    },
    {
      id: 'amstar10',
      criterion: 'Did the review authors report on the sources of funding for the studies included in the review?',
      maxPoints: 0,
    },
    {
      id: 'amstar11',
      criterion:
        'If meta-analysis was performed, did the review authors use appropriate methods for statistical combination of results?',
      maxPoints: 0,
      critical: true,
    },
    {
      id: 'amstar12',
      criterion:
        'If meta-analysis was performed, did the review authors assess the potential impact of risk of bias in individual studies on the results of the meta-analysis or other evidence synthesis?',
      maxPoints: 0,
    },
    {
      id: 'amstar13',
      criterion:
        'Did the review authors account for risk of bias in individual studies when interpreting/discussing the results of the review?',
      maxPoints: 0,
      critical: true,
    },
    {
      id: 'amstar14',
      criterion:
        'Did the review authors provide a satisfactory explanation for, and discussion of, any heterogeneity observed in the results of the review?',
      maxPoints: 0,
    },
    {
      id: 'amstar15',
      criterion:
        'If they performed quantitative synthesis, did the review authors carry out an adequate investigation of publication bias (small study bias) and discuss its likely impact on the results of the review?',
      maxPoints: 0,
      critical: true,
    },
    {
      id: 'amstar16',
      criterion:
        'Did the review authors report any potential sources of conflict of interest, including any funding they received for conducting the review?',
      maxPoints: 0,
    },
  ],
}

/* -------------------------------------------------------------------------- */
/* NONE                                                                        */
/* -------------------------------------------------------------------------- */

/**
 * The honest outcome for narrative reviews, technical notes, bench work and an
 * unknown design. There is no validated instrument for these, so we say exactly
 * that and score nothing. Inventing a checklist to avoid an empty card would be
 * the single worst thing this feature could do.
 *
 * `scaleKind` is inert here — nothing is ever scored against NONE (scoreNone
 * short-circuits), so the value is a placeholder required by the type.
 */
const NONE: InstrumentDef = {
  id: 'NONE',
  name: 'No validated instrument for this design',
  citation: '',
  scaleKind: 'numeric',
  numericMax: null,
  items: [],
}

export const INSTRUMENTS: Record<InstrumentId, InstrumentDef> = {
  MINORS_NONCOMPARATIVE,
  MINORS_COMPARATIVE,
  NOS,
  ROB2,
  CARE,
  AMSTAR2,
  NONE,
}

/** The seven AMSTAR-2 critical domains, derived from the data so it cannot drift. */
export const AMSTAR2_CRITICAL_IDS: readonly string[] = AMSTAR2.items
  .filter((i) => i.critical === true)
  .map((i) => i.id)
