"use client";

import { ChevronDown } from "lucide-react";
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
  pill = false,
  showKind = !compact && !pill,
}: {
  buyers: BuyerSummary[];
  currentId: string;
  compact?: boolean;
  /** For the floating bar: a rounded chip with the business's initial. */
  pill?: boolean;
  /** Append "· Bakery" etc. to each option (needs room). */
  showKind?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const current = buyers.find((b) => b.id === currentId);
  const id = useId();
  const field = (
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
        pill
          ? "h-9 max-w-[9.5rem] cursor-pointer appearance-none truncate rounded-full bg-transparent pr-8 pl-10 text-sm font-medium disabled:opacity-60 sm:max-w-[14rem]"
          : compact
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
  );
  return (
    <form action={switchDemoBuyer}>
      <label
        htmlFor={id}
        className={
          compact || pill
            ? "sr-only"
            : "text-muted-foreground mb-1.5 block text-[11px] font-medium tracking-[0.08em] uppercase"
        }
      >
        Ordering for
      </label>
      {pill ? (
        <span className="hover:bg-card/80 relative flex items-center rounded-full ring-1 ring-black/[0.07] transition-colors">
          <span
            aria-hidden
            className="bg-primary text-primary-foreground pointer-events-none absolute left-1 flex size-7 items-center justify-center rounded-full text-xs font-semibold"
          >
            {current?.name.charAt(0) ?? "?"}
          </span>
          {field}
          <ChevronDown
            aria-hidden
            className="text-muted-foreground pointer-events-none absolute right-2.5 size-4"
          />
        </span>
      ) : (
        field
      )}
      <noscript>
        <button type="submit" className="ml-2 text-sm underline">
          Switch
        </button>
      </noscript>
    </form>
  );
}
