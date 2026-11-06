"use client";

import { useMemo, useState } from "react";

import type { CartLine } from "@/lib/buyer-state/repository";
import type { Product, Unit } from "@/lib/catalog/schema";
import { CatalogIndex } from "@/lib/cart/validation";

import { CartLines } from "./cart-lines";
import { ProductSearch } from "./product-search";

/** Search + editable lines. After adding a product, focus jumps to its quantity. */
export function CartWorkspace({
  products,
  units,
  lines,
  favorites,
  supplierNames,
}: {
  products: Product[];
  units: Unit[];
  lines: CartLine[];
  favorites: string[];
  supplierNames: Record<string, string>;
}) {
  const index = useMemo(() => new CatalogIndex(products, units), [products, units]);
  const [focusProductId, setFocusProductId] = useState<string | null>(null);
  const inCart = useMemo(() => new Set(lines.map((l) => l.product_id)), [lines]);
  const favoriteSet = useMemo(() => new Set(favorites), [favorites]);

  return (
    <div className="space-y-4">
      <ProductSearch
        products={products}
        favorites={favorites}
        inCart={inCart}
        onAdded={setFocusProductId}
      />
      {lines.length ? (
        <CartLines
          lines={lines}
          index={index}
          supplierNames={supplierNames}
          favorites={favoriteSet}
          focusProductId={focusProductId}
        />
      ) : (
        <p className="text-muted-foreground rounded-lg border border-dashed px-4 py-8 text-center text-sm">
          Your cart is empty. Search above, load a saved list, or upload a CSV.
        </p>
      )}
    </div>
  );
}
