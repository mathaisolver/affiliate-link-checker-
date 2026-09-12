"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  Search, Zap, Crown, Check, X, ArrowRight, ShieldCheck,
  Sparkles, Rocket, FileText, Users, LogOut,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useAuth } from "@/hooks/use-auth"
import { UpgradeModal } from "@/components/upgrade-modal"
import { AuthModal } from "@/components/auth-modal"
import { supabase } from "@/lib/supabase-client"

const tiers = [
  {
    id: "free",
    name: "Free",
    price: "$0",
    period: "forever",
    tagline: "Sign up free, no credit card needed",
    icon: Sparkles,
    color: "border-border/60",
    features: [
      { text: "3 affiliate checks per day", included: true },
      { text: "All 30+ affiliate networks detected", included: true },
      { text: "FTC disclosure scanner", included: true },
      { text: "Sample affiliate links list", included: true },
      { text: "Magic-link login, no password", included: true },
      { text: "Bulk URL checker", included: false },
      { text: "CSV / JSON export", included: false },
      { text: "No daily limit", included: false },
    ],
    cta: "Sign up free",
  },
  {
    id: "pro",
    name: "Pro",
    price: "$9",
    period: "lifetime",
    tagline: "Pay once, use forever. No subscription.",
    icon: Crown,
    color: "border-primary ring-2 ring-primary/30",
    highlight: true,
    features: [
      { text: "Unlimited affiliate checks, forever", included: true },
      { text: "All 30+ affiliate networks detected", included: true },
      { text: "FTC disclosure scanner", included: true },
      { text: "Sample affiliate links list", included: true },
      { text: "Bulk URL checker (up to 50 URLs at once)", included: true },
      { text: "CSV / JSON export", included: true },
      { text: "Priority fetch queue, faster scans", included: true },
      { text: "No ads, ever", included: true },
    ],
    cta: "Go Pro for $9",
  },
]

