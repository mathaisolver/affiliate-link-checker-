"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import type { User } from "@supabase/supabase-js"
import { supabase } from "@/lib/supabase-client"
import { TIERS, type Tier } from "@/lib/tiers"

export interface AuthState {
  user: User | null
  email: string | null
  tier: Tier
  loading: boolean
  isPro: boolean
  isAuthenticated: boolean
}

export interface UsageState {
  tier: Tier
  usedToday: number
  limit: number
  remaining: number
  bulkLimit: number
  canCheck: boolean
  canUseBulk: boolean
}

const DEFAULT_AUTH: AuthState = {
  user: null,
  email: null,
  tier: TIERS.ANON,
  loading: true,
  isPro: false,
  isAuthenticated: false,
}

const DEFAULT_USAGE: UsageState = {
  tier: TIERS.ANON,
  usedToday: 0,
  limit: 1,
  remaining: 1,
  bulkLimit: 0,
  canCheck: true,
  canUseBulk: false,
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
      })
      setAuth((prev) => ({
        ...prev,
        tier: data.tier,
        isPro: data.tier === TIERS.PRO,
        email: data.email ?? prev.email,
      }))
    } catch {
      // silent fail (network blocked, etc.)
    }
  }, [])

  // Keep ref in sync so the auth subscription below always calls the latest
  useEffect(() => {
    refreshUsageRef.current = refreshUsage
  }, [refreshUsage])

  // Subscribe to Supabase auth state changes + initial session check
  useEffect(() => {
    let mounted = true

    const applySession = (session: { user: User } | null) => {
      if (!mounted) return
      if (session?.user) {
        setAuth({
          user: session.user,
          email: session.user.email || null,
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

    supabase.auth.getSession().then(({ data: { session } }) => applySession(session))

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return
      if (event === "SIGNED_IN" && session?.user) {
        applySession(session)
      } else if (event === "SIGNED_OUT") {
        setAuth({ ...DEFAULT_AUTH, loading: false })
        setUsage(DEFAULT_USAGE)
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
