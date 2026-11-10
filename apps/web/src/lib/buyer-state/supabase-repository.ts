import type { PostgrestError } from "@supabase/supabase-js";

import type { Json } from "../db/database.types";
import type { OptimizeRequest, OptimizeResponse } from "../optimizer/types";
import type {
  DeliverTo,
  PurchaseOrder,
  PurchaseOrderDraft,
  PurchaseOrderLineDraft,
  PurchaseOrderSummary,
} from "../orders/types";
import type { DbClient } from "../supabase/server";
import {
  DOCUMENT_KINDS,
  type DocumentKind,
  type PriceImportInput,
  type PriceImportSummary,
  type VendorPrice,
} from "../vendor-prices/types";
import {
  type AutopilotOutcome,
  type AutopilotRunRecord,
  BuyerStateError,
  type BuyerStateRepository,
  type Cart,
  type CartLine,
  type OptimizationRun,
  type OptimizationRunSummary,
  type SavedList,
  type StockCount,
  type StockUsageWeek,
} from "./repository";

const RUN_SUMMARY_COLUMNS =
  "id, created_at, delivery_date, status, total_cents, savings_cents, supplier_count, line_count";

type RunSummaryRow = {
  id: string;
  created_at: string;
  delivery_date: string;
  status: string;
  total_cents: number | null;
  savings_cents: number | null;
  supplier_count: number | null;
  line_count: number;
};

const PO_COLUMNS =
  "id, run_id, number, supplier_id, supplier_name, status, delivery_date, order_by_date, order_by_time, items_subtotal_cents, delivery_fee_cents, total_cents, created_at, exported_at";

type PoRow = {
  id: string;
  run_id: string;
  number: string;
  supplier_id: string;
  supplier_name: string;
  status: string;
  delivery_date: string;
  order_by_date: string;
  order_by_time: string;
  items_subtotal_cents: number;
  delivery_fee_cents: number;
  total_cents: number;
  created_at: string;
  exported_at: string | null;
};

function toPoSummary(r: PoRow, lineCount: number): PurchaseOrderSummary {
  return {
    id: r.id,
    runId: r.run_id,
    number: r.number,
    supplier_id: r.supplier_id,
    supplier_name: r.supplier_name,
    status: r.status === "exported" ? "exported" : "draft",
    delivery_date: r.delivery_date,
    order_by_date: r.order_by_date,
    order_by_time: r.order_by_time,
    items_subtotal_cents: r.items_subtotal_cents,
    delivery_fee_cents: r.delivery_fee_cents,
    total_cents: r.total_cents,
    createdAt: new Date(r.created_at),
    exportedAt: r.exported_at ? new Date(r.exported_at) : null,
    lineCount,
  };
}

const UUID = /^[0-9a-f-]{36}$/i;

const toKind = (k: string): DocumentKind => DOCUMENT_KINDS.find((x) => x === k) ?? "other";

function toRunSummary(r: RunSummaryRow): OptimizationRunSummary {
  return {
    id: r.id,
    createdAt: new Date(r.created_at),
    deliveryDate: r.delivery_date,
    status: r.status === "optimal" || r.status === "partial" ? r.status : "infeasible",
    totalCents: r.total_cents,
    savingsCents: r.savings_cents,
    supplierCount: r.supplier_count,
    lineCount: r.line_count,
  };
}

type LineRow = {
  product_id: string;
  quantity: number;
  unit: string;
  current_supplier_id: string | null;
};

const LINE_COLUMNS = "product_id, quantity, unit, current_supplier_id";

function toLine(r: LineRow): CartLine {
  return {
    product_id: r.product_id,
    // numeric(12,3) arrives as a JSON number with at most 3 decimals; String() is exact here.
    quantity: String(r.quantity),
    unit: r.unit,
    current_supplier_id: r.current_supplier_id,
  };
}

/** Translate Postgres errors into messages a buyer can act on. */
function fail(error: PostgrestError, context: string): never {
  switch (error.code) {
    case "23505":
      throw new BuyerStateError("You already have a list with that name", error.code);
    case "42501":
      throw new BuyerStateError("You don't have access to that", error.code);
    case "P0002":
      throw new BuyerStateError("That list no longer exists", error.code);
    case "23514":
      throw new BuyerStateError("That value isn't allowed", error.code);
    default:
      throw new BuyerStateError(`Couldn't ${context}. Please try again.`, error.code);
  }
}

export class SupabaseBuyerStateRepository implements BuyerStateRepository {
  constructor(
    private readonly db: DbClient,
    readonly orgId: string,
  ) {}

