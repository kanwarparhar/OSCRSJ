// Journal Finder v2 — manuscript assessment (2026-07-25).
//
// Turns a manuscript body into a ManuscriptProfile: a small set of study
// characteristics, each carrying the verbatim sentence that states it, plus a
// deterministically derived evidence level and percentile anchor.
//
// THE TRUST BOUNDARY IS HERE, AND IT IS CODE, NOT A PROMPT. The model is asked
// for a verbatim quote with every value, and `verifyQuote` then checks that the
// quote really occurs in the manuscript. A paraphrase, a "corrected" spelling or
// a merged sentence fails the check and the field is DROPPED (value nulled,
// quoteRejected set). The prompt asking nicely for verbatim quotes is not the
// guarantee; the substring check is. Everything downstream — anchor, ladder,
// what the author is shown — is a pure function of what survived that check.
//
// Everything except `extractProfile` is pure and exported for unit tests.

import type { ArticleType } from '@/lib/formatting/rulesSchema'
import { deepseekModel } from '@/lib/deepseekModel'
import {
  EDITABLE_PROFILE_FIELDS,
  MANUAL_DESIGN_BY_ARTICLE_TYPE,
  STUDY_DESIGNS,
  type EditableProfileField,
  type ManuscriptProfile,
  type ProfileEdits,
  type ProfileField,
  type SelfAssessment,
  type StudyDesign,
} from './profileTypes'

const DEEPSEEK_URL = 'https://api.deepseek.com/chat/completions'

/** Methods and results live early; conclusions live late. Middle is discussion. */
export const HEAD_WORDS = 9_000
export const TAIL_WORDS = 1_500

export const ASSESS_SYSTEM_PROMPT = `You extract verifiable study characteristics from an orthopedic manuscript. Respond with ONLY a JSON object matching the schema. Rules, in priority order:
1. For every non-null value you MUST provide "quote": a verbatim, character-exact excerpt (5-40 words) copied from the manuscript that states the fact. Do not paraphrase, correct spelling, or merge sentences.
2. If the manuscript does not explicitly state a fact, set value to null and quote to null. Never infer. Never estimate. A missing fact is the correct answer when the text is silent.
3. "confidence" is "high" only when the quote states the fact directly; "low" when interpretation was required.
4. sample_size is the number of patients/participants analyzed (not screened). follow_up_months converts stated follow-up to months. novelty_claim is the manuscript's OWN novelty sentence if one exists (e.g. "To our knowledge, this is the first reported case of...").`

const SCHEMA_HINT = `Schema:
{
  "study_design":   { "value": "rct|prospective_cohort|retrospective_comparative|case_control|case_series|case_report|systematic_review|meta_analysis|narrative_review|technical_note|basic_science|other|null", "quote": "string|null", "confidence": "high|low|null" },
  "sample_size":    { "value": "integer|null", "quote": "string|null", "confidence": "high|low|null" },
  "multicenter":    { "value": "boolean|null", "quote": "string|null", "confidence": "high|low|null" },
  "comparative":    { "value": "boolean|null", "quote": "string|null", "confidence": "high|low|null" },
  "follow_up_months": { "value": "number|null", "quote": "string|null", "confidence": "high|low|null" },
  "stats_reported": { "value": "boolean|null", "quote": "string|null", "confidence": "high|low|null" },
  "novelty_claim":  { "value": "string|null", "quote": "string|null", "confidence": "high|low|null" }
}`

// ---------------------------------------------------------------------------
// Quote verification — the guardrail the whole feature rests on
// ---------------------------------------------------------------------------

/**
 * Collapse whitespace runs to single spaces. No case folding and no punctuation
 * stripping: those would let a model "fix" the text and still pass, which is
 * exactly the failure this check exists to catch. Line wrapping is the only
 * difference we forgive, because .docx extraction introduces it on its own.
 */
export function normalizeForQuoteMatch(s: string): string {
  return s.replace(/\s+/g, ' ').trim()
}

/** True when `quote` genuinely occurs in `body` (modulo whitespace). */
export function verifyQuote(quote: string, body: string): boolean {
  const q = normalizeForQuoteMatch(quote)
  if (q.length === 0) return false
  return normalizeForQuoteMatch(body).includes(q)
}

const NULL_FIELD = <T>(): ProfileField<T> => ({ value: null, quote: null, confidence: null })

