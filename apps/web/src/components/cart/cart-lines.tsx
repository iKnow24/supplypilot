"use client";

import { Star, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { removeCartLine, setFavorite, updateCartLine } from "@/app/cart/actions";
import type { CartLine } from "@/lib/buyer-state/repository";
import type { Product } from "@/lib/catalog/schema";
import { validateAmount, type CatalogIndex } from "@/lib/cart/validation";
import { unitShortLabel } from "@/lib/units";
import { cn } from "@/lib/utils";

import { useAction } from "./status";

export function CartLines({
  lines,
  index,
  supplierNames,
  favorites,
  focusProductId,
}: {
  lines: CartLine[];
  index: CatalogIndex;
  supplierNames: Record<string, string>;
  favorites: ReadonlySet<string>;
  focusProductId: string | null;
}) {
  return (
    <ul aria-label="Items in your cart" className="divide-y">
      {lines.map((line) => {
        const product = index.products.get(line.product_id);
        if (!product) return null;
        return (
          <LineRow
            key={line.product_id}
            line={line}
            product={product}
            index={index}
            supplierName={
              line.current_supplier_id ? supplierNames[line.current_supplier_id] : undefined
            }
            favorite={favorites.has(product.id)}
            autoFocus={focusProductId === product.id}
          />
        );
      })}
    </ul>
  );
}

function LineRow({
  line,
  product,
  index,
  supplierName,
  favorite,
  autoFocus,
}: {
  line: CartLine;
  product: Product;
  index: CatalogIndex;
  supplierName?: string;
  favorite: boolean;
  autoFocus: boolean;
}) {
  // null = show the saved value; a string = the buyer is mid-edit.
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { pending, run } = useAction();
  const errorId = `qty-error-${product.id}`;
  const units = index.unitsFor(product);

  useEffect(() => {
    if (autoFocus) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [autoFocus]);

  function commit(quantity: string, unit: string) {
    const v = validateAmount(index, product, quantity, unit);
    if (!v.ok) {
      setError(v.error);
      return;
    }
    setError(null);
    if (v.value.quantity === line.quantity && v.value.unit === line.unit) {
      setDraft(null);
      return;
    }
    run(
      () => updateCartLine(product.id, v.value.quantity, v.value.unit),
      (r) => (r.ok ? setDraft(null) : setError(r.error)),
    );
  }

  return (
    <li
      className="flex flex-col gap-3 py-3 sm:flex-row sm:items-start sm:gap-4"
      aria-busy={pending}
    >
      <div className="min-w-0 flex-1">
        <p className="font-medium">{product.name}</p>
        <p className="text-muted-foreground text-xs">
          {product.spec}
          {supplierName ? ` · usually from ${supplierName}` : ""}
        </p>
      </div>
      <div className="flex items-start gap-2">
        <div>
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              inputMode="decimal"
              aria-label={`Quantity of ${product.name}`}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? errorId : undefined}
              value={draft ?? line.quantity}
              onChange={(e) => {
                setDraft(e.target.value);
                setError(null);
              }}
              onBlur={() => draft !== null && commit(draft, line.unit)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  commit(draft ?? line.quantity, line.unit);
                }
                if (e.key === "Escape") {
                  setDraft(null);
                  setError(null);
                }
              }}
              className={cn(
                "border-input bg-card focus-visible:outline-ring tabular h-9 w-24 rounded-lg border px-2.5 text-right text-sm focus-visible:outline-2",
                error && "border-destructive",
              )}
            />
            <select
              aria-label={`Unit for ${product.name}`}
              value={line.unit}
              onChange={(e) => commit(draft ?? line.quantity, e.target.value)}
              className="border-input bg-card h-9 w-20 rounded-lg border px-2 text-sm"
            >
              {units.map((u) => (
                <option key={u.code} value={u.code}>
                  {unitShortLabel(u.code)}
                </option>
              ))}
            </select>
          </div>
          {error ? (
            <p id={errorId} className="text-destructive mt-1 max-w-56 text-xs">
              {error}
            </p>
          ) : null}
        </div>
        <button
          type="button"
          aria-pressed={favorite}
          aria-label={`${favorite ? "Unfavorite" : "Favorite"} ${product.name}`}
          title={favorite ? "Remove from favorites" : "Add to favorites"}
          onClick={() => run(() => setFavorite(product.id, !favorite))}
          className="text-muted-foreground hover:bg-muted flex size-9 items-center justify-center rounded-lg"
        >
          <Star className={cn("size-4", favorite && "fill-warning text-warning")} aria-hidden />
        </button>
        <button
          type="button"
          aria-label={`Remove ${product.name}`}
          title="Remove"
          onClick={() => run(() => removeCartLine(product.id))}
          className="text-muted-foreground hover:bg-destructive-soft hover:text-destructive flex size-9 items-center justify-center rounded-lg"
        >
          <Trash2 className="size-4" aria-hidden />
        </button>
      </div>
    </li>
  );
}
