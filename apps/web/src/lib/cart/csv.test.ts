import { describe, expect, it } from "vitest";

import catalog from "../../../../../data/seed/demo_catalog.json";
import type { Product, Unit } from "../catalog/schema";
import { CSV_MAX_ROWS, cartCsvTemplate, parseCartCsv, parseCsvRows } from "./csv";
import { CatalogIndex } from "./validation";

const products = catalog.products as Product[];
const index = new CatalogIndex(products, catalog.units as Unit[]);

describe("parseCsvRows", () => {
  it("handles quotes, doubled quotes, CRLF and a BOM", () => {
    expect(parseCsvRows('﻿a,b\r\n"x, y","say ""hi"""\n')).toEqual([
      ["a", "b"],
      ["x, y", 'say "hi"'],
    ]);
  });

  it("keeps a final row without a trailing newline", () => {
    expect(parseCsvRows("a,b\n1,2")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });
});

describe("parseCartCsv", () => {
  it("reads ids or names, normalizes units, defaults the unit", () => {
    const name = (id: string) => products.find((p) => p.id === id)!.name;
    const csv = [
      "Product,Qty,Unit",
      "prd_flour_ap_unbl,250,lb",
      `"${name("prd_eggs_large")}",15,Dozen`,
      `"${name("prd_milk_whole").toUpperCase()}",8,`,
    ].join("\n");
    const r = parseCartCsv(csv, index);
    expect(r.fatal).toBeNull();
    expect(r.errors).toEqual([]);
    expect(r.lines.map((l) => [l.product_id, l.quantity, l.unit])).toEqual([
      ["prd_flour_ap_unbl", "250", "lb"],
      ["prd_eggs_large", "15", "dozen"],
      ["prd_milk_whole", "8", "gal"],
    ]);
  });

  it("reports every bad row with its file line number", () => {
    const csv = [
      "product_id,quantity,unit",
      "prd_flour_ap_unbl,abc,lb", // 2 bad qty
      "prd_nope,1,lb", // 3 unknown product
      "prd_flour_ap_unbl,10,gal", // 4 wrong dimension
      "prd_eggs_large,2.5,each", // 5 fractional count
      "", // 6 blank: ignored
      "prd_sugar_gran_cane,50,lb", // 7 ok
      "prd_sugar_gran_cane,10,lb", // 8 duplicate
      "prd_butter_unsalted,0,lb", // 9 zero
      "prd_vanilla,,fl oz", // 10 blank qty: skipped
      ",5,lb", // 11 missing product
    ].join("\n");
    const r = parseCartCsv(csv, index);
    expect(r.lines.map((l) => l.row)).toEqual([7]);
    expect(r.skipped).toBe(1);
    expect(r.errors.map((e) => [e.row, e.message])).toEqual([
      [2, "Use a number like 12 or 2.5"],
      [3, 'Unknown product "prd_nope"'],
      [4, expect.stringMatching(/can't be measured in gallons/)],
      [5, expect.stringMatching(/whole items/)],
      [8, expect.stringMatching(/already on row 7/)],
      [9, "Quantity must be more than 0"],
      [11, "Missing product"],
    ]);
  });

  it("prefers the product_id column when the template's name column is also present", () => {
    const r = parseCartCsv(
      "product_id,product_name,quantity,unit\nprd_vanilla,WRONG NAME,32,fl_oz",
      index,
    );
    expect(r.errors).toEqual([]);
    expect(r.lines[0]?.product_id).toBe("prd_vanilla");
  });

  it.each([
    ["", /empty/],
    ["foo,bar\n1,2", /"product" and a "quantity"/],
    ["product,quantity\n\n", /No rows/],
    ["product,quantity\n" + "prd_vanilla,1\n".repeat(CSV_MAX_ROWS + 1), /More than 500 rows/],
  ])("fails the whole file for %j", (csv, fatal) => {
    const r = parseCartCsv(csv, index);
    expect(r.fatal).toMatch(fatal);
    expect(r.lines).toEqual([]);
  });

  it("round-trips the downloadable template", () => {
    const template = cartCsvTemplate(products);
    const filled = template.split("\r\n");
    filled[1] = filled[1]!.replace(/,,(\w+)$/, ",50,$1");
    const r = parseCartCsv(filled.join("\r\n"), index);
    expect(r.errors).toEqual([]);
    expect(r.lines).toHaveLength(1);
    expect(r.skipped).toBe(products.length - 1);
  });
});
