"use client";

import { Search, Star } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";

import { addToCart } from "@/app/(app)/cart/actions";
import { Badge } from "@/components/ui/badge";
import type { Product } from "@/lib/catalog/schema";
import { searchProducts } from "@/lib/cart/search";
import { cn } from "@/lib/utils";

import { useAction } from "./status";

/**
 * Keyboard-first product search (ARIA combobox). "/" focuses it from anywhere,
 * ↑/↓ move, Enter adds, Esc clears. With an empty query it lists favorites.
 */
export function ProductSearch({
  products,
  favorites,
  inCart,
  onAdded,
  disabled = false,
}: {
  products: Product[];
  favorites: string[];
  inCart: ReadonlySet<string>;
  onAdded?: (productId: string) => void;
  disabled?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const { pending, run } = useAction();

  const favoriteSet = useMemo(() => new Set(favorites), [favorites]);
  const results = useMemo(
    () =>
      query.trim()
        ? searchProducts(products, query, favoriteSet)
        : products.filter((p) => favoriteSet.has(p.id)).slice(0, 8),
    [products, query, favoriteSet],
  );
  const showList = open && results.length > 0;
  const activeIndex = Math.min(active, Math.max(results.length - 1, 0));

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement;
      if (t.closest("input, textarea, select, [contenteditable=true]")) return;
      e.preventDefault();
      inputRef.current?.focus();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function add(product: Product) {
    if (inCart.has(product.id)) {
      setQuery("");
      setOpen(false);
      onAdded?.(product.id);
      return;
    }
    run(
      () => addToCart(product.id),
      (r) => {
        if (!r.ok) return;
        setQuery("");
        setOpen(false);
        onAdded?.(product.id);
      },
    );
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setOpen(true);
        setActive(Math.min(activeIndex + 1, results.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setActive(Math.max(activeIndex - 1, 0));
        break;
      case "Enter":
        if (showList && results[activeIndex]) {
          e.preventDefault();
          add(results[activeIndex]);
        }
        break;
      case "Escape":
        if (query) setQuery("");
        else setOpen(false);
        break;
    }
  }

  const optionId = (p: Product) => `${listId}-${p.id}`;

  return (
    <div className="relative">
      <label htmlFor={`${listId}-input`} className="mb-1.5 block text-sm font-medium">
        Add products
      </label>
      <div className="relative">
        <Search
          className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
          aria-hidden
        />
        <input
          ref={inputRef}
          id={`${listId}-input`}
          type="text"
          role="combobox"
          autoComplete="off"
          spellCheck={false}
          aria-autocomplete="list"
          aria-expanded={showList}
          aria-controls={`${listId}-list`}
          aria-activedescendant={showList ? optionId(results[activeIndex]!) : undefined}
          aria-describedby={`${listId}-hint`}
          aria-busy={pending}
          disabled={disabled}
          placeholder="Search flour, eggs, oat milk…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={onKeyDown}
          className="border-input bg-card focus-visible:outline-ring h-11 w-full rounded-lg border pr-12 pl-9 text-sm focus-visible:outline-2 disabled:opacity-50"
        />
        <kbd
          aria-hidden
          className="text-muted-foreground bg-muted absolute top-1/2 right-3 hidden -translate-y-1/2 rounded border px-1.5 font-mono text-[11px] sm:block"
        >
          /
        </kbd>
      </div>
      <p id={`${listId}-hint`} className="sr-only">
        Type to search. Use up and down arrows to choose, Enter to add to the cart.
      </p>

      {showList ? (
        <ul
          id={`${listId}-list`}
          role="listbox"
          aria-label={query.trim() ? "Matching products" : "Favorites"}
          className="bg-popover shadow-raised absolute z-20 mt-1 max-h-80 w-full overflow-auto rounded-xl border p-1"
        >
          {!query.trim() ? (
            <li
              role="presentation"
              className="text-muted-foreground px-3 pt-1.5 pb-1 text-xs font-medium"
            >
              Favorites
            </li>
          ) : null}
          {results.map((p, i) => (
            <li
              key={p.id}
              id={optionId(p)}
              role="option"
              aria-selected={i === activeIndex}
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => setActive(i)}
              onClick={() => add(p)}
              className={cn(
                "flex cursor-pointer items-center justify-between gap-3 rounded-md px-3 py-2 text-sm",
                i === activeIndex && "bg-muted",
              )}
            >
              <span className="min-w-0">
                <span className="flex items-center gap-1.5 font-medium">
                  {favoriteSet.has(p.id) ? (
                    <Star
                      className="fill-warning text-warning size-3.5 shrink-0"
                      aria-label="Favorite"
                    />
                  ) : null}
                  <span className="truncate">{p.name}</span>
                </span>
                <span className="text-muted-foreground block truncate text-xs">
                  {p.category} · {p.spec}
                </span>
              </span>
              {inCart.has(p.id) ? <Badge variant="accent">In cart</Badge> : null}
            </li>
          ))}
        </ul>
      ) : open && query.trim() ? (
        <p className="bg-popover text-muted-foreground shadow-raised absolute z-20 mt-1 w-full rounded-xl border px-4 py-3 text-sm">
          No products match “{query.trim()}”.
        </p>
      ) : null}
    </div>
  );
}
