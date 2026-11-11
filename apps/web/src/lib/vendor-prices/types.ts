/**
 * Vendor prices a buyer brings in from a screenshot (price list, invoice, email, text).
 * Shared by the server (extraction, validation, storage) and the review screen in the browser.
 */

export const CONFIDENCES = ["high", "medium", "low"] as const;
export type Confidence = (typeof CONFIDENCES)[number];

export const DOCUMENT_KINDS = ["price_list", "invoice", "email", "text_message", "other"] as const;
export type DocumentKind = (typeof DOCUMENT_KINDS)[number];

export const DOCUMENT_KIND_LABEL: Record<DocumentKind, string> = {
  price_list: "Price list",
  invoice: "Invoice",
  email: "Email",
  text_message: "Text message",
  other: "Other",
};

export type MappingMethod = "ai_suggested" | "manual";

/** One line read from the image, as the buyer reviews it. Nothing here is saved yet. */
export interface DraftLine {
  key: string;
  /** The line as printed on the document. */
  description: string;
  /** Catalog product the AI matched, if any. */
  productId: string | null;
  /** Products to offer first in the picker, best first. */
  suggestions: string[];
  /** Decimal string ("" if it couldn't be read). */
  packQuantity: string;
  /** Catalog unit code, or null if it couldn't be read. */
  packUnit: string | null;
  packLabel: string;
  /** Price of one pack, in cents. Null if it couldn't be read. */
  priceCents: number | null;
  /** When the document gave a per-unit price, how it was turned into a pack price. */
  readAs: string | null;
  confidence: Confidence;
  /** Why the line needs a closer look. Plain English. */
  issues: string[];
}

export interface PriceDraft {
  vendorName: string;
  /** Catalog supplier the vendor looks like, if any. */
  supplierId: string | null;
  documentKind: DocumentKind;
  /** YYYY-MM-DD, as printed on the document. */
  documentDate: string | null;
  lines: DraftLine[];
  /** Anything the AI wants the buyer to know (blurry, cut off, ...). */
  notes: string | null;
}

/** What the browser sends to save. Every field is re-validated on the server. */
export interface PriceImportPayload {
  vendorName: string;
  supplierId: string | null;
  documentKind: string;
  documentDate: string | null;
  lines: {
    description: string;
    productId: string;
    packQuantity: string;
    packUnit: string;
    packLabel: string;
    /** Dollars, as typed: "26.89". */
    price: string;
    confidence: string;
    mappingMethod: string;
  }[];
}

/** A validated import, ready to store. */
export interface PriceImportInput {
  vendorName: string;
  supplierId: string | null;
  documentKind: DocumentKind;
  documentDate: string | null;
  lines: {
    product_id: string;
    description: string;
    pack_quantity: string;
    pack_unit: string;
    pack_label: string;
    price_cents: number;
    confidence: Confidence;
    mapping_method: MappingMethod;
  }[];
}

export interface PriceImportSummary {
  id: string;
  /** 'screenshot': added on its own; 'document': learned during store setup. */
  sourceType: "screenshot" | "document";
  vendorName: string;
  supplierId: string | null;
  documentKind: DocumentKind;
  documentDate: string | null;
  importedAt: Date;
  lineCount: number;
}

/** One saved, buyer-provided price. */
export interface VendorPrice {
  id: string;
  importId: string;
  vendorName: string;
  supplierId: string | null;
  productId: string;
  description: string;
  packQuantity: string;
  packUnit: string;
  packLabel: string;
  priceCents: number;
  confidence: Confidence;
  mappingMethod: MappingMethod;
  documentKind: DocumentKind;
  documentDate: string | null;
  importedAt: Date;
  /** On an invoice line: packs bought (decimal string). Null otherwise. */
  packs: string | null;
}
