// Static journal registry. GENERATED FILE — do not edit by hand.
// Regenerate with: npx tsx scripts/gen-journal-list.ts
// Source of truth: docs/formatting-expansion/manifest.json (order + abbrevs) +
// the on-disk lib/formatting/journals/*.json rule files. Kept as static imports
// so the /format picker, the pipeline, and the freshness cron all read one
// validated list at build time — no runtime filesystem access (Vercel-safe).
//
// This module imports every rule JSON, so it must be imported ONLY from server /
// build code. Client components import the rules-free ./registry-meta instead,
// and receive JOURNAL_SUMMARIES as a prop from a server component. The
// client-safe metadata is re-exported here for back-compat with server callers.

import { journalRulesSchema, type JournalRules } from './rulesSchema'
import { journalAbbrev, type JournalSummary } from './registry-meta'

import oscrsj from './journals/oscrsj.json'
import bjsm from './journals/bjsm.json'
import sportsMedicine from './journals/sports-medicine.json'
import jshs from './journals/jshs.json'
import jcsm from './journals/jcsm.json'
import osteoarthritisCartilage from './journals/osteoarthritis-cartilage.json'
import jbmr from './journals/jbmr.json'
import ajsm from './journals/ajsm.json'
import arthroscopy from './journals/arthroscopy.json'
import sportsMedicineOpen from './journals/sports-medicine-open.json'
import kssta from './journals/kssta.json'
import biologyOfSport from './journals/biology-of-sport.json'
import journalOfOrthopaedicTranslation from './journals/journal-of-orthopaedic-translation.json'
import journalOfArthroplasty from './journals/journal-of-arthroplasty.json'
import scienceMedicineFootball from './journals/science-medicine-football.json'
import ijspp from './journals/ijspp.json'
import theSpineJournal from './journals/the-spine-journal.json'
import ksrr from './journals/ksrr.json'
import jses from './journals/jses.json'
import jbjsOpenAccess from './journals/jbjs-open-access.json'
import bjj from './journals/bjj.json'
import efortOpenReviews from './journals/efort-open-reviews.json'
import crmm from './journals/crmm.json'
import skeletalMuscle from './journals/skeletal-muscle.json'
import arthroplasty from './journals/arthroplasty.json'
import sjmss from './journals/sjmss.json'
import jsams from './journals/jsams.json'
import essr from './journals/essr.json'
import journalOfOrthopaedicsAndTraumatology from './journals/journal-of-orthopaedics-and-traumatology.json'
import msse from './journals/msse.json'
import jbjs from './journals/jbjs.json'
import spine from './journals/spine.json'
import boneJointResearch from './journals/bone-joint-research.json'
import aprm from './journals/aprm.json'
import calcifiedTissueInternational from './journals/calcified-tissue-international.json'
import globalSpineJournal from './journals/global-spine-journal.json'
import fai from './journals/fai.json'
import boneJointOpen from './journals/bone-joint-open.json'
import otsr from './journals/otsr.json'
import sportsHealth from './journals/sports-health.json'
import journalOfIsakos from './journals/journal-of-isakos.json'
import asianSpineJournal from './journals/asian-spine-journal.json'
import actaOrthopaedica from './journals/acta-orthopaedica.json'
import jscr from './journals/jscr.json'
import corr from './journals/corr.json'
import jhs from './journals/jhs.json'
import jot from './journals/jot.json'
import injury from './journals/injury.json'
import jocr from './journals/jocr.json'

const RAW: unknown[] = [
  oscrsj, bjsm, sportsMedicine, jshs, jcsm, osteoarthritisCartilage, jbmr, ajsm,
  arthroscopy, sportsMedicineOpen, kssta, biologyOfSport, journalOfOrthopaedicTranslation,
  journalOfArthroplasty, scienceMedicineFootball, ijspp, theSpineJournal, ksrr, jses,
  jbjsOpenAccess, bjj, efortOpenReviews, crmm, skeletalMuscle, arthroplasty, sjmss, jsams,
  essr, journalOfOrthopaedicsAndTraumatology, msse, jbjs, spine, boneJointResearch, aprm,
  calcifiedTissueInternational, globalSpineJournal, fai, boneJointOpen, otsr, sportsHealth,
  journalOfIsakos, asianSpineJournal, actaOrthopaedica, jscr, corr, jhs, jot, injury, jocr,
]

/** All journal rules, validated against the schema, OSCRSJ first then by SJR rank. */
export const JOURNALS: JournalRules[] = RAW.map((r) => journalRulesSchema.parse(r))

export const JOURNALS_BY_SLUG: Record<string, JournalRules> = Object.fromEntries(
  JOURNALS.map((j) => [j.identity.slug, j]),
)

export function getJournal(slug: string): JournalRules | null {
  return JOURNALS_BY_SLUG[slug] ?? null
}

export const JOURNAL_SUMMARIES: JournalSummary[] = JOURNALS.map((j) => ({
  slug: j.identity.slug,
  name: j.identity.name,
  abbrev: journalAbbrev(j.identity.slug),
  publisher: j.identity.publisher,
  articleTypes: j.article_types,
  guidelinesUrl: j.identity.guidelines_url,
  verifiedDate: j.identity.verified_date,
}))

// Back-compat re-exports (server callers may still import these from here).
export { JOURNAL_ABBREVIATIONS, journalAbbrev, ARTICLE_TYPE_LABELS } from './registry-meta'
export type { JournalSummary } from './registry-meta'
