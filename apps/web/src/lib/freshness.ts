/**
 * Freshness policy (documented in docs/architecture.md):
 *  - A price older than `priceMaxAgeHours` is STALE: excluded from optimization and flagged.
 *  - A stock snapshot older than `inventoryMaxAgeHours` is STALE: excluded and flagged.
 *  - An offer with no stock snapshot is MISSING: excluded and flagged.
 * We never guess a price or assume stock.
 */
export type FreshnessStatus =
  | { ok: true }
  | { ok: false; reasons: ("stale_price" | "stale_inventory" | "missing_inventory")[] };

const HOUR = 3_600_000;

export function assessFreshness(input: {
  now: Date;
  priceUpdatedAt: Date;
  inventoryAsOf: Date | null;
  priceMaxAgeHours: number;
  inventoryMaxAgeHours: number;
}): FreshnessStatus {
  const reasons: ("stale_price" | "stale_inventory" | "missing_inventory")[] = [];
  if (input.now.getTime() - input.priceUpdatedAt.getTime() > input.priceMaxAgeHours * HOUR) {
    reasons.push("stale_price");
  }
  if (input.inventoryAsOf === null) {
    reasons.push("missing_inventory");
  } else if (
    input.now.getTime() - input.inventoryAsOf.getTime() >
    input.inventoryMaxAgeHours * HOUR
  ) {
    reasons.push("stale_inventory");
  }
  return reasons.length ? { ok: false, reasons } : { ok: true };
}

export const FRESHNESS_LABEL: Record<
  "stale_price" | "stale_inventory" | "missing_inventory",
  string
> = {
  stale_price: "Price out of date",
  stale_inventory: "Stock count out of date",
  missing_inventory: "No stock count",
};

/** "3 days ago", "5 hours ago" relative to the data source clock. */
export function formatAge(from: Date, now: Date): string {
  const hours = Math.max(0, Math.floor((now.getTime() - from.getTime()) / HOUR));
  if (hours < 1) return "just now";
  if (hours < 48) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  return `${days} days ago`;
}
