/**
 * Which suppliers can deliver on each upcoming date, for the cart's date picker.
 * Display only: the optimizer re-checks eligibility authoritatively in M3.
 */
import type { DeliveryPolicy } from "../catalog/schema";
import { addDays, checkDelivery, localParts, type DeliveryCheck } from "../delivery";

export interface SupplierForDelivery {
  id: string;
  short_name: string;
  policy: DeliveryPolicy;
}

export interface DeliveryOption {
  date: string;
  /** Suppliers that can deliver this date and aren't excluded by the buyer. */
  available: string[];
  checks: { supplierId: string; check: DeliveryCheck; excluded: boolean }[];
}

export const DELIVERY_HORIZON_DAYS = 14;

export function deliveryOptions(
  suppliers: SupplierForDelivery[],
  zone: string,
  now: Date,
  timeZone: string,
  excluded: ReadonlySet<string> = new Set(),
  days = DELIVERY_HORIZON_DAYS,
): DeliveryOption[] {
  const today = localParts(now, timeZone).date;
  return Array.from({ length: days }, (_, i) => {
    const date = addDays(today, i);
    const checks = suppliers.map((s) => ({
      supplierId: s.id,
      check: checkDelivery(s.policy, zone, date, now, timeZone),
      excluded: excluded.has(s.id),
    }));
    return {
      date,
      checks,
      available: checks.filter((c) => c.check.ok && !c.excluded).map((c) => c.supplierId),
    };
  });
}

/** A stored delivery date is only usable if it's still in the bookable window. */
export function isBookableDate(date: string, options: DeliveryOption[]): boolean {
  return options.some((o) => o.date === date);
}
