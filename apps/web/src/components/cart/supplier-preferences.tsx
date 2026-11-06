"use client";

import { setSupplierPreference } from "@/app/cart/actions";
import type { SupplierPreference } from "@/lib/buyer-state/repository";
import { cn } from "@/lib/utils";

import { useAction } from "./status";

const CHOICES: { value: SupplierPreference; label: string }[] = [
  { value: "preferred", label: "Prefer" },
  { value: "neutral", label: "Allow" },
  { value: "excluded", label: "Exclude" },
];

export function SupplierPreferences({
  suppliers,
}: {
  suppliers: { id: string; name: string; preference: SupplierPreference }[];
}) {
  const { pending, run } = useAction();
  return (
    <div aria-busy={pending}>
      <ul className="space-y-2.5">
        {suppliers.map((s) => (
          <li key={s.id} className="flex items-center justify-between gap-3">
            <span id={`sup-${s.id}`} className="text-sm font-medium">
              {s.name}
            </span>
            <div
              role="radiogroup"
              aria-labelledby={`sup-${s.id}`}
              className="bg-muted flex rounded-lg p-0.5"
            >
              {CHOICES.map((c) => {
                const checked = s.preference === c.value;
                return (
                  <label
                    key={c.value}
                    className={cn(
                      "has-focus-visible:outline-ring cursor-pointer rounded-md px-2.5 py-1 text-xs font-medium has-focus-visible:outline-2",
                      checked
                        ? c.value === "excluded"
                          ? "bg-destructive-soft text-destructive"
                          : "bg-card text-foreground shadow-xs"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <input
                      type="radio"
                      name={`pref-${s.id}`}
                      value={c.value}
                      checked={checked}
                      disabled={pending}
                      onChange={() => run(() => setSupplierPreference(s.id, c.value))}
                      className="sr-only"
                    />
                    {c.label}
                  </label>
                );
              })}
            </div>
          </li>
        ))}
      </ul>
      <p className="text-muted-foreground mt-3 text-xs">
        Excluded suppliers are never used. Preferred ones will be favored when the optimizer arrives
        (Milestone 3); for now they&apos;re saved with your cart.
      </p>
    </div>
  );
}
