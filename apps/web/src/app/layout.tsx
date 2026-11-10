import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import type { Metadata, Viewport } from "next";
import { Fraunces } from "next/font/google";

import "./globals.css";

/** The display serif: wordmark, headlines and big numbers. Self-hosted at build time. */
const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  axes: ["SOFT", "WONK", "opsz"],
  display: "swap",
});

const SITE = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : "http://localhost:3000";

const DESCRIPTION =
  "One shopping list, every supplier. SupplyPilot finds the lowest total delivered cost for restaurants, cafés and bakeries, and shows exactly why.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: { default: "SupplyPilot", template: "%s · SupplyPilot" },
  description: DESCRIPTION,
  applicationName: "SupplyPilot",
  openGraph: { type: "website", siteName: "SupplyPilot", description: DESCRIPTION },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = { themeColor: "#1b2d4e" };

/** Shared shell: fonts and the skip link. The landing page and the app each add their own chrome. */
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable} ${fraunces.variable}`}>
      <body className="min-h-dvh font-sans">
        <a
          href="#main"
          className="bg-card text-foreground shadow-raised sr-only z-[60] rounded-md px-3 py-2 focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
        >
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
