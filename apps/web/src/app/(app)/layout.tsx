import { Settings } from "lucide-react";
import Link from "next/link";

import { BuyerSwitcher } from "@/components/app/buyer-switcher";
import { FloatingHeader } from "@/components/app/floating-header";
import { Logo } from "@/components/app/logo";
import { MobileTabBar, OrderTabs, TopNav } from "@/components/app/nav-links";
import { getRepository } from "@/lib/catalog/seed-repository";
import { getSession } from "@/lib/session";

/**
 * The signed-in app: a floating glass bar (logo far left, Home · Stock · Orders in the middle,
 * the store and settings far right). On phones the three places float in a dock at the bottom.
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
      <FloatingHeader
        left={<Logo href="/home" className="text-[18px]" />}
        center={<TopNav />}
        right={
          <>
            <BuyerSwitcher buyers={buyers} currentId={buyer.id} pill />
            <Link
              href="/settings"
              className="text-muted-foreground hover:bg-card/80 hover:text-foreground flex size-9 items-center justify-center rounded-full transition-colors"
              aria-label="Settings"
            >
              <Settings className="size-4.5" aria-hidden />
            </Link>
          </>
        }
      />

      <main
        id="main"
        tabIndex={-1}
        className="mx-auto max-w-6xl px-4 pt-8 pb-32 outline-none sm:px-6 md:px-8 md:pt-12 md:pb-16"
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
