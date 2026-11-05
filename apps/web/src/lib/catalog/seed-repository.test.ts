import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { SeedCatalogRepository, parseCatalog } from "./seed-repository";

const file = path.resolve(__dirname, "../../../../../data/seed/demo_catalog.json");
const raw = JSON.parse(readFileSync(file, "utf8"));
const repo = SeedCatalogRepository.fromSeed(raw);

describe("seed catalog contract", () => {
  it("parses with the shared schema", () => {
    expect(() => parseCatalog(raw)).not.toThrow();
  });

  it("rejects fields the contract doesn't know about", () => {
    const bad = structuredClone(raw);
    bad.suppliers[0].secret_rebate = 5;
    expect(() => parseCatalog(bad)).toThrow();
  });

  it("is labelled synthetic everywhere", async () => {
    const source = await repo.source();
    expect(source.synthetic).toBe(true);
    expect(source.label).toMatch(/not live/i);
    expect(
      (await repo.listSuppliers()).every((s) => s.synthetic && s.name.endsWith("(Demo)")),
    ).toBe(true);
  });

  it("uses the fixed demo clock for synthetic data", async () => {
    expect((await repo.source()).now.toISOString()).toBe("2026-11-05T14:00:00.000Z");
  });
});

describe("tenant isolation", () => {
  it("never exposes another buyer's contract price", async () => {
    // Sunday Crumb has a contract price on Bramblewood AP flour; Third Shift does not.
    const mine = await repo.listOffersForBuyer("org_sundaycrumb", {
      supplierId: "sup_bramblewood",
    });
    const theirs = await repo.listOffersForBuyer("org_thirdshift", {
      supplierId: "sup_bramblewood",
    });
    const flourMine = mine.find((o) => o.product.id === "prd_flour_ap_unbl")!;
    const flourTheirs = theirs.find((o) => o.product.id === "prd_flour_ap_unbl")!;
    expect(flourMine).toMatchObject({ priceCents: 2650, priceBasis: "contract" });
    expect(flourTheirs).toMatchObject({ priceCents: 2875, priceBasis: "list" });
  });

  it("buyer summaries carry no pricing", async () => {
    for (const b of await repo.listBuyers()) {
      expect(b).not.toHaveProperty("contract_prices");
    }
  });

  it("fails loudly for an unknown buyer", async () => {
    await expect(repo.listOffersForBuyer("org_nope")).rejects.toThrow(/Unknown buyer/);
  });
});

describe("freshness flags", () => {
  it("flags stale prices, stale stock and missing stock", async () => {
    const offers = await repo.listOffersForBuyer("org_thirdshift");
    const reasons = (id: string) => {
      const f = offers.find((o) => o.id === id)!.freshness;
      return f.ok ? [] : f.reasons;
    };
    expect(reasons("ofr_pwc_70010")).toEqual(["stale_price"]);
    expect(reasons("ofr_cr_blu_12")).toEqual(["stale_inventory"]);
    expect(reasons("ofr_pwc_50102")).toEqual(["missing_inventory"]);
    expect(reasons("ofr_kf_10021")).toEqual([]);
  });
});
