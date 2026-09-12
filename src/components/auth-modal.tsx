"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X, Mail, Loader2, CheckCircle2, ShieldCheck, Zap } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { supabase } from "@/lib/supabase-client"
import { toast } from "sonner"

interface AuthModalProps {
  open: boolean
  onClose: () => void
  onSuccess?: () => void
  reason?: "signup" | "rate-limit" | "bulk"
}

export function AuthModal({ open, onClose, onSuccess, reason = "signup" }: AuthModalProps) {
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setEmail("")
      setSent(false)
      setLoading(false)
    }
  }, [open])

  // Listen for auth state changes (user clicks magic link → comes back → modal should close)
  useEffect(() => {
    if (!open) return
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session?.user) {
        toast.success("Signed in as " + (session.user.email || ""))
        onSuccess?.()
        onClose()
      }
    })
    return () => sub.subscription.unsubscribe()
  }, [open, onClose, onSuccess])

  const handleSendMagicLink = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error("Please enter a valid email address")
      return
    }
    setLoading(true)
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: window.location.origin,
        },
      })
      if (error) throw error
      setSent(true)
      toast.success("Magic link sent! Check your inbox.")
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to send magic link")
    } finally {
      setLoading(false)
    }
  }

  const reasonText = {
    "rate-limit":
      "Sign up free to start checking affiliate links. Free accounts get 3 checks per day. No password needed, just a magic link to your email.",
    signup:
      "Sign up to get 3 free checks per day. It takes 10 seconds — no password, just a magic link to your email.",
    bulk:
      "Bulk URL checker is a Pro feature. Sign up first, then upgrade for $9 lifetime to unlock it.",
  }[reason]

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 10 }}
            transition={{ type: "spring", duration: 0.4 }}
            className="relative w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={onClose}
              className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="p-6 sm:p-8">
              {/* Logo */}
              <div className="flex items-center gap-2 mb-5">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-chart-2 flex items-center justify-center shadow-lg">
                  <ShieldCheck className="w-5 h-5 text-primary-foreground" />
                </div>
                <div className="font-bold text-base">Affiliate Link Checker</div>
              </div>

              {!sent ? (
                <>
                  <h2 className="text-xl font-bold mb-1">
                    {reason === "rate-limit" ? "Sign up to use the tool" : "Sign up for more checks"}
                  </h2>
                  <p className="text-sm text-muted-foreground mb-5 leading-relaxed">
                    {reasonText}
                  </p>

                  <form onSubmit={handleSendMagicLink} className="space-y-3">
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        className="pl-10 h-12"
                        autoFocus
                        required
                      />
                    </div>
                    <Button
                      type="submit"
                      disabled={loading}
                      className="w-full h-12 font-semibold gap-2"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Sending magic link...
                        </>
                      ) : (
                        <>Send magic link</>
                      )}
                    </Button>
                  </form>

                  <ul className="mt-5 space-y-2 text-xs text-muted-foreground">
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-primary mt-0.5 flex-shrink-0" />
                      <span>No password — just a one-tap login link to your email.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-primary mt-0.5 flex-shrink-0" />
                      <span>3 free checks per day for signed-up users.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Zap className="w-3.5 h-3.5 text-amber-500 mt-0.5 flex-shrink-0" />
                      <span>
                        Want unlimited? <button type="button" onClick={onClose} className="text-primary underline font-medium">Go Pro for $9 lifetime</button>.
                      </span>
                    </li>
                  </ul>
                </>
              ) : (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-center py-6"
                >
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-500/10 flex items-center justify-center">
                    <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                  </div>
                  <h2 className="text-xl font-bold mb-2">Check your inbox</h2>
                  <p className="text-sm text-muted-foreground mb-5">
                    We sent a magic link to <span className="font-semibold text-foreground">{email}</span>.
                    Click it to sign in.
                  </p>
                  <p className="text-xs text-muted-foreground mb-4">
                    The link expires in 1 hour. Keep this tab open — you'll be logged in automatically when you click it.
                  </p>
                  <Button
                    onClick={() => setSent(false)}
                    variant="outline"
                    size="sm"
                  >
                    Use a different email
                  </Button>
                </motion.div>
              )}
            </div>

            <div className="px-6 pb-5 -mt-2 text-center text-[11px] text-muted-foreground">
              By signing up you agree to our terms. We never share your email. No spam.
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
