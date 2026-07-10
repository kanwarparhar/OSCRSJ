// ============================================================
// GET /api/cron/check-guidelines
// ============================================================
// Monthly Vercel Cron entry point (recommended schedule "0 12 1 * *" —
// 12:00 UTC on the 1st; registered in vercel.json by the parent). Re-runs
// the canonical fetch → normalize → SHA-256 recipe (see
// lib/formatting/journals/README.md and ./normalize.ts) against every
// journal's live Guide-for-Authors page and diffs the result against the
// stored `identity.source_hash`. When a journal changes its guidelines the
// hash drifts and the rule file is flagged for re-encoding.
//
// Each journal is classified:
//   - unchanged           hash matches the stored source_hash
//   - changed             hash differs (genuine change → re-encode)
//   - unreachable         fetch failed / non-2xx / normalized to empty
//   - needs-headless      a "changed" or "unreachable" result on a journal
//                         whose stored hash is of a bot-blocked / Cloudflare
//                         / CAPTCHA shell or an Internet Archive snapshot
//                         (see ./normalize.ts isBlockedSourceNote). These are
//                         expected to diff on a plain fetch and need a future
//                         headless (browser-rendered) fetcher to re-verify;
//                         a matched hash still counts as `unchanged`.
//
// Politeness: journals are processed sequentially with a ~500ms delay
// between fetches; each fetch has a ~15s AbortController timeout; a single
// fetch failure is caught and never throws out of the loop.
//
// Sends ONE digest email to the journal inbox listing the changed,
// needs-headless, and unreachable journals. A fully clean sweep (nothing
// changed / unreachable / headless-flagged) skips the send entirely — the
// audit_logs entry distinguishes guidelines_freshness_sent from
// guidelines_freshness_skipped_clean.
//
// Gated by a bearer-header check against CRON_SECRET (same secret as the
// other /api/cron/* routes). Without the header the endpoint returns 401.
// Vercel Cron injects the header automatically; ad-hoc invocation must
// include it explicitly.
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { sendEmail } from '@/lib/email/resend'
import { JOURNALS } from '@/lib/formatting/journalList'
import {
  normalizeGuideText,
  hashGuideText,
  isBlockedSourceNote,
} from './normalize'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// The reusable recipe (normalizeGuideText / hashGuideText) lives in the
// colocated ./normalize module so a future headless fetch path can import it
// without pulling in this route. It is intentionally NOT re-exported here —
// Next.js validates the set of named exports a route file may carry.

// Freshness digest recipient — the journal's primary Gmail. Kept as a plain
// constant (not the daily-digest env ladder) because a guidelines-drift
// alert is an internal maintenance signal, not editorial triage.
const RECIPIENT = 'oscrsjournal@gmail.com'

const GUIDE_UA = 'Mozilla/5.0 (OSCRSJ-guidelines-checker)'
const FETCH_TIMEOUT_MS = 15_000
const POLITE_DELAY_MS = 500

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const header = req.headers.get('authorization') || ''
  return header === `Bearer ${secret}`
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

interface JournalRef {
  name: string
  slug: string
  guidelinesUrl: string
}

interface ChangedEntry extends JournalRef {
  storedHash: string
  liveHash: string
}

interface UnreachableEntry extends JournalRef {
  reason: string
}

interface HeadlessEntry extends JournalRef {
  reason: string
}

interface FetchResult {
  ok: boolean
  status: number | null
  text: string
  error: string | null
}

async function fetchGuide(url: string): Promise<FetchResult> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      headers: { 'user-agent': GUIDE_UA },
      redirect: 'follow',
      signal: controller.signal,
    })
    if (!res.ok) {
      // Drain the body so the socket can be reused, but ignore its content.
      try {
        await res.text()
      } catch {
        // ignore
      }
      return { ok: false, status: res.status, text: '', error: `HTTP ${res.status}` }
    }
    const text = await res.text()
    return { ok: true, status: res.status, text, error: null }
  } catch (err) {
    const error =
      err instanceof Error
        ? err.name === 'AbortError'
          ? `timeout after ${FETCH_TIMEOUT_MS}ms`
          : err.message
        : 'fetch failed'
    return { ok: false, status: null, text: '', error }
  } finally {
    clearTimeout(timer)
  }
}

