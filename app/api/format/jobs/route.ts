// POST /api/format/jobs — create a formatting job (Sushant, Session C).
// Unauthenticated: email + Turnstile only. Rate-limited per email + IP. Returns
// signed upload URLs; the client PUTs the manuscript (+ figures) then calls
// /advance. Runs on Node (the pipeline uses pizzip/@xmldom).

import { NextRequest, NextResponse } from 'next/server'
import { getJournal, ARTICLE_TYPE_LABELS } from '@/lib/formatting/journalList'
import { SCHEMA_VERSION } from '@/lib/formatting/rulesSchema'
import { createJob, checkRateLimit, createSignedUpload } from '@/lib/formatting/pipeline/jobs'
import { storagePaths, MAX_FIGURES } from '@/lib/formatting/pipeline/api'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function verifyTurnstile(token: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY
  if (!secret) return true // dev / unconfigured — skip (same posture as lib/auth/actions.ts)
  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ secret, response: token }),
    })
    const data = await res.json()
    return data.success === true
  } catch {
    return false
  }
}

function clientIp(req: NextRequest): string | null {
  const xff = req.headers.get('x-forwarded-for')
  return xff ? xff.split(',')[0].trim() : req.headers.get('x-real-ip')
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }
  const { email, journalId, articleType, turnstileToken, figureCount } = body as Record<string, unknown>

  if (typeof email !== 'string' || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: 'A valid email is required.' }, { status: 400 })
  }
  const rules = typeof journalId === 'string' ? getJournal(journalId) : null
  if (!rules) {
    return NextResponse.json({ error: 'Unknown target journal.' }, { status: 400 })
  }
  if (typeof articleType !== 'string' || !(articleType in ARTICLE_TYPE_LABELS)) {
    return NextResponse.json({ error: 'Select a valid article type.' }, { status: 400 })
  }
  if (typeof turnstileToken !== 'string' || !(await verifyTurnstile(turnstileToken))) {
    return NextResponse.json({ error: 'Human verification failed. Please retry.' }, { status: 400 })
  }

  const ip = clientIp(req)
  const rl = await checkRateLimit(email, ip)
  if (!rl.ok) {
    return NextResponse.json({ error: rl.reason }, { status: 429 })
  }

  const job = await createJob({ email, journalId: rules.identity.slug, articleType, ip, rulesVersion: SCHEMA_VERSION })
  if (!job) {
    return NextResponse.json({ error: 'Could not create the job. Try again.' }, { status: 500 })
  }

  const manuscriptUpload = await createSignedUpload(storagePaths.input(job.id))
  if (!manuscriptUpload) {
    return NextResponse.json({ error: 'Could not prepare the upload. Try again.' }, { status: 500 })
  }

  const nFigs = Math.min(Math.max(0, Number(figureCount) || 0), MAX_FIGURES)
  const figureUploads = []
  for (let i = 0; i < nFigs; i++) {
    const u = await createSignedUpload(storagePaths.figure(job.id, i, 'img'))
    if (u) figureUploads.push(u)
  }

  return NextResponse.json({ jobId: job.id, manuscriptUpload, figureUploads })
}
