// Methodological quality grading — the graded extraction call (2026-07-26).
//
// THE TRUST BOUNDARY IS CODE, NOT A PROMPT. The model is asked to judge each
// instrument item and to copy out the sentence behind the judgement. Then
// `verifyQuote` checks that the sentence genuinely occurs in the manuscript we
// sent. A paraphrase, a tidied-up quote or an invented one fails that check and
// the item is forced to `not_assessable` — the verdict is DISCARDED, not
// downgraded, because a judgement whose evidence evaporated is not a weaker
// judgement, it is no judgement. Asking nicely for verbatim quotes is not the
// guarantee; the substring check is.
//
// ONE CALL, NOT PER ITEM. The whole instrument plus the readiness checklist is
// scored in a single request: twenty-four separate calls would cost twenty-four
// times as much, take twenty-four times as long, and give the model twenty-four
// chances to hallucinate independently.
//
// DEGRADATION IS NEVER FATAL. Two bad JSON responses, a missing key or a network
// failure all produce a MethodologyScore carrying `gradingError` and
// `normalized: null`. The caller says "we could not grade this", the ladder
// anchor is untouched, and the product behaves exactly as it did before this
// feature existed. That is the whole contract.
//
// WHY THE HELPERS BELOW ARE DUPLICATED FROM lib/finder/assess.ts. They are
// deliberately copied rather than imported, because lib/quality/ must not depend
// on the Finder (see types.ts). Three small pure functions are a cheap price for
// a library OSCRSJ's own submission intake can import without dragging the
// Studio in behind it. tests/quality-extract.test.ts imports both copies and
// asserts they agree, so the duplication cannot silently drift.

import { deepseekModel } from '@/lib/deepseekModel'
import { INSTRUMENTS } from './instruments'
import { gradingErrorScore, scoreInstrument, selectInstrument } from './score'
import {
  READINESS_CRITERIA,
  READINESS_GATES,
  emptyReadiness,
  type InstrumentDef,
  type ItemVerdict,
  type MethodologyScore,
  type RawGradedItem,
  type ReadinessChecklist,
  type ReadinessGate,
  type StudyDesign,
} from './types'

const DEEPSEEK_URL = 'https://api.deepseek.com/chat/completions'

/** Methods and results live early; conclusions live late. Middle is discussion. */
export const HEAD_WORDS = 9_000
export const TAIL_WORDS = 1_500

/* -------------------------------------------------------------------------- */
/* Quote verification (mirror of lib/finder/assess.ts — see header)            */
/* -------------------------------------------------------------------------- */

/**
 * Collapse whitespace runs to single spaces. No case folding and no punctuation
 * stripping: those would let a model "fix" the text and still pass, which is
 * exactly the failure this check exists to catch. Line wrapping is the only
 * difference forgiven, because .docx extraction introduces it on its own.
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

/** First HEAD_WORDS + last TAIL_WORDS, joined by an elision marker. */
export function truncateForExtraction(body: string): { text: string; truncated: boolean } {
  const words = body.split(/\s+/).filter(Boolean)
  if (words.length <= HEAD_WORDS + TAIL_WORDS) return { text: body, truncated: false }
  const head = words.slice(0, HEAD_WORDS).join(' ')
  const tail = words.slice(-TAIL_WORDS).join(' ')
  return { text: `${head}\n\n[... middle of manuscript omitted ...]\n\n${tail}`, truncated: true }
}

/* -------------------------------------------------------------------------- */
/* Prompt                                                                      */
/* -------------------------------------------------------------------------- */

