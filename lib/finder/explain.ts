// Journal Finder v1 — optional "why this fits" one-liners (Sushant, Session 2).
//
// STRICTLY optional and OFF by default. DeepSeek is used ONLY to phrase a single
// human sentence per top result — NEVER to score, rank, or gate anything (that
// is all deterministic in ./match.ts, per the OSCRSJ AI-Layer doctrine and the
// build brief §8.2). If the flag is off, the key is missing, or the call fails,
// every result simply gets `null` and the UI shows no explanation line. The
// Finder is fully functional without this.
//
// Gate: set FINDER_EXPLAIN_ENABLED=1 AND DEEPSEEK_API_KEY to turn it on.

import type { JournalScore, ManuscriptStats } from './types'
import { describeCheck } from './match'

const DEEPSEEK_URL = 'https://api.deepseek.com/chat/completions'
const MODEL = 'deepseek-chat'
const TIMEOUT_MS = 8_000
/** Only ever explain the strongest few results — cost + latency control. */
const MAX_EXPLANATIONS = 3

export function explainEnabled(): boolean {
  return process.env.FINDER_EXPLAIN_ENABLED === '1' && !!process.env.DEEPSEEK_API_KEY
}

function factLine(stats: ManuscriptStats, s: JournalScore): string {
  const checks = s.checks.map(describeCheck).join('; ') || 'no limit conflicts'
  const scope = stats.subspecialty ?? 'unspecified subspecialty'
  return `Journal: ${s.name}. Article type: ${stats.articleType}. Subspecialty: ${scope}. Bucket: ${s.bucket}. Constraint deltas: ${checks}.`
}

/**
 * Best-effort one sentence explaining why a manuscript fits (or nearly fits) a
 * journal, grounded ONLY in the deterministic facts we pass in. Never throws;
 * returns null on any failure. Model output is treated as untrusted prose —
 * trimmed, length-capped, no markup.
 */
async function explainOne(stats: ManuscriptStats, s: JournalScore): Promise<string | null> {
  const apiKey = process.env.DEEPSEEK_API_KEY
  if (!apiKey) return null

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(DEEPSEEK_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
      signal: controller.signal,
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.2,
        max_tokens: 60,
        messages: [
          {
            role: 'system',
            content:
              'You explain, in ONE plain sentence (max 24 words), why a manuscript fits a target journal. ' +
              'Use ONLY the facts given. State no facts not provided. No hype, no markup, no journal endorsement.',
          },
          { role: 'user', content: factLine(stats, s) },
        ],
      }),
    })
    if (!res.ok) return null
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] }
    const text = data.choices?.[0]?.message?.content?.trim()
    if (!text) return null
    return text.replace(/\s+/g, ' ').slice(0, 220)
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Attach `explanation` strings to the top few eligible results, in place, when
 * enabled. Mutates + returns the same array. No-op (leaves explanation null)
 * when disabled. Runs the calls concurrently and swallows all failures.
 */
export async function attachExplanations(
  stats: ManuscriptStats,
  results: JournalScore[],
): Promise<JournalScore[]> {
  if (!explainEnabled()) return results
  const targets = results.filter((r) => r.eligible).slice(0, MAX_EXPLANATIONS)
  await Promise.all(
    targets.map(async (r) => {
      r.explanation = await explainOne(stats, r)
    }),
  )
  return results
}
