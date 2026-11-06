import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import { Settings } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { BuyerSwitcher } from "@/components/app/buyer-switcher";
import { DemoBanner } from "@/components/app/demo-banner";
import { Logo } from "@/components/app/logo";
import { DesktopNav, MobileTabBar } from "@/components/app/nav-links";
import { getRepository } from "@/lib/catalog/seed-repository";
import { getSession } from "@/lib/session";

import "./globals.css";

export const metadata: Metadata = {
  title: { default: "SupplyPilot", template: "%s · SupplyPilot" },
  description: "One shopping list. The smartest way to buy it.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const repo = getRepository();
  const [source, buyers, { buyer }] = await Promise.all([
    repo.source(),
    repo.listBuyers(),
    getSession(),
  ]);

  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="min-h-dvh font-sans">
        <a
          href="#main"
          className="bg-card sr-only z-50 rounded-md px-3 py-2 focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
        >
          Skip to content
        </a>
        {source.synthetic ? <DemoBanner label={source.label} /> : null}
        <header className="bg-background/90 sticky top-0 z-30 border-b backdrop-blur">
          <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4 sm:px-6">
            <Logo />
            <DesktopNav />
            <div className="ml-auto flex items-center gap-2">
              <BuyerSwitcher buyers={buyers} currentId={buyer.id} compact />
              <Link
                href="/settings"
                className="text-muted-foreground hover:bg-muted hover:text-foreground flex size-9 items-center justify-center rounded-lg"
                aria-label="Settings"
              >
                <Settings className="size-4.5" aria-hidden />
              </Link>
            </div>
          </div>
        </header>
        <main id="main" className="mx-auto max-w-6xl px-4 pt-8 pb-28 sm:px-6 md:pb-16">
          {children}
        </main>
        <MobileTabBar />
      </body>
    </html>
  );
}
