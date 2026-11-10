/**
 * Which buyer-provided prices to show: per vendor, the lines from its most recent quote.
 * Older quotes stay saved (history) but a newer one replaces them on screen.
 *
 * Age is measured against the real calendar, not the demo catalog's fixed clock: a quote is
 * something the buyer received in real life. It uses the same 14-day rule as catalog prices.
 */
import { daysBetween, quotedOn } from "./parse";
import type { VendorPrice } from "./types";

export interface Quote extends VendorPrice {
  /** YYYY-MM-DD: the document's date, else the upload day. */
  quotedOn: string;
  ageDays: number;
  current: boolean;
}

export const vendorKey = (p: Pick<VendorPrice, "supplierId" | "vendorName">) =>
  p.supplierId ?? `name:${p.vendorName.trim().toLowerCase()}`;

export function latestQuotes(prices: VendorPrice[], today: string, maxAgeDays: number): Quote[] {
  const dated = prices.map((p) => {
    const on = quotedOn(p);
    const ageDays = Math.max(0, daysBetween(on, today));
    return { ...p, quotedOn: on, ageDays, current: ageDays <= maxAgeDays };
  });
  const newest = new Map<string, Quote>();
  for (const q of dated) {
    const best = newest.get(vendorKey(q));
    if (
      !best ||
      q.quotedOn > best.quotedOn ||
      (q.quotedOn === best.quotedOn && q.importedAt > best.importedAt)
    ) {
      newest.set(vendorKey(q), q);
    }
  }
  const keep = new Set([...newest.values()].map((q) => q.importId));
  return dated.filter((q) => keep.has(q.importId));
}
