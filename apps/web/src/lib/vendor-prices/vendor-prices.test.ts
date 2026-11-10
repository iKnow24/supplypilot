import { describe, expect, it } from "vitest";

import { CatalogIndex } from "../cart/validation";
import { SeedCatalogRepository } from "../catalog/seed-repository";
import type { Extraction, ExtractedLine } from "./extraction-schema";
import { sniffImageType } from "./image";
import { matchSupplier, suggestProducts } from "./match";
import { normalizeExtraction, normalizeLine } from "./normalize";
import {
  daysBetween,
  isIsoDate,
  localDay,
  packCentsFromUnitPrice,
  parseDollars,
  quotedOn,
} from "./parse";
import { latestQuotes } from "./quotes";
import type { PriceImportPayload, VendorPrice } from "./types";
import { validatePriceImport } from "./validate";

const repo = SeedCatalogRepository.fromSeed();
const [products, units, suppliers] = await Promise.all([
  repo.listProducts(),
  repo.units(),
  repo.listSuppliers(),
]);
const index = new CatalogIndex(products, units);
const supplierIds = new Set(suppliers.map((s) => s.id));

const line = (over: Partial<ExtractedLine> = {}): ExtractedLine => ({
  description: "AP Flour Unbleached 50#",
  product_id: "prd_flour_ap_unbl",
  pack_quantity: "50",
  pack_unit: "lb",
  pack_label: "50 lb bag",
  price: "24.50",
  price_per: "pack",
  confidence: "high",
  ...over,
});

describe("money and dates", () => {
  it("parses dollars into exact cents", () => {
    expect(parseDollars("$26.89")).toBe(2689);
    expect(parseDollars("1,234.5")).toBe(123450);
    expect(parseDollars(" 7 ")).toBe(700);
    for (const bad of ["", "-3", "abc", "2.999", "0", "0.00", "100000.01"]) {
      expect(parseDollars(bad)).toBeNull();
    }
  });

  it("multiplies a per-unit price out to one pack, rounding half up", () => {
    expect(packCentsFromUnitPrice("0.895", "50")).toBe(4475);
    expect(packCentsFromUnitPrice("0.89", "25")).toBe(2225);
    expect(packCentsFromUnitPrice("0.3333", "3")).toBe(100); // 99.99 -> 100
    expect(packCentsFromUnitPrice("0.005", "1")).toBe(1); // 0.5 cents rounds up
    expect(packCentsFromUnitPrice("abc", "1")).toBeNull();
  });

  it("checks calendar dates and counts days", () => {
    expect(isIsoDate("2026-11-09")).toBe(true);
    expect(isIsoDate("2026-02-30")).toBe(false);
    expect(isIsoDate("11/09/2026")).toBe(false);
    expect(daysBetween("2026-10-31", "2026-11-09")).toBe(9);
    // 01:30 UTC on the 10th is still the 9th in Orlando.
    expect(localDay(new Date("2026-11-10T01:30:00Z"))).toBe("2026-11-09");
    expect(quotedOn({ documentDate: null, importedAt: new Date("2026-11-10T01:30:00Z") })).toBe(
      "2026-11-09",
    );
    expect(quotedOn({ documentDate: "2026-11-02", importedAt: new Date() })).toBe("2026-11-02");
  });
});

describe("suggestions", () => {
  it("finds catalog products from invoice shorthand", () => {
    expect(suggestProducts("AP Flour Unbleached 50#", products)[0]).toBe("prd_flour_ap_unbl");
    expect(suggestProducts("Lg Eggs Grade A 15 doz", products)[0]).toBe("prd_eggs_large");
    expect(suggestProducts("Heavy cream 36% qt", products)[0]).toBe("prd_cream_heavy");
    expect(suggestProducts("Unsalted butter AA 36/1#", products)[0]).toBe("prd_butter_unsalted");
    expect(suggestProducts("Delivery fee", products)).toEqual([]);
  });

  it("matches vendor names to catalog suppliers, and only those", () => {
    expect(matchSupplier("Bramblewood Baking Supply", suppliers)).toBe("sup_bramblewood");
    expect(matchSupplier("MEADOWLARK DAIRY", suppliers)).toBe("sup_meadowlark");
    expect(matchSupplier("Kestrel Foodservice (Demo)", suppliers)).toBe("sup_kestrel");
    expect(matchSupplier("Restaurant Depot", suppliers)).toBeNull();
    expect(matchSupplier("", suppliers)).toBeNull();
  });
});

