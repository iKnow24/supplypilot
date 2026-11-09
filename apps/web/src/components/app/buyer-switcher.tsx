"use client";

import { useId, useTransition } from "react";

import { switchDemoBuyer } from "@/app/actions";
import type { BuyerSummary } from "@/lib/catalog/repository";

const KIND_LABEL = { bakery: "Bakery", cafe: "Café", restaurant: "Restaurant" } as const;

/**
 * Switching buyer switches identity (demo sign-in), so we finish with a full page load:
 * that drops the client router cache, which may still hold the previous buyer's pages.
 */
export function BuyerSwitcher({
  buyers,
  currentId,
  compact = false,
  showKind = !compact,
}: {
  buyers: BuyerSummary[];
  currentId: string;
  compact?: boolean;
  /** Append "· Bakery" etc. to each option (needs room). */
  showKind?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const id = useId();
  return (
    <form action={switchDemoBuyer}>
      <label
        htmlFor={id}
        className={
          compact
            ? "sr-only"
            : "text-muted-foreground mb-1.5 block text-[11px] font-medium tracking-[0.08em] uppercase"
        }
      >
        Ordering for
      </label>
      <select
        key={currentId}
        id={id}
        name="buyerId"
        defaultValue={currentId}
        disabled={pending}
        aria-busy={pending}
        onChange={(e) => {
          const data = new FormData(e.currentTarget.form!);
          startTransition(async () => {
            await switchDemoBuyer(data);
            window.location.reload();
          });
        }}
        className={
          compact
            ? "border-input bg-card h-9 max-w-[11rem] rounded-lg border px-2.5 text-sm font-medium disabled:opacity-60 sm:max-w-[16rem]"
            : "border-input bg-background hover:bg-muted/60 h-9 w-full rounded-lg border px-2.5 text-sm font-medium transition-colors disabled:opacity-60"
        }
      >
        {buyers.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name.replace(" (Demo)", "")}
            {showKind ? ` · ${KIND_LABEL[b.kind]}` : ""}
          </option>
        ))}
      </select>
      <noscript>
        <button type="submit" className="ml-2 text-sm underline">
          Switch
        </button>
      </noscript>
    </form>
  );
}
