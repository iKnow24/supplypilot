/**
 * When Home may start Autopilot by itself. It drafts into the buyer's next order, so it only
 * runs unprompted when that wouldn't throw away the buyer's own edits: the order is empty, or
 * still exactly what was last priced.
 */
export const AUTOPILOT_MANUAL_COOKIE = "sp_autopilot_manual";

type Line = { product_id: string; quantity: string; unit: string };

const key = (l: Line) => `${l.product_id}|${Number(l.quantity)}|${l.unit}`;

export function untouchedSinceLastPricing(cart: Line[], lastPriced: Line[] | null): boolean {
  if (cart.length === 0) return true;
  if (!lastPriced || lastPriced.length !== cart.length) return false;
  const priced = new Set(lastPriced.map(key));
  return cart.every((l) => priced.has(key(l)));
}
