import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/gumroad-webhook
 *
 * Gumroad calls this endpoint when a customer completes a purchase. We:
 *   1. Verify the webhook signature (if a webhook secret is configured)
 *   2. Find the user by their Gumroad purchase email
 *   3. Insert a payment record
 *   4. Upgrade their profile tier to 'pro' + set lifetime_unlocked
 *
 * Setup in Gumroad:
 *   - Go to Product → Settings → Webhook
 *   - Add URL: https://affiliate-link-checker.vercel.app/api/gumroad-webhook
 *   - Copy the webhook secret into GUMROAD_WEBHOOK_SECRET env var
 *
 * Reference: https://help.gumroad.com/article/286-webhooks
 */
export async function POST(req: NextRequest) {
  try {
    const webhookSecret = process.env.GUMROAD_WEBHOOK_SECRET

    // Gumroad sends the payload as form-encoded data
    const formData = await req.formData()
    const payload: Record<string, string> = {}
    for (const [key, value] of formData.entries()) {
      payload[key] = String(value)
    }

    // === OPTIONAL SIGNATURE VERIFICATION ===
    // If a webhook secret is configured, verify the signature
    if (webhookSecret && webhookSecret !== 'replace_after_setup') {
      const providedSig = payload['signature'] || ''
      // Gumroad doesn't document a strict signature scheme, so we use a simple
      // shared-secret comparison. If you need HMAC, replace this block.
      if (providedSig !== webhookSecret) {
        console.warn('Gumroad webhook: signature mismatch')
        return NextResponse.json({ ok: false, error: 'Invalid signature' }, { status: 401 })
      }
    }

    // === EXTRACT PURCHASE INFO ===
    const email = payload['email'] || payload['purchase_email'] || ''
    const orderId =
      payload['order_id'] || payload['subscription_id'] || payload['purchase_id'] || ''
    const amount = parseFloat(payload['price'] || payload['amount'] || '9')
    const productName = payload['product_name'] || 'Affiliate Link Checker - Pro'
    const refunded = payload['refunded'] === 'true' || payload['disputed'] === 'true'

    if (!email) {
      console.warn('Gumroad webhook: no email in payload', payload)
      return NextResponse.json({ ok: false, error: 'No email' }, { status: 400 })
    }

    // === FIND USER BY EMAIL ===
    // We use the service role key to look up auth.users directly.
    const { data: authUser, error: userError } = await supabaseAdmin.auth.admin.listUsers()
    if (userError) {
      console.error('Gumroad webhook: failed to list users', userError)
      return NextResponse.json({ ok: false, error: 'User lookup failed' }, { status: 500 })
    }

    const user = (authUser.users || []).find((u) => u.email === email)
    if (!user) {
      console.warn(`Gumroad webhook: no user found for ${email}`)
      // We still return 200 so Gumroad doesn't keep retrying
      return NextResponse.json({ ok: false, error: 'User not found' }, { status: 200 })
    }

    // === HANDLE REFUNDS ===
    if (refunded) {
      await supabaseAdmin
        .from('payments')
        .update({ status: 'refunded' })
        .eq('user_id', user.id)
        .eq('provider', 'gumroad')
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
        amount: amount || 9.0,
        currency: 'USD',
        provider: 'gumroad',
        provider_order_id: orderId || `gumroad-${Date.now()}`,
        status: 'completed',
        completed_at: new Date().toISOString(),
      },
      { onConflict: 'provider,provider_order_id' }
    )
    if (payError) {
      console.error('Gumroad webhook: payment insert failed', payError)
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
      console.error('Gumroad webhook: profile upgrade failed', profileError)
      return NextResponse.json({ ok: false, error: 'Profile upgrade failed' }, { status: 500 })
    }

    console.log(`Gumroad webhook: upgraded ${email} to pro`)
    return NextResponse.json({
      ok: true,
      action: 'upgraded',
      email,
      orderId,
      productName,
    })
  } catch (err: unknown) {
    console.error('Gumroad webhook: unhandled error', err)
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Unknown' },
      { status: 500 }
    )
  }
}

// Gumroad sends a GET to verify the webhook exists
export async function GET() {
  return NextResponse.json({ ok: true, message: 'Gumroad webhook endpoint is live' })
}