export default function PricingPage() {
  const router = useRouter()
  const { auth, signOut, refreshUsage } = useAuth()
  const [authModalOpen, setAuthModalOpen] = useState(false)
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false)
  const [confirmSignOut, setConfirmSignOut] = useState(false)

  const handleCta = (tierId: string) => {
    if (tierId === "free") {
      if (auth.isAuthenticated) {
        router.push("/")
      } else {
        setAuthModalOpen(true)
      }
      return
    }
    if (tierId === "pro") {
      if (!auth.isAuthenticated) {
        setAuthModalOpen(true)
        return
      }
      setUpgradeModalOpen(true)
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      {/* ===== Top Nav (same as home) ===== */}
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/70 backdrop-blur-xl">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="relative w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-chart-2 flex items-center justify-center shadow-lg">
              <Link2Icon className="w-5 h-5 text-primary-foreground" />
            </div>
            <div className="leading-tight">
              <div className="font-bold text-base tracking-tight">
                Affiliate<span className="text-gradient">Link</span>Checker
              </div>
              <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground hidden sm:block">
                Detector & Disclosure Finder
              </div>
            </div>
          </Link>
          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-muted-foreground">
            <Link href="/#features" className="hover:text-foreground transition-colors">Features</Link>
            <Link href="/#how-it-works" className="hover:text-foreground transition-colors">How it works</Link>
            <Link href="/#networks" className="hover:text-foreground transition-colors">Networks</Link>
            <Link href="/pricing" className="text-foreground font-semibold">Pricing</Link>
            <Link href="/#guide" className="hover:text-foreground transition-colors">Guide</Link>
          </nav>
          <div className="flex items-center gap-2">
            {auth.isPro && (
              <span className="hidden sm:inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-semibold bg-amber-500/15 text-amber-600 border border-amber-500/30">
                <Crown className="w-3 h-3" /> Pro
              </span>
            )}
            {auth.isAuthenticated ? (
              <Button onClick={() => setConfirmSignOut(true)} variant="outline" size="sm">
                Sign out
              </Button>
            ) : (
              <>
                <Button onClick={() => setAuthModalOpen(true)} variant="ghost" size="sm" className="hidden sm:flex">
                  Sign in
                </Button>
                <Button asChild size="sm" className="gap-1.5">
                  <Link href="/"><ArrowRight className="w-3.5 h-3.5 rotate-180" /> Back to tool</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ===== Hero ===== */}
      <section className="relative overflow-hidden pt-16 sm:pt-20 pb-12">
        <div className="absolute inset-0 grid-bg pointer-events-none" aria-hidden />
        <div
          className="absolute top-[-10%] left-[-10%] w-[480px] h-[480px] rounded-full blur-3xl opacity-40 animate-blob pointer-events-none"
          style={{ background: "radial-gradient(circle, oklch(0.55 0.22 285 / 0.55), transparent 60%)" }}
          aria-hidden
        />
        <div
          className="absolute top-[10%] right-[-10%] w-[420px] h-[420px] rounded-full blur-3xl opacity-40 animate-blob pointer-events-none"
          style={{ background: "radial-gradient(circle, oklch(0.6 0.22 320 / 0.55), transparent 60%)", animationDelay: "4s" }}
          aria-hidden
        />

        <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="max-w-3xl mx-auto text-center">
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
              <Badge variant="outline" className="px-4 py-1.5 rounded-full gap-2 backdrop-blur-md bg-background/60 mb-6">
                <Sparkles className="w-3.5 h-3.5 text-primary" />
                <span className="text-xs font-medium tracking-wide">Simple, transparent pricing</span>
              </Badge>
            </motion.div>
            <motion.h1
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.05 }}
              className="text-4xl sm:text-6xl font-extrabold tracking-tight leading-[1.05] mb-6"
            >
              Sign up free. <span className="text-gradient-animated">Go Pro for $9.</span>
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.12 }}
              className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto"
            >
              Sign up free and get 3 checks per day. Or pay $9 once for unlimited checks forever. No subscriptions, no monthly fees, no surprise charges.
            </motion.p>
          </div>
        </div>
      </section>

      {/* ===== Pricing cards ===== */}
      <section className="container mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-4xl mx-auto">
          {tiers.map((tier, i) => (
            <motion.div
              key={tier.id}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
            >
              <Card className={`relative p-6 sm:p-8 h-full ${tier.color} ${tier.highlight ? 'shadow-2xl shadow-primary/20' : ''}`}>
                {tier.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-gradient-to-r from-primary to-chart-2 text-primary-foreground border-0 px-3 py-1 text-xs font-semibold tracking-wide">
                      <Crown className="w-3 h-3 mr-1" /> BEST VALUE
                    </Badge>
                  </div>
                )}
                <div className="flex items-center gap-3 mb-1">
                  <div className={`w-10 h-10 rounded-xl ${tier.highlight ? 'bg-gradient-to-br from-primary to-chart-2' : 'bg-secondary'} flex items-center justify-center`}>
                    <tier.icon className={`w-5 h-5 ${tier.highlight ? 'text-primary-foreground' : 'text-foreground'}`} />
                  </div>
                  <h3 className="font-bold text-lg">{tier.name}</h3>
                </div>
                <p className="text-xs text-muted-foreground mb-5 min-h-[2.5em]">{tier.tagline}</p>

                <div className="flex items-baseline gap-1 mb-6">
                  <span className="text-4xl font-extrabold tracking-tight">{tier.price}</span>
                  <span className="text-sm text-muted-foreground">/ {tier.period}</span>
                </div>

                <Button
                  onClick={() => handleCta(tier.id)}
                  variant={tier.highlight ? "default" : "outline"}
                  className={`w-full h-12 font-semibold gap-2 mb-6 ${
                    tier.highlight ? 'shadow-lg shadow-primary/20' : ''
                  }`}
                  disabled={auth.isPro && tier.id === 'pro'}
                >
                  {auth.isPro && tier.id === 'pro' ? (
                    <>
                      <Check className="w-4 h-4" /> You're Pro
                    </>
                  ) : (
                    <>
                      {tier.cta}
                      {tier.highlight && <ArrowRight className="w-4 h-4" />}
                    </>
                  )}
                </Button>

                <ul className="space-y-2.5">
                  {tier.features.map((f) => (
                    <li key={f.text} className="flex items-start gap-2.5 text-sm">
                      {f.included ? (
                        <Check className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                      ) : (
                        <X className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5 opacity-40" />
                      )}
                      <span className={f.included ? '' : 'text-muted-foreground/60 line-through'}>
                        {f.text}
                      </span>
                    </li>
                  ))}
                </ul>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Money-back guarantee strip */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="mt-10 max-w-3xl mx-auto text-center"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-sm">
            <ShieldCheck className="w-4 h-4" />
            30-day money-back guarantee · No questions asked
          </div>
        </motion.div>
      </section>

      {/* ===== FAQ ===== */}
      <section className="container mx-auto px-4 sm:px-6 lg:px-8 pb-20">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-center mb-10">
            Frequently asked questions
          </h2>
          <div className="space-y-4">
            {[
              {
                q: "What does lifetime access actually mean?",
                a: "You pay $9 once. You get unlimited affiliate link checks for as long as the tool exists. No monthly fees, no annual renewal, no automatic charges.",
              },
              {
                q: "How does the bulk checker work?",
                a: "Paste up to 50 URLs (one per line). We scan them all in parallel and return a sortable table with affiliate networks, ad networks, link counts, and disclosure status for each URL. You can export the results as CSV.",
              },
              {
                q: "Can I get a refund if I don't like it?",
                a: "Yes. Email us within 30 days of your purchase and we'll refund the full $9, no questions asked. We'll downgrade your account back to the free tier.",
              },
              {
                q: "What payment methods do you accept?",
                a: "We use Lemon Squeezy to process payments. They accept all major credit cards, debit cards, Apple Pay, Google Pay, and PayPal.",
              },
              {
                q: "Is my data safe?",
                a: "We only store the URLs you check and your email address. We never sell or share your data. All passwords are managed by Supabase Auth, we never see them.",
              },
              {
                q: "Do you offer team plans?",
                a: "Not yet. The $9 lifetime plan is per user. If you need team access (shared bulk jobs, multi-seat billing), email us and we'll set it up.",
              },
            ].map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ duration: 0.4, delay: i * 0.05 }}
              >
                <Card className="p-5">
                  <h3 className="font-semibold text-base mb-2">{item.q}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{item.a}</p>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== Final CTA ===== */}
      <section className="container mx-auto px-4 sm:px-6 lg:px-8 pb-20">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.6 }}
          className="relative max-w-4xl mx-auto"
        >
          <Card className="relative overflow-hidden p-8 sm:p-12 text-center border-0 bg-gradient-to-br from-primary via-chart-2 to-chart-3 text-primary-foreground">
            <div className="absolute inset-0 grid-bg opacity-20" />
            <div className="absolute top-0 right-0 w-64 h-64 rounded-full blur-3xl opacity-30 bg-white" />
            <div className="relative">
              <Rocket className="w-10 h-10 mx-auto mb-5" />
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-3">
                Ready to unlock Pro?
              </h2>
              <p className="text-primary-foreground/80 text-base sm:text-lg mb-7 max-w-xl mx-auto">
                Join the users who never hit a daily limit again. Pay once, use forever.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                {auth.isPro ? (
                  <Button asChild size="lg" variant="secondary" className="h-12 px-7 font-semibold gap-2">
                    <Link href="/"><Search className="w-4 h-4" /> Start checking</Link>
                  </Button>
                ) : (
                  <Button
                    onClick={() => handleCta('pro')}
                    size="lg"
                    variant="secondary"
                    className="h-12 px-7 font-semibold gap-2"
                  >
                    <Crown className="w-4 h-4" /> Get Pro for $9
                  </Button>
                )}
                <Button asChild size="lg" variant="outline" className="h-12 px-7 font-semibold gap-2 bg-transparent border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground">
                  <Link href="/"><ArrowRight className="w-4 h-4 rotate-180" /> Back to tool</Link>
                </Button>
              </div>
            </div>
          </Card>
        </motion.div>
      </section>

      {/* ===== Footer ===== */}
      <footer className="mt-auto border-t border-border/40 py-10 bg-muted/10">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 text-center text-xs text-muted-foreground">
          Free affiliate link checker. Check Amazon, ShareASale, CJ Affiliate, Awin, and 30+ affiliate networks. No sign up, no fee, no ads. Built for bloggers, affiliate marketers, and SEO pros who need to keep their links fresh and FTC compliant.
        </div>
      </footer>

      {/* ===== Modals ===== */}
      <AuthModal
        open={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        reason="signup"
        onSuccess={() => refreshUsage()}
      />
      <UpgradeModal
        open={upgradeModalOpen}
        onClose={() => setUpgradeModalOpen(false)}
        currentUserEmail={auth.email}
        onUpgraded={() => refreshUsage()}
      />

      {/* Logout confirmation */}
      <AnimatePresence>
        {confirmSignOut && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={() => setConfirmSignOut(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              transition={{ type: "spring", duration: 0.4 }}
              className="relative w-full max-w-sm bg-card border border-border rounded-2xl shadow-2xl overflow-hidden p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start gap-3 mb-5">
                <div className="w-10 h-10 rounded-xl bg-rose-500/10 flex items-center justify-center flex-shrink-0">
                  <LogOut className="w-5 h-5 text-rose-500" />
                </div>
                <div>
                  <h3 className="font-bold text-base mb-1">Sign out?</h3>
                  <p className="text-sm text-muted-foreground">
                    You&apos;ll need to log in again to use the tool. Your account and any saved data will stay safe.
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={() => setConfirmSignOut(false)}
                  variant="outline"
                  size="sm"
                  className="flex-1 h-10"
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => { setConfirmSignOut(false); signOut() }}
                  size="sm"
                  className="flex-1 h-10 bg-rose-500 hover:bg-rose-600 text-white gap-1.5"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Sign out
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function Link2Icon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 17H7A5 5 0 0 1 7 7h2" />
      <path d="M15 7h2a5 5 0 0 1 0 10h-2" />
      <line x1="8" y1="12" x2="16" y2="12" />
    </svg>
  )
}
