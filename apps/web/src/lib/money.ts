/** Money is integer cents everywhere. Format only at the edge, for display. */
const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

export function formatCents(cents: number): string {
  if (!Number.isInteger(cents)) throw new Error(`Expected integer cents, got ${cents}`);
  return usd.format(cents / 100);
}

const usdPrecise = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 3,
  maximumFractionDigits: 3,
});

/**
 * Display-only unit price (may be fractional cents). Under $1 we show three
 * decimals so a $0.0915 cup doesn't read as $0.09.
 */
export function formatUnitPrice(cents: number): string {
  return cents < 99.5 ? usdPrecise.format(cents / 100) : usd.format(Math.round(cents) / 100);
}
