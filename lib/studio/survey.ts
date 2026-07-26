// ============================================================
// Submission Studio -- unlock survey (single source of truth)
// ============================================================
// Kanwar directive, 2026-07-26. A user who has spent their three free runs can
// buy three more, once, by answering this. The survey is the entire reason the
// free period exists: we are trading compute for the only thing we cannot buy,
// which is a straight answer about whether the tool actually worked.
//
// This file defines the questions, the validation, AND the flattening to a
// spreadsheet row. All three in one place on purpose. The failure mode of
// survey code is drift -- the form asks nine questions, the validator knows
// about eight, and the Sheet has columns from a version nobody remembers
// shipping. Deriving the form, the validator, and the sheet header from one
// array makes that class of bug unrepresentable.
//
// DESIGN NOTES ON THE QUESTIONS THEMSELVES, since they are the product here:
//
//   * Closed-ended first, open-ended last. Every question that can be a scale
//     or a multi-select is one, because 40 free-text answers are an afternoon
//     of reading and 40 multi-selects are a bar chart. The two open questions
//     is the one where a fixed option list would put words in their mouth.
//
//   * We ask what BROKE before we ask what to BUILD. Asked the other way round
//     people volunteer features and forget the reference list came out wrong.
//     The `problems` question is the highest-value item in the set and it is
//     deliberately a checklist of the things we already suspect, plus an
//     escape hatch for the ones we do not.
//
//   * Only the PRICE question survives on money. The paired "would you pay"
//     intent question was cut on 2026-07-26 to keep the form short. What is
//     left measures perceived value rather than purchase intent, so read it
//     that way: a low fair-price answer from someone who rated the tool highly
//     is a pricing signal, not a refusal.
//
//   * NO question asks anything about the manuscript's content. Same standing
//     rule as the rest of the Studio (lib/studio/metrics.ts): we do not look at
//     the work, so we do not ask about it either.
//
// Bump SURVEY_VERSION on ANY change to question ids, wording, or options.
// Analytics groups by version before comparing anything; a reworded question
// pooled with its old self produces a confident wrong answer.
// ============================================================

export const SURVEY_VERSION = '2026-07-26.v2'

/** Roughly how long the form takes, shown to the user before they start. */
export const SURVEY_ESTIMATED_MINUTES = 2

export type QuestionType = 'single' | 'multi' | 'scale' | 'text'

export interface ScaleLabels {
  min: string
  max: string
}

export interface SurveyQuestion {
  id: string
  type: QuestionType
  /** Shown as the question heading. */
  prompt: string
  /** Optional clarifier under the prompt. */
  help?: string
  required: boolean
  /** For 'single' and 'multi'. */
  options?: readonly string[]
  /** For 'single' and 'multi': append a free-text "Other" field. */
  allowOther?: boolean
  /** For 'scale'. Inclusive range, rendered as radio buttons. */
  scaleMin?: number
  scaleMax?: number
  scaleLabels?: ScaleLabels
  /** For 'text'. */
  minLength?: number
  maxLength?: number
  placeholder?: string
  /**
   * Show only when another question holds one of these values. Kept to a
   * single dependency deliberately: nested conditional logic in a 3-minute
   * survey is how you get people abandoning halfway.
   */
  showIf?: { questionId: string; equals: readonly string[] }
  /** Short header used for the spreadsheet column. */
  sheetHeader: string
}

export const OTHER_PREFIX = 'Other: '

