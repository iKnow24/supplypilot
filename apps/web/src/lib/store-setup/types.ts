/**
 * "Set up from your documents": a new store uploads what it already has (an inventory sheet,
 * recent invoices, price sheets, vendor texts) and SupplyPilot learns its items, vendors,
 * stock, weekly use and usual order from them. Shared by the server (reading, validation,
 * storage) and the review screen in the browser.
 */
import type { Confidence } from "../vendor-prices/types";

/** What a document is. Inventory sheets give counts; the rest give vendors and prices. */
export const SETUP_DOC_KINDS = [
  "inventory",
  "invoice",
  "price_list",
  "text_message",
  "email",
  "other",
] as const;
export type SetupDocKind = (typeof SETUP_DOC_KINDS)[number];

export const SETUP_DOC_LABEL: Record<SetupDocKind, string> = {
  inventory: "Inventory count",
  invoice: "Invoice",
  price_list: "Price list",
  text_message: "Text message",
  email: "Email",
  other: "Other",
};

/** Kinds that become a dated vendor-price import. */
export type PriceDocKind = Exclude<SetupDocKind, "inventory">;
export const isPriceDoc = (k: SetupDocKind): k is PriceDocKind => k !== "inventory";

/** One line read from one document, after deterministic clean-up. Nothing here is saved. */
export interface SetupLine {
  key: string;
  /** The line as printed. */
  description: string;
  /** Catalog product the AI matched, if any. */
  productId: string | null;
  /** Products to offer in the picker, best first. */
  suggestions: string[];
  /** One pack as sold: decimal string ("" if unknown) + catalog unit. */
  packQuantity: string;
  packUnit: string | null;
  packLabel: string;
  /** Price of one pack, in cents. Null if not shown or unreadable. */
  priceCents: number | null;
  /** How a per-unit price or a line total was turned into a pack price. */
  readAs: string | null;
  /** Invoice lines: packs bought ("" if not an invoice line, or unreadable). */
  packs: string;
  /** Inventory lines: amount on hand ("" if none), in countUnit. */
  count: string;
  countUnit: string | null;
  /** When a count was given in packs, how it was turned into units ("3 × 50 lb bag"). */
  countReadAs: string | null;
  confidence: Confidence;
  /** Why the line needs a look. Plain English. */
  issues: string[];
}

/** One uploaded file, read. */
export interface DocumentDraft {
  key: string;
  fileName: string;
  kind: SetupDocKind;
  vendorName: string;
  /** Catalog supplier the vendor looks like, if any. */
  supplierId: string | null;
  /** YYYY-MM-DD as printed, if any. */
  documentDate: string | null;
  notes: string | null;
  lines: SetupLine[];
}

/** What the browser sends to save. Every field is re-validated on the server. */
export interface SetupPayload {
  items: {
    key: string;
    /** As the documents call it. */
    name: string;
    /** Null: not matched yet. */
    productId: string | null;
    /** All in `unit` ("" = unknown). */
    unit: string;
    onHand: string;
    weekly: string;
    usual: string;
  }[];
  documents: {
    /** For messages only. */
    fileName: string;
    kind: string;
    vendorName: string;
    supplierId: string | null;
    documentDate: string | null;
    lines: {
      itemKey: string;
      description: string;
      packQuantity: string;
      packUnit: string;
      packLabel: string;
      /** Dollars as typed, "26.89" ("" for an unmatched item's line that wasn't priced). */
      price: string;
      /** Packs bought (invoices), "" otherwise. */
      packs: string;
      confidence: string;
      /** The product the AI matched for this line, to record whether the buyer changed it. */
      aiProductId: string | null;
    }[];
  }[];
}

/** A validated setup, in the shape save_store_setup() takes. */
export interface StoreSetupInput {
  items: {
    name: string;
    product_id: string | null;
    vendor_name: string | null;
    note: string | null;
  }[];
  imports: {
    vendor_name: string;
    supplier_id: string | null;
    document_kind: PriceDocKind;
    document_date: string | null;
    lines: {
      product_id: string;
      description: string;
      pack_quantity: string;
      pack_unit: string;
      pack_label: string;
      price_cents: number;
      confidence: Confidence;
      mapping_method: "ai_suggested" | "manual";
      packs: string | null;
    }[];
  }[];
  counts: { product_id: string; quantity: string; unit: string }[];
  usage: { product_id: string; week_start: string; quantity: string; unit: string }[];
  usual_list: {
    name: string;
    lines: {
      product_id: string;
      quantity: string;
      unit: string;
      current_supplier_id: string | null;
    }[];
  } | null;
}

/** The store's own item, as saved. */
export interface StoreItem {
  id: string;
  name: string;
  /** Null: not matched to a catalog product yet. */
  productId: string | null;
  vendorName: string | null;
  note: string | null;
  createdAt: Date;
}

export const USUAL_LIST_NAME = "Usual order";
