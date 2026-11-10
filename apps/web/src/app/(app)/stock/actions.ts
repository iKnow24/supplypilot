"use server";

/**
 * Stock mutations. Like every buyer action: scoped to the signed-in org, re-validated on the
 * server, and the suggested order is recomputed here rather than read from the form.
 */
import { redirect } from "next/navigation";

import { runBuyerAction, str, type ActionResult } from "@/lib/actions/run";
import { loadStock, parseCount, suggestedCartLines } from "@/lib/stock/load";

export async function recordStockCount(productId: string, quantity: string): Promise<ActionResult> {
  return runBuyerAction(async ({ index, state, session }) => {
    const product = index.products.get(str(productId));
    if (!product) return { ok: false, error: "Unknown product" };
    const view = await loadStock({ ...session, state });
    const row = view.rows.find((r) => r.productId === product.id);
    if (!row) return { ok: false, error: `${product.name} isn't tracked yet` };
    const parsed = parseCount(str(quantity));
    if (!parsed.ok) return parsed;
    const unit = index.units.get(row.unit);
    const base = Number(parsed.value) * Number(unit?.to_base ?? 1);
    if (unit?.dimension === "count" && Math.abs(base - Math.round(base)) > 1e-9) {
      return { ok: false, error: "Count whole items" };
    }
    await state.recordStockCounts([
      { product_id: product.id, quantity: parsed.value, unit: row.unit },
    ]);
    return { ok: true, message: `Count saved for ${product.name}` };
  });
}

/** Form action (works without JS): replace the cart with this week's suggested order. */
export async function startSuggestedOrder(formData: FormData) {
  const date = str(formData.get("deliveryDate"));
  const result = await runBuyerAction(async ({ state, session }) => {
    const view = await loadStock({ ...session, state }, date);
    if (!view.deliveryDate || view.deliveryDate !== date) {
      return { ok: false, error: "That delivery date is no longer bookable. Pick another." };
    }
    const lines = suggestedCartLines(view.rows);
    if (lines.length === 0) return { ok: false, error: "Nothing needs ordering for that date" };
    await state.setLines(lines, "replace");
    await state.setDeliveryDate(view.deliveryDate);
  });
  redirect(
    result.ok
      ? "/cart?from=stock"
      : `/stock?for=${encodeURIComponent(date)}&error=${encodeURIComponent(result.error)}`,
  );
}

/** Form action: add one item's suggested amount to the cart (merging), then open the cart. */
export async function addSuggestedItem(formData: FormData) {
  const productId = str(formData.get("productId"));
  const result = await runBuyerAction(async ({ state, session }) => {
    const view = await loadStock({ ...session, state });
    const line = suggestedCartLines(view.rows).find((l) => l.product_id === productId);
    if (!line) return { ok: false, error: "Nothing to order for that item right now" };
    await state.setLines([line], "merge");
  });
  redirect(
    result.ok
      ? "/cart"
      : `/stock/${encodeURIComponent(productId)}?error=${encodeURIComponent(result.error)}`,
  );
}
