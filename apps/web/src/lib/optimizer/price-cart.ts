/**
 * Price the saved cart with the optimizer and keep the result. Shared by "Find My Best Price"
 * and Autopilot, so both price exactly the same way. Everything comes from the database
 * (cart, buyer, preferences), never from the browser or the AI. Infeasible answers are saved
 * too: "why can't I get this?" is a result worth keeping.
 */
import "server-only";

import type { BuyerStateRepository } from "../buyer-state/repository";
import { deliveryOptions, isBookableDate } from "../cart/delivery-options";
import { getRepository } from "../catalog/seed-repository";
import type { Session } from "../session";
import { OptimizerError, callOptimizer } from "./client";
import { buildOptimizeRequest } from "./request";
import type { OptimizeResponse } from "./types";

export type PriceCartResult =
  { ok: true; runId: string; response: OptimizeResponse } | { ok: false; error: string };

export async function priceCart(
  session: Session & { state: BuyerStateRepository },
): Promise<PriceCartResult> {
  const { state, buyer } = session;
  const cart = await state.getCart();
  if (cart.lines.length === 0) return { ok: false, error: "Add something to your cart first" };
  if (!cart.deliveryDate) return { ok: false, error: "Pick a delivery date first" };

  const repo = getRepository();
  const [source, suppliers] = await Promise.all([repo.source(), repo.listSuppliers()]);
  const zone = buyer.locations[0]!.zone;
  const options = deliveryOptions(suppliers, zone, source.now, source.timezone);
  if (!isBookableDate(cart.deliveryDate, options)) {
    return { ok: false, error: "Your delivery date is no longer bookable. Pick a new one." };
  }

  const request = buildOptimizeRequest({ buyerId: buyer.id, zone, cart });
  let response: OptimizeResponse;
  try {
    response = await callOptimizer(request);
  } catch (e) {
    if (e instanceof OptimizerError) return { ok: false, error: e.message };
    throw e;
  }
  const runId = await state.saveRun(request, response);
  return { ok: true, runId, response };
}
