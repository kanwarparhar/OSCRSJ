// Reference parsing via DeepSeek (Sushant, Session B). Free-text reference
// strings → CSL-JSON. Mirrors the renderer's aiExtractBody client: a plain
// HTTPS call (DeepSeek is OpenAI-compatible — no SDK), deepseek-chat, JSON
// output mode, temperature 0 for maximum determinism. This is UNDERSTANDING
// ONLY: the model segments each citation into fields and NEVER invents
// bibliographic data — verify.ts confirms every field against Crossref/PubMed.
// Every response is zod-validated; on failure we retry once, then degrade to a
// deterministic fallback rather than trust malformed output.

import { z } from 'zod'
import type { CslReference } from '../types'

const DEEPSEEK_URL = 'https://api.deepseek.com/chat/completions'
const DEFAULT_MODEL = 'deepseek-chat'
const BATCH_SIZE = 20

// DeepSeek pricing (USD per 1M tokens) — for the cost estimate only; rates drift.
const PRICE_INPUT_PER_M = 0.27
const PRICE_OUTPUT_PER_M = 1.1

const parsedRefSchema = z
  .object({
    index: z.number().int(),
    type: z.string().nullable().default('article-journal'),
    title: z.string().nullable(),
    authors: z
      .array(z.object({ family: z.string().default(''), given: z.string().default('') }))
      .default([]),
    containerTitle: z.string().nullable(),
    volume: z.string().nullable(),
    issue: z.string().nullable(),
    page: z.string().nullable(),
    year: z.string().nullable(),
    doi: z.string().nullable(),
    pmid: z.string().nullable(),
  })
  .strip()

const responseSchema = z.object({ references: z.array(parsedRefSchema) })

export interface ParseUsage {
  promptTokens: number
  completionTokens: number
  estCostUsd: number
}

export interface ParseResult {
  ok: boolean
  references: CslReference[]
  usage: ParseUsage
  /** true when one or more batches fell back to the deterministic parser. */
  degraded: boolean
  error?: string
}

const SYSTEM_PROMPT = `You are a meticulous bibliographic parser for a medical journal. You receive a numbered list of free-text reference citations (Vancouver/AMA/NLM style, exactly as an author typed them). Your ONLY job is to SEGMENT each citation into structured CSL-JSON fields. You are NOT a researcher.

ABSOLUTE RULES:
- NEVER invent, correct, complete, or guess any field. Copy values verbatim from the citation text. If a field is not literally present, use null.
- Do NOT look up DOIs, PMIDs, or missing page numbers — that verification happens downstream against Crossref/PubMed.
- Preserve author family/given exactly as written; "et al." is not an author.

For EACH input reference return an object:
{"index": <the given number>, "type": "article-journal", "title": <string|null>, "authors": [{"family": "...", "given": "..."}], "containerTitle": <journal name string|null>, "volume": <string|null>, "issue": <string|null>, "page": <string|null>, "year": <string|null>, "doi": <string|null>, "pmid": <string|null>}

OUTPUT: Return ONLY a single JSON object: {"references": [ ... ]}. No markdown fences, no commentary.`

function buildUserPrompt(batch: { index: number; text: string }[]): string {
  const lines = batch.map((b) => `${b.index}. ${b.text}`).join('\n')
  return `Parse these references into CSL-JSON per the rules.\n\n${lines}`
}

