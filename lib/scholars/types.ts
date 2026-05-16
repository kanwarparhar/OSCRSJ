// ============================================================
// Cohort applications — shared types + label tables
// ============================================================
// Split out from actions.ts because Next.js 14 prohibits non-async
// exports from a 'use server' file. Types, constants, and label
// tables consumed by both the server action AND client components /
// pages must live here.
// ============================================================

export type CohortTrack = 'pre_med' | 'med_student' | 'img'

export type CohortTier =
  | 'pre_med_tier_1'
  | 'pre_med_tier_2'
  | 'med_student_tier_1'
  | 'med_student_tier_2'
  | 'img'

export type CohortApplicationStatus =
  | 'submitted'
  | 'under_review'
  | 'accepted'
  | 'waitlisted'
  | 'rejected'
  | 'withdrawn'

export interface CohortApplicationReference {
  name: string
  email: string
  relationship: string
  institution: string
}

export interface CohortApplicationRow {
  id: string
  created_at: string
  first_name: string
  last_name: string
  email: string
  orcid_id: string | null
  country_of_residence: string
  school: string
  year_in_school: string
  preferred_track: CohortTrack
  preferred_tier: CohortTier
  personal_statement: string
  research_experience: string
  why_oscrsj: string
  references_json: CohortApplicationReference[]
  cv_storage_path: string | null
  ai_disclosure_ack: boolean
  participant_agreement_ack: boolean
  status: CohortApplicationStatus
  reviewed_by: string | null
  reviewed_at: string | null
  admin_notes: string | null
}

export const TRACK_LABELS: Record<CohortTrack, string> = {
  pre_med: 'Pre-Med Scholar',
  med_student: 'Med Student Scholar',
  img: 'IMG Scholar',
}

export const TIER_LABELS: Record<CohortTier, string> = {
  pre_med_tier_1: 'Tier 1 — 6-month program ($499)',
  pre_med_tier_2: 'Tier 2 — 1-year program ($999)',
  med_student_tier_1: 'Tier 1 — 6-month program ($499)',
  med_student_tier_2: 'Tier 2 — 1-year program ($999)',
  img: '6-month program ($299)',
}

// Tier-to-track mapping for validation
export const TIER_TO_TRACK: Record<CohortTier, CohortTrack> = {
  pre_med_tier_1: 'pre_med',
  pre_med_tier_2: 'pre_med',
  med_student_tier_1: 'med_student',
  med_student_tier_2: 'med_student',
  img: 'img',
}