/**
 * Accept a model-supplied field only if its quote checks out against the body.
 * A value with no quote is dropped too — an unevidenced claim is exactly what
 * this product refuses to show.
 */
export function acceptField<T>(
  raw: { value?: unknown; quote?: unknown; confidence?: unknown } | null | undefined,
  body: string,
  coerce: (v: unknown) => T | null,
): ProfileField<T> {
  if (!raw || typeof raw !== 'object') return NULL_FIELD<T>()
  const value = coerce(raw.value)
  if (value === null) return NULL_FIELD<T>()

  const quote = typeof raw.quote === 'string' ? raw.quote : null
  if (!quote || !verifyQuote(quote, body)) {
    // The model asserted something it could not point at. Drop the value and
    // say so — a rejected quote is disclosed to the author, not swallowed.
    return { value: null, quote: null, confidence: null, quoteRejected: true }
  }
  const confidence = raw.confidence === 'high' ? 'high' : 'low'
  return { value, quote, confidence }
}

/* ------------------------------ coercions --------------------------------- */

const asDesign = (v: unknown): StudyDesign | null =>
  typeof v === 'string' && (STUDY_DESIGNS as readonly string[]).includes(v) ? (v as StudyDesign) : null

const asPositiveInt = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : null
}

const asNonNegativeNumber = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN
  return Number.isFinite(n) && n >= 0 ? n : null
}

const asBool = (v: unknown): boolean | null => (typeof v === 'boolean' ? v : null)

const asNonEmptyString = (v: unknown): string | null =>
  typeof v === 'string' && v.trim().length > 0 ? v.trim() : null

// ---------------------------------------------------------------------------
// Deterministic derivation
// ---------------------------------------------------------------------------

/**
 * Orthopedic level of evidence I–V from the study design.
 *
 * The rct downgrade to level 2 encodes the standard caveat that a small
 * single-centre trial is not a level-I trial. Designs that carry no level at all
 * (narrative review, technical note, bench work) return null rather than being
 * forced onto the scale — a level we invented would propagate into the anchor.
 */
export function deriveEvidenceLevel(
  design: StudyDesign | null,
  multicenter: boolean | null,
  sampleSize: number | null,
): 1 | 2 | 3 | 4 | 5 | null {
  switch (design) {
    case 'rct':
      return multicenter === false && sampleSize !== null && sampleSize < 100 ? 2 : 1
    case 'systematic_review':
    case 'meta_analysis':
      return 1
    case 'prospective_cohort':
      return 2
    case 'retrospective_comparative':
    case 'case_control':
      return 3
    case 'case_series':
      return 4
    case 'case_report':
      return 5
    default:
      return null
  }
}

/** Base percentile anchor for a level of evidence. Unknown design sits mid-field. */
export function baseAnchorForLevel(level: 1 | 2 | 3 | 4 | 5 | null): number {
  switch (level) {
    case 1:
      return 0.9
    case 2:
      return 0.7
    case 3:
      return 0.5
    case 4:
      return 0.35
    case 5:
      return 0.25
    default:
      return 0.5
  }
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))

/** Round to 4dp so the anchor stays a stable, comparable number across runs. */
const round4 = (n: number) => Math.round(n * 10_000) / 10_000

export const MAX_TEXT_ADJUSTMENT = 0.2
export const MAX_AUTHOR_SHIFT = 0.1

/**
 * Adjustments read off the VERIFIED profile only. Each is a study feature that
 * routinely moves what tier a paper is competitive in; the total is clamped so
 * no stack of small signals can outrun the design itself.
 */
export function deriveTextAdjustment(p: {
  design: StudyDesign | null
  sampleSize: number | null
  multicenter: boolean | null
  comparative: boolean | null
  followUpMonths: number | null
  statsReported: boolean | null
  noveltyQuote: string | null
}): number {
  let adj = 0
  if (p.multicenter === true) adj += 0.1
  if (p.sampleSize !== null && p.sampleSize >= 100) adj += 0.1
  if (p.noveltyQuote !== null && /first/i.test(p.noveltyQuote)) adj += 0.1
  if (p.comparative === true && p.statsReported === false) adj -= 0.1
  const shortFollowUpDesigns: StudyDesign[] = ['rct', 'prospective_cohort', 'retrospective_comparative', 'case_control']
  if (
    p.followUpMonths !== null &&
    p.followUpMonths < 12 &&
    p.design !== null &&
    shortFollowUpDesigns.includes(p.design)
  ) {
    adj -= 0.1
  }
  return clamp(adj, -MAX_TEXT_ADJUSTMENT, MAX_TEXT_ADJUSTMENT)
}

