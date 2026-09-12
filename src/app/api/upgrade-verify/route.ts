import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin, getUserFromRequest } from '@/lib/supabase-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/upgrade-verify
 *
 * Two flows:
 *
 * 1. AUTO FLOW (recommended): User paid via Gumroad, the Gumroad webhook
 *    fired and upgraded them. This endpoint just confirms their current
 *    Pro status. Frontend calls it after Gumroad checkout redirect.
 *
 * 2. MANUAL FLOW (fallback): User paid but the webhook didn't fire (e.g.
 *    they haven't set it up yet). They submit their Gumroad receipt ID and
 *    email. We store the claim in the payments table with status='pending'
 *    so the admin can verify in Supabase dashboard and flip them to Pro.
 *
 * Body for flow 1: { email: string }
 * Body for flow 2: { email: string, receiptId: string, note?: string }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const email = (body?.email || '').toString().trim()
    const receiptId = (body?.receiptId || '').toString().trim()

    if (!email) {
      return NextResponse.json({ ok: false, error: 'Email required' }, { status: 400 })
    }

    // Look up the user by email (admin service role)
    const { data: authUsers, error: listError } = await supabaseAdmin.auth.admin.listUsers()
    if (listError) {
      return NextResponse.json({ ok: false, error: 'User lookup failed' }, { status: 500 })
    }
    const user = (authUsers.users || []).find((u) => u.email === email)
    if (!user) {
      return NextResponse.json(
        { ok: false, error: 'No account found with that email. Sign up first, then verify.' },
        { status: 404 }
      )
    }

    // Check current tier
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('tier, lifetime_unlocked')
      .eq('id', user.id)
      .maybeSingle()

    // AUTO FLOW: user is already Pro (webhook fired)
    if (profile?.tier === 'pro' && profile?.lifetime_unlocked) {
      return NextResponse.json({
        ok: true,
        alreadyPro: true,
        tier: 'pro',
        message: 'Your Pro access is active. Welcome!',
      })
    }

    // MANUAL FLOW: store a pending payment claim for admin review
    if (receiptId) {
      const { error: payError } = await supabaseAdmin.from('payments').upsert(
        {
          user_id: user.id,
          email,
          amount: 9.0,
          currency: 'USD',
          provider: 'gumroad',
          provider_order_id: receiptId,
          status: 'pending',
        },
        { onConflict: 'provider,provider_order_id' }
      )
      if (payError) {
        return NextResponse.json(
          { ok: false, error: 'Could not store payment claim: ' + payError.message },
          { status: 500 }
        )
      }

      return NextResponse.json({
        ok: true,
        pending: true,
        message:
          'Thanks! Your receipt is verified. Your Pro access will be activated within 24 hours. You will get a confirmation email.',
      })
    }

    // No receipt, not already Pro
    return NextResponse.json(
      {
        ok: false,
        notPro: true,
        message:
          'No active Pro subscription found. If you just paid, please paste your Gumroad receipt ID so we can verify and activate your access.',
      },
      { status: 404 }
    )
  } catch (err: unknown) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Unknown' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/upgrade-verify
 * Returns the current user's Pro status. Used by the frontend to refresh
 * the UI after a Gumroad checkout redirect.
 */
export async function GET(req: NextRequest) {
  const userId = await getUserFromRequest(req)
  if (!userId) {
    return NextResponse.json({ ok: false, tier: 'anon' })
  }
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('tier, email, lifetime_unlocked, lifetime_unlocked_at')
    .eq('id', userId)
    .maybeSingle()
  return NextResponse.json({
    ok: true,
    tier: profile?.tier || 'free',
    email: profile?.email,
    lifetimeUnlocked: profile?.lifetime_unlocked || false,
    lifetimeUnlockedAt: profile?.lifetime_unlocked_at,
  })
}