describe("normalizing what the AI read", () => {
  it("keeps a clean line as is", () => {
    const d = normalizeLine(line(), "l1", index, products);
    expect(d).toMatchObject({
      productId: "prd_flour_ap_unbl",
      packQuantity: "50",
      packUnit: "lb",
      priceCents: 2450,
      confidence: "high",
      issues: [],
      readAs: null,
    });
    expect(d.suggestions[0]).toBe("prd_flour_ap_unbl");
  });

  it("turns a per-pound price into a pack price with exact math", () => {
    const d = normalizeLine(line({ price: "0.49", price_per: "unit" }), "l1", index, products);
    expect(d.priceCents).toBe(2450);
    expect(d.readAs).toBe("$0.490/lb × 50 lb");
  });

  it("drops product ids that aren't in the catalog and flags the line", () => {
    const d = normalizeLine(line({ product_id: "prd_made_up" }), "l1", index, products);
    expect(d.productId).toBeNull();
    expect(d.suggestions[0]).toBe("prd_flour_ap_unbl"); // still suggested by name
    expect(d.confidence).toBe("low");
    expect(d.issues).toContain("Pick the matching product");
  });

  it("flags a unit that can't measure the product, a missing price and pack", () => {
    const d = normalizeLine(
      line({ product_id: "prd_eggs_large", description: "Eggs", pack_unit: "lb", price: null }),
      "l1",
      index,
      products,
    );
    expect(d.issues).toEqual(["Large eggs, shell can't be measured in lb", "Check the price"]);
    const e = normalizeLine(line({ pack_quantity: null, pack_unit: null }), "l2", index, products);
    expect(e.issues).toEqual(["Check the pack size"]);
    expect(e.confidence).toBe("low");
  });

  it("matches the vendor, keeps real dates only, and skips empty lines", () => {
    const raw: Extraction = {
      is_price_document: true,
      vendor_name: "Bramblewood Baking Supply",
      document_kind: "email",
      document_date: "2026-13-01",
      notes: null,
      lines: [line(), line({ description: "", price: null })],
    };
    const draft = normalizeExtraction(raw, { index, products, suppliers });
    expect(draft.supplierId).toBe("sup_bramblewood");
    expect(draft.documentDate).toBeNull();
    expect(draft.lines).toHaveLength(1);
  });
});

