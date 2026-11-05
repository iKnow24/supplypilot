import { describe, expect, it } from "vitest";

import catalog from "../../../../data/seed/demo_catalog.json";
import { UnitTable, formatQuantity } from "./units";

const units = new UnitTable(catalog.units as never);

describe("UnitTable", () => {
  it("converts within a dimension", () => {
    expect(units.convert(15, "dozen", "each")).toBe(180);
    expect(units.convert(1, "lb", "oz")).toBeCloseTo(16, 10);
  });

  it("refuses to convert across dimensions", () => {
    expect(() => units.convert(1, "lb", "gal")).toThrow(/Can't convert/);
  });

  it("computes a display unit price", () => {
    // $26.89 for a 50 lb bag is about 53.78 cents per lb
    expect(units.unitPriceCents(2689, 50, "lb", "lb")).toBeCloseTo(53.78, 2);
    // A 10 kg block priced per lb
    expect(units.unitPriceCents(21900, 10, "kg", "lb")).toBeCloseTo(993.4, 1);
  });

  it("lists the units a product can be ordered in", () => {
    expect(units.unitsFor("each").map((u) => u.code)).toEqual(["each", "dozen"]);
  });

  it("formats quantities", () => {
    expect(formatQuantity(64, units.get("fl_oz"))).toBe("64 fl oz");
    expect(formatQuantity(2000, units.get("each"))).toBe("2,000");
  });
});
