/**
 * Weekly use from invoices, as plain arithmetic the buyer can check:
 *
 *   weekly use = everything a vendor's invoices show was bought ÷ the weeks those invoices cover
 *
 * where the weeks covered run from the vendor's first invoice to its last, counting both
 * (invoices on Oct 12, 19, 26 and Nov 2 cover 4 weeks). Bought from several vendors: the
 * rates add up. The buyer can overwrite the number on the review screen.
 */
import { addDays, isoWeekday } from "../delivery";
import { daysBetween } from "../vendor-prices/parse";

export const MAX_USAGE_WEEKS = 8;

/** Weeks a set of invoice dates covers, first to last inclusive (at least 1). */
export function weeksCovered(dates: string[]): number {
  if (dates.length === 0) return 1;
  const sorted = [...dates].sort();
  return Math.max(1, Math.round(daysBetween(sorted[0]!, sorted.at(-1)!) / 7) + 1);
}

/** The Monday of the week a date falls in. */
export function mondayOf(date: string): string {
  return addDays(date, 1 - isoWeekday(date));
}

export interface Purchase {
  vendorKey: string;
  date: string;
  /** In the item's unit. */
  quantity: number;
}

export interface WeeklyEstimate {
  weekly: number;
  /** "400 lb on 4 invoices over 4 weeks" */
  basis: string;
  /** Set when the estimate rests on thin evidence. */
  caution: string | null;
  /** Weeks the evidence covers (for the usage history written to Stock). */
  weeks: number;
}

/**
 * `invoiceDates`: every invoice date per vendor in the upload (so an item bought once in four
 * weeks of a vendor's invoices counts as a quarter of that a week).
 */
export function estimateWeekly(
  purchases: Purchase[],
  invoiceDates: Map<string, string[]>,
  unitLabel: string,
): WeeklyEstimate | null {
  if (purchases.length === 0) return null;
  const byVendor = new Map<string, Purchase[]>();
  for (const p of purchases) byVendor.set(p.vendorKey, [...(byVendor.get(p.vendorKey) ?? []), p]);

  let weekly = 0;
  let weeks = 1;
  for (const [vendor, ps] of byVendor) {
    const w = weeksCovered(invoiceDates.get(vendor) ?? ps.map((p) => p.date));
    weekly += ps.reduce((s, p) => s + p.quantity, 0) / w;
    weeks = Math.max(weeks, w);
  }
  const total = purchases.reduce((s, p) => s + p.quantity, 0);
  const invoices = new Set(purchases.map((p) => `${p.vendorKey}|${p.date}`)).size;
  const amount = `${trim(total)} ${unitLabel}`.trim();
  return {
    weekly,
    weeks: Math.min(weeks, MAX_USAGE_WEEKS),
    basis: `${amount} on ${invoices} ${invoices === 1 ? "invoice" : "invoices"} over ${weeks} ${weeks === 1 ? "week" : "weeks"}`,
    caution:
      weeks === 1 ? "From one week of invoices, so this assumes you order it every week" : null,
  };
}

/** Display rounding: whole numbers for counted things, else up to 1 decimal. */
export function roundUse(n: number, countUnit: boolean): string {
  if (countUnit) return String(Math.ceil(n - 1e-9));
  return trim(Math.round(n * 10) / 10);
}

const trim = (n: number) => String(Math.round(n * 1000) / 1000);
