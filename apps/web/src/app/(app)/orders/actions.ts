"use server";

/**
 * Purchase-order actions. POs are built on the server from the stored result and the catalog
 * (never from what the browser sends), and only ever for the signed-in buyer's org.
 */
import { runBuyerAction, str, type ActionResult } from "@/lib/actions/run";
import { validateLine } from "@/lib/cart/validation";
import { getRepository } from "@/lib/catalog/seed-repository";
import { buildPurchaseOrders } from "@/lib/orders/build";
import { reorderLines } from "@/lib/orders/reorder";
import type { PurchaseOrder } from "@/lib/orders/types";

/** The explicit approve step: turn a result into one draft PO per supplier. */
export async function approveResult(runId: string): Promise<ActionResult> {
  return runBuyerAction(async ({ state, session }) => {
    const run = await state.getRun(str(runId));
    if (!run) return { ok: false, error: "That result no longer exists" };
    if (!run.response.recommendation) {
      return { ok: false, error: "There's no plan to order from in this result" };
    }
    const existing = await state.listPurchaseOrders({ runId: run.id });
    if (existing.length) {
      return { ok: true, message: "Purchase orders already exist for this result" };
    }

    const repo = getRepository();
    const [products, offers] = await Promise.all([
      repo.listProducts(),
      repo.listOffersForBuyer(session.buyer.id),
    ]);
    const productName = new Map(products.map((p) => [p.id, p.name]));
    const sku = new Map(offers.map((o) => [o.id, o.supplierSku]));
    const location = session.buyer.locations[0]!;
    const drafts = buildPurchaseOrders(run.response, {
      deliveryDate: run.deliveryDate,
      deliverTo: {
        buyer_name: session.buyer.name,
        location_name: location.name,
        address_label: location.address_label,
        zone: location.zone,
      },
      productName: (id) => productName.get(id) ?? id,
      supplierSku: (offerId) => sku.get(offerId) ?? offerId,
    });
    const ids = await state.createPurchaseOrders(run.id, drafts);
    return {
      ok: true,
      message: `Created ${ids.length} draft purchase order${ids.length === 1 ? "" : "s"}`,
    };
  });
}

/** Marks a PO exported. The browser downloads the file right after this succeeds. */
export async function exportPurchaseOrder(poId: string): Promise<ActionResult> {
  return runBuyerAction(async ({ state }) => {
    await state.markPurchaseOrderExported(str(poId));
  });
}

export async function discardDraftPurchaseOrder(poId: string): Promise<ActionResult> {
  return runBuyerAction(async ({ state }) => {
    const done = await state.discardDraftPurchaseOrder(str(poId));
    return done
      ? { ok: true, message: "Draft discarded", href: "/orders" }
      : { ok: false, error: "Only drafts can be discarded" };
  });
}

/**
 * Reorder: replace the cart with these POs' items (packs x pack size), each from the same
 * supplier as before, so the next result shows savings against this order.
 */
export async function reorder(input: { poId?: string; runId?: string }): Promise<ActionResult> {
  return runBuyerAction(async ({ state, index, supplierIds }) => {
    let orders: PurchaseOrder[] = [];
    if (input.runId) {
      const list = await state.listPurchaseOrders({ runId: str(input.runId) });
      const loaded = await Promise.all(list.map((po) => state.getPurchaseOrder(po.id)));
      orders = loaded.filter((po): po is PurchaseOrder => po !== null);
    } else {
      const po = await state.getPurchaseOrder(str(input.poId));
      if (po) orders = [po];
    }
    if (!orders.length) return { ok: false, error: "That order no longer exists" };

    const lines = [];
    const skipped: string[] = [];
    for (const line of reorderLines(orders)) {
      const r = validateLine(index, supplierIds, line);
      if (r.ok) lines.push({ ...r.value, current_supplier_id: line.current_supplier_id });
      else skipped.push(index.products.get(line.product_id)?.name ?? line.product_id);
    }
    if (!lines.length) return { ok: false, error: "None of these items can be ordered anymore" };
    await state.setLines(lines, "replace");
    return {
      ok: true,
      href: "/cart",
      message: skipped.length
        ? `Cart replaced. Left out (no longer in the catalog): ${skipped.join(", ")}`
        : `Cart replaced with ${lines.length} item${lines.length === 1 ? "" : "s"}`,
    };
  });
}