  async getCart(): Promise<Cart> {
    const { data: cart, error } = await this.db.rpc("ensure_cart", { p_org: this.orgId });
    if (error) fail(error, "load your cart");
    const { data: lines, error: linesError } = await this.db
      .from("cart_lines")
      .select(LINE_COLUMNS)
      .eq("cart_id", cart.id)
      .order("position")
      .order("created_at");
    if (linesError) fail(linesError, "load your cart");
    return {
      id: cart.id,
      deliveryDate: cart.delivery_date,
      sourceListId: cart.source_list_id,
      preferredSupplierIds: cart.preferred_supplier_ids,
      excludedSupplierIds: cart.excluded_supplier_ids,
      lines: lines.map(toLine),
    };
  }

  async addLine(line: CartLine) {
    const { data, error } = await this.db.rpc("add_cart_line", {
      p_org: this.orgId,
      p_product_id: line.product_id,
      p_quantity: Number(line.quantity),
      p_unit: line.unit,
      ...(line.current_supplier_id ? { p_current_supplier_id: line.current_supplier_id } : {}),
    });
    if (error) fail(error, "add that item");
    return data;
  }

  async updateLine(productId: string, amount: { quantity: string; unit: string }) {
    const { error } = await this.db
      .from("cart_lines")
      .update({ quantity: Number(amount.quantity), unit: amount.unit })
      .eq("org_id", this.orgId)
      .eq("product_id", productId);
    if (error) fail(error, "update that item");
  }

  async removeLine(productId: string) {
    const { error } = await this.db
      .from("cart_lines")
      .delete()
      .eq("org_id", this.orgId)
      .eq("product_id", productId);
    if (error) fail(error, "remove that item");
  }

  async setLines(lines: CartLine[], mode: "replace" | "merge") {
    const { error } = await this.db.rpc("set_cart_lines", {
      p_org: this.orgId,
      p_lines: lines.map((l) => ({ ...l, quantity: Number(l.quantity) })),
      p_mode: mode,
    });
    if (error) fail(error, "update your cart");
  }

  private async updateCart(patch: {
    delivery_date?: string | null;
    preferred_supplier_ids?: string[];
    excluded_supplier_ids?: string[];
  }) {
    const { error: ensureError } = await this.db.rpc("ensure_cart", { p_org: this.orgId });
    if (ensureError) fail(ensureError, "update your cart");
    const { error } = await this.db.from("carts").update(patch).eq("org_id", this.orgId);
    if (error) fail(error, "update your cart");
  }

  setDeliveryDate(date: string | null) {
    return this.updateCart({ delivery_date: date });
  }

  setSupplierPreferences(prefs: { preferred: string[]; excluded: string[] }) {
    return this.updateCart({
      preferred_supplier_ids: prefs.preferred,
      excluded_supplier_ids: prefs.excluded,
    });
  }

  async listSavedLists(): Promise<SavedList[]> {
    const { data, error } = await this.db
      .from("saved_lists")
      .select(`id, name, updated_at, saved_list_lines (${LINE_COLUMNS}, position)`)
      .eq("org_id", this.orgId)
      .order("updated_at", { ascending: false })
      .order("position", { referencedTable: "saved_list_lines" });
    if (error) fail(error, "load your saved lists");
    return data.map((l) => ({
      id: l.id,
      name: l.name,
      updatedAt: new Date(l.updated_at),
      lines: l.saved_list_lines.map(toLine),
    }));
  }

  async loadList(listId: string) {
    const { error } = await this.db.rpc("load_list_into_cart", {
      p_org: this.orgId,
      p_list_id: listId,
    });
    if (error) fail(error, "load that list");
  }

  async saveCartAsList(name: string) {
    const { data, error } = await this.db.rpc("save_cart_as_list", {
      p_org: this.orgId,
      p_name: name,
    });
    if (error) {
      if (error.code === "22023") throw new BuyerStateError("Your cart is empty", error.code);
      fail(error, "save the list");
    }
    return data;
  }

  async duplicateList(listId: string, name: string) {
    const { data, error } = await this.db.rpc("duplicate_list", {
      p_org: this.orgId,
      p_list_id: listId,
      p_name: name,
    });
    if (error) fail(error, "duplicate the list");
    return data;
  }

  async renameList(listId: string, name: string) {
    const { data, error } = await this.db
      .from("saved_lists")
      .update({ name })
      .eq("org_id", this.orgId)
      .eq("id", listId)
      .select("id");
    if (error) fail(error, "rename the list");
    if (!data.length) throw new BuyerStateError("That list no longer exists");
  }

