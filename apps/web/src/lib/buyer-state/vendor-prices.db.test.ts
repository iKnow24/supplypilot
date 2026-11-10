/**
 * Buyer-provided vendor prices against the LOCAL Supabase stack (make db-start): another org
 * can never read, add to or delete them, and lines can't be edited in place.
 * Run: npm run test:db
 */
// @vitest-environment node
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { DEMO_PASSWORD, demoEmail } from "../auth/demo-users";
import type { Database } from "../db/database.types";
import type { PriceImportInput } from "../vendor-prices/types";
import { SupabaseBuyerStateRepository } from "./supabase-repository";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!url || !key) throw new Error("Set NEXT_PUBLIC_SUPABASE_URL/_PUBLISHABLE_KEY (make db-env)");

type Db = SupabaseClient<Database>;
const client = (): Db => createClient<Database>(url, key, { auth: { persistSession: false } });

async function signedIn(org: string): Promise<Db> {
  const db = client();
  const { error } = await db.auth.signInWithPassword({
    email: demoEmail(org),
    password: DEMO_PASSWORD,
  });
  if (error) throw new Error(`demo sign-in failed for ${org}: ${error.message}`);
  return db;
}

const A = "org_thirdshift";
const B = "org_littlejuniper";
let a: Db;
let b: Db;
let repoA: SupabaseBuyerStateRepository;
let repoB: SupabaseBuyerStateRepository;
const created: string[] = [];

const input: PriceImportInput = {
  vendorName: "Meadowlark Dairy",
  supplierId: "sup_meadowlark",
  documentKind: "text_message",
  documentDate: "2026-11-08",
  lines: [
    {
      product_id: "prd_milk_whole",
      description: "Whole milk 4/1 gal",
      pack_quantity: "4",
      pack_unit: "gal",
      pack_label: "Case of 4 gal",
      price_cents: 1689,
      confidence: "high",
      mapping_method: "ai_suggested",
    },
    {
      product_id: "prd_oat_milk",
      description: "Oat barista 12/32oz",
      pack_quantity: "12",
      pack_unit: "qt",
      pack_label: "Case of 12 qt",
      price_cents: 4150,
      confidence: "medium",
      mapping_method: "manual",
    },
  ],
};

beforeAll(async () => {
  [a, b] = await Promise.all([signedIn(A), signedIn(B)]);
  repoA = new SupabaseBuyerStateRepository(a, A);
  repoB = new SupabaseBuyerStateRepository(b, B);
});

afterAll(async () => {
  for (const id of created) await a.from("price_imports").delete().eq("id", id);
});

describe("vendor prices", () => {
  it("anonymous visitors can read nothing", async () => {
    for (const table of ["price_imports", "vendor_prices", "price_reads"] as const) {
      const { data, error } = await client().from(table).select("*");
      expect(data ?? []).toEqual([]);
      expect(error?.code).toBe("42501");
    }
    const { error } = await client().rpc("save_price_import", {
      p_org: A,
      p_vendor_name: "x",
      p_supplier_id: "sup_meadowlark",
      p_document_kind: "other",
      p_document_date: "2026-11-08",
      p_lines: [],
    });
    expect(error?.code).toBe("42501");
  });

  it("saves an import atomically and reads it back with its source", async () => {
    const id = await repoA.savePriceImport(input);
    created.push(id);

    const imports = await repoA.listPriceImports();
    expect(imports.find((i) => i.id === id)).toMatchObject({
      vendorName: "Meadowlark Dairy",
      supplierId: "sup_meadowlark",
      documentKind: "text_message",
      documentDate: "2026-11-08",
      lineCount: 2,
    });

    const milk = await repoA.listVendorPrices({ productId: "prd_milk_whole" });
    expect(milk.find((p) => p.importId === id)).toMatchObject({
      vendorName: "Meadowlark Dairy",
      packQuantity: "4",
      packUnit: "gal",
      priceCents: 1689,
      confidence: "high",
      mappingMethod: "ai_suggested",
    });
    const fromSupplier = await repoA.listVendorPrices({ supplierId: "sup_meadowlark" });
    expect(fromSupplier.filter((p) => p.importId === id)).toHaveLength(2);
    expect(await repoA.listVendorPrices({ supplierId: "sup_kestrel" })).not.toContainEqual(
      expect.objectContaining({ importId: id }),
    );
  });

  it("rejects a bad line without saving any of the import", async () => {
    const before = (await repoA.listPriceImports()).length;
    const bad = { ...input, lines: [input.lines[0]!, { ...input.lines[1]!, price_cents: 0 }] };
    await expect(repoA.savePriceImport(bad)).rejects.toThrow();
    expect((await repoA.listPriceImports()).length).toBe(before);
    await expect(repoA.savePriceImport({ ...input, lines: [] })).rejects.toThrow();
  });

  it("is invisible to other orgs, who can't add to it or delete it", async () => {
    const id = created[0]!;
    expect((await repoB.listPriceImports()).map((i) => i.id)).not.toContain(id);
    expect((await repoB.listVendorPrices()).map((p) => p.importId)).not.toContain(id);
    expect(await repoB.deletePriceImport(id)).toBe(false);

    // B can't attach a line to A's import, under either org id.
    const line = {
      import_id: id,
      product_id: "prd_milk_whole",
      description: "sneaky",
      pack_quantity: 1,
      pack_unit: "gal",
      pack_label: "1 gal",
      price_cents: 1,
      confidence: "high",
      mapping_method: "manual",
    };
    expect((await b.from("vendor_prices").insert({ ...line, org_id: A })).error?.code).toBe(
      "42501",
    );
    expect((await b.from("vendor_prices").insert({ ...line, org_id: B })).error?.code).toBe(
      "23503",
    );

    // Nor save an import into A's org through the function.
    const { error } = await b.rpc("save_price_import", {
      p_org: A,
      p_vendor_name: "sneaky",
      p_supplier_id: "sup_meadowlark",
      p_document_kind: "other",
      p_document_date: "2026-11-08",
      p_lines: input.lines as never,
    });
    expect(error?.code).toBe("42501");
  });

  it("prices can't be edited or deleted one by one, even by their own org", async () => {
    const id = created[0]!;
    const upd = await a.from("vendor_prices").update({ price_cents: 1 }).eq("import_id", id);
    expect(upd.error?.code).toBe("42501");
    const del = await a.from("vendor_prices").delete().eq("import_id", id);
    expect(del.error?.code).toBe("42501");
    const updImport = await a.from("price_imports").update({ vendor_name: "x" }).eq("id", id);
    expect(updImport.error?.code).toBe("42501");
  });

  it("deleting an import deletes its prices", async () => {
    const id = await repoA.savePriceImport(input);
    expect(await repoA.deletePriceImport(id)).toBe(true);
    expect((await repoA.listVendorPrices()).map((p) => p.importId)).not.toContain(id);
    expect(await repoA.deletePriceImport(id)).toBe(false);
  });

  it("counts AI reads per org for the hourly cap", async () => {
    const first = await repoA.logPriceRead();
    expect(await repoA.logPriceRead()).toBe(first + 1);
    const { data } = await b.from("price_reads").select("org_id");
    expect(new Set((data ?? []).map((r) => r.org_id))).not.toContain(A);
    expect((await a.from("price_reads").delete().eq("org_id", A)).error?.code).toBe("42501");
  });
});
