import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: { default: "SupplyPilot", template: "%s · SupplyPilot" },
  description:
    "One shopping list, every supplier. SupplyPilot finds the lowest total delivered cost for restaurants, cafés and bakeries, and shows exactly why.",
};

/** Shared shell: fonts and the skip link. The landing page and the app each add their own chrome. */
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
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
