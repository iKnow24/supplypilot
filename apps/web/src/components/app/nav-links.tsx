"use client";

import { Boxes, ClipboardList, Home, Package, Settings, ShoppingCart, Truck } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

export const NAV_ITEMS = [
  { href: "/home", label: "Home", icon: Home },
  { href: "/stock", label: "Stock", icon: Boxes },
  { href: "/cart", label: "Smart Cart", icon: ShoppingCart },
  { href: "/lists", label: "Lists", icon: ClipboardList },
  { href: "/orders", label: "Orders", icon: Package },
  { href: "/suppliers", label: "Suppliers", icon: Truck },
] as const;

export function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

const itemClass = (active: boolean) =>
  cn(
    "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-[background-color,color,box-shadow]",
    active
      ? "bg-card text-foreground shadow-card"
      : "text-muted-foreground hover:bg-card/70 hover:text-foreground",
  );

const iconClass = (active: boolean) =>
  cn(
    "size-4 shrink-0 transition-colors",
    active ? "text-primary" : "text-muted-foreground group-hover:text-foreground",
  );

/** Tablet and up: the sidebar's main navigation. */
export function DesktopNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="hidden md:block">
      <p className="text-muted-foreground mb-2 px-3 text-[11px] font-medium tracking-[0.08em] uppercase">
        Buying
      </p>
      <ul className="space-y-0.5">
        {NAV_ITEMS.map((item) => {
          const active = isActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={itemClass(active)}
              >
                <Icon className={iconClass(active)} aria-hidden />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function SettingsLink() {
  const pathname = usePathname();
  const active = isActive(pathname, "/settings");
  return (
    <Link href="/settings" aria-current={active ? "page" : undefined} className={itemClass(active)}>
      <Settings className={iconClass(active)} aria-hidden />
      Settings
    </Link>
  );
}

/** Phones: a familiar bottom tab bar. */
export function MobileTabBar() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Main"
      className="bg-card/85 fixed inset-x-0 bottom-0 z-40 border-t pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden"
    >
      <ul className="grid grid-cols-6">
        {NAV_ITEMS.map((item) => {
          const active = isActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex flex-col items-center gap-1 py-2.5 text-[10.5px] font-medium whitespace-nowrap",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                <Icon className="size-5" aria-hidden />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
