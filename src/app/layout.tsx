import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// === Google Analytics ===
// Tag ID provided by site owner. Used for traffic tracking and
// Google Search Console verification (via GA property linkage).
const GA_MEASUREMENT_ID = "G-HJZ13T8NCE";

export const metadata: Metadata = {
  metadataBase: new URL("https://affiliate-link-checker.vercel.app"),
  title: "Affiliate Link Checker: Check Amazon & Affiliate Links Free",
  description:
    "Free affiliate link checker. Paste any URL to check affiliate links, find broken Amazon links, detect affiliate tags, see the final URL, and audit outbound links. No sign up.",
  keywords: [
    "affiliate link checker",
    "amazon affiliate link checker",
    "link checker",
    "affiliate link tester",
    "broken affiliate links",
    "broken amazon links",
    "affiliate links",
    "amazon links",
    "affiliate tags",
    "affiliate id",
    "affiliate network",
    "cj affiliate",
    "amazon associates",
    "check link",
    "broken links",
    "dead links",
    "shortened links",
    "outbound links",
    "affiliate urls",
    "tracking links",
    "final url",
    "http status",
    "asin",
    "affiliate marketing",
    "affiliate programs",
    "affiliate revenue",
    "affiliate income",
    "affiliate marketers",
    "advertiser",
    "attribution",
    "affiliate tracking",
    "deep link",
    "destination url",
    "wordpress",
    "plugins",
    "google analytics",
    "google",
    "youtube",
    "alerts",
    "click",
    "page",
    "urls",
    "tags",
    "users",
  ],
  authors: [{ name: "Affiliate Link Checker" }],
  creator: "Affiliate Link Checker",
  publisher: "Affiliate Link Checker",
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
    ],
    apple: [
      { url: "/apple-touch-icon.svg", type: "image/svg+xml" },
    ],
    shortcut: ["/favicon.svg"],
  },
  manifest: undefined,
  openGraph: {
    title: "Affiliate Link Checker: Check Amazon & Affiliate Links Free",
    description:
      "Free tool to check affiliate links on any page. Find broken Amazon links, detect affiliate tags, audit outbound links, and view the final URL of each link.",
    url: "https://affiliate-link-checker.vercel.app",
    siteName: "Affiliate Link Checker",
    type: "website",
    images: [
      {
        url: "/favicon.svg",
        width: 32,
        height: 32,
        alt: "Affiliate Link Checker logo",
      },
    ],
  },
  twitter: {
    card: "summary",
    title: "Affiliate Link Checker: Check Amazon & Affiliate Links Free",
    description:
      "Free tool to check affiliate links on any page. Find broken Amazon links, detect affiliate tags, audit outbound links.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-snippet": -1,
      "max-image-preview": "large",
      "max-video-preview": -1,
    },
  },
  alternates: {
    canonical: "https://affiliate-link-checker.vercel.app",
  },
  category: "marketing",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.svg" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {/* === Google Analytics (gtag.js) === */}
        {/* Loads the GA library asynchronously to avoid blocking page render. */}
        <Script
          src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${GA_MEASUREMENT_ID}', {
              page_title: document.title,
              page_location: window.location.href,
            });
          `}
        </Script>

        {children}
        <Toaster />
      </body>
    </html>
  );
}
