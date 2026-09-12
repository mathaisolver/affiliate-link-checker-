// Tier and rate-limit logic for the Affiliate Link Checker.
// These constants are also used by the frontend to display the right badge.
//
// IMPORTANT: Anonymous users (not signed in) cannot run any checks at all.
// They must sign up first to get 3 free checks per day.

export const TIERS = {
  FREE: 'free',       // signed up: 3 checks per day
  PRO: 'pro',         // paid $9 lifetime: unlimited
} as const

export type Tier = (typeof TIERS)[keyof typeof TIERS]

export const LIMITS: Record<Tier, number> = {
  free: 3,
  pro: Infinity,
}

export const BULK_LIMITS: Record<Tier, number> = {
  free: 0,    // bulk is pro-only
  pro: 50,    // pro users can bulk check up to 50 URLs at once
}

export interface UsageState {
  tier: Tier | 'anon'
  usedToday: number
  limit: number
  remaining: number
  bulkLimit: number
  canCheck: boolean
  canUseBulk: boolean
  isAuthenticated: boolean
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
    isAuthenticated: true,
    reason: canCheck ? undefined : `You've used all ${limit} free checks today. Go Pro for $9 lifetime to keep checking.`,
  }
}

/**
 * Usage state for a not-logged-in user. They can't check anything.
 */
export const ANON_USAGE: UsageState = {
  tier: 'anon',
  usedToday: 0,
  limit: 0,
  remaining: 0,
  bulkLimit: 0,
  canCheck: false,
  canUseBulk: false,
  isAuthenticated: false,
  reason: 'Please sign up to start checking affiliate links. Free accounts get 3 checks per day.',
}
