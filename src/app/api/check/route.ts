import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin, getUserFromRequest, hashIp } from '@/lib/supabase-server'
import { TIERS, LIMITS, type Tier } from '@/lib/tiers'

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
}

/* ---------------------------------------------------------- */
/* SOCIAL MEDIA / NON-AFFILIATE DOMAIN EXCLUSION              */
/* Sites in this list are NEVER flagged as affiliate networks. */
/* Their share links have query params that look like affiliate */
/* tags (e.g. facebook.com/sharer.php?u=...) and were causing   */
/* false positives.                                            */
/* ---------------------------------------------------------- */
const NON_AFFILIATE_DOMAINS: string[] = [
  'facebook.com', 'www.facebook.com', 'm.facebook.com', 'fb.com',
  'twitter.com', 'x.com', 'www.twitter.com',
  'linkedin.com', 'www.linkedin.com',
  'instagram.com', 'www.instagram.com',
  'pinterest.com', 'www.pinterest.com', 'pin.it',
  'youtube.com', 'www.youtube.com', 'youtu.be',
  'tiktok.com', 'www.tiktok.com',
  'reddit.com', 'www.reddit.com',
  'whatsapp.com', 'wa.me',
  'telegram.org', 't.me',
  'snapchat.com',
  'tumblr.com',
  'medium.com',
  'github.com',
  'gitlab.com',
  'stackoverflow.com',
  'wikipedia.org',
  'google.com', 'www.google.com',
  'bing.com',
  'duckduckgo.com',
  'apple.com', 'www.apple.com',
  'microsoft.com',
  'mozilla.org',
  'adobe.com',
  'amazon.com',  // Handled by Amazon Associates specifically (not generic)
  'amzn.to',
  'paypal.com',
  'stripe.com',
  'mailto:',  // email links
  'tel:',     // phone links
  'sms:',     // sms links
  'whatsapp:', 'telegram:', 'signal:', 'skype:', 'facetime:',
]

function isNonAffiliateDomain(url: string): boolean {
  try {
    const u = new URL(url)
    const host = u.hostname.toLowerCase()
    return NON_AFFILIATE_DOMAINS.some((d) => host === d || host.endsWith('.' + d) || host === d.replace(/^www\./, ''))
  } catch {
    return false
  }
}