// ------------------------------------------------------------
// Digest rendering (inlined — kept out of lib/ per the build scope).
// ------------------------------------------------------------
function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function renderDigest(args: {
  checkedAtIso: string
  changed: ChangedEntry[]
  needsHeadless: HeadlessEntry[]
  unreachable: UnreachableEntry[]
  checked: number
}): { html: string; text: string } {
  const { checkedAtIso, changed, needsHeadless, unreachable, checked } = args

  const htmlSection = (
    title: string,
    rows: string[],
    blurb?: string,
  ): string => {
    if (rows.length === 0) return ''
    return (
      `<h2 style="font-size:16px;margin:24px 0 4px;">${esc(title)} (${rows.length})</h2>` +
      (blurb ? `<p style="margin:0 0 8px;color:#555;font-size:13px;">${blurb}</p>` : '') +
      `<ul style="margin:0;padding-left:20px;">${rows.join('')}</ul>`
    )
  }

  const changedRows = changed.map(
    (j) =>
      `<li style="margin-bottom:6px;"><strong>${esc(j.name)}</strong> ` +
      `<code>${esc(j.slug)}</code><br>` +
      `<a href="${esc(j.guidelinesUrl)}">${esc(j.guidelinesUrl)}</a><br>` +
      `<span style="font-size:12px;color:#777;">stored ${esc(j.storedHash.slice(0, 12))}… → live ${esc(j.liveHash.slice(0, 12))}…</span></li>`,
  )
  const headlessRows = needsHeadless.map(
    (j) =>
      `<li style="margin-bottom:6px;"><strong>${esc(j.name)}</strong> ` +
      `<code>${esc(j.slug)}</code> — ${esc(j.reason)}<br>` +
      `<a href="${esc(j.guidelinesUrl)}">${esc(j.guidelinesUrl)}</a></li>`,
  )
  const unreachableRows = unreachable.map(
    (j) =>
      `<li style="margin-bottom:6px;"><strong>${esc(j.name)}</strong> ` +
      `<code>${esc(j.slug)}</code> — ${esc(j.reason)}<br>` +
      `<a href="${esc(j.guidelinesUrl)}">${esc(j.guidelinesUrl)}</a></li>`,
  )

  const html =
    `<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#222;max-width:640px;">` +
    `<h1 style="font-size:18px;margin:0 0 4px;">Guidelines freshness report</h1>` +
    `<p style="margin:0 0 16px;color:#555;font-size:13px;">Checked ${checked} journal(s) at ${esc(checkedAtIso)}. ` +
    `${changed.length} changed, ${needsHeadless.length} need headless re-check, ${unreachable.length} unreachable.</p>` +
    htmlSection(
      'Changed — re-encode required',
      changedRows,
      'The live guide no longer matches the stored source_hash. Re-verify and re-encode the rule file.',
    ) +
    htmlSection(
      'Needs headless re-check',
      headlessRows,
      'These journals store the hash of a bot-blocked / Cloudflare / CAPTCHA shell or an Internet Archive snapshot, so a plain fetch is expected to diff. A headless (browser-rendered) fetcher is a future upgrade — treat these as "verify manually" for now, not confirmed changes.',
    ) +
    htmlSection(
      'Unreachable',
      unreachableRows,
      'Fetch failed, returned a non-2xx status, or normalized to empty text.',
    ) +
    `</div>`

  const textSection = (title: string, lines: string[]): string => {
    if (lines.length === 0) return ''
    return `\n${title} (${lines.length})\n${lines.map((l) => `  - ${l}`).join('\n')}\n`
  }
  const text =
    `Guidelines freshness report\n` +
    `Checked ${checked} journal(s) at ${checkedAtIso}.\n` +
    `${changed.length} changed, ${needsHeadless.length} need headless re-check, ${unreachable.length} unreachable.\n` +
    textSection(
      'CHANGED (re-encode required)',
      changed.map((j) => `${j.name} [${j.slug}] ${j.guidelinesUrl}`),
    ) +
    textSection(
      'NEEDS HEADLESS RE-CHECK (plain fetch expected to diff; headless fetcher is a future upgrade)',
      needsHeadless.map((j) => `${j.name} [${j.slug}] — ${j.reason} — ${j.guidelinesUrl}`),
    ) +
    textSection(
      'UNREACHABLE',
      unreachable.map((j) => `${j.name} [${j.slug}] — ${j.reason} — ${j.guidelinesUrl}`),
    )

  return { html, text }
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const checkedAtIso = new Date().toISOString()

  const changed: ChangedEntry[] = []
  const needsHeadless: HeadlessEntry[] = []
  const unreachable: UnreachableEntry[] = []
  let checked = 0

  for (let i = 0; i < JOURNALS.length; i++) {
    const { identity } = JOURNALS[i]
    const ref: JournalRef = {
      name: identity.name,
      slug: identity.slug,
      guidelinesUrl: identity.guidelines_url,
    }
    const blocked = isBlockedSourceNote(identity.source_note)

    checked++
    const res = await fetchGuide(identity.guidelines_url)

    if (res.ok) {
      const normalized = normalizeGuideText(res.text)
      if (normalized.length === 0) {
        // Empty-normalized ⇒ unreachable-class (blank shell / JS-only page).
        const reason = 'normalized to empty text'
        if (blocked) needsHeadless.push({ ...ref, reason })
        else unreachable.push({ ...ref, reason })
      } else {
        const liveHash = hashGuideText(res.text)
        if (liveHash === identity.source_hash) {
          // unchanged — a matched hash always wins, even for blocked-note
          // journals (e.g. jbjs, whose stored hash is of its shell).
        } else if (blocked) {
          needsHeadless.push({ ...ref, reason: 'hash differs (blocked/archive shell)' })
        } else {
          changed.push({ ...ref, storedHash: identity.source_hash, liveHash })
        }
      }
    } else {
      const reason = res.error || 'fetch failed'
      if (blocked) needsHeadless.push({ ...ref, reason })
      else unreachable.push({ ...ref, reason })
    }

    // Be polite: small gap between fetches (skip after the last one).
    if (i < JOURNALS.length - 1) {
      await sleep(POLITE_DELAY_MS)
    }
  }

  const flaggedTotal = changed.length + needsHeadless.length + unreachable.length

  // ---- Clean sweep ⇒ skip the send ----
  if (flaggedTotal === 0) {
    try {
      await (admin.from('audit_logs') as any).insert({
        action: 'guidelines_freshness_skipped_clean',
        resource_type: 'cron',
        resource_id: null,
        details: {
          checked_at: checkedAtIso,
          checked,
        },
      })
    } catch {
      // swallow
    }
    return NextResponse.json({
      checked,
      changed: 0,
      needsHeadless: 0,
      unreachable: 0,
      sent: false,
    })
  }

  // ---- Render + send digest ----
  const { html, text } = renderDigest({
    checkedAtIso,
    changed,
    needsHeadless,
    unreachable,
    checked,
  })
  const subject =
    `[OSCRSJ] Guidelines freshness: ${changed.length} changed, ` +
    `${needsHeadless.length} headless, ${unreachable.length} unreachable`

  const { error: sendErr, messageId } = await sendEmail({
    to: RECIPIENT,
    subject,
    html,
    text,
    emailType: 'guidelines_freshness',
  })

  try {
    await (admin.from('audit_logs') as any).insert({
      action: sendErr
        ? 'guidelines_freshness_send_failed'
        : 'guidelines_freshness_sent',
      resource_type: 'cron',
      resource_id: null,
      details: {
        checked_at: checkedAtIso,
        checked,
        recipient: RECIPIENT,
        message_id: messageId,
        error: sendErr,
        changed: changed.map((j) => j.slug),
        needs_headless: needsHeadless.map((j) => j.slug),
        unreachable: unreachable.map((j) => j.slug),
      },
    })
  } catch {
    // swallow
  }

  if (sendErr) {
    return NextResponse.json(
      {
        checked,
        changed: changed.length,
        needsHeadless: needsHeadless.length,
        unreachable: unreachable.length,
        sent: false,
        error: sendErr,
      },
      { status: 500 },
    )
  }

  return NextResponse.json({
    checked,
    changed: changed.length,
    needsHeadless: needsHeadless.length,
    unreachable: unreachable.length,
    sent: true,
  })
}