export const SURVEY_QUESTIONS: readonly SurveyQuestion[] = [
  {
    id: 'tools_used',
    type: 'multi',
    prompt: 'Which parts of Submission Studio did you use?',
    required: true,
    options: ['Journal Finder', 'Manuscript Formatter'],
    sheetHeader: 'Tools Used',
  },
  {
    id: 'usefulness',
    type: 'scale',
    prompt: 'Overall, how useful was Submission Studio to you?',
    required: true,
    scaleMin: 1,
    scaleMax: 5,
    scaleLabels: { min: 'Not useful at all', max: 'Extremely useful' },
    sheetHeader: 'Usefulness (1-5)',
  },
  {
    id: 'time_saved',
    type: 'single',
    prompt: 'Compared with doing it yourself, what did it do to your time?',
    required: true,
    options: [
      'Saved me several hours',
      'Saved me about an hour',
      'Saved me a few minutes',
      'About the same either way',
      'Cost me more time than it saved',
      'I never used the output',
    ],
    sheetHeader: 'Time Effect',
  },
  {
    id: 'output_usable',
    type: 'single',
    prompt: 'How much of the output could you use as it came out?',
    help: 'Answer for the formatted manuscript, or for the journal shortlist if you only used the Finder.',
    required: true,
    options: [
      'All of it, no changes needed',
      'Most of it, minor fixes',
      'About half',
      'Very little, major rework',
      'None of it',
      'I did not get far enough to tell',
    ],
    sheetHeader: 'Output Usable',
  },
  {
    id: 'problems',
    type: 'multi',
    prompt: 'What came out wrong, or not at all?',
    help: 'Tick everything that applies. This is the question that decides what we fix first.',
    required: true,
    options: [
      'References or citation style',
      'Headings or section order',
      'Tables',
      'Figures or figure captions',
      'Title page, authors, or affiliations',
      'Abstract structure',
      'Word or character counts',
      'The journal shortlist did not fit my paper',
      'It failed or errored before finishing',
      'It was too slow',
      'Nothing went wrong',
    ],
    allowOther: true,
    sheetHeader: 'Problems',
  },
  {
    id: 'most_important_fix',
    type: 'text',
    prompt: 'What is the single most important thing we should fix or add?',
    help: 'One thing. If we only get to do one, what should it be?',
    required: true,
    minLength: 10,
    maxLength: 1000,
    placeholder: 'Be blunt. Vague praise does not help us build anything.',
    sheetHeader: 'Most Important Fix',
  },
  {
    id: 'fair_price',
    type: 'single',
    prompt: 'Setting aside whether you personally would buy it, what feels like a fair price per manuscript?',
    help: 'Your honest read on the value, not a commitment.',
    required: true,
    options: [
      'Under $10',
      '$10 to $25',
      '$25 to $50',
      'More than $50',
      'I would rather pay a monthly subscription',
    ],
    sheetHeader: 'Fair Price',
  },
] as const

/** Opt-in follow-up. Separate from the questions: it is permission, not data. */
export const FOLLOW_UP_LABEL =
  'You may email me about this feedback if you want more detail.'

// ---------------------------------------------------------------------------
// Answers
// ---------------------------------------------------------------------------

export type SurveyAnswer = string | string[] | number | null
export type SurveyAnswers = Record<string, SurveyAnswer>

export interface SurveySubmission {
  answers: SurveyAnswers
  followUpOk: boolean
  durationSeconds: number | null
}

export interface ValidationResult {
  ok: boolean
  /** Per-question message, keyed by question id. Empty when ok. */
  errors: Record<string, string>
  /** Cleaned answers, safe to persist. Only present when ok. */
  clean?: SurveyAnswers
}

function isVisible(q: SurveyQuestion, answers: SurveyAnswers): boolean {
  if (!q.showIf) return true
  const dep = answers[q.showIf.questionId]
  if (typeof dep !== 'string') return false
  return q.showIf.equals.includes(dep)
}

/**
 * Options a 'single'/'multi' answer is allowed to hold, including "Other: x".
 *
 * The write-in must carry actual text. Checking `length > OTHER_PREFIX.length`
 * was not enough: a single space clears it, and the multi-select path does not
 * trim, so ticking "Something else" and typing nothing stored the literal
 * `"Other:  "` as a real selection. That value then flowed into the sheet, into
 * the ranked problems list, and into the write-in block of the analytics, where
 * it reads as a genuine unanticipated finding. Trim before judging.
 */
function optionAllowed(q: SurveyQuestion, value: string): boolean {
  if (q.options?.includes(value)) return true
  if (q.allowOther && value.startsWith(OTHER_PREFIX) && value.slice(OTHER_PREFIX.length).trim() !== '') {
    return true
  }
  return false
}

/** Collapse the whitespace a write-in picks up, so `"Other:  x "` stores clean. */
function canonicalOption(q: SurveyQuestion, value: string): string {
  if (q.options?.includes(value)) return value
  if (value.startsWith(OTHER_PREFIX)) return OTHER_PREFIX + value.slice(OTHER_PREFIX.length).trim()
  return value
}

/**
 * Validate a submission against the question set.
 *
 * Runs on the SERVER as the authority, and is imported by the client purely to
 * render inline errors before the round trip. Client-side validation here is a
 * convenience; this same function deciding on the server is the actual rule.
 */
