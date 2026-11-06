// @vitest-environment node
import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";

import type { OptimizeResponse } from "../optimizer/types";
import { buildPurchaseOrders } from "./build";
import { purchaseOrderCsv, purchaseOrderFilename } from "./export-csv";
import { purchaseOrderPdf } from "./export-pdf";
import { multiplyDecimal, reorderLines } from "./reorder";
import type { PurchaseOrder } from "./types";

const alloc = (over: Partial<Record<string, unknown>>) => ({
  offer_id: "ofr_1",
  supplier_id: "sup_a",
  product_id: "prd_flour",
  packs: 6,
  pack_label: "50 lb bag",
  pack_quantity: "50",
  pack_unit: "lb",
  pack_price_cents: 2650,
  price_basis: "contract" as const,
  line_total_cents: 15900,
  ...over,
});

const response = {
  status: "optimal",
  recommendation: {
    total_cents: 22800,
    items_subtotal_cents: 21300,
    fees_cents: 1500,
    supplier_count: 2,
    suppliers: [
      {
        supplier_id: "sup_a",
        supplier_name: "Alpha Baking (Demo)",
        items_subtotal_cents: 15900,
        delivery_fee_cents: 0,
        fee_waived: true,
        list_delivery_fee_cents: 2500,
        free_delivery_threshold_cents: 10000,
        min_order_cents: 0,
        order_by: { date: "2026-11-09", time: "12:00" },
        allocations: [alloc({})],
      },
      {
        supplier_id: "sup_b",
        supplier_name: "Beta Dairy (Demo)",
        items_subtotal_cents: 5400,
        delivery_fee_cents: 1500,
        fee_waived: false,
        list_delivery_fee_cents: 1500,
        free_delivery_threshold_cents: null,
        min_order_cents: 0,
        order_by: { date: "2026-11-09", time: "18:00" },
        allocations: [
          alloc({
            offer_id: "ofr_2",
            supplier_id: "sup_b",
            product_id: "prd_beet",
            packs: 2,
            pack_label: "Case, 15 dozen",
            pack_quantity: "1.5",
            pack_unit: "dozen",
            pack_price_cents: 2700,
            price_basis: "list",
            line_total_cents: 5400,
          }),
        ],
      },
    ],
    lines: [
      { product_id: "prd_flour", allocations: [alloc({})] },
      { product_id: "prd_cane", allocations: [alloc({ offer_id: "ofr_2" })] },
    ],
  },
} as unknown as OptimizeResponse;

const deliverTo = {
  buyer_name: "Sunday Crumb Bakery (Demo)",
  location_name: "Winter Park shop",
  address_label: "Park Ave, Winter Park",
  zone: "ORL-WP",
};

const drafts = buildPurchaseOrders(response, {
  deliveryDate: "2026-11-10",
  deliverTo,
  productName: (id) => ({ prd_flour: "All-purpose flour", prd_beet: "Beet sugar" })[id] ?? id,
  supplierSku: (offer) => `SKU-${offer}`,
});

const po: PurchaseOrder = {
  ...drafts[0]!,
  id: "po1",
  runId: "run1",
  number: "SUN-261106-001",
  status: "draft",
  total_cents: 15900,
  createdAt: new Date("2026-11-06T15:00:00Z"),
  exportedAt: null,
};

describe("buildPurchaseOrders", () => {
  it("makes one PO per supplier with snapshots of names, SKUs and cutoffs", () => {
    expect(
      drafts.map((d) => [d.supplier_id, d.items_subtotal_cents, d.delivery_fee_cents]),
    ).toEqual([
      ["sup_a", 15900, 0],
      ["sup_b", 5400, 1500],
    ]);
    expect(drafts[0]!.lines[0]).toMatchObject({
      product_name: "All-purpose flour",
      supplier_sku: "SKU-ofr_1",
      price_basis: "contract",
      requested_product_id: "prd_flour",
    });
    expect(drafts[1]!.order_by_time).toBe("18:00");
    expect(drafts[0]!.deliver_to).toEqual(deliverTo);
  });

  it("remembers what was asked for when an approved equivalent was bought", () => {
    expect(drafts[1]!.lines[0]).toMatchObject({
      product_id: "prd_beet",
      requested_product_id: "prd_cane",
    });
  });

  it("refuses a result without a plan", () => {
    const infeasible = {
      ...response,
      status: "infeasible",
      recommendation: null,
    } as OptimizeResponse;
    expect(() =>
      buildPurchaseOrders(infeasible, {
        deliveryDate: "2026-11-10",
        deliverTo,
        productName: String,
        supplierSku: String,
      }),
    ).toThrow(/no plan/);
  });
});

describe("CSV export", () => {
  const csv = purchaseOrderCsv(po, "Sunday Crumb Bakery (Demo)");
  const rows = csv.trimEnd().split("\r\n");

  it("has a header block, line items and totals as plain decimals", () => {
    expect(rows[0]).toBe("Purchase order,SUN-261106-001");
    expect(rows).toContain('Delivery date,"Tuesday, Nov 10"');
    expect(rows).toContain("1,SKU-ofr_1,All-purpose flour,6,50 lb bag,26.50,159.00");
    expect(rows.at(-1)).toBe(",,,,,Total,159.00");
  });

  it("neutralizes spreadsheet formulas in text", () => {
    const evil = { ...po, supplier_name: '=HYPERLINK("x")' };
    expect(purchaseOrderCsv(evil, "B")).toContain(`Supplier,"'=HYPERLINK(""x"")"`);
  });

  it("names files after the PO and supplier", () => {
    expect(purchaseOrderFilename(po, "csv")).toBe("SUN-261106-001-Alpha-Baking.csv");
  });
});

describe("PDF export", () => {
  it("produces a valid PDF titled with the PO number", async () => {
    const bytes = await purchaseOrderPdf(po, "Sunday Crumb Bakery (Demo)", {
      synthetic: true,
      dataLabel: "Demo data",
    });
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
    const doc = await PDFDocument.load(bytes);
    expect(doc.getTitle()).toBe("Purchase order SUN-261106-001");
    expect(doc.getPageCount()).toBe(1);
  });

  it("paginates long orders and survives characters the font lacks", async () => {
    const many = {
      ...po,
      supplier_name: "Café Ünïcode 🍞 Supply",
      lines: Array.from({ length: 70 }, (_, i) => ({
        ...po.lines[0]!,
        product_name: `Item ${i} 🥐`,
      })),
    };
    const doc = await PDFDocument.load(
      await purchaseOrderPdf(many, "B", { synthetic: false, dataLabel: "" }),
    );
    expect(doc.getPageCount()).toBeGreaterThan(1);
  });
});

describe("reorder", () => {
  it("multiplies decimals exactly", () => {
    expect(multiplyDecimal(6, "50")).toBe("300");
    expect(multiplyDecimal(3, "0.1")).toBe("0.3");
    expect(multiplyDecimal(2, "1.5")).toBe("3");
    expect(multiplyDecimal(4, "28.349523125")).toBe("113.3980925");
    expect(multiplyDecimal(0, "12")).toBe("0");
  });

  it("turns POs into cart lines with the PO's supplier as the usual one", () => {
    const second = { ...po, ...drafts[1]! } as PurchaseOrder;
    expect(reorderLines([po, second])).toEqual([
      { product_id: "prd_flour", quantity: "300", unit: "lb", current_supplier_id: "sup_a" },
      { product_id: "prd_beet", quantity: "3", unit: "dozen", current_supplier_id: "sup_b" },
    ]);
  });
});
