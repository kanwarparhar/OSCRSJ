/**
 * Crossref HTTP layer — submit a deposit, then poll the submission log.
 *
 * THE ASYNCHRONY IS THE WHOLE POINT
 * `POST /servlet/deposit` returns HTTP 200 to mean "your batch is QUEUED".
 * It does NOT mean the DOI was registered. The accept/reject verdict arrives
 * later, only via the submission log. A system that treats the 200 as success
 * will report registered DOIs that do not exist — which is precisely the
 * failure this whole workstream exists to prevent.
 *
 * Conventions follow lib/formatting/references/verify.ts: explicit
 * AbortController timeouts, a User-Agent carrying a mailto, and functions that
 * NEVER throw — they return result objects so a queue drain cannot be killed
 * by one bad response.
 */

const REQUEST_TIMEOUT_MS = 30_000
const USER_AGENT =
  'OSCRSJ-DepositBot/1.0 (https://www.oscrsj.com; mailto:editor@oscrsj.com)'

export interface CrossrefEnv {
  depositUrl: string
  queryUrl: string
  user: string
  password: string
  depositorEmail: string
}

/**
 * Reads the deposit environment. Returns null when unconfigured so every
 * caller no-ops gracefully in local dev and preview — the same contract as
 * lib/integrations/googleSheets.ts.
 */
export function readCrossrefEnv(): CrossrefEnv | null {
  const depositUrl = process.env.CROSSREF_DEPOSIT_URL
  const queryUrl = process.env.CROSSREF_QUERY_URL
  const user = process.env.CROSSREF_DEPOSIT_USER
  const password = process.env.CROSSREF_DEPOSIT_PASSWORD
  const depositorEmail = process.env.CROSSREF_DEPOSITOR_EMAIL
  if (!depositUrl || !queryUrl || !user || !password || !depositorEmail) {
    return null
  }
  return { depositUrl, queryUrl, user, password, depositorEmail }
}

/** True when the configured endpoints are Crossref's TEST system. */
export function isTestEndpoint(env: CrossrefEnv): boolean {
  return /test\.crossref\.org/i.test(env.depositUrl)
}

export interface SubmitResult {
  ok: boolean
  /** Crossref's handle for the batch — the key for polling. */
  batchId: string | null
  status: number | null
  raw: string
  error?: string
}

/**
 * POSTs a deposit as multipart/form-data (`operation=doMDUpload`).
 *
 * `batchId` is passed in rather than parsed out of the response: Crossref
 * echoes our own doi_batch_id back, and relying on parsing a human-readable
 * HTML-ish body for the key we already know is a needless failure point.
 */
export async function submitDeposit(
  env: CrossrefEnv,
  xml: string,
  batchId: string
): Promise<SubmitResult> {
  const form = new FormData()
  form.set('operation', 'doMDUpload')
  form.set('login_id', env.user)
  form.set('login_passwd', env.password)
  form.set(
    'fname',
    new Blob([xml], { type: 'application/xml' }),
    `${batchId}.xml`
  )

  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS)
  try {
    const res = await fetch(env.depositUrl, {
      method: 'POST',
      body: form,
      signal: ctrl.signal,
      headers: { 'User-Agent': USER_AGENT },
    })
    const raw = await res.text()
    if (!res.ok) {
      return {
        ok: false,
        batchId: null,
        status: res.status,
        raw,
        error: `Crossref deposit endpoint returned ${res.status}`,
      }
    }
    // Crossref returns a success page for a QUEUED batch. Some failure modes
    // (bad credentials above all) still come back as 200 with an error body.
    if (/failure|not allowed|unauthor|invalid credentials/i.test(raw)) {
      return {
        ok: false,
        batchId: null,
        status: res.status,
        raw,
        error: 'Crossref accepted the request but reported a failure — check credentials.',
      }
    }
    return { ok: true, batchId, status: res.status, raw }
  } catch (err) {
    return {
      ok: false,
      batchId: null,
      status: null,
      raw: '',
      error: err instanceof Error ? err.message : String(err),
    }
  } finally {
    clearTimeout(timer)
  }
}

export type SubmissionState = 'pending' | 'success' | 'failure'

export interface SubmissionResult {
  state: SubmissionState
  diagnostics: string[]
  raw: string
}

/**
 * Parses a Crossref submission log.
 *
 * Shape (5.5.0): <doi_batch_diagnostic status="completed|in_process">
 *   <record_diagnostic status="Success|Failure|Warning"><msg>…</msg>
 *
 * Deliberately regex-based rather than pulling in an XML parser: the shape is
 * fixed, the failure mode of a mis-parse is "stay pending and poll again",
 * and an unparseable log must NEVER read as success.
 */
export function parseSubmissionLog(raw: string): SubmissionResult {
  const diagnostics: string[] = []

  const recordRe =
    /<record_diagnostic[^>]*\bstatus="([^"]+)"[^>]*>([\s\S]*?)<\/record_diagnostic>/gi
  const statuses: string[] = []
  let m: RegExpExecArray | null
  while ((m = recordRe.exec(raw)) !== null) {
    statuses.push(m[1].toLowerCase())
    const msg = /<msg>([\s\S]*?)<\/msg>/i.exec(m[2])
    if (msg) diagnostics.push(msg[1].trim())
  }

  // Self-closing record_diagnostic (Success with no message body).
  const selfClosingRe = /<record_diagnostic[^>]*\bstatus="([^"]+)"[^>]*\/>/gi
  while ((m = selfClosingRe.exec(raw)) !== null) {
    statuses.push(m[1].toLowerCase())
  }

  const batchStatus = /<doi_batch_diagnostic[^>]*\bstatus="([^"]+)"/i.exec(raw)?.[1]?.toLowerCase()

  if (statuses.length === 0) {
    // No records yet — the batch is still in the queue, or the log is not
    // available. Either way: pending, never success.
    if (batchStatus === 'completed') {
      return {
        state: 'failure',
        diagnostics: ['Batch completed but contained no record diagnostics.'],
        raw,
      }
    }
    return { state: 'pending', diagnostics, raw }
  }

  if (statuses.some((s) => s === 'failure' || s === 'error')) {
    return { state: 'failure', diagnostics, raw }
  }
  if (batchStatus && batchStatus !== 'completed') {
    return { state: 'pending', diagnostics, raw }
  }
  if (statuses.every((s) => s === 'success' || s === 'warning')) {
    return { state: 'success', diagnostics, raw }
  }
  return { state: 'pending', diagnostics, raw }
}

export async function checkSubmission(
  env: CrossrefEnv,
  batchId: string
): Promise<SubmissionResult> {
  const url =
    `${env.queryUrl}?usr=${encodeURIComponent(env.user)}` +
    `&pwd=${encodeURIComponent(env.password)}` +
    `&doi_batch_id=${encodeURIComponent(batchId)}&type=result`

  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { 'User-Agent': USER_AGENT },
    })
    const raw = await res.text()
    if (!res.ok) {
      return {
        state: 'pending',
        diagnostics: [`Submission log query returned ${res.status}`],
        raw,
      }
    }
    return parseSubmissionLog(raw)
  } catch (err) {
    return {
      state: 'pending',
      diagnostics: [err instanceof Error ? err.message : String(err)],
      raw: '',
    }
  } finally {
    clearTimeout(timer)
  }
}
