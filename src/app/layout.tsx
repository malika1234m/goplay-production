import type { Metadata } from "next";
import { Inter, Barlow_Condensed, Noto_Sans_Sinhala } from "next/font/google";
import "./globals.css";
import Providers from "@/components/Providers";
import { getLang } from "@/i18n/server";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

// Scoreboard numerals for dates, times and amounts on the payment screens
const scoreboard = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  display: "swap",
  variable: "--font-barlow",
});

// Sinhala script — Inter and Barlow have no Sinhala glyphs, so the browser falls back to this
const sinhala = Noto_Sans_Sinhala({
  subsets: ["sinhala"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-sinhala",
});

const siteUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://goplay.lk";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default:  "GoPlay — Book Sports Grounds in Sri Lanka",
    template: "%s | GoPlay",
  },
  description:
    "Find and book cricket, football, badminton, tennis courts and more sports grounds across Sri Lanka. Real-time availability, instant confirmation.",
  keywords: ["sports grounds", "book sports ground", "cricket ground", "football ground", "badminton court", "tennis court", "Sri Lanka", "GoPlay"],
  authors:  [{ name: "GoPlay" }],
  creator:  "GoPlay",
  openGraph: {
    type:        "website",
    locale:      "en_US",
    url:         siteUrl,
    siteName:    "GoPlay",
    title:       "GoPlay — Book Sports Grounds in Sri Lanka",
    description: "Find and book sports grounds across Sri Lanka. Instant booking, real-time availability.",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "GoPlay — Book Sports Grounds" }],
  },
  twitter: {
    card:        "summary_large_image",
    title:       "GoPlay — Book Sports Grounds in Sri Lanka",
    description: "Find and book sports grounds across Sri Lanka.",
    images:      ["/og-image.png"],
  },
  robots: {
    index:  true,
    follow: true,
    googleBot: {
      index:               true,
      follow:              true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet":       -1,
    },
  },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const lang = await getLang();
  return (
    <html lang={lang} className={`h-full ${inter.variable} ${scoreboard.variable} ${sinhala.variable}`}>
      <body className="min-h-full antialiased font-sans">
        <Providers lang={lang}>{children}</Providers>
      </body>
    </html>
  );
}
