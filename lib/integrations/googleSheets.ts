// ============================================================
// Google Sheets webhook integration
// ============================================================
// Posts a row of data to a Google Apps Script web app that
// appends it to a Google Sheet. The web app is a public URL
// (Apps Script doesn't allow IP-based or OAuth-based access
// gates for "Anyone" web apps), so we authenticate every
// request with a `secret` field in the JSON body that the
// script validates server-side before appending. Apps Script
// web apps deployed with "Anyone" access cannot read custom
// HTTP request headers, so body-based auth is the only path.
//
// Setup runbook for Kanwar is in the wrap-up of the Franklin
// 2026-05-18 session. Apps Script source is committed at
// docs/google-sheets-apps-script.gs.
//
// Env vars required (set in Vercel Production + Preview):
//   * GOOGLE_SHEETS_WEBHOOK_URL    — Apps Script web app URL
//   * GOOGLE_SHEETS_WEBHOOK_SECRET — shared secret string
//
// If either is unset (e.g., local dev without the integration
// configured), appendRowToSheet becomes a no-op so the rest of
// the submission flow keeps working.
// ============================================================

interface ReplaceRowsArgs {
  /** Tab name inside the target Google Sheet. */
  sheetName: string
  /** Full body of the tab, header row EXCLUDED. Replaces whatever is there. */
  rows: Array<Array<string | number | boolean | null>>
}

interface AppendRowArgs {
  /** Tab name inside the target Google Sheet. */
  sheetName: string
  /** Ordered array of cell values (strings, numbers, booleans). */
  row: Array<string | number | boolean | null>
}

interface AppendRowResult {
  ok: boolean
  /** Present only on failure paths; never thrown to the caller. */
  error?: string
}

const WEBHOOK_TIMEOUT_MS = 10_000

/**
 * Fire-and-forget append of a row to a Google Sheet via Apps
 * Script web app. Never throws. Callers should `void` the
 * return value or `await` it without try/catch — failures are
 * logged via console.error and surfaced in the result object.
 *
 * No-op (returns ok: false with `error: 'not_configured'`) when
 * GOOGLE_SHEETS_WEBHOOK_URL or GOOGLE_SHEETS_WEBHOOK_SECRET is
 * unset, so local dev runs without the integration.
 */
export async function appendRowToSheet(
  args: AppendRowArgs
): Promise<AppendRowResult> {
  const url = process.env.GOOGLE_SHEETS_WEBHOOK_URL
  const secret = process.env.GOOGLE_SHEETS_WEBHOOK_SECRET

  if (!url || !secret) {
    // Silently no-op in environments without the integration
    // configured. Don't console.warn — would spam local logs.
    return { ok: false, error: 'not_configured' }
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS)

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        secret,
        sheetName: args.sheetName,
        row: args.row,
      }),
      signal: controller.signal,
    })

    if (!res.ok) {
      const body = await res.text().catch(() => '<unreadable>')
      console.error(
        '[appendRowToSheet] non-2xx response:',
        res.status,
        body.slice(0, 500)
      )
      return { ok: false, error: `status_${res.status}` }
    }

    return { ok: true }
  } catch (err) {
    const isAbort =
      err instanceof Error &&
      (err.name === 'AbortError' || err.message.includes('aborted'))
    console.error(
      '[appendRowToSheet] fetch failed:',
      isAbort ? 'timeout' : err
    )
    return { ok: false, error: isAbort ? 'timeout' : 'fetch_failed' }
  } finally {
    clearTimeout(timeout)
  }
}

/**
 * Overwrite a tab's body with `rows` (the header row is preserved by the Apps
 * Script side), for derived tabs that must be deduplicated -- an append-only
 * log cannot dedupe an address that formatted three manuscripts, and a list
 * with triplicate rows is a list nobody trusts.
 *
 * NO CALLER TODAY (2026-07-25). This was built for the Studio marketing list,
 * which now lives in the Admin Manuscript Hub sheet instead, whose Apps Script
 * pulls from Supabase directly and so rebuilds the list without being pushed
 * anything. Kept rather than deleted because the deployed webhook still
 * understands `mode: 'replace'`, so this is a working capability, not a stub --
 * but do not assume anything is exercising it.
 *
 * Requires the Apps Script deployment that understands `mode: 'replace'`
 * (docs/google-sheets-apps-script.gs, 2026-07-25 or later). An older
 * deployment ignores the mode and would append instead, so re-deploy the
 * script before relying on this.
 *
 * Never throws; same contract as appendRowToSheet.
 */
export async function replaceSheetRows(
  args: ReplaceRowsArgs
): Promise<AppendRowResult> {
  const url = process.env.GOOGLE_SHEETS_WEBHOOK_URL
  const secret = process.env.GOOGLE_SHEETS_WEBHOOK_SECRET
  if (!url || !secret) return { ok: false, error: 'not_configured' }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS * 3)

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        secret,
        mode: 'replace',
        sheetName: args.sheetName,
        rows: args.rows,
      }),
      signal: controller.signal,
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '<unreadable>')
      console.error(
        '[replaceSheetRows] non-2xx response:',
        res.status,
        body.slice(0, 500)
      )
      return { ok: false, error: `status_${res.status}` }
    }
    return { ok: true }
  } catch (err) {
    const isAbort =
      err instanceof Error &&
      (err.name === 'AbortError' || err.message.includes('aborted'))
    console.error('[replaceSheetRows] fetch failed:', isAbort ? 'timeout' : err)
    return { ok: false, error: isAbort ? 'timeout' : 'fetch_failed' }
  } finally {
    clearTimeout(timeout)
  }
}
