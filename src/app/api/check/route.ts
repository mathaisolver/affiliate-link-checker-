import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 30

// ----- Types -----
interface AffiliateNetwork {
  name: string
  domain: string
  url: string
  confidence: 'high' | 'medium' | 'low'
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
}

// ----- Affiliate network signatures -----
// Each entry: domains/patterns to look for in <a href>, plus disclosure hints
const AFFILIATE_NETWORKS: {
  name: string
  domains: string[]
  patterns?: RegExp[]
  category: string
  disclosureHints: string[]
}[] = [
  {
    name: 'Amazon Associates',
    domains: ['amazon.com', 'amzn.to', 'amzn.com', 'amazon.co.uk', 'amazon.ca', 'amazon.de', 'amazon.fr', 'amazon.es', 'amazon.it', 'amazon.co.jp', 'amazon.in', 'amazon.com.au', 'amazon.com.br', 'amazon.com.mx'],
    patterns: [/tag=[a-zA-Z0-9_-]+-\d{2,}/i, /tag=[a-zA-Z0-9_]+/i],
    category: 'Retail / Marketplace',
    disclosureHints: ['amazon associate', 'amazon services llc associates program', 'amazon.com affiliate'],
  },
  {
    name: 'Impact Radius',
    domains: ['impact.com', 'impacts', 'go.skimresources.com', 'go.redirectingat.com', 'imp.af', 'impactradius'],
    category: 'Affiliate Network',
    disclosureHints: ['impact radius', 'impact.com affiliate'],
  },
  {
    name: 'ShareASale',
    domains: ['shareasale.com', 'shareasale-analytics.com', 'shareasale-affiliate'],
    category: 'Affiliate Network',
    disclosureHints: ['shareasale', 'share a sale'],
  },
  {
    name: 'CJ Affiliate (Commission Junction)',
    domains: ['cj.com', 'qksrv.net', 'kqzyfj.com', 'tkqlhao.com', 'qksz.net', 'tqlkg.com', 'dxklopm.com', 'anrdoezrs.net', 'emjcd.com', 'jdoqocy.com', 'afcyhb.com', 'apmebf.com', 'ftjcfx.com', 'kcdhlny.com', 'lduhtrp.net', 'pjnet.xyz', 'linksynergy', 'linksynergy.com'],
    category: 'Affiliate Network',
    disclosureHints: ['commission junction', 'cj affiliate', 'linksynergy'],
  },
  {
    name: 'Rakuten Advertising (LinkShare)',
    domains: ['rakutenadvertising.com', 'linksynergy.com', 'rakuten.com', 'rakuten.co.jp', 'click.linksynergy.com'],
    category: 'Affiliate Network',
    disclosureHints: ['rakuten', 'rakuten advertising', 'rakuten marketing', 'linkshare'],
  },
  {
    name: 'Awin',
    domains: ['awin1.com', 'awin.com', 'zenaps.com', 'wintricks.com'],
    category: 'Affiliate Network',
    disclosureHints: ['awin', 'awin affiliate'],
  },
  {
    name: 'Skimlinks',
    domains: ['go.skimresources.com', 'skimresources.com', 'skimlinks.com', 'go.redirectingat.com', 'redirectingat.com'],
    category: 'Affiliate Network',
    disclosureHints: ['skimlinks', 'skimlinks affiliate'],
  },
  {
    name: 'ClickBank',
    domains: ['clickbank.net', 'clickbank.com', 'hop.clickbank.net', '1.payloadbeta.com', 'hoplinks.com', 'zzzzz.clickbank.net'],
    category: 'Affiliate Network',
    disclosureHints: ['clickbank', 'click bank'],
  },
  {
    name: 'AvantLink',
    domains: ['avantlink.com', 'avlnk.net', 'avlnk.com'],
    category: 'Affiliate Network',
    disclosureHints: ['avantlink'],
  },
  {
    name: 'PartnerStack',
    domains: ['partnerstack.com', 'psell.co', 'appsumo.8base.com'],
    category: 'Affiliate Network',
    disclosureHints: ['partnerstack', 'partner stack'],
  },
  {
    name: 'Refersion',
    domains: ['refersion.com', 'rfer.us'],
    category: 'Affiliate Network',
    disclosureHints: ['refersion'],
  },
  {
    name: 'Post Affiliate Pro',
    domains: ['qualityunit.com', 'postaffiliatepro.com', 'affiliate-pro.com'],
    category: 'Affiliate Software',
    disclosureHints: ['post affiliate pro', 'qualityunit'],
  },
  {
    name: 'Tapfiliate',
    domains: ['tapfiliate.com', 'tapfiliate.net'],
    category: 'Affiliate Software',
    disclosureHints: ['tapfiliate'],
  },
  {
    name: 'HasOffers / Tune',
    domains: ['hasoffers.com', 'tune.com', 'go2cloud.org', 'go2app.com'],
    category: 'Affiliate Network',
    disclosureHints: ['hasoffers', 'tune.com affiliate'],
  },
  {
    name: 'TradeDoubler',
    domains: ['tradedoubler.com', 'td.eu', 'clmbtrk.com'],
    category: 'Affiliate Network',
    disclosureHints: ['tradedoubler'],
  },
  {
    name: 'Webgains',
    domains: ['webgains.com', 'wg-aff.com'],
    category: 'Affiliate Network',
    disclosureHints: ['webgains'],
  },
  {
    name: 'eBay Partner Network',
    domains: ['rover.ebay.com', 'ebay.com', 'partners.ebay.com', 'epn.ebay.com'],
    patterns: [/campid=\d+/i, /customid=/i],
    category: 'Marketplace Affiliate',
    disclosureHints: ['ebay partner network', 'epn', 'ebay affiliate'],
  },
  {
    name: 'Walmart Affiliate Program',
    domains: ['affiliates.walmart.com', 'walmart.com/go'],
    patterns: [/affil=/i, /wl1=/i],
    category: 'Retail Affiliate',
    disclosureHints: ['walmart affiliate'],
  },
  {
    name: 'Booking.com Affiliate',
    domains: ['booking.com', 'bookingsync.com'],
    patterns: [/aid=\d{5,}/i],
    category: 'Travel Affiliate',
    disclosureHints: ['booking.com affiliate', 'booking affiliate partner'],
  },
  {
    name: 'ShopStyle',
    domains: ['shopstyle.com', 'shopstyle.it'],
    category: 'Affiliate Network',
    disclosureHints: ['shopstyle'],
  },
  {
    name: 'RewardStyle / LTK',
    domains: ['rewardstyle.com', 'ltkapp.com', 'rstyle.me', 'rstyle.to'],
    category: 'Affiliate Network',
    disclosureHints: ['rewardstyle', 'ltk', 'liketk.it'],
  },
  {
    name: 'MagicLinx',
    domains: ['magiclinx.com', 'magic-lnx.com'],
    category: 'Affiliate Network',
    disclosureHints: ['magiclinx'],
  },
  {
    name: 'VigLink / Sovrn',
    domains: ['viglink.com', 'sovrn.com', 'sovrn.co', 'redirect.viglink.com'],
    category: 'Affiliate Network',
    disclosureHints: ['viglink', 'sovrn'],
  },
  {
    name: 'Etsy Affiliate',
    domains: ['etsy.com'],
    patterns: [/aff=awsmerch/i, /aff=[a-zA-Z0-9]+/i],
    category: 'Marketplace Affiliate',
    disclosureHints: ['etsy affiliate', 'etsy associates'],
  },
  {
    name: 'AliExpress Affiliate',
    domains: ['s.click.aliexpress.com', 'aliexpress.com', 'aliexpress.com/e/_9Ni'],
    patterns: [/aff_fcid=/i, /aff_click_id=/i],
    category: 'Marketplace Affiliate',
    disclosureHints: ['aliexpress affiliate', 'portals affiliate program'],
  },
  {
    name: 'Target Partners',
    domains: ['target.com', 'partners.target.com'],
    patterns: [/ref=/i],
    category: 'Retail Affiliate',
    disclosureHints: ['target partners', 'target affiliate'],
  },
]

