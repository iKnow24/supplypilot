"use client";

import { Check, X } from "lucide-react";

import { setDeliveryDate } from "@/app/cart/actions";
import { formatDate, isoWeekday, WEEKDAY_SHORT } from "@/lib/delivery";
import { cn } from "@/lib/utils";

import { useAction } from "./status";

export interface DateOptionView {
  date: string;
  availableCount: number;
  suppliers: {
    id: string;
    name: string;
    ok: boolean;
    excluded: boolean;
    /** "Order by Tue, Nov 10, 2 PM" or the reason it can't deliver. */
    detail: string;
  }[];
}

export function DeliveryDatePicker({
  options,
  selected,
}: {
  options: DateOptionView[];
  selected: string | null;
}) {
  const { pending, run } = useAction();
  const current = options.find((o) => o.date === selected);
  const stale = selected !== null && !current;

  return (
    <fieldset aria-busy={pending}>
      <legend className="mb-2 text-sm font-medium">Delivery date</legend>
      {stale ? (
        <p className="bg-warning-soft text-warning mb-3 rounded-lg px-3 py-2 text-xs">
          Your saved date ({formatDate(selected)}) is no longer bookable. Pick a new one.
        </p>
      ) : null}
      <div className="grid grid-cols-7 gap-1">
        {options.map((o) => {
          const none = o.availableCount === 0;
          const checked = o.date === selected;
          return (
            <label
              key={o.date}
              title={
                none
                  ? "No supplier can deliver this day"
                  : `${o.availableCount} suppliers can deliver`
              }
              className={cn(
                "has-focus-visible:outline-ring flex cursor-pointer flex-col items-center rounded-lg border py-1.5 text-center has-focus-visible:outline-2",
                checked
                  ? "border-primary bg-accent text-accent-foreground"
                  : "bg-card hover:bg-muted",
                none && "cursor-not-allowed opacity-45 hover:bg-transparent",
              )}
            >
              <input
                type="radio"
                name="delivery-date"
                value={o.date}
                checked={checked}
                disabled={none}
                onChange={() => run(() => setDeliveryDate(o.date))}
                className="sr-only"
                aria-label={`${formatDate(o.date, "long")}: ${
                  none ? "no suppliers" : `${o.availableCount} suppliers can deliver`
                }`}
              />
              <span className="text-muted-foreground text-[10px] uppercase">
                {WEEKDAY_SHORT[isoWeekday(o.date)]}
              </span>
              <span className="tabular text-sm font-semibold">{Number(o.date.slice(8))}</span>
              <span className="text-muted-foreground tabular text-[10px]" aria-hidden>
                {none ? "—" : o.availableCount}
              </span>
            </label>
          );
        })}
      </div>
      <p className="text-muted-foreground mt-1.5 text-[11px]">
        Numbers show how many of your allowed suppliers can deliver that day.
      </p>

      {current ? (
        <div className="mt-4">
          <p className="mb-2 text-sm font-medium">{formatDate(current.date, "long")}</p>
          <ul className="space-y-1.5 text-sm" aria-label="Who can deliver">
            {current.suppliers.map((s) => (
              <li key={s.id} className="flex items-start gap-2">
                {s.ok && !s.excluded ? (
                  <Check className="text-success mt-0.5 size-4 shrink-0" aria-label="Can deliver" />
                ) : (
                  <X
                    className="text-muted-foreground mt-0.5 size-4 shrink-0"
                    aria-label="Can't deliver"
                  />
                )}
                <span>
                  <span className="font-medium">{s.name}</span>{" "}
                  <span className="text-muted-foreground">
                    {s.excluded ? "Excluded by you" : s.detail}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </fieldset>
  );
}
