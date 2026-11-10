/**
 * Everything the Stock page and its actions need, built on the server from the database and
 * the catalog. The suggested order is always recomputed here, never taken from the browser.
 */
import "server-only";

import type { BuyerStateRepository, CartLine } from "../buyer-state/repository";
import { deliveryOptions, type DeliveryOption } from "../cart/delivery-options";
import type { Product } from "../catalog/schema";
import { getRepository } from "../catalog/seed-repository";
import type { Session } from "../session";
import { UnitTable } from "../units";
import { isoWeekday, localParts, WEEKDAY_SHORT } from "../delivery";
import { daysBetween, planStock, type StockInput, type StockPlanLine } from "./plan";

export interface StockRow extends StockPlanLine {
  product: Product;
  /** Where the buyer usually buys it, from their saved lists (the savings baseline). */
  usualSupplierId: string | null;
  /** Weekly use, oldest first, in the planning unit (for the sparkline). */
  history: number[];
}

export interface StockView {
  rows: StockRow[];
  deliveryDate: string | null;
  /** Dates at least one supplier can deliver to this buyer. */
  dates: DeliveryOption[];
  now: Date;
  timeZone: string;
}

export async function loadStock(
  session: Session & { state: BuyerStateRepository },
  requestedDate?: string | null,
): Promise<StockView> {
  const repo = getRepository();
  const { state, buyer } = session;
  const [source, products, units, suppliers, counts, usage, lists] = await Promise.all([
    repo.source(),
    repo.listProducts(),
    repo.units(),
    repo.listSuppliers(),
    state.listStockCounts(),
    state.listStockUsage(),
    state.listSavedLists(),
  ]);
  const unitTable = new UnitTable(units);
  const productById = new Map(products.map((p) => [p.id, p]));

  const zone = buyer.locations[0]!.zone;
  const dates = deliveryOptions(suppliers, zone, source.now, source.timezone).filter(
    (o) => o.available.length > 0,
  );
  const bookable = (d: string | null | undefined) =>
    d && dates.some((o) => o.date === d) ? d : null;
  // Plan for the soonest delivery unless the buyer picks another (a cart's date may be stale).
  const deliveryDate = bookable(requestedDate) ?? dates[0]?.date ?? null;

  // Usual supplier and list order, from the buyer's saved lists.
  const usual = new Map<string, string | null>();
  const position = new Map<string, number>();
  for (const line of lists.flatMap((l) => l.lines)) {
    if (!usual.get(line.product_id)) usual.set(line.product_id, line.current_supplier_id);
    if (!position.has(line.product_id)) position.set(line.product_id, position.size);
  }

  // Plan in the unit usage is recorded in (else the count's unit).
  const usageBy = new Map<string, typeof usage>();
  for (const u of usage) usageBy.set(u.productId, [...(usageBy.get(u.productId) ?? []), u]);
  const countBy = new Map(counts.map((c) => [c.productId, c]));
  const ids = [...new Set([...usageBy.keys(), ...countBy.keys()])].filter((id) =>
    productById.has(id),
  );

  const inputs: (StockInput & { history: number[] })[] = ids.map((id) => {
    const weeks = usageBy.get(id) ?? [];
    const count = countBy.get(id) ?? null;
    const unit = weeks.at(-1)?.unit ?? count!.unit;
    const history = weeks.slice(-8).map((w) => unitTable.convert(Number(w.quantity), w.unit, unit));
    return {
      productId: id,
      unit,
      history,
      weeklyUsage: history,
      count: count
        ? {
            quantity: unitTable.convert(Number(count.quantity), count.unit, unit),
            countedAt: count.countedAt,
          }
        : null,
    };
  });

  const historyBy = new Map(inputs.map((i) => [i.productId, i.history]));
  const rows = deliveryDate
    ? planStock(inputs, { now: source.now, timeZone: source.timezone, deliveryDate })
    : [];

  return {
    rows: rows
      .map((line) => ({
        ...line,
        product: productById.get(line.productId)!,
        usualSupplierId: usual.get(line.productId) ?? null,
        history: historyBy.get(line.productId) ?? [],
      }))
      .sort(
        (a, b) =>
          rank(a) - rank(b) ||
          (position.get(a.productId) ?? 999) - (position.get(b.productId) ?? 999),
      ),
    deliveryDate,
    dates,
    now: source.now,
    timeZone: source.timezone,
  };
}

const rank = (r: StockPlanLine) => ({ short: 0, order: 1, unknown: 2, ok: 3 })[r.status];

/** The suggested order as Smart Cart lines. */
export function suggestedCartLines(rows: StockRow[]): CartLine[] {
  return rows
    .filter((r) => r.suggested > 0)
    .map((r) => ({
      product_id: r.productId,
      quantity: String(r.suggested),
      unit: r.unit,
      current_supplier_id: r.usualSupplierId,
    }));
}

/** "0", "12", "2.5": a shelf count may be zero, unlike an order quantity. */
export function parseCount(
  input: string,
): { ok: true; value: string } | { ok: false; error: string } {
  const raw = input.trim().replace(/,(?=\d{3}(\D|$))/g, "");
  if (raw === "") return { ok: false, error: "Enter how many you have" };
  if (!/^\d+(\.\d{1,3})?$/.test(raw)) {
    return { ok: false, error: "Use a number like 12 or 2.5 (up to 3 decimals)" };
  }
  const n = Number(raw);
  if (n > 100_000) return { ok: false, error: "That's more than 100,000" };
  return { ok: true, value: String(n) };
}

/** Where the planned delivery sits on a level slider. */
export function deliveryMark(view: StockView): { inDays: number; label: string } | null {
  if (!view.deliveryDate) return null;
  const today = localParts(view.now, view.timeZone).date;
  return {
    inDays: daysBetween(today, view.deliveryDate),
    label: WEEKDAY_SHORT[isoWeekday(view.deliveryDate)]!,
  };
}
