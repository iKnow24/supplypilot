/**
 * Store setup against the LOCAL Supabase stack (make db-start): saving is atomic and replaces
 * the last setup, other orgs can't see or write it, and buyers can write only usage ESTIMATES.
 * Uses the empty demo bakery (org_orangeblossom), and "Reset demo" puts it back to empty.
 * Run: npm run test:db
 */
// @vitest-environment node
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { DEMO_PASSWORD, demoEmail } from "../auth/demo-users";
import type { Database, Json } from "../db/database.types";
import type { StoreSetupInput } from "../store-setup/types";
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

const A = "org_orangeblossom"; // the brand-new bakery
const B = "org_littlejuniper";
const C = "org_thirdshift"; // has seeded (demo) usage
let a: Db;
let b: Db;
let c: Db;
let repoA: SupabaseBuyerStateRepository;

const setup = (over: Partial<StoreSetupInput> = {}): StoreSetupInput => ({
  items: [
    {
      name: "AP flour (50 lb bags)",
      product_id: "prd_flour_ap_unbl",
      vendor_name: null,
      note: null,
    },
    {
      name: "Lavender buds",
      product_id: null,
      vendor_name: "Bramblewood Baking Supply (Demo)",
      note: "Bought 1 × 4 oz bag at $16.25.",
    },
  ],
  imports: [
    {
      vendor_name: "Bramblewood Baking Supply (Demo)",
      supplier_id: "sup_bramblewood",
      document_kind: "invoice",
      document_date: "2026-11-03",
      lines: [
        {
          product_id: "prd_flour_ap_unbl",
          description: "AP Flour Unbleached 50#",
          pack_quantity: "50",
          pack_unit: "lb",
          pack_label: "50 lb bag",
          price_cents: 2650,
          confidence: "high",
          mapping_method: "ai_suggested",
          packs: "6",
        },
      ],
    },
  ],
  counts: [{ product_id: "prd_flour_ap_unbl", quantity: "150", unit: "lb" }],
  usage: [
    { product_id: "prd_flour_ap_unbl", week_start: "2026-10-26", quantity: "300", unit: "lb" },
    { product_id: "prd_flour_ap_unbl", week_start: "2026-11-02", quantity: "300", unit: "lb" },
  ],
  usual_list: {
    name: "Usual order",
    lines: [
      {
        product_id: "prd_flour_ap_unbl",
        quantity: "300",
        unit: "lb",
        current_supplier_id: "sup_bramblewood",
      },
    ],
  },
  ...over,
});

async function cleanUp() {
  await a.from("store_items").delete().eq("org_id", A);
  await a.from("price_imports").delete().eq("org_id", A).eq("source_type", "document");
  await a.from("stock_usage").delete().eq("org_id", A).eq("source", "invoice_estimate");
  await a.from("saved_lists").delete().eq("org_id", A).eq("name", "Usual order");
  await c.from("store_items").delete().eq("org_id", C);
}

beforeAll(async () => {
  [a, b, c] = await Promise.all([signedIn(A), signedIn(B), signedIn(C)]);
  repoA = new SupabaseBuyerStateRepository(a, A);
  await cleanUp();
});

afterAll(async () => {
  await cleanUp();
  await a.rpc("reset_demo_org", { p_org: A });
});

