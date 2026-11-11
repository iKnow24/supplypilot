"use client";

import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { useLayoutEffect, useRef } from "react";

import { cn } from "@/lib/utils";

export interface SlidingTab {
  href: string;
  label: string;
  icon?: LucideIcon;
  active: boolean;
}

const LOOK = {
  /** The floating top bar: a navy pill slides under the active link. */
  bar: {
    list: "relative flex items-center gap-1 p-1",
    pill: "bg-primary shadow-[0_6px_16px_-6px_oklch(0.3_0.065_262/0.55),inset_0_1px_0_oklch(1_0_0/0.14)] rounded-xl",
    link: "relative z-10 flex h-9 items-center gap-2 rounded-xl px-4 text-sm font-medium transition-colors",
    on: "text-primary-foreground bg-primary group-data-[ready]/tabs:bg-transparent",
    off: "text-muted-foreground hover:text-foreground",
  },
  /** The floating bottom bar on phones: icon above label, same navy pill. */
  dock: {
    list: "relative grid grid-cols-3 gap-1 p-1.5",
    pill: "bg-primary shadow-[0_6px_16px_-6px_oklch(0.3_0.065_262/0.55)] rounded-2xl",
    link: "relative z-10 flex flex-col items-center gap-0.5 rounded-2xl py-2 text-[11px] font-medium transition-colors [&_svg]:size-5",
    on: "text-primary-foreground bg-primary group-data-[ready]/tabs:bg-transparent",
    off: "text-muted-foreground",
  },
  /** Section tabs inside a page (Orders): a white pill on a soft track. */
  segmented: {
    list: "bg-muted relative inline-flex rounded-xl p-1",
    pill: "bg-card shadow-card rounded-lg",
    link: "relative z-10 block rounded-lg px-3.5 py-1.5 text-sm font-medium whitespace-nowrap transition-colors",
    on: "text-foreground bg-card shadow-card group-data-[ready]/tabs:bg-transparent group-data-[ready]/tabs:shadow-none",
    off: "text-muted-foreground hover:text-foreground",
  },
} as const;

/**
 * Links with a highlight that glides to the active one. The highlight is positioned from
 * JavaScript (CSSOM), never with a style attribute, so it works under the nonce-only CSP; until
 * it's measured it stays hidden and the active link keeps its own colors.
 */
export function SlidingTabs({
  items,
  label,
  look,
  className,
}: {
  items: SlidingTab[];
  label: string;
  look: keyof typeof LOOK;
  className?: string;
}) {
  const s = LOOK[look];
  const listRef = useRef<HTMLUListElement>(null);
  const pillRef = useRef<HTMLSpanElement>(null);
  const activeIndex = items.findIndex((i) => i.active);

  useLayoutEffect(() => {
    const list = listRef.current;
    const pill = pillRef.current;
    if (!list || !pill) return;
    const place = () => {
      const target = list.querySelector<HTMLElement>("[aria-current=page]");
      if (!target) {
        pill.style.opacity = "0";
        return;
      }
      // Measure against the list itself (offsetLeft would be relative to the <li>).
      const box = target.getBoundingClientRect();
      const origin = list.getBoundingClientRect();
      pill.style.width = `${box.width}px`;
      pill.style.height = `${box.height}px`;
      pill.style.transform = `translate(${box.left - origin.left}px, ${box.top - origin.top}px)`;
      pill.style.opacity = "1";
      // The pill now carries the highlight, so the active link drops its own background.
      list.setAttribute("data-ready", "");
    };
    place();
    // Glide only after the first placement, so it doesn't fly in from the corner on load.
    const raf = requestAnimationFrame(() => pill.setAttribute("data-glide", ""));
    // Re-place when the bar resizes (fonts load, window resizes). Older browsers: on resize.
    const ro = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(place);
    ro?.observe(list);
    if (!ro) window.addEventListener("resize", place);
    return () => {
      cancelAnimationFrame(raf);
      ro?.disconnect();
      window.removeEventListener("resize", place);
    };
  }, [activeIndex]);

  return (
    <nav aria-label={label} className={className}>
      <ul ref={listRef} className={cn("group/tabs", s.list)}>
        <span
          ref={pillRef}
          aria-hidden
          className={cn(
            "pointer-events-none absolute top-0 left-0 opacity-0",
            "data-[glide]:transition-[transform,width,opacity] data-[glide]:duration-300 data-[glide]:ease-[cubic-bezier(0.22,1,0.36,1)]",
            s.pill,
          )}
        />
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <li key={item.href} className="relative">
              <Link
                href={item.href}
                aria-current={item.active ? "page" : undefined}
                className={cn(s.link, item.active ? s.on : s.off)}
              >
                {Icon ? <Icon aria-hidden strokeWidth={item.active ? 2.2 : 1.8} /> : null}
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
