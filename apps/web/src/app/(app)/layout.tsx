import { Settings } from "lucide-react";
import Link from "next/link";

import { BuyerSwitcher } from "@/components/app/buyer-switcher";
import { Logo } from "@/components/app/logo";
import { DesktopNav, MobileTabBar, SettingsLink } from "@/components/app/nav-links";
import { getRepository } from "@/lib/catalog/seed-repository";
import { getSession } from "@/lib/session";

/** The signed-in app: a sidebar on tablets and up, a top bar plus bottom tab bar on phones. */
export default async function AppLayout({ children }: LayoutProps<"/">) {
  const repo = getRepository();
  const [source, buyers, { buyer }] = await Promise.all([
    repo.source(),
    repo.listBuyers(),
    getSession(),
  ]);

  return (
    <div className="md:flex">
      <aside className="bg-sidebar sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r md:flex">
        <div className="flex h-16 items-center px-5">
          <Logo href="/home" />
        </div>
        <div className="px-3">
          <div className="bg-card shadow-card rounded-xl p-3">
            <BuyerSwitcher buyers={buyers} currentId={buyer.id} showKind={false} />
          </div>
        </div>
        <div className="mt-6 flex-1 overflow-y-auto px-3">
          <DesktopNav />
        </div>
        <div className="space-y-3 border-t px-3 py-4">
          <SettingsLink />
          {source.synthetic ? (
            <p className="text-muted-foreground px-3 text-[11px] leading-relaxed">
              {source.label}. Fictional suppliers and buyers; nothing is ever ordered.
            </p>
          ) : null}
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="bg-background/80 sticky top-0 z-30 border-b backdrop-blur-xl md:hidden">
          <div className="flex h-14 items-center gap-3 px-4">
            <Logo href="/home" />
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
          {children}
        </main>
      </div>
      <MobileTabBar />
    </div>
  );
}