// ----- Ad networks -----
const AD_NETWORKS: { name: string; domain: string; type: string; patterns?: RegExp[] }[] = [
  { name: 'Google AdSense', domain: 'google.com/adsense', type: 'Display Ads', patterns: [/google_ad_client/i, /googlesyndication\.com/i, /adsbygoogle\.js/i, /pub-\d{16,}/i] },
  { name: 'Media.net', domain: 'media.net', type: 'Display Ads', patterns: [/media\.net/i, /media\.net\/ads/i] },
  { name: 'Amazon Associates (Display)', domain: 'amazon-adsystem.com', type: 'Native Ads', patterns: [/amazon-adsystem\.com/i, /aax-us-east\.amazon-adsystem\.com/i] },
  { name: 'AdThrive', domain: 'adthrive.com', type: 'Display Ads', patterns: [/adthrive\.com/i, /ads\.adthrive\.com/i] },
  { name: 'Mediavine', domain: 'mediavine.com', type: 'Display Ads', patterns: [/mediavine\.com/i, /scripts\.mediavine\.com/i] },
  { name: 'AdSense for Search', domain: 'google.com', type: 'Search Ads', patterns: [/google_afc/i] },
  { name: 'Taboola', domain: 'taboola.com', type: 'Native Ads', patterns: [/taboola\.com/i, /cdn\.taboola\.com/i] },
  { name: 'Outbrain', domain: 'outbrain.com', type: 'Native Ads', patterns: [/outbrain\.com/i, /widgets\.outbrain\.com/i] },
  { name: 'Ezoic', domain: 'ezoic.com', type: 'Display Ads', patterns: [/ezoic\.com/i, /ezojs\.com/i] },
  { name: 'Sovrn (Ads)', domain: 'sovrn.com', type: 'Display Ads', patterns: [/sovrn\.com\/ads/i, /lixif/i] },
  { name: 'Carbon Ads', domain: 'carbonads.com', type: 'Developer Ads', patterns: [/carbonads\.com/i, /carbonads/i] },
  { name: 'BuySellAds', domain: 'buysellads.com', type: 'Marketplace Ads', patterns: [/buysellads\.com/i, /bsads/i] },
  { name: 'Infolinks', domain: 'infolinks.com', type: 'Inline Ads', patterns: [/infolinks\.com/i] },
  { name: 'AdMob', domain: 'google.com', type: 'Mobile Ads', patterns: [/google_admob/i, /apps\.admob\.com/i] },
  { name: 'Raptive', domain: 'raptive.com', type: 'Display Ads', patterns: [/raptive\.com/i, /raptive-ad/i] },
]