describe("saving a reviewed import", () => {
  const today = "2026-11-09";
  const payload = (over: Partial<PriceImportPayload> = {}): PriceImportPayload => ({
    vendorName: "  Bramblewood   Baking ",
    supplierId: "sup_bramblewood",
    documentKind: "price_list",
    documentDate: "2026-11-07",
    lines: [
      {
        description: "AP Flour Unbleached 50#",
        productId: "prd_flour_ap_unbl",
        packQuantity: "50",
        packUnit: "lb",
        packLabel: "50 lb bag",
        price: "24.50",
        confidence: "high",
        mappingMethod: "ai_suggested",
      },
    ],
    ...over,
  });
  const check = (p: unknown) => validatePriceImport(p, { index, supplierIds, today });

  it("accepts a good import and normalizes it", () => {
    const r = check(payload());
    expect(r).toEqual({
      ok: true,
      value: {
        vendorName: "Bramblewood Baking",
        supplierId: "sup_bramblewood",
        documentKind: "price_list",
        documentDate: "2026-11-07",
        lines: [
          {
            product_id: "prd_flour_ap_unbl",
            description: "AP Flour Unbleached 50#",
            pack_quantity: "50",
            pack_unit: "lb",
            pack_label: "50 lb bag",
            price_cents: 2450,
            confidence: "high",
            mapping_method: "ai_suggested",
          },
        ],
      },
    });
  });

  it("rejects anything the browser could tamper with", () => {
    const l = payload().lines[0]!;
    const cases: [unknown, RegExp][] = [
      [{ nope: true }, /couldn't be read/],
      [payload({ vendorName: " " }), /Name the vendor/],
      [payload({ supplierId: "sup_someone_else" }), /Unknown supplier/],
      [payload({ documentKind: "receipt" }), /kind of document/],
      [payload({ documentDate: "2026-11-30" }), /future/],
      [payload({ documentDate: "2020-01-01" }), /two years/],
      [payload({ lines: [] }), /at least one line/],
      [payload({ lines: [{ ...l, productId: "prd_x" }] }), /Line 1: pick the matching product/],
      [payload({ lines: [{ ...l, packUnit: "dozen" }] }), /Line 1: .*can't be measured/],
      [payload({ lines: [{ ...l, packQuantity: "-5" }] }), /Line 1:/],
      [payload({ lines: [{ ...l, price: "free" }] }), /Line 1: enter the pack price/],
      [payload({ lines: [{ ...l, confidence: "certain" }] }), /confidence/],
      [payload({ lines: [{ ...l, mappingMethod: "supplier_provided" }] }), /mapping/],
      [payload({ lines: Array.from({ length: 201 }, () => l) }), /couldn't be read/],
    ];
    for (const [input, error] of cases) {
      const r = check(input);
      expect(r.ok, JSON.stringify(input).slice(0, 80)).toBe(false);
      if (!r.ok) expect(r.error).toMatch(error);
    }
  });

  it("allows a blank document date", () => {
    const r = check(payload({ documentDate: "" }));
    expect(r.ok && r.value.documentDate).toBeNull();
  });
});

describe("which quotes to show", () => {
  const price = (over: Partial<VendorPrice>): VendorPrice => ({
    id: "p",
    importId: "i1",
    vendorName: "Bramblewood",
    supplierId: "sup_bramblewood",
    productId: "prd_flour_ap_unbl",
    description: "AP flour",
    packQuantity: "50",
    packUnit: "lb",
    packLabel: "50 lb bag",
    priceCents: 2450,
    confidence: "high",
    mappingMethod: "ai_suggested",
    documentKind: "price_list",
    documentDate: null,
    importedAt: new Date("2026-11-09T15:00:00Z"),
    ...over,
  });

  it("shows only each vendor's newest quote, and flags old ones", () => {
    const quotes = latestQuotes(
      [
        price({ id: "old", importId: "i0", documentDate: "2026-10-01", priceCents: 2600 }),
        price({ id: "new", importId: "i1", documentDate: "2026-11-07" }),
        price({
          id: "other",
          importId: "i2",
          supplierId: null,
          vendorName: "Restaurant Depot",
          documentDate: "2026-10-20",
        }),
      ],
      "2026-11-09",
      14,
    );
    expect(quotes.map((q) => [q.id, q.quotedOn, q.ageDays, q.current])).toEqual([
      ["new", "2026-11-07", 2, true],
      ["other", "2026-10-20", 20, false],
    ]);
  });
});

describe("image uploads", () => {
  it("trusts the bytes, not the file name or type", () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]);
    const jpg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
    const webp = new TextEncoder().encode("RIFF\0\0\0\0WEBPVP8 ");
    expect(sniffImageType(png)).toBe("image/png");
    expect(sniffImageType(jpg)).toBe("image/jpeg");
    expect(sniffImageType(webp)).toBe("image/webp");
    expect(sniffImageType(new TextEncoder().encode("<svg onload=alert(1)>"))).toBeNull();
    expect(sniffImageType(new TextEncoder().encode("%PDF-1.7"))).toBeNull();
  });
});
