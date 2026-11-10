"use client";

import { useId } from "react";

/**
 * Pick the delivery to plan for. A plain GET form, so it works without JavaScript; with it,
 * changing the date submits right away.
 */
export function DeliverySelect({
  value,
  options,
}: {
  value: string;
  options: { date: string; label: string }[];
}) {
  const id = useId();
  return (
    <form method="get" action="/stock" className="flex flex-wrap items-center gap-2">
      <label htmlFor={id} className="text-muted-foreground text-sm">
        Plan for delivery on
      </label>
      <select
        id={id}
        name="for"
        defaultValue={value}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className="border-input bg-card h-9 rounded-lg border px-2.5 text-sm font-medium"
      >
        {options.map((o) => (
          <option key={o.date} value={o.date}>
            {o.label}
          </option>
        ))}
      </select>
      <noscript>
        <button type="submit" className="text-primary text-sm underline">
          Update
        </button>
      </noscript>
    </form>
  );
}
