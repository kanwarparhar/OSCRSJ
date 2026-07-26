// The one place the DeepSeek model name is written down (2026-07-25).
//
// WHY THIS FILE EXISTS. On 2026-07-25 a live end-to-end run of the Finder v2
// assessment came back with every field null and this disclosed error:
//
//   DeepSeek HTTP 400: "The supported API model names are deepseek-v4-pro or
//   deepseek-v4-flash, but you passed deepseek-chat."
//
// DeepSeek retired `deepseek-chat`, and FOUR call sites had the string hardcoded
// independently: the formatter's title-page extractor, the formatter's reference
// parser, the Finder's assessment extractor, and the Finder's (flag-gated)
// explanation writer. So every DeepSeek-backed feature in Submission Studio was
// failing in production at once, each degrading quietly in its own way. The
// reference parser's failure had already been observed and misfiled as
// "⚠️ Unverified — may be transient (DeepSeek variance)" during the Session 100
// QA pass; it was not transient.
//
// This is exactly the failure mode the repo's constant-fix convention exists to
// prevent, so the constant now lives once and is imported everywhere.
//
// CHANGING THE MODEL. Set DEEPSEEK_MODEL in the environment to override without
// a deploy. `deepseek-v4-flash` is the default because it is the cost and
// latency successor to `deepseek-chat`, the model this product's per-manuscript
// cost was measured against (~$0.0014). If extraction quality proves weak on
// real manuscripts, `deepseek-v4-pro` is a one-variable change in Vercel.

/** Valid model names as reported by the API on 2026-07-25. */
export const DEEPSEEK_MODELS = ['deepseek-v4-flash', 'deepseek-v4-pro'] as const

export const DEEPSEEK_DEFAULT_MODEL = 'deepseek-v4-flash'

/**
 * The model every DeepSeek call should use. Resolved at call time rather than
 * module load so a serverless instance picks up an env change on its next cold
 * start; an unrecognised value falls back to the default rather than shipping a
 * 400 to a user.
 */
export function deepseekModel(): string {
  const fromEnv = process.env.DEEPSEEK_MODEL?.trim()
  if (fromEnv && (DEEPSEEK_MODELS as readonly string[]).includes(fromEnv)) return fromEnv
  return DEEPSEEK_DEFAULT_MODEL
}
