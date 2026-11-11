"use client";

import type { Product } from "@/lib/catalog/schema";
import { cn } from "@/lib/utils";

export const field =
  "border-input bg-card focus-visible:outline-ring h-9 w-full min-w-0 rounded-lg border px-2.5 text-sm focus-visible:outline-2";

/** The catalog product picker: suggestions first, then every product by category. */
export function ProductSelect({
  value,
  suggestions,
  products,
  label,
  onChange,
  className,
}: {
  value: string;
  suggestions: string[];
  products: Product[];
  label: string;
  onChange: (productId: string) => void;
  className?: string;
}) {
  const byId = new Map(products.map((p) => [p.id, p]));
  const suggested = suggestions.map((s) => byId.get(s)).filter((p): p is Product => !!p);
  const categories = [...new Set(products.map((p) => p.category))];
  return (
    <select
      aria-label={label}
      className={cn(field, !value && "text-warning", className)}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">Not matched yet</option>
      {suggested.length ? (
        <optgroup label="Best matches">
          {suggested.map((p) => (
            <option key={`s-${p.id}`} value={p.id}>
              {p.name}
            </option>
          ))}
        </optgroup>
      ) : null}
      {categories.map((c) => (
        <optgroup key={c} label={c}>
          {products
            .filter((p) => p.category === c)
            .map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
        </optgroup>
      ))}
    </select>
  );
}

/** A number box with its unit after it. */
export function AmountInput({
  value,
  unit,
  label,
  onChange,
  invalid,
  placeholder,
}: {
  value: string;
  unit: string;
  label: string;
  onChange: (v: string) => void;
  invalid?: boolean;
  placeholder?: string;
}) {
  return (
    <span className="flex min-w-0 items-center gap-1.5">
      <input
        aria-label={label}
        aria-invalid={invalid || undefined}
        inputMode="decimal"
        className={cn(field, "tabular text-right", invalid && "border-destructive")}
        value={value}
        placeholder={placeholder ?? "—"}
        onChange={(e) => onChange(e.target.value)}
      />
      {unit ? (
        <span className="text-muted-foreground w-9 shrink-0 text-xs">
          {unit === "fl_oz" ? "fl oz" : unit}
        </span>
      ) : null}
    </span>
  );
}