/**
 * The author's own read, bounded hard at ±0.10 — about one band. The author can
 * nudge the ladder; they cannot overrule the manuscript.
 */
export function deriveAuthorShift(sa: SelfAssessment | null): number {
  if (!sa) return 0
  let shift = 0
  if (sa.novelty === 'first_reported') shift += 0.05
  if (sa.novelty === 'adds_to_known') shift -= 0.05
  if (sa.strength === 'definitive_or_comparative') shift += 0.05
  if (sa.strength === 'negative_or_confirmatory') shift -= 0.05
  return clamp(shift, -MAX_AUTHOR_SHIFT, MAX_AUTHOR_SHIFT)
}

/**
 * Where the author rates the work above what the text supports. Recorded and
 * SHOWN, not silently corrected: the point is to tell an author their manuscript
 * does not yet say the thing they believe about it, which is actionable.
 * Detecting a disagreement does not cancel the shift — the clamp already bounds it.
 */
export function deriveDisagreements(
  sa: SelfAssessment | null,
  noveltyClaim: string | null,
  statsReported: boolean | null,
): string[] {
  const out: string[] = []
  if (!sa) return out
  if (sa.novelty === 'first_reported' && noveltyClaim === null) out.push('novelty')
  if (sa.strength === 'definitive_or_comparative' && statsReported !== true) out.push('strength')
  return out
}

/** Assemble the derived numbers onto an already-verified set of fields. */
export function finalizeProfile(
  fields: Pick<
    ManuscriptProfile,
    'design' | 'sampleSize' | 'multicenter' | 'comparative' | 'followUpMonths' | 'statsReported' | 'noveltyClaim'
  >,
  selfAssessment: SelfAssessment | null,
  extra: { selfReported: boolean; truncated: boolean; extractionError: string | null },
): ManuscriptProfile {
  const evidenceLevel = deriveEvidenceLevel(
    fields.design.value,
    fields.multicenter.value,
    fields.sampleSize.value,
  )
  const base = baseAnchorForLevel(evidenceLevel)
  const adjustment = deriveTextAdjustment({
    design: fields.design.value,
    sampleSize: fields.sampleSize.value,
    multicenter: fields.multicenter.value,
    comparative: fields.comparative.value,
    followUpMonths: fields.followUpMonths.value,
    statsReported: fields.statsReported.value,
    noveltyQuote: fields.noveltyClaim.quote,
  })
  const authorShift = deriveAuthorShift(selfAssessment)

  return {
    ...fields,
    evidenceLevel,
    anchor: round4(clamp(base + adjustment + authorShift, 0.1, 0.9)),
    authorShift: round4(authorShift),
    disagreements: deriveDisagreements(selfAssessment, fields.noveltyClaim.value, fields.statsReported.value),
    // Derived from the fields themselves rather than threaded in as a parameter,
    // so the list can never claim an edit the field does not carry.
    authorEditedFields: EDITABLE_PROFILE_FIELDS.filter(
      (k) => (fields as Record<string, ProfileField<unknown>>)[k]?.authorEdited === true,
    ),
    ...extra,
  }
}

// ---------------------------------------------------------------------------
// Author corrections
// ---------------------------------------------------------------------------

/** Per-field coercion for an author-supplied correction. Bad input ⇒ ignored. */
const EDIT_COERCIONS: Record<EditableProfileField, (v: unknown) => unknown | null> = {
  design: asDesign,
  sampleSize: asPositiveInt,
  comparative: asBool,
  multicenter: asBool,
  followUpMonths: asNonNegativeNumber,
  statsReported: asBool,
}

/**
 * Apply an author's corrections to an extracted profile and re-derive everything
 * downstream (evidence level, anchor, disagreements).
 *
 * A corrected field loses its quote and its confidence and gains `authorEdited`.
 * That is the whole point: we keep using the value, because the author knows
 * their own study better than a language model reading 9,000 words of it, but we
 * stop claiming we read it. An explicit null clears a field back to unknown —
 * the author's way of saying "you invented that."
 *
 * Pure. The caller persists the result.
 */