  async deleteList(listId: string) {
    const { error } = await this.db
      .from("saved_lists")
      .delete()
      .eq("org_id", this.orgId)
      .eq("id", listId);
    if (error) fail(error, "delete the list");
  }

  async listFavorites() {
    const { data, error } = await this.db
      .from("favorites")
      .select("product_id")
      .eq("org_id", this.orgId)
      .order("created_at");
    if (error) fail(error, "load favorites");
    return data.map((f) => f.product_id);
  }

  async listStockCounts(): Promise<StockCount[]> {
    const { data, error } = await this.db
      .from("stock_counts")
      .select("product_id, quantity, unit, counted_at")
      .eq("org_id", this.orgId)
      .order("counted_at", { ascending: false })
      .order("id")
      .limit(2000);
    if (error) fail(error, "load your stock counts");
    const latest = new Map<string, StockCount>();
    for (const r of data) {
      if (latest.has(r.product_id)) continue;
      latest.set(r.product_id, {
        productId: r.product_id,
        quantity: String(r.quantity),
        unit: r.unit,
        countedAt: new Date(r.counted_at),
      });
    }
    return [...latest.values()];
  }

  async listStockUsage(): Promise<StockUsageWeek[]> {
    const { data, error } = await this.db
      .from("stock_usage")
      .select("product_id, week_start, quantity, unit")
      .eq("org_id", this.orgId)
      .order("week_start")
      .limit(5000);
    if (error) fail(error, "load your usage history");
    return data.map((r) => ({
      productId: r.product_id,
      weekStart: r.week_start,
      quantity: String(r.quantity),
      unit: r.unit,
    }));
  }

  async recordStockCounts(counts: { product_id: string; quantity: string; unit: string }[]) {
    if (counts.length === 0) return;
    const { error } = await this.db.from("stock_counts").insert(
      counts.map((c) => ({
        org_id: this.orgId,
        product_id: c.product_id,
        quantity: Number(c.quantity),
        unit: c.unit,
      })),
    );
    if (error) fail(error, "save your count");
  }

  async resetDemo() {
    const { error } = await this.db.rpc("reset_demo_org", { p_org: this.orgId });
    if (error) fail(error, "reset the demo");
  }

  async setFavorite(productId: string, favorite: boolean) {
    const { error } = favorite
      ? await this.db
          .from("favorites")
          .upsert({ org_id: this.orgId, product_id: productId }, { ignoreDuplicates: true })
      : await this.db
          .from("favorites")
          .delete()
          .eq("org_id", this.orgId)
          .eq("product_id", productId);
    if (error) fail(error, "update favorites");
  }

  async saveRun(request: OptimizeRequest, response: OptimizeResponse) {
    const plan = response.recommendation;
    const { data, error } = await this.db
      .from("optimization_runs")
      .insert({
        org_id: this.orgId,
        delivery_date: request.delivery_date,
        status: response.status,
        total_cents: plan?.total_cents ?? null,
        savings_cents: response.savings_cents ?? null,
        supplier_count: plan?.supplier_count ?? null,
        line_count: request.lines.length,
        request: request as unknown as NonNullable<Json>,
        response: response as unknown as NonNullable<Json>,
      })
      .select("id")
      .single();
    if (error) fail(error, "save the result");
    return data.id;
  }

  async getRun(id: string): Promise<OptimizationRun | null> {
    if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
    const { data, error } = await this.db
      .from("optimization_runs")
      .select(`${RUN_SUMMARY_COLUMNS}, request, response`)
      .eq("org_id", this.orgId)
      .eq("id", id)
      .maybeSingle();
    if (error) fail(error, "load that result");
    if (!data) return null;
    return {
      ...toRunSummary(data),
      request: data.request as unknown as OptimizeRequest,
      response: data.response as unknown as OptimizeResponse,
    };
  }

