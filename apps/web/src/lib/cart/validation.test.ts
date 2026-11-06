import { describe, expect, it } from "vitest";

import catalog from "../../../../../data/seed/demo_catalog.json";
import type { Product, Unit } from "../catalog/schema";
import {
  CatalogIndex,
  parseQuantity,
  validateAmount,
  validateLine,
  validateListName,
} from "./validation";

const index = new CatalogIndex(catalog.products as Product[], catalog.units as Unit[]);
const flour = index.products.get("prd_flour_ap_unbl")!;
const eggs = index.products.get("prd_eggs_large")!;
const milk = index.products.get("prd_milk_whole")!;
const suppliers = new Set(catalog.suppliers.map((s) => s.id));

describe("parseQuantity", () => {
  it.each([
    ["12", "12"],
    [" 2.50 ", "2.5"],
    ["007", "7"],
    [".5", "0.5"],
    ["3.", "3"],
    ["1,200", "1200"],
    ["0.125", "0.125"],
  ])("accepts %j as %j", (input, value) => {
    expect(parseQuantity(input)).toEqual({ ok: true, value });
  });

  it.each([
    ["", /Enter a quantity/],
    ["abc", /Use a number/],
    ["-3", /Use a number/],
    ["1e3", /Use a number/],
    ["0", /more than 0/],
    ["0.000", /more than 0/],
    ["1.2345", /3 decimal places/],
    ["100001", /more than 100,000/],
  ])("rejects %j", (input, error) => {
    const r = parseQuantity(input);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(error);
  });
});

describe("validateAmount", () => {
  it("normalizes unit labels and plurals", () => {
    expect(validateAmount(index, flour, "50", "Pounds")).toEqual({
      ok: true,
      value: { quantity: "50", unit: "lb" },
    });
    expect(validateAmount(index, milk, "64", "fl oz")).toEqual({
      ok: true,
      value: { quantity: "64", unit: "fl_oz" },
    });
  });

  it("rejects units from another dimension and says which units work", () => {
    const r = validateAmount(index, flour, "5", "gal");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/can't be measured in gallons \(use g, kg, lb, oz\)/);
  });

  it("rejects unknown units", () => {
    expect(validateAmount(index, flour, "5", "bushel")).toEqual({
      ok: false,
      error: 'Unknown unit "bushel"',
    });
  });

  it("requires whole items for count units, exactly", () => {
    expect(validateAmount(index, eggs, "2.5", "each").ok).toBe(false);
    expect(validateAmount(index, eggs, "1.5", "dozen").ok).toBe(true); // 18 eggs
    expect(validateAmount(index, eggs, "1.25", "dozen").ok).toBe(true); // 15 eggs
    expect(validateAmount(index, eggs, "1.3", "dozen").ok).toBe(false); // 15.6 eggs
  });
});

describe("validateLine", () => {
  it("rejects unknown products and suppliers", () => {
    expect(validateLine(index, suppliers, { product_id: "x", quantity: "1", unit: "lb" })).toEqual({
      ok: false,
      error: "Unknown product",
    });
    expect(
      validateLine(index, suppliers, {
        product_id: flour.id,
        quantity: "1",
        unit: "lb",
        current_supplier_id: "sup_nope",
      }).ok,
    ).toBe(false);
  });

  it("returns a clean line", () => {
    expect(
      validateLine(index, suppliers, {
        product_id: flour.id,
        quantity: "50.0",
        unit: "lb",
        current_supplier_id: "sup_kestrel",
      }),
    ).toEqual({
      ok: true,
      value: {
        product_id: flour.id,
        quantity: "50",
        unit: "lb",
        current_supplier_id: "sup_kestrel",
      },
    });
  });
});

describe("CatalogIndex.findProduct", () => {
  it("matches ids and names case-insensitively", () => {
    expect(index.findProduct("prd_eggs_large")?.id).toBe("prd_eggs_large");
    expect(index.findProduct(`  ${flour.name.toUpperCase()} `)?.id).toBe(flour.id);
    expect(index.findProduct("unicorn dust")).toBeUndefined();
  });
});

describe("validateListName", () => {
  it("trims and collapses spaces, enforces length", () => {
    expect(validateListName("  Weekly   order ")).toEqual({ ok: true, value: "Weekly order" });
    expect(validateListName("   ").ok).toBe(false);
    expect(validateListName("x".repeat(81)).ok).toBe(false);
  });
});
