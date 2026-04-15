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
// Landing primer (150 words, institutional voice)
// ---------------------------------------------------------------------------

export const AI_ORTHO_PRIMER =
  'Artificial intelligence has moved from research into daily orthopedic practice. Deep learning now reads radiographs for fracture detection, segments MRI scans, and grades osteoarthritis severity. Machine learning models predict surgical complications and post-operative outcomes. Large language models are increasingly used by trainees for clinical workup, patient education, and writing assistance. The pace is uneven, and the distance between a promising study and a validated clinical tool is often unclear. The AI in Orthopedics hub is OSCRSJ\u2019s curated reference on this landscape. It covers six categories: imaging, surgical planning and navigation, robotic surgery, outcomes and risk prediction, large language models and clinical decision support, and research and education tools. Every brief draws from peer-reviewed orthopedic journals or specialty society communications, links to the primary source, reports effect sizes honestly, and names the limitations the study could not resolve.'

// ---------------------------------------------------------------------------
// Glossary v1 — 20 terms at launch, target 40 by Month 3
// ---------------------------------------------------------------------------

export interface GlossaryEntry {
  term: string
  definition: string
}

export const AI_ORTHO_GLOSSARY: GlossaryEntry[] = [
  {
    term: 'Machine learning',
    definition:
      'A family of algorithms that learn patterns from data rather than being explicitly programmed with rules. In orthopedics, machine learning models are commonly trained on labeled imaging or outcomes data.',
  },
  {
    term: 'Deep learning',
    definition:
      'A subset of machine learning that uses layered neural networks, capable of learning complex features directly from raw data such as radiographs or MRI scans. Most recent AI imaging tools in orthopedics rely on deep learning.',
  },
  {
    term: 'Convolutional neural network (CNN)',
    definition:
      'A deep learning architecture designed for image data. CNNs scan an image with small filters to detect local features such as edges and textures, and remain a standard architecture for fracture detection, segmentation, and OA grading.',
  },
  {
    term: 'Transformer',
    definition:
      'A neural network architecture built around an attention mechanism that weighs relationships across an input sequence. Transformers power large language models and are increasingly used for medical imaging and clinical text.',
  },
  {
    term: 'Foundation model',
    definition:
      'A large model pretrained on a broad dataset that can be adapted to many downstream tasks. Foundation models are often the backbone of newer clinical AI tools and include families such as GPT, Claude, and medical-specific variants.',
  },
  {
    term: 'Large language model (LLM)',
    definition:
      'A transformer-based foundation model trained on text. LLMs produce fluent natural-language output and can summarize literature, draft notes, and answer clinical questions, but they can also fabricate information. See Hallucination.',
  },
  {
    term: 'Prompt',
    definition:
      'The natural-language input given to a large language model. Prompt wording substantially affects output quality, and small changes to a prompt can change the model\u2019s answer.',
  },
  {
    term: 'Hallucination',
    definition:
      'The production by a large language model of confident-sounding content that is false or unsupported by any source. Hallucinations are a well-documented failure mode and a central safety concern for clinical LLM use.',
  },
  {
    term: 'Retrieval-augmented generation (RAG)',
    definition:
      'A technique in which a language model is connected to a curated document store at query time and instructed to answer from retrieved passages. RAG is used to reduce hallucinations in clinical and research tools.',
  },
  {
    term: 'Sensitivity',
    definition:
      'The proportion of true positives correctly identified by a test or model. A fracture detection model with 95 percent sensitivity misses 5 percent of fractures present in the data.',
  },
  {
    term: 'Specificity',
    definition:
      'The proportion of true negatives correctly identified by a test or model. High sensitivity with low specificity produces many false alarms. Both numbers should always be reported together.',
  },
  {
    term: 'Positive predictive value (PPV)',
    definition:
      'Among cases the model flags as positive, the proportion that are truly positive. PPV depends on disease prevalence and falls sharply in low-prevalence populations.',
  },
  {
    term: 'Negative predictive value (NPV)',
    definition:
      'Among cases the model flags as negative, the proportion that are truly negative. NPV also depends on prevalence and is often high when disease is uncommon.',
  },
  {
    term: 'ROC curve and AUC',
    definition:
      'A receiver operating characteristic curve plots sensitivity against 1 minus specificity across all classification thresholds. The area under the curve (AUC) summarizes overall discrimination on a 0 to 1 scale, with 0.5 indicating chance and 1.0 indicating perfect discrimination.',
  },
  {
    term: 'Training, validation, and test sets',
    definition:
      'The three data partitions used to develop and evaluate a model. The model learns from the training set, is tuned on the validation set, and is evaluated on the held-out test set. A model that has seen the test data during training will report inflated performance.',
  },
  {
    term: 'Overfitting',
    definition:
      'When a model learns patterns specific to its training data that do not generalize to new cases. Overfit models perform well on their own test set but fail on external cases.',
  },
  {
    term: 'External validation',
    definition:
      'Evaluation of a model on data from an institution, scanner, or population not used during training. External validation is the standard for judging whether a model will generalize to clinical use.',
  },
  {
    term: 'Ground truth',
    definition:
      'The reference label against which model predictions are compared, for example an orthopedic surgeon\u2019s read of a radiograph or a confirmed intraoperative diagnosis. Model performance is only as reliable as the ground truth it is measured against.',
  },
  {
    term: 'PACS',
    definition:
      'Picture Archiving and Communication System. The hospital infrastructure that stores, retrieves, and distributes medical imaging. Clinical AI imaging tools are typically integrated at the PACS level.',
  },
  {
    term: 'DICOM',
    definition:
      'Digital Imaging and Communications in Medicine. The standard file format and communication protocol for medical imaging. AI imaging models typically consume DICOM inputs.',
  },
]
