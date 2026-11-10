"use client";

import { Check, CircleAlert, X } from "lucide-react";
import { useId } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Product, Unit } from "@/lib/catalog/schema";
import { parseQuantity } from "@/lib/cart/validation";
import { formatUnitPrice } from "@/lib/money";
import { unitShortLabel } from "@/lib/units";
import { cn } from "@/lib/utils";
import type { Confidence } from "@/lib/vendor-prices/types";

export type Decision = "approved" | "rejected" | null;

/** One line under review, as the buyer has edited it. */
export interface ReviewLine {
  key: string;
  description: string;
  aiProductId: string | null;
  suggestions: string[];
  productId: string;
  packQuantity: string;
  packUnit: string;
  packLabel: string;
  price: string;
  readAs: string | null;
  confidence: Confidence;
  issues: string[];
  decision: Decision;
  error: string | null;
}

const CONFIDENCE: Record<
  Confidence,
  { label: string; variant: "success" | "warning" | "destructive" }
> = {
  high: { label: "Clear", variant: "success" },
  medium: { label: "Check this", variant: "warning" },
  low: { label: "Unclear", variant: "destructive" },
};

const field =
  "border-input bg-card focus-visible:outline-ring h-9 w-full min-w-0 rounded-lg border px-2.5 text-sm focus-visible:outline-2";

export function ReviewLineCard({
  line,
  number,
  products,
  units,
  onChange,
  onDecide,
}: {
  line: ReviewLine;
  number: number;
  products: Product[];
  units: Unit[];
  onChange: (patch: Partial<ReviewLine>) => void;
  onDecide: (decision: Decision) => void;
}) {
  const id = useId();
  const byId = new Map(products.map((p) => [p.id, p]));
  const product = byId.get(line.productId);
  const unitChoices = product ? units.filter((u) => u.base_unit === product.base_unit) : units;
  const unit = units.find((u) => u.code === line.packUnit);
  const suggested = line.suggestions.map((s) => byId.get(s)).filter((p): p is Product => !!p);
  const categories = [...new Set(products.map((p) => p.category))];

  // Display-only preview of what this pack costs per the product's usual unit.
  let perUnit: string | null = null;
  const qty = parseQuantity(line.packQuantity);
  const price = Number(line.price.replace(/[$,\s]/g, ""));
  if (product && unit && unit.base_unit === product.base_unit && qty.ok && price > 0) {
    const display = units.find((u) => u.code === product.default_unit) ?? unit;
    const packInDisplay = (Number(qty.value) * Number(unit.to_base)) / Number(display.to_base);
    perUnit = `${formatUnitPrice((price * 100) / packInDisplay)}/${unitShortLabel(display.code)}`;
  }

  const c = CONFIDENCE[line.confidence];
  return (
    <li
      aria-labelledby={`${id}-title`}
      className={cn(
        "bg-card shadow-card rounded-2xl p-4 ring-1 transition-[box-shadow,opacity] sm:p-5",
        line.decision === "approved" && "ring-level-ok ring-2",
        line.decision === "rejected" && "opacity-60 ring-transparent",
        line.decision === null && "ring-black/5",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-muted-foreground text-xs">Line {number} · read as</p>
          <p id={`${id}-title`} className="font-medium break-words">
            {line.description}
          </p>
          {line.readAs ? (
            <p className="text-muted-foreground tabular mt-0.5 text-xs">Priced {line.readAs}</p>
          ) : null}
        </div>
        <Badge variant={c.variant}>{c.label}</Badge>
      </div>

      {line.issues.length > 0 && line.decision !== "approved" ? (
        <ul className="text-warning mt-2 space-y-0.5 text-xs">
          {line.issues.map((issue) => (
            <li key={issue} className="flex items-center gap-1.5">
              <CircleAlert className="size-3.5 shrink-0" aria-hidden /> {issue}
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.8fr)_minmax(0,1.5fr)_minmax(0,1.2fr)_minmax(0,1fr)]">
        <label className="grid min-w-0 gap-1 text-xs font-medium">
          Product
          <select
            className={field}
            value={line.productId}
            onChange={(e) => onChange({ productId: e.target.value })}
          >
            <option value="">Pick a product…</option>
            {suggested.length > 0 ? (
              <optgroup label="Suggested">
                {suggested.map((p) => (
                  <option key={`s-${p.id}`} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </optgroup>
            ) : null}
            {categories.map((cat) => (
              <optgroup key={cat} label={cat}>
                {products
                  .filter((p) => p.category === cat)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
              </optgroup>
            ))}
          </select>
        </label>

        <fieldset className="grid min-w-0 gap-1">
          <legend className="mb-1 text-xs font-medium">Pack size</legend>
          <div className="flex gap-2">
            <input
              aria-label={`Pack amount, line ${number}`}
              inputMode="decimal"
              className={cn(field, "tabular w-20 shrink-0 text-right")}
              value={line.packQuantity}
              onChange={(e) => onChange({ packQuantity: e.target.value })}
            />
            <select
              aria-label={`Pack unit, line ${number}`}
              className={cn(field, "flex-1")}
              value={line.packUnit}
              onChange={(e) => onChange({ packUnit: e.target.value })}
            >
              <option value="">Unit</option>
              {unitChoices.map((u) => (
                <option key={u.code} value={u.code}>
                  {unitShortLabel(u.code)}
                </option>
              ))}
            </select>
          </div>
        </fieldset>

        <label className="grid min-w-0 gap-1 text-xs font-medium">
          Pack name
          <input
            className={field}
            value={line.packLabel}
            placeholder="50 lb bag"
            maxLength={80}
            onChange={(e) => onChange({ packLabel: e.target.value })}
          />
        </label>

        <label className="grid min-w-0 gap-1 text-xs font-medium">
          Pack price
          <span className="relative">
            <span className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-sm">
              $
            </span>
            <input
              inputMode="decimal"
              className={cn(field, "tabular pl-6 text-right")}
              value={line.price}
              onChange={(e) => onChange({ price: e.target.value })}
            />
          </span>
        </label>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground tabular text-xs" aria-live="polite">
          {perUnit ? `= ${perUnit}` : " "}
        </p>
        <div className="flex items-center gap-2">
          {line.error ? (
            <p role="alert" className="text-destructive text-xs">
              {line.error}
            </p>
          ) : null}
          <Button
            type="button"
            size="sm"
            variant={line.decision === "rejected" ? "secondary" : "ghost"}
            aria-pressed={line.decision === "rejected"}
            onClick={() => onDecide(line.decision === "rejected" ? null : "rejected")}
          >
            <X aria-hidden /> Reject<span className="sr-only"> line {number}</span>
          </Button>
          <Button
            type="button"
            size="sm"
            variant={line.decision === "approved" ? "default" : "outline"}
            aria-pressed={line.decision === "approved"}
            onClick={() => onDecide(line.decision === "approved" ? null : "approved")}
          >
            <Check aria-hidden /> {line.decision === "approved" ? "Approved" : "Approve"}
            <span className="sr-only"> line {number}</span>
          </Button>
        </div>
      </div>
    </li>
  );
}
