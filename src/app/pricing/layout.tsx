import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pricing — Affiliate Link Checker: Free + $9 Lifetime Pro",
  description:
    "Free forever for 1 check a day. Sign up free for 3 checks. Go Pro for $9 lifetime: unlimited checks, bulk URL checker (up to 50 URLs), CSV export, no ads. Pay once, use forever.",
  keywords: [
    "affiliate link checker pricing",
    "affiliate link checker pro",
    "bulk url checker",
    "affiliate link checker lifetime",
    "lemon squeezy affiliate",
  ],
  alternates: {
    canonical: "https://affiliate-link-checker.vercel.app/pricing",
  },
  openGraph: {
    title: "Pricing — Affiliate Link Checker: Free + $9 Lifetime Pro",
    description:
      "Free forever. Sign up for 3 free checks a day. Go Pro for $9 lifetime: unlimited checks + bulk checker.",
    url: "https://affiliate-link-checker.vercel.app/pricing",
    type: "website",
  },
};

export default function PricingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
