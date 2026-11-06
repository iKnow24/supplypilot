/**
 * Integration tests against the LOCAL Supabase stack (make db-start). They prove tenancy is
 * enforced by Postgres itself, not just by the app's filters. Run: npm run test:db
 */
// @vitest-environment node
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { DEMO_PASSWORD, demoEmail } from "../auth/demo-users";
import type { Database } from "../db/database.types";
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
const created: string[] = [];

beforeAll(async () => {
  [a, b] = await Promise.all([signedIn(A), signedIn(B)]);
});

afterAll(async () => {
  for (const id of created) await a.from("saved_lists").delete().eq("id", id);
});

describe("anonymous visitors", () => {
  it("can't read any buyer data", async () => {
    for (const table of [
      "saved_lists",
      "carts",
      "cart_lines",
      "favorites",
      "org_members",
    ] as const) {
      const { data, error } = await client().from(table).select("*");
      expect(data ?? []).toEqual([]);
      expect(error?.code).toBe("42501");
    }
  });
});

describe("row level security between buyers", () => {
  it("only returns your own org's rows, even without a filter", async () => {
    const { data: lists } = await a.from("saved_lists").select("org_id");
    expect(lists!.length).toBeGreaterThan(0);
    expect(new Set(lists!.map((l) => l.org_id))).toEqual(new Set([A]));
    const { data: orgs } = await a.from("buyer_orgs").select("id");
    expect(orgs).toEqual([{ id: A }]);
  });

  it("rejects writes into another org", async () => {
    const { error } = await a.from("saved_lists").insert({ org_id: B, name: "sneaky" });
    expect(error?.code).toBe("42501");
    const fav = await a.from("favorites").insert({ org_id: B, product_id: "prd_vanilla" });
    expect(fav.error?.code).toBe("42501");
  });

  it("can't update or delete another org's rows (silently matches nothing)", async () => {
    const { data } = await a
      .from("saved_lists")
      .update({ name: "hijacked" })
      .eq("org_id", B)
      .select("id");
    expect(data).toEqual([]);
    const { data: still } = await b.from("saved_lists").select("name").eq("org_id", B);
    expect(still!.map((l) => l.name)).not.toContain("hijacked");
  });

  it("refuses multi-row functions for another org", async () => {
    const r1 = await a.rpc("ensure_cart", { p_org: B });
    expect(r1.error?.code).toBe("42501");
    const r2 = await a.rpc("load_list_into_cart", {
      p_org: B,
      p_list_id: "lst_littlejuniper_weekly",
    });
    expect(r2.error?.code).toBe("42501");
    const r3 = await a.rpc("set_cart_lines", { p_org: B, p_lines: [], p_mode: "replace" });
    expect(r3.error?.code).toBe("42501");
  });

  it("can't load another org's list into your own cart", async () => {
    const r = await a.rpc("load_list_into_cart", {
      p_org: A,
      p_list_id: "lst_littlejuniper_weekly",
    });
    expect(r.error?.code).toBe("P0002");
  });

  it("can't attach a line to another org's cart by id", async () => {
    const { data: theirCart } = await b.rpc("ensure_cart", { p_org: B });
    const { error } = await a.from("cart_lines").insert({
      cart_id: theirCart!.id,
      org_id: A, // composite FK: (cart_id, org_id) must match a real cart
      product_id: "prd_vanilla",
      quantity: 1,
      unit: "fl_oz",
    });
    expect(error).not.toBeNull();
  });

  it("can't grant itself membership in another org", async () => {
    const { data: me } = await a.auth.getUser();
    const { error } = await a.from("org_members").insert({ user_id: me.user!.id, org_id: B });
    expect(error?.code).toBe("42501");
  });
});

describe("SupabaseBuyerStateRepository", () => {
  it("round-trips a cart: replace, merge, update, remove, baseline", async () => {
    const repo = new SupabaseBuyerStateRepository(a, A);
    await repo.loadList("lst_thirdshift_weekly");
    let cart = await repo.getCart();
    expect(cart.sourceListId).toBe("lst_thirdshift_weekly");
    expect(cart.lines.length).toBe(12);

    await repo.setLines(
      [
        { product_id: "prd_vanilla", quantity: "1.5", unit: "fl_oz", current_supplier_id: null },
        { product_id: "prd_eggs_large", quantity: "2", unit: "dozen", current_supplier_id: null },
      ],
      "replace",
    );
    cart = await repo.getCart();
    expect(cart.sourceListId).toBeNull();
    expect(cart.lines.map((l) => [l.product_id, l.quantity, l.unit])).toEqual([
      ["prd_vanilla", "1.5", "fl_oz"],
      ["prd_eggs_large", "2", "dozen"],
    ]);

    expect(
      await repo.addLine({
        product_id: "prd_vanilla",
        quantity: "9",
        unit: "fl_oz",
        current_supplier_id: null,
      }),
    ).toBe(false);
    await repo.updateLine("prd_eggs_large", { quantity: "30", unit: "each" });
    await repo.removeLine("prd_vanilla");
    cart = await repo.getCart();
    expect(cart.lines).toEqual([
      { product_id: "prd_eggs_large", quantity: "30", unit: "each", current_supplier_id: null },
    ]);
  });

  it("saves, duplicates, renames and deletes lists; names are unique per org", async () => {
    const repo = new SupabaseBuyerStateRepository(a, A);
    const name = `db-test ${Date.now()}`;
    const id = await repo.saveCartAsList(name);
    created.push(id);
    await expect(repo.saveCartAsList(name)).rejects.toThrow(/already have a list/);
    const copy = await repo.duplicateList(id, `${name} (copy)`);
    created.push(copy);
    await repo.renameList(copy, `${name} renamed`);
    const lists = await repo.listSavedLists();
    expect(lists.find((l) => l.id === copy)?.name).toBe(`${name} renamed`);
    expect(lists.find((l) => l.id === copy)?.lines).toEqual(lists.find((l) => l.id === id)?.lines);
    await repo.deleteList(copy);
    expect((await repo.listSavedLists()).some((l) => l.id === copy)).toBe(false);
  });

  it("keeps supplier preferences disjoint", async () => {
    const repo = new SupabaseBuyerStateRepository(a, A);
    await expect(
      repo.setSupplierPreferences({ preferred: ["sup_kestrel"], excluded: ["sup_kestrel"] }),
    ).rejects.toThrow(/isn't allowed/);
    await repo.setSupplierPreferences({ preferred: [], excluded: [] });
  });
});
