// Tier and rate-limit logic for the Affiliate Link Checker.
// These constants are also used by the frontend to display the right badge.

export const TIERS = {
  ANON: 'anon',       // not logged in: 1 check per day
  FREE: 'free',       // signed up: 3 checks per day
  PRO: 'pro',         // paid $9 lifetime: unlimited
} as const

export type Tier = (typeof TIERS)[keyof typeof TIERS]

export const LIMITS: Record<Tier, number> = {
  anon: 1,
  free: 3,
  pro: Infinity,
}

export const BULK_LIMITS: Record<Tier, number> = {
  anon: 0,    // bulk is pro-only
  free: 0,    // bulk is pro-only
  pro: 50,    // pro users can bulk check up to 50 URLs at once
}

export interface UsageState {
  tier: Tier
  usedToday: number
  limit: number
  remaining: number
  bulkLimit: number
  canCheck: boolean
  canUseBulk: boolean
  reason?: string  // when canCheck is false, why not
}

/**
 * Compute a UsageState from tier + count for today.
 */
export function computeUsage(tier: Tier, usedToday: number): UsageState {
  const limit = LIMITS[tier]
  const remaining = tier === TIERS.PRO ? Infinity : Math.max(0, limit - usedToday)
  const canCheck = remaining > 0
  return {
    tier,
    usedToday,
    limit,
    remaining,
    bulkLimit: BULK_LIMITS[tier],
    canCheck,
    canUseBulk: tier === TIERS.PRO,
    reason: canCheck ? undefined : `You've used all ${limit} free checks today. Sign up for more, or go Pro for unlimited.`,
  }
}
