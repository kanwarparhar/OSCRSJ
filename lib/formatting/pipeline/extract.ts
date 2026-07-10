// Title-page metadata extraction via DeepSeek (Sushant, Session C). Understanding
// only — extracts verbatim front-matter fields; never invents. Graceful on
// blinded manuscripts (returns nulls → the render stage flags "provide a title
// page" instead of fabricating authors). Mirrors references/parse.ts.

import { z } from 'zod'
import type { ExtractedTitlePageData } from '../types'

const DEEPSEEK_URL = 'https://api.deepseek.com/chat/completions'
const PRICE_INPUT_PER_M = 0.27
const PRICE_OUTPUT_PER_M = 1.1

const schema = z.object({
  title: z.string().nullable(),
  runningTitle: z.string().nullable(),
  authors: z
    .array(
      z.object({
        name: z.string(),
        degrees: z.string().nullable(),
        affiliationRefs: z.array(z.number()).default([]),
        orcid: z.string().nullable(),
      }),
    )
    .default([]),
  affiliations: z.array(z.string()).default([]),
  correspondingAuthor: z
    .object({
      name: z.string().nullable(),
      email: z.string().nullable(),
      address: z.string().nullable(),
      phone: z.string().nullable(),
    })
    .nullable(),
  keywords: z.array(z.string()).default([]),
})

const SYSTEM = `You extract the title-page metadata from an orthopedic manuscript's front matter. UNDERSTANDING ONLY: copy values verbatim; if a field is not present, use null (or []). NEVER invent authors, affiliations, emails, or a title. Many manuscripts are blinded (author info removed) — in that case return null/empty for author fields. Return ONLY JSON: {"title":string|null,"runningTitle":string|null,"authors":[{"name":"...","degrees":string|null,"affiliationRefs":[1],"orcid":string|null}],"affiliations":["..."],"correspondingAuthor":{"name":..,"email":..,"address":..,"phone":..}|null,"keywords":["..."]}. No prose, no fences.`

const EMPTY: ExtractedTitlePageData = {
  title: null,
  runningTitle: null,
  authors: [],
  affiliations: [],
  correspondingAuthor: null,
  keywords: [],
}

export interface ExtractResult {
  data: ExtractedTitlePageData
  usage: { promptTokens: number; completionTokens: number; estCostUsd: number }
  degraded: boolean
}

export async function extractTitlePage(
  frontText: string,
  opts: { apiKey?: string; model?: string; baseUrl?: string; timeoutMs?: number } = {},
): Promise<ExtractResult> {
  const apiKey = opts.apiKey ?? process.env.DEEPSEEK_API_KEY ?? ''
  const usage = { promptTokens: 0, completionTokens: 0, estCostUsd: 0 }
  if (!apiKey) return { data: EMPTY, usage, degraded: true }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 60_000)
  try {
    const res = await fetch(opts.baseUrl ?? DEEPSEEK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: opts.model ?? 'deepseek-chat',
        messages: [
          { role: 'system', content: SYSTEM },
          { role: 'user', content: `Manuscript front matter:\n\n${frontText.slice(0, 6000)}` },
        ],
        response_format: { type: 'json_object' },
        temperature: 0,
        max_tokens: 2048,
      }),
      signal: controller.signal,
    })
    if (!res.ok) return { data: EMPTY, usage, degraded: true }
    const json = (await res.json()) as {
      choices?: { message?: { content?: string } }[]
      usage?: { prompt_tokens?: number; completion_tokens?: number }
    }
    usage.promptTokens = json.usage?.prompt_tokens ?? 0
    usage.completionTokens = json.usage?.completion_tokens ?? 0
    usage.estCostUsd =
      (usage.promptTokens / 1e6) * PRICE_INPUT_PER_M +
      (usage.completionTokens / 1e6) * PRICE_OUTPUT_PER_M
    const content = json.choices?.[0]?.message?.content
    if (!content) return { data: EMPTY, usage, degraded: true }
    const parsed = schema.parse(JSON.parse(content))
    return {
      data: {
        title: parsed.title,
        runningTitle: parsed.runningTitle,
        authors: parsed.authors.map((a) => ({
          name: a.name,
          degrees: a.degrees,
          affiliationRefs: a.affiliationRefs,
          isCorresponding: false,
          orcid: a.orcid,
        })),
        affiliations: parsed.affiliations,
        correspondingAuthor: parsed.correspondingAuthor,
        keywords: parsed.keywords,
      },
      usage,
      degraded: false,
    }
  } catch {
    return { data: EMPTY, usage, degraded: true }
  } finally {
    clearTimeout(timer)
  }
}
