import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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

export const metadata: Metadata = {
  title: "Affiliate Link Checker — Detect Affiliate Programs, Ad Networks & Disclosures",
  description:
    "Free affiliate link checker. Paste any URL to detect affiliate programs, ad networks, affiliate links, and disclosure pages. Powered by 30+ network signatures.",
  keywords: [
    "affiliate link checker",
    "affiliate program detector",
    "affiliate disclosure finder",
    "ad network detector",
    "amazon associates checker",
    "shareasale",
    "impact",
    "cj affiliate",
  ],
  authors: [{ name: "Affiliate Link Checker" }],
  openGraph: {
    title: "Affiliate Link Checker",
    description:
      "Detect affiliate programs, ad networks, and disclosures on any website in seconds.",
    url: "https://affiliate-link-checker.vercel.app",
    siteName: "Affiliate Link Checker",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Affiliate Link Checker",
    description:
      "Detect affiliate programs, ad networks, and disclosures on any website in seconds.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
