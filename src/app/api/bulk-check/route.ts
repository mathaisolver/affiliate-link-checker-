import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin, getUserFromRequest, hashIp } from '@/lib/supabase-server'
import { TIERS, LIMITS, type Tier } from '@/lib/tiers'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60  // bulk check takes longer

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

/**
 * POST /api/bulk-check
 * Body: { urls: string[] }
 *
 * Pro-only endpoint. Processes up to 50 URLs at once using the same
 * detection logic as /api/check, but returns a condensed per-URL summary
 * suitable for a table view.
 */
export async function POST(req: NextRequest) {
  // === AUTH: bulk is Pro-only ===
  const userId = await getUserFromRequest(req)
  if (!userId) {
    return NextResponse.json(
      {
        error: 'Bulk check is a Pro feature. Sign up and upgrade for $9 lifetime to use it.',
        upgradeUrl: process.env.NEXT_PUBLIC_SITE_URL + '/#upgrade',
      },
      { status: 403 }
    )
  }

  // Verify Pro tier
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('tier, email')
    .eq('id', userId)
    .maybeSingle()
  if (profile?.tier !== 'pro') {
    return NextResponse.json(
      {
        error: 'Bulk check is a Pro feature. Upgrade for $9 lifetime to use it.',
        upgradeUrl: process.env.NEXT_PUBLIC_SITE_URL + '/#upgrade',
      },
      { status: 403 }
    )
  }

  // Parse body
  const body = await req.json().catch(() => ({}))
  const urls: string[] = Array.isArray(body?.urls) ? body.urls : []

  if (urls.length === 0) {
    return NextResponse.json({ error: 'Please provide an array of URLs.' }, { status: 400 })
  }

  // Limit to 50 URLs per bulk job
  const trimmedUrls = urls.slice(0, 50).map((u) => u.trim()).filter(Boolean)

  if (trimmedUrls.length === 0) {
    return NextResponse.json({ error: 'No valid URLs provided.' }, { status: 400 })
  }

  // Process URLs in parallel with a concurrency limit of 5
  const results: BulkResult[] = []
  const CONCURRENCY = 5
  const chunks: string[][] = []
  for (let i = 0; i < trimmedUrls.length; i += CONCURRENCY) {
    chunks.push(trimmedUrls.slice(i, i + CONCURRENCY))
  }

  for (const chunk of chunks) {
    const chunkResults = await Promise.allSettled(
      chunk.map(async (rawUrl): Promise<BulkResult> => {
        try {
          // Fetch the URL with a browser-like UA
          const normalized = rawUrl.startsWith('http') ? rawUrl : 'https://' + rawUrl
          const controller = new AbortController()
          const timeout = setTimeout(() => controller.abort(), 12000)
          const res = await fetch(normalized, {
            headers: {
              'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
              Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
              'Accept-Language': 'en-US,en;q=0.9',
            },
            redirect: 'follow',
            signal: controller.signal,
          })
          clearTimeout(timeout)

          const contentType = res.headers.get('content-type') || ''
          if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
            return {
              url: rawUrl,
              finalUrl: res.url,
              title: null,
              isAffiliate: false,
              affiliateNetworks: [],
              adNetworks: [],
              affiliateLinksCount: 0,
              statusCode: res.status,
              error: 'Not HTML',
            }
          }

          const html = await res.text()

          // Extract title
          const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
          const title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, '').trim() : null

          // Extract links
          const baseUrl = new URL(res.url)
          const links: { href: string; text: string; rel: string; attrs: string }[] = []
          const aTagRegex = /<a\b([^>]*?)href\s*=\s*["']([^"']+)["']([^>]*?)>([\s\S]*?)<\/a>/gi
          let m: RegExpExecArray | null
          while ((m = aTagRegex.exec(html)) !== null) {
            const fullAttrs = (m[1] || '') + (m[3] || '')
            const text = m[4].replace(/<[^>]+>/g, '').trim()
            const relMatch = fullAttrs.match(/rel\s*=\s*["']([^"']+)["']/i)
            const rel = relMatch ? relMatch[1].toLowerCase() : ''
            try {
              const resolved = new URL(m[2], baseUrl).toString()
              if (resolved.startsWith('http://') || resolved.startsWith('https://')) {
                links.push({ href: resolved, text, rel, attrs: fullAttrs })
              }
            } catch {}
          }

          // === Inline detection logic (lightweight version) ===
          const sourceHost = baseUrl.hostname.toLowerCase()
          const detectedNetworks = new Set<string>()
          let affiliateLinksCount = 0
          let sponsoredLinksCount = 0

          const NON_AFFILIATE_DOMAINS = [
            'facebook.com', 'twitter.com', 'x.com', 'linkedin.com', 'instagram.com',
            'pinterest.com', 'youtube.com', 'youtu.be', 'tiktok.com', 'reddit.com',
            'whatsapp.com', 'wa.me', 'telegram.org', 't.me', 'google.com', 'bing.com',
          ]
          function isNonAffiliateDomain(u: string): boolean {
            try {
              const host = new URL(u).hostname.toLowerCase()
              return NON_AFFILIATE_DOMAINS.some((d) => host === d || host.endsWith('.' + d))
            } catch {
              return false
            }
          }

          // Domain patterns for top networks
          const NETWORK_DOMAINS: { name: string; domains: string[]; category: string }[] = [
            { name: 'Amazon Associates', domains: ['amazon.com', 'amzn.to', 'a.co', 'amazon.co.uk', 'amazon.ca', 'amazon.de', 'amazon.fr'], category: 'Retail' },
            { name: 'Impact Radius', domains: ['impact.com', 'imp.af'], category: 'Affiliate Network' },
            { name: 'ShareASale', domains: ['shareasale.com', 'shrsl.com'], category: 'Affiliate Network' },
            { name: 'CJ Affiliate', domains: ['qksrv.net', 'kqzyfj.com', 'tkqlhao.com', 'jdoqocy.com', 'anrdoezrs.net', 'emjcd.com', 'linksynergy.com'], category: 'Affiliate Network' },
            { name: 'Awin', domains: ['awin1.com', 'awin.com'], category: 'Affiliate Network' },
            { name: 'Skimlinks', domains: ['go.skimresources.com', 'skimresources.com', 'skimlinks.com', 'go.redirectingat.com'], category: 'Affiliate Network' },
            { name: 'Rakuten', domains: ['rakutenadvertising.com', 'click.linksynergy.com'], category: 'Affiliate Network' },
            { name: 'ClickBank', domains: ['clickbank.net', 'hop.clickbank.net'], category: 'Affiliate Network' },
            { name: 'AvantLink', domains: ['avantlink.com', 'avlnk.net'], category: 'Affiliate Network' },
            { name: 'eBay Partner Network', domains: ['rover.ebay.com', 'epn.ebay.com'], category: 'Marketplace' },
            { name: 'Booking.com Affiliate', domains: ['booking.com'], category: 'Travel' },
            { name: 'RewardStyle / LTK', domains: ['rstyle.me', 'liketk.it', 'ltkapp.com'], category: 'Affiliate Network' },
            { name: 'VigLink', domains: ['redirect.viglink.com'], category: 'Affiliate Network' },
            { name: 'AliExpress Affiliate', domains: ['s.click.aliexpress.com'], category: 'Marketplace' },
          ]

          // Ad network patterns
          const AD_NETWORKS: { name: string; type: string; pattern: RegExp }[] = [
            { name: 'Google AdSense', type: 'Display Ads', pattern: /adsbygoogle\.js|ca-pub-\d{16,}/i },
            { name: 'Mediavine', type: 'Display Ads', pattern: /scripts\.mediavine\.com/i },
            { name: 'AdThrive', type: 'Display Ads', pattern: /ads\.adthrive\.com|adthrive\.com\/ads/i },
            { name: 'Raptive', type: 'Display Ads', pattern: /raptive\.com\/ad|raptive-ad/i },
            { name: 'Media.net', type: 'Display Ads', pattern: /contextual\.media\.net|media\.net\/mediakit/i },
            { name: 'Taboola', type: 'Native Ads', pattern: /cdn\.taboola\.com|libtrc\.com/i },
            { name: 'Outbrain', type: 'Native Ads', pattern: /widgets\.outbrain\.com|outbrain\.com\/norm/i },
            { name: 'Ezoic', type: 'Display Ads', pattern: /ezoic\.com\/pub|ezojs\.com/i },
          ]

          // Affiliate subdomain prefixes
          const AFFILIATE_SUBDOMAIN_PREFIXES = [
            'go.', 'redirect.', 'track.', 'hop.', 'out.', 'aff.', 'jump.',
            'click.', 'refer.', 'r.', 'link.', 'links.', 'deals.',
            'visit.', 'partner.', 'partners.', 'promo.', 'sponsor.', 'sponsored.',
          ]

          for (const link of links) {
            const hrefLower = link.href.toLowerCase()
            if (isNonAffiliateDomain(link.href)) {
              if (link.rel && link.rel.includes('sponsored')) sponsoredLinksCount++
              continue
            }
            if (link.rel && (link.rel.includes('sponsored') || link.rel.includes('affiliated'))) {
              affiliateLinksCount++
              sponsoredLinksCount++
              continue
            }
            let matched = false
            for (const net of NETWORK_DOMAINS) {
              if (net.domains.some((d) => hrefLower.includes(d.toLowerCase()))) {
                detectedNetworks.add(net.name)
                affiliateLinksCount++
                matched = true
                break
              }
            }
            if (matched) continue
            // Check affiliate subdomain
            try {
              const linkHost = new URL(link.href).hostname.toLowerCase()
              if (
                linkHost !== sourceHost &&
                !linkHost.endsWith('.' + sourceHost) &&
                AFFILIATE_SUBDOMAIN_PREFIXES.some((p) => linkHost.startsWith(p))
              ) {
                affiliateLinksCount++
              }
            } catch {}
          }

          // Detect ad networks
          const detectedAds: { name: string; type: string }[] = []
          const hasPremium = AD_NETWORKS.some((a) => a.pattern.test(html) && (a.name === 'Mediavine' || a.name === 'AdThrive' || a.name === 'Raptive'))
          for (const ad of AD_NETWORKS) {
            if (ad.pattern.test(html)) {
              // Smart AdSense exclusion
              if (ad.name === 'Google AdSense' && hasPremium) {
                const strictAdSense = /adsbygoogle\.js|ca-pub-\d{16,}/i.test(html)
                if (!strictAdSense) continue
              }
              detectedAds.push({ name: ad.name, type: ad.type })
            }
          }

          // Disclosure check
          const cleaned = html
            .replace(/<script[\s\S]*?<\/script>/gi, ' ')
            .replace(/<style[\s\S]*?<\/style>/gi, ' ')
          const plainText = cleaned.replace(/<[^>]+>/g, ' ').toLowerCase()
          const hasDisclosure = [
            'affiliate link', 'affiliate disclosure', 'as an amazon associate',
            'we may earn', 'commission if you', 'at no extra cost to you',
          ].some((kw) => plainText.includes(kw))

          const affiliateNetworksList = Array.from(detectedNetworks).map((name) => {
            const net = NETWORK_DOMAINS.find((n) => n.name === name)
            return { name, category: net?.category || 'Affiliate Network' }
          })

          return {
            url: rawUrl,
            finalUrl: res.url,
            title,
            isAffiliate: affiliateLinksCount > 0 || affiliateNetworksList.length > 0 || hasDisclosure || sponsoredLinksCount > 0,
            affiliateNetworks: affiliateNetworksList,
            adNetworks: detectedAds,
            affiliateLinksCount,
            statusCode: res.status,
          }
        } catch (err: unknown) {
          return {
            url: rawUrl,
            finalUrl: null,
            title: null,
            isAffiliate: false,
            affiliateNetworks: [],
            adNetworks: [],
            affiliateLinksCount: 0,
            statusCode: 0,
            error: err instanceof Error ? err.message : 'Fetch failed',
          }
        }
      })
    )
    for (const r of chunkResults) {
      if (r.status === 'fulfilled') results.push(r.value)
    }
  }

  // Record this as a single usage entry
  await supabaseAdmin.from('usage_tracking').insert({
    user_id: userId,
    url_checked: `[BULK] ${results.length} URLs`,
  })

  // Save the bulk job for future reference
  await supabaseAdmin.from('bulk_jobs').insert({
    user_id: userId,
    urls: trimmedUrls,
    results,
    status: 'completed',
    completed_at: new Date().toISOString(),
  })

  return NextResponse.json({
    results,
    count: results.length,
    usage: {
      tier: TIERS.PRO,
      bulkLimit: 50,
    },
  })
}
