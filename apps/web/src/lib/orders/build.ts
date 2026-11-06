/**
 * Turn an approved optimizer result into one draft PO per supplier. Pure: names, SKUs and
 * the delivery address are passed in, so the PO is a self-contained snapshot.
 */
import type { OptimizeResponse } from "../optimizer/types";
import type { DeliverTo, PurchaseOrderDraft } from "./types";

export function buildPurchaseOrders(
  response: OptimizeResponse,
  ctx: {
    deliveryDate: string;
    deliverTo: DeliverTo;
    productName: (id: string) => string;
    supplierSku: (offerId: string) => string;
  },
): PurchaseOrderDraft[] {
  const plan = response.recommendation;
  if (!plan) throw new Error("This result has no plan to order from");
  const requestedBy = new Map(
    plan.lines.flatMap((l) => l.allocations.map((a) => [a.offer_id, l.product_id] as const)),
  );
  return plan.suppliers.map((s) => ({
    supplier_id: s.supplier_id,
    supplier_name: s.supplier_name,
    delivery_date: ctx.deliveryDate,
    order_by_date: s.order_by.date,
    order_by_time: s.order_by.time,
    deliver_to: ctx.deliverTo,
    items_subtotal_cents: s.items_subtotal_cents,
    delivery_fee_cents: s.delivery_fee_cents,
    lines: s.allocations.map((a) => ({
      product_id: a.product_id,
      product_name: ctx.productName(a.product_id),
      requested_product_id: requestedBy.get(a.offer_id) ?? a.product_id,
      offer_id: a.offer_id,
      supplier_sku: ctx.supplierSku(a.offer_id),
      packs: a.packs,
      pack_label: a.pack_label,
      pack_quantity: a.pack_quantity,
      pack_unit: a.pack_unit,
      pack_price_cents: a.pack_price_cents,
      price_basis: a.price_basis,
      line_total_cents: a.line_total_cents,
    })),
  }));
}
