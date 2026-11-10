"use client";

import { Boxes, Home, Package } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

/**
 * Three places, nothing else: what's happening (Home), what you have (Stock), and everything
 * about buying (Orders: the next order, past orders, usual lists and vendors).
 */
export const NAV_ITEMS = [
  { href: "/home", label: "Home", icon: Home, match: ["/home"] },
  { href: "/stock", label: "Stock", icon: Boxes, match: ["/stock"] },
  {
    href: "/cart",
    label: "Orders",
    icon: Package,
    match: ["/cart", "/results", "/orders", "/lists", "/suppliers"],
  },
] as const;

/** The sections inside Orders. */
export const ORDER_TABS = [
  { href: "/cart", label: "Next order", match: ["/cart", "/results"] },
  { href: "/orders", label: "Past orders", match: ["/orders"] },
  { href: "/lists", label: "Usual lists", match: ["/lists"] },
  { href: "/suppliers", label: "Vendors", match: ["/suppliers"] },
] as const;

export function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

const inSection = (pathname: string, match: readonly string[]) =>
  match.some((m) => isActive(pathname, m));

/** Tablet and up: the links in the top bar. */
export function TopNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="hidden md:block">
      <ul className="flex items-center gap-1">
        {NAV_ITEMS.map((item) => {
          const active = inSection(pathname, item.match);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative rounded-lg px-3.5 py-2 text-sm font-medium transition-colors",
                  active
                    ? "text-foreground after:bg-primary after:absolute after:inset-x-3.5 after:-bottom-[13px] after:h-0.5 after:rounded-full"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/60",
                )}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Inside Orders: Next order · Past orders · Usual lists · Vendors. Hidden elsewhere. */
export function OrderTabs() {
  const pathname = usePathname();
  if (!ORDER_TABS.some((t) => inSection(pathname, t.match))) return null;
  return (
    <nav aria-label="Orders" className="-mx-1 mb-8 overflow-x-auto px-1">
      <ul className="bg-muted inline-flex rounded-xl p-1">
        {ORDER_TABS.map((t) => {
          const active = inSection(pathname, t.match);
          return (
            <li key={t.href}>
              <Link
                href={t.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "block rounded-lg px-3.5 py-1.5 text-sm font-medium whitespace-nowrap transition-colors",
                  active
                    ? "bg-card text-foreground shadow-card"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Phones: a bottom tab bar with the same three places. */
export function MobileTabBar() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Main"
      className="bg-card/85 fixed inset-x-0 bottom-0 z-40 border-t pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden"
    >
      <ul className="grid grid-cols-3">
        {NAV_ITEMS.map((item) => {
          const active = inSection(pathname, item.match);
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium",
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