  async listRuns(limit = 20) {
    const { data, error } = await this.db
      .from("optimization_runs")
      .select(RUN_SUMMARY_COLUMNS)
      .eq("org_id", this.orgId)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) fail(error, "load past results");
    return data.map(toRunSummary);
  }

  async createPurchaseOrders(runId: string, drafts: PurchaseOrderDraft[]) {
    const { data, error } = await this.db.rpc("create_purchase_orders", {
      p_org: this.orgId,
      p_run: runId,
      p_orders: drafts as unknown as NonNullable<Json>,
    });
    if (error) {
      if (error.code === "P0002")
        throw new BuyerStateError("That result has no plan to order from");
      fail(error, "create the purchase orders");
    }
    return (data ?? []) as string[];
  }

  async listPurchaseOrders(opts: { runId?: string; limit?: number } = {}) {
    let q = this.db
      .from("purchase_orders")
      .select(`${PO_COLUMNS}, purchase_order_lines(count)`)
      .eq("org_id", this.orgId)
      .order("created_at", { ascending: false })
      .order("number")
      .limit(opts.limit ?? 50);
    if (opts.runId) {
      if (!UUID.test(opts.runId)) return [];
      q = q.eq("run_id", opts.runId);
    }
    const { data, error } = await q;
    if (error) fail(error, "load purchase orders");
    return data.map((r) => {
      const counted = r.purchase_order_lines as unknown as { count: number }[];
      return toPoSummary(r, counted[0]?.count ?? 0);
    });
  }

  async getPurchaseOrder(id: string): Promise<PurchaseOrder | null> {
    if (!UUID.test(id)) return null;
    const { data, error } = await this.db
      .from("purchase_orders")
      .select(
        `${PO_COLUMNS}, deliver_to, purchase_order_lines(product_id, product_name, requested_product_id, offer_id, supplier_sku, packs, pack_label, pack_quantity, pack_unit, pack_price_cents, price_basis, line_total_cents, position)`,
      )
      .eq("org_id", this.orgId)
      .eq("id", id)
      .order("position", { referencedTable: "purchase_order_lines" })
      .maybeSingle();
    if (error) fail(error, "load that purchase order");
    if (!data) return null;
    const lines = [...data.purchase_order_lines]
      .sort((x, y) => x.position - y.position)
      .map((l): PurchaseOrderLineDraft => ({
        product_id: l.product_id,
        product_name: l.product_name,
        requested_product_id: l.requested_product_id,
        offer_id: l.offer_id,
        supplier_sku: l.supplier_sku,
        packs: l.packs,
        pack_label: l.pack_label,
        pack_quantity: l.pack_quantity,
        pack_unit: l.pack_unit,
        pack_price_cents: l.pack_price_cents,
        price_basis: l.price_basis as PurchaseOrderLineDraft["price_basis"],
        line_total_cents: l.line_total_cents,
      }));
    const summary = toPoSummary(data, lines.length);
    return {
      id: summary.id,
      runId: summary.runId,
      number: summary.number,
      supplier_id: summary.supplier_id,
      supplier_name: summary.supplier_name,
      status: summary.status,
      delivery_date: summary.delivery_date,
      order_by_date: summary.order_by_date,
      order_by_time: summary.order_by_time,
      items_subtotal_cents: summary.items_subtotal_cents,
      delivery_fee_cents: summary.delivery_fee_cents,
      total_cents: summary.total_cents,
      createdAt: summary.createdAt,
      exportedAt: summary.exportedAt,
      deliver_to: data.deliver_to as unknown as DeliverTo,
      lines,
    };
  }

  async markPurchaseOrderExported(id: string) {
    const { data, error } = await this.db.rpc("mark_po_exported", { p_org: this.orgId, p_po: id });
    if (error) {
      if (error.code === "P0002") throw new BuyerStateError("That purchase order no longer exists");
      fail(error, "mark the purchase order exported");
    }
    return new Date(data);
  }

  async discardDraftPurchaseOrder(id: string) {
    if (!UUID.test(id)) return false;
    const { data, error } = await this.db
      .from("purchase_orders")
      .delete()
      .eq("org_id", this.orgId)
      .eq("id", id)
      .eq("status", "draft")
      .select("id");
    if (error) fail(error, "discard the draft");
    return data.length > 0;
  }

  async savePriceImport(input: PriceImportInput) {
    const { data, error } = await this.db.rpc("save_price_import", {
      p_org: this.orgId,
      p_vendor_name: input.vendorName,
      // The generated types say string; null is what the SQL function expects for "none".
      p_supplier_id: input.supplierId as string,
      p_document_kind: input.documentKind,
      p_document_date: input.documentDate as string,
      p_lines: input.lines as unknown as Json,
    });
    if (error) fail(error, "save these prices");
    return data;
  }

  async listPriceImports(limit = 50): Promise<PriceImportSummary[]> {
    const { data, error } = await this.db
      .from("price_imports")
      .select(
        "id, vendor_name, supplier_id, document_kind, document_date, created_at, vendor_prices(count)",
      )
      .eq("org_id", this.orgId)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) fail(error, "load your vendor prices");
    return data.map((r) => ({
      id: r.id,
      vendorName: r.vendor_name,
      supplierId: r.supplier_id,
      documentKind: toKind(r.document_kind),
      documentDate: r.document_date,
      importedAt: new Date(r.created_at),
      lineCount: r.vendor_prices[0]?.count ?? 0,
    }));
  }

  async listVendorPrices(filter: { productId?: string; supplierId?: string } = {}) {
    let q = this.db
      .from("vendor_prices")
      .select(
        "id, import_id, product_id, description, pack_quantity, pack_unit, pack_label, price_cents, confidence, mapping_method, price_imports!inner(vendor_name, supplier_id, document_kind, document_date, created_at)",
      )
      .eq("org_id", this.orgId);
    if (filter.productId) q = q.eq("product_id", filter.productId);
    if (filter.supplierId) q = q.eq("price_imports.supplier_id", filter.supplierId);
    const { data, error } = await q.order("created_at", { ascending: false }).limit(2000);
    if (error) fail(error, "load your vendor prices");
    return data
      .map((r): VendorPrice => ({
        id: r.id,
        importId: r.import_id,
        vendorName: r.price_imports.vendor_name,
        supplierId: r.price_imports.supplier_id,
        productId: r.product_id,
        description: r.description,
        packQuantity: String(r.pack_quantity),
        packUnit: r.pack_unit,
        packLabel: r.pack_label,
        priceCents: r.price_cents,
        confidence: r.confidence === "high" || r.confidence === "medium" ? r.confidence : "low",
        mappingMethod: r.mapping_method === "manual" ? "manual" : "ai_suggested",
        documentKind: toKind(r.price_imports.document_kind),
        documentDate: r.price_imports.document_date,
        importedAt: new Date(r.price_imports.created_at),
      }))
      .sort((a, b) => b.importedAt.getTime() - a.importedAt.getTime());
  }

  async deletePriceImport(id: string) {
    if (!UUID.test(id)) return false;
    const { data, error } = await this.db
      .from("price_imports")
      .delete()
      .eq("org_id", this.orgId)
      .eq("id", id)
      .select("id");
    if (error) fail(error, "delete those prices");
    return data.length > 0;
  }

  async logPriceRead() {
    const { error } = await this.db.from("price_reads").insert({ org_id: this.orgId });
    if (error) fail(error, "start reading the image");
    const since = new Date(Date.now() - 3_600_000).toISOString();
    const { count, error: countError } = await this.db
      .from("price_reads")
      .select("id", { count: "exact", head: true })
      .eq("org_id", this.orgId)
      .gte("created_at", since);
    if (countError) fail(countError, "start reading the image");
    return count ?? 0;
  }

  async startAutopilotRun(usedAi: boolean) {
    const { data, error } = await this.db
      .from("autopilot_runs")
      .insert({ org_id: this.orgId, used_ai: usedAi })
      .select("id")
      .single();
    if (error) fail(error, "start Autopilot");
    return data.id;
  }

  async finishAutopilotRun(id: string, o: AutopilotOutcome) {
    const { error } = await this.db
      .from("autopilot_runs")
      .update({
        status: o.status,
        finished_at: new Date().toISOString(),
        delivery_date: o.deliveryDate,
        optimization_run_id: o.optimizationRunId,
        headline: o.headline?.slice(0, 200) ?? null,
        notes: o.notes.slice(0, 5),
        error: o.error?.slice(0, 300) ?? null,
      })
      .eq("org_id", this.orgId)
      .eq("id", id);
    if (error) fail(error, "save the Autopilot plan");
  }

  async latestAutopilotRun(): Promise<AutopilotRunRecord | null> {
    const { data, error } = await this.db
      .from("autopilot_runs")
      .select(
        "id, created_at, status, used_ai, delivery_date, optimization_run_id, headline, notes, error",
      )
      .eq("org_id", this.orgId)
      .neq("status", "running")
      .order("created_at", { ascending: false })
      .limit(1);
    if (error) fail(error, "load Autopilot");
    const r = data[0];
    if (!r) return null;
    return {
      id: r.id,
      createdAt: new Date(r.created_at),
      status: r.status === "planned" ? "planned" : "failed",
      usedAi: r.used_ai,
      deliveryDate: r.delivery_date,
      optimizationRunId: r.optimization_run_id,
      headline: r.headline,
      notes: Array.isArray(r.notes)
        ? r.notes.filter((n): n is string => typeof n === "string")
        : [],
      error: r.error,
    };
  }

  async countRecentAiAutopilotRuns() {
    const since = new Date(Date.now() - 3_600_000).toISOString();
    const { count, error } = await this.db
      .from("autopilot_runs")
      .select("id", { count: "exact", head: true })
      .eq("org_id", this.orgId)
      .eq("used_ai", true)
      .gte("created_at", since);
    if (error) fail(error, "start Autopilot");
    return count ?? 0;
  }
}
