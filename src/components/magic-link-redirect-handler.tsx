"use client"

import { useEffect } from "react"
import { supabase } from "@/lib/supabase-client"

/**
 * Cleans the URL hash after a magic link redirect.
 *
 * When the user clicks a magic link in their email, Supabase redirects to
 * the Site URL with #access_token=...&refresh_token=...&type=magiclink
 * appended. The Supabase JS client detects this in the URL and exchanges
 * it for a session automatically. After that, we should strip these
 * tokens from the URL bar so they don't:
 *   1. Leak to third parties via Referer header
 *   2. Confuse the user with a long ugly URL
 *   3. Get cached by the browser history
 *
 * Drop this component once at the top of the app (layout.tsx or page.tsx)
 * and it will clean up any auth-related hash fragments on page load.
 */
export function MagicLinkRedirectHandler() {
  useEffect(() => {
    if (typeof window === "undefined") return
    if (!window.location.hash) return

    const hash = window.location.hash
    // Only act on hashes that look like auth redirects
    if (!hash.includes("access_token") && !hash.includes("error_description")) {
      return
    }

    // Let Supabase process the hash first (detectSessionInUrl: true)
    // Then strip the hash from the URL bar using history.replaceState
    const cleanup = setTimeout(() => {
      try {
        // Replace the URL without the hash
        const cleanUrl = window.location.origin + window.location.pathname + window.location.search
        window.history.replaceState(null, "", cleanUrl)
      } catch {
        // ignore
      }
    }, 500)

    return () => clearTimeout(cleanup)
  }, [])

  return null
}
