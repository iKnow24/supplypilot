/**
 * Stock planning: what's on hand, how fast it's used, and what to order for a delivery.
 *
 * Pure and deterministic (no I/O), so every number on the Stock page can be explained and
 * tested. Quantities are plain numbers in the item's planning unit; the Smart Cart and the
 * optimizer take it from there (packs, prices, suppliers).
 *
 * The rule, in words:
 *   burn rate   = average use over the last 4 weeks
 *   on hand now = last count, minus what the burn rate says was used since the count
 *   suggested   = enough to last from now until the delivery, then COVER_DAYS more,
 *                 plus BUFFER_DAYS of safety stock, minus what's on hand (rounded up)
 */
import { addDays, localParts } from "../delivery";

export const COVER_DAYS = 7;
export const BUFFER_DAYS = 2;
const BURN_WEEKS = 4;
const DAY_MS = 86_400_000;

export interface StockInput {
  productId: string;
  /** Unit every quantity below is expressed in. */
  unit: string;
  count: { quantity: number; countedAt: Date } | null;
  /** Weekly use, oldest first. */
  weeklyUsage: number[];
}

export type StockStatus =
  /** Will run out before the delivery arrives. */
  | "short"
  /** Needs topping up with this delivery. */
  | "order"
  /** Enough on hand to skip this delivery. */
  | "ok"
  /** Never counted, or no usage history: can't plan it yet. */
  | "unknown";

export interface StockPlanLine {
  productId: string;
  unit: string;
  count: { quantity: number; countedAt: Date } | null;
  /** Estimated on hand right now. Null when never counted. */
  onHand: number | null;
  /** Average use per week. */
  weekly: number;
  /** Change of the last 4 weeks against the 4 before, e.g. 0.12 = up 12%. */
  trend: number | null;
  /** Local date it runs out at the current burn rate; null if unknown or not used. */
  runsOutOn: string | null;
  /** Expected on hand when the delivery arrives (negative = a shortfall). */
  atDelivery: number | null;
  /** Amount to order, rounded up to a whole unit. 0 = skip. */
  suggested: number;
  status: StockStatus;
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

/** Whole calendar days between two YYYY-MM-DD dates. */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS);
}

export function planLine(
  input: StockInput,
  opts: { now: Date; timeZone: string; deliveryDate: string },
): StockPlanLine {
  const recent = input.weeklyUsage.slice(-BURN_WEEKS);
  const prior = input.weeklyUsage.slice(-2 * BURN_WEEKS, -BURN_WEEKS);
  const weekly = mean(recent);
  const daily = weekly / 7;
  const trend =
    prior.length === BURN_WEEKS && mean(prior) > 0 ? mean(recent) / mean(prior) - 1 : null;

  const base = {
    productId: input.productId,
    unit: input.unit,
    count: input.count,
    weekly,
    trend,
  };
  if (!input.count || input.weeklyUsage.length === 0) {
    return {
      ...base,
      onHand: input.count?.quantity ?? null,
      runsOutOn: null,
      atDelivery: null,
      suggested: 0,
      status: "unknown",
    };
  }

  const today = localParts(opts.now, opts.timeZone).date;
  const sinceCount = Math.max(0, (opts.now.getTime() - input.count.countedAt.getTime()) / DAY_MS);
  const onHand = Math.max(0, input.count.quantity - daily * sinceCount);
  const daysToDelivery = Math.max(0, daysBetween(today, opts.deliveryDate));
  const atDelivery = onHand - daily * daysToDelivery;
  const need = daily * (daysToDelivery + COVER_DAYS + BUFFER_DAYS) - onHand;
  // Tiny float noise must not turn "exactly enough" into an order of 1.
  const suggested = need > 1e-9 ? Math.ceil(need - 1e-9) : 0;

  return {
    ...base,
    onHand,
    runsOutOn: daily > 0 ? addDays(today, Math.floor(onHand / daily)) : null,
    atDelivery,
    suggested,
    status: atDelivery < 0 ? "short" : suggested > 0 ? "order" : "ok",
  };
}

const STATUS_ORDER: Record<StockStatus, number> = { short: 0, order: 1, unknown: 2, ok: 3 };

/** Plan every item, most urgent first (then by how soon it runs out). */
export function planStock(
  inputs: StockInput[],
  opts: { now: Date; timeZone: string; deliveryDate: string },
): StockPlanLine[] {
  return inputs
    .map((i) => planLine(i, opts))
    .sort(
      (a, b) =>
        STATUS_ORDER[a.status] - STATUS_ORDER[b.status] ||
        (a.runsOutOn ?? "9999").localeCompare(b.runsOutOn ?? "9999"),
    );
}
