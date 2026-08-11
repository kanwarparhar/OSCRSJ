/**
 * crossref_deposits state machine (migration 035).
 *
 *   queued  --build+POST-->  submitted  --poll log-->  success | failed
 *
 * WHY A TABLE AND NOT A FIRE-AND-FORGET CALL
 * Crossref's POST only queues the batch; the verdict arrives later via the
 * submission log. Without durable state a rejected batch fails silently and
 * we keep telling authors their DOI is registered. This table is the record
 * of what was sent (`deposit_xml_sha256`), when, under which batch id, and
 * what Crossref finally said.
 *
 * Table access is loosely typed — crossref_deposits is not in the generated
 * Database type, the same as formatting_jobs and audit_logs. RLS is enabled
 * with zero policies, so service-role is the only path in.
 */

import { createHash } from 'crypto'
import { createAdminClient } from '@/lib/supabase/server'
import { buildDepositXml } from './depositXml'
import { buildDepositInput } from './depositInput'
import { checkSubmission, readCrossrefEnv, submitDeposit } from './depositClient'

type Admin = ReturnType<typeof createAdminClient>
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const deposits = (a: Admin) => a.from('crossref_deposits') as any

export type DepositStatus = 'queued' | 'submitted' | 'success' | 'failed'

export interface DepositRow {
  id: string
  manuscript_id: string
  doi: string
  status: DepositStatus
  doi_batch_id: string | null
  deposit_xml_sha256: string | null
  submitted_at: string | null
  confirmed_at: string | null
  attempts: number
  last_error: unknown
  submission_log: unknown
  created_at: string
  updated_at: string
}

/** Wall-clock budget for one drain, matching references/verify.ts. */
const DEFAULT_BUDGET_MS = 40_000
/** Give up automatic retries after this many attempts; admin can force more. */
const MAX_ATTEMPTS = 5

export async function listDeposits(manuscriptId: string): Promise<DepositRow[]> {
  const a = createAdminClient()
  const { data } = await deposits(a)
    .select('*')
    .eq('manuscript_id', manuscriptId)
    .order('created_at', { ascending: false })
  return (data as DepositRow[] | null) || []
}

export async function latestDeposit(manuscriptId: string): Promise<DepositRow | null> {
  const rows = await listDeposits(manuscriptId)
  return rows[0] ?? null
}

/**
 * Idempotent enqueue. A manuscript may have at most one live (non-failed)
 * deposit row — enforced by a partial unique index in migration 035, so a
 * race loses at the database rather than double-depositing.
 *
 * `force` creates a fresh row for a deliberate admin re-deposit (metadata
 * correction). That is the ONLY remedy for a bad deposit: DOIs cannot be
 * deleted, only superseded by a corrected full re-deposit.
 */
export async function enqueue(
  manuscriptId: string,
  doi: string,
  opts: { force?: boolean } = {}
): Promise<{ ok: boolean; row: DepositRow | null; error?: string }> {
  const a = createAdminClient()

  if (!opts.force) {
    const { data: existing } = await deposits(a)
      .select('*')
      .eq('manuscript_id', manuscriptId)
      .in('status', ['queued', 'submitted', 'success'])
      .limit(1)
    const rows = (existing as DepositRow[] | null) || []
    if (rows.length > 0) return { ok: true, row: rows[0] }
  }

  const { data, error } = await deposits(a)
    .insert({ manuscript_id: manuscriptId, doi, status: 'queued' })
    .select()
    .single()

  if (error) {
    // 23505 here means a concurrent enqueue won. That is success, not failure.
    if ((error as { code?: string }).code === '23505') {
      const { data: winner } = await deposits(a)
        .select('*')
        .eq('manuscript_id', manuscriptId)
        .in('status', ['queued', 'submitted', 'success'])
        .limit(1)
      const rows = (winner as DepositRow[] | null) || []
      return { ok: true, row: rows[0] ?? null }
    }
    return { ok: false, row: null, error: error.message }
  }
  return { ok: true, row: data as DepositRow }
}

async function patch(id: string, fields: Record<string, unknown>): Promise<void> {
  const a = createAdminClient()
  await deposits(a)
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq('id', id)
}

async function audit(action: string, manuscriptId: string, details: unknown): Promise<void> {
  try {
    const a = createAdminClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (a.from('audit_logs') as any).insert({
      action,
      resource_type: 'manuscript',
      resource_id: manuscriptId,
      details: { manuscript_id: manuscriptId, ...(details as object) },
    })
  } catch {
    // Audit failure must never sink a deposit.
  }
}

