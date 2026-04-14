// ============================================================
// Resend webhook handler
// ============================================================
// POST /api/webhooks/resend
//
// Resend uses Svix for webhook signing. We verify the signature using
// the `svix-id`, `svix-timestamp`, and `svix-signature` headers, then
// update the matching email_logs row by resend_message_id.
//
// Events handled (configure these in the Resend dashboard):
//   - email.delivered         → delivery_status = 'delivered'
//   - email.bounced           → delivery_status = 'bounced'
//   - email.complained        → delivery_status = 'complained'
//   - email.delivery_delayed  → no status change; just logged
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { Webhook } from 'svix'
import { createAdminClient } from '@/lib/supabase/server'

export const runtime = 'nodejs' // svix requires Node.js runtime

interface ResendWebhookEvent {
  type: string
  created_at?: string
  data?: {
    email_id?: string
    bounce?: {
      subType?: string
      type?: string
      message?: string
    }
    [key: string]: unknown
  }
}

export async function POST(request: NextRequest) {
  const secret = process.env.RESEND_WEBHOOK_SECRET
  if (!secret) {
    console.error('[resend-webhook] RESEND_WEBHOOK_SECRET is not set')
    return NextResponse.json(
      { error: 'Webhook secret not configured' },
      { status: 500 }
    )
  }

  const rawBody = await request.text()

  // Collect Svix headers (Resend forwards them with standard casing)
  const svixId = request.headers.get('svix-id')
  const svixTimestamp = request.headers.get('svix-timestamp')
  const svixSignature = request.headers.get('svix-signature')

  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json(
      { error: 'Missing Svix signature headers' },
      { status: 400 }
    )
  }

  let event: ResendWebhookEvent
  try {
    const wh = new Webhook(secret)
    event = wh.verify(rawBody, {
      'svix-id': svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': svixSignature,
    }) as ResendWebhookEvent
  } catch (err) {
    console.error('[resend-webhook] signature verification failed', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  const messageId = event.data?.email_id
  if (!messageId) {
    // Some event types may not have an email_id; ack and move on.
    return NextResponse.json({ received: true })
  }

  const admin = createAdminClient()
  const now = new Date().toISOString()

  try {
    switch (event.type) {
      case 'email.delivered':
        await (admin.from('email_logs') as any)
          .update({
            delivery_status: 'delivered',
            delivered_at: now,
          })
          .eq('resend_message_id', messageId)
        break

      case 'email.bounced':
        await (admin.from('email_logs') as any)
          .update({
            delivery_status: 'bounced',
            bounced_at: now,
            bounce_reason:
              event.data?.bounce?.subType ||
              event.data?.bounce?.type ||
              event.data?.bounce?.message ||
              'bounced',
          })
          .eq('resend_message_id', messageId)
        break

      case 'email.complained':
        await (admin.from('email_logs') as any)
          .update({ delivery_status: 'complained' })
          .eq('resend_message_id', messageId)
        break

      case 'email.delivery_delayed':
        // No status change; we keep 'sent' until a terminal event arrives.
        break

      default:
        // Unknown event types are ack'd; Resend retries 4xx/5xx.
        break
    }
  } catch (err) {
    console.error('[resend-webhook] update failed', err)
    // Still return 200 — Resend will retry on 5xx, and we don't want
    // a transient DB hiccup to cause event flooding. The log will let
    // us reconcile later.
  }

  return NextResponse.json({ received: true })
}
