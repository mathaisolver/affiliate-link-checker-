"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  X, Mail, Loader2, CheckCircle2, ShieldCheck, Zap, Lock, User as UserIcon, Eye, EyeOff, ArrowLeft,
} from "lucide-react"
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

type Mode = "signup" | "login" | "forgot"

export function AuthModal({ open, onClose, onSuccess, reason = "signup" }: AuthModalProps) {
  const [mode, setMode] = useState<Mode>("signup")
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setName("")
      setEmail("")
      setPassword("")
      setShowPassword(false)
      setLoading(false)
      setError(null)
      setInfo(null)
      setMode(reason === "rate-limit" ? "signup" : "signup")
    }
  }, [open, reason])

  // Listen for auth state changes (user logs in → modal should close)
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setInfo(null)

    // Validation
    if (mode === "signup" && !name.trim()) {
      setError("Please enter your name")
      return
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Please enter a valid email address")
      return
    }
    if (mode !== "forgot" && (!password || password.length < 6)) {
      setError("Password must be at least 6 characters")
      return
    }

    setLoading(true)
    try {
      if (mode === "forgot") {
        // === FORGOT PASSWORD FLOW ===
        // Sends a password reset email. NOTE: this requires SMTP to be configured.
        // If SMTP is not set up, the user will see a success message but no email
        // arrives. The reset link in Supabase's auth dashboard can be used as fallback.
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin,
        })
        if (resetError) throw resetError
        setInfo("Password reset link sent. Check your email inbox.")
        toast.success("Reset link sent — check your inbox")
        // Stay on forgot screen so user sees the success message
      } else if (mode === "signup") {
        // === SIGNUP FLOW ===
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              name: name.trim(),
              full_name: name.trim(),
            },
          },
        })

        if (signUpError) throw signUpError

        // Check if email confirmation is required
        if (data?.user && !data?.session) {
          setInfo("We sent a confirmation link to your email. Click it, then log in. (Tip: turn off email confirmation in Supabase to skip this step.)")
          setMode("login")
        } else if (data?.session) {
          toast.success("Welcome! Account created.")
        }
      } else {
        // === LOGIN FLOW ===
        const { data, error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        })
        if (signInError) throw signInError
        toast.success("Welcome back!")
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Authentication failed"
      setError(msg)
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  const reasonText = {
    "rate-limit":
      "Sign up free to start checking affiliate links. Free accounts get 3 checks per day. No email confirmation needed.",
    signup:
      "Sign up to get 3 free checks per day. Just enter your name, email, and password. No email confirmation needed.",
    bulk:
      "Bulk URL checker is a Pro feature. Sign up first, then upgrade for $9 lifetime to unlock it.",
  }[reason]

  const title = {
    signup: reason === "rate-limit" ? "Sign up to use the tool" : "Create your free account",
    login: "Welcome back",
    forgot: "Reset your password",
  }[mode]

  const submitText = {
    signup: "Create free account",
    login: "Log in",
    forgot: "Send reset link",
  }[mode]

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

              {/* Back button for forgot password mode */}
              {mode === "forgot" && (
                <button
                  type="button"
                  onClick={() => { setMode("login"); setError(null); setInfo(null) }}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors mb-3"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Back to login
                </button>
              )}

              {/* Mode tabs (signup / login) — hidden in forgot mode */}
              {mode !== "forgot" && (
                <div className="flex gap-1 p-1 rounded-lg bg-secondary/60 mb-5">
                  <button
                    type="button"
                    onClick={() => { setMode("signup"); setError(null); setInfo(null) }}
                    className={`flex-1 py-1.5 rounded-md text-sm font-medium transition-all ${
                      mode === "signup"
                        ? "bg-card shadow-sm text-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Create account
                  </button>
                  <button
                    type="button"
                    onClick={() => { setMode("login"); setError(null); setInfo(null) }}
                    className={`flex-1 py-1.5 rounded-md text-sm font-medium transition-all ${
                      mode === "login"
                        ? "bg-card shadow-sm text-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Log in
                  </button>
                </div>
              )}

              <h2 className="text-xl font-bold mb-1">{title}</h2>
              <p className="text-sm text-muted-foreground mb-5 leading-relaxed">
                {mode === "forgot"
                  ? "Enter your email and we'll send you a link to reset your password."
                  : reasonText}
              </p>

              {/* Error banner */}
              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mb-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-sm"
                  >
                    {error}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Info banner (for forgot password success / email confirmation notice) */}
              <AnimatePresence>
                {info && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mb-4 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-sm"
                  >
                    {info}
                  </motion.div>
                )}
              </AnimatePresence>

              <form onSubmit={handleSubmit} className="space-y-3">
                {mode === "signup" && (
                  <div className="relative">
                    <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Your name"
                      className="pl-10 h-12"
                      autoFocus
                      required
                    />
                  </div>
                )}

                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="pl-10 h-12"
                    required
                    autoFocus={mode === "forgot"}
                  />
                </div>

                {mode !== "forgot" && (
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={mode === "signup" ? "Min 6 characters" : "Your password"}
                      className="pl-10 pr-10 h-12"
                      required
                      minLength={6}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                )}

                {/* Forgot password link (only on login mode) */}
                {mode === "login" && (
                  <div className="text-right -mt-1">
                    <button
                      type="button"
                      onClick={() => { setMode("forgot"); setError(null); setInfo(null) }}
                      className="text-xs text-muted-foreground hover:text-primary transition-colors"
                    >
                      Forgot password?
                    </button>
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full h-12 font-semibold gap-2 mt-1"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {mode === "signup" ? "Creating account..." : mode === "login" ? "Logging in..." : "Sending link..."}
                    </>
                  ) : (
                    submitText
                  )}
                </Button>
              </form>

              {mode !== "forgot" && (
                <ul className="mt-5 space-y-2 text-xs text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-primary mt-0.5 flex-shrink-0" />
                    <span>
                      {mode === "signup"
                        ? "No email confirmation needed."
                        : "Your password is stored securely via Supabase Auth."}
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-primary mt-0.5 flex-shrink-0" />
                    <span>3 free checks per day for free accounts.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Zap className="w-3.5 h-3.5 text-amber-500 mt-0.5 flex-shrink-0" />
                    <span>
                      Want unlimited?{" "}
                      <button
                        type="button"
                        onClick={onClose}
                        className="text-primary underline font-medium"
                      >
                        Go Pro for $9 lifetime
                      </button>
                    </span>
                  </li>
                </ul>
              )}

              {/* Switch mode link (hidden in forgot mode) */}
              {mode !== "forgot" && (
                <div className="mt-4 text-center text-xs text-muted-foreground">
                  {mode === "signup" ? (
                    <>
                      Already have an account?{" "}
                      <button
                        type="button"
                        onClick={() => { setMode("login"); setError(null); setInfo(null) }}
                        className="text-primary underline font-medium"
                      >
                        Log in
                      </button>
                    </>
                  ) : (
                    <>
                      Don&apos;t have an account?{" "}
                      <button
                        type="button"
                        onClick={() => { setMode("signup"); setError(null); setInfo(null) }}
                        className="text-primary underline font-medium"
                      >
                        Sign up free
                      </button>
                    </>
                  )}
                </div>
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
