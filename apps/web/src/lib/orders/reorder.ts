/**
 * "Reorder": a PO back into cart lines. Quantity = packs x pack size in the pack's unit
 * (exact decimal math, no floats), and the PO's supplier becomes the line's usual supplier,
 * so the next result can show savings against this order.
 */
import type { CartLine } from "../buyer-state/repository";
import type { PurchaseOrder } from "./types";

/** packs * "12.5" -> "37.5" without floating point. */
export function multiplyDecimal(packs: number, quantity: string): string {
  if (!Number.isInteger(packs) || packs < 0) throw new Error(`Bad pack count ${packs}`);
  const [whole = "0", frac = ""] = quantity.split(".");
  const scaled = BigInt(whole + frac) * BigInt(packs);
  if (!frac) return scaled.toString();
  const digits = scaled.toString().padStart(frac.length + 1, "0");
  const int = digits.slice(0, -frac.length);
  const dec = digits.slice(-frac.length).replace(/0+$/, "");
  return dec ? `${int}.${dec}` : int;
}

export function reorderLines(orders: PurchaseOrder[]): CartLine[] {
  const byProduct = new Map<string, CartLine>();
  for (const po of orders) {
    for (const l of po.lines) {
      if (byProduct.has(l.product_id)) continue; // a product appears once per cart
      byProduct.set(l.product_id, {
        product_id: l.product_id,
        quantity: multiplyDecimal(l.packs, l.pack_quantity),
        unit: l.pack_unit,
        current_supplier_id: po.supplier_id,
      });
    }
  }
  return [...byProduct.values()];
}
