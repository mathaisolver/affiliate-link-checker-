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

// ----- Affiliate network signatures -----
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
      'www.amazon.com', 'a.co', 'amzn.asia',
    ],
    patterns: [
      /[?&]tag=[a-zA-Z0-9_-]+/i,
      /[?&]linkCode=/i,
      /[?&]linkId=/i,
      /[?&]creativeASIN=/i,
      /[?&]ascsubtag=/i,
      /[?&]camp=/i,
      /[?&]creative=/i,
      /\/dp\/[A-Z0-9]{10}/i,
      /\/gp\/product\//i,
      /\/exec\/obidos\//i,
      /\/gp\/aw\/d\//i,
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
      'impact.com', 'impactradius.com', 'imp.af', 'go.imp',
      'impact.com/go', 'sub impacts', 'sub.id.impact',
    ],
    patterns: [
      /[?&]subId1=/i, /[?&]subId2=/i, /[?&]subId3=/i,
      /[?&]irclickid=/i, /[?&]irgwc=/i,
      /impact\.com\/go\//i,
    ],
    category: 'Affiliate Network',
    disclosureHints: ['impact radius', 'impact.com affiliate', 'impact affiliate'],
  },
  {
    name: 'ShareASale',
    domains: ['shareasale.com', 'shareasale-analytics.com', 'shareasale-affiliate', 'shrsl.com'],
    patterns: [
      /[?&]afftrack=/i, /[?&]sscid=/i, /[?&]u=/i, /[?&]affID=/i,
      /shareasale\.com\/r\.cfm/i, /shareasale\.com\/m-pr/i, /shrsl\.com\//i,
    ],
    category: 'Affiliate Network',
    disclosureHints: ['shareasale', 'share a sale', 'share-a-sale'],
  },
  {
    name: 'CJ Affiliate (Commission Junction)',
    domains: [
      'cj.com', 'qksrv.net', 'kqzyfj.com', 'tkqlhao.com', 'qksz.net',
      'tqlkg.com', 'dxklopm.com', 'anrdoezrs.net', 'emjcd.com',
      'jdoqocy.com', 'afcyhb.com', 'apmebf.com', 'ftjcfx.com',
      'kcdhlny.com', 'lduhtrp.net', 'pjnet.xyz', 'linksynergy.com',
      'click.linksynergy.com', 'roverlinks.com', 'nativelinkmonetization.com',
    ],
    patterns: [
      /[?&]cmp=/i, /[?&]lp=/i, /[?&]url=/i,
      /[?&]pub=/i, /[?&]websiteid=/i, /[?&]publisher=/i,
      /linksynergy\.com\/fs-bin\/static/i, / commission junction /i,
    ],
    category: 'Affiliate Network',
    disclosureHints: ['commission junction', 'cj affiliate', 'linksynergy', 'cj.com'],
  },
  {
    name: 'Rakuten Advertising (LinkShare)',
    domains: [
      'rakutenadvertising.com', 'linksynergy.com', 'rakuten.com',
      'rakuten.co.jp', 'click.linksynergy.com', 'rakutenmarketing.com',
      'rakutenadvertising.net', 'linksynergy.net',
    ],
    category: 'Affiliate Network',
    disclosureHints: ['rakuten', 'rakuten advertising', 'rakuten marketing', 'linkshare'],
  },
  {
    name: 'Awin',
    domains: ['awin1.com', 'awin.com', 'zenaps.com', 'wintricks.com', 'awin1.net', 'zenaps.net'],
    patterns: [
      /[?&]clickref=/i, /[?&]awinaffid=/i, /[?&]awinmid=/i, /[?&]pled=/i,
      /awin1\.com\/cread\.php/i, /awin1\.com\/sread\.php/i,
    ],
    category: 'Affiliate Network',
    disclosureHints: ['awin', 'awin affiliate', 'awin1'],
  },
  {
    name: 'Skimlinks',
    domains: [
      'go.skimresources.com', 'skimresources.com', 'skimlinks.com',
      'go.redirectingat.com', 'redirectingat.com',
    ],
    patterns: [
      /[?&]xs=1/i, /[?&]id=/i, /go\.skimresources\.com\?id=/i,
    ],
    category: 'Affiliate Network',
    disclosureHints: ['skimlinks', 'skimlinks affiliate', 'skim resources'],
  },
  {
    name: 'ClickBank',
    domains: [
      'clickbank.net', 'clickbank.com', 'hop.clickbank.net',
      '1.payloadbeta.com', 'hoplinks.com', 'zzzzz.clickbank.net',
      'paydotcom.com', 'pay.spree.com', 'resellerheaven.com',
    ],
    patterns: [
      /[?&]hop=/i, /[?&]vendor=/i, /[?&]affiliate=/i,
      /hop\.clickbank\.net/i, /\.clickbank\.net\//i,
    ],
    category: 'Affiliate Network',
    disclosureHints: ['clickbank', 'click bank'],
  },
  {
    name: 'AvantLink',
    domains: ['avantlink.com', 'avlnk.net', 'avlnk.com', 'avantmetrics.com'],
    patterns: [
      /[?&]ctc=/i, /[?&]p=/i, /[?&]af=/i, /[?&]pri=/i, /[?&]ct=/i,
      /avlnk\.net\//i, /avantlink\.com\/click\.phtml/i,
    ],
    category: 'Affiliate Network',
    disclosureHints: ['avantlink', 'avant link'],
  },
  {
    name: 'PartnerStack',
    domains: ['partnerstack.com', 'psell.co', 'appsumo.8base.com', 'partnerstack.net'],
    patterns: [
      /[?&]psid=/i, /[?&]pgi=/i, /partnerstack\.com\/p\//i,
    ],
    category: 'Affiliate Network',
    disclosureHints: ['partnerstack', 'partner stack'],
  },
  {
    name: 'Refersion',
    domains: ['refersion.com', 'rfer.us', 'rfer.us.rdir'],
    patterns: [
      /[?&]affid=/i, /[?&]afref=/i, /rfer\.us\//i,
    ],
    category: 'Affiliate Network',
    disclosureHints: ['refersion'],
  },
  {
    name: 'Post Affiliate Pro',
    domains: ['qualityunit.com', 'postaffiliatepro.com', 'affiliate-pro.com', 'papexnet.com'],
    patterns: [
      /[?&]a_aid=/i, /[?&]a_bid=/i, /[?&]a_cid=/i, /postaffiliatepro\.com\/scripts\//i,
    ],
    category: 'Affiliate Software',
    disclosureHints: ['post affiliate pro', 'qualityunit'],
  },
  {
    name: 'Tapfiliate',
    domains: ['tapfiliate.com', 'tapfiliate.net'],
    patterns: [/[?&]ref=/i, /tapfiliate\.com\/l\//i],
    category: 'Affiliate Software',
    disclosureHints: ['tapfiliate'],
  },
  {
    name: 'HasOffers / Tune',
    domains: ['hasoffers.com', 'tune.com', 'go2cloud.org', 'go2app.com', 'tunenetwork.com'],
    patterns: [
      /[?&]transaction_id=/i, /[?&]aff_id=/i, /[?&]offer_id=/i,
      /[?&]adv_id=/i, /[?&]source=/i, /go2cloud\.org\/aff_c/i,
    ],
    category: 'Affiliate Network',
    disclosureHints: ['hasoffers', 'tune.com affiliate', 'tune network'],
  },
  {
    name: 'TradeDoubler',
    domains: ['tradedoubler.com', 'td.eu', 'clmbtrk.com', 'tddltrk.com'],
    patterns: [
      /[?&]p=/i, /[?&]a=/i, /[?&]epi=/i, /[?&]g=/i,
      /tradedoubler\.com\/click/i,
    ],
    category: 'Affiliate Network',
    disclosureHints: ['tradedoubler'],
  },
  {
    name: 'Webgains',
    domains: ['webgains.com', 'wg-aff.com', 'webgains.net'],
    patterns: [
      /[?&]wgref=/i, /[?&]ac=/i, /[?&]cs=/i, /wg-aff\.com\/click\.php/i,
    ],
    category: 'Affiliate Network',
    disclosureHints: ['webgains'],
  },
  {
    name: 'eBay Partner Network',
    domains: [
      'rover.ebay.com', 'ebay.com', 'partners.ebay.com', 'epn.ebay.com',
      'epnt.ebay.com', 'rover.ebay.co.uk', 'rover.ebay.de', 'rover.ebay.fr',
    ],
    patterns: [
      /[?&]campid=\d+/i, /[?&]customid=/i, /[?&]toolid=/i, /[?&]mpre=/i,
      /rover\.ebay\.com\/rover\//i,
    ],
    category: 'Marketplace Affiliate',
    disclosureHints: ['ebay partner network', 'epn', 'ebay affiliate', 'ebay partner'],
  },
  {
    name: 'Walmart Affiliate Program',
    domains: ['affiliates.walmart.com', 'walmart.com/go', 'affil.walmart.com'],
    patterns: [
      /[?&]affil=/i, /[?&]wl1=/i, /[?&]wl2=/i, /walmart\.com\/go\/aff/i,
    ],
    category: 'Retail Affiliate',
    disclosureHints: ['walmart affiliate', 'walmart.com affiliate'],
  },
  {
    name: 'Booking.com Affiliate',
    domains: ['booking.com', 'bookingsync.com', 'b.com/affiliate'],
    patterns: [
      /[?&]aid=\d{5,}/i, /[?&]label=/i, /[?&]sid=/i, /[?&]tmpl=/i,
    ],
    category: 'Travel Affiliate',
    disclosureHints: ['booking.com affiliate', 'booking affiliate partner'],
  },
  {
    name: 'ShopStyle',
    domains: ['shopstyle.com', 'shopstyle.it', 'shopstyle.co.uk'],
    patterns: [/[?&]pid=/i, /[?&]bid=/i, /shopstyle\.com\/action\//i],
    category: 'Affiliate Network',
    disclosureHints: ['shopstyle'],
  },
  {
    name: 'RewardStyle / LTK',
    domains: ['rewardstyle.com', 'ltkapp.com', 'rstyle.me', 'rstyle.to', 'liketk.it'],
    patterns: [
      /[?&]affiliate=/i, /rstyle\.me\//i, /liketk\.it\//i,
    ],
    category: 'Affiliate Network',
    disclosureHints: ['rewardstyle', 'ltk', 'liketk.it', 'like to know it'],
  },
  {
    name: 'VigLink / Sovrn',
    domains: ['viglink.com', 'sovrn.com', 'sovrn.co', 'redirect.viglink.com'],
    patterns: [
      /[?&]key=/i, /[?&]u=/i, /[?&]libid=/i, /redirect\.viglink\.com\?/i,
    ],
    category: 'Affiliate Network',
    disclosureHints: ['viglink', 'sovrn', 'sovrn commerce'],
  },
  {
    name: 'Etsy Affiliate',
    domains: ['etsy.com'],
    patterns: [
      /[?&]aff=awsmerch/i, /[?&]aff=[a-zA-Z0-9]+/i,
      /[?&]ref=/i, /etsy\.com\/store\//i,
    ],
    category: 'Marketplace Affiliate',
    disclosureHints: ['etsy affiliate', 'etsy associates'],
  },
  {
    name: 'AliExpress Affiliate',
    domains: [
      's.click.aliexpress.com', 'aliexpress.com', 'aliexpress.com/e/_9Ni',
      'portals.aliexpress.com', 's.click.aliexpress.com/e/_A',
    ],
    patterns: [
      /[?&]aff_fcid=/i, /[?&]aff_click_id=/i, /[?&]dl_id=/i,
      /s\.click\.aliexpress\.com\//i,
    ],
    category: 'Marketplace Affiliate',
    disclosureHints: ['aliexpress affiliate', 'portals affiliate program', 'aliexpress portais'],
  },
  {
    name: 'Target Partners',
    domains: ['target.com', 'partners.target.com', 'target.com/c/'],
    patterns: [
      /[?&]ref=/i, /[?&]cpng=/i, /partners\.target\.com\//i,
    ],
    category: 'Retail Affiliate',
    disclosureHints: ['target partners', 'target affiliate', 'target.com affiliate'],
  },
  {
    name: 'ConvertKit Affiliate',
    domains: ['convertkit.com', 'ck-maker.ck.page'],
    patterns: [
      /[?&]ref=/i, /[?&]am_id=/i, /convertkit\.com\/referr?/i,
    ],
    category: 'SaaS Affiliate',
    disclosureHints: ['convertkit affiliate'],
  },
  {
    name: 'Shopify Affiliate',
    domains: ['shopify.com', 'partners.shopify.com', 'my.shopify.com'],
    patterns: [
      /[?&]ref=/i, /[?&]partner=/i, /partners\.shopify\.com\//i,
    ],
    category: 'SaaS Affiliate',
    disclosureHints: ['shopify affiliate', 'shopify partners'],
  },
  {
    name: 'WP Engine Affiliate',
    domains: ['wpengine.com', 'share-wpengine.com', 'wpengine.net'],
    patterns: [
      /[?&]afftrack=/i, /[?&]a_aid=/i, /share-wpengine\.com\//i,
    ],
    category: 'SaaS Affiliate',
    disclosureHints: ['wp engine affiliate', 'wpengine affiliate'],
  },
  {
    name: 'Kinsta Affiliate',
    domains: ['kinsta.com', 'kinsta.cloud', 'ref.kinsta.com'],
    patterns: [
      /[?&]kaid=/i, /[?&]ref=/i, /ref\.kinsta\.com\//i,
    ],
    category: 'SaaS Affiliate',
    disclosureHints: ['kinsta affiliate'],
  },
  {
    name: 'Bluehost Affiliate',
    domains: ['bluehost.com', 'bluehosttrack.com', 'track.bluehost.com'],
    patterns: [
      /[?&]affiliate=/i, /[?&]am_id=/i, /[?&]ref=/i,
      /bluehosttrack\.com\//i,
    ],
    category: 'Web Hosting Affiliate',
    disclosureHints: ['bluehost affiliate'],
  },
  {
    name: 'SiteGround Affiliate',
    domains: ['siteground.com', 'siteground.net', 'affiliates.siteground.com'],
    patterns: [
      /[?&]affiliate=/i, /[?&]ref=/i, /affiliates\.siteground\.com\//i,
    ],
    category: 'Web Hosting Affiliate',
    disclosureHints: ['siteground affiliate'],
  },
  {
    name: 'Liquid Web Affiliate',
    domains: ['liquidweb.com', 'liquidweb.net', 'affiliates.liquidweb.com'],
    patterns: [
      /[?&]aff=/i, /[?&]ref=/i, /affiliates\.liquidweb\.com\//i,
    ],
    category: 'Web Hosting Affiliate',
    disclosureHints: ['liquid web affiliate'],
  },
  {
    name: 'HostGator Affiliate',
    domains: ['hostgator.com', 'hostgator.net', 'affiliates.hostgator.com'],
    patterns: [
      /[?&]aff=/i, /[?&]ref=/i, /hostgator\.com\/affiliate/i,
    ],
    category: 'Web Hosting Affiliate',
    disclosureHints: ['hostgator affiliate'],
  },
  {
    name: 'Coursera Affiliate',
    domains: ['coursera.org', 'coursera.com', 'affiliate.coursera.org'],
    patterns: [
      /[?&]affiliateID=/i, /[?&]ref=/i, /coursera\.org\/promote/i,
    ],
    category: 'Education Affiliate',
    disclosureHints: ['coursera affiliate'],
  },
  {
    name: 'Udemy Affiliate',
    domains: ['udemy.com', 'udemy.net', 'affiliates.udemy.com'],
    patterns: [
      /[?&]affCode=/i, /[?&]ref=/i, /udemy\.com\/affiliate/i,
    ],
    category: 'Education Affiliate',
    disclosureHints: ['udemy affiliate'],
  },
  {
    name: 'Skillshare Affiliate',
    domains: ['skillshare.com', 'skillshare.net'],
    patterns: [/[?&]affiliate=/i, /[?&]ref=/i, /skillshare\.com\/r\//i],
    category: 'Education Affiliate',
    disclosureHints: ['skillshare affiliate'],
  },
  {
    name: 'Teachable Affiliate',
    domains: ['teachable.com', 'teachable.net'],
    patterns: [/[?&]ref=/i, /[?&]aff=/i, /teachable\.com\/affiliate/i],
    category: 'Education Affiliate',
    disclosureHints: ['teachable affiliate'],
  },
  {
    name: 'Thinkific Affiliate',
    domains: ['thinkific.com', 'thinkific.net'],
    patterns: [/[?&]ref=/i, /[?&]aff=/i, /thinkific\.com\/affiliate/i],
    category: 'Education Affiliate',
    disclosureHints: ['thinkific affiliate'],
  },
  {
    name: 'Patreon Affiliate',
    domains: ['patreon.com', 'patreon.net'],
    patterns: [/[?&]ref=/i, /[?&]u=/i, /patreon\.com\/affiliate/i],
    category: 'Creator Affiliate',
    disclosureHints: ['patreon affiliate'],
  },
  {
    name: 'Adobe Affiliate',
    domains: ['adobe.com', 'adobe.net', 'partners.adobe.com'],
    patterns: [
      /[?&]ref=/i, /[?&]affiliate=/i, /[?&]promoid=/i, /[?&]mv=/i,
    ],
    category: 'Software Affiliate',
    disclosureHints: ['adobe affiliate', 'adobe partners'],
  },
  {
    name: 'ClickFunnels Affiliate',
    domains: ['clickfunnels.com', 'clickfunnels.net'],
    patterns: [/[?&]affiliate_id=/i, /[?&]ref=/i, /clickfunnels\.com\/affiliate/i],
    category: 'SaaS Affiliate',
    disclosureHints: ['clickfunnels affiliate'],
  },
  {
    name: 'Namecheap Affiliate',
    domains: ['namecheap.com', 'namecheap.net'],
    patterns: [/[?&]aff=/i, /[?&]ref=/i, /namecheap\.com\/affiliate/i],
    category: 'Domain Affiliate',
    disclosureHints: ['namecheap affiliate'],
  },
  {
    name: 'Best Buy Affiliate',
    domains: ['bestbuy.com', 'affiliates.bestbuy.com', 'bestbuy.ca'],
    patterns: [/[?&]ref=/i, /[?&]aff=/i, /bestbuy\.com\/affiliate/i],
    category: 'Retail Affiliate',
    disclosureHints: ['best buy affiliate'],
  },
]

// ----- Ad networks -----
const AD_NETWORKS: { name: string; domain: string; type: string; patterns?: RegExp[] }[] = [
  { name: 'Google AdSense', domain: 'google.com/adsense', type: 'Display Ads', patterns: [/google_ad_client/i, /googlesyndication\.com/i, /adsbygoogle\.js/i, /pub-\d{16,}/i, /pagead2\.googlesyndication\.com/i] },
  { name: 'Media.net', domain: 'media.net', type: 'Display Ads', patterns: [/media\.net/i, /media\.net\/ads/i, /media\.net\/mediakit/i] },
  { name: 'Amazon Associates (Display)', domain: 'amazon-adsystem.com', type: 'Native Ads', patterns: [/amazon-adsystem\.com/i, /aax-us-east\.amazon-adsystem\.com/i, /aax-eu\.amazon-adsystem\.com/i] },
  { name: 'AdThrive', domain: 'adthrive.com', type: 'Display Ads', patterns: [/adthrive\.com/i, /ads\.adthrive\.com/i] },
  { name: 'Mediavine', domain: 'mediavine.com', type: 'Display Ads', patterns: [/mediavine\.com/i, /scripts\.mediavine\.com/i, /mediavine\.com\/trends/i] },
  { name: 'AdSense for Search', domain: 'google.com', type: 'Search Ads', patterns: [/google_afc/i, /google_afc_/i] },
  { name: 'Taboola', domain: 'taboola.com', type: 'Native Ads', patterns: [/taboola\.com/i, /cdn\.taboola\.com/i, /libtrc\.com/i] },
  { name: 'Outbrain', domain: 'outbrain.com', type: 'Native Ads', patterns: [/outbrain\.com/i, /widgets\.outbrain\.com/i, /outbrain\.com\/norm/i] },
  { name: 'Ezoic', domain: 'ezoic.com', type: 'Display Ads', patterns: [/ezoic\.com/i, /ezojs\.com/i, /ezoic\.com\/pub/i] },
  { name: 'Sovrn (Ads)', domain: 'sovrn.com', type: 'Display Ads', patterns: [/sovrn\.com\/ads/i, /lixif/i, /sovrn\.com\/bdc/i] },
  { name: 'Carbon Ads', domain: 'carbonads.com', type: 'Developer Ads', patterns: [/carbonads\.com/i, /carbonads/i, /srv\.carbonads\.net/i] },
  { name: 'BuySellAds', domain: 'buysellads.com', type: 'Marketplace Ads', patterns: [/buysellads\.com/i, /bsads/i, /bsads\.com/i] },
  { name: 'Infolinks', domain: 'infolinks.com', type: 'Inline Ads', patterns: [/infolinks\.com/i, /infolinks\.com\/ps/i] },
  { name: 'AdMob', domain: 'google.com', type: 'Mobile Ads', patterns: [/google_admob/i, /apps\.admob\.com/i, /google_mobileads\.js/i] },
  { name: 'Raptive', domain: 'raptive.com', type: 'Display Ads', patterns: [/raptive\.com/i, /raptive-ad/i, /raptive\.com\/ad/i] },
  { name: 'Adsterra', domain: 'adsterra.com', type: 'Display Ads', patterns: [/adsterra\.com/i, /adsterra\.net/i] },
  { name: 'PropellerAds', domain: 'propellerads.com', type: 'Display Ads', patterns: [/propellerads\.com/i, /propellerads\.net/i] },
]

// General affiliate query parameters (used as a fallback detection)
const GENERIC_AFFILIATE_PARAMS = [
  'aff', 'affid', 'aff_id', 'affiliate', 'affiliate_id', 'ref', 'refid', 'ref_id',
  'clickid', 'click_id', 'cid', 'campaign', 'cmp', 'utm_affiliate', 'partner',
  'subid', 'sub_id', 'tid', 'track', 'tracking', 'atid', 'ptag', 'irclickid',
  'utm_source=affiliate', 'p1', 'irclickid2', 'irclickid3', 'aff_sub',
  'sub_id1', 'sub_id2', 'sub_id3', 'subid1', 'subid2', 'subid3',
  'clickref', 'clickref1', 'clickref2', 'clickref3',
  'afftrack', 'sscid', 'awinaffid', 'awinmid', 'pub', 'publisher',
  'promo', 'promocode', 'coupon', 'deal', 'offer', 'offer_id',
  'aff_id1', 'aff_id2', 'aff_id3', 'a_aid', 'a_bid', 'a_cid',
  'am_id', 'ad_id', 'adid', 'adv_id', 'advid', 'afftrack2',
  'ircampid', 'irgwc', 'irpid', 'irmpid', 'ircid',
  'go', 'redir', 'redirect', 'target', 'destination',
]

// Affiliate redirect subdomains (very strong signal)
const AFFILIATE_SUBDOMAIN_PREFIXES = [
  'go.', 'redirect.', 'track.', 'hop.', 'out.', 'aff.', 'jump.',
  'click.', 'refer.', 'ref.', 'r.', 'link.', 'links.', 'deals.',
  'visit.', 'partner.', 'partners.', 'promo.', 'sponsor.', 'sponsored.',
  'buys.', 'buy.', 'shop.', 'join.', 'get.', 'try.', 'review.',
]

// Affiliate indicator attributes (in <a> tags)
const AFFILIATE_DATA_ATTRS = [
  'data-affiliate', 'data-affiliate-link', 'data-affiliate-network',
  'data-affiliate-id', 'data-aff', 'data-af', 'data-affiliate-tag',
  'data-tag', 'data-partner', 'data-sponsor', 'data-sponsored',
  'data-tracking', 'data-track', 'data-click-id', 'data-ref',
  'data-Referral', 'data-referral', 'data-coupon', 'data-offer',
]

const DISCLOSURE_KEYWORDS = [
  'affiliate link', 'affiliate links', 'affiliate disclosure',
  'affiliate marketing', 'we may earn', 'we earn', 'i earn a commission',
  'i may earn a commission', 'commission if you', 'commission on qualifying',
  'as an amazon associate', 'associate i earn', 'at no extra cost to you',
  'at no additional cost to you', 'paid commission',
  'this post contains affiliate', 'this page contains affiliate',
  'may contain affiliate', 'compensated for referring',
  'federal trade commission', 'ftc', 'advertising fees',
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

// Holder for current origin (used for favicon resolution)
const baseUrlHolder: { url: string } = { url: '' }

interface ExtractedLink {
  href: string
  text: string
  rel: string
  attrs: string
}

function extractLinks(html: string, baseUrl: URL): ExtractedLink[] {
  const links: ExtractedLink[] = []
  // Catch <a ... href="..." ...> ... </a>, with attributes both before and after href
  const aTagRegex = /<a\b([^>]*?)href\s*=\s*["']([^"']+)["']([^>]*?)>([\s\S]*?)<\/a>/gi
  let m: RegExpExecArray | null
  while ((m = aTagRegex.exec(html)) !== null) {
    const beforeHref = m[1] || ''
    const rawHref = m[2]
    const afterHref = m[3] || ''
    const fullAttrs = beforeHref + afterHref
    const text = decodeHtmlEntities(m[4].replace(/<[^>]+>/g, '').trim())

    // Extract rel attribute
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

  // Also catch standalone <a href> tags without closing tag (rare but possible)
  const aSelfRegex = /<a\b([^>]*?)href\s*=\s*["']([^"']+)["']([^>]*?)>/gi
  while ((m = aSelfRegex.exec(html)) !== null) {
    const beforeHref = m[1] || ''
    const rawHref = m[2]
    const afterHref = m[3] || ''
    const fullAttrs = beforeHref + afterHref
    // Skip if we already captured this as part of a paired tag (heuristic: same href and same starting attrs)
    const alreadyCaptured = links.some(
      (l) =>
        l.href === rawHref ||
        (rawHref.startsWith('/') && l.href.endsWith(rawHref))
    )
    if (alreadyCaptured) continue
    const relMatch = fullAttrs.match(/rel\s*=\s*["']([^"']+)["']/i)
    const rel = relMatch ? relMatch[1].toLowerCase() : ''
    try {
      const resolved = new URL(rawHref, baseUrl).toString()
      if (resolved.startsWith('http://') || resolved.startsWith('https://')) {
        links.push({ href: resolved, text: '', rel, attrs: fullAttrs })
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

function isAffiliateSubdomain(href: string): boolean {
  const u = safeParseUrl(href)
  if (!u) return false
  const host = u.hostname.toLowerCase()
  return AFFILIATE_SUBDOMAIN_PREFIXES.some((p) => host.startsWith(p))
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

    // Set a realistic browser User-Agent so more sites return full HTML
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

    // First pass: count rel="sponsored" links (strong affiliate signal)
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

    // Main affiliate link detection
    for (const link of links) {
      const hrefLower = link.href.toLowerCase()
      const urlObj = safeParseUrl(link.href)
      let matchedNetwork: string | null = null
      let reason = ''

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

      // 5) Affiliate subdomain (go., redirect., track., etc.)
      if (!matchedNetwork && isAffiliateSubdomain(link.href)) {
        const u = safeParseUrl(link.href)
        if (u && u.hostname !== finalUrl.hostname) {
          matchedNetwork = 'Affiliate Redirect Subdomain'
          reason = `Link goes to ${u.hostname} (affiliated redirect subdomain)`
        }
      }

      // 6) Generic affiliate query parameters
      if (!matchedNetwork && urlObj) {
        const params = urlObj.searchParams
        const hasGeneric = GENERIC_AFFILIATE_PARAMS.some((p) => {
          if (params.has(p)) return true
          for (const k of params.keys()) {
            if (k.toLowerCase() === p || k.toLowerCase().startsWith(p + '_')) return true
          }
          return false
        })
        if (hasGeneric) {
          matchedNetwork = 'Generic Affiliate Link'
          reason = 'URL contains generic affiliate tracking parameter'
        }
      }

      // 7) rel="nofollow" + external + ad-like link = last resort check
      if (!matchedNetwork && link.rel && link.rel.includes('nofollow') && urlObj) {
        // Only mark if external + has some tracking hint
        const hasTrackingHint =
          urlObj.searchParams.toString().length > 0 &&
          GENERIC_AFFILIATE_PARAMS.some((p) => {
            const params = urlObj.searchParams
            return params.has(p) || Array.from(params.keys()).some((k) => k.toLowerCase().includes(p.slice(0, 3)))
          })
        if (hasTrackingHint) {
          matchedNetwork = 'Nofollow Tracked Link'
          reason = 'rel="nofollow" with tracking parameters'
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
    // Affiliate is true if: any affiliate link found, OR any network detected,
    // OR disclosure found, OR any rel=sponsored link
    result.isAffiliate =
      detectedAffiliateLinks.length > 0 ||
      result.affiliateNetworks.length > 0 ||
      disclosure.found ||
      sponsoredLinksCount > 0
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
