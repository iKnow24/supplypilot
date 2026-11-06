/**
 * Buyer-owned, persisted state: the working cart, saved lists, favorites, supplier
 * preferences. Bound to ONE buyer org; implementations must enforce that (the Supabase one
 * relies on Postgres RLS, see supabase/migrations).
 *
 * The read-only catalog stays behind CatalogRepository. Ids stored here (products,
 * suppliers, units) point into that catalog and are validated before every write by the
 * server actions (src/app/cart/actions.ts).
 */
import type { OptimizeRequest, OptimizeResponse } from "../optimizer/types";
import type { PurchaseOrder, PurchaseOrderDraft, PurchaseOrderSummary } from "../orders/types";

export interface CartLine {
  product_id: string;
  /** Positive decimal string, never a float. */
  quantity: string;
  unit: string;
  /** Where the buyer usually buys it (baseline). Null for lines added by hand. */
  current_supplier_id: string | null;
}

export interface Cart {
  id: string;
  deliveryDate: string | null;
  /** Saved list the cart was loaded from: the baseline for savings. */
  sourceListId: string | null;
  preferredSupplierIds: string[];
  excludedSupplierIds: string[];
  lines: CartLine[];
}

export interface SavedList {
  id: string;
  name: string;
  lines: CartLine[];
  updatedAt: Date;
}

export type SupplierPreference = "preferred" | "neutral" | "excluded";

/** One "Find My Best Price" result, stored exactly as the optimizer returned it. */
export interface OptimizationRun {
  id: string;
  createdAt: Date;
  deliveryDate: string;
  status: "optimal" | "partial" | "infeasible";
  totalCents: number | null;
  savingsCents: number | null;
  supplierCount: number | null;
  lineCount: number;
  request: OptimizeRequest;
  response: OptimizeResponse;
}

export type OptimizationRunSummary = Omit<OptimizationRun, "request" | "response">;

export interface BuyerStateRepository {
  readonly orgId: string;

  getCart(): Promise<Cart>;
  /** Appends a line. Returns false (and changes nothing) if the product is already in the cart. */
  addLine(line: CartLine): Promise<boolean>;
  updateLine(productId: string, amount: { quantity: string; unit: string }): Promise<void>;
  removeLine(productId: string): Promise<void>;
  /** "replace" clears the cart (and its baseline) first; "merge" updates/adds. Atomic. */
  setLines(lines: CartLine[], mode: "replace" | "merge"): Promise<void>;
  setDeliveryDate(date: string | null): Promise<void>;
  setSupplierPreferences(prefs: { preferred: string[]; excluded: string[] }): Promise<void>;

  listSavedLists(): Promise<SavedList[]>;
  /** Replaces the cart with the list and records it as the baseline. Atomic. */
  loadList(listId: string): Promise<void>;
  saveCartAsList(name: string): Promise<string>;
  duplicateList(listId: string, name: string): Promise<string>;
  renameList(listId: string, name: string): Promise<void>;
  deleteList(listId: string): Promise<void>;

  listFavorites(): Promise<string[]>;
  setFavorite(productId: string, favorite: boolean): Promise<void>;

  saveRun(request: OptimizeRequest, response: OptimizeResponse): Promise<string>;
  getRun(id: string): Promise<OptimizationRun | null>;
  listRuns(limit?: number): Promise<OptimizationRunSummary[]>;

  /** One draft PO per supplier for an approved run. Idempotent per (run, supplier). */
  createPurchaseOrders(runId: string, drafts: PurchaseOrderDraft[]): Promise<string[]>;
  listPurchaseOrders(opts?: { runId?: string; limit?: number }): Promise<PurchaseOrderSummary[]>;
  getPurchaseOrder(id: string): Promise<PurchaseOrder | null>;
  /** Draft -> Exported (first export time is kept). */
  markPurchaseOrderExported(id: string): Promise<Date>;
  /** Only drafts can be discarded; exported POs are permanent. */
  discardDraftPurchaseOrder(id: string): Promise<boolean>;
}

/** An error whose message is safe and useful to show the buyer. */
export class BuyerStateError extends Error {
  constructor(
    message: string,
    readonly code?: string,
  ) {
    super(message);
    this.name = "BuyerStateError";
  }
}
