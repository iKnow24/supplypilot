import { Settings } from "lucide-react";
import Link from "next/link";

import { BuyerSwitcher } from "@/components/app/buyer-switcher";
import { Logo } from "@/components/app/logo";
import { MobileTabBar, OrderTabs, TopNav } from "@/components/app/nav-links";
import { getRepository } from "@/lib/catalog/seed-repository";
import { getSession } from "@/lib/session";

/**
 * The signed-in app: one slim top bar (logo, Home · Stock · Orders, business, settings), and on
 * phones a bottom tab bar with the same three places. Nothing else competes for attention.
 */
export default async function AppLayout({ children }: LayoutProps<"/">) {
  const repo = getRepository();
  const [source, buyers, { buyer }] = await Promise.all([
    repo.source(),
    repo.listBuyers(),
    getSession(),
  ]);

  return (
    <div className="min-h-dvh">
      <header className="bg-background/80 sticky top-0 z-30 border-b backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4 sm:px-6 md:h-16 md:px-8">
          <Logo href="/home" className="shrink-0 text-[18px]" />
          <TopNav />
          <div className="ml-auto flex items-center gap-1.5">
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

      <main
        id="main"
        tabIndex={-1}
        className="mx-auto max-w-6xl px-4 pt-6 pb-28 outline-none sm:px-6 md:px-8 md:pt-10 md:pb-16"
      >
        <OrderTabs />
        {children}
        {source.synthetic ? (
          <p className="text-muted-foreground mt-16 text-center text-[11px]">
            {source.label}. Fictional suppliers and buyers; nothing is ever ordered.
          </p>
        ) : null}
      </main>
      <MobileTabBar />
    </div>
  );
}
