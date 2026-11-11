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
import type { StoreItem, StoreSetupInput } from "../store-setup/types";
import type { PriceImportInput, PriceImportSummary, VendorPrice } from "../vendor-prices/types";

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

/** A shelf count. The latest one per product is what's on hand. */
export interface StockCount {
  productId: string;
  /** Decimal string, never a float. */
  quantity: string;
  unit: string;
  countedAt: Date;
}

/** How much of a product was used in one week (week_start is a Monday). */
export interface StockUsageWeek {
  productId: string;
  weekStart: string;
  quantity: string;
  unit: string;
}

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

  /** Latest count per product. */
  listStockCounts(): Promise<StockCount[]>;
  /** Weekly usage, oldest first. */
  listStockUsage(): Promise<StockUsageWeek[]>;
  /** Appends counts (timestamped by the database). History is never edited. */
  recordStockCounts(
    counts: { product_id: string; quantity: string; unit: string }[],
  ): Promise<void>;

  /**
   * Demo businesses only: back to the seeded starting state (lists and shelf counts), with no
   * cart, results, POs, Autopilot runs, imported prices or favorites. Refused for real orgs.
   */
  resetDemo(): Promise<void>;

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

  /** Saves one reviewed screenshot's approved prices. Atomic. Returns the import id. */
  savePriceImport(input: PriceImportInput): Promise<string>;
  /** Newest first. */
  listPriceImports(limit?: number): Promise<PriceImportSummary[]>;
  /** Buyer-provided prices, newest import first. */
  listVendorPrices(filter?: { productId?: string; supplierId?: string }): Promise<VendorPrice[]>;
  /** Deletes an import and its prices. False if it doesn't exist (or isn't yours). */
  deletePriceImport(id: string): Promise<boolean>;
  /** Logs one image sent to the AI, and returns how many were sent in the last hour. */
  logPriceRead(): Promise<number>;

  /**
   * Saves a reviewed store setup in one transaction, replacing what the last setup learned
   * (items, document imports, usage estimates, the usual order list). Returns the list's id.
   */
  saveStoreSetup(input: StoreSetupInput): Promise<string | null>;
  /** The store's own items, matched or not. */
  listStoreItems(): Promise<StoreItem[]>;

  /** Records the start of an Autopilot run. Returns its id. */
  startAutopilotRun(usedAi: boolean): Promise<string>;
  finishAutopilotRun(id: string, outcome: AutopilotOutcome): Promise<void>;
  /** The newest run, if any. */
  latestAutopilotRun(): Promise<AutopilotRunRecord | null>;
  /** AI-driven runs started in the last hour (for the cap). */
  countRecentAiAutopilotRuns(): Promise<number>;
}

export interface AutopilotOutcome {
  status: "planned" | "failed";
  deliveryDate: string | null;
  optimizationRunId: string | null;
  headline: string | null;
  notes: string[];
  error: string | null;
}

export interface AutopilotRunRecord extends AutopilotOutcome {
  id: string;
  usedAi: boolean;
  createdAt: Date;
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
