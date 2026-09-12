"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import type { User } from "@supabase/supabase-js"
import { supabase } from "@/lib/supabase-client"
import { TIERS, type Tier } from "@/lib/tiers"

export interface AuthState {
  user: User | null
  email: string | null
  name: string | null
  tier: Tier | "anon"
  loading: boolean
  isPro: boolean
  isAuthenticated: boolean
}

export interface UsageState {
  tier: Tier | "anon"
  usedToday: number
  limit: number
  remaining: number
  bulkLimit: number
  canCheck: boolean
  canUseBulk: boolean
  isAuthenticated: boolean
}

// Not logged in — can't use the tool at all
const DEFAULT_AUTH: AuthState = {
  user: null,
  email: null,
  name: null,
  tier: "anon",
  loading: true,
  isPro: false,
  isAuthenticated: false,
}

const DEFAULT_USAGE: UsageState = {
  tier: "anon",
  usedToday: 0,
  limit: 0,
  remaining: 0,
  bulkLimit: 0,
  canCheck: false,
  canUseBulk: false,
  isAuthenticated: false,
}

/**
 * Get the user's display name from a Supabase user object.
 * Tries several common places where the name might be stored.
 */
function getUserName(user: User | null): string | null {
  if (!user) return null
  // 1. user_metadata.name (set via signUp options.data.name)
  const meta = user.user_metadata || {}
  if (typeof meta.name === "string" && meta.name.trim()) return meta.name.trim()
  if (typeof meta.full_name === "string" && meta.full_name.trim()) return meta.full_name.trim()
  // 2. Fall back to email prefix (e.g. "zaid" from "zaid@example.com")
  if (user.email) {
    const prefix = user.email.split("@")[0]
    // Capitalize first letter for a nicer display
    return prefix.charAt(0).toUpperCase() + prefix.slice(1)
  }
  return null
}

export function useAuth() {
  const [auth, setAuth] = useState<AuthState>(DEFAULT_AUTH)
  const [usage, setUsage] = useState<UsageState>(DEFAULT_USAGE)
  // Keep refreshUsage stable so the auth effect doesn't re-run on every render
  const refreshUsageRef = useRef<() => Promise<void>>(async () => {})

  // refreshUsage: fetch the user's current usage state from the backend
  const refreshUsage = useCallback(async () => {
    try {
      const res = await fetch("/api/usage")
      if (!res.ok) return
      const data = await res.json()
      setUsage({
        tier: data.tier,
        usedToday: data.usedToday,
        limit: data.limit,
        remaining: data.remaining,
        bulkLimit: data.bulkLimit,
        canCheck: data.canCheck,
        canUseBulk: data.canUseBulk,
        isAuthenticated: data.isAuthenticated,
      })
      setAuth((prev) => ({
        ...prev,
        tier: data.tier,
        isPro: data.tier === TIERS.PRO,
        email: data.email ?? prev.email,
        name: data.name ?? prev.name,
        isAuthenticated: data.isAuthenticated,
      }))
    } catch {
      // silent fail (network blocked, etc.)
    }
  }, [])

  // Keep ref in sync so the auth subscription below always calls the latest
  useEffect(() => {
    refreshUsageRef.current = refreshUsage
  }, [refreshUsage])

  // Subscribe to Supabase auth state changes + initial session check.
  useEffect(() => {
    let mounted = true

    const applySession = (session: { user: User } | null) => {
      if (!mounted) return
      if (session?.user) {
        setAuth({
          user: session.user,
          email: session.user.email || null,
          name: getUserName(session.user),
          tier: TIERS.FREE, // will be refreshed from API
          loading: false,
          isPro: false,
          isAuthenticated: true,
        })
      } else {
        setAuth({ ...DEFAULT_AUTH, loading: false })
      }
      refreshUsageRef.current()
    }

    // Initial session check
    supabase.auth.getSession().then(({ data: { session } }) => applySession(session))

    // Listen for auth state changes
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return
      if (event === "SIGNED_IN" && session?.user) {
        applySession(session)
      } else if (event === "SIGNED_OUT") {
        setAuth({ ...DEFAULT_AUTH, loading: false })
        setUsage(DEFAULT_USAGE)
      } else if (event === "TOKEN_REFRESHED" && session?.user) {
        applySession(session)
      } else if (event === "USER_UPDATED" && session?.user) {
        applySession(session)
      } else if (event === "PASSWORD_RECOVERY" && session?.user) {
        // User clicked the reset-password link from their email.
        // They're now logged in to a "recovery" session. The UI should
        // prompt them to set a new password. For now, we just log them in
        // and they can change password via account page later.
        applySession(session)
      }
    })

    return () => {
      mounted = false
      sub.subscription.unsubscribe()
    }
  }, [])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setAuth({ ...DEFAULT_AUTH, loading: false })
    setUsage(DEFAULT_USAGE)
  }, [])

  return {
    auth,
    usage,
    refreshUsage,
    signOut,
  }
}
