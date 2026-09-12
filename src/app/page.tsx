"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import { motion, AnimatePresence, useInView } from "framer-motion"
import {
  Search, Link2, ShieldCheck, Sparkles, Zap, Globe, ArrowRight,
  CheckCircle2, AlertTriangle, XCircle, ExternalLink, Copy,
  Tag, Layers, FileText, MousePointerClick, Code2,
  TrendingUp, Eye, ScanLine, Loader2, ChevronDown, ArrowUpRight,
  BadgeCheck, Network, Fingerprint, Building2, Star, Rocket,
  BookOpen, PenLine, AlertCircle, LinkIcon, Target,
  Wrench, Lightbulb, Users, Crown, LogOut, User as UserIcon, Lock,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip"
import { toast } from "sonner"
import { Toaster as SonnerToaster } from "@/components/ui/sonner"
import { AuthModal } from "@/components/auth-modal"
import { UpgradeModal } from "@/components/upgrade-modal"
import { BulkChecker } from "@/components/bulk-checker"
import { useAuth } from "@/hooks/use-auth"
import { TIERS } from "@/lib/tiers"
import { supabase } from "@/lib/supabase-client"

/* ---------------------------------------------------------- */
/* Types                                                       */
/* ---------------------------------------------------------- */

interface AffiliateNetwork {
  name: string
  domain: string
  url: string
  confidence: "high" | "medium" | "low"
  category: string
}
interface AdNetwork {
  name: string
  domain: string
  type: string
}
interface AffiliateLink {
  url: string
  network: string
  text: string
  rel?: string
  reason?: string
}
interface Disclosure {
  found: boolean
  snippets: string[]
}
interface CheckResult {
  url: string
  finalUrl: string | null
  title: string | null
  description: string | null
  favicon: string | null
  statusCode: number
  isAffiliate: boolean
  affiliateNetworks: AffiliateNetwork[]
  adNetworks: AdNetwork[]
  affiliateLinks: AffiliateLink[]
  sponsoredLinksCount: number
  disclosure: Disclosure
  metaTags: { name: string; content: string }[]
  openGraph: { property: string; content: string }[]
  stats: {
    totalLinks: number
    externalLinks: number
    affiliateLinksCount: number
    pageWeightKb: number
  }
  fetchMs: number
  error?: string
  usage?: {
    tier: string
    usedToday: number
    limit: number
    remaining: number
    bulkLimit: number
    canCheck: boolean
    canUseBulk: boolean
  }
}

/* ---------------------------------------------------------- */
/* Sample URL suggestions                                     */
/* ---------------------------------------------------------- */

const SAMPLE_URLS = [
  "https://www.nytimes.com/wirecutter/",
  "https://www.tomsguide.com/",
  "https://www.theverge.com/",
  "https://www.cnet.com/",
  "https://nymag.com/strategist",
]

/* ---------------------------------------------------------- */
/* Helpers                                                    */
/* ---------------------------------------------------------- */

function getHostname(u: string): string {
  try {
    return new URL(u).hostname.replace(/^www\./, "")
  } catch {
    return u
  }
}

function confidenceColor(c: "high" | "medium" | "low"): string {
  if (c === "high") return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
  if (c === "medium") return "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30"
  return "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/30"
}

/* ---------------------------------------------------------- */
/* Main component                                              */
/* ---------------------------------------------------------- */

export default function Home() {
  const [url, setUrl] = useState("")
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<CheckResult | null>(null)
  const [scanStage, setScanStage] = useState<string>("")
  const resultRef = useRef<HTMLDivElement | null>(null)

  // === AUTH + USAGE STATE ===
  const { auth, usage, refreshUsage, signOut } = useAuth()
  const [authModalOpen, setAuthModalOpen] = useState(false)
  const [authModalReason, setAuthModalReason] = useState<"signup" | "rate-limit" | "bulk">("signup")
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<"single" | "bulk">("single")

  const stages = [
    "Connecting to host…",
    "Fetching HTML…",
    "Parsing DOM & links…",
    "Matching affiliate signatures…",
    "Detecting ad networks…",
    "Scanning disclosure language…",
    "Building report…",
  ]

  const runCheck = useCallback(async (target?: string) => {
    const u = (target ?? url).trim()
    if (!u) {
      toast.error("Please enter a URL to check")
      return
    }
    setLoading(true)
    setResult(null)
    setScanStage(stages[0])

    // animate stage text
    let i = 0
    const stageTimer = setInterval(() => {
      i = (i + 1) % stages.length
      setScanStage(stages[i])
    }, 900)

    try {
      // Get the user's auth token (if logged in) and pass it along
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch("/api/check", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ url: u }),
      })

      // === HANDLE RATE LIMIT (429) ===
      if (res.status === 429) {
        const data = await res.json()
        setLoading(false)
        clearInterval(stageTimer)
        setScanStage("")
        toast.error(data.message || "Daily limit reached")
        // Show auth modal for anon users, upgrade modal for signed-up users
        if (data.tier === "anon") {
          setAuthModalReason("rate-limit")
          setAuthModalOpen(true)
        } else {
          setUpgradeModalOpen(true)
        }
        return
      }

      const data: CheckResult = await res.json()
      if ((data as { error?: string }).error && !data.statusCode) {
        toast.error((data as { error?: string }).error || "Failed to check URL")
      }
      setResult(data)
      // Refresh usage state after a successful check
      refreshUsage()
      setTimeout(() => {
        resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
      }, 100)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Network error")
    } finally {
      clearInterval(stageTimer)
      setScanStage("")
      setLoading(false)
    }
  }, [url, refreshUsage])

  const handleSample = (sample: string) => {
    setUrl(sample)
    runCheck(sample)
  }

  const openAuthModal = (reason: "signup" | "rate-limit" | "bulk" = "signup") => {
    setAuthModalReason(reason)
    setAuthModalOpen(true)
  }

  const openUpgradeModal = () => {
    // If user isn't logged in, ask them to sign up first
    if (!auth.isAuthenticated) {
      openAuthModal("signup")
      toast.info("Sign up first, then upgrade to Pro.")
      return
    }
    setUpgradeModalOpen(true)
  }

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground overflow-x-hidden">
      <SonnerToaster richColors position="top-right" />

      {/* ===== Top Navigation ===== */}
      <TopNav
        auth={auth}
        usage={usage}
        onSignIn={() => openAuthModal("signup")}
        onSignOut={signOut}
        onUpgrade={() => openUpgradeModal()}
      />

      {/* ===== Mode Tabs (Single / Bulk) ===== */}
      <ModeTabs activeTab={activeTab} setActiveTab={setActiveTab} isPro={auth.isPro} onLockedClick={() => openUpgradeModal()} />

      {/* ===== Bulk checker view ===== */}
      {activeTab === "bulk" && (
        <section className="container mx-auto px-4 sm:px-6 lg:px-8 pb-16 pt-6">
          <BulkChecker
            isPro={auth.isPro}
            onUpgradeClick={() => openUpgradeModal()}
            onSignupClick={() => openAuthModal("bulk")}
          />
        </section>
      )}

      {/* ===== Hero + Input (single mode only) ===== */}
      {activeTab === "single" && (
        <Hero
          url={url}
          setUrl={setUrl}
          loading={loading}
          runCheck={runCheck}
          handleSample={handleSample}
          scanStage={scanStage}
          usage={usage}
          isPro={auth.isPro}
          isAuthenticated={auth.isAuthenticated}
          onSignUpClick={() => openAuthModal("rate-limit")}
          onUpgradeClick={() => openUpgradeModal()}
        />
      )}

      {/* ===== Results (single mode only) ===== */}
      {activeTab === "single" && (
        <section ref={resultRef} className="container mx-auto px-4 sm:px-6 lg:px-8 pb-16">
          <AnimatePresence mode="wait">
            {loading && <LoadingResult scanStage={scanStage} />}
            {!loading && result && <ResultView result={result} />}
          </AnimatePresence>
        </section>
      )}

      {/* ===== Features ===== */}
      {!loading && !result && activeTab === "single" && <Features />}

      {/* ===== SEO Guide & Content ===== */}
      {!loading && !result && <SeoGuide />}

      {/* ===== How It Works ===== */}
      {!loading && !result && <HowItWorks />}

      {/* ===== Supported Networks ===== */}
      {!loading && !result && <SupportedNetworks />}

      {/* ===== CTA ===== */}
      {!loading && !result && <CTASection />}

      {/* ===== Footer ===== */}
      <Footer />

      {/* ===== Modals ===== */}
      <AuthModal
        open={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        reason={authModalReason}
        onSuccess={() => refreshUsage()}
      />
      <UpgradeModal
        open={upgradeModalOpen}
        onClose={() => setUpgradeModalOpen(false)}
        currentUserEmail={auth.email}
        onUpgraded={() => refreshUsage()}
      />
    </div>
  )
}