// ----- Affiliate network signatures -----
// IMPORTANT: Patterns must be SPECIFIC to that network, not generic query params.
// Generic patterns like `?ref=`, `?u=`, `?url=`, `?id=` cause false positives on
// social media share URLs and have been removed.
const AFFILIATE_NETWORKS: {
  name: string
  domains: string[]
  patterns?: RegExp[]
  category: string
  disclosureHints: string[]
}[] = [
  {
    name: 'Amazon Associates',
    domains: [
      'amazon.com', 'amzn.to', 'amzn.com', 'amazon.co.uk', 'amazon.ca',
      'amazon.de', 'amazon.fr', 'amazon.es', 'amazon.it', 'amazon.co.jp',
      'amazon.in', 'amazon.com.au', 'amazon.com.br', 'amazon.com.mx',
      'amazon.ae', 'amazon.sg', 'amazon.sa', 'amazon.nl', 'amazon.se',
      'amazon.pl', 'amazon.be', 'amazon.eg', 'amazon.tr',
      'a.co', 'amzn.asia',
    ],
    patterns: [
      // VERY specific to Amazon Associates: tag= followed by an actual associate ID pattern
      /[?&]tag=[a-zA-Z0-9_-]+-\d{1,3}\b/i,
      // linkCode= + linkId= combo is Amazon-specific
      /[?&]linkCode=[a-zA-Z0-9_-]+/i,
      /[?&]linkId=[a-zA-Z0-9]+/i,
      /[?&]creativeASIN=[A-Z0-9]{10}/i,
      /[?&]ascsubtag=/i,
      // ASIN path patterns (Amazon specific)
      /\/dp\/[A-Z0-9]{10}\b/i,
      /\/gp\/product\/[A-Z0-9]{10}/i,
      /\/exec\/obidos\//i,
      /\/gp\/aw\/d\/[A-Z0-9]{10}/i,
      // amzn.to short link
      /^https?:\/\/amzn\.to\//i,
      /^https?:\/\/a\.co\//i,
    ],
    category: 'Retail / Marketplace',
    disclosureHints: [
      'amazon associate', 'amazon services llc associates program',
      'amazon.com affiliate', 'as an amazon associate',
      'amazon associate i earn', 'amzn.to', 'amazon partner',
    ],
  },
  {
    name: 'Impact Radius',
    domains: [
      'impact.com', 'impactradius.com', 'imp.af',
    ],
    patterns: [
      // Impact-specific subId params (always paired with impact.com)
      /[?&]subId1=[a-zA-Z0-9_-]+/i,
      /[?&]irclickid=[a-zA-Z0-9_-]+/i,
      /[?&]irgwc=[a-zA-Z0-9_-]+/i,
      /impact\.com\/go\//i,
    ],
    category: 'Affiliate Network',
    disclosureHints: ['impact radius', 'impact.com affiliate', 'impact affiliate'],
  },
  {
    name: 'ShareASale',
    domains: ['shareasale.com', 'shareasale-analytics.com', 'shrsl.com'],
    patterns: [
      // ShareASale-specific: afftrack= + sscid= (SSC ID is shareasale-specific)
      /[?&]afftrack=[a-zA-Z0-9_-]+/i,
      /[?&]sscid=[a-zA-Z0-9_-]+/i,
      // ShareASale URL patterns (very specific)
      /shareasale\.com\/r\.cfm/i,
      /shareasale\.com\/m-pr/i,
      /shareasale\.com\/sale-process/i,
      /^https?:\/\/shrsl\.com\//i,
    ],
    category: 'Affiliate Network',
    disclosureHints: ['shareasale', 'share a sale', 'share-a-sale'],
  },
  {
    name: 'CJ Affiliate (Commission Junction)',
    domains: [
      // CJ-specific tracking domains only — these are very specific
      'qksrv.net', 'kqzyfj.com', 'tkqlhao.com', 'qksz.net',
      'tqlkg.com', 'dxklopm.com', 'anrdoezrs.net', 'emjcd.com',
      'jdoqocy.com', 'afcyhb.com', 'apmebf.com', 'ftjcfx.com',
      'kcdhlny.com', 'lduhtrp.net', 'pjnet.xyz',
      'click.linksynergy.com', 'linksynergy.com',
      'roverlinks.com',
    ],
    patterns: [
      // CJ-specific URL params (URL= + CMP= + LP= combo is CJ-specific)
      /[?&]url=.{20,}/i,  // URL= with a longer value (avoid short share URLs)
      /linksynergy\.com\/fs-bin\/static/i,
      // CJ tracking domain with click redirect
      /\.(qksrv|kqzyfj|tkqlhao|jdoqocy|anrdoezrs|emjcd|afcyhb|apmebf|ftjcfx|kcdhlny|lduhtrp|pjnet|tqlkg|dxklopm|qksz)\.net\//i,
    ],
    category: 'Affiliate Network',
    disclosureHints: ['commission junction', 'cj affiliate', 'linksynergy', 'cj.com'],
  },
  {
    name: 'Rakuten Advertising (LinkShare)',
    domains: [
      'rakutenadvertising.com', 'click.linksynergy.com',
      'rakutenmarketing.com',
    ],
    category: 'Affiliate Network',
    disclosureHints: ['rakuten', 'rakuten advertising', 'rakuten marketing', 'linkshare'],
  },
  {
    name: 'Awin',
    domains: ['awin1.com', 'awin.com', 'zenaps.com'],
    patterns: [
      // Awin-specific: clickref=, awinaffid=, awinmid=, pled=
      /[?&]clickref=[a-zA-Z0-9_-]+/i,
      /[?&]awinaffid=\d+/i,
      /[?&]awinmid=\d+/i,
      /[?&]pled=\d+/i,
      /awin1\.com\/cread\.php/i,
      /awin1\.com\/sread\.php/i,
    ],
    category: 'Affiliate Network',
    disclosureHints: ['awin', 'awin affiliate', 'awin1'],
  },
  {
    name: 'Skimlinks',
    domains: [
      'go.skimresources.com', 'skimresources.com', 'skimlinks.com',
      'go.redirectingat.com',
    ],
    patterns: [
      // Skimlinks-specific: only count if it's a skim resource domain
      /go\.skimresources\.com\//i,
      /go\.redirectingat\.com\//i,
      /skimlinks\.com\//i,
    ],
    category: 'Affiliate Network',
    disclosureHints: ['skimlinks', 'skimlinks affiliate', 'skim resources'],
  },
  {
    name: 'ClickBank',
    domains: ['clickbank.net', 'hop.clickbank.net', 'hoplinks.com'],
    patterns: [
      // ClickBank hop= param is very specific
      /[?&]hop=[a-zA-Z0-9_-]+/i,
      /hop\.clickbank\.net/i,
      /\.clickbank\.net\//i,
    ],
    category: 'Affiliate Network',
    disclosureHints: ['clickbank', 'click bank'],
  },
  {
    name: 'AvantLink',
    domains: ['avantlink.com', 'avlnk.net'],
    patterns: [
      // AvantLink-specific: ctc= + pri= + af= (with avantlink domain)
      /[?&]ctc=[a-zA-Z0-9_-]+/i,
      /[?&]pri=\d+/i,
      /[?&]ct=[a-zA-Z0-9_-]+/i,
      /avlnk\.net\//i,
      /avantlink\.com\/click\.phtml/i,
    ],
    category: 'Affiliate Network',
    disclosureHints: ['avantlink', 'avant link'],
  },
  {
    name: 'PartnerStack',
    domains: ['partnerstack.com', 'psell.co'],
    patterns: [
      // PartnerStack-specific: psid= + pgi=
      /[?&]psid=[a-zA-Z0-9_-]+/i,
      /[?&]pgi=[a-zA-Z0-9_-]+/i,
      /partnerstack\.com\/p\//i,
    ],
    category: 'Affiliate Network',
    disclosureHints: ['partnerstack', 'partner stack'],
  },
  {
    name: 'Refersion',
    domains: ['refersion.com', 'rfer.us'],
    patterns: [
      // Refersion-specific: afref=
      /[?&]afref=[a-zA-Z0-9_-]+/i,
      /^https?:\/\/rfer\.us\//i,
    ],
    category: 'Affiliate Network',
    disclosureHints: ['refersion'],
  },
  {
    name: 'Post Affiliate Pro',
    domains: ['qualityunit.com', 'postaffiliatepro.com'],
    patterns: [
      // Post Affiliate Pro: a_aid= + a_bid= + a_cid= combo
      /[?&]a_aid=[a-zA-Z0-9_-]+/i,
      /[?&]a_bid=[a-zA-Z0-9_-]+/i,
      /[?&]a_cid=[a-zA-Z0-9_-]+/i,
      /postaffiliatepro\.com\/scripts\//i,
    ],
    category: 'Affiliate Software',
    disclosureHints: ['post affiliate pro', 'qualityunit'],
  },
  {
    name: 'Tapfiliate',
    domains: ['tapfiliate.com'],
    patterns: [
      // Tapfiliate-specific URL pattern
      /tapfiliate\.com\/l\//i,
    ],
    category: 'Affiliate Software',
    disclosureHints: ['tapfiliate'],
  },
  {
    name: 'HasOffers / Tune',
    domains: ['hasoffers.com', 'tune.com', 'go2cloud.org', 'go2app.com'],
    patterns: [
      // HasOffers/Tune-specific: transaction_id= + offer_id= combo
      /[?&]transaction_id=[a-zA-Z0-9_-]+/i,
      /[?&]offer_id=\d+/i,
      /go2cloud\.org\/aff_c/i,
    ],
    category: 'Affiliate Network',
    disclosureHints: ['hasoffers', 'tune.com affiliate', 'tune network'],
  },
  {
    name: 'TradeDoubler',
    domains: ['tradedoubler.com', 'clmbtrk.com', 'tddltrk.com'],
    patterns: [
      // TradeDoubler-specific: epi= + p= combo (with tradedoubler domain)
      /[?&]epi=[a-zA-Z0-9_-]+/i,
      /tradedoubler\.com\/click/i,
    ],
    category: 'Affiliate Network',
    disclosureHints: ['tradedoubler'],
  },
  {
    name: 'Webgains',
    domains: ['webgains.com', 'wg-aff.com'],
    patterns: [
      // Webgains-specific: wgref= + cs= combo
      /[?&]wgref=[a-zA-Z0-9_-]+/i,
      /wg-aff\.com\/click\.php/i,
    ],
    category: 'Affiliate Network',
    disclosureHints: ['webgains'],
  },
  {
    name: 'eBay Partner Network',
    domains: [
      'rover.ebay.com', 'partners.ebay.com', 'epn.ebay.com',
      'epnt.ebay.com',
    ],
    patterns: [
      // eBay-specific: campid= + customid= + toolid= combo (very specific)
      /[?&]campid=\d{5,}/i,
      /[?&]customid=[a-zA-Z0-9_-]+/i,
      /[?&]toolid=\d+/i,
      /rover\.ebay\.com\/rover\//i,
    ],
    category: 'Marketplace Affiliate',
    disclosureHints: ['ebay partner network', 'epn', 'ebay affiliate', 'ebay partner'],
  },
  {
    name: 'Walmart Affiliate Program',
    domains: ['affiliates.walmart.com', 'walmart.com/go', 'affil.walmart.com'],
    patterns: [
      // Walmart-specific: affil= + wl1= combo
      /[?&]affil=[a-zA-Z0-9_-]+/i,
      /[?&]wl1=[a-zA-Z0-9_-]+/i,
      /walmart\.com\/go\/aff/i,
    ],
    category: 'Retail Affiliate',
    disclosureHints: ['walmart affiliate', 'walmart.com affiliate'],
  },
  {
    name: 'Booking.com Affiliate',
    domains: ['booking.com'],
    patterns: [
      // Booking.com: aid= with 5+ digit number (very specific)
      /[?&]aid=\d{5,}/i,
      /[?&]label=[a-zA-Z0-9_-]+/i,
    ],
    category: 'Travel Affiliate',
    disclosureHints: ['booking.com affiliate', 'booking affiliate partner'],
  },
  {
    name: 'ShopStyle',
    domains: ['shopstyle.com', 'shopstyle.it', 'shopstyle.co.uk'],
    patterns: [
      // ShopStyle-specific: pid= + bid= combo (with shopstyle domain)
      /shopstyle\.com\/action\//i,
    ],
    category: 'Affiliate Network',
    disclosureHints: ['shopstyle'],
  },
  {
    name: 'RewardStyle / LTK',
    domains: ['rewardstyle.com', 'ltkapp.com', 'rstyle.me', 'liketk.it'],
    patterns: [
      // RewardStyle-specific URL patterns
      /^https?:\/\/rstyle\.me\//i,
      /^https?:\/\/liketk\.it\//i,
      /rewardstyle\.com\//i,
    ],
    category: 'Affiliate Network',
    disclosureHints: ['rewardstyle', 'ltk', 'liketk.it', 'like to know it'],
  },
  {
    name: 'VigLink / Sovrn Commerce',
    domains: ['redirect.viglink.com', 'viglink.com'],
    patterns: [
      // VigLink-specific URL pattern (redirect.viglink.com?...)
      /redirect\.viglink\.com\?/i,
      /[?&]libid=[a-zA-Z0-9_-]+/i,
    ],
    category: 'Affiliate Network',
    disclosureHints: ['viglink', 'sovrn', 'sovrn commerce'],
  },
  {
    name: 'Etsy Affiliate',
    domains: ['etsy.com'],
    patterns: [
      // Etsy-specific: aff= with specific patterns
      /[?&]aff=awsmerch/i,
    ],
    category: 'Marketplace Affiliate',
    disclosureHints: ['etsy affiliate', 'etsy associates'],
  },
  {
    name: 'AliExpress Affiliate',
    domains: ['s.click.aliexpress.com', 'portals.aliexpress.com'],
    patterns: [
      // AliExpress affiliate-specific params
      /[?&]aff_fcid=[a-zA-Z0-9_-]+/i,
      /[?&]aff_click_id=[a-zA-Z0-9_-]+/i,
      /[?&]dl_id=[a-zA-Z0-9_-]+/i,
      /^https?:\/\/s\.click\.aliexpress\.com\//i,
    ],
    category: 'Marketplace Affiliate',
    disclosureHints: ['aliexpress affiliate', 'portals affiliate program', 'aliexpress portais'],
  },
  {
    name: 'Target Partners',
    domains: ['partners.target.com', 'target.com'],
    patterns: [
      // Target-specific: cpng= + ref= combo on target.com
      /[?&]cpng=[a-zA-Z0-9_-]+/i,
      /partners\.target\.com\//i,
    ],
    category: 'Retail Affiliate',
    disclosureHints: ['target partners', 'target affiliate', 'target.com affiliate'],
  },
  {
    name: 'ConvertKit Affiliate',
    domains: ['convertkit.com', 'ck-maker.ck.page'],
    patterns: [
      /[?&]am_id=[a-zA-Z0-9_-]+/i,
      /convertkit\.com\/referr?/i,
    ],
    category: 'SaaS Affiliate',
    disclosureHints: ['convertkit affiliate'],
  },
  {
    name: 'Shopify Affiliate',
    domains: ['partners.shopify.com'],
    patterns: [
      /partners\.shopify\.com\//i,
    ],
    category: 'SaaS Affiliate',
    disclosureHints: ['shopify affiliate', 'shopify partners'],
  },
  {
    name: 'WP Engine Affiliate',
    domains: ['wpengine.com', 'share-wpengine.com'],
    patterns: [
      /share-wpengine\.com\//i,
    ],
    category: 'SaaS Affiliate',
    disclosureHints: ['wp engine affiliate', 'wpengine affiliate'],
  },
  {
    name: 'Kinsta Affiliate',
    domains: ['kinsta.com', 'ref.kinsta.com'],
    patterns: [
      /[?&]kaid=[a-zA-Z0-9_-]+/i,
      /ref\.kinsta\.com\//i,
    ],
    category: 'SaaS Affiliate',
    disclosureHints: ['kinsta affiliate'],
  },
  {
    name: 'Bluehost Affiliate',
    domains: ['bluehost.com', 'bluehosttrack.com'],
    patterns: [
      /bluehosttrack\.com\//i,
    ],
    category: 'Web Hosting Affiliate',
    disclosureHints: ['bluehost affiliate'],
  },
  {
    name: 'SiteGround Affiliate',
    domains: ['siteground.com', 'affiliates.siteground.com'],
    patterns: [
      /affiliates\.siteground\.com\//i,
    ],
    category: 'Web Hosting Affiliate',
    disclosureHints: ['siteground affiliate'],
  },
  {
    name: 'Liquid Web Affiliate',
    domains: ['liquidweb.com', 'affiliates.liquidweb.com'],
    patterns: [
      /affiliates\.liquidweb\.com\//i,
    ],
    category: 'Web Hosting Affiliate',
    disclosureHints: ['liquid web affiliate'],
  },
  {
    name: 'HostGator Affiliate',
    domains: ['hostgator.com', 'affiliates.hostgator.com'],
    patterns: [
      /hostgator\.com\/affiliate/i,
    ],
    category: 'Web Hosting Affiliate',
    disclosureHints: ['hostgator affiliate'],
  },
  {
    name: 'Coursera Affiliate',
    domains: ['coursera.org', 'affiliate.coursera.org'],
    patterns: [
      /[?&]affiliateID=[a-zA-Z0-9_-]+/i,
      /coursera\.org\/promote/i,
    ],
    category: 'Education Affiliate',
    disclosureHints: ['coursera affiliate'],
  },
  {
    name: 'Udemy Affiliate',
    domains: ['udemy.com', 'affiliates.udemy.com'],
    patterns: [
      /[?&]affCode=[a-zA-Z0-9_-]+/i,
      /udemy\.com\/affiliate/i,
    ],
    category: 'Education Affiliate',
    disclosureHints: ['udemy affiliate'],
  },
  {
    name: 'Skillshare Affiliate',
    domains: ['skillshare.com'],
    patterns: [
      /skillshare\.com\/r\//i,
    ],
    category: 'Education Affiliate',
    disclosureHints: ['skillshare affiliate'],
  },
  {
    name: 'Teachable Affiliate',
    domains: ['teachable.com'],
    patterns: [
      /teachable\.com\/affiliate/i,
    ],
    category: 'Education Affiliate',
    disclosureHints: ['teachable affiliate'],
  },
  {
    name: 'Thinkific Affiliate',
    domains: ['thinkific.com'],
    patterns: [
      /thinkific\.com\/affiliate/i,
    ],
    category: 'Education Affiliate',
    disclosureHints: ['thinkific affiliate'],
  },
  {
    name: 'Patreon Affiliate',
    domains: ['patreon.com'],
    patterns: [
      /patreon\.com\/affiliate/i,
    ],
    category: 'Creator Affiliate',
    disclosureHints: ['patreon affiliate'],
  },
  {
    name: 'Adobe Affiliate',
    domains: ['partners.adobe.com'],
    patterns: [
      /[?&]promoid=[a-zA-Z0-9_-]+/i,
      /partners\.adobe\.com\//i,
    ],
    category: 'Software Affiliate',
    disclosureHints: ['adobe affiliate', 'adobe partners'],
  },
  {
    name: 'ClickFunnels Affiliate',
    domains: ['clickfunnels.com'],
    patterns: [
      /clickfunnels\.com\/affiliate/i,
    ],
    category: 'SaaS Affiliate',
    disclosureHints: ['clickfunnels affiliate'],
  },
  {
    name: 'Namecheap Affiliate',
    domains: ['namecheap.com'],
    patterns: [
      /namecheap\.com\/affiliate/i,
    ],
    category: 'Domain Affiliate',
    disclosureHints: ['namecheap affiliate'],
  },
  {
    name: 'Best Buy Affiliate',
    domains: ['affiliates.bestbuy.com', 'bestbuy.com'],
    patterns: [
      /bestbuy\.com\/affiliate/i,
      /affiliates\.bestbuy\.com\//i,
    ],
    category: 'Retail Affiliate',
    disclosureHints: ['best buy affiliate'],
  },
]

