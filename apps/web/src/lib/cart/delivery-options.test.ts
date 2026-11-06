import { describe, expect, it } from "vitest";

import catalog from "../../../../../data/seed/demo_catalog.json";
import type { Supplier } from "../catalog/schema";
import { deliveryOptions, isBookableDate } from "./delivery-options";

const TZ = "America/New_York";
const now = new Date(catalog.meta.reference_now); // Thu Nov 5 2026, 9:00 AM
const suppliers = catalog.suppliers as Supplier[];

describe("deliveryOptions", () => {
  const options = deliveryOptions(suppliers, "ORL-WP", now, TZ);

  it("covers two weeks starting today, local time", () => {
    expect(options).toHaveLength(14);
    expect(options[0]!.date).toBe("2026-11-05");
    expect(options.at(-1)!.date).toBe("2026-11-18");
  });

  it("has nobody delivering on Sunday (scenario 7)", () => {
    const sunday = options.find((o) => o.date === "2026-11-08")!;
    expect(sunday.available).toEqual([]);
    expect(sunday.checks.every((c) => !c.check.ok)).toBe(true);
  });

  it("drops Pelican in Winter Park with a zone reason", () => {
    const wed = options.find((o) => o.date === "2026-11-11")!;
    const pelican = wed.checks.find((c) => c.supplierId === "sup_pelican")!;
    expect(pelican.check).toMatchObject({ ok: false, reason: "zone" });
  });

  it("removes excluded suppliers from availability but keeps their check", () => {
    const base = options.find((o) => o.date === "2026-11-10")!;
    expect(base.available).toContain("sup_meadowlark");
    const ex = deliveryOptions(suppliers, "ORL-WP", now, TZ, new Set(["sup_meadowlark"])).find(
      (o) => o.date === "2026-11-10",
    )!;
    expect(ex.available).not.toContain("sup_meadowlark");
    expect(ex.checks.find((c) => c.supplierId === "sup_meadowlark")).toMatchObject({
      excluded: true,
      check: { ok: true },
    });
  });

  it("knows which stored dates are still bookable", () => {
    expect(isBookableDate("2026-11-10", options)).toBe(true);
    expect(isBookableDate("2026-11-01", options)).toBe(false);
  });
});