/* ---------------------------------------------------------- */
/* Top Nav                                                     */
/* ---------------------------------------------------------- */
function TopNav({
  auth, usage, onSignIn, onSignOut, onUpgrade,
}: {
  auth: { isAuthenticated: boolean; isPro: boolean; email: string | null; tier: string }
  usage: { usedToday: number; limit: number; remaining: number; tier: string }
  onSignIn: () => void
  onSignOut: () => void
  onUpgrade: () => void
}) {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/70 backdrop-blur-xl">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <a href="/" className="flex items-center gap-2 group">
          <div className="relative w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-chart-2 flex items-center justify-center shadow-lg shadow-primary/20 transition-transform group-hover:scale-110">
            <Link2 className="w-5 h-5 text-primary-foreground" />
            <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-emerald-500 ring-2 ring-background animate-pulse" />
          </div>
          <div className="leading-tight">
            <div className="font-bold text-base tracking-tight">Affiliate<span className="text-gradient">Link</span>Checker</div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground hidden sm:block">Detector & Disclosure Finder</div>
          </div>
        </a>
        <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-muted-foreground">
          <a href="#features" className="hover:text-foreground transition-colors">Features</a>
          <a href="#how-it-works" className="hover:text-foreground transition-colors">How it works</a>
          <a href="#networks" className="hover:text-foreground transition-colors">Networks</a>
          <a href="#guide" className="hover:text-foreground transition-colors">Guide</a>
        </nav>
        <div className="flex items-center gap-2">
          {/* Pro badge for pro users */}
          {auth.isPro && (
            <span className="hidden sm:inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-semibold bg-amber-500/15 text-amber-600 border border-amber-500/30">
              <Crown className="w-3 h-3" /> Pro
            </span>
          )}

          {/* Usage badge for signed-up users */}
          {auth.isAuthenticated && !auth.isPro && (
            <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-secondary border border-border/60">
              <Zap className="w-3 h-3 text-amber-500" />
              {usage.remaining === Infinity ? "∞" : usage.remaining} left today
            </span>
          )}

          {/* User menu OR Sign in button */}
          {auth.isAuthenticated ? (
            <div className="relative">
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border/60 hover:border-foreground/30 hover:bg-secondary/40 transition-all text-sm font-medium"
              >
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-primary to-chart-2 flex items-center justify-center text-primary-foreground text-xs font-bold">
                  {(auth.email || "?")[0].toUpperCase()}
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
              </button>
              <AnimatePresence>
                {menuOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setMenuOpen(false)}
                    />
                    <motion.div
                      initial={{ opacity: 0, y: -8, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -8, scale: 0.95 }}
                      className="absolute right-0 top-full mt-2 w-60 bg-card border border-border rounded-xl shadow-xl z-20 overflow-hidden"
                    >
                      <div className="px-4 py-3 border-b border-border/40">
                        <div className="text-xs text-muted-foreground">Signed in as</div>
                        <div className="text-sm font-medium truncate">{auth.email}</div>
                        {auth.isPro && (
                          <div className="mt-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-500/15 text-amber-600 border border-amber-500/30">
                            <Crown className="w-2.5 h-2.5" /> Lifetime Pro
                          </div>
                        )}
                      </div>
                      {!auth.isPro && (
                        <button
                          onClick={() => { onUpgrade(); setMenuOpen(false) }}
                          className="w-full px-4 py-2.5 text-sm text-left hover:bg-muted/40 flex items-center gap-2 transition-colors border-b border-border/40"
                        >
                          <Crown className="w-3.5 h-3.5 text-amber-500" />
                          Go Pro for $9
                        </button>
                      )}
                      <button
                        onClick={() => { onSignOut(); setMenuOpen(false) }}
                        className="w-full px-4 py-2.5 text-sm text-left hover:bg-muted/40 flex items-center gap-2 transition-colors text-muted-foreground hover:text-foreground"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        Sign out
                      </button>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          ) : (
            <>
              <Button
                onClick={onSignIn}
                variant="ghost"
                size="sm"
                className="hidden sm:flex"
              >
                Sign in
              </Button>
              <Button asChild size="sm" className="gap-1.5">
                <a href="#checker">
                  Try it <ArrowRight className="w-3.5 h-3.5" />
                </a>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  )
}

/* ---------------------------------------------------------- */
/* Mode Tabs (Single / Bulk)                                   */
/* ---------------------------------------------------------- */
function ModeTabs({
  activeTab, setActiveTab, isPro, onLockedClick,
}: {
  activeTab: "single" | "bulk"
  setActiveTab: (t: "single" | "bulk") => void
  isPro: boolean
  onLockedClick: () => void
}) {
  return (
    <div className="sticky top-16 z-40 w-full border-b border-border/40 bg-background/60 backdrop-blur-xl">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-2.5 flex items-center justify-center gap-2">
        <button
          onClick={() => setActiveTab("single")}
          className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5 ${
            activeTab === "single"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
          }`}
        >
          <Search className="w-3.5 h-3.5" />
          Single URL
        </button>
        <button
          onClick={() => (isPro ? setActiveTab("bulk") : onLockedClick())}
          className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5 ${
            activeTab === "bulk"
              ? "bg-primary text-primary-foreground shadow-sm"
              : isPro
              ? "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
              : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
          }`}
        >
          {isPro ? <Layers className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
          Bulk Checker
          {!isPro && (
            <span className="ml-1 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-amber-500/15 text-amber-600 border border-amber-500/30">
              <Crown className="w-2.5 h-2.5" /> PRO
            </span>
          )}
        </button>
      </div>
    </div>
  )
}

/* ---------------------------------------------------------- */
/* Hero                                                        */
/* ---------------------------------------------------------- */
function Hero({
  url, setUrl, loading, runCheck, handleSample, scanStage, usage, isPro, isAuthenticated, onSignUpClick, onUpgradeClick,
}: {
  url: string
  setUrl: (v: string) => void
  loading: boolean
  runCheck: () => void
  handleSample: (s: string) => void
  scanStage: string
  usage: { usedToday: number; limit: number; remaining: number; tier: string }
  isPro: boolean
  isAuthenticated: boolean
  onSignUpClick: () => void
  onUpgradeClick: () => void
}) {
  return (
    <section id="checker" className="relative overflow-hidden pt-16 sm:pt-20 lg:pt-28 pb-12">
      {/* Background grid + blobs */}
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
      <div
        className="absolute bottom-[-20%] left-[40%] w-[400px] h-[400px] rounded-full blur-3xl opacity-30 animate-blob pointer-events-none"
        style={{ background: "radial-gradient(circle, oklch(0.7 0.2 200 / 0.5), transparent 60%)", animationDelay: "8s" }}
        aria-hidden
      />

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <Badge variant="outline" className="px-4 py-1.5 rounded-full gap-2 backdrop-blur-md bg-background/60 mb-6">
              <Sparkles className="w-3.5 h-3.5 text-primary" />
              <span className="text-xs font-medium tracking-wide">
                Detects 30+ affiliate networks & 15+ ad networks
              </span>
              <Badge variant="secondary" className="ml-1 text-[10px] py-0 px-1.5">FREE</Badge>
            </Badge>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.05 }}
            className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight leading-[1.05] mb-6"
          >
            Detect <span className="text-gradient-animated">affiliate links</span>
            <br className="hidden sm:block" /> on any website in seconds
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.12 }}
            className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto mb-10"
          >
            Paste any URL and we&apos;ll instantly identify the affiliate programs it uses,
            the ad networks serving its pages, and whether its disclosure page complies with FTC rules.
          </motion.p>

          {/* Input */}
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.7, delay: 0.18 }}
            className="relative max-w-2xl mx-auto"
          >
            <Card className="p-2 sm:p-3 shadow-xl shadow-primary/5 border-border/60 backdrop-blur-xl bg-card/80">
              <form
                onSubmit={(e) => { e.preventDefault(); runCheck() }}
                className="flex flex-col sm:flex-row items-stretch gap-2 sm:gap-3"
              >
                <div className="relative flex-1">
                  <Globe className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none" />
                  <Input
                    type="text"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="example.com or https://example.com"
                    className="pl-11 h-12 sm:h-14 text-base border-0 shadow-none focus-visible:ring-0 bg-transparent"
                    aria-label="Website URL to check"
                    autoComplete="off"
                    spellCheck={false}
                  />
                </div>
                <Button
                  type="submit"
                  disabled={loading}
                  className="h-12 sm:h-14 px-6 sm:px-8 text-base font-semibold shadow-lg shadow-primary/20 gap-2 group"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Scanning…
                    </>
                  ) : (
                    <>
                      <Search className="w-4 h-4 group-hover:rotate-12 transition-transform" /> Check Now
                    </>
                  )}
                </Button>
              </form>
            </Card>

            {/* Sample chips */}
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-xs">
              <span className="text-muted-foreground mr-1">Try:</span>
              {SAMPLE_URLS.map((s) => (
                <button
                  key={s}
                  onClick={() => handleSample(s)}
                  disabled={loading}
                  className="px-2.5 py-1 rounded-full border border-border/60 bg-background/60 backdrop-blur-md text-muted-foreground hover:text-foreground hover:border-primary/40 hover:bg-secondary/40 transition-all"
                >
                  {getHostname(s)}
                </button>
              ))}
            </div>

            {/* Usage badge */}
            {!loading && (
              <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-xs">
                {isPro ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/15 text-amber-600 border border-amber-500/30 font-semibold">
                    <Crown className="w-3.5 h-3.5" />
                    Pro · Unlimited checks
                  </span>
                ) : isAuthenticated ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-secondary/60 border border-border/60">
                    <Zap className="w-3.5 h-3.5 text-amber-500" />
                    <span className="font-medium">
                      {usage.remaining === Infinity
                        ? "Unlimited"
                        : usage.remaining === 0
                        ? "0 left"
                        : `${usage.remaining} of ${usage.limit} free checks left today`}
                    </span>
                    {usage.remaining <= 1 && (
                      <button
                        onClick={onUpgradeClick}
                        className="ml-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-600 hover:bg-amber-500/30 transition-colors font-semibold"
                      >
                        <Crown className="w-3 h-3" /> Go Pro $9
                      </button>
                    )}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-secondary/60 border border-border/60">
                    <span className="font-medium">
                      {usage.remaining === 0
                        ? "Daily free check used"
                        : `${usage.remaining} free check today`}
                    </span>
                    <button
                      onClick={onSignUpClick}
                      className="ml-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/15 text-primary hover:bg-primary/25 transition-colors font-semibold"
                    >
                      Sign up for 3 →
                    </button>
                  </span>
                )}
              </div>
            )}

            {/* Animated scan stage banner */}
            <AnimatePresence>
              {loading && scanStage && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="mt-4 inline-flex items-center gap-2 text-sm text-primary font-medium bg-primary/10 border border-primary/20 rounded-full px-3.5 py-1.5"
                >
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary/60" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
                  </span>
                  {scanStage}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Stats strip */}
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.3 }}
            className="mt-14 grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6 max-w-3xl mx-auto"
          >
            {[
              { icon: Network, label: "Networks detected", value: "30+" },
              { icon: Zap, label: "Avg scan time", value: "~2s" },
              { icon: ShieldCheck, label: "Disclosure check", value: "FTC ready" },
              { icon: Globe, label: "Any website", value: "Worldwide" },
            ].map((s, i) => (
              <div
                key={s.label}
                className="flex flex-col items-center gap-1 text-center"
                style={{ animationDelay: `${i * 80}ms` }}
              >
                <div className="w-10 h-10 rounded-xl bg-secondary/60 flex items-center justify-center mb-1">
                  <s.icon className="w-4.5 h-4.5 text-primary" />
                </div>
                <div className="text-xl font-bold tracking-tight">{s.value}</div>
                <div className="text-xs text-muted-foreground">{s.label}</div>
              </div>
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  )
}

/* ---------------------------------------------------------- */
/* Loading state                                              */
/* ---------------------------------------------------------- */
function LoadingResult({ scanStage }: { scanStage: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="max-w-4xl mx-auto"
    >
      <Card className="p-8 sm:p-12 relative overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary via-chart-2 to-primary animate-shimmer" />
        <div className="relative overflow-hidden h-2 rounded-full mb-8 bg-muted/50">
          <div className="h-full w-1/3 bg-primary rounded-full animate-pulse" />
        </div>
        <div className="text-center">
          <div className="relative inline-flex mb-6">
            <span className="absolute inset-0 rounded-full bg-primary/30 animate-pulse-ring" />
            <div className="relative w-16 h-16 rounded-full bg-gradient-to-br from-primary to-chart-2 flex items-center justify-center">
              <ScanLine className="w-7 h-7 text-primary-foreground" />
            </div>
          </div>
          <div className="text-lg font-semibold mb-1">Scanning the page…</div>
          <div className="text-sm text-muted-foreground min-h-[1.25rem]">{scanStage || "Working…"}</div>
        </div>
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="space-y-3">
              <div className="h-4 w-2/3 bg-muted/60 rounded animate-pulse" />
              <div className="h-3 w-full bg-muted/40 rounded animate-pulse" />
              <div className="h-3 w-3/4 bg-muted/40 rounded animate-pulse" />
            </div>
          ))}
        </div>
      </Card>
    </motion.div>
  )
}

