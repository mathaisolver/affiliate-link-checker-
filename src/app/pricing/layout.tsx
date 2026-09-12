import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pricing — Affiliate Link Checker: Free + $9 Lifetime Pro",
  description:
    "Sign up free for 3 affiliate link checks per day. Or pay $9 once for unlimited lifetime checks, bulk URL checker (up to 50 URLs), CSV export, no ads. Pay once, use forever.",
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
      "Sign up free for 3 checks per day. Or pay $9 once for unlimited lifetime Pro: bulk checker, CSV export, no ads.",
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
