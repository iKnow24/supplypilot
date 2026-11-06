// @vitest-environment node
import { describe, expect, it } from "vitest";

import type { Cart } from "../buyer-state/repository";
import { OptimizerError, callOptimizer } from "./client";
import { buildOptimizeRequest } from "./request";
import type { OptimizeResponse } from "./types";

const cart: Cart = {
  id: "c1",
  deliveryDate: "2026-11-10",
  sourceListId: "lst_x",
  preferredSupplierIds: ["sup_kestrel"],
  excludedSupplierIds: ["sup_pelican"],
  lines: [
    { product_id: "prd_a", quantity: "2.5", unit: "lb", current_supplier_id: "sup_meadowlark" },
    { product_id: "prd_b", quantity: "12", unit: "each", current_supplier_id: null },
  ],
};

describe("buildOptimizeRequest", () => {
  it("maps the cart, preferences and the usual-supplier baseline", () => {
    expect(buildOptimizeRequest({ buyerId: "org_x", zone: "ORL-WP", cart })).toEqual({
      buyer_id: "org_x",
      zone: "ORL-WP",
      delivery_date: "2026-11-10",
      lines: [
        { product_id: "prd_a", quantity: "2.5", unit: "lb" },
        { product_id: "prd_b", quantity: "12", unit: "each" },
      ],
      preferences: {
        excluded_supplier_ids: ["sup_pelican"],
        preferred_supplier_ids: ["sup_kestrel"],
        allow_equivalences: true,
      },
      baseline: { lines: [{ product_id: "prd_a", supplier_id: "sup_meadowlark" }] },
    });
  });

  it("sends no baseline when no line has a usual supplier", () => {
    const noHabit = {
      ...cart,
      lines: cart.lines.map((l) => ({ ...l, current_supplier_id: null })),
    };
    expect(buildOptimizeRequest({ buyerId: "o", zone: "z", cart: noHabit }).baseline).toBeNull();
  });

  it("refuses a cart without a delivery date", () => {
    expect(() =>
      buildOptimizeRequest({ buyerId: "o", zone: "z", cart: { ...cart, deliveryDate: null } }),
    ).toThrow(/delivery date/);
  });
});

describe("callOptimizer", () => {
  const request = buildOptimizeRequest({ buyerId: "org_x", zone: "ORL-WP", cart });
  const respond = (status: number, body: unknown): typeof fetch =>
    (async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;

  it("returns the parsed response and posts to /v1/optimize", async () => {
    let seen: { url: string; body: unknown } | null = null;
    const fetchImpl = (async (url: string, init: RequestInit) => {
      seen = { url, body: JSON.parse(String(init.body)) };
      return new Response(JSON.stringify({ status: "optimal" }), { status: 200 });
    }) as unknown as typeof fetch;
    const r = await callOptimizer(request, { url: "http://opt:8000/", fetchImpl });
    expect(r.status).toBe("optimal");
    expect(seen).toEqual({ url: "http://opt:8000/v1/optimize", body: request });
  });

  it("sends the shared API key when configured, and explains a 401", async () => {
    let sent: string | null = null;
    const fetchImpl = (async (_url: string, init: RequestInit) => {
      sent = new Headers(init.headers).get("x-api-key");
      return new Response("{}", { status: 401 });
    }) as unknown as typeof fetch;
    await expect(callOptimizer(request, { fetchImpl, apiKey: "k1" })).rejects.toThrow(
      /OPTIMIZER_API_KEY/,
    );
    expect(sent).toBe("k1");
  });

  it("accepts partial plans", async () => {
    const r = await callOptimizer(request, { fetchImpl: respond(200, { status: "partial" }) });
    expect(r.status).toBe("partial");
  });

  it.each([
    [
      "unreachable",
      (async () => Promise.reject(new TypeError("fetch failed"))) as unknown as typeof fetch,
      "unavailable",
      /isn't reachable/,
    ],
    [
      "422",
      respond(422, { detail: "Unknown product 'x'" }),
      "rejected",
      /couldn't use this cart: Unknown product 'x'/,
    ],
    ["500", respond(500, {}), "failed", /HTTP 500/],
    ["garbage", respond(200, { hello: 1 }), "failed", /unexpected answer/],
  ])("maps %s to a clear error", async (_name, fetchImpl, kind, message) => {
    const err = await callOptimizer(request, { fetchImpl }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(OptimizerError);
    expect((err as OptimizerError).kind).toBe(kind);
    expect((err as OptimizerError).message).toMatch(message);
  });

  it("reports a timeout as unavailable", async () => {
    const fetchImpl = (async () => {
      const e = new Error("timed out");
      e.name = "TimeoutError";
      throw e;
    }) as unknown as typeof fetch;
    await expect(callOptimizer(request, { fetchImpl })).rejects.toThrow(/took too long/);
  });
});

export type { OptimizeResponse };
