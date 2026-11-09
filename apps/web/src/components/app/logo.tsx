import Link from "next/link";

import { cn } from "@/lib/utils";

/** The mark: a rising route line in an emerald tile with a soft inner highlight. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-7 items-center justify-center rounded-[9px] bg-gradient-to-b from-[oklch(0.62_0.14_163)] to-[oklch(0.42_0.1_164)] text-white shadow-[inset_0_1px_0_oklch(1_0_0/0.3),0_1px_2px_oklch(0.2_0.05_165/0.4),0_0_0_1px_oklch(0.38_0.09_164)]",
        className,
      )}
    >
      <svg
        viewBox="0 0 24 24"
        className="size-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M4 17l6-6 4 4 6-8" />
        <path d="M15 7h5v5" />
      </svg>
    </span>
  );
}

export function Logo({ href = "/", className }: { href?: string; className?: string }) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-2.5 text-[15px] font-semibold tracking-tight",
        className,
      )}
      aria-label="SupplyPilot home"
    >
      <LogoMark />
      <span>SupplyPilot</span>
    </Link>
  );
}
