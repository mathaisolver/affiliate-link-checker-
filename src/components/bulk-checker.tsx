"use client"

import { useState, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Loader2, Lock, Sparkles, AlertCircle, CheckCircle2, XCircle,
  ArrowUpRight, Crown, Copy,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { toast } from "sonner"

interface BulkResult {
  url: string
  finalUrl: string | null
  title: string | null
  isAffiliate: boolean
  affiliateNetworks: { name: string; category: string }[]
  adNetworks: { name: string; type: string }[]
  affiliateLinksCount: number
  statusCode: number
  error?: string
}

interface BulkCheckerProps {
  isPro: boolean
  onUpgradeClick: () => void
  onSignupClick: () => void
}

export function BulkChecker({ isPro, onUpgradeClick, onSignupClick }: BulkCheckerProps) {
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<BulkResult[] | null>(null)
  const [progress, setProgress] = useState({ done: 0, total: 0 })

  const handleCheck = useCallback(async () => {
    if (!isPro) {
      onUpgradeClick()
      return
    }

    const urls = input
      .split(/[\n,]/g)
      .map((s) => s.trim())
      .filter(Boolean)

    if (urls.length === 0) {
      toast.error("Paste at least one URL")
      return
    }

    if (urls.length > 50) {
      toast.error(`Max 50 URLs per bulk check. You pasted ${urls.length}.`)
      return
    }

    setLoading(true)
    setResults(null)
    setProgress({ done: 0, total: urls.length })

    try {
      const res = await fetch("/api/bulk-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urls }),
      })

      const data = await res.json()

      if (res.status === 403) {
        toast.error(data.error || "Bulk check is Pro-only")
        onUpgradeClick()
        return
      }

      if (data.error) {
        toast.error(data.error)
        return
      }

      setResults(data.results || [])
      setProgress({ done: data.count || urls.length, total: urls.length })
      toast.success(`Checked ${data.count} URLs`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Network error")
    } finally {
      setLoading(false)
    }
  }, [input, isPro, onUpgradeClick])

  const exportCsv = () => {
    if (!results) return
    const headers = [
      "URL", "Final URL", "Title", "Is Affiliate",
      "Affiliate Networks", "Ad Networks", "Affiliate Links Count",
      "Status Code", "Error",
    ]
    const rows = results.map((r) => [
      r.url,
      r.finalUrl || "",
      r.title || "",
      r.isAffiliate ? "Yes" : "No",
      r.affiliateNetworks.map((n) => n.name).join("; "),
      r.adNetworks.map((n) => n.name).join("; "),
      r.affiliateLinksCount.toString(),
      r.statusCode.toString(),
      r.error || "",
    ])
    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => `"${(cell || "").replace(/"/g, '""')}"`).join(","))
      .join("\n")
    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `bulk-check-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const sampleUrls = `https://www.nytimes.com/wirecutter/
https://www.tomsguide.com/
https://www.theverge.com/
https://www.cnet.com/`

  if (!isPro) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-3xl mx-auto"
      >
        <Card className="relative overflow-hidden p-8 sm:p-12 text-center border-dashed">
          <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 via-primary/5 to-chart-2/5 pointer-events-none" />
          <div className="relative">
            <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-gradient-to-br from-amber-500/20 to-primary/20 flex items-center justify-center">
              <Lock className="w-7 h-7 text-amber-500" />
            </div>
            <h3 className="text-2xl font-bold mb-2">Bulk Checker is a Pro feature</h3>
            <p className="text-muted-foreground max-w-md mx-auto mb-6 text-sm sm:text-base">
              Check up to 50 URLs at once. Get a clean CSV report with affiliate networks,
              ad networks, and link counts for every page. Pay once ($9), use forever.
            </p>

            {/* Preview table (visual only) */}
            <div className="rounded-lg border border-border/40 bg-muted/30 overflow-hidden mb-6 text-left">
              <div className="grid grid-cols-12 gap-2 px-3 py-2 bg-muted/60 text-xs font-medium text-muted-foreground">
                <div className="col-span-5">URL</div>
                <div className="col-span-2">Affiliate</div>
                <div className="col-span-3">Networks</div>
                <div className="col-span-2">Links</div>
              </div>
              {["https://example-blog.com/post", "https://another-site.com", "https://third-site.com"].map((u, i) => (
                <div key={u} className="grid grid-cols-12 gap-2 px-3 py-2 text-xs border-t border-border/30 opacity-60">
                  <div className="col-span-5 truncate">{u}</div>
                  <div className="col-span-2">{["Yes", "No", "Yes"][i]}</div>
                  <div className="col-span-3 truncate">{["Amazon, ShareASale", "-", "Impact"][i]}</div>
                  <div className="col-span-2">{["12", "0", "4"][i]}</div>
                </div>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row gap-2 justify-center">
              <Button onClick={onUpgradeClick} size="lg" className="gap-2 font-semibold">
                <Crown className="w-4 h-4" />
                Unlock with Pro for $9
              </Button>
              <Button onClick={onSignupClick} size="lg" variant="outline">
                Sign up free first
              </Button>
            </div>
          </div>
        </Card>
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-5xl mx-auto space-y-5"
    >
      <Card className="p-5 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="w-4 h-4 text-primary" />
              <h3 className="font-semibold text-base">Bulk URL Checker</h3>
              <Badge className="bg-amber-500/15 text-amber-600 border-amber-500/30 text-[10px]">
                <Crown className="w-2.5 h-2.5 mr-1" /> Pro
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Paste up to 50 URLs (one per line). Get a full audit in one click.
            </p>
          </div>
          <div className="text-right text-xs text-muted-foreground">
            <div>Max 50 URLs</div>
            <div>~10 seconds total</div>
          </div>
        </div>

        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={`https://www.example.com/post-1\nhttps://www.example.com/post-2\n...`}
          rows={8}
          className="font-mono text-xs"
        />

        <div className="flex items-center justify-between mt-3 gap-2">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setInput(sampleUrls)}
              className="text-xs text-primary hover:underline"
            >
              Try sample URLs
            </button>
            <span className="text-xs text-muted-foreground">·</span>
            <span className="text-xs text-muted-foreground">
              {input.split(/[\n,]/).filter((s) => s.trim()).length} URLs
            </span>
          </div>
          <div className="flex gap-2">
            {results && (
              <Button onClick={exportCsv} variant="outline" size="sm" className="gap-1.5">
                <Copy className="w-3.5 h-3.5" /> CSV
              </Button>
            )}
            <Button
              onClick={handleCheck}
              disabled={loading || !input.trim()}
              size="sm"
              className="gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Checking {progress.done}/{progress.total}...
                </>
              ) : (
                <>Check all URLs</>
              )}
            </Button>
          </div>
        </div>
      </Card>

      <AnimatePresence>
        {loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-2"
          >
            {Array.from({ length: 3 }).map((_, i) => (
              <Card key={i} className="p-4 animate-pulse">
                <div className="h-4 w-1/3 bg-muted/60 rounded mb-2" />
                <div className="h-3 w-2/3 bg-muted/40 rounded" />
              </Card>
            ))}
          </motion.div>
        )}

        {results && !loading && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-3"
          >
            {/* Summary */}
            <Card className="p-4 bg-muted/30">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                <Stat label="Total URLs" value={results.length} />
                <Stat label="Affiliate pages" value={results.filter((r) => r.isAffiliate).length} color="text-emerald-500" />
                <Stat label="No affiliate" value={results.filter((r) => !r.isAffiliate).length} color="text-rose-500" />
                <Stat label="Errors" value={results.filter((r) => r.error).length} color="text-amber-500" />
              </div>
            </Card>

            {/* Results table */}
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/40 text-xs text-muted-foreground">
                      <th className="text-left px-4 py-2.5 font-medium">URL</th>
                      <th className="text-center px-3 py-2.5 font-medium">Status</th>
                      <th className="text-left px-3 py-2.5 font-medium hidden md:table-cell">Affiliate networks</th>
                      <th className="text-left px-3 py-2.5 font-medium hidden lg:table-cell">Ad networks</th>
                      <th className="text-center px-3 py-2.5 font-medium">Links</th>
                      <th className="px-2 py-2.5"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((r, i) => (
                      <tr key={i} className="border-t border-border/40 hover:bg-muted/20">
                        <td className="px-4 py-3 max-w-xs">
                          <div className="font-medium text-xs truncate">{r.title || r.url}</div>
                          <div className="text-[11px] text-muted-foreground truncate">{r.url}</div>
                          {r.error && (
                            <div className="text-[10px] text-amber-500 mt-0.5">⚠ {r.error}</div>
                          )}
                        </td>
                        <td className="px-3 py-3 text-center">
                          {r.isAffiliate ? (
                            <span className="inline-flex items-center gap-1 text-emerald-500 text-xs font-medium">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline">Yes</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-rose-500 text-xs font-medium">
                              <XCircle className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline">No</span>
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-3 hidden md:table-cell">
                          {r.affiliateNetworks.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {r.affiliateNetworks.slice(0, 3).map((n) => (
                                <span key={n.name} className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                                  {n.name}
                                </span>
                              ))}
                              {r.affiliateNetworks.length > 3 && (
                                <span className="text-[10px] text-muted-foreground">+{r.affiliateNetworks.length - 3}</span>
                              )}
                            </div>
                          ) : (
                            <span className="text-[11px] text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-3 py-3 hidden lg:table-cell">
                          {r.adNetworks.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {r.adNetworks.slice(0, 3).map((n) => (
                                <span key={n.name} className="text-[10px] px-1.5 py-0.5 rounded bg-muted/60 border border-border/40">
                                  {n.name}
                                </span>
                              ))}
                              {r.adNetworks.length > 3 && (
                                <span className="text-[10px] text-muted-foreground">+{r.adNetworks.length - 3}</span>
                              )}
                            </div>
                          ) : (
                            <span className="text-[11px] text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-center font-mono text-xs tabular-nums">
                          {r.affiliateLinksCount}
                        </td>
                        <td className="px-2 py-3">
                          <a
                            href={r.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-muted-foreground hover:text-primary transition-colors inline-flex"
                          >
                            <ArrowUpRight className="w-3.5 h-3.5" />
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

function Stat({ label, value, color = "text-foreground" }: { label: string; value: number; color?: string }) {
  return (
    <div>
      <div className={`text-2xl font-bold tabular-nums ${color}`}>{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  )
}