// ----- Ad networks -----
// IMPORTANT: Use very specific patterns. For Google AdSense, require the actual
// AdSense script (adsbygoogle.js) or google_ad_client variable. Do NOT match
// googlesyndication.com alone because Mediavine, AdThrive, Raptive etc. all use
// Google Ad Manager (DFP) which serves through the same domain.
const AD_NETWORKS: { name: string; domain: string; type: string; patterns?: RegExp[] }[] = [
  {
    name: 'Google AdSense',
    domain: 'google.com/adsense',
    type: 'Display Ads',
    patterns: [
      // AdSense-specific: adsbygoogle.js script + google_ad_client variable
      /adsbygoogle\.js/i,
      /google_ad_client\s*=\s*["']ca-pub-\d{16,}["']/i,
      /pagead2\.googlesyndication\.com\/pagead\/js\/adsbygoogle\.js/i,
      /ca-pub-\d{16,}/i,
    ],
  },
  {
    name: 'Media.net',
    domain: 'media.net',
    type: 'Display Ads',
    patterns: [/media\.net\/mediakit/i, /media\.net\/ads\/v/i, /contextual\.media\.net/i],
  },
  {
    name: 'Amazon Associates (Display)',
    domain: 'amazon-adsystem.com',
    type: 'Native Ads',
    patterns: [/aax-us-east\.amazon-adsystem\.com/i, /aax-eu\.amazon-adsystem\.com/i, /amazon-adsystem\.com\/x\/c/i],
  },
  {
    name: 'AdThrive',
    domain: 'adthrive.com',
    type: 'Display Ads',
    patterns: [/adthrive\.com/i, /ads\.adthrive\.com/i, /adthrive\.com\/ads/i],
  },
  {
    name: 'Mediavine',
    domain: 'mediavine.com',
    type: 'Display Ads',
    patterns: [/scripts\.mediavine\.com/i, /mediavine\.com\/trends/i, /mediavine\.com\/ads/i],
  },
  {
    name: 'Raptive',
    domain: 'raptive.com',
    type: 'Display Ads',
    patterns: [/raptive\.com\/ad/i, /raptive-ad/i],
  },
  {
    name: 'Ezoic',
    domain: 'ezoic.com',
    type: 'Display Ads',
    patterns: [/ezoic\.com\/pub/i, /ezojs\.com/i, /g\.ezoic\.net/i],
  },
  {
    name: 'Taboola',
    domain: 'taboola.com',
    type: 'Native Ads',
    patterns: [/cdn\.taboola\.com/i, /libtrc\.com/i, /taboola\.com\/libtrc/i],
  },
  {
    name: 'Outbrain',
    domain: 'outbrain.com',
    type: 'Native Ads',
    patterns: [/widgets\.outbrain\.com/i, /outbrain\.com\/norm/i],
  },
  {
    name: 'Sovrn (Ads)',
    domain: 'sovrn.com',
    type: 'Display Ads',
    patterns: [/sovrn\.com\/ads/i, /sovrn\.com\/bdc/i, /lixil\.com/i],
  },
  {
    name: 'Carbon Ads',
    domain: 'carbonads.com',
    type: 'Developer Ads',
    patterns: [/carbonads\.com/i, /srv\.carbonads\.net/i],
  },
  {
    name: 'BuySellAds',
    domain: 'buysellads.com',
    type: 'Marketplace Ads',
    patterns: [/buysellads\.com/i, /bsads\.com/i],
  },
  {
    name: 'Infolinks',
    domain: 'infolinks.com',
    type: 'Inline Ads',
    patterns: [/infolinks\.com\/ps/i, /infolinks\.com\/js\/i/i],
  },
  {
    name: 'Adsterra',
    domain: 'adsterra.com',
    type: 'Display Ads',
    patterns: [/adsterra\.com\/media/i, /pl\d+\.adsterra\.com/i],
  },
  {
    name: 'PropellerAds',
    domain: 'propellerads.com',
    type: 'Display Ads',
    patterns: [/propellerads\.com\/media/i, /propellerads\.net\/media/i],
  },
]

// Affiliate indicator attributes (in <a> tags)
const AFFILIATE_DATA_ATTRS = [
  'data-affiliate', 'data-affiliate-link', 'data-affiliate-network',
  'data-affiliate-id', 'data-aff', 'data-af', 'data-affiliate-tag',
  'data-partner', 'data-sponsor', 'data-sponsored',
  'data-click-id', 'data-Referral', 'data-referral',
]

// Affiliate redirect subdomains (very strong signal)
// NOTE: must be paired with the link going to a DIFFERENT domain than the source
const AFFILIATE_SUBDOMAIN_PREFIXES = [
  'go.', 'redirect.', 'track.', 'hop.', 'out.', 'aff.', 'jump.',
  'click.', 'refer.', 'r.', 'link.', 'links.', 'deals.',
  'visit.', 'partner.', 'partners.', 'promo.', 'sponsor.', 'sponsored.',
  'buys.', 'buy.', 'shop.', 'join.', 'get.', 'try.', 'review.',
]

// Removed the very generic params from this list. We now require a network-specific
// pattern to match. Generic 'ref=' or 'aff=' alone are NOT enough anymore because
// many non-affiliate URLs (UTM tags, internal tracking) use them too.
const GENERIC_AFFILIATE_PARAMS: string[] = [
  // Very specific affiliate param names (not used by social media or normal analytics)
  'afftrack', 'awinaffid', 'awinmid', 'clickref',
  'irclickid', 'irgwc', 'irpid', 'irmpid', 'ircid', 'ircampid',
  'sscid', 'afref', 'kaid', 'ascsubtag',
  'aff_fcid', 'aff_click_id', 'dl_id',
  'transaction_id', 'offer_id', 'aff_sub', 'aff_sub2', 'aff_sub3',
  'clickref1', 'clickref2', 'clickref3',
  'sub_id1', 'sub_id2', 'sub_id3', 'subid1', 'subid2', 'subid3',
  'psid', 'pgi', 'am_id', 'a_aid', 'a_bid', 'a_cid',
]

const DISCLOSURE_KEYWORDS = [
  'affiliate link', 'affiliate links', 'affiliate disclosure',
  'affiliate marketing', 'we may earn', 'we earn', 'i earn a commission',
  'i may earn a commission', 'commission if you', 'commission on qualifying',
  'as an amazon associate', 'associate i earn', 'at no extra cost to you',
  'at no additional cost to you', 'paid commission',
  'this post contains affiliate', 'this page contains affiliate',
  'may contain affiliate', 'compensated for referring',
  'federal trade commission', 'advertising fees',
  'advertising and linking', 'please note that this post contains affiliate',
  'sponsored content', 'sponsored post', 'sponsored by',
  'this article contains affiliate links',
  'if you click on a link and make a purchase',
  'we may receive a commission',
  'affiliate partner', 'affiliate program',
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

const baseUrlHolder: { url: string } = { url: '' }

interface ExtractedLink {
  href: string
  text: string
  rel: string
  attrs: string
}

function extractLinks(html: string, baseUrl: URL): ExtractedLink[] {
  const links: ExtractedLink[] = []
  const aTagRegex = /<a\b([^>]*?)href\s*=\s*["']([^"']+)["']([^>]*?)>([\s\S]*?)<\/a>/gi
  let m: RegExpExecArray | null
  while ((m = aTagRegex.exec(html)) !== null) {
    const beforeHref = m[1] || ''
    const rawHref = m[2]
    const afterHref = m[3] || ''
    const fullAttrs = beforeHref + afterHref
    const text = decodeHtmlEntities(m[4].replace(/<[^>]+>/g, '').trim())

    const relMatch = fullAttrs.match(/rel\s*=\s*["']([^"']+)["']/i)
    const rel = relMatch ? relMatch[1].toLowerCase() : ''

    try {
      const resolved = new URL(rawHref, baseUrl).toString()
      if (resolved.startsWith('http://') || resolved.startsWith('https://')) {
        links.push({ href: resolved, text, rel, attrs: fullAttrs })
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

function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

function findDisclosure(html: string): Disclosure {
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

function hasAffiliateDataAttr(attrs: string): string | null {
  for (const attr of AFFILIATE_DATA_ATTRS) {
    const regex = new RegExp(`${attr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*=\\s*["']([^"']+)["']`, 'i')
    const match = attrs.match(regex)
    if (match) return match[1]
  }
  return null
}

function isAffiliateSubdomain(href: string, sourceHost: string): boolean {
  const u = safeParseUrl(href)
  if (!u) return false
  const host = u.hostname.toLowerCase()
  // The link must go to a DIFFERENT host than the source (otherwise it's an internal navigation)
  if (host === sourceHost || host.endsWith('.' + sourceHost)) return false
  // The host must start with one of the affiliate subdomain prefixes
  return AFFILIATE_SUBDOMAIN_PREFIXES.some((p) => host.startsWith(p))
}

// ----- Main POST handler -----
export async function POST(req: NextRequest) {
  // === RATE LIMIT CHECK ===
  // 1) Identify user (logged in via Supabase JWT, or anonymous via hashed IP)
  const userId = await getUserFromRequest(req)
  const rawIp =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'
  const ipHash = await hashIp(rawIp)

  // 2) Determine tier
  let tier: Tier = TIERS.ANON
  if (userId) {
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('tier')
      .eq('id', userId)
      .maybeSingle()
    if (profile?.tier === 'pro') tier = TIERS.PRO
    else if (profile?.tier === 'free') tier = TIERS.FREE
    else tier = TIERS.FREE  // default for any logged-in user
  }

  // 3) Count today's usage
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  let usedToday = 0
  if (userId) {
    const { count } = await supabaseAdmin
      .from('usage_tracking')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', todayStart.toISOString())
    usedToday = count ?? 0
  } else {
    const { count } = await supabaseAdmin
      .from('usage_tracking')
      .select('*', { count: 'exact', head: true })
      .eq('ip_hash', ipHash)
      .gte('created_at', todayStart.toISOString())
    usedToday = count ?? 0
  }

  // 4) Enforce limit (Pro = unlimited)
  const limit = LIMITS[tier]
  if (tier !== TIERS.PRO && usedToday >= limit) {
    return NextResponse.json(
      {
        rateLimited: true,
        tier,
        usedToday,
        limit,
        remaining: 0,
        upgradeUrl: process.env.NEXT_PUBLIC_SITE_URL + '/#upgrade',
        message:
          tier === TIERS.ANON
            ? `You've used your 1 free check today. Sign up to get 3 free checks per day, or go Pro for unlimited.`
            : `You've used all ${limit} free checks today. Go Pro for $9 lifetime to keep checking.`,
      },
      { status: 429 }
    )
  }

  // 5) Parse request body and run the check
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
  const sourceHost = targetUrl.hostname.toLowerCase()

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
    sponsoredLinksCount: 0,
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
    const timeout = setTimeout(() => controller.abort(), 15000)

    const res = await fetch(normalized, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
        Pragma: 'no-cache',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1',
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

    // Extract links (now with rel and attrs)
    const links = extractLinks(html, finalUrl)
    result.stats.totalLinks = links.length

    const finalOrigin = finalUrl.origin.toLowerCase()
    const targetOrigin = targetUrl.origin.toLowerCase()
    const externalLinks = links.filter(
      (l) =>
        !l.href.toLowerCase().startsWith(finalOrigin) &&
        !l.href.toLowerCase().startsWith(targetOrigin)
    )
    result.stats.externalLinks = externalLinks.length

    // Affiliate link & network detection
    const detectedNetworks = new Map<string, AffiliateNetwork>()
    const detectedAdNetworks = new Map<string, AdNetwork>()
    const detectedAffiliateLinks: AffiliateLink[] = []
    const linkSeen = new Set<string>()
    let sponsoredLinksCount = 0

    // Count rel="sponsored" links first (strong affiliate signal)
    for (const link of links) {
      if (link.rel && (link.rel.includes('sponsored') || link.rel.includes('affiliated'))) {
        sponsoredLinksCount++
      }
    }
    result.sponsoredLinksCount = sponsoredLinksCount

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

    // Smart exclusion: if Mediavine OR AdThrive OR Raptive is detected, Google AdSense
    // is most likely a FALSE POSITIVE (these networks use Google Ad Manager / DFP, not
    // AdSense, but the same googlesyndication.com domain is used). Remove AdSense from
    // the detected list to avoid confusion.
    const hasPremiumAdNetwork =
      detectedAdNetworks.has('Mediavine') ||
      detectedAdNetworks.has('AdThrive') ||
      detectedAdNetworks.has('Raptive')
    if (hasPremiumAdNetwork && detectedAdNetworks.has('Google AdSense')) {
      // Only remove AdSense if the ONLY evidence is googlesyndication.com (not
      // an actual adsbygoogle.js script). To detect that, we re-test with the
      // strict pattern: adsbygoogle.js or ca-pub- ID.
      const strictAdSense =
        /adsbygoogle\.js/i.test(html) ||
        /ca-pub-\d{16,}/i.test(html) ||
        /google_ad_client\s*=\s*["']ca-pub-/i.test(html)
      if (!strictAdSense) {
        detectedAdNetworks.delete('Google AdSense')
      }
    }

    // Main affiliate link detection
    for (const link of links) {
      const hrefLower = link.href.toLowerCase()
      const urlObj = safeParseUrl(link.href)
      let matchedNetwork: string | null = null
      let reason = ''

      // SKIP: non-affiliate domains (social media, search engines, mailto:, etc.)
      // These should NEVER be flagged as affiliate networks. This was the cause
      // of the false positives where Facebook and LinkedIn share URLs were being
      // flagged as CJ Affiliate / ShareASale links.
      if (isNonAffiliateDomain(link.href)) {
        // Still check rel="sponsored" — even social links can be sponsored
        if (link.rel && link.rel.includes('sponsored')) {
          const key = link.href + '|Rel=Sponsored Link'
          if (!linkSeen.has(key)) {
            linkSeen.add(key)
            detectedAffiliateLinks.push({
              url: link.href,
              network: 'Rel=Sponsored Link',
              text: link.text || '(no anchor text)',
              rel: link.rel,
              reason: 'Link marked with rel="sponsored"',
            })
          }
        }
        continue
      }

      // 1) rel="sponsored" or rel="affiliated" = strong signal
      if (link.rel && (link.rel.includes('sponsored') || link.rel.includes('affiliated'))) {
        matchedNetwork = 'Rel=Sponsored Link'
        reason = 'Link marked with rel="sponsored" (Google affiliate signal)'
      }

      // 2) Affiliate data-attribute
      if (!matchedNetwork) {
        const dataAttr = hasAffiliateDataAttr(link.attrs)
        if (dataAttr) {
          matchedNetwork = 'Data-Affiliate Link'
          reason = `data-affiliate attribute found: ${dataAttr}`
        }
      }

      // 3) Domain match against known affiliate networks
      if (!matchedNetwork) {
        for (const net of AFFILIATE_NETWORKS) {
          if (net.domains.some((d) => hrefLower.includes(d.toLowerCase()))) {
            matchedNetwork = net.name
            reason = 'Domain matches known affiliate network'
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
      }

      // 4) Pattern match (URL parameters / path patterns)
      // NOTE: Patterns are now very strict and network-specific.
      if (!matchedNetwork) {
        for (const net of AFFILIATE_NETWORKS) {
          if (net.patterns && net.patterns.some((p) => p.test(link.href))) {
            matchedNetwork = net.name
            reason = 'URL pattern matches known affiliate network'
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

      // 5) Affiliate subdomain (go., redirect., track., etc.) on a different host
      if (!matchedNetwork && isAffiliateSubdomain(link.href, sourceHost)) {
        const u = safeParseUrl(link.href)
        if (u && u.hostname !== finalUrl.hostname) {
          matchedNetwork = 'Affiliate Redirect Subdomain'
          reason = `Link goes to ${u.hostname} (affiliated redirect subdomain)`
        }
      }

      // 6) Generic affiliate query parameters (very strict list)
      if (!matchedNetwork && urlObj) {
        const params = urlObj.searchParams
        const matchedParam = GENERIC_AFFILIATE_PARAMS.find((p) => params.has(p))
        if (matchedParam) {
          matchedNetwork = 'Generic Affiliate Link'
          reason = `URL contains affiliate tracking param: ${matchedParam}=`
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
            rel: link.rel || undefined,
            reason,
          })
        }
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
      disclosure.found ||
      sponsoredLinksCount > 0
    result.fetchMs = Date.now() - startedAt

    // === RECORD USAGE ===
    // Insert the usage record. We await this so the insert finishes before
    // the route returns (otherwise the lambda might be torn down first).
    try {
      const insertRes = await supabaseAdmin
        .from('usage_tracking')
        .insert({
          user_id: userId,
          ip_hash: userId ? null : ipHash,
          url_checked: rawUrl.trim(),
        })
      if (insertRes.error) {
        console.error('[usage_tracking] insert failed:', insertRes.error.message)
      }
    } catch {
      // silent fail — we don't want to break the user's check over a usage row
    }

    // Compute new usage state for the client to display
    const newUsedToday = usedToday + 1
    const remaining = tier === TIERS.PRO ? Infinity : Math.max(0, limit - newUsedToday)
    const usageState = {
      tier,
      usedToday: newUsedToday,
      limit,
      remaining: tier === TIERS.PRO ? Infinity : remaining,
      bulkLimit: tier === TIERS.PRO ? 50 : 0,
      canCheck: tier === TIERS.PRO || remaining > 0,
      canUseBulk: tier === TIERS.PRO,
    }

    return NextResponse.json({ ...result, usage: usageState })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown fetch error'
    result.error = message.includes('aborted')
      ? 'Request timed out (server took too long to respond).'
      : `Fetch failed: ${message}`
    result.fetchMs = Date.now() - startedAt
    return NextResponse.json(result, { status: 200 })
  }
}