export function applyProfileEdits(
  profile: ManuscriptProfile,
  edits: ProfileEdits,
  selfAssessment: SelfAssessment | null,
): ManuscriptProfile {
  const fields = {
    design: profile.design,
    sampleSize: profile.sampleSize,
    multicenter: profile.multicenter,
    comparative: profile.comparative,
    followUpMonths: profile.followUpMonths,
    statsReported: profile.statsReported,
    noveltyClaim: profile.noveltyClaim,
  } as Record<string, ProfileField<unknown>>

  for (const key of EDITABLE_PROFILE_FIELDS) {
    if (!(key in edits)) continue
    const raw = edits[key]
    if (raw === null) {
      // Cleared back to unknown. Not an "edit" that feeds the anchor — an erasure.
      fields[key] = { value: null, quote: null, confidence: null, authorEdited: true }
      continue
    }
    const coerced = EDIT_COERCIONS[key](raw)
    if (coerced === null || coerced === undefined) continue // unparseable ⇒ leave as-is
    fields[key] = { value: coerced, quote: null, confidence: null, authorEdited: true }
  }

  return finalizeProfile(
    fields as unknown as Pick<
      ManuscriptProfile,
      'design' | 'sampleSize' | 'multicenter' | 'comparative' | 'followUpMonths' | 'statsReported' | 'noveltyClaim'
    >,
    selfAssessment,
    { selfReported: profile.selfReported, truncated: profile.truncated, extractionError: profile.extractionError },
  )
}

/** Coerce untrusted client JSON into a ProfileEdits. Unknown keys are dropped. */
export function parseProfileEdits(raw: unknown): ProfileEdits {
  if (!raw || typeof raw !== 'object') return {}
  const o = raw as Record<string, unknown>
  const out: ProfileEdits = {}
  for (const key of EDITABLE_PROFILE_FIELDS) {
    if (!(key in o)) continue
    const v = o[key]
    if (v === null) {
      out[key] = null
      continue
    }
    if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') out[key] = v
  }
  return out
}

/**
 * Manual (no-upload) mode. Design is mapped conservatively from the article type
 * the author declared, every field stays null and unquoted, and `selfReported`
 * tells the UI to label the whole card as unverified. Nothing is read, so
 * nothing may be presented as read.
 */
export function buildSelfReportedProfile(
  articleType: ArticleType,
  selfAssessment: SelfAssessment | null,
): ManuscriptProfile {
  const design: ProfileField<StudyDesign> = {
    value: MANUAL_DESIGN_BY_ARTICLE_TYPE[articleType] ?? 'other',
    quote: null,
    confidence: null,
  }
  return finalizeProfile(
    {
      design,
      sampleSize: NULL_FIELD<number>(),
      multicenter: NULL_FIELD<boolean>(),
      comparative: NULL_FIELD<boolean>(),
      followUpMonths: NULL_FIELD<number>(),
      statsReported: NULL_FIELD<boolean>(),
      noveltyClaim: NULL_FIELD<string>(),
    },
    selfAssessment,
    { selfReported: true, truncated: false, extractionError: null },
  )
}

/** An all-null verified profile — the honest output when extraction fails. */
export function buildEmptyProfile(
  selfAssessment: SelfAssessment | null,
  extra: { truncated: boolean; extractionError: string | null },
): ManuscriptProfile {
  return finalizeProfile(
    {
      design: NULL_FIELD<StudyDesign>(),
      sampleSize: NULL_FIELD<number>(),
      multicenter: NULL_FIELD<boolean>(),
      comparative: NULL_FIELD<boolean>(),
      followUpMonths: NULL_FIELD<number>(),
      statsReported: NULL_FIELD<boolean>(),
      noveltyClaim: NULL_FIELD<string>(),
    },
    selfAssessment,
    { selfReported: false, ...extra },
  )
}

// ---------------------------------------------------------------------------
// Truncation
// ---------------------------------------------------------------------------

/** First HEAD_WORDS + last TAIL_WORDS, joined by an elision marker. */
export function truncateForExtraction(body: string): { text: string; truncated: boolean } {
  const words = body.split(/\s+/).filter(Boolean)
  if (words.length <= HEAD_WORDS + TAIL_WORDS) return { text: body, truncated: false }
  const head = words.slice(0, HEAD_WORDS).join(' ')
  const tail = words.slice(-TAIL_WORDS).join(' ')
  return { text: `${head}\n\n[... middle of manuscript omitted ...]\n\n${tail}`, truncated: true }
}

