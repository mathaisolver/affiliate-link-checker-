import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/lemonsqueezy-webhook
 *
 * Lemon Squeezy calls this endpoint when a customer completes a purchase.
 * We:
 *   1. Verify the webhook signature (X-Signature header, HMAC-SHA256 of body)
 *   2. Find the user by their Lemon Squeezy purchase email
 *   3. Insert a payment record
 *   4. Upgrade their profile tier to 'pro' + set lifetime_unlocked
 *
 * Setup in Lemon Squeezy:
 *   - Go to Settings → Webhooks → Add webhook
 *   - URL: https://affiliate-link-checker.vercel.app/api/lemonsqueezy-webhook
 *   - Events to send: order_created, subscription_payment_success
 *   - Copy the Signing Secret into LEMON_SQUEEZY_WEBHOOK_SECRET env var
 *
 * Reference: https://docs.lemonsqueezy.com/api/webhooks
 */
export async function POST(req: NextRequest) {
  try {
    const webhookSecret = process.env.LEMON_SQUEEZY_WEBHOOK_SECRET
    if (!webhookSecret) {
      console.error('Lemon Squeezy webhook: no LEMON_SQUEEZY_WEBHOOK_SECRET env var set')
      return NextResponse.json({ ok: false, error: 'Webhook secret not configured' }, { status: 500 })
    }

    // Get raw body for signature verification
    const rawBody = await req.text()
    const signature = req.headers.get('x-signature') || ''

    // Verify signature: HMAC-SHA256(rawBody, webhookSecret) == signature (hex)
    const encoder = new TextEncoder()
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(webhookSecret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    )
    const sigBuf = await crypto.subtle.sign('HMAC', key, encoder.encode(rawBody))
    const expectedSig = Array.from(new Uint8Array(sigBuf))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')

    if (signature !== expectedSig) {
      console.warn('Lemon Squeezy webhook: signature mismatch')
      console.warn('  expected:', expectedSig.slice(0, 32), '...')
      console.warn('  got:     ', signature.slice(0, 32), '...')
      return NextResponse.json({ ok: false, error: 'Invalid signature' }, { status: 401 })
    }

    // Parse the payload
    const payload = JSON.parse(rawBody)
    const event = payload.meta?.event_name || 'order_created'
    const data = payload.data || {}

    // Skip non-order events
    if (!['order_created', 'subscription_payment_success'].includes(event)) {
      return NextResponse.json({ ok: true, skipped: true, event })
    }

    // === EXTRACT PURCHASE INFO ===
    const attrs = data.attributes || {}
    const email = attrs.user_email || payload.meta?.custom_data?.email || ''
    const orderId = data.id || payload.meta?.event_id || `ls-${Date.now()}`
    const amount = attrs.total ? (attrs.total / 100).toFixed(2) : '9.00'
    const refunded = attrs.status === 'refunded'

    if (!email) {
      console.warn('Lemon Squeezy webhook: no email in payload', JSON.stringify(payload).slice(0, 500))
      return NextResponse.json({ ok: false, error: 'No email' }, { status: 400 })
    }

    // === FIND USER BY EMAIL ===
    const { data: authUsers, error: listError } = await supabaseAdmin.auth.admin.listUsers()
    if (listError) {
      console.error('Lemon Squeezy webhook: failed to list users', listError)
      return NextResponse.json({ ok: false, error: 'User lookup failed' }, { status: 500 })
    }

    const user = (authUsers.users || []).find((u) => u.email === email)
    if (!user) {
      console.warn(`Lemon Squeezy webhook: no user found for ${email}`)
      // We return 200 so Lemon Squeezy doesn't keep retrying
      return NextResponse.json({ ok: false, error: 'User not found' }, { status: 200 })
    }

    // === HANDLE REFUNDS ===
    if (refunded) {
      await supabaseAdmin
        .from('payments')
        .update({ status: 'refunded' })
        .eq('user_id', user.id)
        .eq('provider', 'lemonsqueezy')
      await supabaseAdmin
        .from('profiles')
        .update({ tier: 'free', lifetime_unlocked: false, lifetime_unlocked_at: null })
        .eq('id', user.id)
      return NextResponse.json({ ok: true, action: 'refunded' })
    }

    // === INSERT PAYMENT ===
    const { error: payError } = await supabaseAdmin.from('payments').upsert(
      {
        user_id: user.id,
        email,
        amount: parseFloat(amount),
        currency: attrs.currency || 'USD',
        provider: 'lemonsqueezy',
        provider_order_id: orderId,
        status: 'completed',
        completed_at: new Date().toISOString(),
      },
      { onConflict: 'provider,provider_order_id' }
    )
    if (payError) {
      console.error('Lemon Squeezy webhook: payment insert failed', payError)
    }

    // === UPGRADE TIER ===
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({
        tier: 'pro',
        lifetime_unlocked: true,
        lifetime_unlocked_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id)

    if (profileError) {
      console.error('Lemon Squeezy webhook: profile upgrade failed', profileError)
      return NextResponse.json({ ok: false, error: 'Profile upgrade failed' }, { status: 500 })
    }

    console.log(`Lemon Squeezy webhook: upgraded ${email} to pro`)
    return NextResponse.json({
      ok: true,
      action: 'upgraded',
      email,
      orderId,
      event,
    })
  } catch (err: unknown) {
    console.error('Lemon Squeezy webhook: unhandled error', err)
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Unknown' },
      { status: 500 }
    )
  }
}

// Lemon Squeezy sends a GET to verify the webhook exists
export async function GET() {
  return NextResponse.json({ ok: true, message: 'Lemon Squeezy webhook endpoint is live' })
}
