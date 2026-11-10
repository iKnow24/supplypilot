/**
 * The plan card's data: the agent's headline and notes, plus every number read back from the
 * stored Find My Best Price result (never from the agent's text).
 */
import "server-only";

import type { AutopilotRunRecord, BuyerStateRepository } from "../buyer-state/repository";
import { getRepository } from "../catalog/seed-repository";
import type { AutopilotPlan } from "./types";

export async function loadAutopilotPlan(
  state: BuyerStateRepository,
  record: AutopilotRunRecord,
): Promise<AutopilotPlan> {
  const [run, products, pos] = await Promise.all([
    record.optimizationRunId ? state.getRun(record.optimizationRunId) : null,
    getRepository().listProducts(),
    record.optimizationRunId
      ? state.listPurchaseOrders({ runId: record.optimizationRunId })
      : Promise.resolve([]),
  ]);
  const name = new Map(products.map((p) => [p.id, p.name]));
  const plan = run?.response.recommendation ?? null;
  return {
    autopilotId: record.id,
    usedAi: record.usedAi,
    runId: run?.id ?? null,
    deliveryDate: run?.deliveryDate ?? record.deliveryDate,
    status: run?.status ?? null,
    headline: record.headline ?? (record.error ? "Autopilot couldn't finish" : "Plan ready"),
    notes: record.error ? [record.error, ...record.notes] : record.notes,
    totalCents: plan?.total_cents ?? null,
    savingsCents: run?.response.savings_cents ?? null,
    suppliers: (plan?.suppliers ?? []).map((s) => ({
      id: s.supplier_id,
      name: s.supplier_name.replace(" (Demo)", ""),
      totalCents: s.items_subtotal_cents + s.delivery_fee_cents,
      itemCount: s.allocations.length,
    })),
    itemCount: run?.lineCount ?? 0,
    leftOut: (run?.response.problems ?? [])
      .filter((p) => p.scope === "line" && p.product_id)
      .map((p) => name.get(p.product_id!) ?? p.product_id!),
    purchaseOrderCount: pos.length,
    createdAt: record.createdAt.toISOString(),
  };
}

/** The last plan, while it's recent and for the delivery being planned now. */
export async function currentAutopilotPlan(
  state: BuyerStateRepository,
  record: AutopilotRunRecord | null,
  deliveryDate: string | null,
): Promise<AutopilotPlan | null> {
  if (
    !record ||
    record.status !== "planned" ||
    !record.optimizationRunId ||
    record.deliveryDate !== deliveryDate ||
    Date.now() - record.createdAt.getTime() > 12 * 3_600_000
  ) {
    return null;
  }
  return loadAutopilotPlan(state, record);
}
