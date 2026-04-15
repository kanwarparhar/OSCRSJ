// Data layer for the AI in Orthopedics hub.
// Categories are stable (defined here). Briefs are currently an empty placeholder
// array — Arjun populates this in the next session (inaugural slate of 10 briefs
// per AI in Orthopedics Page Plan §4).

import type { ComponentType } from 'react'
import ImagingIcon from '@/components/icons/ai-ortho/Imaging'
import SurgicalPlanningIcon from '@/components/icons/ai-ortho/SurgicalPlanning'
import RoboticsIcon from '@/components/icons/ai-ortho/Robotics'
import OutcomesIcon from '@/components/icons/ai-ortho/Outcomes'
import LLMsIcon from '@/components/icons/ai-ortho/LLMs'
import ResearchToolsIcon from '@/components/icons/ai-ortho/ResearchTools'

export type AiOrthoCategorySlug =
  | 'imaging'
  | 'surgical-planning'
  | 'robotics'
  | 'outcomes-prediction'
  | 'llms-and-decision-support'
  | 'research-tools'

export interface AiOrthoCategory {
  slug: AiOrthoCategorySlug
  label: string
  short: string // short label for pills/badges
  description: string
  Icon: ComponentType<{ className?: string }>
}

export const AI_ORTHO_CATEGORIES: AiOrthoCategory[] = [
  {
    slug: 'imaging',
    label: 'AI in Imaging',
    short: 'Imaging',
    description:
      'Fracture detection, OA grading, tumor and lesion classification, automated Cobb angle, MRI segmentation.',
    Icon: ImagingIcon,
  },
  {
    slug: 'surgical-planning',
    label: 'Surgical Planning & Navigation',
    short: 'Surgical Planning',
    description:
      'AI-assisted 3D reconstruction, pre-op implant sizing, AR/VR overlays, patient-specific instrumentation.',
    Icon: SurgicalPlanningIcon,
  },
  {
    slug: 'robotics',
    label: 'Robotic Surgery',
    short: 'Robotics',
    description:
      'Robotic arthroplasty, robotic spine, emerging robotic arthroscopy, AI-enhanced robotic systems.',
    Icon: RoboticsIcon,
  },
  {
    slug: 'outcomes-prediction',
    label: 'Outcomes & Risk Prediction',
    short: 'Outcomes',
    description:
      'ML models for post-op complications, PROMs, readmission risk, length of stay, cost and resource forecasting.',
    Icon: OutcomesIcon,
  },
  {
    slug: 'llms-and-decision-support',
    label: 'LLMs & Clinical Decision Support',
    short: 'LLMs',
    description:
      'ChatGPT, Claude, and DeepSeek for clinical workup, guideline concordance, patient education, and resident studying.',
    Icon: LLMsIcon,
  },
  {
    slug: 'research-tools',
    label: 'Research & Education Tools',
    short: 'Research Tools',
    description:
      'AI for literature search, writing assistance, figure generation, coding, statistics, and ethics of AI use in research.',
    Icon: ResearchToolsIcon,
  },
]

export function getCategory(slug: string): AiOrthoCategory | undefined {
  return AI_ORTHO_CATEGORIES.find((c) => c.slug === slug)
}

// ---------------------------------------------------------------------------
// Briefs
// ---------------------------------------------------------------------------

export interface AiOrthoBrief {
  slug: string // URL slug (brief-slug segment)
  category: AiOrthoCategorySlug
  headline: string
  publishedAt: string // ISO date, e.g. '2026-04-14'
  readMinutes: number
  summary: string // one-sentence bottom-line for cards + meta description
  bottomLine: string // callout at top of individual brief
  whatTheyDid: string
  whatTheyFound: string
  whyItMatters: string
  limitations: string
  furtherReading?: { label: string; href: string }[]
  source: {
    paperTitle: string
    authors: string // e.g. "Smith JA, Chen L, Patel R, et al."
    journal: string
    paperPublishedAt: string // ISO or human date string
    doi?: string // e.g. "10.2106/JBJS.25.00001"
    url?: string // canonical link (falls back to https://doi.org/<doi>)
    openAccess?: boolean
  }
  // Full Vancouver-style citation string for the bottom of the brief.
  citation: string
}

// Placeholder: empty until Arjun ships the inaugural slate of 10 briefs.
// Keep as a typed array so category/brief routes compile and render the
// "no briefs yet" empty state.
export const AI_ORTHO_BRIEFS: AiOrthoBrief[] = []

export function getBriefsByCategory(slug: AiOrthoCategorySlug): AiOrthoBrief[] {
  return AI_ORTHO_BRIEFS.filter((b) => b.category === slug).sort(
    (a, b) => b.publishedAt.localeCompare(a.publishedAt)
  )
}

export function getLatestBriefs(limit = 10): AiOrthoBrief[] {
  return [...AI_ORTHO_BRIEFS]
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
    .slice(0, limit)
}

export function getBrief(
  category: AiOrthoCategorySlug,
  slug: string
): AiOrthoBrief | undefined {
  return AI_ORTHO_BRIEFS.find((b) => b.category === category && b.slug === slug)
}

// ---------------------------------------------------------------------------
// Landing primer (150 words — placeholder until Arjun ships final copy)
// ---------------------------------------------------------------------------

export const AI_ORTHO_PRIMER =
  'Artificial intelligence is rapidly reshaping how orthopedic surgeons diagnose fractures, plan procedures, and predict outcomes. From deep-learning fracture detection on radiographs to language models that support clinical decision-making, new tools are moving from research benchtops into real operating rooms and clinics. For residents and fellows, the pace of change can feel overwhelming, and the distance between a promising study and validated clinical practice is often unclear. The AI in Orthopedics hub is OSCRSJ\u2019s curated reference on this landscape: peer-reviewed research, validated tools, and honest limitations, all summarized in plain language for trainees and attendings. We cover imaging, surgical planning, robotics, outcomes prediction, large language models, and research workflows. Every brief links to the primary source, reports effect sizes honestly, and names what the study could not answer. Our goal is to be the canonical reference orthopedic trainees cite.'
