/**
 * The tools Autopilot's agent can use. Each wraps code a buyer's own clicks already run
 * (stock plan, "Price this order", vendor quotes, Find My Best Price), scoped to the signed-in
 * org. Each returns facts for the agent (`forAgent`) and one plain line for the screen
 * (`detail`). Every number is computed here, never by the AI. Nothing creates a PO.
 */
import "server-only";

import type { BuyerStateRepository } from "../buyer-state/repository";
import { getRepository } from "../catalog/seed-repository";
import { formatDate } from "../delivery";
import { formatCents, formatUnitPrice } from "../money";
import { priceCart } from "../optimizer/price-cart";
import type { OptimizeResponse } from "../optimizer/types";
import type { Session } from "../session";
import { loadStock, suggestedCartLines } from "../stock/load";
import { UnitTable, unitShortLabel } from "../units";
import { localDay } from "../vendor-prices/parse";
import { latestQuotes } from "../vendor-prices/quotes";
import type { StepTool } from "./types";

export interface ToolOutcome {
  ok: boolean;
  forAgent: unknown;
  detail: string;
}

/** What the agent loop needs; a fake in tests. */
export interface Toolbox {
  checkStock(): Promise<ToolOutcome>;
  draftOrder(input: { delivery_date: string; remove_product_ids: string[] }): Promise<ToolOutcome>;
  checkVendorQuotes(): Promise<ToolOutcome>;
  priceOrder(): Promise<ToolOutcome>;
  /** Tools that have succeeded at least once. */
  readonly done: Set<StepTool>;
  /** The soonest bookable date, once stock was checked. */
  plannedDate(): string | null;
  /** The last successful pricing. */
  lastPriced(): { runId: string; response: OptimizeResponse; deliveryDate: string } | null;
  /** One sentence on a vendor quote that beats the catalog, for the scripted summary. */
  quoteHighlight(): string | null;
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const round1 = (n: number | null) => (n === null ? null : Math.round(n * 10) / 10);

export class AutopilotTools implements Toolbox {
  readonly done = new Set<StepTool>();
  private planned: string | null = null;
  private priced: { runId: string; response: OptimizeResponse; deliveryDate: string } | null = null;
  private highlight: string | null = null;

  constructor(private readonly session: Session & { state: BuyerStateRepository }) {}

  plannedDate() {
    return this.planned;
  }
  lastPriced() {
    return this.priced;
  }
  quoteHighlight() {
    return this.highlight;
  }

  private mark(tool: StepTool, outcome: ToolOutcome): ToolOutcome {
    if (outcome.ok) this.done.add(tool);
    return outcome;
  }

  async checkStock(): Promise<ToolOutcome> {
    const view = await loadStock(this.session);
    this.planned = view.deliveryDate;
    if (!view.deliveryDate) {
      return this.mark("check_stock", {
        ok: false,
        forAgent: { error: "No supplier can deliver in the next two weeks." },
        detail: "No delivery dates available in the next two weeks",
      });
    }
    const toOrder = view.rows.filter((r) => r.suggested > 0);
    const short = view.rows.filter((r) => r.status === "short");
    const unknown = view.rows.filter((r) => r.status === "unknown");
    return this.mark("check_stock", {
      ok: true,
      forAgent: {
        planned_for: view.deliveryDate,
        delivery_dates: view.dates.slice(0, 6).map((d) => ({
          date: d.date,
          label: formatDate(d.date, "long"),
          suppliers_delivering: d.available.length,
        })),
        to_order: toOrder.map((r) => ({
          product_id: r.productId,
          name: r.product.name,
          suggested: `${r.suggested} ${unitShortLabel(r.unit)}`,
          days_left: round1(r.daysLeft),
          runs_out_before_delivery: r.status === "short",
        })),
        never_counted: unknown.map((r) => r.product.name),
      },
      detail: toOrder.length
        ? `${short.length ? `${short.length} run out before ${formatDate(view.deliveryDate)} · ` : ""}${plural(toOrder.length, "item")} to order`
        : "Nothing needs ordering for the next delivery",
    });
  }

  async draftOrder(input: {
    delivery_date: string;
    remove_product_ids: string[];
  }): Promise<ToolOutcome> {
    const view = await loadStock(this.session, input.delivery_date);
    if (view.deliveryDate !== input.delivery_date) {
      return this.mark("draft_order", {
        ok: false,
        forAgent: {
          error: `${input.delivery_date} isn't a bookable delivery date.`,
          bookable: view.dates.slice(0, 6).map((d) => d.date),
        },
        detail: "That delivery date isn't bookable",
      });
    }
    const remove = new Set(input.remove_product_ids);
    const all = suggestedCartLines(view.rows);
    const lines = all.filter((l) => !remove.has(l.product_id));
    const removed = view.rows.filter((r) => r.suggested > 0 && remove.has(r.productId));
    if (lines.length === 0) {
      return this.mark("draft_order", {
        ok: false,
        forAgent: { error: "Nothing left to order for that date." },
        detail: "Nothing to order for that date",
      });
    }
    await this.session.state.setLines(lines, "replace");
    await this.session.state.setDeliveryDate(view.deliveryDate);
    const name = new Map(view.rows.map((r) => [r.productId, r.product.name]));
    return this.mark("draft_order", {
      ok: true,
      forAgent: {
        delivery_date: view.deliveryDate,
        lines: lines.map((l) => ({
          product_id: l.product_id,
          name: name.get(l.product_id),
          quantity: `${l.quantity} ${unitShortLabel(l.unit)}`,
        })),
        left_out: removed.map((r) => r.product.name),
      },
      detail: `${plural(lines.length, "item")} for ${formatDate(view.deliveryDate)}${
        removed.length ? ` · left out ${removed.map((r) => r.product.name).join(", ")}` : ""
      }. Your next order now holds it`,
    });
  }