/** Deterministic degrade: keep the raw string as the title so nothing is lost. */
function fallbackRef(index: number, text: string): CslReference {
  return {
    id: String(index),
    type: 'article-journal',
    title: text,
    authors: [],
    containerTitle: null,
    volume: null,
    issue: null,
    page: null,
    year: text.match(/\b(19|20)\d{2}\b/)?.[0] ?? null,
    doi: text.match(/10\.\d{4,9}\/[^\s"]+/)?.[0] ?? null,
    pmid: null,
  }
}

async function callDeepSeek(
  batch: { index: number; text: string }[],
  apiKey: string,
  model: string,
  baseUrl: string,
  timeoutMs: number,
): Promise<{ content: string; prompt: number; completion: number } | { error: string }> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: buildUserPrompt(batch) },
        ],
        response_format: { type: 'json_object' },
        temperature: 0,
        max_tokens: 8192,
      }),
      signal: controller.signal,
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      return { error: `DeepSeek HTTP ${res.status}: ${body.slice(0, 200)}` }
    }
    const json = (await res.json()) as {
      choices?: { message?: { content?: string } }[]
      usage?: { prompt_tokens?: number; completion_tokens?: number }
    }
    const content = json.choices?.[0]?.message?.content
    if (!content) return { error: 'Empty DeepSeek response' }
    return {
      content,
      prompt: json.usage?.prompt_tokens ?? 0,
      completion: json.usage?.completion_tokens ?? 0,
    }
  } catch (e) {
    return { error: `DeepSeek request failed: ${e instanceof Error ? e.message : String(e)}` }
  } finally {
    clearTimeout(timer)
  }
}

function toCsl(r: z.infer<typeof parsedRefSchema>): CslReference {
  return {
    id: String(r.index),
    type: r.type ?? 'article-journal',
    title: r.title,
    authors: r.authors.filter((a) => a.family || a.given),
    containerTitle: r.containerTitle,
    volume: r.volume,
    issue: r.issue,
    page: r.page,
    year: r.year,
    doi: r.doi ? r.doi.replace(/^https?:\/\/(dx\.)?doi\.org\//, '') : null,
    pmid: r.pmid,
  }
}

export interface ParseOptions {
  apiKey?: string
  model?: string
  baseUrl?: string
  timeoutMs?: number
}

/** Parse raw reference strings into CSL-JSON, batched ≤20 per DeepSeek call. */
export async function parseReferences(raw: string[], opts: ParseOptions = {}): Promise<ParseResult> {
  const apiKey = opts.apiKey ?? process.env.DEEPSEEK_API_KEY ?? ''
  const model = opts.model ?? DEFAULT_MODEL
  const baseUrl = opts.baseUrl ?? DEEPSEEK_URL
  const timeoutMs = opts.timeoutMs ?? 120_000

  const indexed = raw.map((text, i) => ({ index: i + 1, text: text.trim() })).filter((r) => r.text)
  const usage: ParseUsage = { promptTokens: 0, completionTokens: 0, estCostUsd: 0 }

  if (!apiKey) {
    return {
      ok: false,
      references: indexed.map((r) => fallbackRef(r.index, r.text)),
      usage,
      degraded: true,
      error: 'Missing DEEPSEEK_API_KEY',
    }
  }

  const out: CslReference[] = []
  let degraded = false
  let firstError: string | undefined

  for (let start = 0; start < indexed.length; start += BATCH_SIZE) {
    const batch = indexed.slice(start, start + BATCH_SIZE)
    let parsed: CslReference[] | null = null

    for (let attempt = 0; attempt < 2 && !parsed; attempt++) {
      const r = await callDeepSeek(batch, apiKey, model, baseUrl, timeoutMs)
      if ('error' in r) {
        firstError ??= r.error
        continue
      }
      usage.promptTokens += r.prompt
      usage.completionTokens += r.completion
      try {
        const validated = responseSchema.parse(JSON.parse(r.content))
        // keep only the indices we asked for; map by index
        const byIndex = new Map(validated.references.map((x) => [x.index, x]))
        parsed = batch.map((b) => {
          const hit = byIndex.get(b.index)
          return hit ? toCsl(hit) : fallbackRef(b.index, b.text)
        })
      } catch (e) {
        firstError ??= `validation failed: ${e instanceof Error ? e.message : String(e)}`
      }
    }

    if (!parsed) {
      degraded = true
      parsed = batch.map((b) => fallbackRef(b.index, b.text))
    }
    out.push(...parsed)
  }

  usage.estCostUsd =
    (usage.promptTokens / 1e6) * PRICE_INPUT_PER_M +
    (usage.completionTokens / 1e6) * PRICE_OUTPUT_PER_M

  return { ok: !degraded, references: out, usage, degraded, error: firstError }
}