export function validateSurvey(input: SurveyAnswers): ValidationResult {
  const errors: Record<string, string> = {}
  const clean: SurveyAnswers = {}

  for (const q of SURVEY_QUESTIONS) {
    const visible = isVisible(q, input)
    if (!visible) {
      clean[q.id] = null
      continue
    }
    const raw = input[q.id]

    if (q.type === 'multi') {
      const arr = Array.isArray(raw) ? raw.filter((v): v is string => typeof v === 'string') : []
      const valid = arr.filter((v) => optionAllowed(q, v)).map((v) => canonicalOption(q, v))
      if (q.required && valid.length === 0) {
        // Covers both "nothing ticked" and "only an empty write-in ticked".
        errors[q.id] = arr.length > 0 ? 'Tell us what, or pick one of the options.' : 'Pick at least one.'
        continue
      }
      clean[q.id] = valid
      continue
    }

    if (q.type === 'scale') {
      const n = typeof raw === 'number' ? raw : Number(raw)
      const min = q.scaleMin ?? 1
      const max = q.scaleMax ?? 5
      if (!Number.isFinite(n) || n < min || n > max) {
        if (q.required) errors[q.id] = 'Pick a rating.'
        else clean[q.id] = null
        continue
      }
      clean[q.id] = Math.round(n)
      continue
    }

    if (q.type === 'single') {
      const v = typeof raw === 'string' ? raw.trim() : ''
      if (!v) {
        if (q.required) errors[q.id] = 'Pick one.'
        else clean[q.id] = null
        continue
      }
      if (!optionAllowed(q, v)) {
        errors[q.id] = v.startsWith(OTHER_PREFIX)
          ? 'Tell us what, or pick one of the options.'
          : 'Pick one of the listed options.'
        continue
      }
      clean[q.id] = canonicalOption(q, v)
      continue
    }

    // text
    const v = typeof raw === 'string' ? raw.trim() : ''
    if (!v) {
      if (q.required) errors[q.id] = 'This one is required.'
      else clean[q.id] = null
      continue
    }
    if (q.minLength && v.length < q.minLength) {
      errors[q.id] = `Please write at least ${q.minLength} characters.`
      continue
    }
    clean[q.id] = v.slice(0, q.maxLength ?? 2000)
  }

  const ok = Object.keys(errors).length === 0
  return ok ? { ok, errors, clean } : { ok, errors }
}

// ---------------------------------------------------------------------------
// Promoted columns + spreadsheet flattening
// ---------------------------------------------------------------------------

/**
 * Pulled out of the jsonb blob into its own column for indexing.
 *
 * Only `usefulness` survives here. The `role` and `willingness_to_pay`
 * questions were cut on 2026-07-26 (Kanwar), so promoting them would mean
 * writing null into two columns forever and inviting an analyst to segment on
 * a dimension that no longer exists. Their columns are dropped from migration
 * 031 for the same reason.
 */
export function promotedColumns(answers: SurveyAnswers): {
  usefulness: number | null
} {
  return {
    usefulness: typeof answers.usefulness === 'number' ? answers.usefulness : null,
  }
}

/** Multi-selects join with a semicolon so a cell stays sortable and splittable. */
export const MULTI_JOIN = '; '

function cellValue(answer: SurveyAnswer): string | number {
  if (answer === null || answer === undefined) return ''
  if (Array.isArray(answer)) return answer.join(MULTI_JOIN)
  return answer
}

/**
 * Fixed columns that precede the per-question ones.
 * Order here IS the sheet order; the Apps Script header is generated from
 * surveySheetHeaders() so the two cannot drift.
 */
const FIXED_HEADERS = [
  'Submitted At (UTC)',
  'Email',
  'Survey Version',
  'Granted Reset',
  'Duration (sec)',
  'Follow-up OK',
] as const

export function surveySheetHeaders(): string[] {
  return [...FIXED_HEADERS, ...SURVEY_QUESTIONS.map((q) => q.sheetHeader)]
}

export function surveySheetRow(input: {
  submittedAtIso: string
  email: string
  answers: SurveyAnswers
  grantedReset: boolean
  durationSeconds: number | null
  followUpOk: boolean
}): Array<string | number> {
  return [
    input.submittedAtIso,
    input.email,
    SURVEY_VERSION,
    input.grantedReset ? 'yes' : 'no',
    input.durationSeconds ?? '',
    input.followUpOk ? 'yes' : 'no',
    ...SURVEY_QUESTIONS.map((q) => cellValue(input.answers[q.id] ?? null)),
  ]
}

/** Questions visible given a partial answer set. Drives progress in the UI. */
export function visibleQuestions(answers: SurveyAnswers): SurveyQuestion[] {
  return SURVEY_QUESTIONS.filter((q) => isVisible(q, answers))
}

export function requiredRemaining(answers: SurveyAnswers): number {
  const { errors } = validateSurvey(answers)
  return Object.keys(errors).length
}