export const GRADING_SYSTEM_PROMPT = `You appraise an orthopedic manuscript against a published methodological quality instrument. Respond with ONLY a JSON object matching the schema. Rules, in priority order:
1. For each listed item, decide "met", "partial", "not_met", or "not_assessable".
2. For any verdict other than "not_assessable" you MUST supply "quote": a verbatim excerpt of 5-40 words copied CHARACTER-EXACT from the manuscript that justifies the verdict. Do not paraphrase, do not correct spelling, do not merge sentences, do not join text from different places.
3. If the manuscript does not let you judge an item, return "not_assessable" with "quote": null. This is the CORRECT answer and is never penalised. Never guess a verdict to avoid leaving one blank.
4. "not_met" and "not_assessable" are different and the difference matters. "not_met" means the manuscript is SILENT on something it should have reported — you looked and it is not there. "not_assessable" means you CANNOT TELL from the text you were given, for example because the relevant section was omitted.
5. "partial" means the item is addressed but incompletely or inadequately, and it requires a quote like any other judged verdict.
6. Readiness gates are separate and binary: "present": true only with a verbatim quote stating it, otherwise "present": false with "quote": null.`

function schemaHint(def: InstrumentDef): string {
  const itemLines = def.items.map((i) => `  - ${i.id}: ${i.criterion}`).join('\n')
  const readinessLines = READINESS_GATES.map((g) => `  - ${g}: ${READINESS_CRITERIA[g]}`).join('\n')

  const instrumentBlock =
    def.items.length > 0
      ? `Instrument: ${def.name}
Items to judge:
${itemLines}
`
      : `Instrument: none applies to this study design. Return "items": [].
`

  return `${instrumentBlock}
Readiness gates to check:
${readinessLines}

Schema:
{
  "items": [ { "id": "<one of the item ids above>", "verdict": "met|partial|not_met|not_assessable", "quote": "string|null" } ],
  "readiness": {
${READINESS_GATES.map((g) => `    "${g}": { "present": true|false, "quote": "string|null" }`).join(',\n')}
  }
}`
}

/* -------------------------------------------------------------------------- */
/* Response parsing                                                            */
/* -------------------------------------------------------------------------- */

const VERDICTS: readonly ItemVerdict[] = ['met', 'partial', 'not_met', 'not_assessable']

const asVerdict = (v: unknown): ItemVerdict =>
  typeof v === 'string' && (VERDICTS as readonly string[]).includes(v) ? (v as ItemVerdict) : 'not_assessable'

export interface ParsedGrading {
  rawItems: RawGradedItem[]
  readiness: ReadinessChecklist
  /** Verdicts discarded because their quote could not be found in the manuscript. */
  quoteRejections: number
}

/**
 * Map a parsed model object onto verified verdicts.
 *
 * Every non-`not_assessable` verdict must survive the substring check or it is
 * forced to `not_assessable` with its quote dropped. The rejection count is
 * returned so the surface can disclose "we discarded N unverifiable findings"
 * rather than silently showing a thinner instrument.
 */
export function parseGradingResponse(
  parsed: Record<string, unknown>,
  def: InstrumentDef,
  sentText: string,
): ParsedGrading {
  const validIds = new Set(def.items.map((i) => i.id))
  const rawItems: RawGradedItem[] = []
  let quoteRejections = 0

  const rawList = Array.isArray(parsed.items) ? parsed.items : []
  for (const entry of rawList) {
    if (!entry || typeof entry !== 'object') continue
    const e = entry as { id?: unknown; verdict?: unknown; quote?: unknown }
    const id = typeof e.id === 'string' ? e.id : null
    if (id === null || !validIds.has(id)) continue

    const verdict = asVerdict(e.verdict)
    if (verdict === 'not_assessable') {
      rawItems.push({ id, verdict: 'not_assessable', quote: null })
      continue
    }

    const quote = typeof e.quote === 'string' ? e.quote : null
    if (!quote || !verifyQuote(quote, sentText)) {
      // The model judged something it could not point at. Discard the judgement.
      quoteRejections++
      rawItems.push({ id, verdict: 'not_assessable', quote: null })
      continue
    }
    rawItems.push({ id, verdict, quote })
  }

  const readiness = emptyReadiness()
  const rawReadiness =
    parsed.readiness && typeof parsed.readiness === 'object'
      ? (parsed.readiness as Record<string, unknown>)
      : {}

  for (const gate of READINESS_GATES) {
    const entry = rawReadiness[gate]
    if (!entry || typeof entry !== 'object') continue
    const e = entry as { present?: unknown; quote?: unknown }
    if (e.present !== true) continue
    const quote = typeof e.quote === 'string' ? e.quote : null
    if (!quote || !verifyQuote(quote, sentText)) {
      // An unevidenced "yes, they declared their funding" is worse than a "no":
      // it tells an author a desk-reject gate is cleared when it may not be.
      quoteRejections++
      continue
    }
    readiness[gate as ReadinessGate] = { present: true, quote }
  }

  return { rawItems, readiness, quoteRejections }
}

