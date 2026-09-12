"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  X, Zap, CheckCircle2, Loader2, Crown, Sparkles,
  ShieldCheck, FileText, Rocket,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { supabase } from "@/lib/supabase-client"
import { toast } from "sonner"

interface UpgradeModalProps {
  open: boolean
  onClose: () => void
  currentUserEmail?: string | null
  onUpgraded?: () => void
}

const LEMONSQUEEZY_URL = process.env.NEXT_PUBLIC_LEMON_SQUEEZY_CHECKOUT_URL || "https://affiliate-link-checker.lemonsqueezy.com/checkout"

export function UpgradeModal({ open, onClose, currentUserEmail, onUpgraded }: UpgradeModalProps) {
  const [stage, setStage] = useState<"offer" | "checkout" | "verify" | "done">("offer")
  const [email, setEmail] = useState("")
  const [receiptId, setReceiptId] = useState("")
  const [verifying, setVerifying] = useState(false)

  useEffect(() => {
    if (open) {
      setStage("offer")
      setEmail(currentUserEmail || "")
      setReceiptId("")
      setVerifying(false)
    }
  }, [open, currentUserEmail])

  // Listen for auth changes (if user signs in during upgrade flow)
  useEffect(() => {
    if (!open) return
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session?.user?.email) {
        setEmail(session.user.email)
      }
    })
    return () => sub.subscription.unsubscribe()
  }, [open])

  const handleCheckout = () => {
    // Open Lemon Squeezy checkout in a new tab + take user to verify stage
    // Pre-fill email if logged in
    const checkoutUrl = currentUserEmail
      ? `${LEMONSQUEEZY_URL}?checkout[email]=${encodeURIComponent(currentUserEmail)}`
      : LEMONSQUEEZY_URL
    window.open(checkoutUrl, "_blank", "noopener,noreferrer")
    setStage("verify")
  }

  const handleVerify = async () => {
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error("Please enter a valid email")
      return
    }
    setVerifying(true)
    try {
      const res = await fetch("/api/upgrade-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          receiptId: receiptId || undefined,
        }),
      })
      const data = await res.json()
      if (data.alreadyPro) {
        setStage("done")
        toast.success("Pro access activated. Welcome aboard!")
        setTimeout(() => {
          onUpgraded?.()
          onClose()
        }, 2000)
      } else if (data.pending) {
        toast.success(data.message)
        setStage("done")
        setTimeout(() => {
          onClose()
        }, 3000)
      } else if (data.ok === false) {
        toast.error(data.message || data.error || "Verification failed")
      } else {
        toast.error("Could not verify. Try again in a minute.")
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Network error")
    } finally {
      setVerifying(false)
    }
  }

  const features = [
    "Unlimited single-URL checks — no daily cap",
    "Bulk URL checker (up to 50 URLs at once)",
    "Export results as CSV / JSON",
    "Priority fetch (faster scans, less waiting)",
    "No ads, ever",
    "Lifetime access — pay once, use forever",
  ]

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
            className="relative w-full max-w-lg bg-card border border-border rounded-2xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={onClose}
              className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors z-10"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Gradient header */}
            <div className="relative bg-gradient-to-br from-primary via-chart-2 to-chart-3 p-6 pb-8 text-primary-foreground">
              <div className="absolute inset-0 grid-bg opacity-20" />
              <div className="absolute top-0 right-0 w-48 h-48 rounded-full blur-3xl opacity-30 bg-white" />
              <div className="relative flex items-center gap-2 mb-2">
                <Crown className="w-5 h-5" />
                <span className="text-xs font-semibold uppercase tracking-wider opacity-90">
                  Lifetime Pro
                </span>
              </div>
              <h2 className="relative text-2xl sm:text-3xl font-bold mb-1">
                Go Pro for $9, once.
              </h2>
              <p className="relative text-sm opacity-80">
                Pay once. Use forever. No subscriptions, no monthly fees.
              </p>
            </div>

            <div className="p-6 sm:p-7 -mt-4">
              {stage === "offer" && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  {/* Price */}
                  <div className="flex items-baseline gap-2 mb-4">
                    <span className="text-4xl font-bold">$9</span>
                    <span className="text-muted-foreground line-through">$29</span>
                    <Badge className="ml-2 bg-amber-500/15 text-amber-600 border-amber-500/30">
                      Launch offer
                    </Badge>
                  </div>

                  {/* Features list */}
                  <ul className="space-y-2.5 mb-6">
                    {features.map((f) => (
                      <li key={f} className="flex items-start gap-2.5 text-sm">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>

                  {/* CTA */}
                  <Button
                    onClick={handleCheckout}
                    size="lg"
                    className="w-full h-12 font-semibold gap-2 shadow-lg shadow-primary/20 group"
                  >
                    <Zap className="w-4 h-4 group-hover:scale-110 transition-transform" />
                    Get lifetime Pro for $9
                  </Button>

                  <div className="mt-3 text-center text-[11px] text-muted-foreground">
                    Secure checkout via Lemon Squeezy · 30-day money-back guarantee
                  </div>
                </motion.div>
              )}

              {stage === "verify" && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-4"
                >
                  <div className="rounded-lg bg-primary/5 border border-primary/20 p-4">
                    <div className="flex items-start gap-2.5">
                      <Sparkles className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                      <div>
                        <div className="font-medium text-sm mb-1">Almost there!</div>
                        <div className="text-xs text-muted-foreground leading-relaxed">
                          Complete your purchase on Lemon Squeezy. Then come back and verify your email
                          so we can activate your Pro access.
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1 block">
                        Email you used to pay
                      </label>
                      <Input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        className="h-11"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1 block">
                        Lemon Squeezy receipt ID <span className="opacity-60">(optional)</span>
                      </label>
                      <Input
                        type="text"
                        value={receiptId}
                        onChange={(e) => setReceiptId(e.target.value)}
                        placeholder="e.g. abc123def456"
                        className="h-11"
                      />
                      <div className="text-[10px] text-muted-foreground mt-1">
                        Leave blank if you paid but the webhook isn't set up yet — we'll verify manually.
                      </div>
                    </div>

                    <Button
                      onClick={handleVerify}
                      disabled={verifying}
                      className="w-full h-11 font-semibold gap-2"
                    >
                      {verifying ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Verifying...
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-4 h-4" />
                          I've paid — verify my access
                        </>
                      )}
                    </Button>

                    <button
                      onClick={handleCheckout}
                      className="w-full text-xs text-primary hover:underline"
                    >
                      Didn't finish checkout? Open Lemon Squeezy again
                    </button>
                  </div>
                </motion.div>
              )}

              {stage === "done" && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="text-center py-8"
                >
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-500/10 flex items-center justify-center">
                    <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                  </div>
                  <h3 className="text-xl font-bold mb-1">All set!</h3>
                  <p className="text-sm text-muted-foreground">
                    Your Pro access is being activated. Refresh the page in a moment —
                    you'll see the gold Pro badge.
                  </p>
                </motion.div>
              )}

              {/* Trust badges */}
              {stage === "offer" && (
                <div className="mt-5 pt-5 border-t border-border/40 grid grid-cols-3 gap-3 text-center">
                  <div className="flex flex-col items-center gap-1">
                    <ShieldCheck className="w-4 h-4 text-primary" />
                    <span className="text-[10px] text-muted-foreground">Secure pay</span>
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <FileText className="w-4 h-4 text-primary" />
                    <span className="text-[10px] text-muted-foreground">Money back</span>
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <Rocket className="w-4 h-4 text-primary" />
                    <span className="text-[10px] text-muted-foreground">Lifetime use</span>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function Badge({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold border ${className}`}>
      {children}
    </span>
  )
}
