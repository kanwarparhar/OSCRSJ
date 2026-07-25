// ============================================================
// DeepSeek account balance
// ============================================================
// DeepSeek exposes exactly one account-level endpoint: GET /user/balance
// (Bearer ${DEEPSEEK_API_KEY}). There is NO usage-history or spend API, so
// https://platform.deepseek.com/usage cannot be read programmatically and the
// figure on that page cannot be mirrored directly.
//
// What we do instead, and why it is arguably better:
//
//   * Our own per-job token accounting (lib/formatting/pipeline/run.ts writes
//     report.cost = { deepseekTokens, usd }) gives ESTIMATED spend that is
//     attributable -- per job, per journal, per day. The dashboard number is
//     not attributable to anything.
//   * Differencing this balance day over day gives ACTUAL spend, including any
//     usage from outside the Studio, and catches drift between DeepSeek's real
//     billing and our hardcoded per-token rates (parse.ts PRICE_INPUT_PER_M /
//     PRICE_OUTPUT_PER_M, which the file itself warns will drift).
//
// Report both. When the two diverge, the balance delta is the truth and the
// rate constants need updating.
//
// Never throws. A DeepSeek outage must not take down the morning job.
// ============================================================

const BALANCE_URL = 'https://api.deepseek.com/user/balance'
const TIMEOUT_MS = 10_000

export interface DeepSeekBalance {
  ok: boolean
  /** Balance in USD when DeepSeek reports a USD bucket, else null. */
  usd: number | null
  /** Balance in CNY when reported (DeepSeek bills some accounts in CNY). */
  cny: number | null
  /** DeepSeek's own "can this key still make calls" flag. */
  isAvailable: boolean | null
  error?: string
}

interface BalanceInfo {
  currency?: string
  total_balance?: string
  granted_balance?: string
  topped_up_balance?: string
}

const num = (v: unknown): number | null => {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v)
    return Number.isFinite(n) ? n : null
  }
  return null
}

export async function getDeepSeekBalance(
  apiKey: string | undefined = process.env.DEEPSEEK_API_KEY,
): Promise<DeepSeekBalance> {
  const empty: DeepSeekBalance = { ok: false, usd: null, cny: null, isAvailable: null }
  if (!apiKey) return { ...empty, error: 'not_configured' }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(BALANCE_URL, {
      method: 'GET',
      headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
      signal: controller.signal,
      cache: 'no-store',
    })
    if (!res.ok) return { ...empty, error: `status_${res.status}` }

    const body = (await res.json().catch(() => null)) as
      | { is_available?: boolean; balance_infos?: BalanceInfo[] }
      | null
    if (!body) return { ...empty, error: 'unparseable' }

    const infos = Array.isArray(body.balance_infos) ? body.balance_infos : []
    const pick = (cur: string) =>
      num(infos.find((i) => (i.currency ?? '').toUpperCase() === cur)?.total_balance)

    return {
      ok: true,
      usd: pick('USD'),
      cny: pick('CNY'),
      isAvailable: typeof body.is_available === 'boolean' ? body.is_available : null,
    }
  } catch (err) {
    const aborted = err instanceof Error && err.name === 'AbortError'
    return { ...empty, error: aborted ? 'timeout' : 'fetch_failed' }
  } finally {
    clearTimeout(timeout)
  }
}