/* -------------------------------------------------------------------------- */
/* The call                                                                    */
/* -------------------------------------------------------------------------- */

export interface GradingOptions {
  apiKey?: string
  model?: string
  baseUrl?: string
  timeoutMs?: number
  /** Injected in tests so no unit test ever touches the network. */
  fetchImpl?: typeof fetch
}

export interface GradingResult {
  score: MethodologyScore
  readiness: ReadinessChecklist
  truncated: boolean
  quoteRejections: number
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
          { role: 'system', content: GRADING_SYSTEM_PROMPT },
          { role: 'user', content: userContent },
        ],
        response_format: { type: 'json_object' },
        temperature: 0,
        max_tokens: 4096,
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

/**
 * Grade a manuscript against the instrument its design selects.
 *
 * The call is made even when no instrument applies, because the readiness gates
 * are design-independent: a narrative review still needs a conflict-of-interest
 * statement, and having the checklist appear for some designs and silently
 * vanish for others would read as a bug rather than as a doctrine.
 */
export async function extractMethodology(
  body: string,
  design: StudyDesign | null,
  comparative: boolean | null,
  opts: GradingOptions = {},
): Promise<GradingResult> {
  const def = selectInstrument(design, comparative)
  const apiKey = opts.apiKey ?? process.env.DEEPSEEK_API_KEY ?? ''
  // Resolved per call so an env change lands on the next cold start.
  const model = opts.model ?? deepseekModel()
  const baseUrl = opts.baseUrl ?? DEEPSEEK_URL
  const timeoutMs = opts.timeoutMs ?? 40_000
  const fetchImpl = opts.fetchImpl ?? fetch

  const { text, truncated } = truncateForExtraction(body)
  const fail = (message: string): GradingResult => ({
    score: def.id === 'NONE' ? scoreInstrument(INSTRUMENTS.NONE, []) : gradingErrorScore(def, message),
    readiness: emptyReadiness(),
    truncated,
    quoteRejections: 0,
  })

  if (!apiKey) return fail('Missing DEEPSEEK_API_KEY')

  // Quotes are verified against the text actually SENT. Verifying against the
  // full body would let a quote from the omitted middle pass a check the model
  // could not honestly have made.
  const basePrompt = `${schemaHint(def)}\n\nManuscript:\n${text}`
  let lastError = ''

  for (let attempt = 0; attempt < 2; attempt++) {
    const userContent =
      attempt === 0
        ? basePrompt
        : `${basePrompt}\n\nYour previous response was not valid JSON (${lastError}). Respond with ONLY the JSON object.`
    const res = await callDeepSeek(userContent, apiKey, model, baseUrl, timeoutMs, fetchImpl)
    if ('error' in res) {
      lastError = res.error
      continue
    }
    try {
      const parsed = JSON.parse(res.content) as Record<string, unknown>
      const { rawItems, readiness, quoteRejections } = parseGradingResponse(parsed, def, text)
      return { score: scoreInstrument(def, rawItems), readiness, truncated, quoteRejections }
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e)
    }
  }

  return fail(`Could not grade this manuscript (${lastError}).`)
}
