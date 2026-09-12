# Affiliate Link Checker

> Detect affiliate programs, ad networks, and disclosure pages on any website — in seconds.

A free, open-source affiliate intelligence tool. Paste any URL and instantly see which affiliate networks it uses, what ad networks are serving its pages, and whether it has an FTC-compliant affiliate disclosure.

🔗 **Live**: [affiliate-link-checker.vercel.app](https://affiliate-link-checker.vercel.app)

---

## Features

- **30+ affiliate network detectors** — Amazon Associates, Impact, ShareASale, CJ Affiliate, Awin, Rakuten, ClickBank, AvantLink, PartnerStack, Refersion, TradeDoubler, Webgains, Skimlinks, VigLink, and more.
- **15+ ad network detectors** — Google AdSense, Media.net, AdThrive, Mediavine, Taboola, Outbrain, Ezoic, Carbon Ads, BuySellAds, Raptive, and more.
- **FTC disclosure scanner** — extracts disclosure language snippets from page text and flags pages that may be non-compliant.
- **Per-link attribution** — every affiliate link is attributed to its network with a high / medium / low confidence score.
- **Meta + Open Graph audit** — surfaces meta tags and OG properties in a clean view.
- **Exportable JSON report** — copy to clipboard or download as a file.
- **Responsive, mobile-first design** — beautiful on phones, tablets, and desktops.
- **Sub-second scans** — optimized fetch pipeline returns results in under 3 seconds for most pages.

## Tech Stack

- **Next.js 16** (App Router, Turbopack)
- **TypeScript 5**
- **Tailwind CSS 4**
- **shadcn/ui** (New York)
- **Framer Motion** for animations
- **Lucide** icons

## How It Works

1. **Paste a URL** into the input.
2. The backend (`/api/check`) fetches the page HTML server-side.
3. Every `<a href>` is extracted and matched against:
   - Domain blocklists of known affiliate networks (high confidence)
   - URL patterns like `tag=`, `aid=`, `affid=`, `ref=`, etc. (medium confidence)
   - Generic affiliate query parameters (low confidence)
4. The HTML is scanned for ad network script signatures (e.g., `adsbygoogle.js`, `taboola.com`).
5. Visible text is parsed for common disclosure phrases ("as an Amazon Associate", "we may earn a commission", etc.).
6. The frontend renders a clean, animated report with confidence badges, sample links, and exportable JSON.

## Local Development

```bash
# install
bun install

# dev server
bun run dev

# lint
bun run lint

# production build
bun run build
bun run start
```

Open [http://localhost:3000](http://localhost:3000) with your browser.

## Project Structure

```
├── src/
│   ├── app/
│   │   ├── api/check/route.ts   # Affiliate detection endpoint
│   │   ├── globals.css         # Tailwind + custom animations
│   │   ├── layout.tsx          # Root layout & metadata
│   │   └── page.tsx            # Main UI (hero, results, features)
│   └── components/ui/          # shadcn/ui components
├── public/                     # Static assets
├── package.json
└── README.md
```

## Deployment

This project is deployed on Vercel. To deploy your own:

```bash
npm i -g vercel
vercel
```

Or connect the GitHub repo to Vercel for automatic deploys on push.

## Disclaimer

Detection is heuristic. Some sites use redirect chains, JavaScript-rendered links, or affiliate networks we don't yet recognize — false negatives are possible. Always verify results against the live page when in doubt.

## License

MIT — free to use, modify, and distribute.
