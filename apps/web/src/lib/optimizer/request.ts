import type { Cart } from "../buyer-state/repository";
import type { OptimizeRequest } from "./types";

/**
 * The optimizer request for a saved cart. Built on the server from the database, never from
 * what the browser sends. The baseline is the buyer's habit (each line's usual supplier);
 * if some lines have none, the optimizer says the baseline can't be priced.
 */
export function buildOptimizeRequest(input: {
  buyerId: string;
  zone: string;
  cart: Cart;
}): OptimizeRequest {
  const { cart } = input;
  if (!cart.deliveryDate) throw new Error("Cart has no delivery date");
  const habit = cart.lines.filter((l) => l.current_supplier_id);
  return {
    buyer_id: input.buyerId,
    zone: input.zone,
    delivery_date: cart.deliveryDate,
    lines: cart.lines.map((l) => ({
      product_id: l.product_id,
      quantity: l.quantity,
      unit: l.unit,
    })),
    preferences: {
      excluded_supplier_ids: cart.excludedSupplierIds,
      preferred_supplier_ids: cart.preferredSupplierIds,
      allow_equivalences: true,
    },
    baseline: habit.length
      ? {
          lines: habit.map((l) => ({
            product_id: l.product_id,
            supplier_id: l.current_supplier_id!,
          })),
        }
      : null,
  };
}
