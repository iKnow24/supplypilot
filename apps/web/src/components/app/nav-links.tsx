"use client";

import { Boxes, Home, Package } from "lucide-react";
import { usePathname } from "next/navigation";

import { SlidingTabs } from "./sliding-tabs";

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

/** Tablet and up: the links in the middle of the floating bar. */
export function TopNav({ className }: { className?: string }) {
  const pathname = usePathname();
  return (
    <SlidingTabs
      label="Main"
      look="bar"
      className={className}
      items={NAV_ITEMS.map((i) => ({
        href: i.href,
        label: i.label,
        active: inSection(pathname, i.match),
      }))}
    />
  );
}

/** Inside Orders: Next order · Past orders · Usual lists · Vendors. Hidden elsewhere. */
export function OrderTabs() {
  const pathname = usePathname();
  if (!ORDER_TABS.some((t) => inSection(pathname, t.match))) return null;
  return (
    <SlidingTabs
      label="Orders"
      look="segmented"
      className="-mx-1 mb-8 overflow-x-auto px-1"
      items={ORDER_TABS.map((t) => ({
        href: t.href,
        label: t.label,
        active: inSection(pathname, t.match),
      }))}
    />
  );
}

/** Phones: the same three places in a floating dock at the bottom. */
export function MobileTabBar() {
  const pathname = usePathname();
  return (
    <div className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+0.75rem)] z-40 md:hidden">
      <SlidingTabs
        label="Main"
        look="dock"
        className="glass-bar rounded-[1.4rem]"
        items={NAV_ITEMS.map((i) => ({
          href: i.href,
          label: i.label,
          icon: i.icon,
          active: inSection(pathname, i.match),
        }))}
      />
    </div>
  );
}
