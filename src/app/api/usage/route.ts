import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin, getUserFromRequest } from '@/lib/supabase-server'
import { TIERS, LIMITS, BULK_LIMITS, type Tier, ANON_USAGE } from '@/lib/tiers'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/usage
 * Returns the caller's current usage state. Used by the UI to show
 * "X of Y checks left today" and to lock bulk features for non-pro users.
 *
 * - Logged-in users: identified by Supabase JWT
 * - Anonymous users: get the ANON_USAGE constant (canCheck: false)
 */
export async function GET(req: NextRequest) {
  const userId = await getUserFromRequest(req)

  // Not logged in — return anon usage (can't check anything)
  if (!userId) {
    return NextResponse.json(ANON_USAGE)
  }

  // Determine tier + name + email
  let tier: Tier = TIERS.FREE
  let email: string | null = null
  let name: string | null = null
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('tier, email, name')
    .eq('id', userId)
    .maybeSingle()
  if (profile?.tier === 'pro') tier = TIERS.PRO
  else if (profile?.tier === 'free') tier = TIERS.FREE
  else tier = TIERS.FREE
  email = profile?.email ?? null
  name = profile?.name ?? null

  // Count today's usage
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const { count } = await supabaseAdmin
    .from('usage_tracking')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', todayStart.toISOString())
  const usedToday = count ?? 0

  const limit = LIMITS[tier]
  const remaining = tier === TIERS.PRO ? Infinity : Math.max(0, limit - usedToday)

  return NextResponse.json({
    tier,
    email,
    name,
    userId,
    usedToday,
    limit,
    remaining,
    bulkLimit: BULK_LIMITS[tier],
    canCheck: tier === TIERS.PRO || remaining > 0,
    canUseBulk: tier === TIERS.PRO,
    isAuthenticated: true,
  })
}