  async checkVendorQuotes(): Promise<ToolOutcome> {
    const { state, buyer } = this.session;
    const repo = getRepository();
    const [cart, prices, offers, units, suppliers, source] = await Promise.all([
      state.getCart(),
      state.listVendorPrices(),
      repo.listOffersForBuyer(buyer.id),
      repo.units(),
      repo.listSuppliers(),
      repo.source(),
    ]);
    const table = new UnitTable(units);
    const zone = buyer.locations[0]!.zone;
    const serves = new Map(suppliers.map((s) => [s.id, s.servesZone(zone)]));
    const inCart = new Set(cart.lines.map((l) => l.product_id));
    const quotes = latestQuotes(prices, localDay(new Date()), source.priceMaxAgeHours / 24).filter(
      (q) => inCart.has(q.productId) && q.current,
    );

    const rows = quotes.flatMap((q) => {
      const catalog = offers.filter(
        (o) => o.product.id === q.productId && o.freshness.ok && serves.get(o.supplierId),
      );
      const product = catalog[0]?.product;
      if (!product) return [];
      const unit = product.default_unit;
      const per = (cents: number, qty: string, u: string) =>
        table.unitPriceCents(cents, Number(qty), u, unit);
      const best = Math.min(...catalog.map((o) => per(o.priceCents, o.pack.quantity, o.pack.unit)));
      const quote = per(q.priceCents, q.packQuantity, q.packUnit);
      return [
        {
          product: product.name,
          vendor: q.vendorName.replace(" (Demo)", ""),
          quote_per_unit: `${formatUnitPrice(quote)}/${unitShortLabel(unit)}`,
          best_catalog_per_unit: `${formatUnitPrice(best)}/${unitShortLabel(unit)}`,
          quote_vs_catalog_percent: Math.round(((quote - best) / best) * 100),
          quoted_on: q.quotedOn,
        },
      ];
    });
    const cheaper = rows
      .filter((r) => r.quote_vs_catalog_percent < 0)
      .sort((a, b) => a.quote_vs_catalog_percent - b.quote_vs_catalog_percent);
    this.highlight = cheaper[0]
      ? `Your ${cheaper[0].vendor} quote is ${-cheaper[0].quote_vs_catalog_percent}% under the best catalog price on ${cheaper[0].product}. The plan uses catalog prices, so check it with your rep.`
      : null;
    return this.mark("check_vendor_quotes", {
      ok: true,
      forAgent: {
        quotes: rows,
        note: "Pricing uses catalog prices only. Buyer quotes are for the buyer to weigh; mention one only if it beats the catalog.",
      },
      detail: rows.length
        ? cheaper[0]
          ? `${plural(rows.length, "quote")} on file · ${cheaper[0].vendor} is ${-cheaper[0].quote_vs_catalog_percent}% under catalog on ${cheaper[0].product}`
          : `${plural(rows.length, "quote")} on file, none under catalog prices`
        : "No current quotes for these items",
    });
  }

  async priceOrder(): Promise<ToolOutcome> {
    const priced = await priceCart(this.session);
    if (!priced.ok) {
      return this.mark("price_order", {
        ok: false,
        forAgent: { error: priced.error },
        detail: priced.error,
      });
    }
    const r = priced.response;
    const cart = await this.session.state.getCart();
    this.priced = { runId: priced.runId, response: r, deliveryDate: cart.deliveryDate! };
    const products = new Map((await getRepository().listProducts()).map((p) => [p.id, p.name]));
    const leftOut = r.problems
      .filter((p) => p.scope === "line" && p.product_id)
      .map((p) => ({
        product_id: p.product_id!,
        name: products.get(p.product_id!),
        why: p.message,
      }));
    const plan = r.recommendation;
    const savings =
      r.savings_cents && r.savings_cents > 0 ? ` · saves ${formatCents(r.savings_cents)}` : "";
    return this.mark("price_order", {
      ok: true,
      forAgent: {
        status: r.status,
        total: plan ? formatCents(plan.total_cents) : null,
        savings_vs_usual_suppliers:
          r.savings_cents === null || r.savings_cents === undefined
            ? null
            : formatCents(r.savings_cents),
        suppliers: (plan?.suppliers ?? []).map((s) => ({
          name: s.supplier_name.replace(" (Demo)", ""),
          items: formatCents(s.items_subtotal_cents),
          delivery_fee: s.fee_waived ? "waived" : formatCents(s.delivery_fee_cents),
          order_by: `${formatDate(s.order_by.date)} ${s.order_by.time}`,
        })),
        cannot_fill: leftOut,
        why: r.explanations.slice(0, 4),
      },
      detail: plan
        ? `${formatCents(plan.total_cents)} from ${plural(plan.suppliers.length, "supplier")}${savings}${
            leftOut.length ? ` · ${plural(leftOut.length, "item")} can't be filled` : ""
          }`
        : "No supplier can fill this order",
    });
  }
}