// ---------------------------------------------------------------------------
// Extraction
// ---------------------------------------------------------------------------

export interface AssessOptions {
  apiKey?: string
  model?: string
  baseUrl?: string
  timeoutMs?: number
  /** Injected in tests so no unit test ever touches the network. */
  fetchImpl?: typeof fetch
}

async function callDeepSeek(
  userContent: string,
  apiKey: string,
  model: string,
  baseUrl: string,
  timeoutMs: number,
  fetchImpl: typeof fetch,
): Promise<{ content: string } | { error: string }> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetchImpl(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: ASSESS_SYSTEM_PROMPT },
          { role: 'user', content: userContent },
        ],
        response_format: { type: 'json_object' },
        temperature: 0,
        max_tokens: 2048,
      }),
      signal: controller.signal,
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      return { error: `DeepSeek HTTP ${res.status}: ${body.slice(0, 200)}` }
    }
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] }
    const content = json.choices?.[0]?.message?.content
    if (!content) return { error: 'Empty DeepSeek response' }
    return { content }
  } catch (e) {
    return { error: `DeepSeek request failed: ${e instanceof Error ? e.message : String(e)}` }
  } finally {
    clearTimeout(timer)
  }
}

/** Map a parsed model object onto verified profile fields. */
export function fieldsFromRaw(raw: Record<string, unknown>, body: string) {
  const f = (k: string) => raw[k] as { value?: unknown; quote?: unknown; confidence?: unknown } | undefined
  return {
    design: acceptField<StudyDesign>(f('study_design'), body, asDesign),
    sampleSize: acceptField<number>(f('sample_size'), body, asPositiveInt),
    multicenter: acceptField<boolean>(f('multicenter'), body, asBool),
    comparative: acceptField<boolean>(f('comparative'), body, asBool),
    followUpMonths: acceptField<number>(f('follow_up_months'), body, asNonNegativeNumber),
    statsReported: acceptField<boolean>(f('stats_reported'), body, asBool),
    noveltyClaim: acceptField<string>(f('novelty_claim'), body, asNonEmptyString),
  }
}

/**
 * Extract a verified profile from a manuscript body.
 *
 * Degradation is never fatal: a missing key, two bad JSON responses or a network
 * failure all produce an all-null profile carrying `extractionError`, which the
 * UI discloses. A Finder run that says "we could not read this" is a usable
 * answer; one that invents a study design is not.
 */
export async function extractProfile(
  body: string,
  selfAssessment: SelfAssessment | null,
  opts: AssessOptions = {},
): Promise<ManuscriptProfile> {
  const apiKey = opts.apiKey ?? process.env.DEEPSEEK_API_KEY ?? ''
  // Resolved per call so an env change lands on the next cold start.
  const model = opts.model ?? deepseekModel()
  const baseUrl = opts.baseUrl ?? DEEPSEEK_URL
  const timeoutMs = opts.timeoutMs ?? 40_000
  const fetchImpl = opts.fetchImpl ?? fetch

  const { text, truncated } = truncateForExtraction(body)

  if (!apiKey) {
    return buildEmptyProfile(selfAssessment, { truncated, extractionError: 'Missing DEEPSEEK_API_KEY' })
  }

  // Quotes are verified against the text we actually SENT. Verifying against the
  // full body would let a quote from the omitted middle pass a check the model
  // could not honestly have made.
  const basePrompt = `${SCHEMA_HINT}\n\nManuscript:\n${text}`
  let lastError = ''

  for (let attempt = 0; attempt < 2; attempt++) {
    const userContent =
      attempt === 0 ? basePrompt : `${basePrompt}\n\nYour previous response was not valid JSON (${lastError}). Respond with ONLY the JSON object.`
    const res = await callDeepSeek(userContent, apiKey, model, baseUrl, timeoutMs, fetchImpl)
    if ('error' in res) {
      lastError = res.error
      continue
    }
    try {
      const parsed = JSON.parse(res.content) as Record<string, unknown>
      return finalizeProfile(fieldsFromRaw(parsed, text), selfAssessment, {
        selfReported: false,
        truncated,
        extractionError: null,
      })
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e)
    }
  }

  return buildEmptyProfile(selfAssessment, {
    truncated,
    extractionError: `Could not read the manuscript structure (${lastError}).`,
  })
}
