import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin, getUserFromRequest, hashIp } from '@/lib/supabase-server'
import { TIERS, LIMITS, BULK_LIMITS, type Tier } from '@/lib/tiers'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/usage
 * Returns the caller's current usage state. Used by the UI to show
 * "X of Y checks left today" and to lock bulk features for non-pro users.
 *
 * - Logged-in users: identified by Supabase JWT
 * - Anonymous users: identified by hashed IP (1 free check per day)
 */
export async function GET(req: NextRequest) {
  const userId = await getUserFromRequest(req)
  const rawIp =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'
  const ipHash = await hashIp(rawIp)

  // Determine tier
  let tier: Tier = TIERS.ANON
  let email: string | null = null
  if (userId) {
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('tier, email')
      .eq('id', userId)
      .maybeSingle()
    if (profile?.tier === 'pro') tier = TIERS.PRO
    else if (profile?.tier === 'free') tier = TIERS.FREE
    else tier = TIERS.FREE
    email = profile?.email ?? null
  }

  // Count today's usage
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  let usedToday = 0
  if (userId) {
    const { count } = await supabaseAdmin
      .from('usage_tracking')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', todayStart.toISOString())
    usedToday = count ?? 0
  } else {
    const { count } = await supabaseAdmin
      .from('usage_tracking')
      .select('*', { count: 'exact', head: true })
      .eq('ip_hash', ipHash)
      .gte('created_at', todayStart.toISOString())
    usedToday = count ?? 0
  }

  const limit = LIMITS[tier]
  const remaining = tier === TIERS.PRO ? Infinity : Math.max(0, limit - usedToday)

  return NextResponse.json({
    tier,
    email,
    userId,
    usedToday,
    limit,
    remaining,
    bulkLimit: BULK_LIMITS[tier],
    canCheck: tier === TIERS.PRO || remaining > 0,
    canUseBulk: tier === TIERS.PRO,
  })
}