describe("store setup", () => {
  it("anonymous visitors can read and save nothing", async () => {
    const { data, error } = await client().from("store_items").select("*");
    expect(data ?? []).toEqual([]);
    expect(error?.code).toBe("42501");
    const rpc = await client().rpc("save_store_setup", {
      p_org: A,
      p_setup: setup() as unknown as Json,
    });
    expect(rpc.error?.code).toBe("42501");
  });

  it("saves items, dated prices with what was bought, counts, usage and the usual order", async () => {
    const listId = await repoA.saveStoreSetup(setup());
    expect(listId).toMatch(/^lst_/);

    const items = await repoA.listStoreItems();
    expect(items.map((i) => [i.name, i.productId])).toEqual([
      ["AP flour (50 lb bags)", "prd_flour_ap_unbl"],
      ["Lavender buds", null],
    ]);
    const imports = (await repoA.listPriceImports()).filter((i) => i.sourceType === "document");
    expect(imports).toEqual([
      expect.objectContaining({
        documentKind: "invoice",
        documentDate: "2026-11-03",
        lineCount: 1,
      }),
    ]);
    const prices = await repoA.listVendorPrices({ productId: "prd_flour_ap_unbl" });
    expect(prices[0]).toMatchObject({ priceCents: 2650, packs: "6", packQuantity: "50" });

    const usage = await repoA.listStockUsage();
    expect(usage.filter((u) => u.productId === "prd_flour_ap_unbl")).toEqual([
      { productId: "prd_flour_ap_unbl", weekStart: "2026-10-26", quantity: "300", unit: "lb" },
      { productId: "prd_flour_ap_unbl", weekStart: "2026-11-02", quantity: "300", unit: "lb" },
    ]);
    const counts = await repoA.listStockCounts();
    expect(counts.find((x) => x.productId === "prd_flour_ap_unbl")).toMatchObject({
      quantity: "150",
      unit: "lb",
    });
    const lists = await repoA.listSavedLists();
    expect(lists.find((l) => l.id === listId)).toMatchObject({
      name: "Usual order",
      lines: [
        {
          product_id: "prd_flour_ap_unbl",
          quantity: "300",
          unit: "lb",
          current_supplier_id: "sup_bramblewood",
        },
      ],
    });
  });

  it("setting up again replaces what the last setup learned (counts are history and stay)", async () => {
    const before = (await a.from("stock_counts").select("id").eq("org_id", A)).data!.length;
    const listId = await repoA.saveStoreSetup(
      setup({
        items: [
          { name: "Bread flour", product_id: "prd_flour_bread", vendor_name: null, note: null },
        ],
        imports: [],
        counts: [{ product_id: "prd_flour_bread", quantity: "50", unit: "lb" }],
        usage: [
          { product_id: "prd_flour_bread", week_start: "2026-11-02", quantity: "100", unit: "lb" },
        ],
        usual_list: {
          name: "Usual order",
          lines: [
            {
              product_id: "prd_flour_bread",
              quantity: "100",
              unit: "lb",
              current_supplier_id: null,
            },
          ],
        },
      }),
    );
    expect((await repoA.listStoreItems()).map((i) => i.name)).toEqual(["Bread flour"]);
    expect((await repoA.listPriceImports()).filter((i) => i.sourceType === "document")).toEqual([]);
    expect((await repoA.listStockUsage()).map((u) => u.productId)).toEqual(["prd_flour_bread"]);
    const lists = (await repoA.listSavedLists()).filter((l) => l.name === "Usual order");
    expect(lists).toHaveLength(1);
    expect(lists[0]!.id).toBe(listId);
    expect(lists[0]!.lines.map((l) => l.product_id)).toEqual(["prd_flour_bread"]);
    const after = (await a.from("stock_counts").select("id").eq("org_id", A)).data!.length;
    expect(after).toBe(before + 1);
  });

  it("a bad row saves nothing, and leaves the last setup as it was", async () => {
    const bad = setup({
      imports: [
        { ...setup().imports[0]!, lines: [{ ...setup().imports[0]!.lines[0]!, price_cents: 0 }] },
      ],
    });
    await expect(repoA.saveStoreSetup(bad)).rejects.toThrow();
    await expect(repoA.saveStoreSetup(setup({ items: [] }))).rejects.toThrow();
    expect((await repoA.listStoreItems()).map((i) => i.name)).toEqual(["Bread flour"]);
  });

  it("is invisible to other orgs, who can't save into it", async () => {
    const { data } = await b.from("store_items").select("org_id");
    expect(new Set((data ?? []).map((r) => r.org_id))).not.toContain(A);
    const { error } = await b.rpc("save_store_setup", {
      p_org: A,
      p_setup: setup() as unknown as Json,
    });
    expect(error?.code).toBe("42501");
    const sneaky = await b
      .from("store_items")
      .insert({ org_id: A, name: "sneaky", product_id: null });
    expect(sneaky.error?.code).toBe("42501");
    // Deleting another org's items is a no-op.
    const del = await b.from("store_items").delete().eq("org_id", A).select("id");
    expect(del.data ?? []).toEqual([]);
    expect((await repoA.listStoreItems()).length).toBe(1);
  });

  it("buyers can write usage estimates, and nothing else", async () => {
    const row = {
      org_id: A,
      product_id: "prd_sugar_gran_cane",
      week_start: "2026-11-02",
      quantity: 5,
      unit: "lb",
    };
    expect((await a.from("stock_usage").insert({ ...row, source: "pos" })).error?.code).toBe(
      "42501",
    );
    expect(
      (await a.from("stock_usage").insert({ ...row, source: "demo_estimate" })).error?.code,
    ).toBe("42501");
    expect(
      (await a.from("stock_usage").insert({ ...row, source: "invoice_estimate" })).error,
    ).toBeNull();
    // Not into another org.
    expect(
      (
        await b
          .from("stock_usage")
          .insert({ ...row, product_id: "prd_honey", source: "invoice_estimate" })
      ).error?.code,
    ).toBe("42501");
    // Seeded demo usage can't be deleted or edited by its own org.
    const demo = await c
      .from("stock_usage")
      .delete()
      .eq("org_id", C)
      .eq("source", "demo_estimate")
      .select();
    expect(demo.data ?? []).toEqual([]);
    const upd = await a.from("stock_usage").update({ quantity: 1 }).eq("org_id", A);
    expect(upd.error?.code).toBe("42501");
  });

  it("'Reset demo' also forgets a document setup", async () => {
    // The brand-new bakery's starting state (public.demo_seed) is empty.
    await repoA.saveStoreSetup(setup());
    const reset = await a.rpc("reset_demo_org", { p_org: A });
    expect(reset.error).toBeNull();
    expect(await repoA.listStoreItems()).toEqual([]);
    expect((await repoA.listPriceImports()).filter((i) => i.sourceType === "document")).toEqual([]);
    expect(await repoA.listStockUsage()).toEqual([]);
    expect(await repoA.listStockCounts()).toEqual([]);
    expect((await repoA.listSavedLists()).map((l) => l.name)).not.toContain("Usual order");
  });

  it("an estimate never overwrites usage that was already recorded", async () => {
    const { data: seeded } = await c
      .from("stock_usage")
      .select("product_id, week_start, quantity, unit")
      .eq("org_id", C)
      .eq("source", "demo_estimate")
      .limit(1);
    const week = seeded![0]!;
    await new SupabaseBuyerStateRepository(c, C).saveStoreSetup({
      items: [{ name: "x", product_id: week.product_id, vendor_name: null, note: null }],
      imports: [],
      counts: [],
      usage: [
        {
          product_id: week.product_id,
          week_start: week.week_start,
          quantity: "99999",
          unit: week.unit,
        },
      ],
      usual_list: null,
    });
    const { data: after } = await c
      .from("stock_usage")
      .select("quantity, source")
      .eq("org_id", C)
      .eq("product_id", week.product_id)
      .eq("week_start", week.week_start);
    expect(after).toEqual([{ quantity: week.quantity, source: "demo_estimate" }]);
  });
});