// General affiliate query parameters (used as a fallback detection)
const GENERIC_AFFILIATE_PARAMS = [
  'aff', 'affid', 'aff_id', 'affiliate', 'affiliate_id', 'ref', 'refid', 'ref_id',
  'clickid', 'click_id', 'cid', 'campaign', 'cmp', 'utm_affiliate', 'partner',
  'subid', 'sub_id', 'tid', 'track', 'tracking', 'atid', 'ptag', 'irclickid',
  'utm_source=affiliate', 'p1', 'irclickid2', 'irclickid3', 'aff_sub',
]

const DISCLOSURE_KEYWORDS = [
  'affiliate link', 'affiliate links', 'affiliate disclosure', 'affiliate marketing',
  'we may earn', 'we earn', 'i earn a commission', 'i may earn a commission',
  'commission if you', 'commission on qualifying', 'as an amazon associate',
  'associate i earn', 'at no extra cost to you', 'at no additional cost to you',
  'paid commission', 'this post contains affiliate', 'this page contains affiliate',
  'may contain affiliate', 'compensated for referring', ' FTC ', 'federal trade commission',
  'advertising fees', 'advertising and linking', 'please note that this post contains affiliate',
  'sponsored content', 'sponsored post',
]

// ----- Helpers -----
function safeParseUrl(u: string): URL | null {
  try {
    return new URL(u)
  } catch {
    return null
  }
}