export interface DrainSummary {
  configured: boolean
  submitted: number
  confirmed: number
  failed: number
  stillPending: number
  errors: string[]
}

/**
 * Drains 'queued' then polls 'submitted'. Safe to call from a cron tick or
 * best-effort after go-live; both paths converge on the same state.
 */
export async function processQueue(
  budgetMs: number = DEFAULT_BUDGET_MS
): Promise<DrainSummary> {
  const summary: DrainSummary = {
    configured: false,
    submitted: 0,
    confirmed: 0,
    failed: 0,
    stillPending: 0,
    errors: [],
  }

  const env = readCrossrefEnv()
  if (!env) return summary // unconfigured: no-op, exactly like googleSheets.ts
  summary.configured = true

  const started = Date.now()
  const outOfTime = () => Date.now() - started > budgetMs
  const a = createAdminClient()

  // ---- 1. queued -> submitted ----
  const { data: queuedRows } = await deposits(a)
    .select('*')
    .eq('status', 'queued')
    .lt('attempts', MAX_ATTEMPTS)
    .order('created_at', { ascending: true })
    .limit(20)

  for (const row of ((queuedRows as DepositRow[] | null) || [])) {
    if (outOfTime()) break

    const built = await buildDepositInput(row.manuscript_id, {
      depositorEmail: env.depositorEmail,
    })
    if (!built.ok || !built.input) {
      await patch(row.id, {
        attempts: row.attempts + 1,
        last_error: { stage: 'build', message: built.error },
      })
      summary.errors.push(`${row.doi}: ${built.error}`)
      continue
    }

    let xml: string
    try {
      xml = buildDepositXml(built.input)
    } catch (err) {
      // A generator refusal is a data problem, not a transient one. Fail the
      // row outright so it stops consuming attempts and surfaces in admin.
      await patch(row.id, {
        status: 'failed',
        attempts: row.attempts + 1,
        last_error: {
          stage: 'generate',
          message: err instanceof Error ? err.message : String(err),
        },
      })
      summary.failed += 1
      summary.errors.push(`${row.doi}: ${err instanceof Error ? err.message : String(err)}`)
      continue
    }

    const sha256 = createHash('sha256').update(xml, 'utf8').digest('hex')
    const res = await submitDeposit(env, xml, built.input.batchId)

    if (!res.ok) {
      await patch(row.id, {
        attempts: row.attempts + 1,
        last_error: { stage: 'submit', message: res.error, status: res.status, raw: res.raw.slice(0, 2000) },
      })
      summary.errors.push(`${row.doi}: ${res.error}`)
      continue
    }

    await patch(row.id, {
      status: 'submitted',
      doi_batch_id: built.input.batchId,
      deposit_xml_sha256: sha256,
      submitted_at: new Date().toISOString(),
      attempts: row.attempts + 1,
      last_error: null,
    })
    summary.submitted += 1
    await audit('crossref_deposit_submitted', row.manuscript_id, {
      doi: row.doi,
      batchId: built.input.batchId,
      sha256,
      endpoint: env.depositUrl,
    })
  }

  // ---- 2. submitted -> success | failed ----
  const { data: submittedRows } = await deposits(a)
    .select('*')
    .eq('status', 'submitted')
    .not('doi_batch_id', 'is', null)
    .order('submitted_at', { ascending: true })
    .limit(20)

  for (const row of ((submittedRows as DepositRow[] | null) || [])) {
    if (outOfTime()) break
    const result = await checkSubmission(env, row.doi_batch_id as string)

    if (result.state === 'success') {
      await patch(row.id, {
        status: 'success',
        confirmed_at: new Date().toISOString(),
        submission_log: { diagnostics: result.diagnostics, raw: result.raw.slice(0, 8000) },
        last_error: null,
      })
      summary.confirmed += 1
      await audit('crossref_deposit_confirmed', row.manuscript_id, {
        doi: row.doi,
        batchId: row.doi_batch_id,
      })
    } else if (result.state === 'failure') {
      await patch(row.id, {
        status: 'failed',
        submission_log: { diagnostics: result.diagnostics, raw: result.raw.slice(0, 8000) },
        last_error: { stage: 'submission_log', diagnostics: result.diagnostics },
      })
      summary.failed += 1
      summary.errors.push(`${row.doi}: ${result.diagnostics.join('; ')}`)
      await audit('crossref_deposit_failed', row.manuscript_id, {
        doi: row.doi,
        batchId: row.doi_batch_id,
        diagnostics: result.diagnostics,
      })
    } else {
      summary.stillPending += 1
    }
  }

  return summary
}
