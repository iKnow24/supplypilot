import type { PostgrestError } from "@supabase/supabase-js";

import type { Json } from "../db/database.types";
import type { OptimizeRequest, OptimizeResponse } from "../optimizer/types";
import type { DbClient } from "../supabase/server";
import {
  BuyerStateError,
  type BuyerStateRepository,
  type Cart,
  type CartLine,
  type OptimizationRun,
  type OptimizationRunSummary,
  type SavedList,
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
}
