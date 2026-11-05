"use client";

import { switchDemoBuyer } from "@/app/actions";
import type { BuyerSummary } from "@/lib/catalog/repository";

const KIND_LABEL = { bakery: "Bakery", cafe: "Café", restaurant: "Restaurant" } as const;

export function BuyerSwitcher({
  buyers,
  currentId,
  compact = false,
}: {
  buyers: BuyerSummary[];
  currentId: string;
  compact?: boolean;
}) {
  return (
    <form action={switchDemoBuyer}>
      <label
        htmlFor={compact ? "buyer-compact" : "buyer"}
        className={compact ? "sr-only" : "mb-1.5 block text-sm font-medium"}
      >
        Ordering for
      </label>
      <select
        id={compact ? "buyer-compact" : "buyer"}
        name="buyerId"
        defaultValue={currentId}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className="border-input bg-card h-9 max-w-[11rem] rounded-lg border px-2.5 text-sm font-medium sm:max-w-[16rem]"
      >
        {buyers.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name.replace(" (Demo)", "")}
            {compact ? "" : ` · ${KIND_LABEL[b.kind]}`}
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