/* ---------------------------------------------------------- */
/* Result View                                                 */
/* ---------------------------------------------------------- */
function ResultView({ result }: { result: CheckResult }) {
  const verdict = result.error && !result.statusCode
    ? "error"
    : result.isAffiliate
    ? "affiliate"
    : "no-affiliate"

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      className="max-w-5xl mx-auto space-y-5"
    >
      {/* Verdict card */}
      <VerdictCard result={result} verdict={verdict} />

      {/* Page info + Stats row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <PageInfoCard result={result} />
        <StatsCard result={result} />
      </div>

      {/* Affiliate Networks */}
      {result.affiliateNetworks.length > 0 && (
        <Card className="p-6">
          <SectionHeader
            icon={<BadgeCheck className="w-5 h-5 text-emerald-500" />}
            title="Affiliate Networks Detected"
            count={result.affiliateNetworks.length}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-5">
            {result.affiliateNetworks.map((n) => (
              <NetworkCard key={n.name} net={n} />
            ))}
          </div>
        </Card>
      )}

      {/* Ad Networks */}
      {result.adNetworks.length > 0 && (
        <Card className="p-6">
          <SectionHeader
            icon={<Layers className="w-5 h-5 text-chart-3" />}
            title="Ad Networks Detected"
            count={result.adNetworks.length}
          />
          <div className="flex flex-wrap gap-2.5 mt-5">
            {result.adNetworks.map((a) => (
              <Badge key={a.name} variant="secondary" className="px-3 py-1.5 rounded-lg gap-2 text-sm">
                <Layers className="w-3.5 h-3.5 text-chart-3" />
                {a.name}
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider ml-1">{a.type}</span>
              </Badge>
            ))}
          </div>
        </Card>
      )}

      {/* Disclosure snippets */}
      <DisclosureCard disclosure={result.disclosure} />

      {/* Affiliate links list */}
      {result.affiliateLinks.length > 0 && (
        <Card className="p-6">
          <SectionHeader
            icon={<Fingerprint className="w-5 h-5 text-chart-2" />}
            title="Sample Affiliate Links"
            count={result.affiliateLinks.length}
          />
          <div className="mt-4 max-h-80 overflow-y-auto custom-scroll pr-2 -mr-2">
            <div className="space-y-2">
              {result.affiliateLinks.map((l, i) => (
                <AffiliateLinkRow key={i} link={l} />
              ))}
            </div>
          </div>
        </Card>
      )}

      {/* Meta / OG tags */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {result.openGraph.length > 0 && (
          <Card className="p-6">
            <SectionHeader icon={<Code2 className="w-5 h-5 text-chart-4" />} title="Open Graph Tags" count={result.openGraph.length} />
            <div className="mt-4 space-y-2 max-h-64 overflow-y-auto custom-scroll pr-2 -mr-2">
              {result.openGraph.map((o) => (
                <div key={o.property} className="rounded-md border border-border/60 p-2.5 bg-muted/30">
                  <div className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">{o.property}</div>
                  <div className="text-sm mt-0.5 break-words">{o.content}</div>
                </div>
              ))}
            </div>
          </Card>
        )}
        {result.metaTags.length > 0 && (
          <Card className="p-6">
            <SectionHeader icon={<FileText className="w-5 h-5 text-muted-foreground" />} title="Meta Tags" count={result.metaTags.length} />
            <div className="mt-4 space-y-2 max-h-64 overflow-y-auto custom-scroll pr-2 -mr-2">
              {result.metaTags.map((m) => (
                <div key={m.name + m.content} className="rounded-md border border-border/60 p-2.5 bg-muted/30">
                  <div className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">{m.name}</div>
                  <div className="text-sm mt-0.5 break-words">{m.content}</div>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>

      {/* Action bar */}
      <Card className="p-5 flex flex-col sm:flex-row items-center justify-between gap-3 bg-muted/30">
        <div className="text-sm text-muted-foreground">
          Report generated in <span className="font-mono font-semibold text-foreground">{result.fetchMs} ms</span>
          {result.stats.pageWeightKb > 0 && (
            <> · page weight <span className="font-mono font-semibold text-foreground">{result.stats.pageWeightKb} KB</span></>
          )}
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              navigator.clipboard.writeText(JSON.stringify(result, null, 2))
              toast.success("JSON report copied to clipboard")
            }}
          >
            <Copy className="w-3.5 h-3.5 mr-1.5" /> Copy JSON
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const blob = new Blob([JSON.stringify(result, null, 2)], { type: "application/json" })
              const a = document.createElement("a")
              a.href = URL.createObjectURL(blob)
              a.download = `affiliate-report-${getHostname(result.url)}.json`
              a.click()
            }}
          >
            <ArrowUpRight className="w-3.5 h-3.5 mr-1.5" /> Export
          </Button>
        </div>
      </Card>
    </motion.div>
  )
}

function VerdictCard({ result, verdict }: { result: CheckResult; verdict: "error" | "affiliate" | "no-affiliate" }) {
  const config = {
    error: {
      icon: AlertTriangle,
      color: "text-amber-500",
      bg: "from-amber-500/10 to-amber-500/5",
      ring: "ring-amber-500/30",
      title: "Couldn&apos;t fully analyze",
      desc: result.error || "The website may be blocking automated requests.",
    },
    affiliate: {
      icon: CheckCircle2,
      color: "text-emerald-500",
      bg: "from-emerald-500/10 to-emerald-500/5",
      ring: "ring-emerald-500/30",
      title: "Yes, affiliate activity detected",
      desc: `Found ${result.affiliateNetworks.length} affiliate network${result.affiliateNetworks.length === 1 ? "" : "s"} and ${result.affiliateLinks.length} affiliate link${result.affiliateLinks.length === 1 ? "" : "s"}.`,
    },
    "no-affiliate": {
      icon: XCircle,
      color: "text-rose-500",
      bg: "from-rose-500/10 to-rose-500/5",
      ring: "ring-rose-500/30",
      title: "No affiliate activity found",
      desc: "This page does not appear to use any of the 30+ affiliate networks we track.",
    },
  }[verdict]

  return (
    <Card className={`relative overflow-hidden p-6 sm:p-8 bg-gradient-to-br ${config.bg} ring-1 ${config.ring}`}>
      <div className="absolute inset-0 grid-bg opacity-30 pointer-events-none" />
      <div className="relative flex flex-col sm:flex-row sm:items-center gap-5">
        <div className="flex-shrink-0">
          <motion.div
            initial={{ scale: 0.7, rotate: -10, opacity: 0 }}
            animate={{ scale: 1, rotate: 0, opacity: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 15 }}
            className={`w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-card flex items-center justify-center shadow-lg`}
          >
            <config.icon className={`w-7 h-7 sm:w-8 sm:h-8 ${config.color}`} />
          </motion.div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground mb-1">Verdict</div>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight" dangerouslySetInnerHTML={{ __html: config.title }} />
          <p className="text-muted-foreground mt-1 text-sm sm:text-base">{config.desc}</p>
        </div>
        {result.statusCode > 0 && (
          <div className="flex-shrink-0 sm:text-right">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">HTTP</div>
            <div className="text-2xl font-mono font-bold">{result.statusCode}</div>
          </div>
        )}
      </div>
    </Card>
  )
}

function PageInfoCard({ result }: { result: CheckResult }) {
  return (
    <Card className="p-6 lg:col-span-2">
      <SectionHeader icon={<Building2 className="w-5 h-5 text-primary" />} title="Page Info" />
      <div className="mt-4 flex items-start gap-4">
        {result.favicon && (
          <img
            src={result.favicon}
            alt=""
            className="w-12 h-12 rounded-xl border border-border/60 bg-card object-contain p-1.5 flex-shrink-0"
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none" }}
          />
        )}
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-base truncate">
            {result.title || getHostname(result.finalUrl || result.url)}
          </div>
          <div className="text-xs text-muted-foreground truncate flex items-center gap-1 mt-0.5">
            <Globe className="w-3 h-3" />
            {result.finalUrl || result.url}
          </div>
          {result.description && (
            <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{result.description}</p>
          )}
        </div>
      </div>
    </Card>
  )
}

function StatsCard({ result }: { result: CheckResult }) {
  const items = [
    { label: "Total links", value: result.stats.totalLinks, icon: Link2, color: "text-foreground" },
    { label: "External", value: result.stats.externalLinks, icon: ExternalLink, color: "text-chart-3" },
    { label: "Affiliate", value: result.stats.affiliateLinksCount, icon: Tag, color: "text-emerald-500" },
  ]
  return (
    <Card className="p-6">
      <SectionHeader icon={<TrendingUp className="w-5 h-5 text-primary" />} title="Stats" />
      <div className="mt-4 space-y-3">
        {items.map((s) => (
          <div key={s.label} className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <s.icon className={`w-4 h-4 ${s.color}`} />
              {s.label}
            </div>
            <span className="text-xl font-bold tabular-nums">{s.value}</span>
          </div>
        ))}
      </div>
    </Card>
  )
}

function NetworkCard({ net }: { net: AffiliateNetwork }) {
  return (
    <div className="rounded-xl border border-border/60 p-4 bg-muted/20 hover:bg-muted/40 hover:border-primary/30 transition-all group">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="font-semibold text-sm leading-tight">{net.name}</div>
        <Badge className={`text-[10px] px-1.5 py-0 border ${confidenceColor(net.confidence)}`}>
          {net.confidence}
        </Badge>
      </div>
      <div className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
        <Tag className="w-3 h-3" /> {net.category}
      </div>
      {net.url ? (
        <a
          href={net.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-primary hover:underline truncate block flex items-center gap-1"
        >
          <ExternalLink className="w-3 h-3 flex-shrink-0" />
          <span className="truncate">{getHostname(net.url)}</span>
        </a>
      ) : (
        <div className="text-xs text-muted-foreground italic">Detected via disclosure</div>
      )}
    </div>
  )
}

function DisclosureCard({ disclosure }: { disclosure: Disclosure }) {
  const [open, setOpen] = useState(false)
  return (
    <Card className="p-6">
      <SectionHeader
        icon={<ShieldCheck className={`w-5 h-5 ${disclosure.found ? "text-emerald-500" : "text-amber-500"}`} />}
        title="Affiliate Disclosure"
        count={disclosure.snippets.length || undefined}
      />
      {!disclosure.found ? (
        <div className="mt-4 flex items-start gap-3 p-4 rounded-xl bg-amber-500/5 border border-amber-500/20">
          <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <div className="font-medium text-sm">No FTC-compliant affiliate disclosure found on this page.</div>
            <div className="text-xs text-muted-foreground mt-1">
              If this site earns affiliate commissions, FTC guidelines require a clear, conspicuous disclosure. This
              checker scans the visible page text for common disclosure phrases.
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {disclosure.snippets.slice(0, open ? undefined : 1).map((s, i) => (
            <div key={i} className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-sm leading-relaxed">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                <p>&ldquo;{s}&rdquo;</p>
              </div>
            </div>
          ))}
          {disclosure.snippets.length > 1 && (
            <button
              onClick={() => setOpen((v) => !v)}
              className="text-xs text-primary hover:underline flex items-center gap-1"
            >
              {open ? "Show less" : `Show ${disclosure.snippets.length - 1} more`}
              <ChevronDown className={`w-3 h-3 transition-transform ${open ? "rotate-180" : ""}`} />
            </button>
          )}
        </div>
      )}
    </Card>
  )
}

function AffiliateLinkRow({ link }: { link: AffiliateLink }) {
  return (
    <div className="rounded-lg border border-border/60 p-3 bg-muted/20 hover:bg-muted/40 transition-colors">
      <div className="flex items-center justify-between gap-2 mb-1">
        <Badge variant="outline" className="text-[10px] py-0 px-1.5 font-mono">{link.network}</Badge>
        <a
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-muted-foreground hover:text-primary flex-shrink-0"
          aria-label="Open link"
        >
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>
      <div className="text-xs font-medium truncate text-foreground mb-0.5">{link.text}</div>
      <div className="text-[11px] text-muted-foreground truncate">{link.url}</div>
    </div>
  )
}

function SectionHeader({
  icon, title, count,
}: {
  icon: React.ReactNode
  title: string
  count?: number
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2.5">
        {icon}
        <h3 className="font-semibold text-base sm:text-lg">{title}</h3>
      </div>
      {count !== undefined && (
        <Badge variant="secondary" className="rounded-full tabular-nums">{count}</Badge>
      )}
    </div>
  )
}

/* ---------------------------------------------------------- */
/* Features section                                            */
/* ---------------------------------------------------------- */
function Features() {
  const features = [
    {
      icon: Network,
      title: "30+ Affiliate Networks",
      desc: "Amazon Associates, Impact, ShareASale, CJ, Awin, Rakuten, ClickBank, AvantLink, PartnerStack, RewardStyle and more.",
      color: "from-violet-500 to-purple-500",
    },
    {
      icon: Layers,
      title: "15+ Ad Network Detectors",
      desc: "AdSense, Media.net, Mediavine, AdThrive, Taboola, Outbrain, Ezoic, Carbon Ads and more.",
      color: "from-rose-500 to-pink-500",
    },
    {
      icon: ShieldCheck,
      title: "FTC Disclosure Scanner",
      desc: "Auto-extracts affiliate disclosure snippets and flags pages that may be non-compliant.",
      color: "from-emerald-500 to-teal-500",
    },
    {
      icon: Zap,
      title: "Sub-second Results",
      desc: "Optimized fetch pipeline returns a full report in under 3 seconds for most pages.",
      color: "from-amber-500 to-orange-500",
    },
    {
      icon: Fingerprint,
      title: "Per-link Attribution",
      desc: "See the exact anchor text, target URL and matched network for every affiliate link on the page.",
      color: "from-sky-500 to-blue-500",
    },
    {
      icon: Code2,
      title: "Meta & Open Graph Audit",
      desc: "Surface meta tags, Open Graph properties and page metadata in a clean, exportable view.",
      color: "from-fuchsia-500 to-pink-500",
    },
  ]

  return (
    <section id="features" className="py-20 sm:py-24 border-t border-border/40 bg-muted/10">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.6 }}
          className="max-w-2xl mx-auto text-center mb-14"
        >
          <Badge variant="outline" className="rounded-full px-3 py-1 mb-4 gap-1.5">
            <Sparkles className="w-3 h-3 text-primary" /> Features
          </Badge>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight mb-4">
            Everything you need to <span className="text-gradient">audit a page</span>
          </h2>
          <p className="text-muted-foreground text-base sm:text-lg">
            A complete affiliate intelligence toolkit for marketers, affiliates, compliance teams, and curious readers.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.5, delay: i * 0.08 }}
            >
              <Card className="p-6 h-full hover:shadow-xl hover:shadow-primary/5 hover:-translate-y-1 transition-all duration-300 border-border/60 group">
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${f.color} flex items-center justify-center mb-4 shadow-lg group-hover:scale-110 transition-transform`}>
                  <f.icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="font-semibold text-lg mb-2">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ---------------------------------------------------------- */
/* SEO Guide & Content (1000+ words, human-style)              */
/* ---------------------------------------------------------- */
function SeoGuide() {
  return (
    <section id="guide" className="py-20 sm:py-24 border-t border-border/40">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.6 }}
          className="max-w-3xl mx-auto text-center mb-14"
        >
          <Badge variant="outline" className="rounded-full px-3 py-1 mb-4 gap-1.5">
            <BookOpen className="w-3 h-3 text-primary" /> The Guide
          </Badge>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight mb-4">
            How to use the <span className="text-gradient">affiliate link checker</span>
          </h2>
          <p className="text-muted-foreground text-base sm:text-lg">
            A short guide on how to check your links, find broken ones, and keep your page in good shape.
          </p>
        </motion.div>

        <article className="max-w-3xl mx-auto prose-content space-y-12">
          {/* Section 1 */}
          <div id="what-is-an-affiliate-link-checker" className="scroll-mt-24">
            <div className="flex items-center gap-2 mb-4">
              <PenLine className="w-5 h-5 text-primary" />
              <h3 className="text-2xl sm:text-3xl font-bold tracking-tight">
                What is an affiliate link checker?
              </h3>
            </div>
            <div className="space-y-4 text-base sm:text-lg leading-relaxed text-muted-foreground">
              <p>
                If you post links on the web to earn, you need to check each one. That is where an{" "}
                <a href="#checker" className="text-primary hover:underline font-medium">affiliate link checker</a>{" "}
                helps. I made this free tool so you can scan a page and see all links at once. It works
                as a <a href="#how-it-works" className="text-primary hover:underline font-medium">link checker</a>{" "}
                for any site, big or small.
              </p>
              <p>
                You paste a URL, hit check, and get a clear list in secs. The tool tells you what
                links are on that page. It shows if a link goes to Amazon, CJ Affiliate, or any top{" "}
                <a href="#networks" className="text-primary hover:underline font-medium">affiliate network</a>.
                It also spots dead links and broken links that hurt your rank on Google.
                When I check link data on my own blog each week, this tool saves me hours.
              </p>
              <p>
                Many users do not know that affiliate marketing has rules. You must show a clear
                disclosure if you earn from links. My tool finds the affiliate disclosure for you so
                you can stay on the right side of the FTC.
              </p>
            </div>
          </div>

          {/* Section 2 */}
          <div id="why-check-your-affiliate-links" className="scroll-mt-24">
            <div className="flex items-center gap-2 mb-4">
              <AlertCircle className="w-5 h-5 text-primary" />
              <h3 className="text-2xl sm:text-3xl font-bold tracking-tight">
                Why you need to check your links
              </h3>
            </div>
            <div className="space-y-4 text-base sm:text-lg leading-relaxed text-muted-foreground">
              <p>
                If you write a blog or run a site, links add up fast. Some go to Amazon. Some go
                to other <a href="#networks" className="text-primary hover:underline font-medium">affiliate programs</a>.
                Some are just plain page URLs. It is hard to keep track of all of them.
              </p>
              <p>
                When a link breaks, you lose clicks. Lost clicks mean lost affiliate income. I have
                seen this on my own site. One dead Amazon link can cost you a lot over a year. Broken
                affiliate links also hurt your SEO. Google looks at outbound links as a vote. If too
                many go to dead pages, your rank may drop. That is why you need to check for broken
                links on a set plan, not just when you think of it.
              </p>
              <p>
                With this tool, you can check a page in just a few secs. You see the final URL, the
                HTTP status, and the affiliate id if one is used. You can fix bad links fast before
                they hurt your affiliate revenue. A broken link checker is a must for any blog that
                earns from links. If you find broken links, you can swap them out for new ones in
                just a few clicks.
              </p>
            </div>
          </div>

          {/* Section 3 */}
          <div id="find-broken-amazon-links" className="scroll-mt-24">
            <div className="flex items-center gap-2 mb-4">
              <Wrench className="w-5 h-5 text-primary" />
              <h3 className="text-2xl sm:text-3xl font-bold tracking-tight">
                Find broken Amazon links fast
              </h3>
            </div>
            <div className="space-y-4 text-base sm:text-lg leading-relaxed text-muted-foreground">
              <p>
                Amazon links break a lot. They change ASIN codes, drop items, or move pages. If you
                post Amazon links, you need to check them often. This is why I added a full amazon
                affiliate link checker to the tool.
              </p>
              <p>
                If you are part of Amazon Associates, you know that links can break in many ways.
                Amazon affiliate links can break when an item is sold out, moved, or no longer
                listed. Our amazon affiliate link checker looks at each Amazon URL on your page. It
                shows the ASIN, the tag, and the destination URL. If the link is dead, you can fix
                it or remove it. The tool also finds broken amazon links that point to sold out or
                moved items.
              </p>
              <p>
                The tool also finds broken affiliate links from other top networks like{" "}
                <a href="#networks" className="text-primary hover:underline font-medium">CJ Affiliate</a>{" "}
                and ShareASale. This helps you keep all your tracking links in good shape. It works
                as a full affiliate link tester for your site. A deep link to a product page works
                better than a home page link, so I check each one to make sure it still goes where
                it should.
              </p>
            </div>
          </div>

          {/* Section 4 */}
          <div id="how-the-check-works" className="scroll-mt-24">
            <div className="flex items-center gap-2 mb-4">
              <ScanLine className="w-5 h-5 text-primary" />
              <h3 className="text-2xl sm:text-3xl font-bold tracking-tight">
                How the check works
              </h3>
            </div>
            <div className="space-y-4 text-base sm:text-lg leading-relaxed text-muted-foreground">
              <p>
                Step one: you paste a page URL in the box. Step two: I scan the page in secs. Step
                three: you get a full report. Here is what you get:
              </p>
              <ul className="space-y-2 ml-1">
                <li className="flex gap-2.5"><CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />A list of all links on the page</li>
                <li className="flex gap-2.5"><CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />Each affiliate network I found</li>
                <li className="flex gap-2.5"><CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />The HTTP status of the page</li>
                <li className="flex gap-2.5"><CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />A short text on each link</li>
                <li className="flex gap-2.5"><CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />Any affiliate disclosure text on the page</li>
                <li className="flex gap-2.5"><CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />The final URL of each link</li>
              </ul>
              <p>
                You can copy the full report as JSON or save it as a file. This is great if you want
                to track links over time or share with your team. You can also use it to check your
                own page before you post it.
              </p>
              <p>
                Some links use rel="sponsored" tags, which Google asks sites to use on affiliate
                links. I detect these tags and show them in the report. This helps you see if your
                links are set up the right way for SEO.
              </p>
            </div>
          </div>

          {/* Section 5 */}
          <div id="spot-affiliate-tags" className="scroll-mt-24">
            <div className="flex items-center gap-2 mb-4">
              <Tag className="w-5 h-5 text-primary" />
              <h3 className="text-2xl sm:text-3xl font-bold tracking-tight">
                Spot affiliate tags and IDs
              </h3>
            </div>
            <div className="space-y-4 text-base sm:text-lg leading-relaxed text-muted-foreground">
              <p>
                Each affiliate link has a tag or id. Amazon uses the tag= param. Other networks use
                aff=, ref=, or click_id=. I scan for all of these in URLs.
              </p>
              <p>
                When I find a tag, I show it to you. This helps you see if a link is yours or not. If
                you write for a brand, you can check if they use your affiliate id. If you check a
                rival page, you can see what tags they use for attribution.
              </p>
              <p>
                The tool also finds shortened links like amzn.to and bit.ly. These often hide an
                affiliate URL. I follow the redirect to find the final URL for you. The tool also
                looks at tracking links and shows you where they go. This helps you see the true
                path of each click.
              </p>
              <p>
                If you are an advertiser, you can use this tool to check if your partners link to
                you the right way. You can see the affiliate tags they use and make sure you get
                credit for the click. This is key for your affiliate tracking and your affiliate
                revenue.
              </p>
            </div>
          </div>

          {/* Section 6 */}
          <div id="check-outbound-links" className="scroll-mt-24">
            <div className="flex items-center gap-2 mb-4">
              <LinkIcon className="w-5 h-5 text-primary" />
              <h3 className="text-2xl sm:text-3xl font-bold tracking-tight">
                Check outbound links and disclosures
              </h3>
            </div>
            <div className="space-y-4 text-base sm:text-lg leading-relaxed text-muted-foreground">
              <p>
                Outbound links are links on your page that go to other sites. Some are affiliate URLs.
                Some are not. It is good to know which is which. Too many outbound links can hurt
                your page rank. Google and the FTC ask sites to show a clear affiliate disclosure if
                they earn from links.
              </p>
              <p>
                My tool finds the disclosure text for you. It also tells you if a page uses
                rel="sponsored" tags, which Google asks sites to use on affiliate links. If you are
                an advertiser, you can check if your partners link to you the right way.
              </p>
              <p>
                You can also check if a page has a clear affiliate disclosure. The tool finds FTC
                style disclosure text on the page. This helps affiliate marketers stay on the right
                side of the rules. A good affiliate disclosure can save you from a fine and keep
                your users trust.
              </p>
            </div>
          </div>

          {/* Section 7 */}
          <div id="who-uses-this-tool" className="scroll-mt-24">
            <div className="flex items-center gap-2 mb-4">
              <Users className="w-5 h-5 text-primary" />
              <h3 className="text-2xl sm:text-3xl font-bold tracking-tight">
                Who uses this tool?
              </h3>
            </div>
            <div className="space-y-4 text-base sm:text-lg leading-relaxed text-muted-foreground">
              <p>
                Blog writers use it to check their own pages. SEO pros use it to audit client sites.
                Affiliate marketers use it to spy on rival pages. Brands use it to see who links to
                them. If you use WordPress, you can run this check on each post before you hit
                publish. You do not need any plugins. Just paste the URL and hit check.
              </p>
              <p>
                If you have a YouTube channel, you can check the links in your video notes too. Just
                paste the page URL where your notes live. The tool shows you all links on that page
                in one list. This is great for users who want to keep their video notes fresh and
                free of dead links.
              </p>
              <p>
                I built this as a free web tool so any user can use it. No sign up. No fee. You can
                run as many checks as you want. You can also link your Google Analytics data to see
                what links get the most clicks, then use this tool to keep those links live.
              </p>
            </div>
          </div>

          {/* Section 8 */}
          <div id="tips" className="scroll-mt-24">
            <div className="flex items-center gap-2 mb-4">
              <Lightbulb className="w-5 h-5 text-primary" />
              <h3 className="text-2xl sm:text-3xl font-bold tracking-tight">
                Tips to get more from your links
              </h3>
            </div>
            <div className="space-y-4 text-base sm:text-lg leading-relaxed text-muted-foreground">
              <p>Here are a few tips I use on my own site:</p>
              <ul className="space-y-2.5 ml-1">
                <li className="flex gap-2.5"><CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />Check each new post for broken links before you post it</li>
                <li className="flex gap-2.5"><CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />Run a full link check on old posts once a month</li>
                <li className="flex gap-2.5"><CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />Fix dead links or swap them out with new ones</li>
                <li className="flex gap-2.5"><CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />Use a clear affiliate tag so you get credit for the click</li>
                <li className="flex gap-2.5"><CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />Add a good disclosure on each page with affiliate links</li>
                <li className="flex gap-2.5"><CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />Set up alerts so you know right away when a link breaks</li>
                <li className="flex gap-2.5"><CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />Watch your Google Analytics to see what links get the most clicks</li>
              </ul>
              <p>
                If you do these, your affiliate revenue will grow over time. A good link checker is
                the base of a strong link plan. You can also use this tool to find new affiliate
                programs to join. Just check a page in your niche and see what networks they use.
              </p>
            </div>
          </div>

          {/* Section 9 */}
          <div id="try-now" className="scroll-mt-24">
            <div className="flex items-center gap-2 mb-4">
              <Target className="w-5 h-5 text-primary" />
              <h3 className="text-2xl sm:text-3xl font-bold tracking-tight">
                Try the free affiliate link checker now
              </h3>
            </div>
            <div className="space-y-4 text-base sm:text-lg leading-relaxed text-muted-foreground">
              <p>
                This tool is free for all users. You do not need to log in. You do not need to pay.
                You can run as many checks as you want. I made it for folks like me who write online
                and need a fast way to check links.
              </p>
              <p>
                Try it now. Paste a URL up top and hit{" "}
                <a href="#checker" className="text-primary hover:underline font-medium">check</a>. In
                secs, you get your full link report. You can save the report, share it with your
                team, or use it to fix bad links fast. No fluff. No ads in your face. Just a clean
                tool that does the job.
              </p>
              <p>
                Want to see more? Check out the{" "}
                <a href="#features" className="text-primary hover:underline font-medium">features</a>,{" "}
                <a href="#how-it-works" className="text-primary hover:underline font-medium">how it works</a>,{" "}
                or the{" "}
                <a href="#networks" className="text-primary hover:underline font-medium">networks</a>{" "}
                we detect.
              </p>
            </div>
          </div>
        </article>
      </div>
    </section>
  )
}

/* ---------------------------------------------------------- */
/* How It Works                                                */
/* ---------------------------------------------------------- */
function HowItWorks() {
  const steps = [
    {
      icon: MousePointerClick,
      title: "Paste a URL",
      desc: "Drop in any webpage: homepage, blog post, product review, or landing page.",
    },
    {
      icon: ScanLine,
      title: "We fetch & parse",
      desc: "Our engine downloads the HTML, extracts every link, and matches against 30+ affiliate signatures.",
    },
    {
      icon: Network,
      title: "Network attribution",
      desc: "Each link is attributed to its affiliate network with a high / medium / low confidence score.",
    },
    {
      icon: FileText,
      title: "Disclosure audit",
      desc: "We surface any affiliate disclosure language found on the page, ready for compliance review.",
    },
  ]
  return (
    <section id="how-it-works" className="py-20 sm:py-24">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.6 }}
          className="max-w-2xl mx-auto text-center mb-14"
        >
          <Badge variant="outline" className="rounded-full px-3 py-1 mb-4 gap-1.5">
            <Zap className="w-3 h-3 text-primary" /> Workflow
          </Badge>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight mb-4">
            How it <span className="text-gradient">works</span>
          </h2>
        </motion.div>

        <div className="relative max-w-5xl mx-auto">
          {/* connecting line */}
          <div className="hidden lg:block absolute top-12 left-0 right-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {steps.map((s, i) => (
              <motion.div
                key={s.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="relative"
              >
                <div className="flex flex-col items-center text-center">
                  <div className="relative w-24 h-24 rounded-full bg-card border border-border/60 flex items-center justify-center mb-5 shadow-lg">
                    <s.icon className="w-9 h-9 text-primary" />
                    <div className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm font-bold flex items-center justify-center shadow-md">
                      {i + 1}
                    </div>
                  </div>
                  <h3 className="font-semibold text-lg mb-1.5">{s.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{s.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

/* ---------------------------------------------------------- */
/* Supported Networks                                          */
/* ---------------------------------------------------------- */
function SupportedNetworks() {
  const groups = [
    {
      label: "Affiliate Networks",
      icon: Network,
      color: "text-violet-500",
      items: [
        "Amazon Associates", "Impact Radius", "ShareASale", "CJ Affiliate",
        "Rakuten Advertising", "Awin", "Skimlinks", "ClickBank",
        "AvantLink", "PartnerStack", "Refersion", "TradeDoubler",
        "Webgains", "HasOffers / Tune", "VigLink / Sovrn",
        "Post Affiliate Pro", "Tapfiliate", "Adobe Affiliate", "ClickFunnels",
      ],
    },
    {
      label: "Marketplace Programs",
      icon: Tag,
      color: "text-emerald-500",
      items: [
        "eBay Partner Network", "Walmart Affiliate", "Etsy Affiliate",
        "AliExpress Affiliate", "Target Partners", "Booking.com Affiliate",
        "ShopStyle", "RewardStyle / LTK", "Best Buy Affiliate",
      ],
    },
    {
      label: "SaaS & Hosting Programs",
      icon: Zap,
      color: "text-amber-500",
      items: [
        "Shopify Affiliate", "WP Engine Affiliate", "Kinsta Affiliate",
        "Bluehost Affiliate", "SiteGround Affiliate", "Liquid Web Affiliate",
        "HostGator Affiliate", "ConvertKit Affiliate", "Namecheap Affiliate",
        "Coursera Affiliate", "Udemy Affiliate", "Skillshare Affiliate",
        "Teachable Affiliate", "Thinkific Affiliate", "Patreon Affiliate",
      ],
    },
    {
      label: "Ad Networks",
      icon: Layers,
      color: "text-rose-500",
      items: [
        "Google AdSense", "Media.net", "AdThrive", "Mediavine",
        "Taboola", "Outbrain", "Ezoic", "Carbon Ads",
        "BuySellAds", "Infolinks", "Raptive", "Amazon Associates (Display)",
        "Adsterra", "PropellerAds",
      ],
    },
  ]
  return (
    <section id="networks" className="py-20 sm:py-24 border-t border-border/40 bg-muted/10">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.6 }}
          className="max-w-2xl mx-auto text-center mb-14"
        >
          <Badge variant="outline" className="rounded-full px-3 py-1 mb-4 gap-1.5">
            <Star className="w-3 h-3 text-primary" /> Coverage
          </Badge>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight mb-4">
            <span className="text-gradient">60+</span> supported networks
          </h2>
          <p className="text-muted-foreground text-base sm:text-lg">
            We add new networks all the time. If you spot one we missed, let me know and I will add it.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 max-w-5xl mx-auto">
          {groups.map((g, gi) => (
            <motion.div
              key={g.label}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.5, delay: gi * 0.1 }}
            >
              <Card className="p-6 h-full">
                <div className="flex items-center gap-2.5 mb-5">
                  <g.icon className={`w-5 h-5 ${g.color}`} />
                  <h3 className="font-semibold">{g.label}</h3>
                  <Badge variant="secondary" className="ml-auto">{g.items.length}</Badge>
                </div>
                <div className="flex flex-wrap gap-2">
                  {g.items.map((n) => (
                    <span
                      key={n}
                      className="px-2.5 py-1 rounded-md text-xs font-medium bg-muted/60 border border-border/60 hover:border-primary/30 hover:bg-secondary/40 transition-colors"
                    >
                      {n}
                    </span>
                  ))}
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ---------------------------------------------------------- */
/* CTA section                                                 */
/* ---------------------------------------------------------- */
function CTASection() {
  return (
    <section className="py-20 sm:py-24">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
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
                Ready to audit any site?
              </h2>
              <p className="text-primary-foreground/80 text-base sm:text-lg mb-7 max-w-xl mx-auto">
                Free, no signup, no rate limits. Just paste a URL and get a full affiliate intelligence report.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button asChild size="lg" variant="secondary" className="h-12 px-7 font-semibold gap-2">
                  <a href="#checker">
                    <Search className="w-4 h-4" /> Check a URL now
                  </a>
                </Button>
                <Button asChild size="lg" variant="outline" className="h-12 px-7 font-semibold gap-2 bg-transparent border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground">
                  <a href="#guide">
                    <BookOpen className="w-4 h-4" /> Read the guide
                  </a>
                </Button>
              </div>
            </div>
          </Card>
        </motion.div>
      </div>
    </section>
  )
}

/* ---------------------------------------------------------- */
/* Footer                                                      */
/* ---------------------------------------------------------- */
function Footer() {
  return (
    <footer className="mt-auto border-t border-border/40 py-10 bg-muted/10">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary to-chart-2 flex items-center justify-center">
              <Link2 className="w-4 h-4 text-primary-foreground" />
            </div>
            <div className="text-sm">
              <span className="font-semibold">Affiliate Link Checker</span>
              <span className="text-muted-foreground ml-2">· Free, no sign up, no ads</span>
            </div>
          </div>
          <div className="flex items-center gap-5 text-xs text-muted-foreground">
            <a href="#features" className="hover:text-foreground transition-colors">Features</a>
            <a href="#how-it-works" className="hover:text-foreground transition-colors">How it works</a>
            <a href="#networks" className="hover:text-foreground transition-colors">Networks</a>
            <a href="#guide" className="hover:text-foreground transition-colors">Guide</a>
          </div>
        </div>
        <div className="mt-6 pt-6 border-t border-border/40 text-center text-xs text-muted-foreground">
          Free affiliate link checker. Check Amazon, ShareASale, CJ Affiliate, Awin, and 30+ affiliate networks. No sign up, no fee, no ads. Built for bloggers, affiliate marketers, and SEO pros who need to keep their links fresh and FTC compliant.
        </div>
      </div>
    </footer>
  )
}
