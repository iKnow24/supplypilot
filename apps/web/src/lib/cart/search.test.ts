import { describe, expect, it } from "vitest";

import catalog from "../../../../../data/seed/demo_catalog.json";
import type { Product } from "../catalog/schema";
import { copyName } from "./names";
import { searchProducts } from "./search";

const products = catalog.products as Product[];
const ids = (ps: Product[]) => ps.map((p) => p.id);

describe("searchProducts", () => {
  it("returns nothing for an empty query", () => {
    expect(searchProducts(products, "  ")).toEqual([]);
  });

  it("requires every word to match and ranks name prefixes first", () => {
    const r = searchProducts(products, "flour bread");
    expect(ids(r)).toEqual(["prd_flour_bread"]);
    const flour = searchProducts(products, "flo", new Set(), 20);
    expect(flour.length).toBeGreaterThan(3);
    // Name matches first; category-only matches ("Flour & grains": oats, rice) after them.
    const firstNonName = flour.findIndex((p) => !/flour/i.test(p.name));
    expect(firstNonName).toBeGreaterThan(3);
    expect(flour.slice(firstNonName).every((p) => !/flour/i.test(p.name))).toBe(true);
  });

  it("matches categories and is accent/case-insensitive", () => {
    expect(searchProducts(products, "DAIRY", new Set(), 50).length).toBeGreaterThan(0);
  });

  it("breaks ties in favor of favorites", () => {
    const plain = searchProducts(products, "flour", new Set(), 20);
    const last = plain.at(-1)!;
    const fav = searchProducts(products, "flour", new Set([last.id]), 20);
    expect(fav.indexOf(last)).toBeLessThan(plain.indexOf(last));
  });

  it("respects the limit", () => {
    expect(searchProducts(products, "a", new Set(), 3)).toHaveLength(3);
  });
});

describe("copyName", () => {
  it("adds and increments a copy suffix", () => {
    expect(copyName("Weekly", new Set(["Weekly"]))).toBe("Weekly (copy)");
    expect(copyName("Weekly", new Set(["Weekly (copy)"]))).toBe("Weekly (copy 2)");
    expect(copyName("Weekly (copy)", new Set(["Weekly (copy)", "Weekly (copy 2)"]))).toBe(
      "Weekly (copy 3)",
    );
    expect(copyName("x".repeat(80), new Set()).length).toBeLessThanOrEqual(80);
  });
});
