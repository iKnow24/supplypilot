/**
 * Exact money and date parsing for buyer-provided prices. Money is integer cents; decimal
 * strings are scaled to BigInt so "$0.895/lb x 50 lb" never drifts through floating point.
 */

export const MAX_PACK_PRICE_CENTS = 10_000_000; // $100,000 a pack: anything above is a misread
export const TIMEZONE = "America/New_York";

type Scaled = { n: bigint; places: number };

function scaled(input: string, maxPlaces: number): Scaled | null {
  const raw = input
    .trim()
    .replace(/^\$\s*/, "")
    .replace(/,(?=\d{3}(\D|$))/g, "");
  if (!/^\d+(\.\d+)?$|^\.\d+$/.test(raw)) return null;
  const [whole = "", frac = ""] = raw.split(".");
  if (frac.length > maxPlaces) return null;
  return { n: BigInt((whole || "0") + frac), places: frac.length };
}

/** Rounds n / 10^places to the nearest integer, halves up (n >= 0). */
function roundScaled(n: bigint, places: number): bigint {
  const d = BigInt(10) ** BigInt(places);
  return (n * BigInt(2) + d) / (d * BigInt(2));
}

/** "$26.89" -> 2689. Rejects negatives, text, more than 2 decimals, zero and absurd prices. */
export function parseDollars(input: string): number | null {
  const s = scaled(input, 2);
  if (!s) return null;
  const cents = Number(s.n * BigInt(10) ** BigInt(2 - s.places));
  return cents > 0 && cents <= MAX_PACK_PRICE_CENTS ? cents : null;
}

/** Pack price from a per-unit price: "0.895" ($/lb) x "50" (lb) -> 4475 cents. */
export function packCentsFromUnitPrice(unitPrice: string, packQuantity: string): number | null {
  const p = scaled(unitPrice, 4);
  const q = scaled(packQuantity, 3);
  if (!p || !q) return null;
  const cents = Number(roundScaled(p.n * q.n * BigInt(100), p.places + q.places));
  return cents > 0 && cents <= MAX_PACK_PRICE_CENTS ? cents : null;
}

/** 2689 -> "26.89" (for editable inputs). */
export function centsToInput(cents: number): string {
  return (cents / 100).toFixed(2);
}

/** A real calendar date written as YYYY-MM-DD. */
export function isIsoDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T12:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

/** The calendar day of an instant in Orlando. */
export function localDay(at: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(at);
}

/** Whole days from `from` to `to` (YYYY-MM-DD). */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86_400_000);
}

/** The day a quote is dated by: the document's date if known, else the day it was uploaded. */
export function quotedOn(p: { documentDate: string | null; importedAt: Date }): string {
  return p.documentDate ?? localDay(p.importedAt);
}
