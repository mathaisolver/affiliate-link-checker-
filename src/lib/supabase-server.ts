// Server-side Supabase client (uses service role key, NEVER expose to client)
// Used in API routes for privileged operations like rate-limit checks,
// payment verification, and bulk job management.

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
})

/**
 * Verify the JWT sent by the client and return the user_id (if logged in).
 * Returns null for anonymous users.
 */
export async function getUserFromRequest(req: Request): Promise<string | null> {
  try {
    const authHeader = req.headers.get('authorization')
    if (!authHeader) return null
    const token = authHeader.replace(/^Bearer\s+/i, '')
    if (!token) return null

    const {
      data: { user },
      error,
    } = await supabaseAdmin.auth.getUser(token)
    if (error || !user) return null
    return user.id
  } catch {
    return null
  }
}

/**
 * Hash an IP address for anonymous rate-limit tracking.
 * We store a SHA-256 hash (not the raw IP) to preserve privacy.
 */
export async function hashIp(ip: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(ip + '|affiliate-link-checker-salt-v1')
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}