function normalizeUrl(input: string): string | null {
  let u = input.trim()
  if (!u) return null
  if (!/^https?:\/\//i.test(u)) {
    u = 'https://' + u
  }
  return safeParseUrl(u) ? u : null
}

function decodeHtmlEntities(s: string): string {
  if (!s) return s
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#34;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
}

function extractLinks(html: string, baseUrl: URL): { href: string; text: string }[] {
  const links: { href: string; text: string }[] = []
  const aTagRegex = /<a\b[^>]*?href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi
  let m: RegExpExecArray | null
  while ((m = aTagRegex.exec(html)) !== null) {
    const rawHref = m[1]
    const text = decodeHtmlEntities(m[2].replace(/<[^>]+>/g, '').trim())
    try {
      const resolved = new URL(rawHref, baseUrl).toString()
      if (resolved.startsWith('http://') || resolved.startsWith('https://')) {
        links.push({ href: resolved, text })
      }
    } catch {
      // ignore
    }
  }
  return links
}

function extractMetaAndOg(html: string): {
  title: string | null
  description: string | null
  meta: { name: string; content: string }[]
  og: { property: string; content: string }[]
  favicon: string | null
} {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  const title = titleMatch ? decodeHtmlEntities(titleMatch[1].trim()) : null

  const meta: { name: string; content: string }[] = []
  const metaRegex = /<meta\b[^>]*?(?:name|http-equiv)\s*=\s*["']([^"']+)["'][^>]*?content\s*=\s*["']([^"']*)["'][^>]*>/gi
  let m: RegExpExecArray | null
  while ((m = metaRegex.exec(html)) !== null) {
    meta.push({ name: m[1].toLowerCase(), content: decodeHtmlEntities(m[2]) })
  }
  // meta variant: content before name
  const metaRegex2 = /<meta\b[^>]*?content\s*=\s*["']([^"']*)["'][^>]*?(?:name|http-equiv)\s*=\s*["']([^"']+)["'][^>]*>/gi
  while ((m = metaRegex2.exec(html)) !== null) {
    meta.push({ name: m[2].toLowerCase(), content: decodeHtmlEntities(m[1]) })
  }

  const og: { property: string; content: string }[] = []
  const ogRegex = /<meta\b[^>]*?property\s*=\s*["'](og:[^"']+)["'][^>]*?content\s*=\s*["']([^"']*)["'][^>]*>/gi
  while ((m = ogRegex.exec(html)) !== null) {
    og.push({ property: m[1], content: decodeHtmlEntities(m[2]) })
  }
  const ogRegex2 = /<meta\b[^>]*?content\s*=\s*["']([^"']*)["'][^>]*?property\s*=\s*["'](og:[^"']+)["'][^>]*>/gi
  while ((m = ogRegex2.exec(html)) !== null) {
    og.push({ property: m[2], content: decodeHtmlEntities(m[1]) })
  }

  const description =
    meta.find((x) => x.name === 'description')?.content ||
    og.find((x) => x.property === 'og:description')?.content ||
    null

  // favicon detection
  let favicon: string | null = null
  const iconRegex = /<link\b[^>]*?rel\s*=\s*["'](?:shortcut )?icon["'][^>]*?href\s*=\s*["']([^"']+)["'][^>]*>/i
  const iconMatch = html.match(iconRegex)
  if (iconMatch) {
    favicon = iconMatch[1]
    if (favicon && !favicon.startsWith('http')) {
      try {
        favicon = new URL(favicon, baseUrlHolder.url).toString()
      } catch {
        // ignore
      }
    }
  }

  return { title, description, meta, og, favicon }
}

// We need baseUrl for favicon resolution, store temporarily
const baseUrlHolder: { url: string } = { url: '' }

function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

function findDisclosure(html: string): Disclosure {
  // Strip scripts/styles for cleaner text
  const cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
  const plainText = stripHtml(decodeHtmlEntities(cleaned)).toLowerCase()

  const snippets: string[] = []
  const seen = new Set<string>()

  for (const keyword of DISCLOSURE_KEYWORDS) {
    const idx = plainText.indexOf(keyword)
    if (idx >= 0) {
      // try to extract a sentence-like snippet around the keyword
      const start = Math.max(0, plainText.lastIndexOf('.', idx) + 1, idx - 200)
      const end = Math.min(plainText.length, plainText.indexOf('.', idx + keyword.length) + 1, idx + 280)
      let snip = plainText.slice(start, end).trim()
      if (snip.length > 350) snip = snip.slice(0, 350) + '…'
      const key = snip.slice(0, 120)
      if (!seen.has(key)) {
        seen.add(key)
        snippets.push(snip.charAt(0).toUpperCase() + snip.slice(1))
      }
    }
  }

  return {
    found: snippets.length > 0,
    snippets: snippets.slice(0, 4),
  }
}

// ----- Main POST handler -----
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const rawUrl: string = (body?.url || '').toString()
  const normalized = normalizeUrl(rawUrl)

  if (!normalized) {
    return NextResponse.json(
      { error: 'Please provide a valid URL, e.g. https://example.com' },
      { status: 400 }
    )
  }

  const startedAt = Date.now()
  const targetUrl = new URL(normalized)
  baseUrlHolder.url = targetUrl.origin

  const result: CheckResult = {
    url: rawUrl.trim(),
    finalUrl: null,
    title: null,
    description: null,
    favicon: null,
    statusCode: 0,
    isAffiliate: false,
    affiliateNetworks: [],
    adNetworks: [],
    affiliateLinks: [],
    disclosure: { found: false, snippets: [] },
    metaTags: [],
    openGraph: [],
    stats: {
      totalLinks: 0,
      externalLinks: 0,
      affiliateLinksCount: 0,
      pageWeightKb: 0,
    },
    fetchMs: 0,
  }

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 12000)

    const res = await fetch(normalized, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; AffiliateLinkChecker/1.0; +https://affiliate-link-checker.vercel.app)',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      redirect: 'follow',
      signal: controller.signal,
    })
    clearTimeout(timeout)

    result.statusCode = res.status
    result.finalUrl = res.url
    const finalUrl = safeParseUrl(res.url) || targetUrl
    baseUrlHolder.url = finalUrl.origin

    const contentType = res.headers.get('content-type') || ''
    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
      // Non-HTML — we can still try to read but no parsing
      const buf = await res.arrayBuffer()
      result.stats.pageWeightKb = Math.round(buf.byteLength / 1024)
      result.error = 'Page is not HTML (likely a file or API). Limited analysis.'
      result.fetchMs = Date.now() - startedAt
      return NextResponse.json(result)
    }

    const html = await res.text()
    result.stats.pageWeightKb = Math.round(new TextEncoder().encode(html).length / 1024)

    // Extract metadata
    const parsed = extractMetaAndOg(html)
    result.title = parsed.title
    result.description = parsed.description
    result.favicon = parsed.favicon || `${finalUrl.origin}/favicon.ico`
    result.metaTags = parsed.meta.slice(0, 20)
    result.openGraph = parsed.og.slice(0, 12)

    // Extract links
    const links = extractLinks(html, finalUrl)
    result.stats.totalLinks = links.length

    const finalOrigin = finalUrl.origin.toLowerCase()
    const externalLinks = links.filter(
      (l) => !l.href.toLowerCase().startsWith(finalOrigin) && !l.href.toLowerCase().startsWith(targetUrl.origin.toLowerCase())
    )
    result.stats.externalLinks = externalLinks.length

    // Affiliate link & network detection
    const detectedNetworks = new Map<string, AffiliateNetwork>()
    const detectedAdNetworks = new Map<string, AdNetwork>()
    const detectedAffiliateLinks: AffiliateLink[] = []

    const linkSeen = new Set<string>()

    for (const link of links) {
      const hrefLower = link.href.toLowerCase()
      let matchedNetwork: string | null = null

      // 1) domain match
      for (const net of AFFILIATE_NETWORKS) {
        if (net.domains.some((d) => hrefLower.includes(d.toLowerCase()))) {
          matchedNetwork = net.name
          if (!detectedNetworks.has(net.name)) {
            detectedNetworks.set(net.name, {
              name: net.name,
              domain: net.domains[0],
              url: link.href,
              confidence: 'high',
              category: net.category,
            })
          }
          break
        }
      }

      // 2) pattern match
      if (!matchedNetwork) {
        for (const net of AFFILIATE_NETWORKS) {
          if (net.patterns && net.patterns.some((p) => p.test(link.href))) {
            matchedNetwork = net.name
            if (!detectedNetworks.has(net.name)) {
              detectedNetworks.set(net.name, {
                name: net.name,
                domain: net.domains[0],
                url: link.href,
                confidence: 'medium',
                category: net.category,
              })
            }
            break
          }
        }
      }

      // 3) generic affiliate params
      if (!matchedNetwork) {
        const urlObj = safeParseUrl(link.href)
        if (urlObj) {
          const params = urlObj.searchParams
          const hasGeneric = GENERIC_AFFILIATE_PARAMS.some((p) => {
            if (params.has(p)) return true
            // Also look for prefix-based params like aff_sub2
            for (const k of params.keys()) {
              if (k.toLowerCase() === p || k.toLowerCase().startsWith(p + '_')) return true
            }
            return false
          })
          if (hasGeneric) {
            matchedNetwork = 'Generic Affiliate Link'
            if (!detectedNetworks.has(matchedNetwork)) {
              detectedNetworks.set(matchedNetwork, {
                name: matchedNetwork,
                domain: new URL(link.href).host,
                url: link.href,
                confidence: 'low',
                category: 'Affiliate Link',
              })
            }
          }
        }
      }

      if (matchedNetwork) {
        const key = link.href + '|' + matchedNetwork
        if (!linkSeen.has(key)) {
          linkSeen.add(key)
          detectedAffiliateLinks.push({
            url: link.href,
            network: matchedNetwork,
            text: link.text || '(no anchor text)',
          })
        }
      }
    }

    // Detect ad networks (scan HTML for ad network signatures)
    const htmlLower = html.toLowerCase()
    for (const ad of AD_NETWORKS) {
      const matched =
        htmlLower.includes(ad.domain.toLowerCase()) ||
        (ad.patterns && ad.patterns.some((p) => p.test(html)))
      if (matched && !detectedAdNetworks.has(ad.name)) {
        detectedAdNetworks.set(ad.name, { name: ad.name, domain: ad.domain, type: ad.type })
      }
    }

    // Affiliate disclosure
    const disclosure = findDisclosure(html)

    // Affiliate confirmation by disclosure hints
    const plainForDisclosure = disclosure.snippets.join(' ').toLowerCase()
    for (const net of AFFILIATE_NETWORKS) {
      if (detectedNetworks.has(net.name)) continue
      for (const hint of net.disclosureHints) {
        if (plainForDisclosure.includes(hint)) {
          detectedNetworks.set(net.name, {
            name: net.name,
            domain: net.domains[0],
            url: '',
            confidence: 'low',
            category: net.category,
          })
          break
        }
      }
    }

    result.affiliateNetworks = Array.from(detectedNetworks.values())
    result.adNetworks = Array.from(detectedAdNetworks.values())
    result.affiliateLinks = detectedAffiliateLinks.slice(0, 200)
    result.disclosure = disclosure
    result.stats.affiliateLinksCount = detectedAffiliateLinks.length
    result.isAffiliate =
      detectedAffiliateLinks.length > 0 ||
      result.affiliateNetworks.length > 0 ||
      disclosure.found
    result.fetchMs = Date.now() - startedAt

    return NextResponse.json(result)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown fetch error'
    result.error = message.includes('aborted')
      ? 'Request timed out (server took too long to respond).'
      : `Fetch failed: ${message}`
    result.fetchMs = Date.now() - startedAt
    return NextResponse.json(result, { status: 200 })
  }
}
